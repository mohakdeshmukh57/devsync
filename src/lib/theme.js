import { useEffect, useState } from 'react';
const KEY = 'ds-theme';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
/** Applies the saved choice, or `fallback` (light on the front page, dark inside the app) when nothing is saved. */
export function applyTheme(fallback = 'dark') {
  document.documentElement.dataset.theme = read() || fallback;
  window.dispatchEvent(new Event('ds-theme'));
}
export function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.classList.add('theme-fade');
  root.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event('ds-theme'));
  setTimeout(() => root.classList.remove('theme-fade'), 500);
}
export function useTheme() {
  const [t, setT] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => { const h = () => setT(document.documentElement.dataset.theme || 'dark'); window.addEventListener('ds-theme', h); return () => window.removeEventListener('ds-theme', h); }, []);
  return t;
}
