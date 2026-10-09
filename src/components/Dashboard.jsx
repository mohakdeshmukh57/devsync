import React, { useState } from 'react';
import { Brand, Modal } from './common';
import { toast } from '../lib/supabase';

export default function Dashboard({ profile, userId, meetings, onCreate, onOpen, onRename, onDelete, onCapacity, onLogout, createOpen, setCreateOpen, meetingName, setMeetingName, maxMembers, setMaxMembers, busy }) {
  const [q, setQ] = useState('');
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
          <button className="btn primary" onClick={() => setCreateOpen(true)}>＋ Create Meeting</button>
        </div>
        {meetings.length > 0 && <input className="search" placeholder="Search meetings…" value={q} onChange={e => setQ(e.target.value)} />}
        {meetings.length === 0 ? (
          <div className="empty"><h3>No meetings yet</h3><p>Create a private room, then invite collaborators. Your editor starts completely empty.</p><button className="btn primary" onClick={() => setCreateOpen(true)}>Create your first meeting</button></div>
        ) : list.length === 0 ? (
          <div className="empty"><h3>No match</h3><p>Nothing matches “{q}”.</p></div>
        ) : (
          <div className="meetings">
            {list.map(m => (
              <div className="meeting-card" key={m.id}>
                <div className="card-top"><span className="live">● {m.owner_id === userId ? 'OWNER' : 'MEMBER'}</span><span>{new Date(m.created_at).toLocaleDateString()}</span></div>
                <h3>{m.name}</h3>
                <p>Private collaborative workspace</p>
                <div className="seats" title="People in the meeting / maximum capacity">
                  <span>👥 {m.member_count ?? 1} / {m.max_members ?? 10}</span>
                  <i style={{ width: `${Math.min(100, ((m.member_count ?? 1) / (m.max_members ?? 10)) * 100)}%` }} />
                </div>
                <div className="meeting-meta">
                  <span className="acts">
                    <button className="icon" title="Copy invite link" onClick={() => copyInvite(m)}>↗</button>
                    <button className="icon" title="Rename" onClick={() => onRename(m)}>✎</button>
                    <button className="icon" title="Change capacity" onClick={() => onCapacity(m)}>👥</button>
                    <button className="icon" title="Delete" onClick={() => onDelete(m)}>🗑</button>
                  </span>
                  <button className="btn" onClick={() => onOpen(m.id)}>Open workspace</button>
                </div>
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
