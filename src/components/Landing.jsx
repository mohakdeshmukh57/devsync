import React, { useEffect } from 'react';
import { Brand } from './common';
import { FEATURES } from '../lib/constants';
import '../landing.css';

/* ---- tiny syntax highlighter for the mock screenshots ---- */
const TOK = /(\/\/.*)|('[^']*'|`[^`]*`)|\b(const|let|async|await|return|function|import|from|print|def|for|in)\b|\b(\d+)\b|\b([a-zA-Z_]+)(?=\()/g;
const hl = code => {
  const out = []; let last = 0, m;
  while ((m = TOK.exec(code))) {
    out.push(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : 'f';
    out.push(<span className={cls} key={m.index}>{m[0]}</span>);
    last = TOK.lastIndex;
  }
  out.push(code.slice(last));
  return out;
};
const Cursor = ({ name, color }) => <span className="cur" style={{ '--c': color }}><em>{name}</em></span>;
const Av = ({ n, a = '#7c6cff', z = '#38bdf8', className = '', children }) => <div className={`av ${className}`} style={{ '--a': a, '--z': z }}>{n}{children}</div>;
const Win = ({ title, live, children, right }) => (
  <div className="win"><div className="win-bar"><i /><i /><i /><span>{title}</span>{live && <span className="live">● Live</span>}{right}</div>{children}</div>
);

/* ---- mock screens (swap any of these for <img src="..."/> when you have real screenshots) ---- */
const CODE = `async function run() {
  const result = await runCode(code);
  setOutput(result);
}

// ship it together
const team = ['You', 'Sarah', 'Alex'];`;

function Editor({ full }) {
  return (
    <Win title="devsync.app / team-standup" live right={<div className="pres"><Av n="Y" /><Av n="S" a="#f472b6" z="#fb923c" /><Av n="A" a="#34d399" z="#38bdf8" /></div>}>
      <div className="m-body" style={full ? undefined : { gridTemplateColumns: '130px 1fr', minHeight: 300 }}>
        <aside className="m-side"><b>FILES</b><div>src</div><div className="in2">App.jsx</div><div className="in2 on">editor.js</div><div className="in2">styles.css</div><div>index.html</div><div>README.md</div></aside>
        <div className="m-code">
          <div className="m-tabs"><span className="on">editor.js</span><span>App.jsx</span><span>+</span></div>
          <pre>{hl(CODE.split('\n').slice(0, 3).join('\n'))}<Cursor name="Sarah" color="#f472b6" />{'\n\n'}{hl(CODE.split('\n').slice(4).join('\n').replace(/\n.*$/, ''))}{'\n'}{hl("const team = ['You', 'Sarah', 'Alex'];")}<Cursor name="Alex" color="#34d399" /></pre>
        </div>
        {full && <div className="m-right"><div><b>OUTPUT</b><div className="out">▶ Hello, World!</div></div><div><b>TEAM CALL</b><div className="faces"><Av n="You" /><Av n="Sarah" a="#f472b6" z="#fb923c" /><Av n="Alex" a="#34d399" z="#38bdf8" /><Av n="Priya" a="#fbbf24" z="#ef4444" /></div></div></div>}
      </div>
    </Win>
  );
}
const Runner = () => (
  <Win title="main.py — Python">
    <div className="m-code"><pre>{hl(`def fib(n):\n  a, b = 0, 1\n  for _ in range(n):\n    a, b = b, a + b\n  return a\n\nprint(fib(10))`)}</pre>
      <div className="pills">{['Python', 'JavaScript', 'C++', 'Rust', 'Go', 'Java', '+25'].map(l => <span key={l}>{l}</span>)}<span className="go">▶ Run</span></div>
      <div className="con"><b>CONSOLE</b><span style={{ color: '#34d399' }}>$ python main.py<br />55<br /><span style={{ color: '#64748b' }}>Finished in 0.04s</span></span></div></div>
  </Win>
);
const Preview = () => (
  <Win title="localhost · live preview" right={<div className="dev"><span>Mobile</span><span>Tablet</span><span className="on">Desktop</span></div>}>
    <div className="brw"><h4>Launch faster.</h4><i /><i /><span>Get started</span></div>
  </Win>
);
const Call = () => (
  <Win title="Team call · 4 in room">
    <div className="call"><Av n="Sarah · sharing screen" className="big" a="#4f46e5" z="#0ea5e9" /><Av n="Alex" a="#34d399" z="#0f766e" /><Av n="Priya" a="#fbbf24" z="#be185d" /></div>
    <div className="ctl"><span>🎤</span><span>📷</span><span>🖥</span><span className="red">✕</span></div>
  </Win>
);
const Chat = () => (
  <Win title="Team chat">
    <div className="chat">
      <div className="msg"><small>Sarah</small>Fixed the null check on line 12 👀</div>
      <div className="msg me">Nice — running it now</div>
      <div className="msg"><small>Alex</small>Preview looks great on mobile too</div>
      <div className="inv">devsync.app/meeting/x7k2…<b>Copy invite</b></div>
    </div>
  </Win>
);
const TV = () => (
  <div><div className="tv"><Win title="TV mode · team-standup" live><div className="brw" style={{ minHeight: 210 }}><h4>Demo day 🎉</h4><i /><i /><span>Live output</span></div></Win></div><div className="stand" /></div>
);

const ROWS = [
  ['Real-time editing', 'Code together, character by character.', 'Everyone edits the same file at the same time. Changes merge instantly with a CRDT, so nobody ever overwrites anybody — you just see your teammates’ cursors move.', ['Live cursors with names', 'Conflict-free merging', 'Split panels for two files at once'], <Editor />],
  ['Run anything', 'Hit run. See output right beside your code.', 'Execute Python and JavaScript right in the browser, or run C++, Rust, Go, Java and 25+ more languages through a secure runner — with a console the whole team can see.', ['30+ languages', 'Built-in output console', 'Format & auto-indent'], <Runner />],
  ['Live preview', 'Watch your web page come alive.', 'HTML, CSS and JS render instantly in a sandboxed preview. Switch between mobile, tablet and desktop sizes to see exactly what your users will see.', ['Device size switcher', 'Sandboxed & safe', 'Updates as you type'], <Preview />],
  ['Meetings', 'Talk it through, face to face.', 'Camera, microphone and screen sharing are built into every workspace. No more juggling a separate video app while you code.', ['Video, audio & screen share', 'Powered by WebRTC', 'Works from any browser'], <Call />],
  ['Chat & invites', 'Invite anyone with a single link.', 'Share one secure link to bring a teammate in. Keep discussion next to the code with built-in chat — decisions stay where the work happens.', ['One-click invite links', 'Capacity limits per meeting', 'Owner-only controls'], <Chat />],
  ['TV / Room mode', 'Put the output on the big screen.', 'Working in the same room? Open TV mode on a second screen and show clean project output while everyone codes from their own laptop.', ['Perfect for classrooms & labs', 'Zero setup', 'Auto-refreshing'], <TV />],
];
const STEPS = [['01', 'Create a meeting', 'Name your workspace and choose how many people can join.'], ['02', 'Share the link', 'Send one invite link. Teammates join from any browser.'], ['03', 'Build together', 'Code, run, preview and talk — all in one tab.']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-r]');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    els.forEach(e => io.observe(e));
    const root = document.documentElement; const prev = root.style.scrollBehavior; root.style.scrollBehavior = 'smooth';
    return () => { io.disconnect(); root.style.scrollBehavior = prev; };
  }, []);
}

