/* =============================================================
   TeamAscent Aptitude Test — Global configuration
   -------------------------------------------------------------
   Edit club branding + default session timing here.
   ============================================================= */

const CONFIG = {
  // --- Branding (from teamascent.in) ---
  CLUB_NAME: "TeamAscent",
  CLUB_SHORT: "ASCENT",
  TAGLINE: "Rise Through The Ranks",
  SITE_SOURCE: "teamascent.in",

  // --- Admin (DEMO ONLY) ---
  // In production this check moves to the backend (see js/api.js header).
  ADMIN_PASSWORD: "moinrules",

  // --- Default session timing (all adjustable per-session in admin) ---
  DEFAULTS: {
    durationMin: 15,     // each participant's personal test length
    perQuestionSec: 60,  // 1 min per question
    joinWindowMin: 90,   // code works for this long after start (1h30m)
    closeAfterHours: 3,  // leaderboard freezes / session closes
    questionCount: 15,
  },

  // --- Live update cadence ---
  LEADERBOARD_REFRESH_MS: 30000, // 30s
  COUNTDOWN_TICK_MS: 1000,

  // --- Anti-cheat proctor ---
  PROCTOR: {
    maxStrikes: 3, // leaving the test 3 times ends the attempt
  },

  // --- Network ping shown during the test ---
  // In production point `url` at a tiny backend health endpoint; for the demo
  // it probes a small same-origin file, so it reflects latency to the server.
  PING: {
    url: "js/config.js",
    intervalMs: 3000,
    warnMs: 350,     // above this = shaky connection (!)
    timeoutMs: 4000, // no answer = internet issue (!)
  },
};

if (typeof window !== "undefined") window.CONFIG = CONFIG;
