import React, { useState } from 'react';
import { Brand, Modal } from './common';
import { toast } from '../lib/supabase';

export default function Dashboard({ profile, userId, meetings, onCreate, onOpen, onRename, onDelete, onCapacity, onLogout, createOpen, setCreateOpen, meetingName, setMeetingName, maxMembers, setMaxMembers, busy }) {
  const [q, setQ] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const list = meetings.filter(m => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  const first = profile?.name?.split(' ')[0] || 'developer';

  const copyInvite = async m => {
    const link = `${location.origin}/meeting/${m.id}?invite=${m.invite_token}`;
    try { await navigator.clipboard.writeText(link); toast('Invite link copied'); }
    catch { window.prompt('Copy this invite link:', link); }
  };

  return (
    <div className="app">
      <header className="bar">
        <Brand />
        <div className="user"><span>{profile?.name}</span><span className="avatar">{(profile?.name || 'D')[0].toUpperCase()}</span><button className="btn" onClick={onLogout}>Log out</button></div>
      </header>
      <main className="dash">
        <div className="dash-head">
          <div><div className="eyebrow">Your workspace</div><h1>Welcome back, {first}</h1><p>{meetings.length} workspace{meetings.length === 1 ? '' : 's'}</p></div>
          <button className="btn primary" onClick={() => setCreateOpen(true)}>+ Create Meeting</button>
        </div>
        {meetings.length > 0 && (
          <div className="dash-controls">
            <input className="search" placeholder="Search meetings…" value={q} onChange={e => setQ(e.target.value)} />
            <div className="view-toggle">
              <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid view">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              </button>
              <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2.5" rx="1"/><rect x="1" y="6.75" width="14" height="2.5" rx="1"/><rect x="1" y="11.5" width="14" height="2.5" rx="1"/></svg>
              </button>
            </div>
          </div>
        )}
        {meetings.length === 0 ? (
          <div className="empty"><h3>No meetings yet</h3><p>Create a private room, then invite collaborators. Your editor starts completely empty.</p><button className="btn primary" onClick={() => setCreateOpen(true)}>Create your first meeting</button></div>
        ) : list.length === 0 ? (
          <div className="empty"><h3>No match</h3><p>Nothing matches &ldquo;{q}&rdquo;.</p></div>
        ) : viewMode === 'grid' ? (
          <div className="meetings">
            {list.map(m => (
              <div className="meeting-card" key={m.id}>
                <div className="card-top"><span className="live">{m.owner_id === userId ? 'OWNER' : 'MEMBER'}</span><span>{new Date(m.created_at).toLocaleDateString()}</span></div>
                <h3>{m.name}</h3>
                <p>Private collaborative workspace</p>
                <div className="seats" title="People in the meeting / maximum capacity">
                  <span>{m.member_count ?? 1} / {m.max_members ?? 10} members</span>
                  <i style={{ width: `${Math.min(100, ((m.member_count ?? 1) / (m.max_members ?? 10)) * 100)}%` }} />
                </div>
                <div className="meeting-meta">
                  <span className="acts">
                    <button className="icon" title="Copy invite link" onClick={() => copyInvite(m)}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 10l4-4M7.5 4.5L9.2 2.8a2 2 0 012.8 2.8L10.5 7.5M8.5 11.5l-1.7 1.7a2 2 0 01-2.8-2.8L5.5 8.5"/></svg>
                    </button>
                    <button className="icon" title="Rename" onClick={() => onRename(m)}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2M3 13l.7-2.8L11 2.8l2 2L5.8 12.2 3 13z"/></svg>
                    </button>
                    <button className="icon" title="Change capacity" onClick={() => onCapacity(m)}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5"/><path d="M12 6v4M10 8h4"/></svg>
                    </button>
                    <button className="icon" title="Delete" onClick={() => onDelete(m)}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M10 7v4M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9"/></svg>
                    </button>
                  </span>
                  <button className="btn" onClick={() => onOpen(m.id)}>Open workspace</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="meetings-list">
            {list.map(m => (
              <div className="meeting-row" key={m.id} onClick={() => onOpen(m.id)}>
                <div className="meeting-row-info">
                  <span className="live">{m.owner_id === userId ? 'OWNER' : 'MEMBER'}</span>
                  <b>{m.name}</b>
                  <span className="meeting-row-meta">{m.member_count ?? 1}/{m.max_members ?? 10} members · {new Date(m.created_at).toLocaleDateString()}</span>
                </div>
                <span className="acts">
                  <button className="icon" title="Copy invite link" onClick={e => { e.stopPropagation(); copyInvite(m); }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 10l4-4M7.5 4.5L9.2 2.8a2 2 0 012.8 2.8L10.5 7.5M8.5 11.5l-1.7 1.7a2 2 0 01-2.8-2.8L5.5 8.5"/></svg>
                  </button>
                  <button className="icon" title="Rename" onClick={e => { e.stopPropagation(); onRename(m); }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2M3 13l.7-2.8L11 2.8l2 2L5.8 12.2 3 13z"/></svg>
                  </button>
                  <button className="icon" title="Delete" onClick={e => { e.stopPropagation(); onDelete(m); }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M10 7v4M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9"/></svg>
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
      {createOpen && (
        <Modal title="Create meeting" close={() => setCreateOpen(false)} onSubmit={onCreate}>
          <p>Your new meeting starts completely empty. Invite collaborators after it is created.</p>
          <label>Meeting name<input autoFocus value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="e.g. Startup MVP" maxLength={80} /></label>
          <label>Maximum participants (including you)
            <div className="cap-row">
              <input type="range" min="2" max="50" value={maxMembers} onChange={e => setMaxMembers(+e.target.value)} />
              <input className="cap-num" type="number" min="2" max="50" value={maxMembers} onChange={e => setMaxMembers(Math.max(2, Math.min(50, +e.target.value || 2)))} />
            </div>
            <small className="hint">Anyone opening the invite link after the meeting is full is turned away. Video calls run best with 6 or fewer people on camera.</small>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create meeting'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
