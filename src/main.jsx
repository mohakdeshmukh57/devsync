import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { openCollaborativeFile } from './lib/collab';
import { CallRoom } from './lib/webrtc';
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

const TEXT_EXTENSIONS = new Set(Object.values(LANGS).map(([,ext]) => ext));
const DEFAULT_SETTINGS = { fs: 13, tab: 2, pair: true };
const PAIRS = {'(':')','[':']','{':'}','"':'"',"'":"'",'`':'`'};

const FEATURES=[
  ['Real-Time Collaboration','Edit the same file together with presence and shared cursors.','⚡'],
  ['Live Preview & Output','HTML, CSS and JavaScript render live in a sandboxed preview.','◐'],
  ['TV / Room Mode','Use a second screen for clean project output while you code.','▣'],
  ['Invite Links','Share one secure meeting link with your collaborators.','↗'],
  ['Team Chat','Discuss implementation without opening another app.','✉'],
  ['Video & Audio Meetings','Use the browser camera and microphone in the workspace.','●'],
  ['Shared Terminal','Run supported code and terminal commands through a sandboxed runner.','>_'],
  ['Multiple Code Panels','Split the editor to inspect two files at once.','▦'],
  ['Project Storage','Keep code in Postgres and binary assets in private Storage.','◫'],
  ['Command Palette','Jump to files and workspace commands with Ctrl/Cmd + K.','⌘'],
];

