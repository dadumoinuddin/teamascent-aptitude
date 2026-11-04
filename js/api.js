/* =============================================================
   TeamAscent — Data layer (BACKEND CONNECTOR)
   -------------------------------------------------------------
   >>> THIS IS THE ONLY FILE YOU SWAP FOR PRODUCTION <<<

   Every method is async and returns a Promise, exactly like a
   real API call. For the demo it is backed by localStorage so
   the whole site is fully functional on one machine / browser.

   To go live, reimplement each method against your backend
   (Firebase/Firestore, Supabase, or a REST API) keeping the
   SAME method names + return shapes. No other file changes.

   Method map (demo -> production):
     Admin.login            -> POST /auth/login
     Questions.list/save/.. -> /questions  (GET/POST/PUT/DELETE)
     Sessions.list/save/..  -> /sessions
     Participants.join      -> POST /sessions/:code/join
     Participants.submit    -> POST /participants/:id/submit
     Participants.block     -> PATCH /participants/:id
     Leaderboard.get        -> GET /sessions/:id/leaderboard
   ============================================================= */

const DB = (() => {
  const KEYS = {
    questions: "ascent.questions",
    sessions: "ascent.sessions",
    participants: "ascent.participants",
    me: "ascent.me",
    adminAuthed: "ascent.adminAuthed",
    seeded: "ascent.seeded.v2",
  };

  const read = (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const delay = (val, ms = 60) =>
    new Promise((res) => setTimeout(() => res(val), ms)); // mimic network

  /* ---------- Seed demo data so the site works immediately ---------- */
  function seed() {
    if (localStorage.getItem(KEYS.seeded)) return;

    // 15 placeholder aptitude questions (replace in Admin).
    const sample = [
      ["If 5 pens cost ₹60, what do 8 pens cost?", ["₹88", "₹96", "₹100", "₹108"], 1],
      ["Find the next number: 2, 6, 12, 20, ?", ["28", "30", "32", "24"], 1],
      ["Which is the odd one out?", ["Square", "Circle", "Triangle", "Cube"], 3],
      ["A train runs 60 km in 45 min. Its speed is?", ["70 km/h", "75 km/h", "80 km/h", "90 km/h"], 2],
      ["Synonym of 'Diligent'?", ["Lazy", "Hardworking", "Rude", "Clever"], 1],
      ["25% of 240 = ?", ["48", "50", "60", "64"], 2],
      ["If MONDAY is 123456, what is 36?", ["ND", "OD", "NA", "OA"], 1],
      ["The average of 10, 20, 30, 40 is?", ["20", "25", "30", "35"], 1],
      ["Complete: Hand is to Glove as Foot is to ___", ["Sock", "Shoe", "Toe", "Leg"], 1],
      ["A clock shows 3:15. Angle between hands?", ["0°", "7.5°", "15°", "30°"], 1],
      ["Which number is prime?", ["21", "27", "29", "33"], 2],
      ["Antonym of 'Expand'?", ["Grow", "Stretch", "Contract", "Widen"], 2],
      ["12 × 11 = ?", ["121", "131", "132", "144"], 2],
      ["Odd one out: 3, 5, 7, 9, 11", ["3", "9", "7", "11"], 1],
      ["Ratio 2:3 means for 10 of first, how many second?", ["12", "15", "18", "20"], 1],
    ].map((q, i) => ({
      id: uid("q"),
      order: i,
      text: q[0],
      options: q[1],
      correct: q[2],
      active: true,
      sample: true,
    }));
    write(KEYS.questions, sample);

    // One demo session starting 5 minutes from first load.
    const start = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const session = {
      id: uid("s"),
      title: "Weekly Aptitude Arena",
      code: "ASC01",
      startTime: start,
      durationMin: CONFIG.DEFAULTS.durationMin,
      perQuestionSec: CONFIG.DEFAULTS.perQuestionSec,
      joinWindowMin: CONFIG.DEFAULTS.joinWindowMin,
      closeAfterHours: CONFIG.DEFAULTS.closeAfterHours,
      status: "scheduled",
    };
    write(KEYS.sessions, [session]);
    write(KEYS.participants, []);
    localStorage.setItem(KEYS.seeded, "1");
  }
  seed();

  /* ---------- Session lifecycle helpers ----------
     A session opens at startTime and accepts joins for joinWindowMin
     (default 90). Each participant then runs their OWN durationMin test
     clock from when they begin. The board stays live until closeAfterHours.
       scheduled : before start
       live      : within the join window — code works, anyone can enter
       ended     : join window closed, results still live
       closed    : fully closed */
  function sessionState(s, now = Date.now()) {
    const start = new Date(s.startTime).getTime();
    const joinWindowMin = s.joinWindowMin != null ? s.joinWindowMin : 90;
    const joinEnd = start + joinWindowMin * 60000;
    const closeAt = start + s.closeAfterHours * 3600000;
    if (now < start) return { phase: "scheduled", start, joinEnd, closeAt };
    if (now >= closeAt) return { phase: "closed", start, joinEnd, closeAt };
    if (now < joinEnd) return { phase: "live", start, joinEnd, closeAt };
    return { phase: "ended", start, joinEnd, closeAt };
  }

  function scoreOf(participant, questions) {
    let score = 0;
    const map = {};
    questions.forEach((q) => (map[q.id] = q.correct));
    (participant.answers || []).forEach((a) => {
      if (a && a.qid in map && a.choice === map[a.qid]) score++;
    });
    return score;
  }

  return { KEYS, read, write, delay, sessionState, scoreOf };
})();

/* ===================== PUBLIC API ===================== */

const Admin = {
  login(password) {
    const ok = password === CONFIG.ADMIN_PASSWORD;
    if (ok) sessionStorage.setItem(DB.KEYS.adminAuthed, "1");
    return DB.delay({ ok });
  },
  isAuthed() {
    return sessionStorage.getItem(DB.KEYS.adminAuthed) === "1";
  },
  logout() {
    sessionStorage.removeItem(DB.KEYS.adminAuthed);
  },
};

const Questions = {
  list() {
    const q = DB.read(DB.KEYS.questions, []).slice().sort((a, b) => a.order - b.order);
    return DB.delay(q);
  },
  save(q) {
    const all = DB.read(DB.KEYS.questions, []);
    if (q.id) {
      const i = all.findIndex((x) => x.id === q.id);
      if (i >= 0) all[i] = { ...all[i], ...q };
    } else {
      q.id = uid("q");
      q.order = all.length;
      q.active = q.active ?? true;
      all.push(q);
    }
    DB.write(DB.KEYS.questions, all);
    return DB.delay(q);
  },
  remove(id) {
    let all = DB.read(DB.KEYS.questions, []).filter((x) => x.id !== id);
    all.forEach((x, i) => (x.order = i));
    DB.write(DB.KEYS.questions, all);
    return DB.delay({ ok: true });
  },
  move(id, dir) {
    const all = DB.read(DB.KEYS.questions, []).sort((a, b) => a.order - b.order);
    const i = all.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return DB.delay({ ok: false });
    [all[i].order, all[j].order] = [all[j].order, all[i].order];
    DB.write(DB.KEYS.questions, all);
    return DB.delay({ ok: true });
  },
  // Bulk import. Format per line:  Question | optA | optB | optC | optD | correctIndex(1-4)
  bulkImport(text, replace = false) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];
    lines.forEach((line, n) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length !== 6) {
        errors.push(`Line ${n + 1}: needs 6 fields separated by "|"`);
        return;
      }
      const correct = parseInt(parts[5], 10) - 1;
      if (isNaN(correct) || correct < 0 || correct > 3) {
        errors.push(`Line ${n + 1}: correct answer must be 1-4`);
        return;
      }
      parsed.push({ text: parts[0], options: parts.slice(1, 5), correct });
    });
    if (errors.length) return DB.delay({ ok: false, errors });
    let all = replace ? [] : DB.read(DB.KEYS.questions, []);
    parsed.forEach((p) => {
      all.push({ id: uid("q"), order: all.length, active: true, ...p });
    });
    DB.write(DB.KEYS.questions, all);
    return DB.delay({ ok: true, count: parsed.length });
  },
};

