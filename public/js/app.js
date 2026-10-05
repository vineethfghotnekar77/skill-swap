/* ==========================================================
   SkillSwap — single-page frontend (vanilla JS, hash router)
   ========================================================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEPTS = ['Computer Science', 'Information Technology', 'Electronics', 'Electrical', 'Mechanical', 'Civil', 'Business', 'Design'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

let token = localStorage.getItem('ss_token');
let me = null;

/* ---------- API ---------- */
async function api(method, url, body, raw) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (raw && res.ok) return res;
  const d = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { clearAuth(); location.hash = '#/login'; }
  if (!res.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
function setAuth(t, u) { token = t; me = u; localStorage.setItem('ss_token', t); }
function clearAuth() { token = null; me = null; localStorage.removeItem('ss_token'); }

/* ---------- helpers ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'error' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3600);
}
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const stars = (n) => {
  const r = Math.round(n || 0);
  return `<span class="star">${'★'.repeat(r)}</span><span class="star dim">${'★'.repeat(5 - r)}</span>`;
};
const badge = (s) => `<span class="badge b-${esc(s)}">${esc(s)}</span>`;
const tags = (a, cls = '') => (a && a.length ? a.map((x) => `<span class="tag ${cls}">${esc(x)}</span>`).join('') : '<span class="muted">None yet</span>');
const bar = (pct, warn) => `<div class="bar ${warn ? 'warn' : ''}"><i style="width:${pct ?? 0}%"></i></div>`;
function ring(pct, label, size = 130) {
  const r = size / 2 - 9, c = 2 * Math.PI * r, v = pct == null ? 0 : Math.min(100, pct);
  const circle = (cls, extra = '') => `<circle class="${cls}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="9" ${extra}/>`;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}">${circle('tr')}${circle('pr', `stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"`)}</svg><div class="lbl" style="font-size:${size / 5.4}px">${pct == null ? '—' : pct + '%'}<small>${esc(label)}</small></div></div>`;
}
function table(head, rows) {
  return `<div class="tbl-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
    rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}" class="empty">Nothing here yet</td></tr>`
  }</tbody></table></div>`;
}
const chips = (name, skills, selected = []) =>
  `<div class="chips">${skills.map((s) => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(s.name)}" ${selected.includes(s.name) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div>`;
const checked = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
const opts = (list, sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + list.map((o) => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');
const act = (method, url, body, msg, extra = '') =>
  `data-act="call" data-m="${method}" data-url="${esc(url)}" data-body="${esc(JSON.stringify(body || {}))}" data-msg="${esc(msg || '')}" ${extra}`;

function modal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="glass modal">${html}<div style="margin-top:1.2rem;text-align:right"><button class="btn ghost sm" data-close>Close</button></div></div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.hasAttribute('data-close')) bg.remove(); });
  document.body.appendChild(bg);
}

async function refresh() { const y = scrollY; await route(); scrollTo(0, y); }

/* ---------- global event delegation ---------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (el) {
    if (el.dataset.confirm && !confirm(el.dataset.confirm)) return;
    if (el.dataset.act === 'call') {
      try {
        el.disabled = true;
        await api(el.dataset.m, el.dataset.url, JSON.parse(el.dataset.body || '{}'));
        if (el.dataset.msg) toast(el.dataset.msg);
        await refresh();
      } catch (err) { toast(err.message, 'error'); el.disabled = false; }
    }
  }
  if (e.target.closest('#burger')) $('#side').classList.toggle('open');
  else if (!e.target.closest('#side')) $('#side')?.classList.remove('open');
  if (e.target.closest('#logout')) {
    try { await api('POST', '/logout'); } catch { /* ignore */ }
    clearAuth(); location.hash = '#/'; toast('Logged out');
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-chg]');
  if (!el) return;
  try {
    await api('PATCH', el.dataset.chg, { [el.dataset.field]: el.value });
    toast('Updated');
    await refresh();
  } catch (err) { toast(err.message, 'error'); }
});

/* ---------- layout ---------- */
const NAV = {
  student: [['dashboard', 'Dashboard', '◈'], ['profile', 'Profile', '◉'], ['find', 'Find Skills', '⌕'], ['book', 'Book Session', '✦'],
    ['sessions', 'My Sessions', '▤'], ['attendance', 'Attendance', '✔'], ['leave', 'Leave Request', '⎋'], ['progress', 'Progress', '▲'], ['feedback', 'Feedback', '★']],
  admin: [['dashboard', 'Dashboard', '◈'], ['students', 'Manage Students', '◉'], ['skills', 'Manage Skills', '✦'],
    ['sessions', 'Manage Sessions', '▤'], ['attendance', 'Manage Attendance', '✔']]
};

function publicShell(inner) {
  const links = me
    ? `<a href="#/" class="hide-sm">Home</a><a class="btn sm" href="#/${me.role === 'admin' ? 'admin' : 'app'}/dashboard">Dashboard</a>`
    : `<a href="#/" class="hide-sm">Home</a><a href="#/login">Login</a><a class="btn sm" href="#/register">Register</a>`;
  return `<header class="nav"><a class="brand" href="#/"><span>SKILL<b>SWAP</b></span></a><div class="links">${links}</div></header>${inner}`;
}
function appShell(path, inner) {
  const base = me.role === 'admin' ? 'admin' : 'app';
  const items = NAV[me.role === 'admin' ? 'admin' : 'student'];
  let key = path.split('/')[2];
  if (key === 'user') key = 'find';
  const title = (items.find((i) => i[0] === key) || [0, 'Student Profile'])[1];
  return `<div class="app">
    <aside class="side" id="side">
      <a class="brand" href="#/"><span>SKILL<b>SWAP</b></span></a>
      <nav>${items.map(([k, l, i]) => `<a href="#/${base}/${k}" class="${k === key ? 'on' : ''}"><span>${i}</span>${l}</a>`).join('')}</nav>
      <div class="side-foot">
        <div class="me"><div class="av">${esc(initials(me.name))}</div><div><b>${esc(me.name)}</b><small>${me.role}</small></div></div>
        <button class="btn ghost sm" id="logout">Logout</button>
      </div>
    </aside>
    <main class="main">
      <header class="top"><button class="burger" id="burger" aria-label="Menu">☰</button><h1>${title}</h1>
        <span class="date">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span></header>
      <div class="content page-in">${inner}</div>
    </main></div>`;
}

