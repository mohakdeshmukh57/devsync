export class CallRoom {
  constructor({ supabase, topic, userId, userName, onPeers }) {
    this.supabase = supabase;
    this.topic = topic;
    this.userId = userId;
    this.userName = userName;
    this.onPeers = onPeers;
    this.channel = null;
    this.peers = new Map();
    this.stream = null;
  }

  iceServers() {
    const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
    const url = import.meta.env.VITE_TURN_URL;
    const username = import.meta.env.VITE_TURN_USERNAME;
    const credential = import.meta.env.VITE_TURN_CREDENTIAL;
    if (url && username && credential) servers.push({ urls: url, username, credential });
    return servers;
  }

  async start(localStream) {
    this.stream = localStream;
    this.channel = this.supabase.channel(this.topic, {
      config: { private: true, presence: { key: this.userId }, broadcast: { self: false } },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => this.reconcilePresence())
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== this.userId && this.userId < key) void this.ensurePeer(key, true);
      })
      .on('presence', { event: 'leave' }, ({ key }) => this.removePeer(key))
      .on('broadcast', { event: 'signal' }, ({ payload }) => void this.onSignal(payload));

    await this.channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({ id: this.userId, name: this.userName });
        this.reconcilePresence();
      }
    });
  }

  async reconcilePresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    for (const [key, values] of Object.entries(state)) {
      const data = values?.[0] || {};
      const peerId = data.id || key;
      if (peerId === this.userId) continue;
      const existing = this.peers.get(peerId);
      if (existing) existing.name = data.name || existing.name;
      if (this.userId < peerId && !existing) await this.ensurePeer(peerId, true, data.name || 'Collaborator');
    }
    this.emitPeers();
  }

  createPeer(peerId, name = 'Collaborator') {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers() });
    this.peers.set(peerId, { pc, stream: null, name });

    this.stream?.getTracks().forEach(track => pc.addTrack(track, this.stream));

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      void this.sendSignal({
        kind: 'ice',
        from: this.userId,
        to: peerId,
        candidate: candidate.toJSON(),
      });
    };

    pc.ontrack = ({ streams }) => {
      const remote = streams[0];
      if (!remote) return;
      const peer = this.peers.get(peerId);
      if (peer) peer.stream = remote;
      this.emitPeers();
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) this.removePeer(peerId);
    };

    return pc;
  }

  async ensurePeer(peerId, offerer, name = 'Collaborator') {
    if (this.peers.has(peerId)) return this.peers.get(peerId).pc;
    const pc = this.createPeer(peerId, name);
    if (offerer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal({ kind: 'offer', from: this.userId, to: peerId, sdp: offer, name: this.userName });
    }
    return pc;
  }

  async onSignal(signal) {
    if (!signal || signal.to !== this.userId) return;

    if (signal.kind === 'offer') {
      const pc = await this.ensurePeer(signal.from, false, signal.name || 'Collaborator');
      await pc.setRemoteDescription(signal.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal({ kind: 'answer', from: this.userId, to: signal.from, sdp: answer });
      return;
    }

    const entry = this.peers.get(signal.from);
    if (!entry) return;

    if (signal.kind === 'answer') {
      await entry.pc.setRemoteDescription(signal.sdp);
      return;
    }

    if (signal.kind === 'ice') {
      try {
        await entry.pc.addIceCandidate(signal.candidate);
      } catch {
        // Ignore ICE candidates arriving after peer teardown.
      }
    }
  }

  sendSignal(payload) {
    return this.channel.send({ type: 'broadcast', event: 'signal', payload });
  }

  replaceVideoTrack(track) {
    for (const { pc } of this.peers.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) void sender.replaceTrack(track);
    }
  }

  setRemoteName(peerId, name) {
    const entry = this.peers.get(peerId);
    if (entry) entry.name = name;
    this.emitPeers();
  }

  emitPeers() {
    this.onPeers([...this.peers.entries()]
      .filter(([, entry]) => entry.stream)
      .map(([id, entry]) => ({ id, name: entry.name || 'Collaborator', stream: entry.stream })));
  }

  removePeer(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    entry.pc.close();
    this.peers.delete(peerId);
    this.emitPeers();
  }

  async stop() {
    for (const entry of this.peers.values()) entry.pc.close();
    this.peers.clear();
    if (this.channel) await this.channel.unsubscribe();
    this.channel = null;
    this.emitPeers();
  }
}