function App(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [screen,setScreen]=useState('landing');
  const [authMode,setAuthMode]=useState('login');
  const [authOpen,setAuthOpen]=useState(false);
  const [authError,setAuthError]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [meetings,setMeetings]=useState([]);
  const [meeting,setMeeting]=useState(null);
  const [files,setFiles]=useState([]);
  const [folders,setFolders]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [content,setContent]=useState('');
  const [createOpen,setCreateOpen]=useState(false);
  const [folderOpen,setFolderOpen]=useState(false);
  const [renameOpen,setRenameOpen]=useState(false);
  const [inviteOpen,setInviteOpen]=useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const [aiOpen,setAiOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [meetingName,setMeetingName]=useState('');
  const [fileName,setFileName]=useState('index');
  const [fileLang,setFileLang]=useState('html');
  const [folderName,setFolderName]=useState('');
  const [folderId,setFolderId]=useState(null);
  const [rename,setRename]=useState('');
  const [toast,setToast]=useState('');
  const [ctx,setCtx]=useState(null);
  const [preview,setPreview]=useState('');
  const [chat,setChat]=useState([]);
  const [chatText,setChatText]=useState('');
  const [members,setMembers]=useState([]);
  const [presenceMap,setPresenceMap]=useState({});
  const [split,setSplit]=useState(false);
  const [secondId,setSecondId]=useState(null);
  const [focusMode,setFocusMode]=useState(false);
  const [terminalOpen,setTerminalOpen]=useState(false);
  const [terminalInput,setTerminalInput]=useState('');
  const [terminalLines,setTerminalLines]=useState([{type:'info',text:'Shared terminal ready.'}]);
  const [aiPrompt,setAiPrompt]=useState('');
  const [aiResponse,setAiResponse]=useState('');
  const [aiBusy,setAiBusy]=useState(false);
  const [inviteLink,setInviteLink]=useState('');
  const [callPeers,setCallPeers]=useState([]);
  const [mediaReady,setMediaReady]=useState(false);
  const [micOn,setMicOn]=useState(true);
  const [cameraOn,setCameraOn]=useState(true);
  const [screenSharing,setScreenSharing]=useState(false);
  const [previewWidth,setPreviewWidth]=useState('100%');
  const [previewKey,setPreviewKey]=useState(0);
  const [consoleLogs,setConsoleLogs]=useState([]);
  const [runDoc,setRunDoc]=useState('');
  const [runKey,setRunKey]=useState(0);
  const [globalBusy,setGlobalBusy]=useState(false);
  const [settings,setSettings]=useState(()=>{try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('ds-settings')||'{}')}}catch{return DEFAULT_SETTINGS}});

  const realtimeRef=useRef(null);
  const callRef=useRef(null);
  const mediaRef=useRef(null);
  const cameraTrackRef=useRef(null);
  const fileCleanupRef=useRef(null);
  const collabRef=useRef(null);
  const saveTimerRef=useRef(null);
  const filesRef=useRef([]);
  const activeRef=useRef(null);
  const localVideoRef=useRef(null);
  const currentTV=location.pathname.startsWith('/tv/');
  const activeFile=useMemo(()=>files.find(f=>f.id===activeId)||null,[files,activeId]);
  const secondFile=useMemo(()=>files.find(f=>f.id===secondId)||null,[files,secondId]);
  const userName=profile?.name || session?.user_metadata?.name || session?.email?.split('@')[0] || 'Developer';

  filesRef.current=files;
  activeRef.current=activeId;

  useEffect(()=>{localStorage.setItem('ds-settings',JSON.stringify(settings));},[settings]);

  useEffect(()=>{
    if(!supabase){showToast('Supabase variables are missing in Vercel.');return;}
    let mounted=true;
    supabase.auth.getSession().then(({data})=>{if(mounted)setSession(data.session);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);if(!s){setProfile(null);setMeeting(null);setScreen('landing');}});
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!session||!supabase)return;
    (async()=>{
      let {data:p}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
      if(!p){
        await supabase.from('profiles').upsert({id:session.user.id,name:session.user.user_metadata?.name||session.user.email?.split('@')[0]||'Developer'});
        ({data:p}=await supabase.from('profiles').select('*').eq('id',session.user.id).single());
      }
      setProfile(p||null);
      await loadMeetings();
      const mt=location.pathname.match(/^\/(meeting|tv)\/([0-9a-f-]{36})/i);
      if(mt){
        const inv=new URLSearchParams(location.search).get('invite');
        if(inv){const {error}=await supabase.rpc('join_meeting_by_invite',{p_token:inv});if(error)showToast(error.message);}
        await openMeeting(mt[2],mt[1]==='tv');
      } else setScreen('dashboard');
    })();
  },[session?.user?.id]);

  useEffect(()=>()=>{void cleanupMeeting()},[]);

  function showToast(text){
    setToast(text);
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>setToast(''),2400);
  }

  async function loadMeetings(){
    if(!supabase)return;
    const {data,error}=await supabase.from('meetings').select('*').order('created_at',{ascending:false});
    if(error)showToast(error.message);else setMeetings(data||[]);
  }

  async function authSubmit(e){
    e.preventDefault();
    if(!supabase)return;
    setAuthError('');setAuthBusy(true);
    const fd=new FormData(e.currentTarget);
    const email=String(fd.get('email')||'').trim();
    const password=String(fd.get('password')||'');
    const name=String(fd.get('name')||'').trim();
    if(!email||!password){setAuthError('Enter email and password.');setAuthBusy(false);return;}
    let r;
    if(authMode==='register') r=await supabase.auth.signUp({email,password,options:{data:{name:name||email.split('@')[0]}}});
    else r=await supabase.auth.signInWithPassword({email,password});
    if(r.error){setAuthError(r.error.message);setAuthBusy(false);return;}
    setAuthOpen(false);setAuthBusy(false);showToast(authMode==='register'?'Account created successfully':'Welcome back');
  }

  async function logout(){
    setGlobalBusy(true);showToast('Signing you out…');
    await new Promise(r=>setTimeout(r,250));
    await cleanupMeeting();
    await supabase?.auth.signOut();
    setMeeting(null);setFiles([]);setFolders([]);setActiveId(null);setScreen('landing');setGlobalBusy(false);
  }

  async function createMeeting(){
    if(!meetingName.trim()) return showToast('Give your meeting a name first.');
    setGlobalBusy(true);
    const {data,error}=await supabase.rpc('create_meeting',{p_name:meetingName.trim()});
    if(error){setGlobalBusy(false);return showToast(error.message);}
    setCreateOpen(false);setMeetingName('');await loadMeetings();await openMeeting(data,false);setGlobalBusy(false);
  }

  async function openMeeting(id,isTV=false){
    if(!supabase)return;
    setGlobalBusy(true);
    const [{data:m,error:me},{data:f},{data:fo}]=await Promise.all([
      supabase.from('meetings').select('*').eq('id',id).single(),
      supabase.from('files').select('*').eq('meeting_id',id).order('created_at'),
      supabase.from('folders').select('*').eq('meeting_id',id).order('created_at')
    ]);
    if(me){setGlobalBusy(false);return showToast(me.message);}
    setMeeting(m);setFiles(f||[]);setFolders(fo||[]);setActiveId(null);setContent('');setPreview('');setChat([]);setConsoleLogs([]);setTerminalLines([{type:'info',text:'Shared terminal ready.'}]);
    setScreen(isTV?'tv':'meeting');
    await subscribeMeeting(m.id);
    if(!isTV) await startCall(m.id);
    setGlobalBusy(false);
  }

  async function subscribeMeeting(id){
    await realtimeRef.current?.unsubscribe();
    const ch=supabase.channel('meeting:'+id,{config:{private:true,presence:{key:session.user.id},broadcast:{self:false}}});
    ch.on('broadcast',{event:'chat'},({payload})=>setChat(old=>[...old,payload]))
      .on('broadcast',{event:'activity'},({payload})=>showToast(payload.message))
      .on('broadcast',{event:'file-change'},({payload})=>{
        setFiles(old=>old.map(f=>f.id===payload.id?{...f,content:payload.content,updated_at:new Date().toISOString()}:f));
        if(activeRef.current===payload.id)setContent(payload.content);
        updatePreview(payload.id,payload.content);
      })
      .on('broadcast',{event:'files-refresh'},()=>refreshMeetingData(id))
      .on('broadcast',{event:'focus'},({payload})=>showToast(`${payload.name} focused ${payload.fileName}`))
      .on('presence',{event:'sync'},()=>syncPresence(ch))
      .on('presence',{event:'join'},()=>syncPresence(ch))
      .on('presence',{event:'leave'},()=>syncPresence(ch))
      .subscribe(async status=>{if(status==='SUBSCRIBED')await ch.track({id:session.user.id,name:userName,activeFile:null});});
    realtimeRef.current=ch;
  }

  async function syncPresence(ch){
    const state=ch.presenceState();
    const list=[];const map={};
    Object.entries(state).forEach(([key,val])=>{const p=val?.[0]||{};list.push(p);map[key]=p;});
    setMembers(list);setPresenceMap(map);
  }

  async function refreshMeetingData(id){
    const [{data:f},{data:fo}]=await Promise.all([
      supabase.from('files').select('*').eq('meeting_id',id).order('created_at'),
      supabase.from('folders').select('*').eq('meeting_id',id).order('created_at')
    ]);
    if(f)setFiles(old=>f.map(x=>x.id===activeRef.current?{...x,content:old.find(o=>o.id===x.id)?.content??x.content}:x));
    if(fo)setFolders(fo);
  }

  async function startCall(id){
    if(!navigator.mediaDevices?.getUserMedia){showToast('This browser does not expose camera and microphone access.');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
      mediaRef.current=stream;
      cameraTrackRef.current=stream.getVideoTracks()[0]||null;
      setMediaReady(true);
      setMicOn(stream.getAudioTracks()[0]?.enabled!==false);setCameraOn(stream.getVideoTracks()[0]?.enabled!==false);
      if(localVideoRef.current)localVideoRef.current.srcObject=stream;
      const room=new CallRoom({supabase,topic:'call:'+id,userId:session.user.id,userName,onPeers:setCallPeers});
      await room.start(stream);callRef.current=room;
    }catch(error){setMediaReady(false);showToast('Camera/microphone permission was not granted. You can still collaborate.');}
  }

  async function cleanupMeeting(){
    fileCleanupRef.current?.dispose?.();fileCleanupRef.current?.();fileCleanupRef.current=null;
    collabRef.current=null;
    clearTimeout(saveTimer.current);
    await callRef.current?.stop();callRef.current=null;
    mediaRef.current?.getTracks().forEach(t=>t.stop());mediaRef.current=null;
    cameraTrackRef.current=null;setMediaReady(false);setCallPeers([]);
    await realtimeRef.current?.unsubscribe();realtimeRef.current=null;
  }

  function leaveMeeting(){
    void cleanupMeeting();setMeeting(null);setFiles([]);setFolders([]);setActiveId(null);setSecondId(null);setContent('');setPreview('');setScreen('dashboard');
    void loadMeetings();history.replaceState(null,'','/');
  }

  async function openFile(f){
    setActiveId(f.id);setContent(f.content||'');setTerminalOpen(false);setConsoleLogs([]);updatePreview(f.id,f.content||'');
    fileCleanupRef.current?.dispose?.();fileCleanupRef.current?.();fileCleanupRef.current=null;
    collabRef.current=null;
    if(!supabase)return;
    fileCleanupRef.current=await openCollaborativeFile({
      supabase,fileId:f.id,initialContent:f.content||'',
      onChange:v=>{setContent(v);setFiles(old=>old.map(x=>x.id===f.id?{...x,content:v}:x));updatePreview(f.id,v);},
      persist:async v=>{await supabase.from('files').update({content:v,updated_at:new Date().toISOString()}).eq('id',f.id);}
    });
    collabRef.current=collab;
    fileCleanupRef.current=collab.dispose;
    await realtimeRef.current?.track({id:session.user.id,name:userName,activeFile:f.id});
    await realtimeRef.current?.send({type:'broadcast',event:'focus',payload:{name:userName,fileName:f.name}});
  }

  async function updateContent(v){
    setContent(v);
    if(!activeFile)return;
    setFiles(old=>old.map(f=>f.id===activeFile.id?{...f,content:v}:f));
    updatePreview(activeFile.id,v);
    if(collabRef.current?.setText){
      collabRef.current.setText(v);
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      await supabase.from('files').update({content:v,updated_at:new Date().toISOString()}).eq('id',activeFile.id);
    },600);
  }

  async function createFile(){
    let n=fileName.trim().replace(/[\\/]/g,'');
    if(!n)return showToast('Enter a file name.');
    const ext=LANGS[fileLang][1];
    if(!n.toLowerCase().endsWith('.'+ext))n+='.'+ext;
    if(files.some(f=>f.name===n&&String(f.folder_id||'')===String(folderId||'')))return showToast('That file already exists in this folder.');
    const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:n,language:fileLang,content:'',path:'/',folder_id:folderId||null,created_by:session.user.id}).select('*').single();
    if(error)return showToast(error.message);
    setFiles(old=>[...old,data]);setFileOpen(false);setFileName('index');await openFile(data);await refreshAndAnnounce();showToast(n+' created');
  }

  async function createFolder(){
    const n=folderName.trim();if(!n)return showToast('Enter a folder name.');
    const {data,error}=await supabase.from('folders').insert({meeting_id:meeting.id,name:n,parent_id:null,created_by:session.user.id}).select('*').single();
    if(error)return showToast(error.message);setFolders(old=>[...old,data]);setFolderOpen(false);setFolderName('');await refreshAndAnnounce();showToast(n+' created');
  }

  async function deleteFolder(folderIdToDelete){
    const folder=folders.find(x=>x.id===folderIdToDelete);if(!folder)return;
    if(!confirm(`Delete folder "${folder.name}" and its files?`))return;
    const {error}=await supabase.from('folders').delete().eq('id',folderIdToDelete);
    if(error)return showToast(error.message);
    await refreshAndAnnounce();
    if(folders.some(f=>f.id===folderIdToDelete))setFolders(old=>old.filter(f=>f.id!==folderIdToDelete));
  }

  async function deleteFile(id){
    const f=files.find(x=>x.id===id);if(!f||!confirm(`Delete ${f.name}?`))return;
    const {error}=await supabase.from('files').delete().eq('id',id);if(error)return showToast(error.message);
    setFiles(old=>old.filter(x=>x.id!==id));
    if(activeId===id){setActiveId(null);setContent('');setPreview('');}
    setCtx(null);await refreshAndAnnounce();
  }

  async function renameFile(){
    if(!ctx?.fileId)return;const f=files.find(x=>x.id===ctx.fileId);if(!f)return;
    const n=rename.trim();if(!n)return showToast('Enter a new name.');
    const lang=Object.entries(LANGS).find(([,v])=>n.toLowerCase().endsWith('.'+v[1]))?.[0]||f.language;
    const {error}=await supabase.from('files').update({name:n,language:lang,updated_at:new Date().toISOString()}).eq('id',f.id);
    if(error)return showToast(error.message);
    setFiles(old=>old.map(x=>x.id===f.id?{...x,name:n,language:lang}:x));setRenameOpen(false);setCtx(null);await refreshAndAnnounce();
  }

  async function duplicateFile(){
    const f=files.find(x=>x.id===ctx?.fileId);if(!f)return;
    const dot=f.name.lastIndexOf('.');const base=dot>-1?f.name.slice(0,dot):f.name;const ext=dot>-1?f.name.slice(dot):'';
    let n=base+'-copy'+ext;let i=2;while(files.some(x=>x.name===n&&String(x.folder_id||'')===String(f.folder_id||''))){n=base+'-copy-'+i+ext;i++;}
    const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:n,language:f.language,content:f.content,path:f.path||'/',folder_id:f.folder_id||null,created_by:session.user.id}).select('*').single();
    if(error)return showToast(error.message);setFiles(old=>[...old,data]);setCtx(null);await refreshAndAnnounce();showToast(n+' created');
  }

  async function uploadFiles(list){
    for(const file of list){
      const dot=file.name.lastIndexOf('.');const ext=dot>-1?file.name.slice(dot+1).toLowerCase():'';
      if(TEXT_EXTENSIONS.has(ext)){
        const text=await file.text();
        const lang=Object.entries(LANGS).find(([,v])=>v[1]===ext)?.[0]||'plaintext';
        if(filesRef.current.some(f=>f.name===file.name))continue;
        const {data,error}=await supabase.from('files').insert({meeting_id:meeting.id,name:file.name,language:lang,content:text,path:'/',folder_id:folderId||null,created_by:session.user.id}).select('*').single();
        if(!error&&data)setFiles(old=>[...old,data]);
        continue;
      }
      const objectPath=`${meeting.id}/${crypto.randomUUID()}-${file.name}`;
      const {error}=await supabase.storage.from('project-assets').upload(objectPath,file,{upsert:false,contentType:file.type||'application/octet-stream'});
      if(error)showToast(`${file.name}: ${error.message}`);else showToast(`${file.name} uploaded to project storage`);
    }
    await refreshAndAnnounce();
  }

  async function refreshAndAnnounce(){
    await realtimeRef.current?.send({type:'broadcast',event:'files-refresh',payload:{}});
  }

  function updatePreview(changedId,changed){
    const all=filesRef.current.map(f=>f.id===changedId?{...f,content:changed}:f);
    const html=all.find(f=>f.language==='html');
    if(!html){setPreview('');return;}
    let doc=html.content||'';
    all.filter(x=>x.language==='css').forEach(f=>{
      const n=f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const tag=`<style data-devsync="${escapeHtml(f.name)}">${f.content||''}</style>`;
      const re=new RegExp(`<link[^>]*href=["']${n}["'][^>]*>`,'i');
      doc=re.test(doc)?doc.replace(re,tag):doc.replace(/<\/head>/i,tag+'</head>');
    });
    all.filter(x=>x.language==='javascript').forEach(f=>{
      const n=f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const safe=(f.content||'').replace(/<\/script>/gi,'<\\/script>');
      const tag=`<script data-devsync="${escapeHtml(f.name)}">${safe}</script>`;
      const re=new RegExp(`<script[^>]*src=["']${n}["'][^>]*><\\/script>`,'i');
      doc=re.test(doc)?doc.replace(re,tag):doc.replace(/<\/body>/i,tag+'</body>');
    });
    setPreview(doc);
  }

  async function sendChat(){
    if(!chatText.trim())return;
    const payload={name:userName,message:chatText.trim()};
    setChat(old=>[...old,payload]);await realtimeRef.current?.send({type:'broadcast',event:'chat',payload});setChatText('');
  }

  async function toggleMedia(kind){
    const track=kind==='audio'?mediaRef.current?.getAudioTracks()[0]:mediaRef.current?.getVideoTracks()[0];if(!track)return;
    track.enabled=!track.enabled;
    if(kind==='audio')setMicOn(track.enabled);else setCameraOn(track.enabled);
  }

  async function toggleScreenShare(){
    if(!mediaRef.current||!callRef.current)return;
    if(screenSharing){
      const camera=cameraTrackRef.current;
      if(camera){callRef.current.replaceVideoTrack(camera);mediaRef.current.getVideoTracks().forEach(t=>{if(t!==camera&&t.kind==='video'){t.stop();mediaRef.current.removeTrack(t);}});if(!mediaRef.current.getVideoTracks().includes(camera))mediaRef.current.addTrack(camera);}
      if(localVideoRef.current)localVideoRef.current.srcObject=mediaRef.current;setScreenSharing(false);return;
    }
    try{
      const display=await navigator.mediaDevices.getDisplayMedia({video:true});
      const screenTrack=display.getVideoTracks()[0];
      callRef.current.replaceVideoTrack(screenTrack);
      if(localVideoRef.current)localVideoRef.current.srcObject=new MediaStream([screenTrack,...mediaRef.current.getAudioTracks()]);
      screenTrack.onended=()=>{void stopScreenShare()};
      setScreenSharing(true);
    }catch{showToast('Screen sharing cancelled.');}
  }

  async function stopScreenShare(){
    const camera=cameraTrackRef.current;
    if(camera&&callRef.current)callRef.current.replaceVideoTrack(camera);
    if(localVideoRef.current&&mediaRef.current)localVideoRef.current.srcObject=mediaRef.current;
    setScreenSharing(false);
  }

  async function updateSecondary(file,v){
    setFiles(old=>old.map(x=>x.id===file.id?{...x,content:v}:x));
    const {error}=await supabase.from('files').update({content:v,updated_at:new Date().toISOString()}).eq('id',file.id);
    if(!error) await realtimeRef.current?.send({type:'broadcast',event:'file-change',payload:{id:file.id,content:v}});
    updatePreview(file.id,v);
  }

  function formatActive(){
    if(!activeFile)return;
    let v=content;
    if(activeFile.language==='json'){
      try{v=JSON.stringify(JSON.parse(v),null,settings.tab)}catch(e){return showToast('Invalid JSON: '+e.message)}
    }else v=v.replace(/[ \t]+$/gm,'').replace(/\n*$/,'\n');
    updateContent(v);
  }

  async function runActiveFile(){
    const f=activeFile;if(!f)return;
    setTerminalOpen(true);setConsoleLogs([]);
    if(f.language==='html'||f.language==='css'){setPreviewKey(v=>v+1);showToast('Preview refreshed');return;}
    if(f.language==='javascript'){
      setRunDoc(`<script>(function(){const send=(t,args)=>parent.postMessage({ds:1,t,m:args.map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join(' ')},'*');['log','info','warn','error'].forEach(k=>console[k]=(...a)=>send(k,a));addEventListener('error',e=>send('error',[e.message]));try{(0,eval)(${JSON.stringify(f.content||'')})}catch(e){send('error',[e.message])}send('done',[])})()</script>`);setRunKey(v=>v+1);return;
    }
    if(f.language==='python'){
      setRunDoc(`<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script><script>(async()=>{const send=(t,a)=>parent.postMessage({ds:1,t,m:a},'*');try{const py=await loadPyodide({stdout:v=>send('log',[v]),stderr:v=>send('error',[v])});await py.runPythonAsync(${JSON.stringify(f.content||'')})}catch(e){send('error',[e.message])}send('done',[])})()</script>`);setRunKey(v=>v+1);return;
    }
    try{
      const res=await fetch('/api/run-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:f.language,code:f.content||'',stdin:''})});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'Execution failed');
      setConsoleLogs([{type:body.stderr?'error':'log',m:body.stderr||body.stdout||body.output||'Finished successfully.'}]);
    }catch(error){setConsoleLogs([{type:'error',m:error.message}]);}
  }

  async function runTerminalCommand(){
    const cmd=terminalInput.trim();if(!cmd)return;
    setTerminalLines(old=>[...old,{type:'cmd',text:`$ ${cmd}`}]);setTerminalInput('');
    try{
      const res=await fetch('/api/run-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'shell',code:cmd,stdin:''})});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'Runner unavailable');
      setTerminalLines(old=>[...old,{type:body.stderr?'error':'out',text:body.stderr||body.stdout||'(no output)'}]);
    }catch(error){setTerminalLines(old=>[...old,{type:'error',text:error.message}]);}
  }

  async function aiAsk(){
    if(!aiPrompt.trim()||!activeFile)return;
    setAiBusy(true);setAiResponse('');
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:aiPrompt,file:{name:activeFile.name,language:activeFile.language,content:content.slice(0,12000)}})});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'AI assistant is not configured.');
      setAiResponse(body.text||body.output||'');
    }catch(error){setAiResponse(error.message);}
    finally{setAiBusy(false);}
  }

  async function copyInvite(){await navigator.clipboard?.writeText(inviteLink);showToast('Invite link copied');}

  async function downloadProject(){
    if(!files.length)return showToast('There are no files to download.');
    const zip=new JSZip();
    files.forEach(f=>zip.file(f.name,f.content||''));
    const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(meeting?.name||'devsync-project')+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }

  if(!supabase)return <Setup/>;
  if(currentTV && meeting && screen==='tv')return <TVScreen meeting={meeting} preview={preview} onRefresh={()=>setPreviewKey(k=>k+1)} />;
  if(screen==='landing')return <Landing mode={authMode} setMode={setAuthMode} authOpen={authOpen} setAuthOpen={setAuthOpen} submit={authSubmit} error={authError} busy={authBusy}/>;
  if(screen==='dashboard')return <Dashboard profile={profile} meetings={meetings} create={()=>setCreateOpen(true)} open={openMeeting} logout={logout} del={deleteMeeting} ren={renameMeeting} createOpen={createOpen} setCreateOpen={setCreateOpen} meetingName={meetingName} setMeetingName={setMeetingName} doCreateMeeting={createMeeting} />;

  const inviteLinkForMeeting=meeting?`${location.origin}/meeting/${meeting.id}?invite=${meeting.invite_token}`:'';

  return <Meeting
    profile={profile} meeting={meeting} files={files} folders={folders} active={activeFile} second={secondFile}
    sessionUserId={session.user.id} content={content} setContent={updateContent} openFile={openFile} onSecondaryChange={updateSecondary} refreshSaved={()=>showToast('All changes saved')} formatActive={formatActive} createFile={()=>{setFileOpen(true);setFileName('index');setFileLang('html');}}
    createFolder={()=>setFolderOpen(true)} deleteFolder={deleteFolder} upload={uploadFiles}
    ctx={ctx} setCtx={setCtx} renameOpen={renameOpen} setRenameOpen={setRenameOpen} rename={rename} setRename={setRename} doRename={renameFile}
    del={()=>ctx?.fileId&&deleteFile(ctx.fileId)} duplicate={duplicateFile}
    inviteOpen={inviteOpen} setInviteOpen={setInviteOpen} inviteLink={inviteLinkForMeeting} copyInvite={copyInvite}
    chatOpen={chatOpen} setChatOpen={setChatOpen} chat={chat} chatText={chatText} setChatText={setChatText} sendChat={sendChat}
    terminalOpen={terminalOpen} setTerminalOpen={setTerminalOpen} terminalInput={terminalInput} setTerminalInput={setTerminalInput} terminalLines={terminalLines} runTerminal={runTerminalCommand}
    aiOpen={aiOpen} setAiOpen={setAiOpen} aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} aiResponse={aiResponse} aiBusy={aiBusy} aiAsk={aiAsk}
    split={split} setSplit={setSplit} secondId={secondId} setSecondId={setSecondId} focusMode={focusMode} setFocusMode={setFocusMode}
    settings={settings} setSettings={setSettings} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} setConsoleLogs={setConsoleLogs} setPreviewKey={setPreviewKey} setAiOpen={setAiOpen} setTerminalOpen={setTerminalOpen} setSplit={setSplit}
    preview={preview} previewWidth={previewWidth} setPreviewWidth={setPreviewWidth} previewKey={previewKey} setPreviewKey={setPreviewKey} runDoc={runDoc} runKey={runKey}
    consoleLogs={consoleLogs} runDoc={runDoc} runKey={runKey} runActiveFile={runActiveFile}
    members={members} presenceMap={presenceMap} callPeers={callPeers} mediaReady={mediaReady} localVideoRef={localVideoRef}
    micOn={micOn} cameraOn={cameraOn} screenSharing={screenSharing} toggleMic={()=>toggleMedia('audio')} toggleCamera={()=>toggleMedia('video')} toggleScreen={toggleScreenShare}
    downloadProject={downloadProject} onLeave={leaveMeeting} onInvite={()=>setInviteOpen(true)} onTV={()=>window.open('/tv/'+meeting.id,'_blank','noopener,noreferrer')} onSettings={()=>setSettingsOpen(true)}
    createOpen={createOpen} setCreateOpen={setCreateOpen} meetingName={meetingName} setMeetingName={setMeetingName} doCreateMeeting={createMeeting}
    fileOpen={fileOpen} setFileOpen={setFileOpen} fileName={fileName} setFileName={setFileName} fileLang={fileLang} setFileLang={setFileLang} folderId={folderId} setFolderId={setFolderId} doCreateFile={createFile}
    folderOpen={folderOpen} setFolderOpen={setFolderOpen} folderName={folderName} setFolderName={setFolderName} doCreateFolder={createFolder}
  />;

  async function deleteMeeting(m){
    if(!confirm(`Delete "${m.name}" and all its files?`))return;
    const {error}=await supabase.from('meetings').delete().eq('id',m.id);if(error)return showToast(error.message);await loadMeetings();showToast('Meeting deleted');
  }

  async function renameMeeting(m){
    const n=prompt('Rename meeting',m.name);if(!n||!n.trim())return;
    const {error}=await supabase.from('meetings').update({name:n.trim()}).eq('id',m.id);if(error)return showToast(error.message);await loadMeetings();
  }
}

