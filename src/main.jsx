import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const LANGS = {
  html:['HTML','html'], css:['CSS','css'], javascript:['JavaScript','js'], typescript:['TypeScript','ts'],
  python:['Python','py'], java:['Java','java'], c:['C','c'], cpp:['C++','cpp'], csharp:['C#','cs'], go:['Go','go'],
  rust:['Rust','rs'], php:['PHP','php'], ruby:['Ruby','rb'], swift:['Swift','swift'], kotlin:['Kotlin','kt'], dart:['Dart','dart'],
  sql:['SQL','sql'], json:['JSON','json'], yaml:['YAML','yaml'], markdown:['Markdown','md'], shell:['Shell','sh'], plaintext:['Plain Text','txt']
};

function App(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [screen,setScreen]=useState('landing');
  const [authMode,setAuthMode]=useState('login');
  const [authOpen,setAuthOpen]=useState(false);
  const [authError,setAuthError]=useState('');
  const [meetings,setMeetings]=useState([]);
  const [meeting,setMeeting]=useState(null);
  const [files,setFiles]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [content,setContent]=useState('');
  const [createOpen,setCreateOpen]=useState(false);
  const [fileOpen,setFileOpen]=useState(false);
  const [renameOpen,setRenameOpen]=useState(false);
  const [inviteOpen,setInviteOpen]=useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const [meetingName,setMeetingName]=useState('');
  const [fileName,setFileName]=useState('index');
  const [fileLang,setFileLang]=useState('html');
  const [rename,setRename]=useState('');
  const [toast,setToast]=useState('');
  const [ctx,setCtx]=useState(null);
  const [preview,setPreview]=useState('');
  const [chat,setChat]=useState([]);
  const [chatText,setChatText]=useState('');
  const realtimeRef=useRef(null);
  const saveTimer=useRef(null);
  const activeFile=useMemo(()=>files.find(f=>f.id===activeId)||null,[files,activeId]);
  const userName=profile?.name || session?.user_metadata?.name || session?.email?.split('@')[0] || 'Developer';

  useEffect(()=>{
    if(!supabase){setToast('Supabase variables are missing in Vercel.');return;}
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session||!supabase)return;
    (async()=>{
      let {data:p}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
      if(!p){await supabase.from('profiles').insert({id:session.user.id,name:session.user.user_metadata?.name||session.user.email?.split('@')[0]||'Developer'});({data:p}=await supabase.from('profiles').select('*').eq('id',session.user.id).single());}
      setProfile(p||null);
      await loadMeetings();
      if(!location.pathname.startsWith('/meeting/')) setScreen('dashboard');
    })();
  },[session]);

  useEffect(()=>{ if(screen==='meeting' && meeting) subscribeMeeting(meeting.id); },[meeting?.id]);

  function note(text){setToast(text);window.clearTimeout(note.t);note.t=window.setTimeout(()=>setToast(''),2200)}
  async function loadMeetings(){const {data,error}=await supabase.from('meetings').select('*').order('created_at',{ascending:false});if(!error)setMeetings(data||[]);}
  async function authSubmit(e){e.preventDefault();setAuthError('');const fd=new FormData(e.currentTarget);const email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||''),name=String(fd.get('name')||'').trim();if(!email||!password)return setAuthError('Enter email and password.');let r;if(authMode==='register')r=await supabase.auth.signUp({email,password,options:{data:{name:name||email.split('@')[0]}}});else r=await supabase.auth.signInWithPassword({email,password});if(r.error)setAuthError(r.error.message);else{setAuthOpen(false);note(authMode==='register'?'Account created':'Signed in');}}
  async function logout(){await supabase.auth.signOut();setMeeting(null);setScreen('landing');}
  async function createMeeting(){const {data,error}=await supabase.rpc('create_meeting',{p_name:meetingName||'Untitled Meeting'});if(error)return note(error.message);setCreateOpen(false);setMeetingName('');await loadMeetings();await openMeeting(data);}
  async function openMeeting(id){const [{data:m,error:me},{data:f}]=await Promise.all([supabase.from('meetings').select('*').eq('id',id).single(),supabase.from('files').select('*').eq('meeting_id',id).order('created_at')]);if(me)return note(me.message);setMeeting(m);setFiles(f||[]);setActiveId(null);setContent('');setPreview('');setScreen('meeting');}
  async function subscribeMeeting(id){await realtimeRef.current?.unsubscribe();const ch=supabase.channel('meeting:'+id,{config:{private:true,presence:{key:session.user.id},broadcast:{self:false}}});ch.on('broadcast',{event:'file-change'},({payload})=>{setFiles(old=>old.map(f=>f.id===payload.id?{...f,content:payload.content}:f));if(activeId===payload.id)setContent(payload.content);}).on('broadcast',{event:'chat'},({payload})=>setChat(old=>[...old,payload])).subscribe(async s=>{if(s==='SUBSCRIBED')await ch.track({id:session.user.id,name:userName});});realtimeRef.current=ch;}
  async function openFile(f){setActiveId(f.id);setContent(f.content||'');renderPreview(f.id,f.content||'');}
  async function updateContent(v){setContent(v);if(!activeFile)return;setFiles(old=>old.map(f=>f.id===activeFile.id?{...f,content:v}:f));renderPreview(activeFile.id,v);window.clearTimeout(saveTimer.current);saveTimer.current=window.setTimeout(async()=>{await supabase.from('files').update({content:v,updated_at:new Date().toISOString()}).eq('id',activeFile.id);await realtimeRef.current?.send({type:'broadcast',event:'file-change',payload:{id:activeFile.id,content:v}});},350);}
  async function createFile(){let n=fileName.trim().replace(/[\\/]/g,'');if(!n)return note('Enter a file name.');const ext=LANGS[fileLang][1];if(!n.toLowerCase().endsWith('.'+ext))n+='.'+ext;if(files.some(f=>f.name===n))return note('That file already exists.');const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:n,language:fileLang,content:'',path:'/',created_by:session.user.id}).select('*').single();if(error)return note(error.message);setFiles(old=>[...old,data]);setFileOpen(false);await openFile(data);note(n+' created');}
  async function deleteFile(id){const f=files.find(x=>x.id===id);if(!f||!confirm(`Delete ${f.name}?`))return;const {error}=await supabase.from('files').delete().eq('id',id);if(error)return note(error.message);setFiles(old=>old.filter(x=>x.id!==id));if(activeId===id){setActiveId(null);setContent('');setPreview('');}setCtx(null);}
  async function renameFile(){if(!ctx?.fileId)return;const f=files.find(x=>x.id===ctx.fileId);if(!f||!rename.trim())return;const lang=(Object.entries(LANGS).find(([,v])=>rename.toLowerCase().endsWith('.'+v[1]))||[])[0]||f.language;const {error}=await supabase.from('files').update({name:rename.trim(),language:lang,updated_at:new Date().toISOString()}).eq('id',f.id);if(error)return note(error.message);setFiles(old=>old.map(x=>x.id===f.id?{...x,name:rename.trim(),language:lang}:x));setRenameOpen(false);setCtx(null);}
  async function duplicateFile(){if(!ctx?.fileId)return;const f=files.find(x=>x.id===ctx.fileId);if(!f)return;const dot=f.name.lastIndexOf('.');const base=dot>-1?f.name.slice(0,dot):f.name;const ext=dot>-1?f.name.slice(dot):'';const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:base+'-copy'+ext,language:f.language,content:f.content,path:'/',created_by:session.user.id}).select('*').single();if(!error&&data)setFiles(old=>[...old,data]);setCtx(null);}
  
  function renderPreview(changedId,changed){
    const all=files.map(f=>f.id===changedId?{...f,content:changed}:f);
    const html=all.find(f=>f.language==='html');
    if(!html){setPreview('');return;}
    let doc=html.content;
    
    for(const f of all.filter(x=>x.language==='css')){
      const n=f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const tag=`<style>${f.content}</style>`;
      const re=new RegExp(`<link[^>]*href=["']${n}["'][^>]*>`,'i');
      doc=re.test(doc)?doc.replace(re,tag):doc.replace(/<\/head>/i,tag+'</'+'head>');
    }
    
    for(const f of all.filter(x=>x.language==='javascript')){
      const n=f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const tag=`<script>${f.content.replace(/<\/script>/gi,'<\/'+'script>')}</script>`;
      const re=new RegExp(`<script[^>]*src=["']${n}["'][^>]*><\/script>`,'i');
      doc=re.test(doc)?doc.replace(re,tag):doc.replace(/<\/body>/i,tag+'<\/'+'body>');
    }
    
    setPreview(doc);
  }

  async function sendChat(){if(!chatText.trim())return;const payload={name:userName,message:chatText.trim()};setChat(old=>[...old,payload]);await realtimeRef.current?.send({type:'broadcast',event:'chat',payload});setChatText('');}
  const inviteLink=meeting?`${location.origin}/meeting/${meeting.id}?invite=${meeting.invite_token}`:'';

  if(!supabase)return <Setup/>;
  if(screen==='landing')return <Landing open={()=>setAuthOpen(true)} mode={authMode} setMode={m=>{setAuthMode(m);setAuthOpen(true)}} authOpen={authOpen} close={()=>setAuthOpen(false)} submit={authSubmit} error={authError}/>;
  if(screen==='dashboard')return <Dashboard profile={profile} meetings={meetings} create={()=>setCreateOpen(true)} open={openMeeting} logout={logout}/>;
  return <Meeting profile={profile} meeting={meeting} files={files} active={activeFile} content={content} onChange={updateContent} onSelect={openFile} createFile={()=>setFileOpen(true)} run={()=>note('Web languages update in the live preview. Server execution will be added next.')} invite={()=>setInviteOpen(true)} inviteLink={inviteLink} copyInvite={async()=>{await navigator.clipboard?.writeText(inviteLink);note('Invite link copied')}} onLeave={()=>{setScreen('dashboard');setMeeting(null);setActiveId(null);realtimeRef.current?.unsubscribe()}} onContext={(e,id)=>{e.preventDefault();setCtx({x:e.clientX,y:e.clientY,fileId:id})}} ctx={ctx} closeCtx={()=>setCtx(null)} rename={()=>{const f=files.find(x=>x.id===ctx?.fileId);if(f){setRename(f.name);setRenameOpen(true)}}} duplicate={duplicateFile} del={()=>ctx?.fileId&&deleteFile(ctx.fileId)} chatOpen={chatOpen} setChatOpen={setChatOpen} chat={chat} chatText={chatText} setChatText={setChatText} sendChat={sendChat} preview={preview} createOpen={fileOpen} setCreateOpen={setFileOpen} fileName={fileName} setFileName={setFileName} fileLang={fileLang} setFileLang={setFileLang} doCreate={createFile} renameOpen={renameOpen} setRenameOpen={setRenameOpen} rename={rename} setRename={setRename} doRename={renameFile} inviteOpen={inviteOpen} setInviteOpen={setInviteOpen}/>;
}