/* ---------- router ---------- */
const routes = {
  '/': home, '/login': login, '/register': register,
  '/app/dashboard': dashboard, '/app/profile': profile, '/app/find': find, '/app/book': book, '/app/sessions': sessions,
  '/app/attendance': attendance, '/app/leave': leave, '/app/progress': progress, '/app/feedback': feedback,
  '/admin/dashboard': adminDashboard, '/admin/students': adminStudents, '/admin/skills': adminSkills,
  '/admin/sessions': adminSessions, '/admin/attendance': adminAttendance
};
let routeSeq = 0;
async function route() {
  const seq = ++routeSeq;
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  if (token && !me) {
    try { me = await api('GET', '/me'); } catch { clearAuth(); }
  }
  let fn = routes[path];
  const ctx = { q, path };
  if (path.startsWith('/app/user/')) { fn = viewUser; ctx.id = path.split('/')[3]; }
  if (!fn) { location.hash = '#/'; return; }
  const isApp = path.startsWith('/app/'), isAdmin = path.startsWith('/admin/');
  if ((isApp || isAdmin) && !me) { location.hash = '#/login'; return; }
  if (isAdmin && me.role !== 'admin') { location.hash = '#/app/dashboard'; return; }
  if (isApp && me.role === 'admin') { location.hash = '#/admin/dashboard'; return; }
  if ((path === '/login' || path === '/register') && me) { location.hash = me.role === 'admin' ? '#/admin/dashboard' : '#/app/dashboard'; return; }
  const root = $('#root');
  try {
    const out = await fn(ctx);
    if (seq !== routeSeq) return;
    root.innerHTML = isApp || isAdmin ? appShell(path, out.html) : publicShell(out.html);
    out.after?.();
    document.title = 'SkillSwap — ' + (isApp || isAdmin ? 'Dashboard' : 'Peer-to-Peer Skill Learning');
  } catch (err) {
    if (seq !== routeSeq) return;
    const html = `<div class="glass"><h3>Something went wrong</h3><p class="muted">${esc(err.message)}</p><br><a class="btn" href="#/">Back to home</a></div>`;
    root.innerHTML = isApp || isAdmin ? appShell(path, html) : publicShell(`<div class="wrap section">${html}</div>`);
  }
}
addEventListener('hashchange', () => { route(); scrollTo(0, 0); });
addEventListener('DOMContentLoaded', route);

/* =====================================================
   PUBLIC PAGES
   ===================================================== */