function Landing({mode,setMode,authOpen,setAuthOpen,submit,error,busy}){
  return <div className="landing-page">
    <nav className="nav">
      <div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div>
      <div className="navlinks"><a href="#features">Features</a><a href="#features">Workspace</a><a href="#features">Docs</a><a href="#features">About</a></div>
      <div className="navactions"><button className="btn" onClick={()=>{setMode('login');setAuthOpen(true)}}>Log In</button><button className="btn primary" onClick={()=>{setMode('register');setAuthOpen(true)}}>Get Started Free</button></div>
    </nav>
    <section className="hero">
      <div>
        <div className="eyebrow">● Build together. In real time.</div>
        <h1>The collaborative workspace for <span className="gradient">people who build.</span></h1>
        <p>Code together, talk together, preview together and keep the whole project in one place. DevSync is designed for startup teams, students and developers working from anywhere — or from the same room.</p>
        <div className="heroBtns"><button className="btn primary" onClick={()=>{setMode('register');setAuthOpen(true)}}>Start Building Free →</button><button className="btn" onClick={()=>document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}>Explore workspace</button></div>
      </div>
      <HeroWorkspace />
    </section>
    <section id="features" className="feature-section"><h2>Everything you need to <span className="gradient">build together</span></h2><div className="feature-grid">{FEATURES.map(([t,d,ic])=><div className="feature-card" key={t}><div className="feature-icon">{ic}</div><h3>{t}</h3><p>{d}</p></div>)}</div></section>
    {authOpen&&<div className="modal auth-modal"><form className="auth-card" onSubmit={submit}><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><h2>{mode==='login'?'Welcome back':'Create your account'}</h2><p>{mode==='login'?'Sign in to your workspace.':'Start with an empty workspace and invite your team when you are ready.'}</p>{mode==='register'&&<label>Name<input name="name" autoComplete="name"/></label>}<label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" minLength="6" required autoComplete={mode==='login'?'current-password':'new-password'}/></label>{error&&<div className="error">{error}</div>}<button className="btn primary full" disabled={busy}>{busy?'Working…':mode==='login'?'Sign In':'Create Account'}</button><button type="button" className="link" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Need an account? Create one':'Already have an account? Sign in'}</button><button type="button" className="link" onClick={()=>setAuthOpen(false)}>Cancel</button></form></div>}
  </div>
}

function HeroWorkspace(){
  return <div className="hero-mock">
    <div className="mock-top"><b>DevSync</b><span>Project workspace</span><span className="live">● Live</span></div>
    <div className="mock-body">
      <aside><b>Files</b><div>⌄ src</div><div className="indent">⌄ components</div><div className="indent">CodeEditor.tsx</div><div className="indent">Preview.tsx</div><div>package.json</div></aside>
      <div className="mock-code"><div className="mock-tabs">Home.tsx ×&nbsp;&nbsp; CodeEditor.tsx &nbsp;&nbsp; + New</div><pre>{`const Home = () => {
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
}

function Dashboard({profile,meetings,create,open,logout,del,ren,createOpen,setCreateOpen,meetingName,setMeetingName,doCreateMeeting}){
  const [q,setQ]=useState('');
  const list=meetings.filter(m=>m.name.toLowerCase().includes(q.toLowerCase()));
  const copy=async m=>{await navigator.clipboard?.writeText(`${location.origin}/meeting/${m.id}?invite=${m.invite_token}`);showToastGlobal('Invite link copied')};
  return <div className="app">
    <header className="bar"><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><div className="user"><span>{profile?.name}</span><span className="avatar">{(profile?.name||'D')[0].toUpperCase()}</span><button className="btn" onClick={logout}>Log out</button></div></header>
    <main className="dash">
      <div className="dash-head"><div><div className="eyebrow">Your workspace</div><h1>Welcome back, {profile?.name?.split(' ')[0]||'developer'}</h1><p>{meetings.length} workspace{meetings.length===1?'':'s'} · everything starts empty</p></div><button className="btn primary" onClick={create}>＋ Create Meeting</button></div>
      {meetings.length>0&&<input className="search" placeholder="Search meetings…" value={q} onChange={e=>setQ(e.target.value)}/>}
      {meetings.length===0?<div className="empty"><h3>No meetings yet</h3><p>Create a private room, then invite collaborators. Your editor starts completely empty.</p><button className="btn primary" onClick={create}>Create your first meeting</button></div>:list.length===0?<div className="empty"><h3>No match</h3><p>Nothing matches “{q}”.</p></div>:<div className="meetings">{list.map(m=><div className="meeting-card" key={m.id}><div className="card-top"><span className="live">● READY</span><span>{new Date(m.created_at).toLocaleDateString()}</span></div><h3>{m.name}</h3><p>Private collaborative workspace</p><div className="meeting-meta"><span className="acts"><button className="icon" title="Copy invite" onClick={()=>copy(m)}>↗</button><button className="icon" title="Rename" onClick={()=>ren(m)}>✎</button><button className="icon" title="Delete" onClick={()=>del(m)}>🗑</button></span><button className="btn" onClick={()=>open(m.id)}>Open workspace</button></div></div>)}</div>}
    </main>
    {createOpen&&<Modal title="Create meeting" close={()=>setCreateOpen(false)}><p>Your new meeting starts completely empty. Invite collaborators after it is created.</p><label>Meeting name<input autoFocus value={meetingName} onChange={e=>setMeetingName(e.target.value)} placeholder="e.g. Startup MVP"/></label><div className="modal-actions"><button className="btn" onClick={()=>setCreateOpen(false)}>Cancel</button><button className="btn primary" onClick={doCreateMeeting}>Create meeting</button></div></Modal>}
  </div>
}

function Meeting(p){
  const [setOpen,setSetOpen]=useState(false);
  const [pal,setPal]=useState(false);
  const [pq,setPq]=useState('');
  const [fq,setFq]=useState('');
  const [tabs,setTabs]=useState([]);
  const [secondDraft,setSecondDraft]=useState('');
  const [consoleState,setConsoleState]=useState(true);
  const up=useRef(null);

  useEffect(()=>{if(p.active&&!tabs.includes(p.active.id))setTabs(t=>[...t,p.active.id]);},[p.active?.id]);
  useEffect(()=>{if(p.second)setSecondDraft(p.second.content||'');},[p.second?.id]);
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPal(v=>!v);setPq('');}if(e.key==='Escape')setPal(false)};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[]);

  const shown=p.files.filter(f=>f.name.toLowerCase().includes(fq.toLowerCase()));
  const tabFiles=tabs.map(id=>p.files.find(f=>f.id===id)).filter(Boolean);
  const commands=[
    ['New file','＋',p.createFile],['New folder','▱',p.createFolder],['Upload assets','⇪',()=>up.current?.click()],['Run active file','▶',p.runActiveFile],
    ['Split editor','▦',()=>p.setSplit(true)],['Focus mode','◎',()=>p.setFocusMode(v=>!v)],['Invite collaborators','↗',p.onInvite],['Team chat','✉',()=>p.setChatOpen(v=>!v)],
    ['Shared terminal','>_',()=>p.setTerminalOpen(v=>!v)],['AI assistant','✦',()=>p.setAiOpen(v=>!v)],['Download project ZIP','⬇',p.downloadProject],['TV / Room mode','▣',p.onTV],['Settings','⚙',()=>setSetOpen(true)],['Back to dashboard','←',p.onLeave],
    ...p.files.map(f=>['Open '+f.name,'◉',()=>p.openFile(f)])
  ].filter(([n])=>n.toLowerCase().includes(pq.toLowerCase()));

  const renderEditor=(file,secondary=false)=> <Editor file={file} value={secondary?(file?.content||secondDraft):p.content} onChange={secondary?(v)=>{setSecondDraft(v); if(file){p.onSecondaryChange(file,v);}}:p.setContent} onSave={p.refreshSaved} onRun={p.runActiveFile} fs={p.settings.fs} tab={p.settings.tab} pair={p.settings.pair}/>;

  return <div className={'app meeting-app '+(p.focusMode?'focus-mode':'')} onClick={()=>p.ctx&&p.setCtx(null)}>
    <header className="bar">
      <div className="user"><button className="btn" onClick={p.onLeave}>←</button><div><b>{p.meeting?.name}</b><div className="live">● LIVE · {p.members.length||1} online</div></div></div>
      <div className="user">
        <button className="btn" onClick={()=>setPal(true)}>⌘K</button>
        <button className="btn" onClick={p.onInvite}>Invite</button>
        <button className="btn" onClick={()=>p.setChatOpen(v=>!v)}>Chat</button>
        <button className="btn" onClick={()=>p.setAiOpen(v=>!v)}>AI</button>
        <button className="btn" onClick={()=>setSetOpen(true)}>Settings</button>
        <button className="btn" onClick={p.onTV}>TV / Room</button>
      </div>
    </header>

    <div className="work">
      {!p.focusMode&&<aside className="explorer" onContextMenu={e=>{e.preventDefault();p.setCtx({x:e.clientX,y:e.clientY,fileId:null,folderId:null})}}>
        <div className="explorer-head"><b>EXPLORER</b><span><button className="icon" title="Upload" onClick={()=>up.current?.click()}>⇪</button><button className="icon" title="New folder" onClick={p.createFolder}>▱</button><button className="icon" title="New file" onClick={p.createFile}>＋</button></span></div>
        <input ref={up} type="file" hidden multiple onChange={e=>{p.upload([...e.target.files]);e.target.value=''}}/>
        <input className="search small" placeholder="Filter files…" value={fq} onChange={e=>setFq(e.target.value)}/>
        <div className="tree-title">PROJECT</div>
        {p.folders.map(folder=><div className="folder-row" key={folder.id} onContextMenu={e=>{e.preventDefault();e.stopPropagation();p.setCtx({x:e.clientX,y:e.clientY,fileId:null,folderId:folder.id})}}>▾ {folder.name}<button className="folder-delete" onClick={e=>{e.stopPropagation();p.deleteFolder(folder.id)}}>×</button></div>)}
        {p.files.length===0?<div className="tree-empty">No files yet.<br/><br/>Right-click or use ＋ to create your first file.</div>:shown.map(f=><div key={f.id} className={'file '+(f.id===p.active?.id?'active':'')} onClick={()=>p.openFile(f)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();p.setCtx({x:e.clientX,y:e.clientY,fileId:f.id,folderId:f.folder_id||null})}}>◉ {f.name}<span>{LANGS[f.language]?.[0]||f.language}</span></div>)}
      </aside>}

      <section className="editor">
        <div className="tabs">{tabFiles.length?tabFiles.map(f=><span key={f.id} className={'tab '+(f.id===p.active?.id?'active':'')} onClick={()=>p.openFile(f)}>{f.name}<b className="x" onClick={e=>{e.stopPropagation();setTabs(t=>t.filter(id=>id!==f.id));if(f.id===p.active?.id){const next=tabFiles.find(x=>x.id!==f.id);if(next)p.openFile(next);}}}>×</b></span>):<span className="tab">No file open</span>}</div>
        <div className="toolbar"><span>LANGUAGE</span><span className="pill">{p.active?LANGS[p.active.language]?.[0]||p.active.language:'Plain Text'}</span><button className="pill fmt" onClick={p.formatActive}>Format</button><button className="pill" onClick={()=>p.setSplit(v=>!v)}>{p.split?'Unsplit':'＋ Panel'}</button><button className="run" onClick={p.runActiveFile}>▶ Run</button></div>
        {p.split?<div className="split-editors"><div>{p.active?renderEditor(p.active):<div className="editor-empty">Create a file to start coding.</div>}</div><div><select className="split-select" value={p.secondId||''} onChange={e=>p.setSecondId(e.target.value||null)}><option value="">Choose second file…</option>{p.files.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>{p.second?renderEditor(p.second,true):<div className="editor-empty">Choose another file for the second panel.</div>}</div></div>:p.active?renderEditor(p.active):<div className="editor-empty">Create a file to start coding.</div>}
        {p.focusMode&&<div className="focus-exit"><button className="btn" onClick={()=>p.setFocusMode(false)}>Exit Focus Mode</button></div>}
      </section>

      {!p.focusMode&&<section className="preview"><div className="preview-head"><span>LIVE PREVIEW</span><span className="devs"><button className={'icon '+(p.previewWidth==='100%'?'on':'')} onClick={()=>p.setPreviewWidth('100%')}>▭</button><button className={'icon '+(p.previewWidth==='768px'?'on':'')} onClick={()=>p.setPreviewWidth('768px')}>▯</button><button className={'icon '+(p.previewWidth==='390px'?'on':'')} onClick={()=>p.setPreviewWidth('390px')}>▮</button><button className="icon" onClick={()=>p.setPreviewKey(v=>v+1)}>⟳</button><button className="icon" onClick={()=>{if(!p.preview)return;const u=URL.createObjectURL(new Blob([p.preview],{type:'text/html'}));window.open(u,'_blank')}}>⧉</button><button className="icon" onClick={()=>setConsoleState(v=>!v)}>▤</button></span></div>{p.preview?<iframe key={p.previewKey} title="preview" srcDoc={p.preview} style={{width:p.previewWidth,alignSelf:'center'}} sandbox="allow-scripts allow-forms allow-modals"/>:<div className="preview-empty">Create an HTML file to see live output.<br/>Use <b>&lt;link&gt;</b> and <b>&lt;script&gt;</b> to connect local CSS and JS.</div>}{consoleState&&<div className="console"><div className="console-head">OUTPUT <button className="icon" onClick={()=>p.setConsoleLogs([])}>Clear</button></div>{p.consoleLogs.length===0?<div className="log info">Run JavaScript, Python or another supported language to see output here.</div>:p.consoleLogs.map((l,i)=><div key={i} className={'log '+(l.type||'info')}>{l.m||l.text}</div>)}</div>}</section>}

      {!p.focusMode&&<aside className="team">
        <div className="team-title">TEAM · {Math.max(1,p.members.length)} <button className="icon" onClick={p.onInvite}>＋</button></div>
        <div className="call-grid">
          {p.callPeers.map(peer=><RemoteTile key={peer.id} peer={peer}/>)}
          <div className="call-tile local"><video ref={p.localVideoRef} muted autoPlay playsInline/><div className="call-label">You</div></div>
        </div>
        <div className="call-controls"><button className={'call-control '+(!p.micOn?'off':'')} onClick={p.toggleMic}>{p.micOn?'🎙':'🔇'} Mic</button><button className={'call-control '+(!p.cameraOn?'off':'')} onClick={p.toggleCamera}>{p.cameraOn?'◉':'○'} Cam</button><button className={'call-control '+(p.screenSharing?'on':'')} onClick={p.toggleScreen}>{p.screenSharing?'Stop share':'Share screen'}</button></div>
        <div className="member-list">{(p.members.length?p.members:[{name:p.profile?.name||'You',id:p.sessionUserId}]).map((m,i)=><div className="member-row" key={m.id||i}><span className="avatar">{(m.name||'?')[0].toUpperCase()}</span><div><b>{m.name||'Developer'}</b><small>{m.activeFile?'Editing now':'In workspace'}</small></div><span className="presence-dot"/></div>)}</div>
        <div className="team-note">Invite collaborators to bring their editors, cameras and ideas into this room.</div>
      </aside>}
    </div>

    {p.ctx&&<div className="context" style={{left:p.ctx.x,top:p.ctx.y}} onClick={e=>e.stopPropagation()}>
      {p.ctx.folderId?<><button onClick={()=>{p.setFolderId(p.ctx.folderId);p.createFile();p.setCtx(null)}}>New file here</button><button onClick={()=>p.deleteFolder(p.ctx.folderId)}>Delete folder</button></>:<><button onClick={p.createFile}>New file</button><button onClick={p.createFolder}>New folder</button>{p.ctx.fileId&&<><button onClick={p.rename}>Rename</button><button onClick={p.duplicate}>Duplicate</button><button onClick={()=>navigator.clipboard?.writeText('/'+(p.files.find(x=>x.id===p.ctx.fileId)?.name||''))}>Copy path</button><button onClick={()=>downloadOne(p.files.find(x=>x.id===p.ctx.fileId))}>Download</button><button className="danger" onClick={p.del}>Delete</button></>}</>}
    </div>}

    {p.chatOpen&&<div className="chat"><div className="chat-head">Team Chat <button className="icon" onClick={()=>p.setChatOpen(false)}>×</button></div><div className="messages">{p.chat.length===0?<div className="log info">No messages yet. Say hello.</div>:p.chat.map((m,i)=><div key={i}><b>{m.name}</b>{m.message}</div>)}</div><div className="chat-send"><input value={p.chatText} onChange={e=>p.setChatText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')p.sendChat()}} placeholder="Message the team…"/><button className="btn primary" onClick={p.sendChat}>Send</button></div></div>}

    {p.terminalOpen&&<div className="chat terminal-drawer"><div className="chat-head">Shared Terminal <button className="icon" onClick={()=>p.setTerminalOpen(false)}>×</button></div><div className="terminal-output">{p.terminalLines.map((l,i)=><div className={'term-line '+l.type} key={i}>{l.text}</div>)}</div><div className="chat-send"><input value={p.terminalInput} onChange={e=>p.setTerminalInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')p.runTerminal()}} placeholder="run a sandboxed command…"/><button className="btn primary" onClick={p.runTerminal}>Run</button></div></div>}

    {p.aiOpen&&<div className="chat ai-drawer"><div className="chat-head">Shared AI <button className="icon" onClick={()=>p.setAiOpen(false)}>×</button></div><div className="ai-body"><div className="ai-note">Ask about the selected file. The AI endpoint is server-side and can be connected to an OpenAI-compatible provider without exposing its key to the browser.</div><textarea value={p.aiPrompt} onChange={e=>p.setAiPrompt(e.target.value)} placeholder="Explain this code, find bugs, suggest changes…"/><button className="btn primary" disabled={p.aiBusy} onClick={p.aiAsk}>{p.aiBusy?'Thinking…':'Ask AI'}</button><pre>{p.aiResponse}</pre></div></div>}

    {p.fileOpen&&<Modal title="Create new file" close={()=>p.setFileOpen(false)}><label>File name<input value={p.fileName} onChange={e=>p.setFileName(e.target.value)} autoFocus/></label><label>Language<select value={p.fileLang} onChange={e=>p.setFileLang(e.target.value)}>{Object.entries(LANGS).map(([k,v])=><option key={k} value={k}>{v[0]} (.{v[1]})</option>)}</select></label><label>Folder<select value={p.folderId||''} onChange={e=>p.setFolderId(e.target.value||null)}><option value="">Project root</option>{p.folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="modal-actions"><button className="btn" onClick={()=>p.setFileOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doCreateFile}>Create file</button></div></Modal>}
    {p.folderOpen&&<Modal title="Create new folder" close={()=>p.setFolderOpen(false)}><label>Folder name<input value={p.folderName} onChange={e=>p.setFolderName(e.target.value)} autoFocus/></label><div className="modal-actions"><button className="btn" onClick={()=>p.setFolderOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doCreateFolder}>Create folder</button></div></Modal>}
    {p.renameOpen&&<Modal title="Rename file" close={()=>p.setRenameOpen(false)}><label>New name<input value={p.rename} onChange={e=>p.setRename(e.target.value)} autoFocus/></label><div className="modal-actions"><button className="btn" onClick={()=>p.setRenameOpen(false)}>Cancel</button><button className="btn primary" onClick={p.doRename}>Rename</button></div></Modal>}
    {p.inviteOpen&&<Modal title="Invite collaborators" close={()=>p.setInviteOpen(false)}><p>Share this private meeting link. Collaborators will join after signing in.</p><input value={p.inviteLink} readOnly/><div className="modal-actions"><button className="btn primary" onClick={p.copyInvite}>Copy link</button></div></Modal>}
    {setOpen&&<Modal title="Editor settings" close={()=>setSetOpen(false)}><label>Font size<input type="range" min="11" max="22" value={p.settings.fs} onChange={e=>p.setSettings({...p.settings,fs:+e.target.value})}/></label><label>Tab size<select value={p.settings.tab} onChange={e=>p.setSettings({...p.settings,tab:+e.target.value})}><option value="2">2 spaces</option><option value="4">4 spaces</option></select></label><label className="check"><input type="checkbox" checked={p.settings.pair} onChange={e=>p.setSettings({...p.settings,pair:e.target.checked})}/> Auto-close brackets and quotes</label><div className="modal-actions"><button className="btn" onClick={()=>setSetOpen(false)}>Done</button></div></Modal>}
    {p.runDoc&&<iframe title="sandbox-runner" key={p.runKey} srcDoc={p.runDoc} sandbox="allow-scripts" style={{display:'none'}}/>}
    {pal&&<div className="modal pal" onClick={e=>e.target===e.currentTarget&&setPal(false)}><div className="palette"><input autoFocus value={pq} onChange={e=>setPq(e.target.value)} placeholder="Type a command or file name…"/>{commands.slice(0,10).map(([n,i,f])=><button key={n} onClick={()=>{setPal(false);f()}}><span>{i}</span>{n}</button>)}</div></div>}
  </div>
}

function Editor({file,value,onChange,onSave,onRun,fs,tab,pair}){
  const gutter=useRef(null);const [pos,setPos]=useState([1,1]);const lines=Math.max(1,value.split('\n').length);const style={font:`${fs}px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace`};
  function cursor(t){const b=t.value.slice(0,t.selectionStart).split('\n');setPos([b.length,b[b.length-1].length+1]);}
  function insert(t,txt,back=0){const a=t.selectionStart,b=t.selectionEnd;const next=value.slice(0,a)+txt+value.slice(b);onChange(next);requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=a+txt.length-back;cursor(t)})}
  function key(e){const t=e.target,mod=e.ctrlKey||e.metaKey;if(e.key==='Tab'){e.preventDefault();insert(t,' '.repeat(tab));return}if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();onSave();return}if(mod&&e.key==='Enter'){e.preventDefault();onRun();return}if(e.key==='Enter'){const a=t.selectionStart,ls=value.lastIndexOf('\n',a-1)+1,indent=(value.slice(ls,a).match(/^\s*/)||[''])[0],prev=value[a-1],extra=prev&&'{[(:'.includes(prev)?' '.repeat(tab):'';e.preventDefault();insert(t,'\n'+indent+extra);return}if(pair&&PAIRS[e.key]&&!mod){e.preventDefault();insert(t,e.key+PAIRS[e.key],1)}}
  return <><div className="code-wrap"><div className="gutter" style={style} ref={gutter}>{Array.from({length:lines},(_,i)=><div key={i}>{i+1}</div>)}</div><textarea className="code" style={style} value={value} onChange={e=>{onChange(e.target.value);cursor(e.target)}} onClick={e=>cursor(e.target)} onKeyUp={e=>cursor(e.target)} onScroll={e=>{gutter.current.scrollTop=e.target.scrollTop}} spellCheck="false" wrap="off" aria-label={`${file?.name||'code'} editor`}/></div><div className="statusbar"><span>Ln {pos[0]}, Col {pos[1]}</span><span>{file?.name||''}</span><span>Ctrl/Cmd+S save · Ctrl/Cmd+Enter run</span></div></>;
}

function RemoteTile({peer}){const ref=useRef(null);useEffect(()=>{if(ref.current)ref.current.srcObject=peer.stream},[peer.stream]);return <div className="call-tile"><video ref={ref} autoPlay playsInline/><div className="call-label">{peer.name}</div></div>}

function Modal({title,close,children}){return <div className="modal" onClick={e=>{if(e.currentTarget===e.target)close()}}><div className="modal-card"><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</div></div>}

function TVScreen({meeting,preview,onRefresh}){return <div className="tv"><div className="tv-bar"><div className="brand"><span className="logo">&lt;/&gt;</span>{meeting?.name||'DevSync Room'}</div><div className="tv-status"><span className="live">● LIVE OUTPUT</span><button className="btn" onClick={onRefresh}>Refresh</button></div></div>{preview?<iframe title="DevSync TV output" srcDoc={preview} sandbox="allow-scripts allow-forms allow-modals"/>:<div className="preview-empty">Waiting for an HTML file in this meeting…</div>}</div>}

function Setup(){return <div className="setup"><div><div className="brand"><span className="logo">&lt;/&gt;</span>DevSync</div><h1>Connect Supabase</h1><p>In Vercel, add the environment variables below. Code execution, TURN and AI are configured separately on the server.</p><pre>VITE_SUPABASE_URL\nVITE_SUPABASE_PUBLISHABLE_KEY\n\nOptional server-side:\nJUDGE0_URL\nJUDGE0_HEADERS_JSON\nVITE_TURN_URL\nVITE_TURN_USERNAME\nVITE_TURN_CREDENTIAL\nAI_BASE_URL\nAI_API_KEY\nAI_MODEL</pre></div></div>}

function showToastGlobal(text){window.dispatchEvent(new CustomEvent('ds-toast',{detail:text}));}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function downloadOne(file){if(!file)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([file.content||''],{type:'text/plain'}));a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

function Toasts(){const [t,setT]=useState('');useEffect(()=>{let id;const h=e=>{setT(e.detail);clearTimeout(id);id=setTimeout(()=>setT(''),2400)};window.addEventListener('ds-toast',h);return()=>window.removeEventListener('ds-toast',h)},[]);return t?<div className="toast" role="status">{t}</div>:null;}

createRoot(document.getElementById('root')).render(<><App/><Toasts/></>);
