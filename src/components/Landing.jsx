import React from 'react';
import { Brand } from './common';
import { FEATURES } from '../lib/constants';

function HeroWorkspace() {
  return (
    <div className="hero-mock">
      <div className="mock-top"><b>DevSync</b><span>Project workspace</span><span className="live">Live</span></div>
      <div className="mock-body">
        <aside><b>Files</b><div>src</div><div className="indent">components</div><div className="indent">CodeEditor.tsx</div><div className="indent">Preview.tsx</div><div>package.json</div></aside>
        <div className="mock-code"><div className="mock-tabs">Home.tsx &times;&nbsp;&nbsp; CodeEditor.tsx &nbsp;&nbsp; + New</div><pre>{`const Home = () => {
  const [output, setOutput] = useState('');

  async function run() {
    const result = await runCode(code);
    setOutput(result);
  }

  return (
    <main>
      <CodeEditor />
      <Output value={output} />
    </main>
  );
};`}</pre></div>
        <div className="mock-side"><div><b>OUTPUT</b><div className="fake">Hello, World!</div></div><div><b>TEAM CALL</b><div className="faces"><span>You</span><span>Sarah</span><span>Alex</span><span>Priya</span></div></div></div>
      </div>
    </div>
  );
}

export default function Landing({ mode, setMode, authOpen, setAuthOpen, submit, error, notice, busy }) {
  const open = m => { setMode(m); setAuthOpen(true); };
  return (
    <div className="landing-page">
      <nav className="nav">
        <Brand />
        <div className="navlinks"><a href="#features">Features</a><a href="#features">Workspace</a><a href="#features">Docs</a><a href="#features">About</a></div>
        <div className="navactions"><button className="btn" onClick={() => open('login')}>Log In</button><button className="btn primary" onClick={() => open('register')}>Get Started</button></div>
      </nav>
      <section className="hero">
        <div>
          <div className="eyebrow">Build together, in real time</div>
          <h1>The collaborative workspace for <span className="gradient">developers.</span></h1>
          <p>Code together, talk together, preview together. DevSync is the all-in-one workspace for teams who ship fast — from anywhere.</p>
          <div className="heroBtns"><button className="btn primary" onClick={() => open('register')}>Start Building &rarr;</button><button className="btn" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Explore features</button></div>
        </div>
        <HeroWorkspace />
      </section>
      <section id="features" className="feature-section">
        <h2>Everything you need to <span className="gradient">build together</span></h2>
        <div className="feature-grid">{FEATURES.map(([t, d, ic]) => <div className="feature-card" key={t}><div className="feature-icon">{ic}</div><h3>{t}</h3><p>{d}</p></div>)}</div>
      </section>
      <footer className="site-footer">
        <Brand />
        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#features">Documentation</a>
          <a href="#features">GitHub</a>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} DevSync. Built for developers.</p>
      </footer>
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
