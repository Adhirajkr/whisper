import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shield, RefreshCw, LogOut, Users, MessageCircle, Ban, Trash2, Search, Lock } from 'lucide-react';
import './admin.css';

const API = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/chaattiko-admin';

export default function Admin() {
  const [password,setPassword] = useState('');
  const [token,setToken] = useState(sessionStorage.getItem('chaattiko_admin_token') || '');
  const [data,setData] = useState(null);
  const [tab,setTab] = useState('users');
  const [filter,setFilter] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);

  async function call(action,extra={}) {
    const res = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...extra})});
    const result = await res.json().catch(()=>({error:'Invalid server response'}));
    if(!res.ok) throw new Error(result.error || 'Admin request failed');
    return result;
  }
  async function login(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const result=await call('login',{password}); sessionStorage.setItem('chaattiko_admin_token',result.token); setToken(result.token); setPassword(''); }
    catch(e){setError(e.message)} finally{setBusy(false)}
  }
  async function load() {
    setBusy(true); setError('');
    try { const result=await call('dashboard'); setData(result); }
    catch(e){ if(e.message.includes('authentication')){sessionStorage.removeItem('chaattiko_admin_token');setToken('')} setError(e.message); }
    finally{setBusy(false)}
  }
  useEffect(()=>{if(token)load()},[token]);
  async function setBan(userId,banned) {
    try { await call('set_ban',{userId,banned}); await load(); }
    catch(e){setError(e.message)}
  }
  async function kickUser(userId) {
    if(!confirm('End this user session?')) return;
    try { await call('kick',{userId}); await load(); }
    catch(e){setError(e.message)}
  }
  async function deleteMessage(messageId) {
    if(!confirm('Delete this message permanently?')) return;
    try { await call('delete_message',{messageId}); await load(); }
    catch(e){setError(e.message)}
  }
  async function deleteUser(user) {
    if(!confirm('Permanently delete the account "'+user.username+'"? This removes the login account and profile, and releases the nickname. This cannot be undone.')) return;
    try { await call('delete_user',{userId:user.id}); await load(); }
    catch(e){setError(e.message)}
  }
  function logout(){sessionStorage.removeItem('chaattiko_admin_token');setToken('');setData(null)}
  const users=data?.profiles||[];
  const messages=data?.messages||[];
  const query=filter.toLowerCase();
  const shownUsers=users.filter(u=>(u.username||'').toLowerCase().includes(query)||(u.original_name||'').toLowerCase().includes(query));
  const shownMessages=messages.filter(m=>(m.username||'').toLowerCase().includes(query)||(m.body||'').toLowerCase().includes(query));
  if(!token) return <main className="admin-shell"><form className="admin-login" onSubmit={login}><div className="admin-mark"><Shield/></div><small>CHAATTIKO CONTROL ROOM</small><h1>Administrator</h1><p>Restricted access. Sign in with the administrator password.</p><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" required/><button disabled={busy}>{busy?'Checking…':'Unlock dashboard'}</button>{error&&<div className="admin-error">{error}</div>}<a href="/">← Back to Chaattiko</a></form></main>;
  return <main className="admin-shell"><header className="admin-top"><div><small>CHAATTIKO / PRIVATE</small><h1><Shield/> Admin dashboard</h1></div><div><button onClick={load}><RefreshCw size={16}/> Refresh</button><button onClick={logout}><LogOut size={16}/> Sign out</button></div></header>
    {error&&<div className="admin-error">{error}</div>}
    <section className="admin-stats"><div><Users/><b>{users.length}</b><span>Registered users</span></div><div><MessageCircle/><b>{messages.length}</b><span>Recent messages</span></div><div><Ban/><b>{users.filter(u=>u.is_banned).length}</b><span>Banned accounts</span></div></section>
    <nav className="admin-tabs">{[['users','Users'],['messages','All messages'],['blocks','Blocks'],['conversations','Private chats'],['audit','Admin activity']].map(([key,label])=><button className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}>{label}</button>)}</nav>
    <div className="admin-search"><Search size={17}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search users or messages…"/></div>
    {tab==='users'&&<section className="admin-table"><h2>Users</h2>{shownUsers.map(u=><article key={u.id}><div><b>{u.username}</b><small>{u.original_name||'No original name'} · {u.gender||'Gender not shared'} · Joined {new Date(u.created_at).toLocaleDateString()}</small><small>Last active: {u.last_seen_at?new Date(u.last_seen_at).toLocaleString():'Never recorded'}</small><small>IP: {u.last_seen_ip||'Not recorded yet'}</small><small>Device/browser: {u.last_seen_user_agent||'Not recorded yet'}</small><small className="admin-id">{u.id}</small></div><span className={u.is_banned?'status banned':'status'}>{u.is_banned?'Banned':'Active'}</span><button className={u.is_banned?'unban':'ban'} onClick={()=>setBan(u.id,!u.is_banned)}>{u.is_banned?'Unban':'Ban'}</button><button className="ban" onClick={()=>kickUser(u.id)}>Kick</button><button className="delete-user" onClick={()=>deleteUser(u)}><Trash2 size={15}/> Delete account</button></article>)}</section>}
    {tab==='messages'&&<section className="admin-table"><h2>Public and private messages</h2>{shownMessages.map(m=><article key={m.id}><div><b>{m.username} <small>{m.conversation_id?'PRIVATE':'PUBLIC'}</small></b><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()} · expires {new Date(m.expires_at).toLocaleString()}</small></div><button className="ban" onClick={()=>deleteMessage(m.id)}><Trash2 size={15}/> Delete</button></article>)}</section>}
    {tab==='blocks'&&<section className="admin-table"><h2>Blocked relationships</h2>{(data?.blocks||[]).map((b,i)=><article key={i}><div><b>{users.find(u=>u.id===b.blocker_id)?.username||b.blocker_id} blocked {users.find(u=>u.id===b.blocked_id)?.username||b.blocked_id}</b><small>{new Date(b.created_at).toLocaleString()}</small></div></article>)}</section>}
    {tab==='conversations'&&<section className="admin-table"><h2>Private conversations</h2>{(data?.conversations||[]).map(c=><article key={c.id}><div><b>{users.find(u=>u.id===c.created_by)?.username||'Unknown creator'}</b><small>{c.id} · {new Date(c.created_at).toLocaleString()}</small><small>{messages.filter(m=>m.conversation_id===c.id).length} recent messages loaded</small></div></article>)}</section>}
    {tab==='audit'&&<section className="admin-table"><h2>Admin activity</h2>{(data?.audit||[]).map(a=><article key={a.id}><div><b>{a.action}</b><small>{new Date(a.created_at).toLocaleString()} · {JSON.stringify(a.details||{})}</small></div></article>)}</section>}
    <p className="admin-note"><Lock size={14}/> Administrators can review private messages. This access is disclosed in the Terms & Privacy notice.</p>
  </main>;
}
