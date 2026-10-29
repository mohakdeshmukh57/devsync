import React, { useEffect, useState } from 'react';
import { Brand, ThemeToggle } from './common';
import AuthFlow from './AuthFlow';
import { FEATURES } from '../lib/constants';
import '../landing.css';

/* ---- tiny syntax highlighter for the mock screens ---- */
const TOK = /(\/\/.*)|('[^']*'|`[^`]*`)|\b(const|let|async|await|return|function|import|from|print|def|for|in)\b|\b(\d+)\b|\b([a-zA-Z_]+)(?=\()/g;
const hl = code => {
  const out = []; let last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(code))) {
    out.push(code.slice(last, m.index));
    out.push(<span className={m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : 'f'} key={m.index}>{m[0]}</span>);
    last = TOK.lastIndex;
  }
  out.push(code.slice(last));
  return out;
};
const Cursor = ({ name, color }) => <span className="cur" style={{ '--c': color }}>{name && <em>{name}</em>}</span>;
const Av = ({ n, c = '#ff5a36', className = '' }) => <div className={`av ${className}`} style={{ '--a': c }}>{n}</div>;
const Win = ({ title, live, children, right }) => (
  <div className="win"><div className="win-bar"><i /><i /><i /><span>{title}</span>{live && <span className="live">LIVE</span>}{right}</div>{children}</div>
);
const TOMATO = '#ff5a36', LEMON = '#ffd23f', MINT = '#3ddc97', SKY = '#5aa9ff', PINK = '#ff8fb3';

/* ---- mock screens (replace any with <img src="..."/> for real screenshots) ---- */
function Editor({ full }) {
  return (
    <Win title="team-standup" live right={<div className="pres"><Av n="Y" c={TOMATO} /><Av n="S" c={PINK} /><Av n="A" c={MINT} /></div>}>
      <div className="m-body" style={full ? undefined : { gridTemplateColumns: '120px 1fr', minHeight: 290 }}>
        <aside className="m-side"><b>FILES</b><div>src</div><div className="in2">App.jsx</div><div className="in2 on">editor.js</div><div className="in2">styles.css</div><div>index.html</div><div>README.md</div></aside>
        <div className="m-code">
          <div className="m-tabs"><span className="on">editor.js</span><span>App.jsx</span><span>+</span></div>
          <pre>{hl('async function run() {\n  const result = await runCode(code);\n  setOutput(result);')}<Cursor name="Sarah" color={PINK} />{'\n}\n\n'}{hl('// ship it together\nconst team = [\'You\', \'Sarah\', \'Alex\'];')}<Cursor name="Alex" color={MINT} /></pre>
        </div>
        {full && <div className="m-right"><div><b>OUTPUT</b><div className="out">&gt; Hello, World!</div></div><div><b>IN THE ROOM</b><div className="faces"><Av n="You" c={TOMATO} /><Av n="Sarah" c={PINK} /><Av n="Alex" c={MINT} /><Av n="Priya" c={LEMON} /></div></div></div>}
      </div>
    </Win>
  );
}
const Runner = () => (
  <Win title="main.py — Python">
    <div className="m-code"><pre>{hl('def fib(n):\n  a, b = 0, 1\n  for _ in range(n):\n    a, b = b, a + b\n  return a\n\nprint(fib(10))')}</pre>
      <div className="pills">{['Python', 'JavaScript', 'C++', 'Rust', 'Go', 'Java', '+25'].map(l => <span key={l}>{l}</span>)}<span className="go">RUN</span></div>
      <div className="con"><b>CONSOLE</b>$ python main.py<br />55<br /><span style={{ color: '#7d7662' }}>done in 0.04s</span></div></div>
  </Win>
);
const Preview = () => (
  <Win title="live preview" right={<div className="dev"><span>Mobile</span><span>Tablet</span><span className="on">Desktop</span></div>}>
    <div className="brw"><h4>Launch faster.</h4><i /><i /><span>Get started</span></div>
  </Win>
);
const Call = () => (
  <Win title="team call · 4 in room">
    <div className="call"><Av n="Sarah · sharing screen" className="big" c={SKY} /><Av n="Alex" c={MINT} /><Av n="Priya" c={LEMON} /></div>
    <div className="ctl"><span>MIC</span><span>CAM</span><span>SHARE</span><span className="red">LEAVE</span></div>
  </Win>
);
const Chat = () => (
  <Win title="chat">
    <div className="chat">
      <div className="msg"><small>Sarah</small>Fixed the null check on line 12</div>
      <div className="msg me">Nice. Running it now.</div>
      <div className="msg"><small>Alex</small>Preview looks right on mobile too</div>
      <div className="inv">devsync.app/room/x7k2<b>COPY INVITE</b></div>
    </div>
  </Win>
);
const TV = () => (
  <div><div className="tv"><Win title="TV mode · team-standup" live><div className="brw" style={{ minHeight: 200 }}><h4>Demo day</h4><i /><i /><span>Live output</span></div></Win></div><div className="stand" /></div>
);

