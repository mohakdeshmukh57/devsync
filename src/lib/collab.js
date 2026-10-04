import * as Y from 'yjs';

function toBase64(bytes) {
  let out = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) out += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(out);
}

function fromBase64(value) {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// Stable 32-bit hash. Used as the clientID of the "seed" insert so every client that seeds the
// same starting text produces byte-identical operations (they merge instead of duplicating).
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

const isHigh = c => c >= 0xd800 && c <= 0xdbff;
const isLow = c => c >= 0xdc00 && c <= 0xdfff;

// Apply `next` to a Y.Text as a minimal insert/delete so concurrent edits merge instead of replacing.
export function applyDiff(ytext, next) {
  const cur = ytext.toString();
  if (cur === next) return;
  const max = Math.min(cur.length, next.length);
  let s = 0;
  while (s < max && cur.charCodeAt(s) === next.charCodeAt(s)) s += 1;
  if (s > 0 && isHigh(cur.charCodeAt(s - 1))) s -= 1;
  let e = 0;
  while (e < max - s && cur.charCodeAt(cur.length - 1 - e) === next.charCodeAt(next.length - 1 - e)) e += 1;
  if (e > 0 && isLow(cur.charCodeAt(cur.length - e))) e -= 1;
  ytext.doc.transact(() => {
    const del = cur.length - s - e;
    if (del > 0) ytext.delete(s, del);
    const ins = next.slice(s, next.length - e);
    if (ins) ytext.insert(s, ins);
  });
}

/**
 * Opens a collaborative (Yjs) session for one file over a private Supabase Realtime channel.
 * Local edits are broadcast; remote edits are merged; the merged text is persisted (debounced).
 */
export function openCollaborativeFile({ supabase, fileId, initialContent = '', onChange, onReady, persist }) {
  const doc = new Y.Doc();
  const text = doc.getText('content');
  const channel = supabase.channel(`file:${fileId}`, {
    config: { private: true, broadcast: { self: false } },
  });

  let ready = false;
  let closed = false;
  let persistTimer = null;
  let dirty = false;
  let seedTimer = null;
  let fallbackTimer = null;

  const markReady = () => {
    if (ready || closed) return;
    ready = true;
    clearTimeout(seedTimer);
    clearTimeout(fallbackTimer);
    onReady?.();
  };

  const seed = () => {
    if (closed || ready) return;
    if (text.length === 0 && initialContent) {
      const base = new Y.Doc();
      base.clientID = hash32(initialContent);
      base.getText('content').insert(0, initialContent);
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(base), 'seed');
      base.destroy();
    }
    markReady();
  };

  const flush = async () => {
    clearTimeout(persistTimer);
    if (!dirty) return;
    dirty = false;
    await persist(text.toString());
  };

  text.observe(() => {
    if (!closed) onChange(text.toString());
  });

  doc.on('update', (update, origin) => {
    if (closed || origin === 'remote' || origin === 'seed') return;
    void channel.send({ type: 'broadcast', event: 'y-update', payload: { update: toBase64(update) } });
    dirty = true;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { void flush(); }, 450);
  });

  const applyRemote = payload => {
    if (closed || !payload?.update) return;
    Y.applyUpdate(doc, fromBase64(payload.update), 'remote');
    if (text.length > 0) markReady();
  };

  channel
    .on('broadcast', { event: 'y-update' }, ({ payload }) => applyRemote(payload))
    .on('broadcast', { event: 'y-sync-response' }, ({ payload }) => applyRemote(payload))
    .on('broadcast', { event: 'y-sync-request' }, () => {
      if (!ready) return;
      void channel.send({ type: 'broadcast', event: 'y-sync-response', payload: { update: toBase64(Y.encodeStateAsUpdate(doc)) } });
    });

  channel.subscribe(status => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      void channel.send({ type: 'broadcast', event: 'y-sync-request', payload: {} });
      seedTimer = setTimeout(seed, 700);
    }
  });
  // If the realtime channel never connects, still let the person edit (saves go to the database).
  fallbackTimer = setTimeout(seed, 3000);

  onChange(initialContent);

  return {
    setText: value => { if (!closed && ready) applyDiff(text, value); },
    getText: () => text.toString(),
    flush,
    dispose: () => {
      if (closed) return;
      const pending = dirty;
      const last = text.toString();
      closed = true;
      clearTimeout(persistTimer); clearTimeout(seedTimer); clearTimeout(fallbackTimer);
      if (pending) void persist(last);
      void channel.unsubscribe();
      doc.destroy();
    },
  };
}
