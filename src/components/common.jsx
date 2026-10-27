import { useTheme, toggleTheme } from '../lib/theme';
import React, { useEffect, useState } from 'react';

export function Modal({ title, close, children, onSubmit }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [close]);
  const Wrap = onSubmit ? 'form' : 'div';
  return (
    <div className="modal" onMouseDown={e => { if (e.currentTarget === e.target) close(); }}>
      <Wrap className="modal-card" onSubmit={onSubmit ? e => { e.preventDefault(); onSubmit(); } : undefined}>
        <button type="button" className="close" onClick={close} aria-label="Close">&times;</button>
        <h2>{title}</h2>
        {children}
      </Wrap>
    </div>
  );
}

export function Toasts() {
  const [t, setT] = useState('');
  useEffect(() => {
    let id;
    const h = e => { setT(e.detail); clearTimeout(id); id = setTimeout(() => setT(''), 3200); };
    window.addEventListener('ds-toast', h);
    return () => { window.removeEventListener('ds-toast', h); clearTimeout(id); };
  }, []);
  return t ? <div className="toast" role="status">{t}</div> : null;
}

export function Brand({ dark }) {
  return (
    <div className={'brand' + (dark ? ' on-paper' : '')}>
      <svg className="mark" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 3l9 20 2.6-8.4L23 12z" fill="#ff5a36" stroke="#14120d" strokeWidth="1.8" strokeLinejoin="round" /><path d="M13 2l9 20 2-6.4" fill="none" stroke="currentColor" strokeWidth="0" /></svg>
      <b>devsync</b>
    </div>
  );
}

const QUOTES = [
  ['Talk is cheap. Show me the code.', 'Linus Torvalds'],
  ['Make it work, make it right, make it fast.', 'Kent Beck'],
  ['Alone we can do so little; together we can do so much.', 'Helen Keller'],
  ['First, solve the problem. Then, write the code.', 'John Johnson'],
  ['Simplicity is prerequisite for reliability.', 'Edsger W. Dijkstra'],
  ['Programs must be written for people to read.', 'Harold Abelson'],
  ['The best way to predict the future is to invent it.', 'Alan Kay'],
  ['Talent wins games, but teamwork wins championships.', 'Michael Jordan'],
];

export function Loading({ text = 'Loading…' }) {
  const [q] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  return (
    <div className="boot boot-scene">
      <span className="boot-ring r1" /><span className="boot-ring r2" />
      <div className="boot-card">
        <span className="boot-logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg></span>
        <h2>{text.replace(/…$/, '')}<span className="dots"><i /><i /><i /></span></h2>
        <div className="boot-bar"><i /></div>
        <blockquote><p>&ldquo;{q[0]}&rdquo;</p><cite>{q[1]}</cite></blockquote>
      </div>
    </div>
  );
}

export function Setup() {
  return (
    <div className="setup"><div>
      <Brand />
      <h1>Connect Supabase</h1>
      <p>Create a <code>.env</code> file (locally) or add the variables in Vercel, then restart/redeploy.</p>
      <pre>{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

Optional:
VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL   (video calls on strict networks)
JUDGE0_URL / JUDGE0_HEADERS_JSON                            (run Java, C++, Go, Rust, … and the terminal)
AI_BASE_URL / AI_API_KEY / AI_MODEL                         (AI assistant)`}</pre>
    </div></div>
  );
}

export function ThemeToggle({ className = 'hdr-btn' }) {
  const t = useTheme();
  const light = t === 'light';
  return (
    <button type="button" className={className + ' theme-toggle'} onClick={toggleTheme} title={light ? 'Switch to dark mode' : 'Switch to light mode'} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}>
      {light
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>}
    </button>
  );
}