const ROWS = [
  ['Real-time editing', 'Everyone types. Nobody overwrites.', 'Open one file and edit it together. Changes merge character by character, so you just watch your teammates’ cursors move while you work.', ['Live cursors with names', 'Conflict-free merging', 'Two panels, two files'], <Editor />, LEMON],
  ['Run anything', 'Press run. See it right there.', 'Python and JavaScript run straight in the browser. C++, Rust, Go, Java and 25+ more go through a secure runner. The console is shared with the whole room.', ['30+ languages', 'Shared console', 'Format & auto-close tags'], <Runner />, MINT],
  ['Live preview', 'Your page, as it happens.', 'HTML, CSS and JS render while you type. Flip between phone, tablet and desktop sizes to see what your users will see.', ['Device size switcher', 'Sandboxed & safe', 'Updates as you type'], <Preview />, SKY],
  ['Talk it through', 'Voices and faces, same tab.', 'Camera, microphone and screen sharing live inside the workspace. No second app, no “can you see my screen?”', ['Video, audio & screen share', 'Works in any browser', 'Chat beside the code'], <Call />, PINK],
  ['One link', 'Invite with a single link.', 'Send one link and a teammate is in. Chat stays next to the code, so decisions stay where the work happens.', ['Invite links', 'Member limits per room', 'Owner-only controls'], <Chat />, TOMATO],
  ['TV mode', 'Put the output on the big screen.', 'Same room? Open TV mode on a second display and show clean project output while everyone codes from their own laptop.', ['Made for classrooms & labs', 'Zero setup', 'Auto-refreshing'], <TV />, LEMON],
];
const STEPS = [['Make a room', 'Name it, pick how many people can join.'], ['Send the link', 'Teammates join from any browser. No installs.'], ['Build together', 'Code, run, preview and talk in one tab.']];
const LANGS = ['Python', 'JavaScript', 'TypeScript', 'C++', 'Rust', 'Go', 'Java', 'Kotlin', 'Ruby', 'PHP', 'Swift', 'SQL', 'HTML', 'CSS'];

function Typer({ words }) {
  const [t, setT] = useState(words[0]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let w = 0, c = words[0].length, del = true, id;
    const tick = () => {
      const word = words[w]; c += del ? -1 : 1; setT(word.slice(0, c));
      let d = del ? 40 : 90;
      if (!del && c === word.length) { del = true; d = 1700; } else if (del && c === 0) { del = false; w = (w + 1) % words.length; d = 300; }
      id = setTimeout(tick, d);
    };
    id = setTimeout(tick, 1800);
    return () => clearTimeout(id);
  }, []);
  return <span className="typer">{t}<Cursor color={MINT} /></span>;
}
const Pointer = ({ c, name, className }) => (
  <div className={'roam ' + className} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 26 26"><path d="M3 3l9 20 2.6-8.4L23 12z" fill={c} stroke="#14120d" strokeWidth="1.8" strokeLinejoin="round" /></svg><em style={{ background: c }}>{name}</em></div>
);

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-r]');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach(e => io.observe(e));
    const root = document.documentElement; const prev = root.style.scrollBehavior; root.style.scrollBehavior = 'smooth';
    return () => { io.disconnect(); root.style.scrollBehavior = prev; };
  }, []);
}