const Sessions = {
  list() {
    const s = DB.read(DB.KEYS.sessions, []).slice().sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );
    return DB.delay(s);
  },
  get(id) {
    return DB.delay(DB.read(DB.KEYS.sessions, []).find((s) => s.id === id) || null);
  },
  getByCode(code) {
    const s = DB.read(DB.KEYS.sessions, []).find((x) => String(x.code) === String(code));
    return DB.delay(s || null);
  },
  // The featured session: the next upcoming, else the current live/ended one.
  current() {
    const now = Date.now();
    const all = DB.read(DB.KEYS.sessions, []).slice().sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );
    const upcoming = all.find((s) => DB.sessionState(s, now).phase === "scheduled");
    const liveish = all.find((s) => ["live", "ended"].includes(DB.sessionState(s, now).phase));
    return DB.delay(liveish || upcoming || all[all.length - 1] || null);
  },
  save(s) {
    const all = DB.read(DB.KEYS.sessions, []);
    if (s.id) {
      const i = all.findIndex((x) => x.id === s.id);
      if (i >= 0) all[i] = { ...all[i], ...s };
    } else {
      s.id = uid("s");
      all.push(s);
    }
    DB.write(DB.KEYS.sessions, all);
    return DB.delay(s);
  },
  remove(id) {
    const all = DB.read(DB.KEYS.sessions, []).filter((x) => x.id !== id);
    DB.write(DB.KEYS.sessions, all);
    // also drop its participants
    const parts = DB.read(DB.KEYS.participants, []).filter((p) => p.sessionId !== id);
    DB.write(DB.KEYS.participants, parts);
    return DB.delay({ ok: true });
  },
  state(s) {
    return DB.sessionState(s);
  },
};

