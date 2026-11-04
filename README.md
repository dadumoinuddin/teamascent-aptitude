# TeamAscent · Aptitude Arena

A pixel-themed, cinematic aptitude-test platform for a college club. Zero build step —
pure HTML/CSS/JS. Open `index.html` or visit the GitHub Pages URL.

## Pages
- **index.html** — cinematic landing (hero video loop + 16-bit pixel climber canvas).
- **join.html** — lobby: enter name, email, and the 5-character session code.
- **test.html** — the timed test (per-participant 15-min clock, proctor, live ping).
- **leaderboard.html** — 16-bit pixel podium + full standings (masked, auto-refresh).
- **admin.html** — questions, sessions, participants (password-gated).

## How it works
- A session opens at its start time and accepts joins for a **90-minute window**
  (adjustable). Each participant then runs their own **15-minute** test clock.
- 15 questions, 4-option MCQ, **+1 each, no negative**, ties broken by finish time.
- **Proctor:** leaving the test (tab switch / blur / back) triggers a strict **3/3**
  warning; the 3rd strike auto-submits. Tab-switch counts show on the leaderboard.
- **Live ping** on the test page flags connection trouble with a `!`.

## Demo data
Seeded on first load: session code **`ASC01`**, starting ~5 min out. In **admin →
Sessions**, use **"Set start = now"** to begin immediately. Bulk-import your own
questions in admin (`Question | A | B | C | D | correct(1-4)`).

## ⚠️ Security notes (demo build)
- This is a **front-end demo**: all data lives in the browser (`localStorage`). The
  admin "password" lives in `js/config.js` and is therefore **visible to anyone** — it
  is **not** real security. Real auth + shared multi-device data arrive when the data
  layer (`js/api.js`) is pointed at a backend (Firebase / Supabase / REST). `js/api.js`
  is written so that swap is the *only* file that changes.
- Do not treat the current admin password as a secret.

## Going to production
Reimplement each method in `js/api.js` against your backend, keeping the same method
names and return shapes. Nothing else changes.
