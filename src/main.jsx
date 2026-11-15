import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseReady } from './supabase';
import { MessageCircle, Users, Shuffle, Heart, LogOut, Send, Shield, Sparkles, Menu, X, Smile, Moon, Sun, Reply, Ban } from 'lucide-react';
import './style.css';
import Admin from './Admin';

const EMOJI_CATEGORIES = [
  { name: 'Trending', items: ['😭','💀','🫠','✨','🫶','🤌','🥹','😩','🗿','👀','🤡','😎','🔥','💅','🧿','🫡'] },
  { name: 'Faces', items: ['😀','😂','🤣','🥲','🥹','😊','😍','🥰','😘','😜','🤪','🤔','😴','😭','😤','🤯','🫠','💀'] },
  { name: 'Gestures', items: ['👋','🫶','👏','🙌','🤝','🙏','👍','👎','🤌','✌️','🤟','🫰','💅','🫡'] },
  { name: 'Hearts', items: ['❤️','🩷','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','💕','💞','💘'] },
  { name: 'Fun', items: ['🔥','✨','💯','🎉','🥳','👑','💎','🌈','⭐','⚡','🍿','🧋','🦋','🐸'] }
];
const EMOJIS = ['❤️','😂','🔥','😍','😭','💀','🫶','✨','👀','🥹','🤌','🗿'];
const MEME_STICKERS = [
  { id:'six-seven', title:'6 7', sub:'SIX SEVEN', image:'/stickers/six-seven.svg', vibe:'six-seven' },
  { id:'lol', title:'LOL', sub:"CAN'T STOP LAUGHING", image:'/stickers/lol.svg', vibe:'lol' },
  { id:'goat', title:'GOAT', sub:'GREATEST OF ALL TIME', image:'/stickers/goat.svg', vibe:'goat' },
  { id:'rizz', title:'RIZZ', sub:'UNMATCHED CHARISMA', image:'/stickers/rizz.svg', vibe:'rizz' },
  { id:'aura', title:'AURA', sub:'+1000 AURA', image:'/stickers/aura.svg', vibe:'aura' },
  { id:'mogging', title:'MOGGING', sub:'MAIN CHARACTER', image:'/stickers/mogging.svg', vibe:'mogging' },
  { id:'cooked', title:'COOKED', sub:"IT'S OVER", image:'/stickers/cooked.svg', vibe:'cooked' },
  { id:'skibidi', title:'SKIBIDI', sub:'WHAT DID I JUST SEE', image:'/stickers/skibidi.svg', vibe:'skibidi' },
  { id:'sigma', title:'SIGMA', sub:'SILENT GRIND', image:'/stickers/sigma.svg', vibe:'sigma' },
  { id:'no-cap', title:'NO CAP', sub:'100% FACTS', image:'/stickers/no-cap.svg', vibe:'no-cap' },
  { id:'bruh', title:'BRUH', sub:'SERIOUSLY?!', image:'/stickers/bruh.svg', vibe:'bruh' },
  { id:'npc', title:'NPC', sub:'DEFAULT RESPONSE', image:'/stickers/npc.svg', vibe:'npc' },
  { id:'w', title:'W', sub:"THAT'S A WIN", image:'/stickers/w.svg', vibe:'win' },
  { id:'l', title:'L', sub:'TAKE THE L', image:'/stickers/l.svg', vibe:'loss' },
  { id:'lock-in', title:'LOCK IN', sub:'FOCUS MODE', image:'/stickers/lock-in.svg', vibe:'lock-in' }
];
const stickerBody = (kind, id) => '[[chaattiko:' + kind + ':' + id + ']]';
function StickerMessage({ body }) {
  const match = /^\[\[chaattiko:(emoji|meme):([^\]]+)\]\]$/.exec(body || '');
  if (!match) return body;
  const kind = match[1], id = match[2];
  if (kind === 'emoji') return <div className="sent-emoji-sticker" aria-label={id}>{id}</div>;
  const sticker = MEME_STICKERS.find(item => item.id === id);
  if (!sticker) return body;
  return <div className="sent-meme-sticker" role="img" aria-label={sticker.title}>
    <img src={sticker.image} alt={sticker.title + ' animated sticker'} loading="lazy" />
  </div>;
}
// Supabase password Auth requires an email-shaped identifier. This internal alias is never shown to users.
const aliasEmail = (name) => name.trim().toLowerCase() + '@login.chaattiko.com';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [gender, setGender] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [age, setAge] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [people, setPeople] = useState([]);
  const [online, setOnline] = useState([]);
  const [target, setTarget] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [showPeople, setShowPeople] = useState(false);
  const [splash, setSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState('Trending');
  const [dark, setDark] = useState(true);
  const [toast, setToast] = useState('');
  const bottomRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); return; }
    let live = true;
    (async () => {
      const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!live) return;
      if (profileError) {
        setProfile(null);
        setError('We could not load your profile. Your account is still safe. Please refresh and try again. (' + profileError.message + ')');
        return;
      }
      setProfile(data);
      if (!data) setError('Your account is signed in, but its profile could not be found. Please contact support; do not create another account.');
      if (data?.is_banned) { await supabase.auth.signOut(); setError('This account has been suspended.'); }
    })();
    return () => { live = false; };
  }, [session]);

  useEffect(() => {
    if (!session || !profile || !supabase) return;
    loadPeople();
    loadBlocksAndFavorites();
    loadMessages();
    const heartbeat = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/chaattiko-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ action: 'presence' })
        });
        const result = await response.json();
        if (result.kicked) {
          setToast('Your session was ended by an administrator.');
          await supabase.auth.signOut();
        }
      } catch { /* A temporary heartbeat failure must not interrupt chat. */ }
    };
    heartbeat();
    const messagesChannel = supabase.channel('chat-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadMessages())
      .subscribe();
    channelRef.current = { presence, messagesChannel };
    return () => { supabase.removeChannel(presence); supabase.removeChannel(messagesChannel); };
  }, [session, profile, conversation]);

  useEffect(() => {
    if (!session || !profile || !supabase) return;
    const beat = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/chaattiko-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ action: 'presence' })
        });
        const result = await response.json();
        if (result.kicked) {
          setToast('Your session was ended by an administrator.');
          await supabase.auth.signOut();
          return;
        }
      } catch { /* Keep the chat usable if presence is temporarily offline. */ }
      await loadPeople();
    };
    const timer = setInterval(beat, 20000);
    return () => clearInterval(timer);
  }, [session?.user?.id, profile?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadPeople() {
    const { data, error: peopleError } = await supabase.from('profiles').select('id,username,gender,last_seen_at,is_banned').neq('id', session.user.id).eq('is_banned', false).order('username');
    if (peopleError) { setToast(peopleError.message); return; }
    const rows = data || [];
    setPeople(rows);
    const cutoff = Date.now() - 90000;
    setOnline(rows.filter(p => p.last_seen_at && Date.parse(p.last_seen_at) >= cutoff).map(p => p.id));
  }
  async function loadBlocksAndFavorites() {
    const [{data:b},{data:f}] = await Promise.all([
      supabase.from('blocks').select('blocker_id,blocked_id').or('blocker_id.eq.'+session.user.id+',blocked_id.eq.'+session.user.id),
      supabase.from('favorites').select('other_user_id').eq('user_id',session.user.id)
    ]);
    setBlocked(b || []); setFavorites((f || []).map(x=>x.other_user_id));
  }
  async function loadMessages() {
    if (!session) return;
    let q = supabase.from('messages').select('id,user_id,username,body,message_type,reply_to,created_at,conversation_id').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(150);
    q = conversation ? q.eq('conversation_id',conversation) : q.is('conversation_id',null);
    const {data,error:e} = await q;
    if (!e) {
      const rows = data || [];
      setMessages(rows);
      if (rows.length) {
        const { data: reactionRows } = await supabase.from('reactions').select('message_id,user_id,emoji').in('message_id', rows.map(m => m.id));
        setReactions(reactionRows || []);
      } else setReactions([]);
    }
  }
  async function authenticate(e) {
    e.preventDefault(); setError('');
    if (!supabaseReady) { setError('Supabase environment variables are missing.'); return; }
    if (!accepted || !age) { setError('Accept the terms and confirm that you are 18 or older.'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) { setError('Nickname must be 3–20 letters, numbers or underscores.'); return; }
    setBusy(true);
    try {
      const email = aliasEmail(nickname);
      if (mode === 'signup') {
        // Do not query profiles from the signed-out client: profile reads are intentionally
        // restricted to authenticated users. The database trigger + unique index are authoritative.
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname.trim(), original_name: originalName.trim() || null, gender: gender || null } }
        });
        if (authError) {
          const message = (authError.message || '').toLowerCase();
          if (message.includes('already registered') || message.includes('already exists') || message.includes('duplicate key') || message.includes('unique constraint')) {
            throw new Error('That nickname is already in use. Please choose a different nickname, or switch to Sign in if this is your account.');
          }
          if (message.includes('database error saving new user')) {
            throw new Error('Chaattiko could not create the profile. Please try a different nickname. If this keeps happening, contact the site administrator.');
          }
          throw authError;
        }
        if (!data.user) throw new Error('Signup did not return a user.');
        // The database trigger creates the profile in the same Auth transaction.
        if (!data.session) {
          setError('Your account was created, but email confirmation is enabled. Nickname-only accounts cannot receive that email. Please ask the administrator to disable email confirmation, then use Sign in.');
          setMode('login');
        }
      } else {
        const {error:authError} = await supabase.auth.signInWithPassword({email,password});
        if (authError) throw authError;
      }
    } catch (e) { setError(e.message || 'Unable to sign in.'); }
    finally { setBusy(false); }
  }

  async function sendSticker(kind, id) {
    if (!profile) return;
    const { error: stickerError } = await supabase.from('messages').insert({
      user_id:session.user.id, username:profile.username, body:stickerBody(kind,id),
      message_type:kind === 'meme' ? 'sticker' : 'emoji',
      reply_to:reply?.id || null, conversation_id:conversation || null
    });
    if (stickerError) setToast(stickerError.message);
    else { setEmojiOpen(false); setReply(null); }
  }
  async function sendMessage(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !profile) return;
    const {error:e2} = await supabase.from('messages').insert({
      user_id:session.user.id, username:profile.username, body,
      reply_to:reply?.id || null, conversation_id:conversation || null
    });
    if (e2) setToast(e2.message); else { setDraft(''); setReply(null); }
  }
  async function openPrivate(person) {
    const {data,error:e} = await supabase.rpc('start_direct_conversation',{other_user:person.id});
    if (e) { setToast(e.message); return; }
    setTarget(person); setConversation(data); setShowPeople(false);
  }
  async function randomChat() {
    const candidates = people.filter(p => online.includes(p.id) && !blocked.some(b => (b.blocker_id===session.user.id && b.blocked_id===p.id)||(b.blocker_id===p.id && b.blocked_id===session.user.id)));
    if (!candidates.length) { setToast('No available people online right now.'); return; }
    await openPrivate(candidates[Math.floor(Math.random()*candidates.length)]);
  }
  async function toggleFavorite(person) {
    const isFav = favorites.includes(person.id);
    const result = isFav
      ? await supabase.from('favorites').delete().eq('user_id',session.user.id).eq('other_user_id',person.id)
      : await supabase.from('favorites').insert({user_id:session.user.id,other_user_id:person.id});
    if (result.error) setToast(result.error.message); else loadBlocksAndFavorites();
  }
  async function toggleBlock(person) {
    const mine = blocked.some(b=>b.blocker_id===session.user.id && b.blocked_id===person.id);
    const result = mine
      ? await supabase.from('blocks').delete().eq('blocker_id',session.user.id).eq('blocked_id',person.id)
      : await supabase.from('blocks').insert({blocker_id:session.user.id,blocked_id:person.id});
    if (result.error) setToast(result.error.message);
    else { loadBlocksAndFavorites(); setConversation(null); setTarget(null); }
  }
  async function react(message,emoji) {
    const {error:e} = await supabase.from('reactions').upsert({message_id:message.id,user_id:session.user.id,emoji},{onConflict:'message_id,user_id'});
    if (e) setToast(e.message); else await loadMessages();
  }
  async function signOut() { await supabase.auth.signOut(); setProfile(null); setTarget(null); setConversation(null); }

  if (!session || !profile) return <main className="auth-shell">
    <div className="auth-glow glow-a"/><div className="auth-glow glow-b"/>
    <section className="auth-card">
      <div className="brand-mark">C</div><div className="eyebrow"><Sparkles size={14}/> ANONYMOUS CONNECTIONS</div>
      <h1>chaattiko<span>.</span></h1><p className="muted">A little world. A thousand conversations.</p>
      <div className="auth-tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setPassword('');}}>Sign in</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setError('');setPassword('');}}>Create account</button></div>
      <form onSubmit={authenticate} className="auth-form">
        <label>Public nickname<input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="e.g. midnightowl" autoComplete="username" required/></label>
        {mode==='signup' && <>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="8" required autoComplete="new-password"/></label>
          <label>Original name <small>(optional)</small><input value={originalName} onChange={e=>setOriginalName(e.target.value)} placeholder="Only for account security"/></label>
          <label>Gender <small>(optional)</small><select value={gender} onChange={e=>setGender(e.target.value)}><option value="">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non_binary">Non-binary</option></select></label>
        </>}
        {mode==='login' && <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>}
        <label className="check"><input type="checkbox" checked={age} onChange={e=>setAge(e.target.checked)}/> I confirm that I am 18 years old or older.</label>
        <label className="check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> I agree to the <a href="/terms.html" target="_blank">Terms & Conditions</a> and privacy notice.</label>
        {error && <div className="error">{error}</div>}
        <button className="primary-btn" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Enter Chaattiko':'Continue'} <span>→</span></button>
      </form>
      <p className="fineprint">Your nickname is your public identity. Never share personal or sensitive information.</p>
    </section>
  </main>;

  const visiblePeople = [...people].sort((a,b)=>(favorites.includes(b.id)-favorites.includes(a.id)) || (online.includes(b.id)-online.includes(a.id)) || a.username.localeCompare(b.username));
  const isBlocked = target && blocked.some(b=>(b.blocker_id===session.user.id&&b.blocked_id===target.id)||(b.blocker_id===target.id&&b.blocked_id===session.user.id));
  return <main className={dark?'app dark':'app light'}>
    <header className="topbar"><div className="brand"><div className="brand-mini">C</div><span>chaattiko<span className="blue">.</span></span></div><div className="top-actions"><span className="online-pill"><i/> {online.length} online</span><button className="icon-btn" onClick={()=>setDark(!dark)} title="Toggle theme">{dark?<Sun/>:<Moon/>}</button><button className="icon-btn" onClick={signOut} title="Sign out"><LogOut/></button></div></header>
    <div className="workspace">
      <aside className={showPeople?'people-panel show':'people-panel'}>
        <div className="panel-heading"><div><span className="eyebrow">YOUR SPACE</span><h2>People <span>{people.length}</span></h2></div><button className="icon-btn mobile-close" onClick={()=>setShowPeople(false)}><X/></button></div>
        <button className="random-card" onClick={randomChat}><div className="random-icon"><Shuffle/></div><div><b>Random chat</b><small>Meet someone new</small></div><span>↗</span></button>
        <div className="people-label">ONLINE NOW <span>{online.length}</span></div>
        {visiblePeople.filter(p=>online.includes(p.id)).map(p=><Person key={p.id} p={p} active={target?.id===p.id} fav={favorites.includes(p.id)} onOpen={()=>openPrivate(p)} onFav={()=>toggleFavorite(p)}/>)}
        <div className="people-label">ALL PEOPLE <span>{people.length}</span></div>
        {visiblePeople.filter(p=>!online.includes(p.id)).map(p=><Person key={p.id} p={p} active={target?.id===p.id} fav={favorites.includes(p.id)} onOpen={()=>openPrivate(p)} onFav={()=>toggleFavorite(p)}/>)}
        <div className="sidebar-foot"><div className="avatar">{profile.username.slice(0,1).toUpperCase()}</div><div><b>{profile.username}</b><small>You're in the room</small></div><button className="icon-btn" onClick={signOut}><LogOut size={17}/></button></div>
      </aside>
      <section className="chat-panel">
        <div className="chat-head"><button className="icon-btn mobile-menu" onClick={()=>setShowPeople(true)}><Menu/></button><div className="chat-avatar">{target?target.username.slice(0,1).toUpperCase():'#'}</div><div className="chat-title"><b>{target?target.username:'The common room'}</b><small>{target?'Private conversation':'Everyone is welcome here'}</small></div>{target&&<button className="icon-btn" onClick={()=>toggleBlock(target)} title="Block / unblock"><Ban size={18}/></button>}<div className="room-tag"><i/> {target?'PRIVATE':'PUBLIC'}</div></div>
        <div className="messages">
          {!target&&splash&&<div className={'welcome-splash '+(splashExiting?'pixel-exit':'')} onClick={()=>{if(!splashExiting){setSplashExiting(true);setTimeout(()=>setSplash(false),650);}}}><div className="splash-logo">C</div><h2>Let's chat<span>'s</span></h2><p>Tap anywhere to enter the room</p><div className="pixel-dots">▪ ▪ ▪ ▪ ▪ ▪ ▪</div></div>}
          {target&&!messages.length&&<div className="empty-state"><div className="empty-icon"><MessageCircle/></div><h3>Say hello to {target.username}</h3><p>Your private conversation starts here.</p></div>}
          {!target&&!messages.length&&!splash&&<div className="empty-state"><div className="empty-icon"><MessageCircle/></div><h3>The room is yours</h3><p>Start a conversation. Someone will join in.</p></div>}
          {messages.map(m=><div key={m.id} className={m.user_id===session.user.id?'message mine':'message'}>
            <div className="message-avatar">{(m.username||'?').slice(0,1).toUpperCase()}</div><div className="message-content"><div className="message-meta"><b>{m.user_id===session.user.id?'You':m.username}</b><time>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div><div className={m.body?.startsWith('[[chaattiko:') ? "bubble sticker-bubble" : "bubble"}><StickerMessage body={m.body}/></div>{reactions.filter(r=>r.message_id===m.id).length>0&&<div className="reaction-counts">{Object.entries(reactions.filter(r=>r.message_id===m.id).reduce((acc,r)=>{acc[r.emoji]=(acc[r.emoji]||0)+1;return acc;},{})).map(([em,count])=><span key={em}>{em} {count}</span>)}</div>}<div className="message-tools"><button onClick={()=>setReply(m)}><Reply size={13}/> Reply</button>{EMOJIS.map(em=><button key={em} onClick={()=>react(m,em)}>{em}</button>)}</div></div>
          </div>)}
          <div ref={bottomRef}/>
        </div>
        {isBlocked?<div className="blocked-note">This conversation is blocked. Only the person who created the block can unblock it.</div>:<form className="composer" onSubmit={sendMessage}>
          {reply&&<div className="replying"><span>Replying to {reply.username}</span><button type="button" onClick={()=>setReply(null)}>×</button></div>}
          <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={target?'Message privately…':'Send a message to everyone…'} maxLength="2000"/>
          <button className="emoji-btn" type="button" aria-label="Open emoji picker" onClick={()=>setEmojiOpen(v=>!v)}><Smile/></button>
          {emojiOpen&&<div className="emoji-picker">
            <div className="emoji-tabs">{[...EMOJI_CATEGORIES.map(c=>c.name),'Memes'].map(tab=><button type="button" className={emojiTab===tab?'active':''} key={tab} onClick={()=>setEmojiTab(tab)}>{tab}</button>)}</div>
            {emojiTab==='Memes'
              ? <div className="meme-picker-grid">{MEME_STICKERS.map(sticker=><button type="button" className={'meme-picker-card ' + sticker.vibe} key={sticker.id} onClick={()=>sendSticker('meme',sticker.id)}><img src={sticker.image} alt={sticker.title + ' animated sticker preview'} loading="lazy"/><b>{sticker.title}</b><small>{sticker.sub}</small></button>)}</div>
              : <div className="emoji-grid">{(EMOJI_CATEGORIES.find(c=>c.name===emojiTab)?.items||[]).map(em=><button type="button" key={em} aria-label={'Send ' + em} onClick={()=>sendSticker('emoji',em)}>{em}</button>)}</div>}
          </div>}
          <button className="send-btn" disabled={!draft.trim()}><Send size={17}/></button>
        </form>}
      </section>
    </div>
    {toast&&<button className="toast" onClick={()=>setToast('')}>{toast} ×</button>}
    <footer className="app-footer"><span>CHAATTIKO · A WORLD OF WORDS</span><a href="/terms.html">Terms & Privacy</a></footer>
  </main>;
}

function Person({p,active,fav,onOpen,onFav}) {
  return <div className={'person '+(active?'selected':'')}><button className="person-open" onClick={onOpen}><div className="avatar">{p.username.slice(0,1).toUpperCase()}</div><span><b>{p.username}</b><small>{p.last_seen_at?'Member':'New here'}</small></span></button><button className={'fav-btn '+(fav?'saved':'')} onClick={onFav}><Heart size={15} fill={fav?'currentColor':'none'}/></button></div>;
}

createRoot(document.getElementById('root')).render(window.location.pathname === '/admin' ? <Admin/> : <App/>);