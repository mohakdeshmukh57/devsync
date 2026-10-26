import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { supabase, toast } from './lib/supabase';
import { CallRoom } from './lib/webrtc';
import { LANGS, EXT_LANG, DEFAULT_SETTINGS, extOf, langFromName, isTextName } from './lib/constants';
import { buildPreview, pickPreviewFile, runJavaScript, runPython, stopRun, formatSource, SERVER_LANGS, runOnServer } from './lib/runner';
import { Toasts, Loading, Setup } from './components/common';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Workspace, { TVScreen } from './components/Workspace';
import './styles.css';
import './app-theme.css';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// Turns raw Postgres/PostgREST errors into something actionable.
function explain(error) {
  const msg = error?.message || String(error || 'Something went wrong.');
  if (/recursion|schema cache|does not exist|permission denied|row-level security|could not find the function|max_members/i.test(msg)) {
    return `${msg} — Run supabase/setup.sql once in the Supabase SQL editor (see README).`;
  }
  return msg;
}

async function getMedia() {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  for (const constraints of [{ audio: true, video: true }, { audio: true }, { video: true }]) {
    try { return await navigator.mediaDevices.getUserMedia(constraints); } catch { /* try the next option */ }
  }
  return null;
}

function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState('landing');
  const [authMode, setAuthMode] = useState('login');
  const [authOpen, setAuthOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const [meetings, setMeetings] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [meetingName, setMeetingName] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);

  const [meeting, setMeeting] = useState(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [secondId, setSecondId] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [split, setSplit] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [previewWidth, setPreviewWidth] = useState('100%');
  const [logs, setLogs] = useState([]);
  const [chat, setChat] = useState([]);
  const [members, setMembers] = useState([]);
  const [callPeers, setCallPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [shareStream, setShareStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('ds-settings') || '{}') }; } catch { return DEFAULT_SETTINGS; }
  });

  const channelRef = useRef(null);
  const subscribedRef = useRef(false);
  const callRef = useRef(null);
  const callToken = useRef(0);
  const mediaRef = useRef(null);
  const screenTrackRef = useRef(null);
  const registry = useRef({});
  const filesRef = useRef([]);
  const activeRef = useRef(null);
  const secondRef = useRef(null);
  const nameRef = useRef('Developer');

  filesRef.current = files;
  activeRef.current = activeId;
  secondRef.current = split ? secondId : null;

  const userId = session?.user?.id;
  const userName = profile?.name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Developer';
  nameRef.current = userName;
  const activeFile = useMemo(() => files.find(f => f.id === activeId) || null, [files, activeId]);
  const secondFile = useMemo(() => (split ? files.find(f => f.id === secondId) || null : null), [files, secondId, split]);

  useEffect(() => { try { localStorage.setItem('ds-settings', JSON.stringify(settings)); } catch { /* storage unavailable */ } }, [settings]);

  /* ---------------------------------------------------------------- auth */
  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setSession(data.session || null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => { if (alive) setSession(s || null); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session === undefined || !supabase) return;
    if (!session) { void cleanupMeeting(); resetMeetingState(); setProfile(null); setMeetings([]); setScreen('landing'); return; }
    let cancelled = false;
    (async () => {
      const uid = session.user.id;
      const fallbackName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Developer';
      let { data: p } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (!p) {
        await supabase.from('profiles').upsert({ id: uid, name: fallbackName });
        ({ data: p } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
      }
      if (cancelled) return;
      setProfile(p || { id: uid, name: fallbackName });
      await loadMeetings();
      const route = location.pathname.match(new RegExp(`^/(meeting|tv)/(${UUID})`, 'i'));
      if (!route) { setScreen('dashboard'); return; }
      const invite = new URLSearchParams(location.search).get('invite');
      if (invite) {
        const { error } = await supabase.rpc('join_meeting_by_invite', { p_token: invite });
        if (error) toast(explain(error));
      }
      await loadMeetings();
      await openMeeting(route[2], route[1].toLowerCase() === 'tv');
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id, session === null]);

  useEffect(() => () => { void cleanupMeeting(); }, []);

  async function authSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    setAuthError(''); setAuthNotice(''); setAuthBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    const name = String(fd.get('name') || '').trim();
    try {
      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name || email.split('@')[0] } } });
        if (error) throw error;
        if (!data.session) { setAuthNotice('Account created. Check your email and click the confirmation link, then sign in.'); setAuthMode('login'); return; }
        toast('Account created');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast('Welcome back');
      }
      setAuthOpen(false);
    } catch (err) { setAuthError(err.message); } finally { setAuthBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try { await cleanupMeeting(); } catch (e) { console.error(e); }
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (e) { console.error(e); }
    resetMeetingState();
    setSession(null); setProfile(null); setMeetings([]); setScreen('landing');
    history.replaceState(null, '', '/');
    setBusy(false);
  }

  /* ------------------------------------------------------------ meetings */
  async function loadMeetings() {
    const { data, error } = await supabase.from('meetings').select('*').order('created_at', { ascending: false });
    if (error) return toast(explain(error));
    // seats taken per meeting (members can see the member rows of their own meetings)
    const { data: rows } = await supabase.from('meeting_members').select('meeting_id');
    const counts = {};
    (rows || []).forEach(r => { counts[r.meeting_id] = (counts[r.meeting_id] || 0) + 1; });
    setMeetings((data || []).map(m => ({ ...m, member_count: counts[m.id] || 1 })));
  }

  async function createMeeting() {
    const name = meetingName.trim();
    if (!name) return toast('Give your meeting a name first.');
    if (!userId) return toast('Your session expired. Please sign in again.');
    setBusy(true);
    try {
      let id;
      const rpc = await supabase.rpc('create_meeting', { p_name: name, p_max: maxMembers });
      if (!rpc.error && rpc.data) id = rpc.data;
      else {
        // Fallback if the RPC is unavailable: two plain inserts, still guarded by RLS.
        id = crypto.randomUUID();
        const ins = await supabase.from('meetings').insert({ id, name, owner_id: userId, invite_token: crypto.randomUUID(), max_members: maxMembers });
        if (ins.error) throw new Error(`${explain(rpc.error || ins.error)}`);
        const mem = await supabase.from('meeting_members').insert({ meeting_id: id, user_id: userId, role: 'owner' });
        if (mem.error) { await supabase.from('meetings').delete().eq('id', id); throw mem.error; }
      }
      setCreateOpen(false); setMeetingName(''); setMaxMembers(10);
      await loadMeetings();
      toast('Meeting created');
      await openMeeting(id, false);
    } catch (e) {
      console.error('create meeting failed', e);
      toast(explain(e));
    } finally { setBusy(false); }
  }

  async function renameMeeting(m) {
    if (m.owner_id !== userId) return toast('Only the meeting owner can rename it.');
    const n = window.prompt('Rename meeting', m.name)?.trim();
    if (!n || n === m.name) return;
    const { data, error } = await supabase.from('meetings').update({ name: n }).eq('id', m.id).select('id');
    if (error) return toast(explain(error));
    if (!data?.length) return toast('Only the meeting owner can rename it.');
    await loadMeetings();
    toast('Meeting renamed');
  }

  async function changeCapacity(m) {
    if (m.owner_id !== userId) return toast('Only the meeting owner can change the capacity.');
    const input = window.prompt(`Maximum participants (2–50). ${m.member_count} currently in the meeting.`, String(m.max_members ?? 10));
    if (input === null) return;
    const n = Math.round(Number(input));
    if (!Number.isFinite(n) || n < 2 || n > 50) return toast('Enter a number between 2 and 50.');
    if (n < m.member_count) return toast(`Capacity can't be lower than the ${m.member_count} people already in this meeting.`);
    const { data, error } = await supabase.from('meetings').update({ max_members: n }).eq('id', m.id).select('id');
    if (error) return toast(explain(error));
    if (!data?.length) return toast('Only the meeting owner can change the capacity.');
    await loadMeetings();
    toast(`Capacity set to ${n}`);
  }

  async function deleteMeeting(m) {
    if (m.owner_id !== userId) return toast('Only the meeting owner can delete it.');
    if (!window.confirm(`Delete "${m.name}" and all its files? This cannot be undone.`)) return;
    const { data, error } = await supabase.from('meetings').delete().eq('id', m.id).select('id');
    if (error) return toast(explain(error));
    if (!data?.length) return toast('Only the meeting owner can delete it.');
    await loadMeetings();
    toast('Meeting deleted');
  }

  function resetMeetingState() {
    setMeeting(null); setFiles([]); setFolders([]); setAssets([]); setActiveId(null); setSecondId(null); setTabs([]);
    setSplit(false); setPreview(''); setLogs([]); setChat([]); setMembers([]); setFocusMode(false);
  }

  async function openMeeting(id, isTV = false) {
    setBusy(true);
    try {
      await cleanupMeeting();
      resetMeetingState();
      const [m, f, fo] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id).maybeSingle(),
        supabase.from('files').select('*').eq('meeting_id', id).order('created_at'),
        supabase.from('folders').select('*').eq('meeting_id', id).order('created_at'),
      ]);
      if (m.error) throw m.error;
      if (!m.data) throw new Error('Meeting not found, or you are not a member. Ask the owner for an invite link.');
      setMeeting(m.data); setFiles(f.data || []); setFolders(fo.data || []);
      setScreen(isTV ? 'tv' : 'meeting');
      history.replaceState(null, '', `/${isTV ? 'tv' : 'meeting'}/${id}`);
      await subscribeMeeting(id, isTV);
      if (!isTV) { void loadAssets(id); void startCall(id); }
    } catch (e) {
      toast(explain(e));
      setScreen('dashboard');
      history.replaceState(null, '', '/');
    } finally { setBusy(false); }
  }

  async function leave() {
    await cleanupMeeting();
    resetMeetingState();
    setScreen('dashboard');
    history.replaceState(null, '', '/');
    void loadMeetings();
  }

  async function cleanupMeeting() {
    stopRun();
    callToken.current += 1;
    try { screenTrackRef.current?.stop(); } catch { /* already stopped */ }
    screenTrackRef.current = null;
    try { await callRef.current?.stop(); } catch (e) { console.error(e); }
    callRef.current = null;
    mediaRef.current?.getTracks().forEach(t => t.stop());
    mediaRef.current = null;
    setLocalStream(null); setShareStream(null); setCallPeers([]);
    const ch = channelRef.current;
    channelRef.current = null; subscribedRef.current = false;
    if (ch) { try { await ch.unsubscribe(); } catch (e) { console.error(e); } }
  }

  /* ------------------------------------------------------------ realtime */
  async function subscribeMeeting(id, isTV) {
    try { await supabase.realtime.setAuth(); } catch { /* token is applied automatically on most versions */ }
    const ch = supabase.channel('meeting:' + id, { config: { private: true, presence: { key: userId }, broadcast: { self: false } } });
    const syncPresence = () => {
      const list = [];
      Object.values(ch.presenceState()).forEach(v => { if (v?.[0]) list.push(v[0]); });
      setMembers(list);
    };
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => setChat(old => [...old, payload]))
      .on('broadcast', { event: 'file-change' }, ({ payload }) => {
        if (payload.id === activeRef.current || payload.id === secondRef.current) return; // live via the CRDT session
        setFiles(old => old.map(f => (f.id === payload.id ? { ...f, content: payload.content } : f)));
      })
      .on('broadcast', { event: 'files-refresh' }, () => { void refreshMeetingData(id); })
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          if (!isTV) await ch.track({ id: userId, name: nameRef.current, activeFile: activeRef.current });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          toast('Live connection problem. If this keeps happening, run supabase/setup.sql and check Realtime settings.');
        }
      });
    channelRef.current = ch;
  }

  useEffect(() => {
    if (channelRef.current && subscribedRef.current && screen === 'meeting') {
      void channelRef.current.track({ id: userId, name: userName, activeFile: activeId });
    }
  }, [activeId, userName]);

  const announce = useCallback(() => channelRef.current?.send({ type: 'broadcast', event: 'files-refresh', payload: {} }), []);

  async function refreshMeetingData(id) {
    const [f, fo] = await Promise.all([
      supabase.from('files').select('*').eq('meeting_id', id).order('created_at'),
      supabase.from('folders').select('*').eq('meeting_id', id).order('created_at'),
    ]);
    if (f.data) {
      const open = new Set([activeRef.current, secondRef.current].filter(Boolean));
      setFiles(old => f.data.map(x => (open.has(x.id) ? { ...x, content: old.find(o => o.id === x.id)?.content ?? x.content } : x)));
      const ids = new Set(f.data.map(x => x.id));
      setTabs(t => t.filter(tid => ids.has(tid)));
      if (activeRef.current && !ids.has(activeRef.current)) setActiveId(null);
      if (secondRef.current && !ids.has(secondRef.current)) setSecondId(null);
    }
    if (fo.data) setFolders(fo.data);
    if (screen !== 'tv') void loadAssets(id);
  }

  /* ---------------------------------------------------------- video call */
  async function startCall(id) {
    const token = ++callToken.current;
    const stream = await getMedia();
    if (token !== callToken.current) { stream?.getTracks().forEach(t => t.stop()); return; }
    if (!stream) toast('Camera/microphone unavailable or blocked. You can still collaborate and see others.');
    mediaRef.current = stream;
    setLocalStream(stream);
    setMicOn(stream?.getAudioTracks()[0]?.enabled !== false);
    setCameraOn(stream?.getVideoTracks()[0]?.enabled !== false);
    try {
      const room = new CallRoom({ supabase, topic: 'call:' + id, userId, userName: nameRef.current, onPeers: setCallPeers });
      await room.start(stream);
      if (token !== callToken.current) { await room.stop(); return; }
      callRef.current = room;
    } catch (e) { console.error('call failed', e); toast('Could not join the video call: ' + e.message); }
  }

  function toggleMedia(kind) {
    const track = kind === 'audio' ? mediaRef.current?.getAudioTracks()[0] : mediaRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === 'audio') setMicOn(track.enabled); else setCameraOn(track.enabled);
  }

  function stopScreenShare() {
    const t = screenTrackRef.current;
    if (!t) return;
    t.onended = null; t.stop();
    screenTrackRef.current = null;
    callRef.current?.replaceVideoTrack(mediaRef.current?.getVideoTracks()[0] || null);
    setShareStream(null);
  }

  async function toggleScreen() {
    if (!callRef.current) return toast('The call is still connecting. Try again in a moment.');
    if (screenTrackRef.current) return stopScreenShare();
    if (!navigator.mediaDevices?.getDisplayMedia) return toast('Screen sharing is not supported in this browser.');
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenTrackRef.current = track;
      track.onended = stopScreenShare;
      callRef.current.replaceVideoTrack(track);
      setShareStream(new MediaStream([track]));
    } catch { toast('Screen sharing cancelled.'); }
  }

  /* --------------------------------------------------------------- files */
  const onContent = useCallback((id, v) => {
    setFiles(old => (old.some(f => f.id === id && f.content !== v) ? old.map(f => (f.id === id ? { ...f, content: v } : f)) : old));
  }, []);

  const onSaved = useCallback((id, content) => {
    channelRef.current?.send({ type: 'broadcast', event: 'file-change', payload: { id, content } });
  }, []);

  function openFile(f) {
    setActiveId(f.id);
    setTabs(t => (t.includes(f.id) ? t : [...t, f.id]));
    if (secondId === f.id) setSecondId(null);
  }

  function closeTab(id) {
    setTabs(t => t.filter(x => x !== id));
    if (id === activeId) {
      const rest = tabs.filter(x => x !== id);
      const idx = tabs.indexOf(id);
      const next = files.find(f => f.id === (rest[idx] || rest[idx - 1]));
      setActiveId(next ? next.id : null);
    }
  }

  const existsIn = (name, folderId, exceptId) => filesRef.current.some(f => f.id !== exceptId && f.name.toLowerCase() === name.toLowerCase() && (f.folder_id || null) === (folderId || null));

  async function createFile({ name, lang, folderId }) {
    let n = name.trim().replace(/[\\/]/g, '');
    if (!n) return toast('Enter a file name.');
    let language = lang;
    if (EXT_LANG[extOf(n)] && n.includes('.')) language = EXT_LANG[extOf(n)];
    else n += '.' + LANGS[lang][1];
    if (existsIn(n, folderId)) return toast('A file with that name already exists in this folder.');
    const { data, error } = await supabase.from('files').insert({ meeting_id: meeting.id, name: n, language, content: '', path: '/', folder_id: folderId || null, created_by: userId }).select('*').single();
    if (error) return toast(explain(error));
    setFiles(old => [...old, data]);
    openFile(data);
    void announce();
    toast(n + ' created');
  }

  async function createFolder(name) {
    const n = name.trim().replace(/[\\/]/g, '');
    if (!n) return toast('Enter a folder name.');
    if (folders.some(f => f.name.toLowerCase() === n.toLowerCase())) return toast('That folder already exists.');
    const { data, error } = await supabase.from('folders').insert({ meeting_id: meeting.id, name: n, parent_id: null, created_by: userId }).select('*').single();
    if (error) return toast(explain(error));
    setFolders(old => [...old, data]);
    void announce();
    toast(n + ' created');
  }

  function dropFilesFromState(ids) {
    const gone = new Set(ids);
    setFiles(old => old.filter(f => !gone.has(f.id)));
    setTabs(t => t.filter(x => !gone.has(x)));
    if (gone.has(activeRef.current)) setActiveId(null);
    if (gone.has(secondRef.current)) setSecondId(null);
  }

  async function deleteFolder(folder) {
    if (!folder) return;
    const inside = files.filter(f => f.folder_id === folder.id);
    if (!window.confirm(`Delete folder "${folder.name}"${inside.length ? ` and its ${inside.length} file${inside.length === 1 ? '' : 's'}` : ''}?`)) return;
    if (inside.length) {
      const r = await supabase.from('files').delete().eq('folder_id', folder.id);
      if (r.error) return toast(explain(r.error));
    }
    const { error } = await supabase.from('folders').delete().eq('id', folder.id);
    if (error) return toast(explain(error));
    dropFilesFromState(inside.map(f => f.id));
    setFolders(old => old.filter(f => f.id !== folder.id));
    void announce();
  }

  async function deleteFile(f) {
    if (!f || !window.confirm(`Delete ${f.name}?`)) return;
    const { error } = await supabase.from('files').delete().eq('id', f.id);
    if (error) return toast(explain(error));
    dropFilesFromState([f.id]);
    void announce();
  }

  async function renameFile(id, name) {
    const f = files.find(x => x.id === id);
    const n = name.trim().replace(/[\\/]/g, '');
    if (!f || !n || n === f.name) return;
    if (existsIn(n, f.folder_id, id)) return toast('A file with that name already exists in this folder.');
    const language = langFromName(n, f.language);
    const { error } = await supabase.from('files').update({ name: n, language, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast(explain(error));
    setFiles(old => old.map(x => (x.id === id ? { ...x, name: n, language } : x)));
    void announce();
  }

  async function moveFile(f, folderId) {
    if (existsIn(f.name, folderId, f.id)) return toast('A file with that name already exists there.');
    const { error } = await supabase.from('files').update({ folder_id: folderId }).eq('id', f.id);
    if (error) return toast(explain(error));
    setFiles(old => old.map(x => (x.id === f.id ? { ...x, folder_id: folderId } : x)));
    void announce();
  }

  async function duplicateFile(f) {
    const dot = f.name.lastIndexOf('.');
    const base = dot > -1 ? f.name.slice(0, dot) : f.name;
    const ext = dot > -1 ? f.name.slice(dot) : '';
    let n = `${base}-copy${ext}`;
    for (let i = 2; existsIn(n, f.folder_id); i += 1) n = `${base}-copy-${i}${ext}`;
    const { data, error } = await supabase.from('files').insert({ meeting_id: meeting.id, name: n, language: f.language, content: f.content || '', path: f.path || '/', folder_id: f.folder_id || null, created_by: userId }).select('*').single();
    if (error) return toast(explain(error));
    setFiles(old => [...old, data]);
    void announce();
    toast(n + ' created');
  }

  async function loadAssets(id) {
    const { data, error } = await supabase.storage.from('project-assets').list(id, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { setAssets([]); return; }
    setAssets((data || []).filter(o => o.name && !o.name.startsWith('.')).map(o => ({ path: `${id}/${o.name}`, name: o.name.replace(/^[0-9a-f-]{36}-/, '') })));
  }

  async function downloadAsset(a) {
    const { data, error } = await supabase.storage.from('project-assets').createSignedUrl(a.path, 60, { download: a.name });
    if (error) return toast(explain(error));
    const el = document.createElement('a'); el.href = data.signedUrl; el.rel = 'noopener'; el.click();
  }

  async function deleteAsset(a) {
    if (!window.confirm(`Delete asset ${a.name}?`)) return;
    const { error } = await supabase.storage.from('project-assets').remove([a.path]);
    if (error) return toast(explain(error));
    await loadAssets(meeting.id);
    void announce();
  }

  async function upload(list) {
    let added = 0;
    for (const file of list) {
      try {
        const asText = isTextName(file.name) && file.size <= 2_000_000 ? await file.text() : null;
        if (asText !== null && !asText.includes('\u0000')) {
          if (existsIn(file.name, null)) { toast(`${file.name} already exists — skipped.`); continue; }
          const { data, error } = await supabase.from('files').insert({ meeting_id: meeting.id, name: file.name, language: langFromName(file.name), content: asText, path: '/', folder_id: null, created_by: userId }).select('*').single();
          if (error) { toast(`${file.name}: ${explain(error)}`); continue; }
          setFiles(old => [...old, data]); added += 1;
        } else {
          const path = `${meeting.id}/${crypto.randomUUID()}-${file.name}`;
          const { error } = await supabase.storage.from('project-assets').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
          if (error) { toast(`${file.name}: ${explain(error)}`); continue; }
          added += 1;
        }
      } catch (e) { toast(`${file.name}: ${e.message}`); }
    }
    if (added) { toast(`${added} file${added === 1 ? '' : 's'} uploaded`); await loadAssets(meeting.id); void announce(); }
  }

  async function download() {
    if (!files.length) return toast('There are no files to download.');
    const zip = new JSZip();
    const folderName = id => folders.find(f => f.id === id)?.name;
    files.forEach(f => zip.file(f.folder_id && folderName(f.folder_id) ? `${folderName(f.folder_id)}/${f.name}` : f.name, f.content || ''));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveBlob(blob, `${(meeting?.name || 'devsync-project').replace(/[^\w.-]+/g, '-')}.zip`);
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  const downloadOne = f => saveBlob(new Blob([f.content || ''], { type: 'text/plain' }), f.name);

  /* -------------------------------------------------------------- preview */
  useEffect(() => {
    if (screen !== 'meeting' && screen !== 'tv') return undefined;
    const t = setTimeout(() => setPreview(buildPreview(files, screen === 'tv' ? null : activeFile)), 250);
    return () => clearTimeout(t);
  }, [files, activeId, screen]);

  useEffect(() => {
    const h = e => {
      const d = e.data;
      if (d?.ds === 'preview' && ['log', 'info', 'warn', 'error'].includes(d.t)) setLogs(l => [...l.slice(-499), { type: d.t, m: d.m }]);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  function openPreviewTab() {
    if (!preview) return toast('Create an HTML file first.');
    window.open(URL.createObjectURL(new Blob([preview], { type: 'text/html' })), '_blank');
  }

  /* ------------------------------------------------------------- run/fmt */
  const log = useCallback(entry => setLogs(l => [...l.slice(-499), entry]), []);

  async function run() {
    const f = filesRef.current.find(x => x.id === activeRef.current);
    if (!f) return toast('Open a file first.');
    const code = f.content || '';
    setLogs([]);
    const lang = f.language;
    if (lang === 'html' || lang === 'css') {
      setPreviewKey(k => k + 1);
      log({ type: 'info', m: `Preview refreshed (${f.name}).` });
      return;
    }
    if (lang === 'javascript') {
      const host = pickPreviewFile(filesRef.current, f);
      if (host && host.id !== f.id && buildPreview(filesRef.current, f).includes(`data-devsync="${f.name}"`)) {
        setPreviewKey(k => k + 1);
        log({ type: 'info', m: `${f.name} is linked from ${host.name} — preview refreshed. Its console output appears here.` });
        return;
      }
      log({ type: 'info', m: `▶ Running ${f.name}…` });
      await runJavaScript(code, log);
      return;
    }
    if (lang === 'python') {
      log({ type: 'info', m: `▶ Running ${f.name}…` });
      await runPython(code, log);
      return;
    }
    if (SERVER_LANGS.has(lang)) {
      log({ type: 'info', m: `▶ Running ${f.name} on the server…` });
      try {
        const body = await runOnServer(lang, code);
        const out = [];
        if (body.compile_output) out.push({ type: 'error', m: body.compile_output });
        if (body.stdout) out.push({ type: 'log', m: body.stdout });
        if (body.stderr) out.push({ type: 'error', m: body.stderr });
        if (body.message) out.push({ type: 'error', m: body.message });
        if (body.status?.id && body.status.id !== 3 && !out.length) out.push({ type: 'error', m: body.status.description });
        if (!out.length) out.push({ type: 'info', m: 'Finished with no output.' });
        setLogs(l => [...l, ...out]);
      } catch (e) {
        log({ type: 'error', m: `${LANGS[lang][0]} needs a code-execution server. ${e.message}` });
      }
      return;
    }
    log({ type: 'info', m: `${LANGS[lang]?.[0] || lang} files can't be run.` });
  }

  function format() {
    const f = filesRef.current.find(x => x.id === activeRef.current);
    if (!f) return toast('Open a file first.');
    const api = registry.current[f.id];
    const current = api?.getText() ?? f.content ?? '';
    let next;
    try { next = formatSource(f.language, current, settings.tab); } catch (e) { return toast('Invalid JSON: ' + e.message); }
    if (next === current) return toast('Already formatted');
    if (!api) return toast('The editor is still connecting. Try again in a moment.');
    api.setText(next);
    toast('Formatted');
  }

  const runShell = cmd => runOnServer('shell', cmd);

  function sendChat(text) {
    const payload = { name: userName, message: text.trim(), from: userId, ts: Date.now() };
    setChat(old => [...old, payload]);
    void channelRef.current?.send({ type: 'broadcast', event: 'chat', payload });
  }

  /* -------------------------------------------------------------- render */
  if (!supabase) return <Setup />;
  if (session === undefined) return <Loading />;
  if (session && screen === 'landing') return <Loading text="Opening your workspace…" />;
  if (!session) {
    return <Landing mode={authMode} setMode={m => { setAuthMode(m); setAuthError(''); setAuthNotice(''); }} authOpen={authOpen} setAuthOpen={setAuthOpen} submit={authSubmit} error={authError} notice={authNotice} busy={authBusy} />;
  }
  if (screen === 'tv' && meeting) return <TVScreen meeting={meeting} preview={preview} onRefresh={() => setPreviewKey(k => k + 1)} key={previewKey} />;
  if (screen === 'dashboard' || !meeting) {
    return (
      <>
        <Dashboard profile={profile} userId={userId} meetings={meetings} onCreate={createMeeting} onOpen={id => openMeeting(id, false)} onRename={renameMeeting} onDelete={deleteMeeting} onCapacity={changeCapacity} onLogout={logout}
          createOpen={createOpen} setCreateOpen={setCreateOpen} meetingName={meetingName} setMeetingName={setMeetingName} maxMembers={maxMembers} setMaxMembers={setMaxMembers} busy={busy} />
        {busy && <div className="busy-overlay"><div className="spinner" /></div>}
      </>
    );
  }

  return (
    <>
      <Workspace
        meeting={meeting} files={files} folders={folders} assets={assets} active={activeFile} second={secondFile} secondId={secondId} setSecondId={setSecondId}
        tabs={tabs} closeTab={closeTab} openFile={openFile} onContent={onContent} onSaved={onSaved} registry={registry}
        settings={settings} setSettings={setSettings} split={split} setSplit={setSplit} focusMode={focusMode} setFocusMode={setFocusMode}
        run={run} stop={() => { stopRun('Stopped.'); }} format={format} logs={logs} clearLogs={() => setLogs([])}
        preview={preview} previewKey={previewKey} setPreviewKey={setPreviewKey} previewWidth={previewWidth} setPreviewWidth={setPreviewWidth} openPreviewTab={openPreviewTab}
        members={members} userId={userId} userName={userName}
        callPeers={callPeers} localStream={localStream} tileStream={shareStream || localStream} screenSharing={Boolean(shareStream)}
        micOn={micOn} cameraOn={cameraOn} hasAudio={Boolean(localStream?.getAudioTracks().length)} hasVideo={Boolean(localStream?.getVideoTracks().length)}
        toggleMic={() => toggleMedia('audio')} toggleCamera={() => toggleMedia('video')} toggleScreen={toggleScreen}
        chat={chat} sendChat={sendChat} inviteLink={`${location.origin}/meeting/${meeting.id}?invite=${meeting.invite_token}`}
        upload={upload} download={download} downloadOne={downloadOne} downloadAsset={downloadAsset} deleteAsset={deleteAsset}
        createFile={createFile} createFolder={createFolder} deleteFolder={deleteFolder} deleteFile={deleteFile} renameFile={renameFile} moveFile={moveFile} duplicateFile={duplicateFile}
        runShell={runShell} openTV={() => window.open('/tv/' + meeting.id, '_blank', 'noopener,noreferrer')} leave={leave}
      />
      {busy && <div className="busy-overlay"><div className="spinner" /></div>}
    </>
  );
}

createRoot(document.getElementById('root')).render(<><App /><Toasts /></>);
