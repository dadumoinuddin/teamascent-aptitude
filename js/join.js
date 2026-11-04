/* TeamAscent — join / session-home logic */
(function () {
  renderHeader("join");
  renderFooter();

  const form = $("#join-form");
  const errEl = $("#join-error");
  const banner = $("#session-banner");
  const scheduleEl = $("#schedule");
  const miniBoard = $("#mini-board");
  let featured = null;
  let countdownTimer = null;
  let boardTimer = null;

  // ---- Featured session banner + countdown ----
  function phasePill(phase) {
    const map = {
      scheduled: ["Upcoming", "pill-soon"],
      live: ["Live Now", "pill-live"],
      ended: ["Scoring", "pill-live"],
      closed: ["Closed", "pill-closed"],
      paused: ["Paused", "pill-closed"],
    };
    const [l, c] = map[phase] || ["—", "pill-closed"];
    return `<span class="pill ${c}">${l}</span>`;
  }

  function renderBanner() {
    if (!featured) {
      banner.innerHTML = `<p class="muted">No active session. Ask your admin for a code.</p>`;
      return;
    }
    const st = Sessions.state(featured);
    let line = "";
    if (st.phase === "paused") line = `Paused by the admin — please wait.`;
    else if (st.phase === "scheduled") line = `Starts in <b>${fmtClock(st.start - Date.now())}</b>`;
    else if (st.phase === "live") line = `Live — joining open · window closes in <b>${fmtClock(st.joinEnd - Date.now())}</b>`;
    else if (st.phase === "ended") line = `Joining closed · board closes in <b>${fmtClock(st.closeAt - Date.now())}</b>`;
    else line = `This session has closed.`;

    banner.innerHTML = `
      <div class="row space-between">
        <div class="big-num">${escapeHtml(featured.title)}</div>
        ${phasePill(st.phase)}
      </div>
      <div class="muted">Code set by admin · ${featured.durationMin} min · ${featured.perQuestionSec}s/question</div>
      <div class="qtimer" style="font-size:14px;">${line}</div>`;
  }

  // ---- Upcoming schedule list ----
  function renderSchedule(sessions) {
    if (!sessions.length) {
      scheduleEl.innerHTML = `<p class="muted">No sessions scheduled.</p>`;
      return;
    }
    scheduleEl.innerHTML = sessions
      .map((s) => {
        const st = Sessions.state(s);
        return `
        <div class="row space-between" style="padding:10px 0;border-bottom:2px solid var(--border);">
          <div>
            <div style="font-size:18px;">${escapeHtml(s.title)}</div>
            <div class="muted" style="font-size:15px;">${fmtDateTime(s.startTime)}</div>
          </div>
          ${phasePill(st.phase)}
        </div>`;
      })
      .join("");
  }

  // ---- Mini leaderboard (top 5) ----
  function renderMini(rows) {
    if (!rows.length) {
      miniBoard.innerHTML = `<li class="mini-empty">No results yet — be the first to finish.</li>`;
      return;
    }
    miniBoard.innerHTML = rows
      .slice(0, 5)
      .map(
        (r) => `
      <li class="mini-row">
        <span class="mini-rank">#${r.rank}</span>
        <span class="mini-name">${escapeHtml(r.maskedName)}</span>
        <span class="mini-score">${r.score}</span>
      </li>`
      )
      .join("");
  }

  function refreshBoard() {
    if (!featured) return;
    Leaderboard.get(featured.id).then(renderMini);
  }

  // ---- Boot ----
  Promise.all([Sessions.current(), Sessions.list()]).then(([cur, all]) => {
    featured = cur;
    renderBanner();
    renderSchedule(all);
    refreshBoard();

    // prefill code from featured session to make the demo smooth
    if (featured && featured.code) $("#f-code").value = "";

    countdownTimer = setInterval(renderBanner, CONFIG.COUNTDOWN_TICK_MS);
    boardTimer = setInterval(refreshBoard, CONFIG.LEADERBOARD_REFRESH_MS);
  });

  // ---- Submit ----
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const name = $("#f-name").value.trim();
    const email = $("#f-email").value.trim();
    const code = $("#f-code").value.trim();
    $("#join-btn").disabled = true;

    Participants.join({ name, email, code }).then((res) => {
      $("#join-btn").disabled = false;
      if (!res.ok) {
        // already completed -> send to leaderboard
        if (res.participant && res.session) {
          toast(res.error, "err");
          setTimeout(() => (location.href = `leaderboard.html?s=${res.session.id}`), 900);
          return;
        }
        errEl.textContent = res.error;
        return;
      }
      toast("Joined! Heading to the arena…", "ok");
      setTimeout(() => (location.href = "test.html"), 500);
    });
  });

  window.addEventListener("beforeunload", () => {
    countdownTimer && clearInterval(countdownTimer);
    boardTimer && clearInterval(boardTimer);
  });
})();
