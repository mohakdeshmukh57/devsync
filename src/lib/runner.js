import { extOf } from './constants';

/* ---------------------------------------------------------------- preview */

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = v => String(v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

// Forwards console output and runtime errors from the preview iframe to the output console.
const BRIDGE = `<script>(function(){var s=function(t,a){try{parent.postMessage({ds:'preview',t:t,m:a.map(function(v){try{return typeof v==='object'?JSON.stringify(v):String(v)}catch(e){return String(v)}}).join(' ')},'*')}catch(e){}};['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){s(k,[].slice.call(arguments));try{o.apply(console,arguments)}catch(e){}}});addEventListener('error',function(e){s('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});addEventListener('unhandledrejection',function(e){s('error',['Unhandled promise rejection: '+((e.reason&&e.reason.message)||e.reason)])})})()<\/script>`;

const refRe = name => new RegExp(`(?:href|src)=["'](?:\\.{0,2}\\/)*(?:[\\w.-]+\\/)*${escapeRe(name)}["']`, 'i');

function pickHtml(files, activeFile) {
  const htmls = files.filter(f => f.language === 'html');
  if (!htmls.length) return null;
  if (activeFile?.language === 'html') return htmls.find(f => f.id === activeFile.id);
  if (activeFile) {
    const linked = htmls.find(h => refRe(activeFile.name).test(h.content || ''));
    if (linked) return linked;
  }
  return htmls.find(f => f.name.toLowerCase() === 'index.html') || htmls[0];
}

export function pickPreviewFile(files, activeFile) { return pickHtml(files, activeFile); }

/** Builds one self-contained HTML document: the HTML file with local CSS/JS files inlined. */
export function buildPreview(files, activeFile) {
  const html = pickHtml(files, activeFile);
  if (!html) return '';
  let doc = html.content || '';

  files.filter(f => f.language === 'css').forEach(f => {
    const tag = `<style data-devsync="${escapeHtml(f.name)}">${f.content || ''}</style>`;
    const re = new RegExp(`<link[^>]*href=["'](?:\\.{0,2}\\/)*(?:[\\w.-]+\\/)*${escapeRe(f.name)}["'][^>]*>`, 'i');
    if (re.test(doc)) doc = doc.replace(re, () => tag);
    else if (activeFile?.id === f.id && html.id !== f.id) doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, () => tag + '</head>') : tag + doc;
  });

  files.filter(f => f.language === 'javascript').forEach(f => {
    const safe = (f.content || '').replace(/<\/script/gi, '<\\/script');
    const re = new RegExp(`<script([^>]*?)src=["'](?:\\.{0,2}\\/)*(?:[\\w.-]+\\/)*${escapeRe(f.name)}["']([^>]*)><\\/script>`, 'i');
    if (!re.test(doc)) return;
    doc = doc.replace(re, (_m, a, b) => {
      const attrs = `${a} ${b}`.replace(/\s+/g, ' ').trim();
      return `<script data-devsync="${escapeHtml(f.name)}" ${attrs}>${safe}</script>`;
    });
  });

  if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head[^>]*>/i, m => m + BRIDGE);
  if (/<html[^>]*>/i.test(doc)) return doc.replace(/<html[^>]*>/i, m => m + '<head>' + BRIDGE + '</head>');
  return BRIDGE + doc;
}

/* ------------------------------------------------------------- JS / Python */

const workerUrl = src => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));

