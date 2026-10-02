import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';
import './pro-theme.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const LANGS = {
  html:['HTML','html'], css:['CSS','css'], javascript:['JavaScript','js'], typescript:['TypeScript','ts'],
  python:['Python','py'], java:['Java','java'], c:['C','c'], cpp:['C++','cpp'], csharp:['C#','cs'], go:['Go','go'],
  rust:['Rust','rs'], php:['PHP','php'], ruby:['Ruby','rb'], swift:['Swift','swift'], kotlin:['Kotlin','kt'], dart:['Dart','dart'],
  sql:['SQL','sql'], json:['JSON','json'], yaml:['YAML','yaml'], markdown:['Markdown','md'], shell:['Shell','sh'], plaintext:['Plain Text','txt']
};

const FEATURES=[['Real-Time Collaboration','Everyone in the meeting edits the same files and sees changes instantly.','⚡'],['Live Preview & Output','HTML, CSS and JS render live as you type, for the whole team.','◐'],['TV / Room Mode','Put the live output on a TV while two people code side by side.','▣'],['Invite Links','Share one link and teammates join your workspace after signing in.','↗'],['Team Chat','Talk without leaving the editor.','✉'],['Video & Audio Meetings','Talk face to face while you code.','●',1],['Shared Terminal','Run commands together in one terminal.','>_',1],['Multiple Code Panels','Open extra panels to show your own code.','▦',1],['Branches','Try ideas safely and merge them back.','⑂',1],['AI Assistant','Get help with the code you are looking at.','✦',1]];
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
  const setToast=t=>window.dispatchEvent(new CustomEvent('ds-toast',{detail:t}));
  const [ctx,setCtx]=useState(null);
  const [preview,setPreview]=useState('');
  const [chat,setChat]=useState([]);
  const [chatText,setChatText]=useState('');
  const realtimeRef=useRef(null);
  const saveTimer=useRef(null);const filesRef=useRef([]);const activeRef=useRef(null);const [members,setMembers]=useState([]);
  filesRef.current=files;activeRef.current=activeId;const activeFile=useMemo(()=>files.find(f=>f.id===activeId)||null,[files,activeId]);
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
      const mt=location.pathname.match(/^\/(meeting|tv)\/([0-9a-f-]{36})/i);if(mt){const inv=new URLSearchParams(location.search).get('invite');if(inv){const {error}=await supabase.rpc('join_meeting_by_invite',{p_token:inv});if(error)note(error.message);}await openMeeting(mt[2]);if(mt[1]==='tv')setScreen('tv');else history.replaceState(null,'','/');}else setScreen('dashboard');
    })();
  },[session?.user?.id]);

  useEffect(()=>{ if((screen==='meeting'||screen==='tv') && meeting) subscribeMeeting(meeting.id); },[meeting?.id]);

  function note(text){setToast(text);window.clearTimeout(note.t);note.t=window.setTimeout(()=>setToast(''),2200)}
  async function loadMeetings(){const {data,error}=await supabase.from('meetings').select('*').order('created_at',{ascending:false});if(!error)setMeetings(data||[]);}
  async function authSubmit(e){e.preventDefault();setAuthError('');const fd=new FormData(e.currentTarget);const email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||''),name=String(fd.get('name')||'').trim();if(!email||!password)return setAuthError('Enter email and password.');let r;if(authMode==='register')r=await supabase.auth.signUp({email,password,options:{data:{name:name||email.split('@')[0]}}});else r=await supabase.auth.signInWithPassword({email,password});if(r.error)setAuthError(r.error.message);else{setAuthOpen(false);note(authMode==='register'?'Account created':'Signed in');}}
  async function logout(){await supabase.auth.signOut();setMeeting(null);setScreen('landing');}
  async function createMeeting(){const {data,error}=await supabase.rpc('create_meeting',{p_name:meetingName||'Untitled Meeting'});if(error)return note(error.message);setCreateOpen(false);setMeetingName('');await loadMeetings();await openMeeting(data);}
  async function openMeeting(id){const [{data:m,error:me},{data:f}]=await Promise.all([supabase.from('meetings').select('*').eq('id',id).single(),supabase.from('files').select('*').eq('meeting_id',id).order('created_at')]);if(me)return note(me.message);setMeeting(m);setFiles(f||[]);setActiveId(null);setContent('');renderPreview(null,'',f||[]);setScreen('meeting');}
  async function subscribeMeeting(id){await realtimeRef.current?.unsubscribe();const ch=supabase.channel('meeting:'+id,{config:{private:true,presence:{key:session.user.id},broadcast:{self:false}}});ch.on('broadcast',{event:'file-change'},({payload})=>{setFiles(old=>old.map(f=>f.id===payload.id?{...f,content:payload.content}:f));if(activeRef.current===payload.id)setContent(payload.content);renderPreview(payload.id,payload.content);}).on('broadcast',{event:'chat'},({payload})=>setChat(old=>[...old,payload])).on('broadcast',{event:'files'},async()=>{const {data:nf}=await supabase.from('files').select('*').eq('meeting_id',id).order('created_at');if(nf)setFiles(old=>nf.map(x=>x.id===activeRef.current?{...x,content:old.find(o=>o.id===x.id)?.content??x.content}:x))}).on('presence',{event:'sync'},()=>setMembers(Object.values(ch.presenceState()).map(a=>a[0]))).subscribe(async s=>{if(s==='SUBSCRIBED')await ch.track({id:session.user.id,name:userName});});realtimeRef.current=ch;}
  async function openFile(f){setActiveId(f.id);setContent(f.content||'');renderPreview(f.id,f.content||'');}
  async function updateContent(v){setContent(v);if(!activeFile)return;setFiles(old=>old.map(f=>f.id===activeFile.id?{...f,content:v}:f));renderPreview(activeFile.id,v);window.clearTimeout(saveTimer.current);saveTimer.current=window.setTimeout(async()=>{await supabase.from('files').update({content:v,updated_at:new Date().toISOString()}).eq('id',activeFile.id);await realtimeRef.current?.send({type:'broadcast',event:'file-change',payload:{id:activeFile.id,content:v}});},350);}
  async function createFile(){let n=fileName.trim().replace(/[\\/]/g,'');if(!n)return note('Enter a file name.');const ext=LANGS[fileLang][1];if(!n.toLowerCase().endsWith('.'+ext))n+='.'+ext;if(files.some(f=>f.name===n))return note('That file already exists.');const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:n,language:fileLang,content:'',path:'/',created_by:session.user.id}).select('*').single();if(error)return note(error.message);setFiles(old=>[...old,data]);setFileOpen(false);announce();await openFile(data);note(n+' created');}
  async function deleteFile(id){const f=files.find(x=>x.id===id);if(!f||!confirm(`Delete ${f.name}?`))return;const {error}=await supabase.from('files').delete().eq('id',id);if(error)return note(error.message);setFiles(old=>old.filter(x=>x.id!==id));announce();if(activeId===id){setActiveId(null);setContent('');setPreview('');}setCtx(null);}
  async function renameFile(){if(!ctx?.fileId)return;const f=files.find(x=>x.id===ctx.fileId);if(!f||!rename.trim())return;const lang=(Object.entries(LANGS).find(([,v])=>rename.toLowerCase().endsWith('.'+v[1]))||[])[0]||f.language;const {error}=await supabase.from('files').update({name:rename.trim(),language:lang,updated_at:new Date().toISOString()}).eq('id',f.id);if(error)return note(error.message);setFiles(old=>old.map(x=>x.id===f.id?{...x,name:rename.trim(),language:lang}:x));setRenameOpen(false);setCtx(null);announce();}
  async function duplicateFile(){if(!ctx?.fileId)return;const f=files.find(x=>x.id===ctx.fileId);if(!f)return;const dot=f.name.lastIndexOf('.');const base=dot>-1?f.name.slice(0,dot):f.name;const ext=dot>-1?f.name.slice(dot):'';const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:base+'-copy'+ext,language:f.language,content:f.content,path:'/',created_by:session.user.id}).select('*').single();if(!error&&data){setFiles(old=>[...old,data]);announce();}setCtx(null);}
  
  function renderPreview(changedId,changed,list){
    const all=(list||filesRef.current).map(f=>f.id===changedId?{...f,content:changed}:f);
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

  function announce(){realtimeRef.current?.send({type:'broadcast',event:'files',payload:{}})}
  async function uploadFiles(list){for(const file of list){const text=await file.text();const dot=file.name.lastIndexOf('.');const ext=dot>-1?file.name.slice(dot+1).toLowerCase():'';const lang=(Object.entries(LANGS).find(([,v])=>v[1]===ext)||['plaintext'])[0];if(filesRef.current.some(f=>f.name===file.name)){note(file.name+' already exists');continue;}const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:file.name,language:lang,content:text,path:'/',created_by:session.user.id}).select('*').single();if(error){note(error.message);continue;}setFiles(old=>[...old,data]);}announce();note('Upload complete');}
  async function deleteMeeting(m){if(!confirm(`Delete "${m.name}" and all its files?`))return;const {error}=await supabase.from('meetings').delete().eq('id',m.id);if(error)return note(error.message);await loadMeetings();note('Meeting deleted');}
  async function renameMeeting(m){const n=prompt('Rename meeting',m.name);if(!n||!n.trim())return;const {error}=await supabase.from('meetings').update({name:n.trim()}).eq('id',m.id);if(error)return note(error.message);await loadMeetings();}
  async function sendChat(){if(!chatText.trim())return;const payload={name:userName,message:chatText.trim()};setChat(old=>[...old,payload]);await realtimeRef.current?.send({type:'broadcast',event:'chat',payload});setChatText('');}
  const inviteLink=meeting?`${location.origin}/meeting/${meeting.id}?invite=${meeting.invite_token}`:'';

  if(!supabase)return <Setup/>;
  if(screen==='tv')return <div className="tv"><div className="tv-bar"><b>{meeting?.name}</b><span className="live">● LIVE</span></div>{preview?<iframe title="tv" srcDoc={preview} sandbox="allow-scripts allow-forms allow-modals"/>:<div className="preview-empty">Waiting for an HTML file…</div>}</div>;
  if(screen==='landing')return <Landing open={()=>setAuthOpen(true)} mode={authMode} setMode={m=>{setAuthMode(m);setAuthOpen(true)}} authOpen={authOpen} close={()=>setAuthOpen(false)} submit={authSubmit} error={authError}/>;
  if(screen==='dashboard')return <Dashboard profile={profile} meetings={meetings} create={()=>setCreateOpen(true)} open={openMeeting} logout={logout} del={deleteMeeting} ren={renameMeeting}/>;
  return <Meeting profile={profile} meeting={meeting} files={files} active={activeFile} content={content} onChange={updateContent} onSelect={openFile} createFile={()=>setFileOpen(true)} saved={()=>note('All changes saved')} upload={uploadFiles} members={members} run={()=>note('Web languages update in the live preview. Server execution will be added next.')} invite={()=>setInviteOpen(true)} inviteLink={inviteLink} copyInvite={async()=>{await navigator.clipboard?.writeText(inviteLink);note('Invite link copied')}} onLeave={()=>{setScreen('dashboard');setMeeting(null);setActiveId(null);realtimeRef.current?.unsubscribe()}} onContext={(e,id)=>{e.preventDefault();setCtx({x:e.clientX,y:e.clientY,fileId:id})}} ctx={ctx} closeCtx={()=>setCtx(null)} rename={()=>{const f=files.find(x=>x.id===ctx?.fileId);if(f){setRename(f.name);setRenameOpen(true)}}} duplicate={duplicateFile} del={()=>ctx?.fileId&&deleteFile(ctx.fileId)} chatOpen={chatOpen} setChatOpen={setChatOpen} chat={chat} chatText={chatText} setChatText={setChatText} sendChat={sendChat} preview={preview} createOpen={fileOpen} setCreateOpen={setFileOpen} fileName={fileName} setFileName={setFileName} fileLang={fileLang} setFileLang={setFileLang} doCreate={createFile} renameOpen={renameOpen} setRenameOpen={setRenameOpen} rename={rename} setRename={setRename} doRename={renameFile} inviteOpen={inviteOpen} setInviteOpen={setInviteOpen}/>;
}