function Landing(p){return <div><nav className="nav"><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><div className="navlinks"><a href="#features">Features</a><a href="#features">Pricing</a><a href="#features">Docs</a><a href="#features">Blog</a></div><div className="navactions"><button className="btn" onClick={()=>p.setMode('login')}>Log In</button><button className="btn primary" onClick={()=>p.setMode('register')}>Get Started Free</button></div></nav><section className="hero"><div><div className="eyebrow">● Build Together. In Real Time.</div><h1>The All-in-One<br/><span className="gradient">Collaborative Coding</span><br/>Workspace</h1><p>Code, chat, run, and build together — with real-time collaboration, meetings, live preview and a clean shared workspace.</p><div className="heroBtns"><button className="btn primary" onClick={()=>p.setMode('register')}>Start Building Free →</button><button className="btn" onClick={()=>document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}>▷ Explore</button></div></div><div className="hero-mock"><div className="mock-top"><b>DevSync</b><span>Project workspace</span><span className="live">● Live</span></div><div className="mock-body"><aside><b>Files</b><div>⌄ src</div><div className="indent">App.tsx</div><div className="indent">Preview.tsx</div><div>package.json</div></aside><div className="mock-code"><div className="mock-tabs">Home.tsx ×  Preview.tsx  + New</div><pre>{`const App = () => {
  return (
    <main>
      <h1>Build together.</h1>
      <Button />
    </main>
  );
}`}</pre></div><div className="mock-side"><div><b>LIVE PREVIEW</b><div className="fake">Your app. Your team.</div></div><div><b>TEAM CALL</b><div className="faces"><span>You</span><span>Sarah</span><span>Alex</span><span>Priya</span></div></div></div></div></div></section><section id="features" className="feature-section"><h2>Everything You Need to <span className="gradient">Build Together</span></h2><div className="feature-grid">{['Real-Time Collaboration','Video & Audio Meetings','Shared Terminal','Live Preview & Output','Multiple Code Panels','Branches','AI Assistant','Focus Mode','Project Management','TV / Room Mode'].map(x=><div className="feature-card" key={x}><div className="feature-icon">✦</div><h3>{x}</h3><p>Built into one workspace for focused development.</p></div>)}</div></section>{p.authOpen&&<div className="modal"><form className="auth-card" onSubmit={p.submit}><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><h2>{p.mode==='login'?'Welcome back':'Create your account'}</h2>{p.mode==='register'&&<label>Name<input name="name"/></label>}<label>Email<input name="email" type="email" required/></label><label>Password<input name="password" type="password" minLength="6" required/></label>{p.error&&<div className="error">{p.error}</div>}<button className="btn primary full">{p.mode==='login'?'Sign In':'Create Account'}</button><button type="button" className="link" onClick={()=>p.setMode(p.mode==='login'?'register':'login')}>{p.mode==='login'?'Need an account? Create one':'Already have an account? Sign in'}</button><button type="button" className="link" onClick={p.close}>Cancel</button></form></div>}</div>}