async function home() {
  const s = await api('GET', '/public');
  const steps = [
    ['01', 'Register', 'Create your profile and list the skills you can teach and the skills you want to learn.'],
    ['02', 'Find a skill', 'Search classmates who teach exactly what you want, filter by department, year and rating.'],
    ['03', 'Book a session', 'Pick a date, time and topic. Your peer teacher accepts and the session is locked in.'],
    ['04', 'Track everything', 'Attendance, leave requests, skill progress and feedback — all in one neon dashboard.']
  ];
  const html = `
  <section class="hero wrap"><div>
    <span class="kicker">Peer-to-Peer Learning Network</span>
    <h1>Teach what you know.<br><span>Learn what you don't.</span></h1>
    <p>SkillSwap connects students who want to learn with students who love to teach, then tracks every session, attendance mark and milestone along the way.</p>
    <div class="cta"><a class="btn" href="#/register">Join SkillSwap</a><a class="btn ghost" href="#/login">Login</a></div>
    <div class="hero-stats"><div><b>${s.students}</b><small>Students</small></div><div><b>${s.skills}</b><small>Skills</small></div><div><b>${s.sessions}</b><small>Sessions</small></div></div>
  </div></section>
  <section class="section"><div class="wrap"><h2>HOW IT WORKS</h2><p class="sub">Four steps from curiosity to mastery</p>
    <div class="grid g4">${steps.map(([n, t, d], i) => `<div class="glass hover step float" style="animation-delay:${i * .4}s"><div class="n">${n}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></div></section>
  <section class="section"><div class="wrap"><h2>POPULAR SKILLS</h2><p class="sub">What the campus is learning right now</p>
    <div class="grid g4">${s.popular.map((p) => `<div class="glass hover pop"><div><b>${esc(p.skill)}</b><div class="muted">${p.teachers} teacher${p.teachers === 1 ? '' : 's'}</div></div><span class="badge b-upcoming">${p.sessions} sessions</span></div>`).join('')}</div></div></section>
  <footer class="footer">SKILLSWAP · PEER-TO-PEER SKILL LEARNING &amp; ATTENDANCE MANAGEMENT SYSTEM</footer>`;
  return { html };
}

async function login() {
  const html = `<div class="auth"><form class="glass" id="f" novalidate>
    <h2>Welcome back</h2><p class="sub">Log in as a student or administrator.</p>
    <div class="err" id="err"></div>
    <div class="field"><label class="f">Email</label><input type="email" name="email" placeholder="you@college.edu" required autocomplete="username"></div>
    <div class="field"><label class="f">Password</label><input type="password" name="password" placeholder="••••••••" required autocomplete="current-password"></div>
    <button class="btn" style="width:100%">Login</button>
    <p class="muted" style="margin-top:1rem;text-align:center">New here? <a href="#/register">Create an account</a></p>
    <div class="demo"><b>Demo accounts</b> (click to fill)<br>
      Student: <code data-fill="student@skillswap.com|student123">student@skillswap.com</code><br>
      Admin: <code data-fill="admin@skillswap.com|admin123">admin@skillswap.com</code></div>
  </form></div>`;
  return {
    html,
    after() {
      const f = $('#f');
      f.addEventListener('click', (e) => {
        const c = e.target.closest('[data-fill]');
        if (c) { const [em, pw] = c.dataset.fill.split('|'); f.email.value = em; f.password.value = pw; }
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!f.email.value.trim() || !f.password.value) { $('#err').textContent = 'Enter your email and password'; return; }
        try {
          const r = await api('POST', '/login', { email: f.email.value, password: f.password.value });
          setAuth(r.token, r.user);
          toast('Welcome, ' + r.user.name.split(' ')[0]);
          location.hash = r.user.role === 'admin' ? '#/admin/dashboard' : '#/app/dashboard';
        } catch (err) { $('#err').textContent = err.message; }
      });
    }
  };
}

async function register() {
  const skills = await api('GET', '/skills');
  const html = `<div class="auth wide"><form class="glass" id="f" novalidate>
    <h2>Create your profile</h2><p class="sub">Tell us what you can teach and what you want to learn.</p>
    <div class="err" id="err"></div>
    <div class="row">
      <div class="field"><label class="f">Full name</label><input name="name" required placeholder="Rahul Sharma"></div>
      <div class="field"><label class="f">Email</label><input type="email" name="email" required placeholder="you@college.edu"></div>
    </div>
    <div class="row">
      <div class="field"><label class="f">Password</label><input type="password" name="password" required minlength="6" placeholder="Min. 6 characters" autocomplete="new-password"></div>
      <div class="field"><label class="f">Confirm password</label><input type="password" name="confirm" required autocomplete="new-password"></div>
    </div>
    <div class="row">
      <div class="field"><label class="f">Department</label><select name="department" required>${opts(DEPTS, '', 'Select department')}</select></div>
      <div class="field"><label class="f">Year</label><select name="year" required>${opts(YEARS, '', 'Select year')}</select></div>
    </div>
    <div class="field"><label class="f">Skills I can teach</label>${chips('teach', skills)}</div>
    <div class="field"><label class="f">Skills I want to learn</label>${chips('learn', skills)}</div>
    <button class="btn" style="width:100%">Register</button>
    <p class="muted" style="margin-top:1rem;text-align:center">Already registered? <a href="#/login">Login</a></p>
  </form></div>`;
  return {
    html,
    after() {
      const f = $('#f');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = (m) => { $('#err').textContent = m; scrollTo(0, 0); };
        if (!f.name.value.trim()) return err('Please enter your name');
        if (!/^\S+@\S+\.\S+$/.test(f.email.value)) return err('Enter a valid email address');
        if (f.password.value.length < 6) return err('Password must be at least 6 characters');
        if (f.password.value !== f.confirm.value) return err('Passwords do not match');
        if (!f.department.value || !f.year.value) return err('Select your department and year');
        try {
          const r = await api('POST', '/register', {
            name: f.name.value, email: f.email.value, password: f.password.value,
            department: f.department.value, year: f.year.value, teach: checked(f, 'teach'), learn: checked(f, 'learn')
          });
          setAuth(r.token, r.user);
          toast('Account created. Welcome to SkillSwap!');
          location.hash = '#/app/dashboard';
        } catch (ex) { err(ex.message); }
      });
    }
  };
}

/* =====================================================
   STUDENT PAGES
   ===================================================== */
async function dashboard() {
  const [ss, att] = await Promise.all([api('GET', '/sessions'), api('GET', '/attendance')]);
  me = await api('GET', '/me');
  const up = ss.filter((s) => ['pending', 'upcoming'].includes(s.status) && s.date >= today()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const requests = ss.filter((s) => s.myRole === 'teacher' && s.status === 'pending').length;
  const html = `
    <h2 class="welcome">Welcome, <span>${esc(me.name.split(' ')[0])}</span> 👋</h2>
    <p class="muted">Here is your learning command center.</p>
    <div class="quick">
      <a class="btn" href="#/app/find">Find Skills</a><a class="btn ghost" href="#/app/sessions">My Sessions</a>
      <a class="btn ghost" href="#/app/attendance">Attendance</a><a class="btn ghost" href="#/app/profile">My Profile</a>
    </div>
    ${requests ? `<div class="warnbox" style="border-color:rgba(0,229,255,.5);background:rgba(0,229,255,.08);color:#bdf6ff">⚡ You have <b>${requests}</b> new session request${requests > 1 ? 's' : ''}. <a href="#/app/sessions?tab=teaching">Review now →</a></div>` : ''}
    <div class="grid g4">
      <div class="glass stat"><div class="k">Upcoming sessions</div><div class="v">${up.length}</div><div class="s">Pending + confirmed</div></div>
      <div class="glass stat"><div class="k">Skills you teach</div><div class="v">${me.teach.length}</div><div class="s">${esc(me.teach.slice(0, 3).join(', ') || '—')}</div></div>
      <div class="glass stat"><div class="k">Skills you want</div><div class="v">${me.learn.length}</div><div class="s">${esc(me.learn.slice(0, 3).join(', ') || '—')}</div></div>
      <div class="glass stat"><div class="k">Your rating</div><div class="v">${me.reviews ? me.rating.toFixed(1) : '—'}</div><div class="s">${me.reviews} review${me.reviews === 1 ? '' : 's'}</div></div>
    </div><br>
    <div class="grid g2">
      <div class="glass"><h3>Upcoming sessions</h3>${table(['Skill', 'With', 'When', 'Status'],
        up.slice(0, 5).map((s) => [`<b>${esc(s.skill)}</b><div class="muted">${esc(s.topic)}</div>`,
          esc(s.myRole === 'teacher' ? s.learner : s.teacher) + `<div class="muted">${s.myRole === 'teacher' ? 'you teach' : 'you learn'}</div>`,
          `${fmtDate(s.date)}<div class="muted">${fmtTime(s.time)}</div>`, badge(s.status)]))}</div>
      <div class="glass" style="text-align:center"><h3>Attendance</h3>${ring(att.overall, 'Overall', 170)}
        <p class="muted" style="margin-top:.8rem">${att.attended} of ${att.total} sessions attended</p>
        ${att.overall !== null && att.overall < 75 ? '<div class="warnbox" style="margin-top:1rem">⚠ Your attendance is below 75%.</div>' : ''}</div>
    </div><br>
    <div class="grid g2">
      <div class="glass"><h3>Skills you teach</h3>${tags(me.teach)}</div>
      <div class="glass"><h3>Skills you want</h3>${tags(me.learn, 'want')}</div>
    </div>`;
  return { html };
}

async function profile() {
  const skills = await api('GET', '/skills');
  me = await api('GET', '/me');
  const html = `<form class="glass" id="f" novalidate style="max-width:860px">
    <div class="profile-head" style="margin-bottom:1.4rem"><div class="av">${esc(initials(me.name))}</div>
      <div><h2>${esc(me.name)}</h2><div class="muted">${esc(me.email)}</div><div>${stars(me.rating)} <span class="muted">${me.reviews ? me.rating.toFixed(1) : 'No ratings yet'}</span></div></div></div>
    <div class="row">
      <div class="field"><label class="f">Full name</label><input name="name" value="${esc(me.name)}" required></div>
      <div class="field"><label class="f">Availability</label><input name="availability" value="${esc(me.availability)}" placeholder="e.g. Weekdays 4–7 PM"></div>
    </div>
    <div class="row">
      <div class="field"><label class="f">Department</label><select name="department">${opts(DEPTS, me.department, 'Select')}</select></div>
      <div class="field"><label class="f">Year</label><select name="year">${opts(YEARS, me.year, 'Select')}</select></div>
    </div>
    <div class="field"><label class="f">Bio</label><textarea name="bio" maxlength="300" placeholder="A line about you">${esc(me.bio)}</textarea></div>
    <div class="field"><label class="f">Skills I can teach</label>${chips('teach', skills, me.teach)}</div>
    <div class="field"><label class="f">Skills I want to learn</label>${chips('learn', skills, me.learn)}</div>
    <div class="field"><label class="f">New password (optional)</label><input type="password" name="newPassword" placeholder="Leave blank to keep current" autocomplete="new-password"></div>
    <button class="btn">Save changes</button>
  </form>`;
  return {
    html,
    after() {
      const f = $('#f');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          me = await api('PUT', '/me', {
            name: f.name.value, availability: f.availability.value, department: f.department.value, year: f.year.value,
            bio: f.bio.value, teach: checked(f, 'teach'), learn: checked(f, 'learn'), newPassword: f.newPassword.value || undefined
          });
          toast('Profile saved');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  };
}

function teacherCard(t) {
  return `<div class="glass hover"><div class="person"><div class="av">${esc(initials(t.name))}</div>
    <div><h4>${esc(t.name)}</h4><div class="muted">${esc(t.department)} · ${esc(t.year)}</div></div></div>
    <div style="margin:.9rem 0 .5rem">${tags(t.teach)}</div>
    <div>${stars(t.rating)} <span class="muted">${t.reviews ? t.rating.toFixed(1) + ` (${t.reviews})` : 'New'} · ${t.completed} sessions taught</span></div>
    <div class="actions" style="margin-top:1rem"><a class="btn ghost sm" href="#/app/user/${t.id}">View Profile</a><a class="btn sm" href="#/app/book?teacher=${t.id}">Book</a></div></div>`;
}
async function find({ q }) {
  const skills = await api('GET', '/skills');
  const html = `<div class="glass" style="margin-bottom:1.2rem"><div class="toolbar" style="margin:0" id="filters">
      <div><label class="f">Search</label><input id="q" placeholder="Name or skill, e.g. Python" value="${esc(q.q || '')}"></div>
      <div><label class="f">Skill</label><select id="skill"><option value="">All skills</option>${skills.map((s) => `<option ${s.name === q.skill ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div><label class="f">Department</label><select id="department">${opts(DEPTS, '', 'Any')}</select></div>
      <div><label class="f">Year</label><select id="year">${opts(YEARS, '', 'Any')}</select></div>
      <div><label class="f">Min rating</label><select id="minRating"><option value="">Any</option><option value="3">3★ +</option><option value="4">4★ +</option><option value="4.5">4.5★ +</option></select></div>
    </div></div><div id="results" class="grid g3"></div>`;
  return {
    html,
    after() {
      let timer;
      const load = async () => {
        const p = new URLSearchParams();
        ['q', 'skill', 'department', 'year', 'minRating'].forEach((k) => { const v = $('#' + k).value.trim(); if (v) p.set(k, v); });
        try {
          const list = await api('GET', '/teachers?' + p);
          $('#results').innerHTML = list.length ? list.map(teacherCard).join('') : '<div class="glass muted" style="grid-column:1/-1;text-align:center">No students match these filters.</div>';
        } catch (err) { toast(err.message, 'error'); }
      };
      $('#filters').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 220); });
      load();
    }
  };
}