function Landing(p){return <div><nav className="nav"><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><div className="navlinks"><a href="#features">Features</a><a href="#features">Pricing</a><a href="#features">Docs</a><a href="#features">Blog</a></div><div className="navactions"><button className="btn" onClick={()=>p.setMode('login')}>Log In</button><button className="btn primary" onClick={()=>p.setMode('register')}>Get Started Free</button></div></nav><section className="hero"><div><div className="eyebrow">● Build Together. In Real Time.</div><h1>The All-in-One<br/><span className="gradient">Collaborative Coding</span><br/>Workspace</h1><p>Code, chat, run, and build together — with real-time collaboration, meetings, live preview and a clean shared workspace.</p><div className="heroBtns"><button className="btn primary" onClick={()=>p.setMode('register')}>Start Building Free →</button><button className="btn" onClick={()=>document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}>▷ Explore</button></div></div><div className="hero-mock"><div className="mock-top"><b>DevSync</b><span>Project workspace</span><span className="live">● Live</span></div><div className="mock-body"><aside><b>Files</b><div>⌄ src</div><div className="indent">App.tsx</div><div className="indent">Preview.tsx</div><div>package.json</div></aside><div className="mock-code"><div className="mock-tabs">Home.tsx ×  Preview.tsx  + New</div><pre>{`const App = () => {
  return (
    <main>
      <h1>Build together.</h1>
      <Button />
    </main>
  );
}`}</pre></div><div className="mock-side"><div><b>LIVE PREVIEW</b><div className="fake">Your app. Your team.</div></div><div><b>TEAM CALL</b><div className="faces"><span>You</span><span>Sarah</span><span>Alex</span><span>Priya</span></div></div></div></div></div></section><section id="features" className="feature-section"><h2>Everything You Need to <span className="gradient">Build Together</span></h2><div className="feature-grid">{FEATURES.map(([t,d,ic,soon])=><div className="feature-card" key={t}><div className="feature-icon">{ic}</div><h3>{t}{soon&&<span className="soon">Soon</span>}</h3><p>{d}</p></div>)}</div></section>{p.authOpen&&<div className="modal"><form className="auth-card" onSubmit={p.submit}><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><h2>{p.mode==='login'?'Welcome back':'Create your account'}</h2>{p.mode==='register'&&<label>Name<input name="name"/></label>}<label>Email<input name="email" type="email" required/></label><label>Password<input name="password" type="password" minLength="6" required/></label>{p.error&&<div className="error">{p.error}</div>}<button className="btn primary full">{p.mode==='login'?'Sign In':'Create Account'}</button><button type="button" className="link" onClick={()=>p.setMode(p.mode==='login'?'register':'login')}>{p.mode==='login'?'Need an account? Create one':'Already have an account? Sign in'}</button><button type="button" className="link" onClick={p.close}>Cancel</button></form></div>}</div>}

