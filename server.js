const express = require('./lib/mini-express');
const path = require('path');
const crypto = require('crypto');
const { data, save, hash, makeUser } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const api = express.Router();
const PROGRESS_TOPICS = ['Basics', 'Core Concepts', 'Practice', 'Intermediate', 'Advanced', 'Project'];
const ATT = ['present', 'late', 'absent'];

/* ---------- helpers ---------- */
const today = () => new Date().toISOString().slice(0, 10);
const user = (id) => data.users.find((u) => u.id === id);
const clean = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean))];

function ratingOf(id) {
  const f = data.feedback.filter((x) => x.toId === id);
  return { rating: f.length ? +(f.reduce((a, b) => a + b.rating, 0) / f.length).toFixed(1) : 0, reviews: f.length };
}
const pub = (u) => u && {
  id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, year: u.year,
  bio: u.bio, availability: u.availability, teach: u.teach, learn: u.learn, blocked: u.blocked, ...ratingOf(u.id)
};
const enrich = (s, me) => ({
  ...s,
  teacher: user(s.teacherId)?.name || 'Deleted user',
  learner: user(s.learnerId)?.name || 'Deleted user',
  hasFeedback: data.feedback.some((f) => f.sessionId === s.id),
  myRole: me ? (s.teacherId === me.id ? 'teacher' : 'learner') : undefined,
  leavePending: data.leaves.some((l) => l.sessionId === s.id && l.status === 'pending')
});
const bySessionDesc = (a, b) => (b.date + b.time).localeCompare(a.date + a.time);

function attStats(learnerId) {
  const by = {};
  data.sessions
    .filter((s) => s.learnerId === learnerId && ATT.includes(s.attendance))
    .forEach((s) => {
      const b = (by[s.skill] = by[s.skill] || { skill: s.skill, total: 0, attended: 0 });
      b.total++;
      if (s.attendance !== 'absent') b.attended++;
    });
  const skills = Object.values(by).map((b) => ({ ...b, pct: Math.round((b.attended / b.total) * 1000) / 10 }));
  const total = skills.reduce((a, b) => a + b.total, 0);
  const attended = skills.reduce((a, b) => a + b.attended, 0);
  return { skills, total, attended, overall: total ? Math.round((attended / total) * 1000) / 10 : null };
}

function popularSkills(n = 6) {
  const count = {};
  data.sessions.forEach((s) => { if (s.status !== 'cancelled') count[s.skill] = (count[s.skill] || 0) + 1; });
  return Object.entries(count).map(([skill, sessions]) => ({
    skill, sessions, teachers: data.users.filter((u) => u.teach.includes(skill)).length
  })).sort((a, b) => b.sessions - a.sessions).slice(0, n);
}

function newToken(userId) {
  const t = crypto.randomBytes(24).toString('hex');
  data.tokens[t] = userId;
  return t;
}

const auth = (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const u = user(data.tokens[t]);
  if (!u) return res.status(401).json({ error: 'Please log in' });
  if (u.blocked) return res.status(403).json({ error: 'Your account has been blocked by the admin' });
  req.user = u;
  next();
};
const admin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' }));
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* ---------- public ---------- */
api.get('/public', (req, res) => {
  res.json({
    students: data.users.filter((u) => u.role === 'student').length,
    skills: data.skills.length,
    sessions: data.sessions.filter((s) => s.status !== 'cancelled').length,
    popular: popularSkills(8)
  });
});

api.get('/skills', (req, res) => {
  res.json(data.skills.map((s) => ({
    ...s,
    teachers: data.users.filter((u) => u.teach.includes(s.name) && !u.blocked).length,
    sessions: data.sessions.filter((x) => x.skill === s.name && x.status !== 'cancelled').length
  })).sort((a, b) => a.name.localeCompare(b.name)));
});

/* ---------- auth ---------- */
api.post('/register', (req, res) => {
  const { name, email, password, department, year, teach, learn } = req.body;
  if (!name || !email || !password) return bad(res, 'Name, email and password are required');
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter a valid email address');
  if (password.length < 6) return bad(res, 'Password must be at least 6 characters');
  if (data.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return bad(res, 'That email is already registered', 409);
  const u = makeUser({ name: name.trim(), email: email.trim().toLowerCase(), password, department, year, teach: clean(teach), learn: clean(learn) });
  data.users.push(u);
  const token = newToken(u.id);
  save();
  res.json({ token, user: pub(u) });
});

api.post('/login', (req, res) => {
  const { email, password } = req.body;
  const u = data.users.find((x) => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u || hash(String(password || ''), u.salt) !== u.hash) return bad(res, 'Invalid email or password', 401);
  if (u.blocked) return bad(res, 'Your account has been blocked by the admin', 403);
  const token = newToken(u.id);
  save();
  res.json({ token, user: pub(u) });
});

api.post('/logout', auth, (req, res) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  delete data.tokens[t];
  save();
  res.json({ ok: true });
});