async function viewUser({ id }) {
  const u = await api('GET', '/users/' + id);
  const html = `<div class="grid g2" style="align-items:start">
    <div class="glass"><div class="profile-head"><div class="av">${esc(initials(u.name))}</div>
      <div><h2>${esc(u.name)}</h2><div class="muted">${esc(u.department)} · ${esc(u.year)}</div>
      <div style="margin-top:.4rem">${stars(u.rating)} <span class="muted">${u.reviews ? u.rating.toFixed(1) + ` (${u.reviews} reviews)` : 'No ratings yet'}</span></div></div></div>
      ${u.bio ? `<p style="margin:1.2rem 0;color:#b7c0e6">${esc(u.bio)}</p>` : '<br>'}
      <div class="metric"><span class="muted">Completed sessions taught</span><b>${u.completed}</b></div>
      <div class="metric"><span class="muted">Availability</span><b style="font-family:var(--body)">${esc(u.availability || 'Not specified')}</b></div>
      <h3 style="margin-top:1.4rem">Skills offered</h3>${tags(u.teach)}
      <h3 style="margin-top:1.2rem">Skills wanted</h3>${tags(u.learn, 'want')}
      <div class="actions" style="margin-top:1.6rem">${u.teach.length ? `<a class="btn" href="#/app/book?teacher=${u.id}">Request Learning Session</a>` : ''}<a class="btn ghost" href="#/app/find">← Back</a></div></div>
    <div class="glass"><h3>Reviews</h3>${u.reviewsList.length ? u.reviewsList.map((r) => `<div class="review"><div>${stars(r.rating)} <b>${esc(r.from)}</b> <span class="muted">· ${esc(r.skill || '')}</span></div>
      <p>${esc(r.text)}</p>${r.learned ? `<div class="muted">Learned: ${esc(r.learned)}</div>` : ''}</div>`).join('') : '<p class="muted">No reviews yet.</p>'}</div></div>`;
  return { html };
}