function Dashboard({profile,meetings,create,open,logout,del,ren}){const [q,setQ]=useState('');const list=meetings.filter(m=>m.name.toLowerCase().includes(q.toLowerCase()));const copy=async m=>{await navigator.clipboard?.writeText(`${location.origin}/meeting/${m.id}?invite=${m.invite_token}`);window.dispatchEvent(new CustomEvent('ds-toast',{detail:'Invite link copied'}))};
return <div className="app"><header className="bar"><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><div className="user"><span>{profile?.name}</span><button className="btn" onClick={logout}>Log out</button></div></header><main className="dash"><div className="dash-head"><div><h1>Welcome back, {profile?.name?.split(' ')[0]||'developer'}</h1><p>{meetings.length} workspace{meetings.length===1?'':'s'}. Open one or start a new meeting.</p></div><button className="btn primary" onClick={create}>＋ Create Meeting</button></div>{meetings.length>0&&<input className="search" placeholder="Search meetings…" value={q} onChange={e=>setQ(e.target.value)}/>}{meetings.length===0?<div className="empty"><h3>No meetings yet</h3><p>Your first workspace will contain no code and no collaborators until you add them.</p><button className="btn primary" onClick={create}>Create your first meeting</button></div>:list.length===0?<div className="empty"><h3>No match</h3><p>Nothing is called "{q}".</p></div>:<div className="meetings">{list.map(m=><div className="meeting-card" key={m.id}><h3>{m.name}</h3><p>Created {new Date(m.created_at).toLocaleDateString()}</p><div className="meeting-meta"><span className="acts"><button className="icon" title="Copy invite link" onClick={()=>copy(m)}>↗</button><button className="icon" title="Rename" onClick={()=>ren(m)}>✎</button><button className="icon" title="Delete" onClick={()=>del(m)}>🗑</button></span><button className="btn" onClick={()=>open(m.id)}>Open</button></div></div>)}</div>}</main></div>}

