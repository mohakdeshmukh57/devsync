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
        <button type="button" className="close" onClick={close} aria-label="Close">×</button>
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

export function Brand() {
  return <div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div>;
}

export function Loading({ text = 'Loading…' }) {
  return <div className="boot"><Brand /><div className="spinner" /><p>{text}</p></div>;
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