async function book({ q }) {
  const skills = await api('GET', '/skills');
  let pre = { skill: q.skill || '', teacher: q.teacher || '' };
  if (q.teacher) {
    try { const u = await api('GET', '/users/' + q.teacher); if (!pre.skill || !u.teach.includes(pre.skill)) pre.skill = u.teach[0] || ''; } catch { pre.teacher = ''; }
  }
  const html = `<form class="glass" id="f" novalidate style="max-width:760px">
    <h3>Request a learning session</h3><div class="err" id="err"></div>
    <div class="row">
      <div class="field"><label class="f">Skill</label><select name="skill" required><option value="">Choose a skill</option>${skills.map((s) => `<option ${s.name === pre.skill ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label class="f">Teacher</label><select name="teacherId" required><option value="">Choose skill first</option></select></div>
    </div>
    <div class="row">
      <div class="field"><label class="f">Date</label><input type="date" name="date" min="${today()}" required></div>
      <div class="field"><label class="f">Time</label><input type="time" name="time" value="16:00" required></div>
      <div class="field"><label class="f">Duration</label><select name="duration"><option value="30">30 minutes</option><option value="60" selected>1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></div>
    </div>
    <div class="field"><label class="f">Topic</label><input name="topic" maxlength="80" placeholder="e.g. Functions and recursion" required></div>
    <button class="btn">Send request</button>
  </form>`;
  return {
    html,
    after() {
      const f = $('#f');
      const loadTeachers = async () => {
        if (!f.skill.value) { f.teacherId.innerHTML = '<option value="">Choose skill first</option>'; return; }
        const list = await api('GET', '/teachers?skill=' + encodeURIComponent(f.skill.value));
        f.teacherId.innerHTML = list.length
          ? list.map((t) => `<option value="${t.id}" ${String(t.id) === String(pre.teacher) ? 'selected' : ''}>${esc(t.name)} — ★ ${t.rating || 'new'}</option>`).join('')
          : '<option value="">No teachers for this skill yet</option>';
        pre.teacher = '';
      };
      f.skill.addEventListener('change', loadTeachers);
      loadTeachers();
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!f.skill.value || !f.teacherId.value || !f.date.value || !f.time.value || !f.topic.value.trim()) { $('#err').textContent = 'Please fill in every field'; return; }
        try {
          await api('POST', '/sessions', { skill: f.skill.value, teacherId: f.teacherId.value, date: f.date.value, time: f.time.value, topic: f.topic.value, duration: f.duration.value });
          toast('Session requested! Waiting for the teacher to accept.');
          location.hash = '#/app/sessions';
        } catch (err) { $('#err').textContent = err.message; }
      });
    }
  };
}

async function sessions({ q }) {
  const all = await api('GET', '/sessions');
  const tab = q.tab === 'teaching' ? 'teaching' : 'learning';
  const list = all.filter((s) => s.myRole === (tab === 'teaching' ? 'teacher' : 'learner'));
  const rows = list.map((s) => {
    const who = tab === 'teaching' ? s.learner : s.teacher;
    const st = badge(s.status) + (s.attendance && s.attendance !== 'excused' ? ' ' + badge(s.attendance) : '') + (s.leavePending ? ' <span class="badge b-pending">leave asked</span>' : '');
    let a = '';
    if (tab === 'teaching') {
      if (s.status === 'pending') a = `<button class="btn good sm" ${act('PATCH', '/sessions/' + s.id, { action: 'accept' }, 'Session accepted')}>Accept</button><button class="btn danger sm" ${act('PATCH', '/sessions/' + s.id, { action: 'decline' }, 'Session declined')}>Decline</button>`;
      else if (s.status === 'upcoming') a = ['present', 'late', 'absent'].map((v) => `<button class="btn ${v === 'present' ? 'good' : v === 'absent' ? 'danger' : 'ghost'} sm" ${act('PATCH', '/sessions/' + s.id, { action: 'attendance', value: v }, 'Marked ' + v)}>${v}</button>`).join('')
        + `<button class="btn ghost sm" ${act('PATCH', '/sessions/' + s.id, { action: 'cancel' }, 'Session cancelled', 'data-confirm="Cancel this session?"')}>Cancel</button>`;
    } else {
      if (['pending', 'upcoming'].includes(s.status)) {
        a = `<button class="btn danger sm" ${act('PATCH', '/sessions/' + s.id, { action: 'cancel' }, 'Session cancelled', 'data-confirm="Cancel this session?"')}>Cancel</button>`;
        if (!s.leavePending) a += `<a class="btn ghost sm" href="#/app/leave?session=${s.id}">Request leave</a>`;
      } else if (s.status === 'completed' && !s.hasFeedback && s.attendance !== 'absent') a = `<a class="btn sm" href="#/app/feedback?session=${s.id}">Rate</a>`;
    }
    return [`<b>${esc(s.skill)}</b><div class="muted">${esc(s.topic)}</div>`, esc(who), `${fmtDate(s.date)}<div class="muted">${fmtTime(s.time)} · ${s.duration} min</div>`, st, `<div class="actions">${a}</div>`];
  });
  const html = `<div class="tabs"><a href="#/app/sessions?tab=learning" class="${tab === 'learning' ? 'on' : ''}">I'm learning</a><a href="#/app/sessions?tab=teaching" class="${tab === 'teaching' ? 'on' : ''}">I'm teaching</a></div>
    <div class="glass">${table(['Skill / Topic', tab === 'teaching' ? 'Learner' : 'Teacher', 'Date', 'Status', 'Actions'], rows)}</div>
    <div class="quick"><a class="btn" href="#/app/find">+ Book a new session</a></div>`;
  return { html };
}

async function attendance() {
  const a = await api('GET', '/attendance');
  const html = `${a.overall !== null && a.overall < 75 ? '<div class="warnbox">⚠ Your overall attendance is below 75%. Try not to miss upcoming sessions.</div>' : ''}
    <div class="grid g2" style="align-items:start">
      <div class="glass"><h3>Attendance by skill</h3><div class="bars">${a.skills.length ? a.skills.map((s) =>
        `<div class="line"><b>${esc(s.skill)}</b>${bar(s.pct, s.pct < 75)}<span>${s.attended}/${s.total} · ${s.pct}%</span></div>`).join('') : '<p class="muted">No attendance recorded yet.</p>'}</div></div>
      <div class="glass" style="text-align:center"><h3>Overall</h3>${ring(a.overall, 'Attendance', 190)}<p class="muted" style="margin-top:1rem">Present and late count as attended. Excused leave is not counted.</p></div>
    </div><br>
    <div class="glass"><h3>Session records</h3>${table(['Date', 'Skill', 'Topic', 'Teacher', 'Duration', 'Attendance'],
      a.records.map((r) => [fmtDate(r.date), esc(r.skill), esc(r.topic), esc(r.teacher), r.duration + ' min', badge(r.attendance)]))}</div>`;
  return { html };
}

async function leave({ q }) {
  const [ss, l] = await Promise.all([api('GET', '/sessions'), api('GET', '/leaves')]);
  const eligible = ss.filter((s) => s.myRole === 'learner' && ['pending', 'upcoming'].includes(s.status) && !s.leavePending);
  const html = `<div class="grid g2" style="align-items:start">
    <form class="glass" id="f" novalidate><h3>Request leave</h3><div class="err" id="err"></div>
      <div class="field"><label class="f">Session</label><select name="sessionId">${eligible.length ? eligible.map((s) => `<option value="${s.id}" ${String(s.id) === q.session ? 'selected' : ''}>${esc(s.skill)} · ${fmtDate(s.date)} ${fmtTime(s.time)} · ${esc(s.teacher)}</option>`).join('') : '<option value="">No eligible sessions</option>'}</select></div>
      <div class="field"><label class="f">Reason</label><textarea name="reason" maxlength="300" placeholder="Why can't you attend?"></textarea></div>
      <button class="btn" ${eligible.length ? '' : 'disabled'}>Submit request</button></form>
    <div class="glass"><h3>My requests</h3>${table(['Session', 'Reason', 'Status'], l.mine.map((x) => [`<b>${esc(x.skill)}</b><div class="muted">${fmtDate(x.date)}</div>`, esc(x.reason), badge(x.status)]))}</div>
  </div>
  ${l.incoming.length ? `<br><div class="glass"><h3>Leave requests from your learners</h3>${table(['Learner', 'Session', 'Reason', 'Status', 'Actions'], l.incoming.map((x) => [esc(x.learner), `${esc(x.skill)}<div class="muted">${fmtDate(x.date)}</div>`, esc(x.reason), badge(x.status),
    x.status === 'pending' ? `<div class="actions"><button class="btn good sm" ${act('PATCH', '/leaves/' + x.id, { status: 'approved' }, 'Leave approved')}>Approve</button><button class="btn danger sm" ${act('PATCH', '/leaves/' + x.id, { status: 'rejected' }, 'Leave rejected')}>Reject</button></div>` : '']))}</div>` : ''}`;
  return {
    html,
    after() {
      $('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        try {
          await api('POST', '/leaves', { sessionId: f.sessionId.value, reason: f.reason.value });
          toast('Leave request sent');
          refresh();
        } catch (err) { $('#err').textContent = err.message; }
      });
    }
  };
}

async function progress() {
  const list = await api('GET', '/progress');
  const icon = { done: '✅', doing: '🔄', todo: '⏳' };
  const next = { todo: 'doing', doing: 'done', done: 'todo' };
  const html = `<p class="muted" style="margin-bottom:1.2rem">Click a milestone to move it: ⏳ to do → 🔄 in progress → ✅ done.</p>
    <div class="grid g3">${list.length ? list.map((p) => `<div class="glass"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
      <div><h3 style="margin:0">${esc(p.skill)}</h3><div class="muted" style="margin-top:.3rem">Progress</div></div>${ring(p.pct, 'Done', 96)}</div>${bar(p.pct)}
      <div class="miles">${Object.entries(p.topics).map(([t, st]) => `<button class="mile ${st}" ${act('PUT', '/progress', { skill: p.skill, topic: t, status: next[st] })}><i>${icon[st]}</i>${esc(t)}<em>${st === 'doing' ? 'in progress' : st}</em></button>`).join('')}</div></div>`).join('')
      : '<div class="glass muted">Add skills you want to learn in your profile, or book a session, to start tracking progress.</div>'}</div>`;
  return { html };
}

async function feedback({ q }) {
  const f = await api('GET', '/feedback');
  const html = `<div class="grid g2" style="align-items:start">
    <form class="glass" id="f" novalidate><h3>Rate a completed session</h3><div class="err" id="err"></div>
      ${f.pending.length ? `<div class="field"><label class="f">Session</label><select name="sessionId">${f.pending.map((s) => `<option value="${s.id}" ${String(s.id) === q.session ? 'selected' : ''}>${esc(s.skill)} · ${esc(s.teacher)} · ${fmtDate(s.date)}</option>`).join('')}</select></div>
      <div class="field"><label class="f">Rating</label><div class="rate-input" id="rate">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-v="${n}">★</button>`).join('')}</div></div>
      <div class="field"><label class="f">Feedback</label><textarea name="text" maxlength="300" placeholder="How was the session?"></textarea></div>
      <div class="field"><label class="f">What did you learn?</label><input name="learned" maxlength="300" placeholder="e.g. List comprehensions"></div>
      <button class="btn">Submit feedback</button>` : '<p class="muted">No completed sessions waiting for feedback. 🎉</p>'}</form>
    <div class="glass"><h3>Feedback you received</h3>${f.received.length ? f.received.map((r) => `<div class="review"><div>${stars(r.rating)} <b>${esc(r.from)}</b> <span class="muted">· ${esc(r.skill || '')} · ${fmtDate(r.date)}</span></div><p>${esc(r.text)}</p>${r.learned ? `<div class="muted">Learned: ${esc(r.learned)}</div>` : ''}</div>`).join('') : '<p class="muted">No feedback yet.</p>'}</div>
  </div><br>
  <div class="glass"><h3>Feedback you gave</h3>${table(['Skill', 'Teacher', 'Rating', 'Comment', 'Date'], f.given.map((r) => [esc(r.skill), esc(r.to), stars(r.rating), esc(r.text), fmtDate(r.date)]))}</div>`;
  return {
    html,
    after() {
      const form = $('#f');
      if (!form.sessionId) return;
      let rating = 0;
      $('#rate').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        rating = +b.dataset.v;
        [...$('#rate').children].forEach((x, i) => x.classList.toggle('on', i < rating));
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!rating) { $('#err').textContent = 'Choose a star rating'; return; }
        try {
          await api('POST', '/feedback', { sessionId: form.sessionId.value, rating, text: form.text.value, learned: form.learned.value });
          toast('Thanks for your feedback!');
          refresh();
        } catch (err) { $('#err').textContent = err.message; }
      });
    }
  };
}

