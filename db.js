// Tiny JSON-file database + seed data (no native modules, works everywhere)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, 'data');
const FILE = path.join(DIR, 'db.json');

const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

let data;

function makeUser(o) {
  const { password, ...rest } = o;
  const salt = crypto.randomBytes(8).toString('hex');
  return {
    id: data.next++,
    role: 'student',
    blocked: false,
    bio: '',
    availability: '',
    department: '',
    year: '',
    teach: [],
    learn: [],
    ...rest,
    salt,
    hash: hash(password, salt),
    createdAt: new Date().toISOString()
  };
}

function save() {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function seed() {
  data = { next: 1, users: [], skills: [], sessions: [], feedback: [], leaves: [], progress: [], tokens: {} };

  const skills = [
    ['Python', 'Programming'], ['JavaScript', 'Programming'], ['React', 'Web'], ['Web Development', 'Web'],
    ['C Programming', 'Programming'], ['Java', 'Programming'], ['Machine Learning', 'AI & Data'],
    ['Data Structures', 'Programming'], ['SQL', 'AI & Data'], ['UI/UX Design', 'Design'],
    ['Photoshop', 'Design'], ['Public Speaking', 'Soft Skills']
  ];
  skills.forEach(([name, category]) => data.skills.push({ id: data.next++, name, category }));

  data.users.push(makeUser({ name: 'Admin', email: 'admin@skillswap.com', password: 'admin123', role: 'admin', department: 'Administration' }));

  const people = [
    ['Rahul Sharma', 'student@skillswap.com', 'Computer Science', '3rd Year', ['Python', 'C Programming'], ['React', 'Machine Learning'], 'Loves building small tools and explaining code.', 'Weekdays 4–7 PM'],
    ['Priya Nair', 'priya@skillswap.com', 'Computer Science', '3rd Year', ['Python', 'Machine Learning', 'Data Structures'], ['UI/UX Design'], 'ML enthusiast and Kaggle regular.', 'Mon, Wed, Fri evenings'],
    ['Arjun Mehta', 'arjun@skillswap.com', 'Information Technology', '2nd Year', ['React', 'JavaScript', 'Web Development'], ['Python'], 'Frontend dev, design nerd.', 'Weekends'],
    ['Sneha Iyer', 'sneha@skillswap.com', 'Design', '2nd Year', ['UI/UX Design', 'Photoshop'], ['JavaScript', 'Python'], 'Figma over everything.', 'Tue, Thu 5–8 PM'],
    ['Karthik Rao', 'karthik@skillswap.com', 'Computer Science', '4th Year', ['Java', 'SQL', 'Data Structures'], ['Machine Learning'], 'Placement-prep mentor.', 'Weekdays after 6 PM'],
    ['Meera Das', 'meera@skillswap.com', 'Information Technology', '3rd Year', ['Machine Learning', 'SQL'], ['React'], 'Data and dashboards.', 'Sat & Sun mornings'],
    ['Vikram Singh', 'vikram@skillswap.com', 'Electronics', '2nd Year', ['Public Speaking', 'C Programming'], ['Python'], 'Debate club captain.', 'Weekdays 5–6 PM'],
    ['Ananya Reddy', 'ananya@skillswap.com', 'Computer Science', '1st Year', ['Web Development', 'JavaScript'], ['Java'], 'Just started, loves HTML/CSS.', 'Flexible']
  ];
  people.forEach(([name, email, department, year, teach, learn, bio, availability]) =>
    data.users.push(makeUser({ name, email, password: 'student123', department, year, teach, learn, bio, availability })));

  const uid = (first) => data.users.find((u) => u.name.startsWith(first)).id;
  const topics = ['Introduction', 'Core concepts', 'Hands-on practice', 'Problem solving', 'Mini project', 'Review & Q&A'];
  const texts = [
    ['Super clear explanations, very patient.', 'Understood loops and functions properly.'],
    ['Great pace and lots of examples.', 'Learned how to structure a small project.'],
    ['Helpful and well prepared.', 'Cleared my doubts on core concepts.']
  ];
  let fbCount = 0;

  // pattern: p=present l=late a=absent
  function past(learner, teacher, skill, pattern, startDaysAgo) {
    [...pattern].forEach((c, i) => {
      const s = {
        id: data.next++, skill, teacherId: uid(teacher), learnerId: uid(learner),
        date: iso(-(startDaysAgo - i * 3)), time: '16:00', duration: 60,
        topic: topics[i % topics.length], status: 'completed',
        attendance: c === 'p' ? 'present' : c === 'l' ? 'late' : 'absent'
      };
      data.sessions.push(s);
      if (c !== 'a' && fbCount++ % 2 === 0) {
        const t = texts[fbCount % texts.length];
        data.feedback.push({
          id: data.next++, sessionId: s.id, fromId: s.learnerId, toId: s.teacherId,
          rating: fbCount % 3 === 0 ? 4 : 5, text: t[0], learned: t[1], date: s.date
        });
      }
    });
  }
  function upcoming(learner, teacher, skill, inDays, time, topic, status) {
    data.sessions.push({
      id: data.next++, skill, teacherId: uid(teacher), learnerId: uid(learner),
      date: iso(inDays), time, duration: 60, topic, status, attendance: null
    });
  }

  past('Rahul', 'Arjun', 'React', 'pppplpap', 40);
  past('Rahul', 'Priya', 'Machine Learning', 'pppppp', 36);
  past('Vikram', 'Rahul', 'Python', 'pplap', 30);
  past('Sneha', 'Arjun', 'JavaScript', 'pppl', 24);
  past('Karthik', 'Priya', 'Machine Learning', 'ppapl', 28);
  past('Meera', 'Arjun', 'React', 'pppp', 22);
  past('Ananya', 'Karthik', 'Java', 'ppap', 20);
  past('Arjun', 'Priya', 'Python', 'ppppl', 26);

  upcoming('Rahul', 'Arjun', 'React', 2, '16:00', 'State & hooks', 'upcoming');
  upcoming('Rahul', 'Priya', 'Machine Learning', 4, '17:30', 'Model evaluation', 'pending');
  upcoming('Vikram', 'Rahul', 'Python', 3, '17:00', 'OOP basics', 'upcoming');
  upcoming('Sneha', 'Rahul', 'Python', 5, '18:00', 'Functions', 'pending');
  upcoming('Meera', 'Priya', 'Machine Learning', 6, '10:00', 'Neural networks intro', 'pending');

  const R = uid('Rahul');
  data.progress.push({ userId: R, skill: 'React', topics: { Basics: 'done', 'Core Concepts': 'done', Practice: 'doing', Intermediate: 'todo', Advanced: 'todo', Project: 'todo' } });
  data.progress.push({ userId: R, skill: 'Machine Learning', topics: { Basics: 'done', 'Core Concepts': 'done', Practice: 'done', Intermediate: 'done', Advanced: 'doing', Project: 'todo' } });

  save();
}

if (fs.existsSync(FILE)) {
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { seed(); }
} else {
  seed();
}

module.exports = { get data() { return data; }, save, hash, makeUser };
