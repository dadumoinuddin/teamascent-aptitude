/* =============================================================
   TeamAscent — Shared UI helpers, logo, header/footer, masking
   ============================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Logo (self-made pixel wordmark) ----------
   A chunky pixel "A" peak / mountain glyph. Swap this single
   function to drop in the real teamascent.in logo later. */
function logoMark(size = 40) {
  return `
  <svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 24 24"
       shape-rendering="crispEdges" aria-hidden="true">
    <!-- back peak -->
    <polygon points="4,21 10,8 16,21" fill="var(--accent-2)"/>
    <!-- front peak -->
    <polygon points="10,21 16,5 22,21" fill="var(--accent)"/>
    <!-- snow caps -->
    <polygon points="14.3,9 16,5 17.7,9 16,8" fill="#fff"/>
    <polygon points="8.7,12 10,8 11.3,12 10,11" fill="#fff"/>
    <!-- rising sun pixel -->
    <rect x="2" y="3" width="3" height="3" fill="var(--accent-3)"/>
  </svg>`;
}

function logoFull(size = 40) {
  return `
  <a class="brand" href="index.html" aria-label="${CONFIG.CLUB_NAME} home">
    ${logoMark(size)}
    <span class="brand-text">
      <span class="brand-name">${CONFIG.CLUB_SHORT}</span>
      <span class="brand-sub">APTITUDE</span>
    </span>
  </a>`;
}

/* ---------- Header / nav ---------- */
function renderHeader(active = "") {
  const links = [
    { href: "index.html", label: "Home", key: "home" },
    { href: "join.html", label: "Enter Session", key: "join" },
    { href: "leaderboard.html", label: "Leaderboard", key: "leaderboard" },
    { href: "admin.html", label: "Admin", key: "admin" },
  ];
  const nav = links
    .map(
      (l) =>
        `<a href="${l.href}" class="nav-link ${l.key === active ? "is-active" : ""}">${l.label}</a>`
    )
    .join("");
  const host = $("#site-header");
  if (host) {
    host.innerHTML = `
      <div class="header-inner">
        ${logoFull(36)}
        <nav class="nav">${nav}</nav>
        <button class="nav-toggle" aria-label="Menu">▦</button>
      </div>`;
    const toggle = $(".nav-toggle", host);
    const navEl = $(".nav", host);
    if (toggle) toggle.addEventListener("click", () => navEl.classList.toggle("open"));
  }
}

function renderFooter() {
  const host = $("#site-footer");
  if (host) {
    host.innerHTML = `
      <div class="footer-inner">
        <span>${logoMark(22)}</span>
        <span>${CONFIG.CLUB_NAME} · Aptitude Arena</span>
        <span class="footer-dim">Demo build · backend-ready</span>
      </div>`;
  }
}

/* ---------- Masking ---------- */
function maskName(name = "") {
  const n = String(name).trim();
  if (!n) return "•••";
  if (n.length <= 2) return n[0] + "•";
  return n[0] + "•".repeat(Math.min(n.length - 2, 5)) + n[n.length - 1];
}

function maskEmail(email = "") {
  const e = String(email).trim();
  const at = e.indexOf("@");
  if (at < 1) return "•••";
  const local = e.slice(0, at);
  const domain = e.slice(at); // includes @
  const shown = local.slice(0, Math.min(2, local.length));
  return shown + "•".repeat(Math.max(3, local.length - 2)) + domain;
}

/* ---------- Time ---------- */
function clampMs(ms) {
  return ms < 0 ? 0 : ms;
}

function fmtClock(ms) {
  ms = clampMs(ms);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- Misc ---------- */
function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function toast(msg, kind = "info") {
  let host = $("#toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = `toast toast-${kind}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

if (typeof window !== "undefined") {
  Object.assign(window, {
    $, $$, logoMark, logoFull, renderHeader, renderFooter,
    maskName, maskEmail, fmtClock, fmtDateTime, clampMs, uid, escapeHtml, toast,
  });
}