/* =====================================================
   ADMIN PAGES
   ===================================================== */
async function adminDashboard() {
  const s = await api('GET', '/admin/stats');
  const max = Math.max(1, ...s.popular.map((p) => p.sessions));
  const html = `<div class="grid g4">
    <div class="glass stat"><div class="k">Total students</div><div class="v">${s.totalStudents}</div></div>
    <div class="glass stat"><div class="k">Active sessions</div><div class="v">${s.activeSessions}</div><div class="s">Pending + upcoming</div></div>
    <div class="glass stat"><div class="k">Total skills</div><div class="v">${s.totalSkills}</div></div>
    <div class="glass stat"><div class="k">Average attendance</div><div class="v">${s.avgAttendance ?? '—'}${s.avgAttendance !== null ? '%' : ''}</div><div class="s">${s.attendanceRecords} records</div></div>
  </div><br>
  <div class="grid g2">
    <div class="glass"><h3>Most popular skills</h3><div class="bars">${s.popular.map((p) => `<div class="line"><b>${esc(p.skill)}</b>${bar(Math.round((p.sessions / max) * 100))}<span>${p.sessions}</span></div>`).join('')}</div></div>
    <div class="glass"><h3>Students with low attendance</h3>${table(['Student', 'Department', 'Attendance'],
      s.lowAttendance.map((x) => [esc(x.name), esc(x.department), `<span class="badge b-absent">${x.overall}%</span>`]))}<p class="muted" style="margin-top:.8rem">Below 75% overall.</p></div>
  </div><br>
  <div class="grid g2">
    <div class="glass"><h3>Sessions by status</h3><div class="actions">${Object.entries(s.statusCount).map(([k, v]) => `${badge(k)} <b style="margin-right:1rem">${v}</b>`).join('')}</div></div>
    <div class="glass"><h3>Recent session history</h3>${table(['Skill', 'Learner', 'Teacher', 'Date', 'Status'], s.recent.map((r) => [esc(r.skill), esc(r.learner), esc(r.teacher), fmtDate(r.date), badge(r.status)]))}</div>
  </div>`;
  return { html };
}

