import React, { useEffect, useRef, useState } from 'react';
import { Brand } from './common';
import '../auth.css';

/* ---- provider marks (buttons only: real sign-in is email) ---- */
const Google = () => <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>;
const GitHub = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>;
const LinkedIn = () => <svg viewBox="0 0 24 24" width="20" height="20"><rect width="24" height="24" rx="5" fill="#0A66C2" /><circle cx="6.6" cy="7.4" r="1.6" fill="#fff" /><rect x="5.2" y="9.8" width="2.8" height="8.6" fill="#fff" /><path fill="#fff" d="M10.2 9.8h2.7v1.2c.5-.9 1.5-1.4 2.8-1.4 2.6 0 3.3 1.6 3.3 3.9v4.9h-2.8v-4.4c0-1.1-.3-1.9-1.4-1.9-1.2 0-1.8.8-1.8 2v4.3h-2.8z" /></svg>;
const Microsoft = () => <svg viewBox="0 0 24 24" width="20" height="20"><rect x="2.5" y="2.5" width="9.2" height="9.2" fill="#F25022" /><rect x="12.3" y="2.5" width="9.2" height="9.2" fill="#7FBA00" /><rect x="2.5" y="12.3" width="9.2" height="9.2" fill="#00A4EF" /><rect x="12.3" y="12.3" width="9.2" height="9.2" fill="#FFB900" /></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;

