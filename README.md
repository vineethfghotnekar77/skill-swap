# SkillSwap — Peer-to-Peer Skill Learning and Attendance Management System

Students teach and learn skills from each other, book sessions, and the platform tracks
**attendance, leave requests, skill progress and feedback**. Admins manage everything from a
separate dashboard. Neon / glass-morphism "futuristic" UI.

## Run it in VS Code

1. Install **Node.js 18 or newer** (https://nodejs.org).
2. Unzip, then in VS Code: **File → Open Folder → skillswap**.
3. Open the terminal (**Ctrl + `**) and run:

```bash
node server.js
```

4. Open **http://localhost:3000**

There is **no `npm install` step**. The project has zero dependencies.
(`npm start` and `npm run dev` also work. `dev` auto-restarts on changes.)
To use another port: `PORT=4000 node server.js` (Windows PowerShell: `$env:PORT=4000; node server.js`).

## Demo logins

| Role    | Email                    | Password     |
|---------|--------------------------|--------------|
| Admin   | admin@skillswap.com      | admin123     |
| Student | student@skillswap.com    | student123   |

Other seeded students (`priya@`, `arjun@`, `sneha@`, `karthik@`, `meera@`, `vikram@`, `ananya@skillswap.com`) all use `student123`.
Sample sessions, attendance, feedback and progress are generated on first run.
To start over with fresh sample data: stop the server, run `npm run reset-db`, start again.

## Pages (matches your site map)

**Public:** Home · Register · Login

**Student:** Dashboard · Profile · Find Skills · Student Profile · Book Session · My Sessions ·
Attendance · Leave Request · Progress · Feedback

**Admin:** Dashboard · Manage Students · Manage Skills · Manage Sessions · Manage Attendance

## How the main flows work

1. Learner searches **Find Skills** → opens a **Student Profile** → **Book Session** (status: *pending*).
2. Teacher opens **My Sessions → I'm teaching** and **Accepts** (status: *upcoming*) or Declines.
3. After the session the teacher marks **Present / Late / Absent** → session becomes *completed*.
4. Learner sees attendance per skill and overall on **Attendance** (present + late count as attended;
   below 75% shows a warning). Learner can then leave **Feedback** and a star rating.
5. If the learner can't attend, they file a **Leave Request**. When the teacher approves, the session is marked
   *excused* and is excluded from the attendance percentage.
6. **Progress** shows 6 milestones per skill (click to cycle to do → in progress → done).
7. Admin can block/delete students, add/remove skills, change session status, **correct any attendance
   record**, search/filter by student/skill/date, and **export a CSV attendance report**.

## Project structure

```
skillswap/
├── server.js            Backend: REST API, auth, business rules
├── db.js                JSON-file database + seed data  (data/db.json is auto-created)
├── lib/mini-express.js  Tiny Express-style router so no packages are needed
└── public/              Frontend (served by the backend)
    ├── index.html
    ├── css/style.css    Futuristic theme
    └── js/
        ├── app.js       All pages, hash router, API calls
        └── bg.js        Animated particle-network background
```

## Suggested split for a team of three

- **Member 1 – Frontend/UI:** `public/css/style.css`, Home / Login / Register / Dashboard / Find Skills / Profile / Book Session views in `public/js/app.js`
- **Member 2 – Backend/Database:** `server.js`, `db.js` (users, skills, sessions, attendance, leaves, feedback, progress)
- **Member 3 – Attendance, Admin & Testing:** Attendance, Leave, Progress, Feedback, and all Admin views; test cases and report

## API summary (all under `/api`)

`POST /register /login /logout` · `GET/PUT /me` · `GET /skills` · `GET /teachers` · `GET /users/:id` ·
`GET/POST /sessions` · `PATCH /sessions/:id` · `GET /attendance` · `GET/POST /leaves` · `PATCH /leaves/:id` ·
`GET/PUT /progress` · `GET/POST /feedback` ·
Admin (`/api/admin`): `GET /stats /students /sessions /attendance /attendance/report` ·
`PATCH /students/:id/block` · `DELETE /students/:id` · `POST/DELETE /skills` · `PATCH/DELETE /sessions/:id`

## Notes

- Passwords are salted + hashed (scrypt). Login uses bearer tokens stored server-side.
- The UI loads the Orbitron / Rajdhani fonts from Google Fonts; offline it falls back to system fonts.
- Data lives in `data/db.json`. It is fine for a lab project; swap `db.js` for MySQL/MongoDB if your course requires it.