api.get('/me', auth, (req, res) => res.json(pub(req.user)));

api.put('/me', auth, (req, res) => {
  const u = req.user;
  const { name, department, year, bio, availability, teach, learn, newPassword } = req.body;
  if (name !== undefined) { if (!name.trim()) return bad(res, 'Name cannot be empty'); u.name = name.trim(); }
  if (department !== undefined) u.department = department;
  if (year !== undefined) u.year = year;
  if (bio !== undefined) u.bio = String(bio).slice(0, 300);
  if (availability !== undefined) u.availability = String(availability).slice(0, 120);
  if (teach) u.teach = clean(teach);
  if (learn) u.learn = clean(learn);
  if (newPassword) {
    if (newPassword.length < 6) return bad(res, 'Password must be at least 6 characters');
    u.salt = crypto.randomBytes(8).toString('hex');
    u.hash = hash(newPassword, u.salt);
  }
  save();
  res.json(pub(u));
});

/* ---------- find skills / profiles ---------- */
api.get('/teachers', auth, (req, res) => {
  const { skill, q, department, year, minRating } = req.query;
  let list = data.users.filter((u) => u.role === 'student' && !u.blocked && u.teach.length && u.id !== req.user.id);
  if (skill) list = list.filter((u) => u.teach.includes(skill));
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((u) => u.name.toLowerCase().includes(needle) || u.teach.some((t) => t.toLowerCase().includes(needle)));
  }
  if (department) list = list.filter((u) => u.department === department);
  if (year) list = list.filter((u) => u.year === year);
  const out = list.map((u) => ({
    ...pub(u),
    completed: data.sessions.filter((s) => s.teacherId === u.id && s.status === 'completed').length
  })).filter((u) => !minRating || u.rating >= +minRating);
  out.sort((a, b) => b.rating - a.rating || b.completed - a.completed);
  res.json(out);
});

api.get('/users/:id', auth, (req, res) => {
  const u = user(+req.params.id);
  if (!u || u.role === 'admin') return bad(res, 'Student not found', 404);
  res.json({
    ...pub(u),
    completed: data.sessions.filter((s) => s.teacherId === u.id && s.status === 'completed').length,
    learnedCount: data.sessions.filter((s) => s.learnerId === u.id && s.status === 'completed').length,
    reviewsList: data.feedback.filter((f) => f.toId === u.id).sort((a, b) => b.id - a.id).slice(0, 6)
      .map((f) => ({ ...f, from: user(f.fromId)?.name || 'Student', skill: data.sessions.find((s) => s.id === f.sessionId)?.skill }))
  });
});

/* ---------- sessions ---------- */
api.get('/sessions', auth, (req, res) => {
  const mine = data.sessions.filter((s) => s.teacherId === req.user.id || s.learnerId === req.user.id);
  res.json(mine.sort(bySessionDesc).map((s) => enrich(s, req.user)));
});

api.post('/sessions', auth, (req, res) => {
  const { skill, teacherId, date, time, topic, duration } = req.body;
  const t = user(+teacherId);
  if (!t || t.role !== 'student' || t.blocked || !t.teach.includes(skill)) return bad(res, 'That student does not teach this skill');
  if (t.id === req.user.id) return bad(res, 'You cannot book a session with yourself');
  if (!date || date < today()) return bad(res, 'Pick today or a future date');
  if (!time) return bad(res, 'Pick a time');
  if (!topic || !topic.trim()) return bad(res, 'Enter a topic');
  if (data.sessions.some((s) => s.teacherId === t.id && s.date === date && s.time === time && ['pending', 'upcoming'].includes(s.status)))
    return bad(res, 'The teacher already has a session at that time. Choose another slot.', 409);
  const s = {
    id: data.next++, skill, teacherId: t.id, learnerId: req.user.id, date, time,
    duration: +duration || 60, topic: topic.trim().slice(0, 80), status: 'pending', attendance: null
  };
  data.sessions.push(s);
  save();
  res.json(enrich(s, req.user));
});