const MAIN = [['Google', Google]];
const MORE = [['GitHub', GitHub], ['LinkedIn', LinkedIn], ['Microsoft', Microsoft], ['X', XIcon]];
const STEPS = { login: ['method', 'email', 'password'], register: ['method', 'email', 'name', 'password'] };
const LABEL = { method: 'Method', email: 'Email', name: 'Name', password: 'Password' };
const COPY = {
  email: ['What’s your email?', 'We’ll use it to sign you in.'],
  name: ['What should we call you?', 'Your teammates will see this name in meetings.'],
};
const ok = {
  email: s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) || 'Enter a valid email address.',
  name: s => s.trim().length >= 2 || 'Please enter at least 2 characters.',
  password: s => s.length >= 6 || 'Use at least 6 characters.',
};
const strength = p => [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
const Ic = ({ d }) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const MAIL = <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3.5 7 8.5 6 8.5-6" /></>;
const USER = <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>;
const LOCK = <><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>;

export default function AuthFlow({ mode, setMode, setAuthOpen, submit, error, notice, busy }) {
  const steps = STEPS[mode];
  const [i, setI] = useState(0);
  const [dir, setDir] = useState('fwd');
  const [v, setV] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [bad, setBad] = useState('');
  const [shake, setShake] = useState(0);
  const [hint, setHint] = useState('');
  const [closing, setClosing] = useState(false);
  const hintTimer = useRef(0);
  const step = notice ? 'done' : steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const pct = step === 'done' ? 100 : ((i + 1) / steps.length) * 100;
  const set = k => e => { setV(o => ({ ...o, [k]: e.target.value })); if (bad) setBad(''); };

  const close = () => { setClosing(true); setTimeout(() => setAuthOpen(false), 220); };
  useEffect(() => { const h = e => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', h); return () => { window.removeEventListener('keydown', h); clearTimeout(hintTimer.current); }; }, []);

  const fail = msg => { setBad(msg); setShake(n => n + 1); };
  const next = () => {
    const r = ok[step]?.(v[step]);
    if (r !== undefined && r !== true) return fail(r);
    setBad(''); setMode(mode); setDir('fwd'); setI(n => n + 1);
  };
  const back = () => { setBad(''); setMode(mode); setDir('back'); setI(n => Math.max(0, n - 1)); };
  const toMode = m => { setMode(m); setI(0); setDir('back'); setBad(''); setShow(false); };
  const social = name => { setHint(`${name} sign-in isn’t available yet — continue with email below.`); setShake(n => n + 1); clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHint(''), 4200); };
  const onSubmit = e => {
    if (step === 'method') { e.preventDefault(); return; }
    if (!last) { e.preventDefault(); next(); return; }
    const r = ok.password(v.password);
    if (r !== true) { e.preventDefault(); fail(r); return; }
    submit(e);
  };

  const title = step === 'method' ? [mode === 'login' ? 'Welcome back' : 'Create your account', 'Choose how you’d like to continue.']
    : step === 'password' ? [mode === 'login' ? 'Enter your password' : 'Create a password', mode === 'login' ? 'Almost there — one last step.' : 'At least 6 characters. Longer is stronger.']
    : step === 'done' ? ['Check your inbox', notice] : COPY[step];
  const sc = strength(v.password);

  return (
    <div className={'af-backdrop' + (closing ? ' out' : '')} onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <form className="af-card" onSubmit={onSubmit} noValidate>
        <div className="af-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}><i style={{ width: pct + '%' }} /></div>
        <button type="button" className="af-x" onClick={close} aria-label="Close">&times;</button>

        <aside className="af-side">
          <Brand />
          <h2>{mode === 'login' ? 'Good to see you again.' : 'Build with your team, live.'}</h2>
          <p>{mode === 'login' ? 'Your workspaces are right where you left them.' : 'One link, one workspace — code, preview, talk and chat together.'}</p>
          <div className="af-mini" aria-hidden="true">
            <div className="af-mini-bar"><i /><i /><i /><b>team-standup</b></div>
            <div className="af-mini-body">
              {[72, 46, 86, 58, 34].map((w, k) => <span key={k} style={{ '--w': w + '%', '--d': k * 0.18 + 's' }} />)}
              <em className="c1">Sarah</em><em className="c2">Alex</em>
            </div>
          </div>
          <ul>{['Real-time editing with live cursors', 'Video calls and chat built in', 'Run 30+ languages in the browser'].map(t => <li key={t}>{t}</li>)}</ul>
        </aside>

        <section className="af-main">
          {step !== 'done' && (
            <ol className="af-dots">{steps.map((s, k) => <li key={s} className={k < i ? 'done' : k === i ? 'now' : ''}><b>{k < i ? '✓' : k + 1}</b><span>{LABEL[s]}</span></li>)}</ol>
          )}
          <div className={'af-step ' + dir} key={step}>
            {step !== 'method' && step !== 'done' && <button type="button" className="af-back" onClick={back}>&larr; Back</button>}
            {step === 'done' ? (
              <div className="af-done"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="m15 27 8 8 15-17" /></svg></div>
            ) : null}
            <h3>{title[0]}</h3>
            <p className="af-sub">{title[1]}</p>

            {step === 'method' && (
              <div className="af-methods">
                <div className="af-social">
                  {MAIN.map(([n, Icon]) => <button type="button" className="wide" key={n} onClick={() => social(n)}><Icon />Continue with {n}</button>)}
                  {MORE.map(([n, Icon]) => <button type="button" key={n} onClick={() => social(n)} title={n}><Icon />{n}</button>)}
                </div>
                {hint && <div className="af-hint" key={shake}>{hint}</div>}
                <div className="af-or"><span>or</span></div>
                <button type="button" className={'af-primary' + (hint ? ' pulse' : '')} onClick={next}><Ic d={MAIL} />Continue with email</button>
              </div>
            )}

            {step === 'email' && (
              <label className={'af-field' + (bad ? ' bad' : '')} key={'e' + shake}>
                <Ic d={MAIL} /><input name="email" type="email" value={v.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" autoFocus />
              </label>
            )}
            {step === 'name' && (
              <label className={'af-field' + (bad ? ' bad' : '')} key={'n' + shake}>
                <Ic d={USER} /><input name="name" value={v.name} onChange={set('name')} placeholder="Your name" autoComplete="name" autoFocus />
              </label>
            )}
            {step === 'password' && (
              <>
                <button type="button" className="af-chip" onClick={() => { setDir('back'); setI(1); }} title="Change email"><Ic d={MAIL} />{v.email || 'your email'}<u>Edit</u></button>
                <label className={'af-field' + (bad || error ? ' bad' : '')} key={'p' + shake}>
                  <Ic d={LOCK} /><input name="password" type={show ? 'text' : 'password'} value={v.password} onChange={set('password')} placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} autoFocus />
                  <button type="button" className="af-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
                </label>
                {mode === 'register' && <div className="af-meter" data-s={sc}><i /><i /><i /><i /><span>{['Too short', 'Weak', 'Okay', 'Good', 'Strong'][v.password ? sc : 0] || ''}</span></div>}
              </>
            )}

            {(bad || (error && step === 'password')) && <div className="af-err" key={'x' + shake + bad}>{bad || error}</div>}

            {step !== 'method' && step !== 'done' && (
              <button className="af-primary" disabled={busy}>
                {busy ? <><span className="af-spin" />Working…</> : last ? (mode === 'login' ? 'Sign in' : 'Create account') : 'Continue'}
              </button>
            )}
            {step === 'done' && <button type="button" className="af-primary" onClick={() => { setMode('login'); setDir('fwd'); setI(1); }}>Continue to sign in</button>}

            {step !== 'done' && (
              <p className="af-switch">{mode === 'login' ? 'New to DevSync?' : 'Already have an account?'} <button type="button" onClick={() => toMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
            )}
          </div>
          {/* values for the real form submit stay mounted across every step */}
          {step !== 'email' && <input type="hidden" name="email" value={v.email} />}
          {step !== 'name' && <input type="hidden" name="name" value={v.name} />}
          {step !== 'password' && <input type="hidden" name="password" value={v.password} />}
        </section>
      </form>
    </div>
  );
}
