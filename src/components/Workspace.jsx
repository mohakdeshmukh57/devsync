import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CollabEditor } from './Editor';
import { Modal } from './common';
import { LANGS, langFromName } from '../lib/constants';
import { toast } from '../lib/supabase';

function RemoteTile({ peer }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = peer.stream; }, [peer.stream]);
  return <div className="call-tile"><video ref={ref} autoPlay playsInline /><div className="call-label">{peer.name}</div></div>;
}

function LocalTile({ stream, screenSharing }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream, screenSharing]);
  return <div className="call-tile local"><video ref={ref} muted autoPlay playsInline /><div className="call-label">You{screenSharing ? ' (sharing)' : ''}</div></div>;
}

export default function Workspace(p) {
  const [pal, setPal] = useState(false);
  const [pq, setPq] = useState('');
  const [palIdx, setPalIdx] = useState(0);
  const [fq, setFq] = useState('');
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [fileModal, setFileModal] = useState(null);     // {name, lang, folderId}
  const [folderModal, setFolderModal] = useState(null); // {name}
  const [renameModal, setRenameModal] = useState(null); // {id, name}
  const [ctx, setCtx] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [termInput, setTermInput] = useState('');
  const [chatText, setChatText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [termLines, setTermLines] = useState([{ type: 'info', text: 'Shared terminal ready. Commands run in a sandboxed server runner.' }]);
  const up = useRef(null);
  const msgEnd = useRef(null);

  const { active, second, files, folders, tabs } = p;

  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(v => !v); setPq(''); setPalIdx(0); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setConsoleOpen(v => !v); }
      if (e.key === 'Escape') { setPal(false); setCtx(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => { msgEnd.current?.scrollIntoView({ block: 'end' }); }, [p.chat.length, chatOpen]);

  const filter = fq.trim().toLowerCase();
  const fileMatches = f => !filter || f.name.toLowerCase().includes(filter);
  const rootFiles = files.filter(f => !f.folder_id && fileMatches(f));
  const tabFiles = tabs.map(id => files.find(f => f.id === id)).filter(Boolean);

  const commands = useMemo(() => [
    ['New file', '＋', () => setFileModal({ name: 'index', lang: 'html', folderId: null })],
    ['New folder', '▱', () => setFolderModal({ name: '' })],
    ['Upload files', '⇪', () => up.current?.click()],
    ['Run active file', '▶', p.run],
    ['Format active file', '≡', p.format],
    ['Toggle split editor', '▦', () => p.setSplit(v => !v)],
    ['Toggle focus mode', '◎', () => p.setFocusMode(v => !v)],
    ['Toggle output console', '▤', () => setConsoleOpen(v => !v)],
    ['Invite collaborators', '↗', () => setInviteOpen(true)],
    ['Team chat', '✉', () => setChatOpen(v => !v)],
    ['Shared terminal', '>_', () => setTermOpen(v => !v)],
    ['AI assistant', '✦', () => setAiOpen(v => !v)],
    ['Download project ZIP', '⬇', p.download],
    ['TV / Room mode', '▣', p.openTV],
    ['Editor settings', '⚙', () => setSettingsOpen(true)],
    ['Back to dashboard', '←', p.leave],
    ...files.map(f => ['Open ' + f.name, '◉', () => p.openFile(f)]),
  ], [files, p.run, p.format, p.download, p.openTV, p.leave, p.openFile]);
  const shownCommands = commands.filter(([n]) => n.toLowerCase().includes(pq.toLowerCase())).slice(0, 10);

  const runCommand = c => { setPal(false); c?.[2]?.(); };

  async function runTerminal() {
    const cmd = termInput.trim();
    if (!cmd) return;
    setTermLines(l => [...l, { type: 'cmd', text: `$ ${cmd}` }]);
    setTermInput('');
    try {
      const body = await p.runShell(cmd);
      const text = [body.stdout, body.stderr, body.compile_output, body.message].filter(Boolean).join('\n') || '(no output)';
      setTermLines(l => [...l, { type: body.stderr || body.compile_output ? 'error' : 'out', text }]);
    } catch (e) { setTermLines(l => [...l, { type: 'error', text: e.message }]); }
  }

  async function askAi() {
    if (!aiPrompt.trim()) return;
    if (!active) { setAiResponse('Open a file first so the assistant can see your code.'); return; }
    setAiBusy(true); setAiResponse('');
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt, file: { name: active.name, language: active.language, content: (active.content || '').slice(0, 12000) } }) });
      const raw = await res.text();
      let body = {};
      try { body = JSON.parse(raw); } catch { /* not json */ }
      if (!res.ok) throw new Error(body.error || (res.status === 404 ? 'The /api/ai function is not running here (it is available on Vercel).' : `AI request failed (${res.status}).`));
      setAiResponse(body.text || '');
    } catch (e) { setAiResponse(e.message); } finally { setAiBusy(false); }
  }

  const renderFileRow = f => (
    <div key={f.id} className={'file ' + (f.id === active?.id ? 'active' : '')}
      onClick={() => p.openFile(f)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, fileId: f.id }); }}>
      ◉ {f.name}<span>{LANGS[f.language]?.[0] || f.language}</span>
    </div>
  );

  const ctxFile = ctx?.fileId ? files.find(f => f.id === ctx.fileId) : null;

  return (
    <div className={'app meeting-app ' + (p.focusMode ? 'focus-mode' : '')} onClick={() => ctx && setCtx(null)}>
      <header className="bar">
        <div className="user">
          <button className="btn" onClick={p.leave} title="Back to dashboard">←</button>
          <div><b>{p.meeting?.name}</b><div className="live">● LIVE · {Math.max(1, p.members.length)} online</div></div>
        </div>
        <div className="user">
          <button className="btn" onClick={() => setPal(true)}>⌘K</button>
          <button className="btn" onClick={() => setInviteOpen(true)}>Invite</button>
          <button className="btn" onClick={() => setChatOpen(v => !v)}>Chat</button>
          <button className="btn" onClick={() => setTermOpen(v => !v)}>Terminal</button>
          <button className="btn" onClick={() => setAiOpen(v => !v)}>AI</button>
          <button className="btn" onClick={() => setSettingsOpen(true)}>Settings</button>
          <button className="btn" onClick={p.openTV}>TV / Room</button>
        </div>
      </header>

      <div className="work">
        {!p.focusMode && (
          <aside className="explorer" onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY }); }}>
            <div className="explorer-head"><b>EXPLORER</b><span>
              <button className="icon" title="Upload files" onClick={() => up.current?.click()}>⇪</button>
              <button className="icon" title="New folder" onClick={() => setFolderModal({ name: '' })}>▱</button>
              <button className="icon" title="New file" onClick={() => setFileModal({ name: 'index', lang: 'html', folderId: null })}>＋</button>
            </span></div>
            <input ref={up} type="file" hidden multiple onChange={e => { p.upload([...e.target.files]); e.target.value = ''; }} />
            <input className="search small" placeholder="Filter files…" value={fq} onChange={e => setFq(e.target.value)} />
            <div className="tree-title">PROJECT</div>
            {folders.map(folder => {
              const inside = files.filter(f => f.folder_id === folder.id && fileMatches(f));
              if (filter && !inside.length) return null;
              const open = filter || !collapsed[folder.id];
              return (
                <div key={folder.id}>
                  <div className="folder-row" onClick={() => setCollapsed(c => ({ ...c, [folder.id]: !c[folder.id] }))}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, folderId: folder.id }); }}>
                    {open ? '▾' : '▸'} {folder.name}
                    <button className="folder-delete" title="Delete folder" onClick={e => { e.stopPropagation(); p.deleteFolder(folder); }}>×</button>
                  </div>
                  {open && <div className="nested">{inside.map(renderFileRow)}</div>}
                </div>
              );
            })}
            {files.length === 0 && folders.length === 0 ? <div className="tree-empty">No files yet.<br /><br />Right-click or use ＋ to create your first file.</div> : rootFiles.map(renderFileRow)}
            {filter && !rootFiles.length && !folders.some(fo => files.some(f => f.folder_id === fo.id && fileMatches(f))) && <div className="tree-empty">No files match “{fq}”.</div>}
            {p.assets.length > 0 && <>
              <div className="tree-title">ASSETS</div>
              {p.assets.map(a => (
                <div key={a.path} className="file asset" title="Click to download" onClick={() => p.downloadAsset(a)}>
                  ⬚ {a.name}<button className="folder-delete" title="Delete asset" onClick={e => { e.stopPropagation(); p.deleteAsset(a); }}>×</button>
                </div>
              ))}
            </>}
          </aside>
        )}

        <section className="editor">
          <div className="tabs">
            {tabFiles.length ? tabFiles.map(f => (
              <span key={f.id} className={'tab ' + (f.id === active?.id ? 'active' : '')} onClick={() => p.openFile(f)}>
                {f.name}<b className="x" title="Close tab" onClick={e => { e.stopPropagation(); p.closeTab(f.id); }}>×</b>
              </span>
            )) : <span className="tab">No file open</span>}
          </div>
          <div className="toolbar">
            <span>LANGUAGE</span><span className="pill">{active ? LANGS[active.language]?.[0] || active.language : 'Plain Text'}</span>
            <button className="pill fmt" onClick={p.format} disabled={!active}>Format</button>
            <button className="pill" onClick={() => p.setSplit(v => !v)}>{p.split ? 'Unsplit' : '＋ Panel'}</button>
            <button className="run" onClick={p.run} disabled={!active} title="Ctrl/Cmd+Enter">▶ Run</button>
          </div>
          {p.split ? (
            <div className="split-editors">
              <div>{active ? <CollabEditor key={active.id} file={active} onContent={p.onContent} onSaved={p.onSaved} onRun={p.run} settings={p.settings} registry={p.registry} /> : <div className="editor-empty">Create a file to start coding.</div>}</div>
              <div>
                <select className="split-select" value={p.secondId || ''} onChange={e => p.setSecondId(e.target.value || null)}>
                  <option value="">Choose second file…</option>
                  {files.filter(f => f.id !== active?.id).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {second ? <CollabEditor key={second.id} file={second} onContent={p.onContent} onSaved={p.onSaved} onRun={p.run} settings={p.settings} registry={p.registry} /> : <div className="editor-empty">Choose another file for the second panel.</div>}
              </div>
            </div>
          ) : active ? <CollabEditor key={active.id} file={active} onContent={p.onContent} onSaved={p.onSaved} onRun={p.run} settings={p.settings} registry={p.registry} /> : <div className="editor-empty">{files.length ? 'Open a file from the explorer.' : 'Create a file to start coding.'}</div>}
          {p.focusMode && <div className="focus-exit"><button className="btn" onClick={() => p.setFocusMode(false)}>Exit Focus Mode</button></div>}
        </section>

        {!p.focusMode && (
          <section className="preview">
            <div className="preview-head"><span>LIVE PREVIEW</span><span className="devs">
              <button className={'icon ' + (p.previewWidth === '100%' ? 'on' : '')} title="Desktop" onClick={() => p.setPreviewWidth('100%')}>▭</button>
              <button className={'icon ' + (p.previewWidth === '768px' ? 'on' : '')} title="Tablet" onClick={() => p.setPreviewWidth('768px')}>▯</button>
              <button className={'icon ' + (p.previewWidth === '390px' ? 'on' : '')} title="Phone" onClick={() => p.setPreviewWidth('390px')}>▮</button>
              <button className="icon" title="Refresh" onClick={() => p.setPreviewKey(v => v + 1)}>⟳</button>
              <button className="icon" title="Open in new tab" onClick={p.openPreviewTab}>⧉</button>
              <button className={'icon ' + (consoleOpen ? 'on' : '')} title="Toggle console (Ctrl/Cmd+J)" onClick={() => setConsoleOpen(v => !v)}>▤</button>
            </span></div>
            {p.preview
              ? <iframe key={p.previewKey} title="preview" srcDoc={p.preview} style={{ width: p.previewWidth, alignSelf: 'center' }} sandbox="allow-scripts allow-forms allow-modals allow-popups" />
              : <div className="preview-empty">Create an HTML file to see live output.<br />Use <b>&lt;link&gt;</b> and <b>&lt;script&gt;</b> to connect local CSS and JS.</div>}
            {consoleOpen && (
              <div className="console">
                <div className="console-head">OUTPUT <span><button className="icon" onClick={p.stop}>Stop</button><button className="icon" onClick={p.clearLogs}>Clear</button></span></div>
                {p.logs.length === 0
                  ? <div className="log info">Press ▶ Run (Ctrl/Cmd+Enter) to run JavaScript or Python. HTML and CSS refresh the preview.</div>
                  : p.logs.map((l, i) => <div key={i} className={'log ' + (l.type || 'log')}>{l.m}</div>)}
              </div>
            )}
          </section>
        )}

        {!p.focusMode && (
          <aside className="team">
            <div className="team-title">TEAM · {Math.max(1, p.members.length)} <button className="icon" onClick={() => setInviteOpen(true)}>＋</button></div>
            <div className="call-grid">
              {p.callPeers.map(peer => <RemoteTile key={peer.id} peer={peer} />)}
              <LocalTile stream={p.tileStream} screenSharing={p.screenSharing} />
            </div>
            <div className="call-controls">
              <button className={'call-control ' + (!p.micOn ? 'off' : '')} onClick={p.toggleMic} disabled={!p.hasAudio}>{p.micOn ? '🎙' : '🔇'} Mic</button>
              <button className={'call-control ' + (!p.cameraOn ? 'off' : '')} onClick={p.toggleCamera} disabled={!p.hasVideo}>{p.cameraOn ? '◉' : '○'} Cam</button>
              <button className={'call-control ' + (p.screenSharing ? 'on' : '')} onClick={p.toggleScreen}>{p.screenSharing ? 'Stop share' : 'Share screen'}</button>
            </div>
            {!p.localStream && <div className="team-note">Camera and microphone are off or blocked. You can still see and hear others, and collaborate.</div>}
            <div className="member-list">
              {(p.members.length ? p.members : [{ name: p.userName, id: p.userId }]).map((m, i) => {
                const f = m.activeFile ? files.find(x => x.id === m.activeFile) : null;
                return <div className="member-row" key={m.id || i}><span className="avatar">{(m.name || '?')[0].toUpperCase()}</span><div><b>{m.name || 'Developer'}{m.id === p.userId ? ' (you)' : ''}</b><small>{f ? `Editing ${f.name}` : 'In workspace'}</small></div><span className="presence-dot" /></div>;
              })}
            </div>
          </aside>
        )}
      </div>

      {ctx && (
        <div className="context" style={{ left: Math.min(ctx.x, window.innerWidth - 190), top: Math.min(ctx.y, window.innerHeight - 260) }} onClick={e => e.stopPropagation()}>
          {ctx.folderId ? <>
            <button onClick={() => { setFileModal({ name: 'index', lang: 'html', folderId: ctx.folderId }); setCtx(null); }}>New file here</button>
            <button className="danger" onClick={() => { p.deleteFolder(folders.find(f => f.id === ctx.folderId)); setCtx(null); }}>Delete folder</button>
          </> : <>
            <button onClick={() => { setFileModal({ name: 'index', lang: 'html', folderId: null }); setCtx(null); }}>New file</button>
            <button onClick={() => { setFolderModal({ name: '' }); setCtx(null); }}>New folder</button>
            {ctxFile && <>
              <button onClick={() => { setRenameModal({ id: ctxFile.id, name: ctxFile.name }); setCtx(null); }}>Rename</button>
              <button onClick={() => { p.duplicateFile(ctxFile); setCtx(null); }}>Duplicate</button>
              {folders.length > 0 && ctxFile.folder_id && <button onClick={() => { p.moveFile(ctxFile, null); setCtx(null); }}>Move to project root</button>}
              {folders.filter(fo => fo.id !== ctxFile.folder_id).map(fo => <button key={fo.id} onClick={() => { p.moveFile(ctxFile, fo.id); setCtx(null); }}>Move to {fo.name}</button>)}
              <button onClick={async () => { try { await navigator.clipboard.writeText('/' + ctxFile.name); toast('Path copied'); } catch { toast('Could not copy'); } setCtx(null); }}>Copy path</button>
              <button onClick={() => { p.downloadOne(ctxFile); setCtx(null); }}>Download</button>
              <button className="danger" onClick={() => { p.deleteFile(ctxFile); setCtx(null); }}>Delete</button>
            </>}
          </>}
        </div>
      )}

      {chatOpen && (
        <div className="chat"><div className="chat-head">Team Chat <button className="icon" onClick={() => setChatOpen(false)}>×</button></div>
          <div className="messages">{p.chat.length === 0 ? <div className="log info">No messages yet. Say hello.</div> : p.chat.map((m, i) => <div key={i}><b>{m.name}</b>{m.message}</div>)}<div ref={msgEnd} /></div>
          <div className="chat-send"><input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && chatText.trim()) { p.sendChat(chatText); setChatText(''); } }} placeholder="Message the team…" autoFocus /><button className="btn primary" onClick={() => { if (chatText.trim()) { p.sendChat(chatText); setChatText(''); } }}>Send</button></div>
        </div>
      )}

      {termOpen && (
        <div className="chat terminal-drawer"><div className="chat-head">Shared Terminal <button className="icon" onClick={() => setTermOpen(false)}>×</button></div>
          <div className="terminal-output">{termLines.map((l, i) => <div className={'term-line ' + l.type} key={i}>{l.text}</div>)}</div>
          <div className="chat-send"><input value={termInput} onChange={e => setTermInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runTerminal(); }} placeholder="run a sandboxed command…" autoFocus /><button className="btn primary" onClick={runTerminal}>Run</button></div>
        </div>
      )}

      {aiOpen && (
        <div className="chat ai-drawer"><div className="chat-head">AI assistant <button className="icon" onClick={() => setAiOpen(false)}>×</button></div>
          <div className="ai-body"><div className="ai-note">Ask about the open file. Requires AI_BASE_URL, AI_API_KEY and AI_MODEL on the server.</div>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Explain this code, find bugs, suggest changes…" />
            <button className="btn primary" disabled={aiBusy} onClick={askAi}>{aiBusy ? 'Thinking…' : 'Ask AI'}</button>
            <pre>{aiResponse}</pre></div>
        </div>
      )}

      {fileModal && (
        <Modal title="Create new file" close={() => setFileModal(null)} onSubmit={() => { p.createFile(fileModal); setFileModal(null); }}>
          <label>File name<input value={fileModal.name} onChange={e => setFileModal({ ...fileModal, name: e.target.value, lang: langFromName(e.target.value, fileModal.lang) })} autoFocus /></label>
          <label>Language<select value={fileModal.lang} onChange={e => setFileModal({ ...fileModal, lang: e.target.value })}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v[0]} (.{v[1]})</option>)}</select></label>
          <label>Folder<select value={fileModal.folderId || ''} onChange={e => setFileModal({ ...fileModal, folderId: e.target.value || null })}><option value="">Project root</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setFileModal(null)}>Cancel</button><button type="submit" className="btn primary">Create file</button></div>
        </Modal>
      )}
      {folderModal && (
        <Modal title="Create new folder" close={() => setFolderModal(null)} onSubmit={() => { p.createFolder(folderModal.name); setFolderModal(null); }}>
          <label>Folder name<input value={folderModal.name} onChange={e => setFolderModal({ name: e.target.value })} autoFocus /></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setFolderModal(null)}>Cancel</button><button type="submit" className="btn primary">Create folder</button></div>
        </Modal>
      )}
      {renameModal && (
        <Modal title="Rename file" close={() => setRenameModal(null)} onSubmit={() => { p.renameFile(renameModal.id, renameModal.name); setRenameModal(null); }}>
          <label>New name<input value={renameModal.name} onChange={e => setRenameModal({ ...renameModal, name: e.target.value })} autoFocus /></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setRenameModal(null)}>Cancel</button><button type="submit" className="btn primary">Rename</button></div>
        </Modal>
      )}
      {inviteOpen && (
        <Modal title="Invite collaborators" close={() => setInviteOpen(false)}>
          <p>Share this private meeting link. Collaborators join after signing in.</p>
          <input value={p.inviteLink} readOnly onFocus={e => e.target.select()} />
          <div className="modal-actions"><button className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(p.inviteLink); toast('Invite link copied'); } catch { toast('Select the link and copy it manually.'); } }}>Copy link</button></div>
        </Modal>
      )}
      {settingsOpen && (
        <Modal title="Editor settings" close={() => setSettingsOpen(false)}>
          <label>Font size ({p.settings.fs}px)<input type="range" min="11" max="22" value={p.settings.fs} onChange={e => p.setSettings({ ...p.settings, fs: +e.target.value })} /></label>
          <label>Tab size<select value={p.settings.tab} onChange={e => p.setSettings({ ...p.settings, tab: +e.target.value })}><option value="2">2 spaces</option><option value="4">4 spaces</option></select></label>
          <label className="check"><input type="checkbox" checked={p.settings.pair} onChange={e => p.setSettings({ ...p.settings, pair: e.target.checked })} /> Auto-close brackets and quotes</label>
          <div className="modal-actions"><button className="btn" onClick={() => setSettingsOpen(false)}>Done</button></div>
        </Modal>
      )}
      {pal && (
        <div className="modal pal" onMouseDown={e => e.target === e.currentTarget && setPal(false)}>
          <div className="palette">
            <input autoFocus value={pq} onChange={e => { setPq(e.target.value); setPalIdx(0); }} placeholder="Type a command or file name…"
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setPalIdx(i => Math.min(i + 1, shownCommands.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setPalIdx(i => Math.max(i - 1, 0)); }
                if (e.key === 'Enter') { e.preventDefault(); runCommand(shownCommands[palIdx]); }
              }} />
            {shownCommands.map(([n, i, f], idx) => <button key={n} className={idx === palIdx ? 'sel' : ''} onMouseEnter={() => setPalIdx(idx)} onClick={() => runCommand([n, i, f])}><span>{i}</span>{n}</button>)}
            {!shownCommands.length && <div className="log info">No matching command or file.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function TVScreen({ meeting, preview, onRefresh }) {
  return (
    <div className="tv">
      <div className="tv-bar"><div className="brand"><span className="logo">&lt;/&gt;</span>{meeting?.name || 'DevSync Room'}</div><div className="tv-status"><span className="live">● LIVE OUTPUT</span><button className="btn" onClick={onRefresh}>Refresh</button></div></div>
      {preview ? <iframe title="DevSync TV output" srcDoc={preview} sandbox="allow-scripts allow-forms allow-modals" /> : <div className="preview-empty">Waiting for an HTML file in this meeting…</div>}
    </div>
  );
}