api.patch('/sessions/:id', auth, (req, res) => {
  const s = data.sessions.find((x) => x.id === +req.params.id);
  if (!s) return bad(res, 'Session not found', 404);
  const me = req.user;
  const isTeacher = s.teacherId === me.id;
  const isLearner = s.learnerId === me.id;
  if (!isTeacher && !isLearner) return bad(res, 'Not your session', 403);
  const { action, value } = req.body;

  if (action === 'accept' || action === 'decline') {
    if (!isTeacher) return bad(res, 'Only the teacher can do this', 403);
    if (s.status !== 'pending') return bad(res, 'Session is not pending');
    s.status = action === 'accept' ? 'upcoming' : 'cancelled';
  } else if (action === 'cancel') {
    if (!['pending', 'upcoming'].includes(s.status)) return bad(res, 'Session cannot be cancelled now');
    s.status = 'cancelled';
  } else if (action === 'attendance') {
    if (!isTeacher) return bad(res, 'Only the teacher can mark attendance', 403);
    if (!ATT.includes(value)) return bad(res, 'Invalid attendance value');
    if (!['upcoming', 'completed'].includes(s.status)) return bad(res, 'Accept the session before marking attendance');
    s.attendance = value;
    s.status = 'completed';
  } else return bad(res, 'Unknown action');
  save();
  res.json(enrich(s, me));
});

/* ---------- attendance ---------- */
api.get('/attendance', auth, (req, res) => {
  const stats = attStats(req.user.id);
  const records = data.sessions
    .filter((s) => s.learnerId === req.user.id && (ATT.includes(s.attendance) || s.attendance === 'excused'))
    .sort(bySessionDesc).map((s) => enrich(s, req.user));
  res.json({ ...stats, records });
});

/* ---------- leave requests ---------- */
api.get('/leaves', auth, (req, res) => {
  const withInfo = (l) => {
    const s = data.sessions.find((x) => x.id === l.sessionId);
    return { ...l, skill: s?.skill, date: s?.date, time: s?.time, teacher: user(s?.teacherId)?.name, learner: user(l.userId)?.name };
  };
  const mine = data.leaves.filter((l) => l.userId === req.user.id).sort((a, b) => b.id - a.id).map(withInfo);
  const incoming = data.leaves.filter((l) => data.sessions.find((s) => s.id === l.sessionId)?.teacherId === req.user.id)
    .sort((a, b) => b.id - a.id).map(withInfo);
  res.json({ mine, incoming });
});

api.post('/leaves', auth, (req, res) => {
  const { sessionId, reason } = req.body;
  const s = data.sessions.find((x) => x.id === +sessionId && x.learnerId === req.user.id);
  if (!s) return bad(res, 'Session not found', 404);
  if (!['pending', 'upcoming'].includes(s.status)) return bad(res, 'Leave can only be requested for upcoming sessions');
  if (!reason || reason.trim().length < 5) return bad(res, 'Please give a reason (at least 5 characters)');
  if (data.leaves.some((l) => l.sessionId === s.id && l.status === 'pending')) return bad(res, 'A leave request is already pending for this session', 409);
  const l = { id: data.next++, sessionId: s.id, userId: req.user.id, reason: reason.trim().slice(0, 300), status: 'pending', date: today() };
  data.leaves.push(l);
  save();
  res.json(l);
});

api.patch('/leaves/:id', auth, (req, res) => {
  const l = data.leaves.find((x) => x.id === +req.params.id);
  if (!l) return bad(res, 'Request not found', 404);
  const s = data.sessions.find((x) => x.id === l.sessionId);
  if (!s || (s.teacherId !== req.user.id && req.user.role !== 'admin')) return bad(res, 'Not allowed', 403);
  if (l.status !== 'pending') return bad(res, 'Already decided');
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return bad(res, 'Invalid status');
  l.status = status;
  if (status === 'approved') { s.attendance = 'excused'; s.status = 'excused'; }
  save();
  res.json(l);
});

/* ---------- progress ---------- */
function progressPct(topics) {
  const v = Object.values(topics);
  return Math.round(((v.filter((x) => x === 'done').length + v.filter((x) => x === 'doing').length * 0.5) / v.length) * 100);
}
api.get('/progress', auth, (req, res) => {
  const skills = new Set(req.user.learn);
  data.sessions.filter((s) => s.learnerId === req.user.id && s.status !== 'cancelled').forEach((s) => skills.add(s.skill));
  data.progress.filter((p) => p.userId === req.user.id).forEach((p) => skills.add(p.skill));
  const out = [...skills].map((skill) => {
    const p = data.progress.find((x) => x.userId === req.user.id && x.skill === skill);
    const topics = p ? p.topics : Object.fromEntries(PROGRESS_TOPICS.map((t) => [t, 'todo']));
    return { skill, topics, pct: progressPct(topics) };
  });
  res.json(out);
});

