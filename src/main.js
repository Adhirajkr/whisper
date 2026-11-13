import { createClient } from '@supabase/supabase-js';
import './style.css';

const root = document.querySelector('#app');
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;
let currentUser = null;
let currentProfile = null;
let channel = null;
let messages = [];

const escape = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = (name = '?') => [...name][0]?.toUpperCase() || '?';
const timeAgo = (date) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
};
const expiryLabel = (date) => {
  const left = Math.max(0, new Date(date).getTime() - Date.now());
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  return days ? `Disappears in ${days}d ${hours}h` : `Disappears in ${hours}h`;
};

function shell(content) {
  root.innerHTML = `
    <div class="shell"><main class="app">
      <header class="top"><a class="brand" href="#" aria-label="Whisper home"><span class="mark">✳</span> whisper</a><div class="topnote">a little corner of the internet</div></header>
      ${content}
      <footer class="site-footer">A shared room for passing thoughts · Be kind to one another</footer>
    </main></div>`;
}
function showWelcome() {
  shell(`<section class="page"><div class="center welcome">
    <div class="eyebrow">No email · No password · Just a name</div>
    <h1 class="hero">A place to be<br><em>someone else.</em></h1>
    <p class="lead">A shared room for passing thoughts, small stories, and conversations with people you'll probably never meet.</p>
    <button class="btn" id="step-inside">Step inside <span>↗</span></button>
    <div class="tiny">One common room. A fresh start. Just be kind.</div>
  </div></section>`);
  root.querySelector('#step-inside').addEventListener('click', showRules);
}
function showRules() {
  shell(`<section class="page"><div class="center">
    <div class="eyebrow">Before you enter</div><h1 class="subhero">A few gentle rules.</h1>
    <div class="disclaimer"><h2>Keep this space human.</h2><ul>
      <li>Be respectful. There are real people behind these names.</li>
      <li>Don't share private information about yourself or others.</li>
      <li>Hate, harassment, threats, and harmful content aren't welcome.</li>
      <li>Messages disappear after seven days, but screenshots can last.</li>
    </ul></div>
    <button class="btn" id="continue">I understand — continue</button>
    <div class="tiny"><button class="text-btn" id="back">Go back</button></div>
  </div></section>`);
  root.querySelector('#continue').addEventListener('click', ensureAnonymousSession);
  root.querySelector('#back').addEventListener('click', showWelcome);
}
async function ensureAnonymousSession() {
  setBusy('Creating your private visitor session…');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return showError(sessionError.message);
  let user = sessionData.session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return showError(error.message.includes('Anonymous') ? 'Anonymous sign-ins are not enabled yet. Enable them in Supabase → Authentication → Providers.' : error.message);
    user = data.user;
  }
  currentUser = user;
  const { data: profile, error } = await supabase.from('profiles').select('id, username, gender').eq('id', user.id).maybeSingle();
  if (error) return showError(error.message);
  if (profile) {
    currentProfile = profile;
    await enterRoom();
  } else {
    showNameForm();
  }
}
function setBusy(message) {
  shell(`<section class="page"><div class="center"><div class="loader"></div><p class="lead">${escape(message)}</p></div></section>`);
}
function showError(message) {
  shell(`<section class="page"><div class="center"><div class="eyebrow">A small connection hiccup</div><h1 class="subhero">Let's try again.</h1><p class="lead error-text">${escape(message)}</p><button class="btn" id="retry">Try again</button><div class="tiny">If this keeps happening, check the Supabase setup notes in the project README.</div></div></section>`);
  root.querySelector('#retry').addEventListener('click', showWelcome);
}
function showNameForm() {
  shell(`<section class="page"><div class="center compact"><div class="eyebrow">Make yourself at home</div>
    <h1 class="subhero">What should we call you?</h1><p class="lead small-lead">Choose a name that's yours for now. No email, no password.</p></div>
    <form class="form-card" id="profile-form"><h2>Create your name</h2><p class="muted">Your display name is how the room will know you.</p>
      <label class="field-label" for="displayName">DISPLAY NAME</label>
      <input id="displayName" class="name-input" maxlength="20" minlength="3" pattern="[A-Za-z0-9_]{3,20}" placeholder="e.g. moonlit_23" autocomplete="off" required>
      <p class="hint">3–20 characters: letters, numbers, and underscores. Don't use your real name.</p>
      <label class="field-label">GENDER <span class="muted normal">(optional)</span></label>
      <div class="gender"><button type="button" data-gender="man">♂ Male</button><button type="button" data-gender="woman">♀ Female</button><button type="button" class="selected" data-gender="">Skip</button></div>
      <div class="suggestions"><div class="suggest-head"><span>Some name inspiration</span><span class="live">✦ IDEAS</span></div>
        <div class="names"><button type="button" class="chip">soft_static</button><button type="button" class="chip">bluehour</button><button type="button" class="chip">little_comet</button><button type="button" class="chip">afterglow</button><button type="button" class="chip">paper_moon</button><button type="button" class="chip">northstar</button></div>
      </div>
      <p class="form-error" id="form-error" role="alert"></p>
      <div class="actions"><button class="btn secondary" type="button" id="rules-back">Back</button><button class="btn" type="submit">Enter the room ↗</button></div>
    </form></section>`);
  let selectedGender = '';
  const genderButtons = [...root.querySelectorAll('[data-gender]')];
  genderButtons.forEach((button) => button.addEventListener('click', () => {
    selectedGender = button.dataset.gender;
    genderButtons.forEach((b) => b.classList.toggle('selected', b === button));
  }));
  root.querySelectorAll('.chip').forEach((button) => button.addEventListener('click', () => {
    root.querySelector('#displayName').value = button.textContent;
  }));
  root.querySelector('#rules-back').addEventListener('click', showRules);
  root.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = root.querySelector('#displayName').value.trim();
    const errorBox = root.querySelector('#form-error');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      errorBox.textContent = 'Use 3–20 letters, numbers, or underscores.';
      return;
    }
    const submit = root.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Saving…';
    const { data, error } = await supabase.from('profiles').insert({ id: currentUser.id, username, gender: selectedGender || null }).select('id, username, gender').single();
    if (error) {
      submit.disabled = false; submit.textContent = 'Enter the room ↗';
      errorBox.textContent = error.code === '23505' ? 'That name is already taken. Try another one.' : error.message;
      return;
    }
    currentProfile = data;
    await enterRoom();
  });
}
async function enterRoom() {
  shell(`<section class="chat"><div class="chat-layout">
    <aside class="sidebar"><div class="room-label">Your space</div><div class="room-title">The Common Room</div>
      <div class="online"><i class="dot"></i> Live room</div>
      <div class="side-note">A shared room for everyone.<br><br>Be curious. Be kind. Leave a little warmth behind.</div>
      <div class="privacy-note">You're here as <strong>${escape(currentProfile.username)}</strong>.<br>No email or password attached.</div>
    </aside>
    <div class="chat-main"><div class="chat-head"><div><strong>The Common Room</strong><br><span>Everyone is welcome here</span></div><span class="you-label">${escape(currentProfile.username)}</span></div>
      <div class="messages" id="messages"><div class="loading-line">Gathering the room…</div></div>
      <form class="composer" id="message-form"><div class="composebox"><input id="messageInput" maxlength="2000" placeholder="Leave a thought…" autocomplete="off" aria-label="Your message"><button class="send" type="submit">Send ↗</button></div><div class="footnote">Messages disappear after seven days · Keep it kind</div><p class="form-error" id="message-error" role="alert"></p></form>
    </div></div></section>`);
  await loadMessages();
  subscribeToMessages();
  root.querySelector('#message-form').addEventListener('submit', sendMessage);
}
function renderMessages() {
  const list = root.querySelector('#messages');
  if (!list) return;
  if (!messages.length) {
    list.innerHTML = '<div class="empty"><div class="empty-mark">✳</div><strong>A quiet room, for now.</strong><span>Leave the first thought.</span></div>';
    return;
  }
  list.innerHTML = messages.map((message) => {
    const mine = message.user_id === currentUser.id;
    const gender = message.user_id === currentUser.id ? currentProfile.gender : null;
    return `<article class="msg ${mine ? 'mine' : ''}">
      <div class="avatar">${escape(initials(message.username))}</div>
      <div class="bubble"><div class="meta"><b>${escape(message.username)}</b>${gender ? `<span class="gender-tag">${gender === 'man' ? 'Male' : 'Female'}</span>` : ''} · ${escape(timeAgo(message.created_at))}</div>
        <p>${escape(message.body).replace(/\n/g, '<br>')}</p><div class="expiry">${escape(expiryLabel(message.expires_at))}</div>
      </div></article>`;
  }).join('');
  list.scrollTop = list.scrollHeight;
}
async function loadMessages() {
  const { data, error } = await supabase.from('messages').select('id,user_id,username,body,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(100);
  if (error) {
    const list = root.querySelector('#messages');
    if (list) list.innerHTML = `<p class="error-text">Couldn't load messages: ${escape(error.message)}</p>`;
    return;
  }
  messages = data || [];
  renderMessages();
}
async function sendMessage(event) {
  event.preventDefault();
  const input = root.querySelector('#messageInput');
  const errorBox = root.querySelector('#message-error');
  const body = input.value.trim();
  if (!body) return;
  const button = root.querySelector('.send');
  button.disabled = true; errorBox.textContent = '';
  const { error } = await supabase.from('messages').insert({ user_id: currentUser.id, username: currentProfile.username, body });
  button.disabled = false;
  if (error) { errorBox.textContent = error.message; return; }
  input.value = '';
}
function subscribeToMessages() {
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel('whisper-public-room')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
      if (payload.eventType === 'INSERT' && new Date(payload.new.expires_at) > new Date()) {
        if (!messages.some((m) => m.id === payload.new.id)) messages.push(payload.new);
        messages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        messages = messages.slice(-100);
        renderMessages();
      }
      if (payload.eventType === 'DELETE') {
        messages = messages.filter((m) => m.id !== payload.old.id);
        renderMessages();
      }
    }).subscribe();
}
function boot() {
  if (!supabaseUrl || !supabaseKey) {
    shell(`<section class="page"><div class="center"><div class="eyebrow">One last setup step</div><h1 class="subhero">Connect Whisper.</h1><p class="lead">Add the Supabase project URL and publishable key as Vercel environment variables. See the README for the exact names.</p></div></section>`);
    return;
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  showWelcome();
}
boot();