export default function Landing({ mode, setMode, authOpen, setAuthOpen, submit, error, notice, busy }) {
  const open = m => { setMode(m); setAuthOpen(true); };
  useReveal();
  return (
    <div className="lp">
      <div className="glow" style={{ width: 600, height: 600, background: '#6d5cff', top: -200, left: '10%' }} />
      <div className="glow" style={{ width: 500, height: 500, background: '#0ea5e9', top: 100, right: '-5%' }} />
      <nav className="lp-nav"><div className="wrap">
        <a href="#top"><Brand /></a>
        <div className="links"><a href="#features">Features</a><a href="#workspace">Workspace</a><a href="#how">How it works</a><a href="#contact">Contact</a></div>
        <div className="acts"><button className="btn" onClick={() => open('login')}>Log in</button><button className="btn primary" onClick={() => open('register')}>Get started</button></div>
      </div></nav>

      <header className="lp-hero wrap" id="top">
        <span className="lp-pill"><i />Real-time collaborative coding</span>
        <h1>Code together. <span className="grad">Ship faster.</span></h1>
        <p className="sub">One workspace for your whole team — editor, output, preview, video calls and chat. No installs, no setup, just a link.</p>
        <div className="cta"><button className="btn primary lg" onClick={() => open('register')}>Start building free →</button><button className="btn lg" onClick={() => document.getElementById('features')?.scrollIntoView()}>See how it works</button></div>
        <div className="lp-stage">
          <div className="float" style={{ left: '1%', top: '-26px' }}>🟢 <b>Sarah</b> joined the meeting</div>
          <div className="float" style={{ right: '0', top: '55%', animationDelay: '-2s' }}>▶ Output ready · <span style={{ color: '#34d399' }}>0.04s</span></div>
          <Editor full />
        </div>
      </header>

      <div className="wrap lp-stats" data-r>
        {[['30+', 'languages supported'], ['0', 'installs needed'], ['<1s', 'sync between teammates'], ['∞', 'ideas shipped together']].map(([a, b]) => <div key={b}><b className="grad">{a}</b><span>{b}</span></div>)}
      </div>

      <section className="wrap" id="features">
        <div className="lp-head" data-r><h2>Everything inside <span className="grad">one meeting</span></h2><p>A tour of the workspace — scroll to see what your team gets the moment they join.</p></div>
        {ROWS.map(([tag, title, text, list, shot], i) => (
          <div className={`lp-row${i % 2 ? ' flip' : ''}`} key={tag} id={i === 0 ? 'workspace' : undefined}>
            <div className="txt" data-r><span className="tag">{tag}</span><h3>{title}</h3><p>{text}</p><ul>{list.map(l => <li key={l}>{l}</li>)}</ul></div>
            <div className="lp-shot" data-r>{shot}</div>
          </div>
        ))}
      </section>

      <section className="wrap">
        <div className="lp-head" data-r><h2>And a lot <span className="grad">more</span></h2></div>
        <div className="lp-grid">{FEATURES.map(([t, d, ic]) => <div className="lp-card" data-r key={t}><i>{ic}</i><h4>{t}</h4><p>{d}</p></div>)}</div>
      </section>

      <section className="wrap" id="how">
        <div className="lp-head" data-r><h2>Up and running in <span className="grad">30 seconds</span></h2></div>
        <div className="lp-steps">{STEPS.map(([n, t, d]) => <div className="lp-step" data-r key={n}><b className="grad">{n}</b><h4>{t}</h4><p>{d}</p></div>)}</div>
        <div className="lp-cta" data-r><h2>Ready to build <span className="grad">together?</span></h2><p>Create your first meeting and invite your team in seconds.</p><button className="btn primary lg" onClick={() => open('register')}>Create free account →</button></div>
      </section>

      <footer className="lp-foot" id="contact"><div className="wrap">
        <div className="cols">
          <div><Brand /><p>The collaborative workspace for developers. Built for teams who ship together.</p></div>
          <div><h5>Product</h5><a href="#features">Features</a><a href="#workspace">Workspace</a><a href="#how">How it works</a></div>
          <div><h5>Resources</h5><a href="#features">Documentation</a><a href="#features">GitHub</a></div>
          <div><h5>Company</h5><a href="#about">About</a><a href="#contact">Contact</a></div>
        </div>
        <p className="copy">&copy; {new Date().getFullYear()} DevSync. Built for developers.</p>
      </div></footer>

      {authOpen && (
        <div className="modal auth-modal" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
          <form className="auth-card" onSubmit={submit}>
            <Brand />
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>{mode === 'login' ? 'Sign in to your workspace.' : 'Start with an empty workspace and invite your team when you are ready.'}</p>
            {mode === 'register' && <label>Name<input name="name" autoComplete="name" /></label>}
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Password<input name="password" type="password" minLength="6" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {error && <div className="error">{error}</div>}
            {notice && <div className="notice">{notice}</div>}
            <button className="btn primary full" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
            <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button>
            <button type="button" className="link" onClick={() => setAuthOpen(false)}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}