function Dashboard({profile,meetings,create,open,logout}){return <div className="app"><header className="bar"><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><div className="user"><span>{profile?.name}</span><button className="btn" onClick={logout}>Log out</button></div></header><main className="dash"><div className="dash-head"><div><h1>Your dashboard</h1><p>Create a meeting when you're ready. New meetings start completely empty.</p></div><button className="btn primary" onClick={create}>＋ Create Meeting</button></div>{meetings.length===0?<div className="empty"><h3>No meetings yet</h3><p>Your first workspace will contain no code and no collaborators until you add them.</p><button className="btn primary" onClick={create}>Create your first meeting</button></div>:<div className="meetings">{meetings.map(m=><div className="meeting-card" key={m.id}><h3>{m.name}</h3><p>Private collaborative workspace</p><div className="meeting-meta"><span>{new Date(m.created_at).toLocaleDateString()}</span><button className="btn" onClick={()=>open(m.id)}>Open</button></div></div>)}</div>}</main></div>}

function Meeting(p){return <div className="app meeting-app" onClick={()=>p.ctx&&p.closeCtx()}><header className="bar"><div className="user"><button className="btn" onClick={p.onLeave}>←</button><div><b>{p.meeting?.name}</b><div className="live">● LIVE</div></div></div><div className="user"><button className="btn" onClick={p.invite}>Invite</button><button className="btn" onClick={()=>p.setChatOpen(v=>!v)}>Chat</button><button className="btn" onClick={()=>alert('Settings will be connected after the core collaboration loop is verified.')}>Settings</button><button className="btn" onClick={()=>window.open('/tv/'+p.meeting?.id,'_blank')}>TV / Room</button></div></header><div className="work"><aside className="explorer" onContextMenu={e=>p.onContext(e,null)}><div className="explorer-head"><b>EXPLORER</b><button className="icon" onClick={p.createFile}>＋</button></div>{p.files.length===0?<div className="tree-empty">No files yet.<br/><br/>Right-click or use ＋ to create your first file.</div>:p.files.map(f=><div key={f.id} className={'file '+(f.id===p.active?.id?'active':'')} onClick={()=>p.onSelect(f)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();p.onContext(e,f.id)}}>◉ {f.name}</div>)}</aside><section className="editor"><div className="tabs">{p.active?<span className="tab active">{p.active.name} ×</span>:<span className="tab">No file open</span>}</div><div className="toolbar"><span>LANGUAGE</span><span className="pill">{p.active?.language||'plaintext'}</span><button className="run" onClick={p.run}>▶ Run</button></div>{p.active?<Editor value={p.content} onChange={p.onChange}/>:<div className="editor-empty">Create a file to start coding.</div>}</section><section className="preview"><div className="preview-head">LIVE PREVIEW</div>{p.preview?<iframe title="preview" srcDoc={p.preview} sandbox="allow-scripts allow-forms allow-modals"/>:<div className="preview-empty">Create an HTML file to see live output.<br/>Use &lt;link&gt; and &lt;script&gt; to connect local CSS and JS files.</div>}</section><aside className="team"><div className="team-title">TEAM · 1 <button className="icon">＋</button></div><div className="team-card">You</div><div className="team-note">Invite collaborators before anyone joins this workspace.</div></aside></div>{p.ctx&&<div className="context" style={{left:p.ctx.x,top:p.ctx.y}} onClick={e=>e.stopPropagation()}><button onClick={p.createFile}>New file</button><button onClick={()=>alert('Folders are the next storage feature.')}>New folder</button><button onClick={p.rename}>Rename</button><button onClick={p.duplicate}>Duplicate</button><button onClick={()=>navigator.clipboard?.writeText('/'+(p.active?.name||''))}>Copy path</button><button className="danger" onClick={p.del}>Delete</button></div>}{p.chatOpen&&<div className="chat"><div className="chat-head">Team Chat<button className="icon" onClick={()=>p.setChatOpen(false)}>×</button></div><div className="messages">{p.chat.map((m,i)=><div key={i}><b>{m.name}</b>{m.message}</div>)}</div><div className="chat-send"><input value={p.chatText} onChange={e=>p.setChatText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){p.sendChat();}}}/><button className="btn primary" onClick={p.sendChat}>Send</button></div></div>}{p.createOpen&&<Modal title="Create new file" close={()=>p.setCreateOpen(false)}><label>File name<input value={p.fileName} onChange={e=>p.setFileName(e.target.value)}/></label><label>Language<select value={p.fileLang} onChange={e=>p.setFileLang(e.target.value)}>{Object.entries(LANGS).map(([k,v])=><option key={k} value={k}>{v[0]} (.{v[1]})</option>)}</select></label><div className="modal-actions"><button className="btn" onClick={()=>p.setCreateOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doCreate}>Create</button></div></Modal>}{p.renameOpen&&<Modal title="Rename file" close={()=>p.setRenameOpen(false)}><label>New name<input value={p.rename} onChange={e=>p.setRename(e.target.value)}/></label><div className="modal-actions"><button className="btn" onClick={()=>p.setRenameOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doRename}>Rename</button></div></Modal>}{p.inviteOpen&&<Modal title="Invite collaborators" close={()=>p.setInviteOpen(false)}><p>Share this link with the people you want to join this meeting.</p><input value={p.inviteLink} readOnly/><div className="modal-actions"><button className="btn primary" onClick={p.copyInvite}>Copy link</button></div></Modal>}</div>}

function Editor({value,onChange}){return <textarea className="code" value={value} onChange={e=>onChange(e.target.value)} spellCheck="false"/>}
function Modal({title,close,children}){return <div className="modal" onClick={e=>{if(e.currentTarget===e.target)close()}}><div className="modal-card"><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</div></div>}
function Setup(){return <div className="setup"><div><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><h1>Supabase is not connected yet</h1><p>In Vercel, add these environment variables:</p><pre>VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY</pre></div></div>}

createRoot(document.getElementById('root')).render(<App/>);