async function adminStudents() {
  const list = await api('GET', '/admin/students');
  const rows = (items) => items.map((u) => [`<b>${esc(u.name)}</b><div class="muted">${esc(u.email)}</div>`, `${esc(u.department)}<div class="muted">${esc(u.year)}</div>`,
    u.teach.length, u.attendance === null ? '—' : u.attendance + '%', u.sessions, u.blocked ? badge('blocked') : badge('approved').replace('approved', 'active'),
    `<div class="actions"><button class="btn ghost sm" data-view="${u.id}">Details</button>
      <button class="btn ${u.blocked ? 'good' : 'ghost'} sm" ${act('PATCH', `/admin/students/${u.id}/block`, {}, u.blocked ? 'Account unblocked' : 'Account blocked')}>${u.blocked ? 'Unblock' : 'Block'}</button>
      <button class="btn danger sm" ${act('DELETE', '/admin/students/' + u.id, {}, 'Student deleted', `data-confirm="Delete ${esc(u.name)} and all their sessions? This cannot be undone."`)}>Delete</button></div>`]);
  const head = ['Student', 'Dept / Year', 'Teaches', 'Attendance', 'Sessions', 'Status', 'Actions'];
  const html = `<div class="glass"><div class="toolbar"><div><label class="f">Search students</label><input id="s" placeholder="Name, email or department"></div></div><div id="tbl">${table(head, rows(list))}</div></div>`;
  return {
    html,
    after() {
      $('#s').addEventListener('input', (e) => {
        const n = e.target.value.toLowerCase();
        $('#tbl').innerHTML = table(head, rows(list.filter((u) => (u.name + u.email + u.department).toLowerCase().includes(n))));
      });
      $('#tbl').addEventListener('click', (e) => {
        const b = e.target.closest('[data-view]');
        if (!b) return;
        const u = list.find((x) => x.id === +b.dataset.view);
        modal(`<div class="profile-head"><div class="av">${esc(initials(u.name))}</div><div><h2>${esc(u.name)}</h2><div class="muted">${esc(u.email)}</div></div></div>
          <p class="muted" style="margin:1rem 0">${esc(u.bio || 'No bio')}</p>
          <div class="metric"><span class="muted">Department / Year</span><b style="font-family:var(--body)">${esc(u.department)} · ${esc(u.year)}</b></div>
          <div class="metric"><span class="muted">Rating</span><span>${stars(u.rating)} ${u.reviews ? u.rating : '—'}</span></div>
          <div class="metric"><span class="muted">Attendance</span><b>${u.attendance === null ? '—' : u.attendance + '%'}</b></div>
          <div class="metric"><span class="muted">Joined</span><b style="font-family:var(--body)">${fmtDate(u.createdAt.slice(0, 10))}</b></div>
          <h3 style="margin-top:1rem">Teaches</h3>${tags(u.teach)}<h3 style="margin-top:1rem">Wants to learn</h3>${tags(u.learn, 'want')}`);
      });
    }
  };
}