const PAIRS={'(':')','[':']','{':'}','"':'"','`':'`'};
function Meeting(p){
  const [set,setSet]=useState(false),[pal,setPal]=useState(false),[pq,setPq]=useState(''),[out,setOut]=useState(false),[logs,setLogs]=useState([]);
  const [runDoc,setRunDoc]=useState(''),[runKey,setRunKey]=useState(0),[tabs,setTabs]=useState([]),[fq,setFq]=useState(''),[dev,setDev]=useState('100%'),[pk,setPk]=useState(0);
  const [cfg,setCfg]=useState(()=>{const d={fs:13,tab:2,pair:true};try{return {...d,...JSON.parse(localStorage.getItem('ds-set')||'{}')}}catch{return d}});
  const up=useRef(null);
  useEffect(()=>{try{localStorage.setItem('ds-set',JSON.stringify(cfg))}catch{}},[cfg]);
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPal(v=>!v);setPq('')}if(e.key==='Escape')setPal(false)};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[]);
  useEffect(()=>{const h=e=>{const d=e.data;if(d&&d.ds&&d.t!=='done')setLogs(l=>[...l,d])};window.addEventListener('message',h);return()=>window.removeEventListener('message',h)},[]);
  useEffect(()=>{if(p.active)setTabs(t=>t.includes(p.active.id)?t:[...t,p.active.id])},[p.active?.id]);
  const tabFiles=tabs.map(id=>p.files.find(f=>f.id===id)).filter(Boolean);
  const shown=p.files.filter(f=>f.name.toLowerCase().includes(fq.toLowerCase()));
  function closeTab(e,f){e.stopPropagation();const rest=tabFiles.filter(x=>x.id!==f.id);setTabs(rest.map(x=>x.id));if(p.active?.id===f.id&&rest.length)p.onSelect(rest[rest.length-1])}
  function doRun(){const f=p.active;if(!f)return;const code=p.content;setLogs([]);
    if(f.language==='html'||f.language==='css'){setPk(k=>k+1);return p.saved&&window.dispatchEvent(new CustomEvent('ds-toast',{detail:'Preview refreshed'}))}
    const boot=`const s=(t,a)=>parent.postMessage({ds:1,t,m:a.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ')},'*');`;
    if(f.language==='javascript'){setOut(true);setRunKey(k=>k+1);setRunDoc(`<script>${boot}['log','info','warn','error'].forEach(k=>console[k]=(...a)=>s(k,a));addEventListener('error',e=>s('error',[e.message]));try{(0,eval)(${JSON.stringify(code)})}catch(e){s('error',[e.message])}s('done',[])</`+`script>`)}
    else if(f.language==='python'){setOut(true);setLogs([{t:'info',m:'Loading Python runtime…'}]);setRunKey(k=>k+1);setRunDoc(`<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></`+`script><script>${boot}(async()=>{try{const py=await loadPyodide({stdout:t=>s('log',[t]),stderr:t=>s('error',[t])});await py.runPythonAsync(${JSON.stringify(code)})}catch(e){s('error',[e.message])}s('done',[])})()</`+`script>`)}
    else{setOut(true);setLogs([{t:'warn',m:`Running ${f.language} needs a server. HTML, CSS, JavaScript and Python run in the browser.`}])}}
  function format(){if(!p.active)return;let v=p.content;if(p.active.language==='json'){try{v=JSON.stringify(JSON.parse(v),null,cfg.tab)}catch(e){return window.dispatchEvent(new CustomEvent('ds-toast',{detail:'Invalid JSON: '+e.message}))}}else v=v.replace(/[ \t]+$/gm,'').replace(/\n*$/,'\n');p.onChange(v)}
  async function zip(){if(!p.files.length)return;const {default:JSZip}=await import('jszip');const z=new JSZip();p.files.forEach(f=>z.file(f.name,f.content||''));const b=await z.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(p.meeting?.name||'project')+'.zip';a.click()}
  function openTab(){if(!p.preview)return;const u=URL.createObjectURL(new Blob([p.preview],{type:'text/html'}));window.open(u,'_blank')}
  const cmds=[['New file','＋',p.createFile],['Upload files','⇪',()=>up.current?.click()],['Run code (Ctrl+Enter)','▶',doRun],['Format file','✎',format],['Invite collaborators','↗',p.invite],['Toggle chat','✉',()=>p.setChatOpen(v=>!v)],['Toggle output console','▤',()=>setOut(v=>!v)],['Clear console','␡',()=>setLogs([])],['Download all as ZIP','⬇',zip],['Open preview in new tab','⧉',openTab],['Editor settings','⚙',()=>setSet(true)],['Back to dashboard','←',p.onLeave],...p.files.map(f=>['Open '+f.name,'◉',()=>p.onSelect(f)])].filter(c=>c[0].toLowerCase().includes(pq.toLowerCase()));
  return <div className="app meeting-app" onClick={()=>p.ctx&&p.closeCtx()}><header className="bar"><div className="user"><button className="btn" onClick={p.onLeave}>←</button><div><b>{p.meeting?.name}</b><div className="live">● LIVE</div></div></div><div className="user"><button className="btn" onClick={()=>setPal(true)}>⌘K</button><button className="btn" onClick={p.invite}>Invite</button><button className="btn" onClick={()=>p.setChatOpen(v=>!v)}>Chat</button><button className="btn" onClick={()=>setSet(true)}>Settings</button><button className="btn" onClick={()=>window.open('/tv/'+p.meeting?.id,'_blank')}>TV / Room</button></div></header><div className="work"><aside className="explorer" onContextMenu={e=>p.onContext(e,null)}><div className="explorer-head"><b>EXPLORER</b><span><button className="icon" title="Upload files" onClick={()=>up.current?.click()}>⇪</button><button className="icon" title="New file" onClick={p.createFile}>＋</button></span></div><input ref={up} type="file" multiple hidden onChange={e=>{p.upload([...e.target.files]);e.target.value=''}}/><input className="search small" placeholder="Filter files…" value={fq} onChange={e=>setFq(e.target.value)}/>{p.files.length===0?<div className="tree-empty">No files yet.<br/><br/>Right-click or use ＋ to create your first file.</div>:shown.map(f=><div key={f.id} className={'file '+(f.id===p.active?.id?'active':'')} onClick={()=>p.onSelect(f)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();p.onContext(e,f.id)}}>◉ {f.name}</div>)}</aside><section className="editor"><div className="tabs">{tabFiles.length?tabFiles.map(f=><span key={f.id} className={'tab '+(f.id===p.active?.id?'active':'')} onClick={()=>p.onSelect(f)}>{f.name}{tabFiles.length>1&&<b className="x" onClick={e=>closeTab(e,f)}>×</b>}</span>):<span className="tab">No file open</span>}</div><div className="toolbar"><span>LANGUAGE</span><span className="pill">{p.active?.language||'plaintext'}</span><button className="pill fmt" onClick={format}>Format</button><button className="run" onClick={doRun}>▶ Run</button></div>{p.active?<Editor value={p.content} onChange={p.onChange} onSave={p.saved} onRun={doRun} fs={cfg.fs} tab={cfg.tab} pair={cfg.pair}/>:<div className="editor-empty">Create a file to start coding.</div>}</section><section className="preview"><div className="preview-head">LIVE PREVIEW<span className="devs">{[['▭','100%'],['▯','768px'],['▮','390px']].map(([i,w])=><button key={w} className={'icon '+(dev===w?'on':'')} onClick={()=>setDev(w)}>{i}</button>)}<button className="icon" title="Refresh" onClick={()=>setPk(k=>k+1)}>⟳</button><button className="icon" title="Open in new tab" onClick={openTab}>⧉</button><button className="icon" title="Console" onClick={()=>setOut(v=>!v)}>▤</button></span></div>{p.preview?<iframe key={pk} title="preview" srcDoc={p.preview} style={{width:dev,alignSelf:'center'}} sandbox="allow-scripts allow-forms allow-modals"/>:<div className="preview-empty">Create an HTML file to see live output.<br/>Use &lt;link&gt; and &lt;script&gt; to connect local CSS and JS files.</div>}{out&&<div className="console"><div className="console-head">OUTPUT<button className="icon" onClick={()=>setLogs([])}>Clear</button></div>{logs.length===0?<div className="log info">Press Run on a JavaScript or Python file.</div>:logs.map((l,i)=><div key={i} className={'log '+l.t}>{l.m}</div>)}</div>}</section><aside className="team"><div className="team-title">TEAM · {p.members.length||1} <button className="icon" onClick={p.invite}>＋</button></div>{(p.members.length?p.members:[{name:p.profile?.name||'You'}]).map((m,i)=><div className="team-card" key={m.id||i}><span className="avatar">{(m.name||'?')[0].toUpperCase()}</span>{m.name}</div>)}<div className="team-note">Invite collaborators before anyone joins this workspace.</div></aside></div>{p.ctx&&<div className="context" style={{left:p.ctx.x,top:p.ctx.y}} onClick={e=>e.stopPropagation()}><button onClick={p.createFile}>New file</button><button onClick={()=>alert('Folders are the next storage feature.')}>New folder</button><button onClick={p.rename}>Rename</button><button onClick={p.duplicate}>Duplicate</button><button onClick={()=>navigator.clipboard?.writeText('/'+(p.files.find(x=>x.id===p.ctx?.fileId)?.name||''))}>Copy path</button><button onClick={()=>{const f=p.files.find(x=>x.id===p.ctx.fileId);if(!f)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([f.content||''],{type:'text/plain'}));a.download=f.name;a.click();p.closeCtx();}}>Download</button><button className="danger" onClick={p.del}>Delete</button></div>}{p.chatOpen&&<div className="chat"><div className="chat-head">Team Chat<button className="icon" onClick={()=>p.setChatOpen(false)}>×</button></div><div className="messages">{p.chat.map((m,i)=><div key={i}><b>{m.name}</b>{m.message}</div>)}</div><div className="chat-send"><input value={p.chatText} onChange={e=>p.setChatText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){p.sendChat();}}}/><button className="btn primary" onClick={p.sendChat}>Send</button></div></div>}{p.createOpen&&<Modal title="Create new file" close={()=>p.setCreateOpen(false)}><label>File name<input value={p.fileName} onChange={e=>p.setFileName(e.target.value)}/></label><label>Language<select value={p.fileLang} onChange={e=>p.setFileLang(e.target.value)}>{Object.entries(LANGS).map(([k,v])=><option key={k} value={k}>{v[0]} (.{v[1]})</option>)}</select></label><div className="modal-actions"><button className="btn" onClick={()=>p.setCreateOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doCreate}>Create</button></div></Modal>}{p.renameOpen&&<Modal title="Rename file" close={()=>p.setRenameOpen(false)}><label>New name<input value={p.rename} onChange={e=>p.setRename(e.target.value)}/></label><div className="modal-actions"><button className="btn" onClick={()=>p.setRenameOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doRename}>Rename</button></div></Modal>}{runDoc&&<iframe key={runKey} title="runner" sandbox="allow-scripts" srcDoc={runDoc} style={{display:'none'}}/>}{pal&&<div className="modal pal" onClick={e=>{if(e.target===e.currentTarget)setPal(false)}}><div className="palette"><input autoFocus placeholder="Type a command or file name…" value={pq} onChange={e=>setPq(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&cmds[0]){setPal(false);cmds[0][2]()}}}/>{cmds.slice(0,9).map(([n,i,f])=><button key={n} onClick={()=>{setPal(false);f()}}><span>{i}</span>{n}</button>)}</div></div>}{set&&<Modal title="Editor settings" close={()=>setSet(false)}><label>Font size: {cfg.fs}px<input type="range" min="11" max="22" value={cfg.fs} onChange={e=>setCfg({...cfg,fs:+e.target.value})}/></label><label>Tab size<select value={cfg.tab} onChange={e=>setCfg({...cfg,tab:+e.target.value})}><option value="2">2 spaces</option><option value="4">4 spaces</option></select></label><label className="check"><input type="checkbox" checked={cfg.pair} onChange={e=>setCfg({...cfg,pair:e.target.checked})}/> Auto-close brackets and quotes</label><div className="modal-actions"><button className="btn primary" onClick={()=>setSet(false)}>Done</button></div></Modal>}{p.inviteOpen&&<Modal title="Invite collaborators" close={()=>p.setInviteOpen(false)}><p>Share this link with the people you want to join this meeting.</p><input value={p.inviteLink} readOnly/><div className="modal-actions"><button className="btn primary" onClick={p.copyInvite}>Copy link</button></div></Modal>}</div>}