const Participants = {
  // Join flow: validates code, blocked status, and entry window.
  join({ name, email, code }) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    code = (code || "").trim();
    if (!name || !email || !code) return DB.delay({ ok: false, error: "All fields are required." });
    if (!/^\S+@\S+\.\S+$/.test(email)) return DB.delay({ ok: false, error: "Enter a valid email." });

    // codes are compared case-insensitively (5-char alphanumeric)
    const session = DB.read(DB.KEYS.sessions, []).find(
      (s) => String(s.code).toUpperCase() === String(code).toUpperCase()
    );
    if (!session) return DB.delay({ ok: false, error: "Invalid session code." });

    const st = DB.sessionState(session);
    if (st.phase === "closed")
      return DB.delay({ ok: false, error: "This session has closed." });
    if (Date.now() > st.joinEnd)
      return DB.delay({ ok: false, error: "The joining window has closed for this session." });

    const parts = DB.read(DB.KEYS.participants, []);
    const existing = parts.find(
      (p) => p.sessionId === session.id && p.email === email
    );
    if (existing && existing.blocked)
      return DB.delay({ ok: false, error: "You have been blocked from this session." });
    if (existing && existing.submittedAt)
      return DB.delay({ ok: false, error: "You have already completed this session.", participant: existing, session });

    let participant = existing;
    if (!participant) {
      participant = {
        id: uid("p"),
        sessionId: session.id,
        name,
        email,
        joinedAt: new Date().toISOString(),
        answers: [],
        blocked: false,
        submittedAt: null,
        score: null,
        testStartedAt: null, // their personal clock starts when they begin
        violations: 0,       // tab-switches / leaving the test
      };
      parts.push(participant);
      DB.write(DB.KEYS.participants, parts);
    }
    DB.write(DB.KEYS.me, { participantId: participant.id, sessionId: session.id });
    return DB.delay({ ok: true, participant, session });
  },

  me() {
    const ref = DB.read(DB.KEYS.me, null);
    if (!ref) return DB.delay(null);
    const p = DB.read(DB.KEYS.participants, []).find((x) => x.id === ref.participantId);
    const s = DB.read(DB.KEYS.sessions, []).find((x) => x.id === ref.sessionId);
    return DB.delay(p && s ? { participant: p, session: s } : null);
  },

  // Start the participant's personal test clock (once).
  beginTest(pid) {
    const parts = DB.read(DB.KEYS.participants, []);
    const p = parts.find((x) => x.id === pid);
    if (p && !p.testStartedAt) {
      p.testStartedAt = new Date().toISOString();
      DB.write(DB.KEYS.participants, parts);
    }
    return DB.delay({ ok: true, testStartedAt: p ? p.testStartedAt : null });
  },

  // Record one proctor violation (tab switch / leaving). Returns new count.
  flagViolation(pid) {
    const parts = DB.read(DB.KEYS.participants, []);
    const p = parts.find((x) => x.id === pid);
    if (!p) return DB.delay({ ok: false, count: 0 });
    p.violations = (p.violations || 0) + 1;
    DB.write(DB.KEYS.participants, parts);
    return DB.delay({ ok: true, count: p.violations });
  },

  recordAnswer(pid, qid, choice) {
    const parts = DB.read(DB.KEYS.participants, []);
    const p = parts.find((x) => x.id === pid);
    if (!p) return DB.delay({ ok: false });
    p.answers = (p.answers || []).filter((a) => a.qid !== qid);
    p.answers.push({ qid, choice });
    DB.write(DB.KEYS.participants, parts);
    return DB.delay({ ok: true });
  },

  submit(pid) {
    const parts = DB.read(DB.KEYS.participants, []);
    const p = parts.find((x) => x.id === pid);
    if (!p) return DB.delay({ ok: false });
    if (p.submittedAt) return DB.delay({ ok: true, score: p.score });
    const questions = DB.read(DB.KEYS.questions, []).filter((q) => q.active);
    p.score = DB.scoreOf(p, questions);
    p.submittedAt = new Date().toISOString();
    DB.write(DB.KEYS.participants, parts);
    return DB.delay({ ok: true, score: p.score });
  },

  listForSession(sessionId) {
    const parts = DB.read(DB.KEYS.participants, []).filter((p) => p.sessionId === sessionId);
    return DB.delay(parts);
  },

  setBlocked(pid, blocked) {
    const parts = DB.read(DB.KEYS.participants, []);
    const p = parts.find((x) => x.id === pid);
    if (p) p.blocked = blocked;
    DB.write(DB.KEYS.participants, parts);
    return DB.delay({ ok: true });
  },

  remove(pid) {
    const parts = DB.read(DB.KEYS.participants, []).filter((p) => p.id !== pid);
    DB.write(DB.KEYS.participants, parts);
    return DB.delay({ ok: true });
  },
};

const Leaderboard = {
  // Returns ranked, masked rows for a session (submitted participants only).
  get(sessionId) {
    const parts = DB.read(DB.KEYS.participants, [])
      .filter((p) => p.sessionId === sessionId && p.submittedAt && !p.blocked);
    parts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.submittedAt) - new Date(b.submittedAt); // earlier finish wins ties
    });
    const rows = parts.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      maskedName: maskName(p.name),
      maskedEmail: maskEmail(p.email),
      score: p.score,
      finishedAt: p.submittedAt,
      violations: p.violations || 0, // tab-switch count
    }));
    return DB.delay(rows);
  },
};

if (typeof window !== "undefined") {
  Object.assign(window, { DB, Admin, Questions, Sessions, Participants, Leaderboard });
}
