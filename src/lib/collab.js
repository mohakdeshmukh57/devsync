import * as Y from 'yjs';

function toBase64(bytes) {
  let out = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(out);
}

function fromBase64(value) {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function openCollaborativeFile({ supabase, fileId, initialContent, onChange, persist }) {
  const doc = new Y.Doc();
  const text = doc.getText('content');
  const channel = supabase.channel(`file:${fileId}`, {
    config: { private: true, broadcast: { self: false } },
  });

  let remoteSynced = false;
  let initialTimer;
  let persistTimer;
  let closed = false;

  const emit = () => onChange(text.toString());

  text.observe(() => {
    if (!closed) {
      emit();
      if (!remoteSynced) return;
      clearTimeout(persistTimer);
      persistTimer = setTimeout(() => persist(text.toString()), 450);
    }
  });

  doc.on('update', (update, origin) => {
    if (closed || origin === 'remote') return;
    void channel.send({
      type: 'broadcast',
      event: 'y-update',
      payload: { update: toBase64(update) },
    });
  });

  channel
    .on('broadcast', { event: 'y-update' }, ({ payload }) => {
      remoteSynced = true;
      Y.applyUpdate(doc, fromBase64(payload.update), 'remote');
    })
    .on('broadcast', { event: 'y-sync-request' }, () => {
      const update = Y.encodeStateAsUpdate(doc);
      void channel.send({
        type: 'broadcast',
        event: 'y-sync-response',
        payload: { update: toBase64(update) },
      });
    })
    .on('broadcast', { event: 'y-sync-response' }, ({ payload }) => {
      remoteSynced = true;
      Y.applyUpdate(doc, fromBase64(payload.update), 'remote');
    });

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({ type: 'broadcast', event: 'y-sync-request', payload: {} });
      initialTimer = setTimeout(() => {
        if (!remoteSynced && text.length === 0 && initialContent) {
          doc.transact(() => text.insert(0, initialContent));
          remoteSynced = true;
          void persist(initialContent);
        }
      }, 700);
    }
  });

  if (!remoteSynced && !initialContent) remoteSynced = true;
  emit();

  const setText = (value) => {
    if (closed || text.toString() === value) return;
    doc.transact(() => {
      if (text.length) text.delete(0, text.length);
      if (value) text.insert(0, value);
    });
  };

  return {
    setText,
    dispose: () => {
    closed = true;
    clearTimeout(initialTimer);
    clearTimeout(persistTimer);
    void channel.unsubscribe();
    doc.destroy();
    },
  };
}