async function adminSkills() {
  const skills = await api('GET', '/skills');
  const html = `<div class="grid g2" style="align-items:start">
    <form class="glass" id="f" novalidate><h3>Add a skill</h3><div class="err" id="err"></div>
      <div class="field"><label class="f">Skill name</label><input name="name" placeholder="e.g. Cloud Computing" required></div>
      <div class="field"><label class="f">Category</label><input name="category" placeholder="e.g. Programming" value="General"></div>
      <button class="btn">Add skill</button></form>
    <div class="glass"><h3>All skills</h3>${table(['Skill', 'Category', 'Teachers', 'Sessions', ''], skills.map((s) => [`<b>${esc(s.name)}</b>`, esc(s.category), s.teachers, s.sessions,
      `<button class="btn danger sm" ${act('DELETE', '/admin/skills/' + s.id, {}, 'Skill removed', `data-confirm="Remove ${esc(s.name)}? It will be removed from all profiles."`)}>Remove</button>`]))}</div></div>`;
  return {
    html,
    after() {
      $('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        try { await api('POST', '/admin/skills', { name: f.name.value, category: f.category.value }); toast('Skill added'); refresh(); }
        catch (err) { $('#err').textContent = err.message; }
      });
    }
  };
}

async function adminSessions() {
  const list = await api('GET', '/admin/sessions');
  const STATUS = ['pending', 'upcoming', 'completed', 'cancelled'];
  const rows = (items) => items.map((s) => [`<b>${esc(s.skill)}</b><div class="muted">${esc(s.topic)}</div>`, esc(s.learner), esc(s.teacher), `${fmtDate(s.date)}<div class="muted">${fmtTime(s.time)}</div>`,
    s.status === 'excused' ? badge('excused') : `<select data-chg="/admin/sessions/${s.id}" data-field="status">${STATUS.map((o) => `<option ${o === s.status ? 'selected' : ''}>${o}</option>`).join('')}</select>`,
    `<button class="btn danger sm" ${act('DELETE', '/admin/sessions/' + s.id, {}, 'Session deleted', 'data-confirm="Delete this session permanently?"')}>Delete</button>`]);
  const head = ['Skill / Topic', 'Learner', 'Teacher', 'Date', 'Status', ''];
  const html = `<div class="glass"><div class="toolbar"><div><label class="f">Search</label><input id="s" placeholder="Skill, learner or teacher"></div>
    <div><label class="f">Status</label><select id="st"><option value="">All</option>${[...STATUS, 'excused'].map((o) => `<option>${o}</option>`).join('')}</select></div></div>
    <div id="tbl">${table(head, rows(list))}</div></div>`;
  return {
    html,
    after() {
      const apply = () => {
        const n = $('#s').value.toLowerCase(), st = $('#st').value;
        $('#tbl').innerHTML = table(head, rows(list.filter((s) => (!st || s.status === st) && (s.skill + s.learner + s.teacher).toLowerCase().includes(n))));
      };
      $('#s').addEventListener('input', apply);
      $('#st').addEventListener('change', apply);
    }
  };
}

async function adminAttendance() {
  const [skills, stats] = await Promise.all([api('GET', '/skills'), api('GET', '/admin/stats')]);
  const html = `<div class="grid g4" style="margin-bottom:1.2rem">
      <div class="glass stat"><div class="k">Records</div><div class="v">${stats.attendanceRecords}</div></div>
      <div class="glass stat"><div class="k">Average</div><div class="v">${stats.avgAttendance ?? '—'}${stats.avgAttendance !== null ? '%' : ''}</div></div>
      <div class="glass stat"><div class="k">Low attendance</div><div class="v">${stats.lowAttendance.length}</div><div class="s">students below 75%</div></div>
    </div>
    <div class="glass"><div class="toolbar" id="filters">
      <div><label class="f">Student / teacher / skill</label><input id="q" placeholder="Search"></div>
      <div><label class="f">Skill</label><select id="skill"><option value="">All</option>${skills.map((s) => `<option>${esc(s.name)}</option>`).join('')}</select></div>
      <div><label class="f">From</label><input type="date" id="from"></div>
      <div><label class="f">To</label><input type="date" id="to"></div>
      <button class="btn good" id="csv" type="button">⬇ Export CSV report</button></div>
      <div id="tbl"></div></div>`;
  const params = () => {
    const p = new URLSearchParams();
    ['q', 'skill', 'from', 'to'].forEach((k) => { const v = $('#' + k).value.trim(); if (v) p.set(k, v); });
    return p;
  };
  return {
    html,
    after() {
      let timer;
      const load = async () => {
        const rows = await api('GET', '/admin/attendance?' + params());
        $('#tbl').innerHTML = table(['Date', 'Skill', 'Learner', 'Teacher', 'Duration', 'Attendance (editable)'], rows.map((r) => [fmtDate(r.date),
          `<b>${esc(r.skill)}</b><div class="muted">${esc(r.topic)}</div>`, esc(r.learner), esc(r.teacher), r.duration + ' min',
          `<select data-chg="/admin/sessions/${r.id}" data-field="attendance">${['present', 'late', 'absent', 'excused'].map((o) => `<option ${o === r.attendance ? 'selected' : ''}>${o}</option>`).join('')}</select>`]));
      };
      $('#filters').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
      $('#csv').addEventListener('click', async () => {
        try {
          const res = await api('GET', '/admin/attendance/report?' + params(), null, true);
          const blob = await res.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `skillswap-attendance-${today()}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
          toast('Report downloaded');
        } catch (err) { toast(err.message, 'error'); }
      });
      load();
    }
  };
}