api.put('/progress', auth, (req, res) => {
  const { skill, topic, status } = req.body;
  if (!PROGRESS_TOPICS.includes(topic) || !['todo', 'doing', 'done'].includes(status)) return bad(res, 'Invalid progress update');
  let p = data.progress.find((x) => x.userId === req.user.id && x.skill === skill);
  if (!p) {
    p = { userId: req.user.id, skill, topics: Object.fromEntries(PROGRESS_TOPICS.map((t) => [t, 'todo'])) };
    data.progress.push(p);
  }
  p.topics[topic] = status;
  save();
  res.json({ skill, topics: p.topics, pct: progressPct(p.topics) });
});

/* ---------- feedback ---------- */
api.get('/feedback', auth, (req, res) => {
  const me = req.user.id;
  const info = (f) => ({ ...f, from: user(f.fromId)?.name, to: user(f.toId)?.name, skill: data.sessions.find((s) => s.id === f.sessionId)?.skill });
  res.json({
    pending: data.sessions.filter((s) => s.learnerId === me && s.status === 'completed' && s.attendance !== 'absent' && !data.feedback.some((f) => f.sessionId === s.id))
      .sort(bySessionDesc).map((s) => enrich(s, req.user)),
    received: data.feedback.filter((f) => f.toId === me).sort((a, b) => b.id - a.id).map(info),
    given: data.feedback.filter((f) => f.fromId === me).sort((a, b) => b.id - a.id).map(info)
  });
});

api.post('/feedback', auth, (req, res) => {
  const { sessionId, rating, text, learned } = req.body;
  const s = data.sessions.find((x) => x.id === +sessionId && x.learnerId === req.user.id && x.status === 'completed');
  if (!s) return bad(res, 'You can only review your completed sessions');
  if (data.feedback.some((f) => f.sessionId === s.id)) return bad(res, 'Feedback already submitted', 409);
  const r = +rating;
  if (!(r >= 1 && r <= 5)) return bad(res, 'Choose a rating from 1 to 5');
  const f = {
    id: data.next++, sessionId: s.id, fromId: req.user.id, toId: s.teacherId, rating: r,
    text: String(text || '').slice(0, 300), learned: String(learned || '').slice(0, 300), date: today()
  };
  data.feedback.push(f);
  save();
  res.json(f);
});

/* ---------- admin ---------- */
const adminApi = express.Router();
adminApi.use(auth, admin);

adminApi.get('/stats', (req, res) => {
  const students = data.users.filter((u) => u.role === 'student');
  const per = students.map((u) => ({ id: u.id, name: u.name, department: u.department, ...attStats(u.id) })).filter((x) => x.total > 0);
  const total = per.reduce((a, b) => a + b.total, 0);
  const attended = per.reduce((a, b) => a + b.attended, 0);
  const statusCount = {};
  data.sessions.forEach((s) => { statusCount[s.status] = (statusCount[s.status] || 0) + 1; });
  res.json({
    totalStudents: students.length,
    activeSessions: data.sessions.filter((s) => ['pending', 'upcoming'].includes(s.status)).length,
    totalSkills: data.skills.length,
    attendanceRecords: total,
    avgAttendance: total ? Math.round((attended / total) * 1000) / 10 : null,
    lowAttendance: per.filter((x) => x.overall < 75).sort((a, b) => a.overall - b.overall),
    popular: popularSkills(6),
    statusCount,
    recent: [...data.sessions].sort(bySessionDesc).slice(0, 6).map((s) => enrich(s))
  });
});

adminApi.get('/students', (req, res) => {
  res.json(data.users.filter((u) => u.role === 'student').map((u) => ({
    ...pub(u), createdAt: u.createdAt,
    attendance: attStats(u.id).overall,
    sessions: data.sessions.filter((s) => s.teacherId === u.id || s.learnerId === u.id).length
  })));
});

adminApi.patch('/students/:id/block', (req, res) => {
  const u = user(+req.params.id);
  if (!u || u.role === 'admin') return bad(res, 'Student not found', 404);
  u.blocked = !u.blocked;
  if (u.blocked) Object.keys(data.tokens).forEach((t) => { if (data.tokens[t] === u.id) delete data.tokens[t]; });
  save();
  res.json(pub(u));
});