const JS_WORKER = `
const fmt = v => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.stack || String(v);
  if (typeof v === 'function') return String(v);
  try { return typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v); } catch (e) { return String(v); }
};
const send = (t, args) => postMessage({ t, m: args.map(fmt).join(' ') });
['log', 'info', 'warn', 'error', 'debug'].forEach(k => { console[k] = (...a) => send(k === 'debug' ? 'log' : k, a); });

let pending = 0, mainDone = false, finished = false;
const timeouts = new Set(), intervals = new Set();
const finish = () => { if (mainDone && pending === 0 && !finished) { finished = true; postMessage({ t: 'done' }); } };
const st = self.setTimeout.bind(self), si = self.setInterval.bind(self), ct = self.clearTimeout.bind(self), ci = self.clearInterval.bind(self);
self.setTimeout = (fn, d, ...a) => {
  pending++;
  const id = st(() => { if (timeouts.delete(id)) pending--; try { typeof fn === 'function' ? fn(...a) : 0; } catch (e) { send('error', [e]); } finish(); }, d);
  timeouts.add(id); return id;
};
self.clearTimeout = id => { if (timeouts.delete(id)) pending--; ct(id); finish(); };
self.setInterval = (fn, d, ...a) => {
  pending++;
  const id = si(() => { try { fn(...a); } catch (e) { send('error', [e]); } }, d);
  intervals.add(id); return id;
};
self.clearInterval = id => { if (intervals.delete(id)) pending--; ci(id); finish(); };
self.addEventListener('unhandledrejection', e => send('error', ['Unhandled promise rejection: ' + fmt(e.reason)]));

self.onmessage = async e => {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(e.data.code)();
  } catch (err) { send('error', [err]); }
  mainDone = true; finish();
};
`;

const PY_WORKER = `
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
let py = null;
const ready = (async () => {
  postMessage({ t: 'info', m: 'Loading Python runtime (first run only)…' });
  py = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
    stdout: m => postMessage({ t: 'log', m }),
    stderr: m => postMessage({ t: 'error', m }),
  });
})();
self.onmessage = async e => {
  try {
    await ready;
    await py.loadPackagesFromImports(e.data.code);
    const globals = py.globals.get('dict')();
    await py.runPythonAsync(e.data.code, { globals });
    globals.destroy();
  } catch (err) { postMessage({ t: 'error', m: String(err && err.message || err) }); }
  postMessage({ t: 'done' });
};
`;

let pyWorker = null;
let activeRun = null;

export function stopRun(message) {
  if (!activeRun) return;
  const { worker, isPython, timer, resolve, onLog } = activeRun;
  clearTimeout(timer);
  if (isPython) pyWorker = null;
  worker.terminate();
  activeRun = null;
  if (message) onLog({ type: 'error', m: message });
  resolve();
}

function runInWorker(worker, isPython, code, onLog, timeoutMs) {
  stopRun();
  return new Promise(resolve => {
    const timer = setTimeout(() => stopRun(`Stopped: the program ran longer than ${Math.round(timeoutMs / 1000)}s.`), timeoutMs);
    activeRun = { worker, isPython, timer, resolve, onLog };
    worker.onmessage = e => {
      const { t, m } = e.data || {};
      if (t === 'done') {
        clearTimeout(timer);
        if (!isPython) worker.terminate();
        activeRun = null;
        resolve();
      } else onLog({ type: ['warn', 'error', 'info'].includes(t) ? t : 'log', m });
    };
    worker.onerror = e => { onLog({ type: 'error', m: e.message || 'Worker error' }); stopRun(); };
    worker.postMessage({ code });
  });
}

export function runJavaScript(code, onLog) {
  const worker = new Worker(workerUrl(JS_WORKER));
  return runInWorker(worker, false, code, onLog, 10000);
}

export function runPython(code, onLog) {
  if (!pyWorker) pyWorker = new Worker(workerUrl(PY_WORKER));
  return runInWorker(pyWorker, true, code, onLog, 60000);
}

/* ------------------------------------------------------------------ format */

export function formatSource(language, text, tab = 2) {
  if (language === 'json') return JSON.stringify(JSON.parse(text), null, tab) + '\n';
  return text.replace(/[ \t]+$/gm, '').replace(/\s*$/, '\n');
}

export const SERVER_LANGS = new Set(['typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'dart', 'sql', 'shell']);

export async function runOnServer(language, code) {
  let res;
  try {
    res = await fetch('/api/run-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ language, code, stdin: '' }) });
  } catch {
    throw new Error('Could not reach the code-execution server.');
  }
  const raw = await res.text();
  let body = {};
  try { body = JSON.parse(raw); } catch { /* not JSON */ }
  if (res.status === 404 || (!body.error && !res.ok && !raw.trim().startsWith('{'))) {
    throw new Error('The /api/run-code server function is not running here. It is available on Vercel (or with `vercel dev`).');
  }
  if (!res.ok) throw new Error(body.error || `Execution failed (${res.status}).`);
  return body;
}

export { extOf };
