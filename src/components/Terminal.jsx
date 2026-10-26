import React, { useEffect, useMemo, useRef, useState } from 'react';
import { runJavaScript, runPython, stopRun } from '../lib/runner';
import { langFromName } from '../lib/constants';

const HELP = [
  ['ls [dir]', 'list files and folders'], ['cd <dir>', 'change folder (cd .. to go back)'], ['pwd', 'print current folder'], ['tree', 'show the project tree'],
  ['cat <file>', 'print a file'], ['head <file> [n]', 'first n lines'], ['wc <file>', 'count lines, words, chars'], ['grep <text> [file]', 'search inside files'],
  ['touch <file>', 'create a file'], ['mkdir <name>', 'create a folder'], ['rm <file>', 'delete a file'], ['mv <file> <new>', 'rename a file'],
  ['node <file.js>', 'run JavaScript'], ['python <file.py>', 'run Python'], ['run <file>', 'run any runnable file'], ['open <file>', 'open file in the editor'],
  ['echo, date, whoami, history, clear', 'the usual'], ['sh <command>', 'send a command to the server runner (if configured)'],
];

export default function Terminal({ files, folders, userName, projectName, actions, runShell, close }) {
  const [lines, setLines] = useState([{ t: 'info', x: `DevSync terminal — type "help" to see what you can do.` }]);
  const [val, setVal] = useState('');
  const [cwd, setCwd] = useState(null); // folder id or null
  const [busy, setBusy] = useState(false);
  const hist = useRef([]); const hi = useRef(-1);
  const box = useRef(null); const inp = useRef(null);
  const folder = folders.find(f => f.id === cwd);
  const dir = folder ? `~/${folder.name}` : '~';
  const here = useMemo(() => files.filter(f => (f.folder_id || null) === cwd), [files, cwd]);

  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [lines, busy]);
  useEffect(() => { inp.current?.focus(); }, []);

  const out = (x, t = 'out') => setLines(l => [...l, { t, x }]);
  const resolve = name => {
    if (!name) return null;
    if (name.includes('/')) { const [d, n] = name.replace(/^~?\//, '').split('/'); const fd = folders.find(f => f.name === d); return fd ? files.find(f => f.folder_id === fd.id && f.name === n) : null; }
    return here.find(f => f.name === name) || (!folder && files.find(f => !f.folder_id && f.name === name));
  };
  const runFile = async (f, mode) => {
    const lang = mode || f.language;
    const sink = m => setLines(l => [...l, { t: m.type === 'error' ? 'err' : m.type === 'info' ? 'info' : 'out', x: m.m }]);
    if (lang === 'javascript') await runJavaScript(f.content || '', sink);
    else if (lang === 'python') await runPython(f.content || '', sink);
    else out(`${f.name}: ${lang} files can't run in the browser terminal. Try "sh" if a server runner is set up.`, 'err');
  };

  async function exec(raw) {
    const line = raw.trim();
    setLines(l => [...l, { t: 'cmd', x: `${userName || 'dev'} ${dir} $ ${raw}` }]);
    if (!line) return;
    hist.current.push(line); hi.current = -1;
    const m = line.match(/"[^"]*"|'[^']*'|\S+/g).map(x => x.replace(/^["']|["']$/g, ''));
    const [cmd, ...a] = m;
    const need = () => { if (!a[0]) { out(`${cmd}: missing file name`, 'err'); return null; } const f = resolve(a[0]); if (!f) out(`${cmd}: ${a[0]}: no such file`, 'err'); return f; };
    try {
      switch (cmd) {
        case 'help': HELP.forEach(([c, d]) => out(`${c.padEnd(22)} ${d}`)); break;
        case 'clear': case 'cls': setLines([]); break;
        case 'pwd': out(dir === '~' ? `/${projectName || 'project'}` : `/${projectName || 'project'}/${folder.name}`); break;
        case 'whoami': out(userName || 'developer'); break;
        case 'date': out(new Date().toString()); break;
        case 'echo': out(a.join(' ')); break;
        case 'history': hist.current.forEach((h, i) => out(`${String(i + 1).padStart(3)}  ${h}`)); break;
        case 'ls': {
          const target = a[0] && a[0] !== '.' ? folders.find(f => f.name === a[0].replace(/\/$/, '')) : folder;
          if (a[0] && a[0] !== '.' && !target) { out(`ls: ${a[0]}: no such folder`, 'err'); break; }
          const fs = files.filter(f => (f.folder_id || null) === (target?.id || null));
          const ds = target ? [] : folders;
          out([...ds.map(f => f.name + '/'), ...fs.map(f => f.name)].join('   ') || '(empty)');
          break;
        }
        case 'cd': {
          if (!a[0] || a[0] === '~' || a[0] === '/') setCwd(null);
          else if (a[0] === '..') setCwd(null);
          else { const fd = folders.find(f => f.name === a[0].replace(/\/$/, '')); if (fd) setCwd(fd.id); else out(`cd: ${a[0]}: no such folder`, 'err'); }
          break;
        }
        case 'tree': {
          out(projectName || 'project');
          folders.forEach(fd => { out(`├── ${fd.name}/`); files.filter(f => f.folder_id === fd.id).forEach(f => out(`│   └── ${f.name}`)); });
          files.filter(f => !f.folder_id).forEach(f => out(`├── ${f.name}`));
          break;
        }
        case 'cat': { const f = need(); if (f) out(f.content || '(empty file)'); break; }
        case 'head': { const f = need(); if (f) out((f.content || '').split('\n').slice(0, +a[1] || 10).join('\n') || '(empty file)'); break; }
        case 'wc': { const f = need(); if (f) { const c = f.content || ''; out(`${c ? c.split('\n').length : 0} lines  ${(c.match(/\S+/g) || []).length} words  ${c.length} chars  ${f.name}`); } break; }
        case 'grep': {
          if (!a[0]) { out('grep: missing pattern', 'err'); break; }
          const pool = a[1] ? [resolve(a[1])].filter(Boolean) : files; let n = 0;
          pool.forEach(f => (f.content || '').split('\n').forEach((ln, i) => { if (ln.toLowerCase().includes(a[0].toLowerCase())) { n++; out(`${f.name}:${i + 1}: ${ln.trim()}`); } }));
          if (!n) out('no matches');
          break;
        }
        case 'touch': if (!a[0]) out('touch: missing file name', 'err'); else { await actions.createFile({ name: a[0], lang: langFromName(a[0], 'plaintext'), folderId: cwd }); out(`created ${a[0]}`); } break;
        case 'mkdir': if (!a[0]) out('mkdir: missing folder name', 'err'); else { await actions.createFolder(a[0]); out(`created ${a[0]}/`); } break;
        case 'rm': { const f = need(); if (f) await actions.deleteFile(f); break; }
        case 'mv': { const f = need(); if (f && a[1]) { await actions.renameFile(f.id, a[1]); out(`${f.name} → ${a[1]}`); } else if (f) out('mv: missing new name', 'err'); break; }
        case 'open': { const f = need(); if (f) actions.openFile(f); break; }
        case 'node': case 'python': case 'python3': case 'run': {
          const f = need(); if (!f) break;
          setBusy(true); out(`▶ ${f.name}`, 'info');
          await runFile(f, cmd === 'node' ? 'javascript' : cmd.startsWith('python') ? 'python' : undefined);
          break;
        }
        case 'sh': {
          const body = await runShell(a.join(' '));
          out([body.stdout, body.stderr, body.compile_output, body.message].filter(Boolean).join('\n') || '(no output)', body.stderr ? 'err' : 'out');
          break;
        }
        default: out(`${cmd}: command not found. Type "help" for the list.`, 'err');
      }
    } catch (e) { out(e.message || String(e), 'err'); }
    setBusy(false);
  }

  function key(e) {
    if (e.key === 'Enter' && !busy) { const v = val; setVal(''); void exec(v); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hist.current.length) { hi.current = Math.min(hi.current + 1, hist.current.length - 1); setVal(hist.current[hist.current.length - 1 - hi.current]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi.current = Math.max(hi.current - 1, -1); setVal(hi.current < 0 ? '' : hist.current[hist.current.length - 1 - hi.current]); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = val.split(' '); const last = parts[parts.length - 1];
      const pool = [...here.map(f => f.name), ...(!folder ? folders.map(f => f.name + '/') : []), ...HELP.map(h => h[0].split(' ')[0].replace(',', ''))];
      const hit = pool.filter(n => n.startsWith(last));
      if (hit.length === 1) { parts[parts.length - 1] = hit[0]; setVal(parts.join(' ') + (hit[0].endsWith('/') ? '' : ' ')); }
      else if (hit.length > 1) out(hit.join('   '));
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setLines([]); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'c') { stopRun('^C'); setBusy(false); out('^C', 'info'); }
  }

  return (
    <div className="term">
      <div className="term-bar"><span className="dots"><i /><i /><i /></span><b>Terminal</b><em>{projectName}</em><button className="icon" onClick={close} aria-label="Close terminal">&times;</button></div>
      <div className="term-body" ref={box} onClick={() => inp.current?.focus()}>
        {lines.map((l, i) => <div className={'tl ' + l.t} key={i}>{l.x}</div>)}
        <div className="tl cmd prompt"><span>{userName || 'dev'} <b>{dir}</b> $</span><input ref={inp} value={val} onChange={e => setVal(e.target.value)} onKeyDown={key} spellCheck="false" autoComplete="off" disabled={busy} placeholder={busy ? 'running… (Ctrl+C to stop)' : ''} /></div>
      </div>
    </div>
  );
}