export default function Landing({ mode, setMode, authOpen, setAuthOpen, submit, error, notice, busy }) {
  const open = m => { setMode(m); setAuthOpen(true); };
  useReveal();
  return (
    <div className="lp" id="top">
      <nav className="lp-nav"><div className="wrap">
        <a href="#top"><Brand dark /></a>
        <div className="links"><a href="#features">Features</a><a href="#workspace">Inside</a><a href="#how">How it works</a><a href="#contact">Contact</a></div>
        <div className="acts"><ThemeToggle className="tgl" /><button className="txt" onClick={() => open('login')}>Log in</button><button className="btn ink" onClick={() => open('register')}>Start free</button></div>
      </div></nav>

      <header className="wrap lp-hero">
        <p className="kicker">LIVE CODING ROOMS · NO INSTALLS</p>
        <h1>Write code<br />with <Typer words={['people.', 'your team.', 'a friend.', 'the class.']} /></h1>
        <div className="hero-grid">
          <div>
            <p className="sub">One link opens a room with an editor, output, video and chat. Everyone is in the same file, at the same time.</p>
            <div className="cta"><button className="btn tom lg" onClick={() => open('register')}>Start a room →</button><button className="btn out lg" onClick={() => document.getElementById('features')?.scrollIntoView()}>See what’s inside</button></div>
            <div className="stamps"><span style={{ '--r': '-4deg', '--c': LEMON }}>FREE TO START</span><span style={{ '--r': '3deg', '--c': MINT }}>30+ LANGUAGES</span><span style={{ '--r': '-2deg', '--c': SKY }}>0 INSTALLS</span></div>
          </div>
          <div className="hero-shot"><Editor full /></div>
        </div>
        <Pointer c={SKY} name="Dev" className="r1" /><Pointer c={PINK} name="Sam" className="r2" />
      </header>

      <div className="marquee" aria-hidden="true"><div>{[...LANGS, ...LANGS, ...LANGS].map((l, i) => <span key={i}>{l}<b><svg width="20" height="20" viewBox="0 0 26 26"><path d="M3 3l9 20 2.6-8.4L23 12z" fill="#ff5a36" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></b></span>)}</div></div>

      <section className="wrap" id="features">
        <div className="lp-head" data-r><span className="kicker">THE ROOM, ROOM BY ROOM</span><h2>Everything your team needs, already open.</h2></div>
        {ROWS.map(([tag, title, text, list, shot, color], i) => (
          <div className={`lp-row${i % 2 ? ' flip' : ''}`} key={tag} id={i === 0 ? 'workspace' : undefined}>
            <div className="txt" data-r><span className="idx">{String(i + 1).padStart(2, '0')}</span><span className="tag">{tag}</span><h3>{title}</h3><p>{text}</p><ul>{list.map(l => <li key={l}>{l}</li>)}</ul></div>
            <div className="lp-shot" data-r style={{ '--c': color, '--t': i % 2 ? '1.2deg' : '-1.2deg' }}>{shot}</div>
          </div>
        ))}
      </section>

      <section className="wrap">
        <div className="lp-head" data-r><span className="kicker">AND ALSO</span><h2>The small stuff, handled.</h2></div>
        <div className="lp-grid" data-r>{FEATURES.map(([t, d], i) => <div className="lp-cell" key={t}><span>{String(i + 1).padStart(2, '0')}</span><h4>{t}</h4><p>{d}</p></div>)}</div>
      </section>

      <section className="wrap" id="how">
        <div className="lp-head" data-r><span className="kicker">HOW IT WORKS</span><h2>Three steps. About thirty seconds.</h2></div>
        <div className="lp-steps">{STEPS.map(([t, d], i) => <div className="lp-step" data-r key={t}><b>{i + 1}</b><h4>{t}</h4><p>{d}</p></div>)}</div>
      </section>

      <section className="lp-cta" data-r><div className="wrap"><h2>Your team is already waiting.</h2><button className="btn ink lg" onClick={() => open('register')}>Make your first room →</button></div></section>

      <footer className="lp-foot" id="contact"><div className="wrap">
        <div className="cols">
          <div><Brand /><p>A shared workspace for people who write code together.</p></div>
          <div><h5>PRODUCT</h5><a href="#features">Features</a><a href="#workspace">Inside the room</a><a href="#how">How it works</a></div>
          <div><h5>RESOURCES</h5><a href="#features">Docs</a><a href="#features">GitHub</a></div>
          <div><h5>COMPANY</h5><a href="#contact">About</a><a href="#contact">Contact</a></div>
        </div>
        <div className="giant" aria-hidden="true">devsync</div>
        <p className="copy">© {new Date().getFullYear()} devsync</p>
      </div></footer>

      {authOpen && <AuthFlow mode={mode} setMode={setMode} setAuthOpen={setAuthOpen} submit={submit} error={error} notice={notice} busy={busy} />}
    </div>
  );
}
