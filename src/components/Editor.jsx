import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { openCollaborativeFile } from '../lib/collab';
import { supabase, toast } from '../lib/supabase';
import { PAIRS, LANGS } from '../lib/constants';

const CLOSERS = new Set([')', ']', '}']);
const isWord = c => /[\w$]/.test(c || '');

function diffRange(a, b) {
  const max = Math.min(a.length, b.length);
  let s = 0;
  while (s < max && a[s] === b[s]) s += 1;
  let e = 0;
  while (e < max - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e += 1;
  return { s, e };
}

/** Plain textarea editor with line numbers, auto-indent, bracket/quote pairing and a status bar. */
export function Editor({ file, value, onChange, readOnly, onSave, onRun, settings }) {
  const ta = useRef(null);
  const gutter = useRef(null);
  const sel = useRef([0, 0]);
  const local = useRef(false);
  const lastValue = useRef(value);
  const [pos, setPos] = useState({ ln: 1, col: 1, sel: 0 });
  const { fs, tab, pair } = settings;
  const lines = value.split('\n').length;
  const style = { font: `${fs}px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace` };

  const report = t => {
    sel.current = [t.selectionStart, t.selectionEnd];
    const before = t.value.slice(0, t.selectionStart).split('\n');
    setPos({ ln: before.length, col: before[before.length - 1].length + 1, sel: t.selectionEnd - t.selectionStart });
  };

  // When the text changes because of someone else's edit, keep this caret where it was relative to the text.
  useLayoutEffect(() => {
    const t = ta.current;
    const old = lastValue.current;
    lastValue.current = value;
    if (!t) return;
    if (local.current) { local.current = false; report(t); return; }
    if (old !== value && document.activeElement === t) {
      const { s, e } = diffRange(old, value);
      const endOld = old.length - e;
      const delta = value.length - old.length;
      const map = p => (p <= s ? p : p >= endOld ? Math.max(0, p + delta) : value.length - e);
      t.setSelectionRange(map(sel.current[0]), map(sel.current[1]));
      report(t);
    }
  }, [value]);

  // Replace [a,b) with `text` through the browser's edit stack so Ctrl+Z keeps working.
  function edit(t, a, b, text, caretA, caretB = caretA) {
    local.current = true;
    t.focus();
    t.setSelectionRange(a, b);
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
    if (!ok) {
      t.setRangeText(text, a, b, 'end');
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
    t.setSelectionRange(caretA, caretB);
    report(t);
  }

  function onKeyDown(e) {
    if (readOnly) return;
    const t = e.target;
    const mod = e.ctrlKey || e.metaKey;
    const v = t.value;
    const a = t.selectionStart;
    const b = t.selectionEnd;

    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); onSave(); return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); onRun(); return; }
    if (mod || e.altKey) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const pad = ' '.repeat(tab);
      const multi = v.slice(a, b).includes('\n');
      if (!multi && !e.shiftKey) { edit(t, a, b, pad, a + tab); return; }
      const start = v.lastIndexOf('\n', a - 1) + 1;
      const endIdx = v.indexOf('\n', b);
      const end = endIdx === -1 ? v.length : endIdx;
      const block = v.slice(start, end).split('\n');
      const out = block.map(l => (e.shiftKey ? l.replace(new RegExp(`^ {1,${tab}}|^\\t`), '') : pad + l));
      const joined = out.join('\n');
      edit(t, start, end, joined, start, start + joined.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      const indent = (v.slice(ls, a).match(/^[ \t]*/) || [''])[0];
      const prev = v[a - 1];
      const next = v[b];
      const opener = '{[('.includes(prev || '#') || (prev === ':' && ['python', 'yaml'].includes(file?.language));
      const pad = ' '.repeat(tab);
      if (prev && PAIRS[prev] && next === PAIRS[prev] && '{[('.includes(prev)) {
        const text = '\n' + indent + pad + '\n' + indent;
        edit(t, a, b, text, a + 1 + indent.length + tab);
      } else {
        const text = '\n' + indent + (opener ? pad : '');
        edit(t, a, b, text, a + text.length);
      }
      return;
    }

    if (!pair) return;

    if (e.key === 'Backspace' && a === b && a > 0 && PAIRS[v[a - 1]] && PAIRS[v[a - 1]] === v[a]) {
      e.preventDefault();
      edit(t, a - 1, a + 1, '', a - 1);
      return;
    }

    if (CLOSERS.has(e.key) && a === b && v[a] === e.key) { // type over an existing closer
      e.preventDefault();
      t.setSelectionRange(a + 1, a + 1); report(t);
      return;
    }

    if (PAIRS[e.key]) {
      const isQuote = PAIRS[e.key] === e.key;
      if (a !== b) { // wrap the selection
        e.preventDefault();
        edit(t, a, b, e.key + v.slice(a, b) + PAIRS[e.key], a + 1, b + 1);
        return;
      }
      if (isQuote && v[a] === e.key) { e.preventDefault(); t.setSelectionRange(a + 1, a + 1); report(t); return; }
      if (isQuote && (isWord(v[a - 1]) || isWord(v[a]))) return; // apostrophes inside words
      if (!isQuote && isWord(v[a])) return;
      e.preventDefault();
      edit(t, a, b, e.key + PAIRS[e.key], a + 1);
    }
  }

  return (
    <>
      <div className="code-wrap">
        <div className="gutter" style={style} ref={gutter}>{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
        <textarea
          ref={ta}
          className="code"
          style={style}
          value={value}
          readOnly={readOnly}
          onChange={e => { local.current = true; onChange(e.target.value); report(e.target); }}
          onKeyDown={onKeyDown}
          onKeyUp={e => report(e.target)}
          onClick={e => report(e.target)}
          onSelect={e => report(e.target)}
          onScroll={e => { if (gutter.current) gutter.current.scrollTop = e.target.scrollTop; }}
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          aria-label={`${file?.name || 'code'} editor`}
        />
      </div>
      <div className="statusbar">
        <span>Ln {pos.ln}, Col {pos.col}{pos.sel ? ` (${pos.sel} selected)` : ''}</span>
        <span>{value.length.toLocaleString()} chars · {lines} lines</span>
        <span>{LANGS[file?.language]?.[0] || 'Plain Text'} · Spaces: {tab}</span>
        <span>{readOnly ? 'Connecting…' : 'Ctrl/Cmd+S save · Ctrl/Cmd+Enter run'}</span>
      </div>
    </>
  );
}