function Editor({value,onChange,onSave,onRun,fs,tab,pair}){const gut=useRef(null);const [pos,setPos]=useState([1,1]);const n=value.split('\n').length;const st={font:`${fs}px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace`};
function cur(t){const b=t.value.slice(0,t.selectionStart).split('\n');setPos([b.length,b[b.length-1].length+1])}
function ins(t,txt,back=0){const a=t.selectionStart,b=t.selectionEnd;onChange(value.slice(0,a)+txt+value.slice(b));requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=a+txt.length-back;cur(t)})}
function key(e){const t=e.target,mod=e.ctrlKey||e.metaKey;
if(e.key==='Tab'){e.preventDefault();ins(t,' '.repeat(tab))}
else if(mod&&e.key==='s'){e.preventDefault();onSave()}
else if(mod&&e.key==='Enter'){e.preventDefault();onRun()}
else if(e.key==='Enter'&&!mod){const a=t.selectionStart,ls=value.lastIndexOf('\n',a-1)+1,ind=(value.slice(ls,a).match(/^\s*/)||[''])[0],ch=value[a-1],open=ch&&'{([:'.includes(ch);e.preventDefault();ins(t,'\n'+ind+(open?' '.repeat(tab):''))}
else if(pair&&PAIRS[e.key]&&!mod){e.preventDefault();ins(t,e.key+PAIRS[e.key],1)}}
return <><div className="code-wrap"><div className="gutter" style={st} ref={gut} aria-hidden="true">{Array.from({length:n},(_,i)=><div key={i}>{i+1}</div>)}</div><textarea className="code" style={st} value={value} onChange={e=>{onChange(e.target.value);cur(e.target)}} onKeyDown={key} onKeyUp={e=>cur(e.target)} onClick={e=>cur(e.target)} onScroll={e=>{gut.current.scrollTop=e.target.scrollTop}} spellCheck="false" wrap="off"/></div><div className="statusbar"><span>Ln {pos[0]}, Col {pos[1]}</span><span>{n} lines · {value.length} chars</span><span>Ctrl+Enter run · Ctrl+K commands</span></div></>}
function Toasts(){const [t,setT]=useState('');useEffect(()=>{let id;const h=e=>{setT(e.detail);clearTimeout(id);id=setTimeout(()=>setT(''),2400)};window.addEventListener('ds-toast',h);return()=>window.removeEventListener('ds-toast',h)},[]);return t?<div className="toast" role="status">{t}</div>:null}
function Modal({title,close,children}){return <div className="modal" onClick={e=>{if(e.currentTarget===e.target)close()}}><div className="modal-card"><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</div></div>}
function Setup(){return <div className="setup"><div><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><h1>Supabase is not connected yet</h1><p>In Vercel, add these environment variables:</p><pre>VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY</pre></div></div>}

createRoot(document.getElementById('root')).render(<><App/><Toasts/></>);