adminApi.delete('/students/:id', (req, res) => {
  const id = +req.params.id;
  const u = user(id);
  if (!u || u.role === 'admin') return bad(res, 'Student not found', 404);
  const gone = new Set(data.sessions.filter((s) => s.teacherId === id || s.learnerId === id).map((s) => s.id));
  data.users = data.users.filter((x) => x.id !== id);
  data.sessions = data.sessions.filter((s) => !gone.has(s.id));
  data.feedback = data.feedback.filter((f) => !gone.has(f.sessionId));
  data.leaves = data.leaves.filter((l) => !gone.has(l.sessionId) && l.userId !== id);
  data.progress = data.progress.filter((p) => p.userId !== id);
  Object.keys(data.tokens).forEach((t) => { if (data.tokens[t] === id) delete data.tokens[t]; });
  save();
  res.json({ ok: true });
});

adminApi.post('/skills', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return bad(res, 'Skill name is required');
  if (data.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return bad(res, 'Skill already exists', 409);
  const s = { id: data.next++, name, category: String(req.body.category || 'General').trim() || 'General' };
  data.skills.push(s);
  save();
  res.json(s);
});

adminApi.delete('/skills/:id', (req, res) => {
  const s = data.skills.find((x) => x.id === +req.params.id);
  if (!s) return bad(res, 'Skill not found', 404);
  data.skills = data.skills.filter((x) => x.id !== s.id);
  data.users.forEach((u) => { u.teach = u.teach.filter((n) => n !== s.name); u.learn = u.learn.filter((n) => n !== s.name); });
  save();
  res.json({ ok: true });
});

adminApi.get('/sessions', (req, res) => {
  res.json([...data.sessions].sort(bySessionDesc).map((s) => enrich(s)));
});

adminApi.patch('/sessions/:id', (req, res) => {
  const s = data.sessions.find((x) => x.id === +req.params.id);
  if (!s) return bad(res, 'Session not found', 404);
  const { status, attendance } = req.body;
  if (status) {
    if (!['pending', 'upcoming', 'completed', 'cancelled'].includes(status)) return bad(res, 'Invalid status');
    s.status = status;
  }
  if (attendance) {
    if (![...ATT, 'excused'].includes(attendance)) return bad(res, 'Invalid attendance');
    s.attendance = attendance;
    s.status = attendance === 'excused' ? 'excused' : 'completed';
  }
  save();
  res.json(enrich(s));
});

adminApi.delete('/sessions/:id', (req, res) => {
  const id = +req.params.id;
  data.sessions = data.sessions.filter((s) => s.id !== id);
  data.feedback = data.feedback.filter((f) => f.sessionId !== id);
  data.leaves = data.leaves.filter((l) => l.sessionId !== id);
  save();
  res.json({ ok: true });
});

function attendanceRows(query) {
  const { q, skill, from, to } = query;
  let rows = data.sessions.filter((s) => ATT.includes(s.attendance) || s.attendance === 'excused');
  if (skill) rows = rows.filter((s) => s.skill === skill);
  if (from) rows = rows.filter((s) => s.date >= from);
  if (to) rows = rows.filter((s) => s.date <= to);
  rows = rows.sort(bySessionDesc).map((s) => enrich(s));
  if (q) {
    const n = q.toLowerCase();
    rows = rows.filter((s) => s.learner.toLowerCase().includes(n) || s.teacher.toLowerCase().includes(n) || s.skill.toLowerCase().includes(n));
  }
  return rows;
}
adminApi.get('/attendance', (req, res) => res.json(attendanceRows(req.query)));

adminApi.get('/attendance/report', (req, res) => {
  const rows = attendanceRows(req.query);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Date', 'Time', 'Skill', 'Topic', 'Learner', 'Teacher', 'Duration (min)', 'Attendance'];
  const csv = [head.map(esc).join(','), ...rows.map((r) => [r.date, r.time, r.skill, r.topic, r.learner, r.teacher, r.duration, r.attendance].map(esc).join(','))].join('\n');
  res.set('Content-Type', 'text/csv');
  res.send(csv);
});

app.use('/api/admin', adminApi);
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  SkillSwap is running → http://localhost:${PORT}`);
  console.log('  Admin:   admin@skillswap.com / admin123');
  console.log('  Student: student@skillswap.com / student123\n');
});