/** One editor panel bound to one file: opens a Yjs session, shows merged text, reports changes upward. */
export function CollabEditor({ file, onContent, onSaved, onRun, settings, registry }) {
  const [value, setValue] = useState(file.content || '');
  const [ready, setReady] = useState(false);
  const handle = useRef(null);
  const cb = useRef({});
  cb.current = { onContent, onSaved };

  useEffect(() => {
    let dead = false;
    let session = null;
    setReady(false);
    setValue(file.content || '');
    (async () => {
      // Start from what is stored in the database, not whatever was cached when the workspace loaded.
      const { data } = await supabase.from('files').select('content').eq('id', file.id).maybeSingle();
      if (dead) return;
      const initial = data?.content ?? file.content ?? '';
      session = openCollaborativeFile({
        supabase,
        fileId: file.id,
        initialContent: initial,
        onChange: v => { if (dead) return; setValue(v); cb.current.onContent(file.id, v); },
        onReady: () => { if (!dead) setReady(true); },
        persist: async v => {
          const { error } = await supabase.from('files').update({ content: v, updated_at: new Date().toISOString() }).eq('id', file.id);
          if (error) toast(`Could not save ${file.name}: ${error.message}`);
          else cb.current.onSaved?.(file.id, v);
        },
      });
      handle.current = session;
      if (registry) registry.current[file.id] = session;
    })();
    return () => {
      dead = true; handle.current = null;
      if (registry && registry.current[file.id] === session) delete registry.current[file.id];
      session?.dispose();
    };
  }, [file.id]);

  return (
    <Editor
      file={file}
      value={value}
      readOnly={!ready}
      settings={settings}
      onChange={v => handle.current?.setText(v)}
      onSave={async () => { await handle.current?.flush(); toast('All changes saved'); }}
      onRun={onRun}
    />
  );
}
