/* TeamAscent — Leaderboard: 16-bit pixel-art podium scene + full standings
   320x180 buffer scaled 6x, imageSmoothingEnabled=false, fixed SWEETIE-16
   palette, dither shading, sprites ~10fps, whole-pixel camera, typed
   dialogue box. Real session data only. */
(function () {
  renderHeader("leaderboard");
  renderFooter();

  const params = new URLSearchParams(location.search);
  const wantedSession = params.get("s");
  const meId = params.get("me");

  const W = 320, H = 180;
  const HEX = [
    "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070",
    "#38b764", "#41a6f6", "#333c57", "#566c86", "#94b0c2", "#f4f4f4",
  ];
  const RGB = HEX.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  const canvas = document.getElementById("board-canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(W, H);
  const buf = img.data;

  const setPx = (x, y, idx) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H || idx < 0) return;
    const o = (y * W + x) * 4, c = RGB[idx];
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
  };
  const fill = (x, y, w, h, idx) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setPx(x + i, y + j, idx); };
  const ditherV = (x, y, w, h, top, bot) => {
    for (let j = 0; j < h; j++) {
      const t = h <= 1 ? 0 : j / (h - 1);
      for (let i = 0; i < w; i++) { const b = BAYER[j & 3][(x + i) & 3] / 16; setPx(x + i, y + j, t > b ? bot : top); }
    }
  };

  // Climber sprite 8x11 (two idle frames)
  const SPR = {
    a: ["..44....", "..44....", ".2222...", "72222...", "72222...", ".2222...", ".8..8...", ".8..8...", ".8..8...", ".8...8..", ".8...8.."],
    b: ["..44....", "..44....", ".2222...", "72222...", "72222...", ".2222...", ".8..8...", ".8..8...", ".8..8...", "8....8..", "8....8.."],
  };
  function drawSprite(frame, px, py, tint) {
    const g = SPR[frame];
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < g[y].length; x++) {
        const ch = g[y][x];
        if (ch === ".") continue;
        let idx = parseInt(ch, 16);
        if (tint != null && idx === 2) idx = tint; // recolor body for variety
        setPx(px + x, py - g.length + y, idx);
      }
  }

  // Pixel text with dark shadow for legibility
  function ptext(str, x, y, colorHex, size = 6, align = "left") {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = HEX[0];
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = colorHex;
    ctx.fillText(str, x, y);
  }

  // ---- state ----
  let rows = [];
  let session = null;
  let questionCount = 15;
  let phase = "scheduled";
  let frame = 0, acc = 0, last = performance.now(), camX = 0;
  let line = "", typed = 0, typeAcc = 0, holdAcc = 0, holding = false, lineQueue = [], lineIdx = 0;

  // Stars for parallax background
  const stars = [];
  for (let i = 0; i < 40; i++) stars.push({ x: (i * 59 + 11) % W, y: (i * 31 + 5) % 70, ph: i % 3 });

  const podiums = [
    { x: 131, w: 58, top: 86, rankColor: HEX[4], tint: null, rank: 1 },  // center / 1st
    { x: 60, w: 54, top: 100, rankColor: HEX[10], tint: 9, rank: 2 },    // left / 2nd
    { x: 206, w: 54, top: 106, rankColor: HEX[10], tint: 1, rank: 3 },   // right / 3rd
  ];
  const BOT = 140;

  function buildLines() {
    lineQueue = [];
    if (phase === "scheduled") { lineQueue = ["SESSION NOT STARTED", "CLIMBERS, STAND BY..."]; }
    else if (!rows.length) { lineQueue = ["NO CLIMBERS YET", "BE THE FIRST TO THE SUMMIT"]; }
    else {
      const champ = rows[0];
      lineQueue.push(`CHAMPION: ${champ.maskedName.toUpperCase()} - ${champ.score} PTS`);
      lineQueue.push(`${champ.maskedEmail.toUpperCase()}`);
      lineQueue.push(`${rows.length} CLIMBER${rows.length === 1 ? "" : "S"} ON THE BOARD`);
      if (rows.length >= 2) {
        const gap = rows[0].score - rows[1].score;
        lineQueue.push(gap > 0 ? `${gap} PT${gap === 1 ? "" : "S"} CLEAR OF 2ND` : `TIED AT THE TOP - ${rows[0].score} PTS`);
      }
      if (phase === "closed") lineQueue.push("SESSION CLOSED - FINAL RESULT");
    }
    lineIdx = 0; typed = 0; holding = false; line = lineQueue[0] || "";
  }

  function render(now) {
    const dt = now - last; last = now;
    acc += dt;
    if (acc >= 100) { acc -= 100; frame ^= 1; } // ~10fps sprite
    camX = Math.round(Math.sin(now / 2600) * 3); // whole-pixel camera drift

    // ---- Sky ----
    ditherV(0, 0, W, 60, 0, 1);
    ditherV(0, 60, W, 40, 1, 2);
    ditherV(0, 100, W, 22, 2, 3);
    // stars (parallax)
    for (const s of stars) {
      const tw = (Math.floor(now / 420) + s.ph) % 3;
      if (tw !== 0) setPx(((s.x - (camX >> 1)) % W + W) % W, s.y, tw === 1 ? 11 : 10);
    }
    // sun glow
    const sunX = 160 + camX, sunY = 46;
    for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++)
      if (x * x + y * y <= 196) { const band = ((y + 14) >> 2) & 1; setPx(sunX + x, sunY + y, band ? 4 : 3); }
    // far mountains
    for (let x = 0; x < W; x++) {
      const mx = x + camX;
      const peak = 116 - (40 - Math.abs(((mx + 30) % 150) - 75) * 0.5);
      for (let y = Math.floor(peak); y < 122; y++) { const b = BAYER[y & 3][x & 3] / 16; setPx(x, y, (y - peak) / 22 > b ? 8 : 1); }
    }
    // ground
    fill(0, BOT, W, H - BOT, 8);
    for (let x = 0; x < W; x++) setPx(x, BOT, 6);

    // ---- Podiums + sprites ----
    for (let i = 0; i < 3; i++) {
      const p = podiums[i];
      const r = rows[i];
      // pedestal
      fill(p.x, p.top, p.w, 3, 6);
      ditherV(p.x, p.top + 3, p.w, BOT - p.top - 3, 6, 8);
      for (let k = 0; k < p.w; k++) setPx(p.x + k, p.top, 5);
      for (let k = 0; k < BOT - p.top; k++) { setPx(p.x, p.top + k, 10); setPx(p.x + p.w - 1, p.top + k, 8); }
      if (r) {
        const cx = p.x + (p.w >> 1) - 4;
        // idle bob for sprite
        const bob = (frame && i === 0) ? -1 : 0;
        drawSprite(frame ? "a" : "b", cx, p.top + bob, p.tint);
        // champion flag
        if (i === 0) {
          const fx = p.x + p.w - 10, fy = p.top - 24;
          for (let k = 0; k < 14; k++) setPx(fx, fy + k, 10);
          const wave = (Math.floor(now / 170) & 1);
          fill(fx + 1, fy + wave, 7, 5, 2);
          fill(fx + 1, fy + wave, 2, 5, 3);
        }
      }
    }

    // ---- Dialogue box (into buffer) ----
    const bx = 8, by = 150, bw = W - 16, bh = 24;
    fill(bx, by, bw, bh, 0);
    for (let k = 0; k < bw; k++) { setPx(bx + k, by, 4); setPx(bx + k, by + bh - 1, 4); }
    for (let k = 0; k < bh; k++) { setPx(bx, by + k, 4); setPx(bx + bw - 1, by + k, 4); }

    ctx.putImageData(img, 0, 0);

    // ---- Text layer (ctx) ----
    // podium labels: score above, rank on pedestal, masked name below
    for (let i = 0; i < 3; i++) {
      const p = podiums[i], r = rows[i];
      const midX = p.x + (p.w >> 1);
      ptext(String(p.rank), midX, p.top + (BOT - p.top) / 2 + 2, p.rankColor, 10, "center");
      if (r) {
        ptext(`${r.score}`, midX, p.top - 20, HEX[4], 7, "center");
        ptext("PTS", midX, p.top - 13, HEX[10], 5, "center");
        ptext(r.maskedName.toUpperCase().slice(0, 9), midX, BOT + 8, HEX[11], 5, "center");
      } else {
        ptext("—", midX, BOT + 8, HEX[9], 6, "center");
      }
    }
    // header
    ptext((session ? session.title : "STANDINGS").toUpperCase().slice(0, 26), 8, 10, HEX[11], 6, "left");
    const stat = phase === "closed" ? ["FINAL", HEX[3]] : phase === "scheduled" ? ["SOON", HEX[4]] : ["LIVE", HEX[2]];
    ptext(stat[0], W - 8, 10, stat[1], 6, "right");

    // typewriter dialogue
    typeAcc += dt;
    if (holding) {
      holdAcc += dt;
      if (holdAcc > 1500) { holdAcc = 0; holding = false; typed = 0; lineIdx = (lineIdx + 1) % lineQueue.length; line = lineQueue[lineIdx] || ""; }
    } else if (typeAcc > 42) {
      typeAcc = 0; typed++;
      if (typed >= line.length) holding = true;
    }
    const shown = line.slice(0, typed);
    ptext(shown, 15, 162, HEX[5], 6, "left");
    if (!holding && (Math.floor(now / 250) & 1)) {
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = "left";
      const cw = ctx.measureText(shown).width;
      ctx.fillStyle = HEX[11];
      ctx.fillRect(15 + cw + 1, 158, 4, 7);
    }

    requestAnimationFrame(render);
  }

  // ---- HTML full standings ----
  function renderList() {
    const host = document.getElementById("lb-list");
    const countEl = document.getElementById("finisher-count");
    countEl.textContent = `${rows.length} finisher${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      host.innerHTML = `<li class="lb-empty">No finishers yet — the first climber to submit lands here.</li>`;
      return;
    }
    host.innerHTML = rows
      .map((r) => {
        const you = meId && r.id === meId ? `<span class="you">You</span>` : "";
        const v = r.violations || 0;
        const tabs = `<div class="lb-tabs ${v > 0 ? "warn" : ""}">⇥ ${v} tab switch${v === 1 ? "" : "es"}</div>`;
        return `<li class="lb-row ${r.rank === 1 ? "lb-top1" : ""} ${meId && r.id === meId ? "me" : ""}">
          <span class="lb-rank">#${r.rank}</span>
          <span>
            <span class="lb-name">${escapeHtml(r.maskedName)}${you}</span>
            <div class="lb-email">${escapeHtml(r.maskedEmail)}</div>
            ${tabs}
          </span>
          <span class="lb-score">${r.score}</span>
        </li>`;
      })
      .join("");
  }

  // ---- Masthead HTML ----
  function renderMeta() {
    const st = Sessions.state(session);
    phase = st.phase;
    document.getElementById("board-title").textContent = "★ " + session.title;
    const statusEl = document.getElementById("board-status");
    const subEl = document.getElementById("board-sub");
    const map = {
      scheduled: ["Upcoming", "pill-soon", `Starts in ${fmtClock(st.start - Date.now())}`],
      live: ["Live", "pill-live", `Joining open · updates every 30s · window closes in ${fmtClock(st.joinEnd - Date.now())}`],
      ended: ["Running", "pill-live", `Board closes in ${fmtClock(st.closeAt - Date.now())}`],
      closed: ["Closed", "pill-closed", `Final result`],
    };
    const [l, c, sub] = map[phase] || ["—", "pill-closed", ""];
    statusEl.textContent = l; statusEl.className = "pill " + c;
    subEl.textContent = sub;
  }

  let lastSig = "";
  function load() {
    if (!session) return;
    Leaderboard.get(session.id).then((r) => {
      const sig = r.map((x) => x.id + ":" + x.score).join("|") + "|" + Sessions.state(session).phase;
      rows = r;
      if (sig !== lastSig) { lastSig = sig; renderList(); buildLines(); }
    });
  }

  // ---- Boot ----
  const getSession = wantedSession ? Sessions.get(wantedSession) : Sessions.current();
  Promise.all([getSession, Questions.list()]).then(([s, qs]) => {
    questionCount = qs.filter((q) => q.active).length || 15;
    if (!s) {
      document.getElementById("board-title").textContent = "No session scheduled";
      document.getElementById("lb-list").innerHTML = `<li class="lb-empty">Nothing to show yet.</li>`;
      phase = "scheduled"; buildLines();
      requestAnimationFrame(render);
      return;
    }
    session = s;
    renderMeta();
    load();
    buildLines();
    requestAnimationFrame(render);
    setInterval(() => { renderMeta(); }, 1000);
    setInterval(load, CONFIG.LEADERBOARD_REFRESH_MS);
  });
})();
