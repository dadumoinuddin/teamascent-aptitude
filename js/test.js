/* TeamAscent — test engine: per-participant clock + proctor + live ping */
(function () {
  renderHeader("");
  renderFooter();

  const views = { wait: $("#view-wait"), test: $("#view-test"), info: $("#view-info") };
  function show(which) {
    Object.values(views).forEach((v) => v.classList.add("hidden"));
    views[which].classList.remove("hidden");
  }
  function info(title, msg) {
    stopProctor(); stopPing();
    $("#info-title").textContent = title;
    $("#info-msg").textContent = msg;
    show("info");
  }

  let participant, session, questions = [];
  let idx = 0, selected = null, qStart = 0;
  let loop = null, phaseNow = null;

  Participants.me().then((data) => {
    if (!data) { info("No active entry", "You haven't joined a session. Enter a code from the lobby."); return; }
    participant = data.participant;
    session = data.session;
    if (participant.blocked) { info("Blocked", "You have been blocked from this session by the admin."); return; }
    if (participant.submittedAt) { location.href = `leaderboard.html?s=${session.id}&me=${participant.id}`; return; }

    Questions.list().then((qs) => {
      questions = qs.filter((q) => q.active);
      if (!questions.length) { info("No questions", "This session has no questions set yet. Check with the admin."); return; }
      idx = Math.min((participant.answers || []).length, questions.length);
      route();
      loop = setInterval(route, 250);
    });
  });

  function stopLoop() { if (loop) { clearInterval(loop); loop = null; } }

  // ---------- Router (per-participant clock) ----------
  function route() {
    const st = Sessions.state(session);

    if (st.phase === "closed") {
      stopLoop();
      if (participant.testStartedAt && !participant.submittedAt) finalize(true);
      else info("Session closed", "This session has closed. Head to the leaderboard for the final standings.");
      return;
    }

    if (!participant.testStartedAt) {
      if (st.phase === "scheduled") { renderWaiting(st); return; }
      if (st.phase === "live") {
        // start this participant's personal clock now
        participant.testStartedAt = new Date().toISOString();
        Participants.beginTest(participant.id);
        // fall through to run the test
      } else {
        stopLoop();
        info("Joining window closed", "The 90-minute joining window for this session has closed.");
        return;
      }
    }

    const deadline = new Date(participant.testStartedAt).getTime() + session.durationMin * 60000;
    if (Date.now() >= deadline) { stopLoop(); finalize(true); return; }

    if (phaseNow !== "test") {
      phaseNow = "test";
      beginQuestion(idx, true);
      startProctor();
      startPing();
    } else {
      tickTest(deadline);
    }
  }

  // ---------- Waiting room ----------
  function renderWaiting(st) {
    phaseNow = "wait";
    show("wait");
    $("#wait-title").textContent = session.title;
    const total = Math.floor(clampMs(st.start - Date.now()) / 1000);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const cell = (n, l) => `<div class="cd-cell"><div class="cd-num">${String(n).padStart(2, "0")}</div><div class="cd-lbl">${l}</div></div>`;
    $("#wait-countdown").innerHTML = cell(h, "HRS") + cell(m, "MIN") + cell(s, "SEC");
    $("#wait-note").textContent = `${questions.length} questions · ${session.perQuestionSec}s each · ${session.durationMin} min total · once you start, you can't leave`;
  }

  // ---------- Questions ----------
  function beginQuestion(i) {
    if (i >= questions.length) { finalize(false); return; }
    idx = i; selected = null; qStart = Date.now();
    show("test");
    const q = questions[i];
    $("#q-counter").textContent = `Q ${i + 1} / ${questions.length}`;
    $("#q-text").textContent = q.text;
    const keys = ["A", "B", "C", "D"];
    $("#q-options").innerHTML = q.options
      .map((opt, k) => `<button class="opt" data-k="${k}"><span class="key">${keys[k]}</span><span>${escapeHtml(opt)}</span></button>`)
      .join("");
    $$("#q-options .opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        selected = parseInt(btn.dataset.k, 10);
        $$("#q-options .opt").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
    $("#q-next").textContent = i === questions.length - 1 ? "Finish ★" : "Next ▶";
  }

  $("#q-next").addEventListener("click", advance);
  function advance() {
    const q = questions[idx];
    Participants.recordAnswer(participant.id, q.id, selected);
    if (idx + 1 >= questions.length) finalize(false);
    else beginQuestion(idx + 1);
  }

  function tickTest(deadline) {
    const qMsLeft = session.perQuestionSec * 1000 - (Date.now() - qStart);
    const sessMsLeft = deadline - Date.now();
    const shown = Math.min(qMsLeft, sessMsLeft);
    const timerEl = $("#q-timer");
    timerEl.textContent = fmtClock(shown);
    timerEl.classList.toggle("low", shown <= 10000);
    $("#q-session-timer").textContent = `Time left: ${fmtClock(sessMsLeft)}`;
    $("#q-progress").style.width = `${(idx / questions.length) * 100}%`;
    if (qMsLeft <= 0) {
      Participants.recordAnswer(participant.id, questions[idx].id, selected);
      if (idx + 1 >= questions.length) finalize(false);
      else beginQuestion(idx + 1);
    }
  }

  // ---------- Finish ----------
  let finalizing = false;
  function finalize(timedOut) {
    if (finalizing) return;
    finalizing = true;
    stopLoop(); stopProctor(); stopPing();
    const q = questions[idx];
    const rec = q && !timedOut ? Participants.recordAnswer(participant.id, q.id, selected) : Promise.resolve();
    rec.then(() => Participants.submit(participant.id))
      .then(() => { location.href = `leaderboard.html?s=${session.id}&me=${participant.id}`; });
  }

  /* ================= PROCTOR (no leaving · strict 3/3) ================= */
  const MAX = (CONFIG.PROCTOR && CONFIG.PROCTOR.maxStrikes) || 3;
  let strikes = 0, lastFlagT = 0, proctorActive = false;
  const overlay = $("#proctor-overlay");

  function renderStrikes() {
    const el = $("#strikes");
    let dots = "";
    for (let i = 0; i < MAX; i++) dots += `<span class="strike ${i < strikes ? "hit" : ""}"></span>`;
    el.innerHTML = dots + `<span class="strike-label">${strikes} / ${MAX}</span>`;
  }

  function showOverlay(final, reason) {
    $("#proctor-title").textContent = final ? "Attempt ended" : "Warning " + strikes + " of " + MAX;
    $("#proctor-msg").textContent = final
      ? "You left the test too many times. Your attempt has been submitted."
      : `${reason} Leaving again counts as another strike — ${MAX - strikes} left. Your timer keeps running.`;
    renderStrikes();
    $("#proctor-resume").style.display = final ? "none" : "";
    overlay.classList.remove("hidden");
  }
  $("#proctor-resume").addEventListener("click", () => overlay.classList.add("hidden"));

  function flag(reason) {
    if (!proctorActive || finalizing) return;
    const now = Date.now();
    if (now - lastFlagT < 1500) return; // one leave = one strike
    lastFlagT = now;
    strikes++;
    Participants.flagViolation(participant.id);
    if (strikes >= MAX) { showOverlay(true, reason); setTimeout(() => finalize(true), 1500); }
    else showOverlay(false, reason);
  }

  const onVis = () => { if (document.hidden) flag("You switched away from the test."); };
  const onBlur = () => flag("The test window lost focus.");
  const onPop = () => { history.pushState(null, "", location.href); flag("Back navigation is disabled during the test."); };
  const onBeforeUnload = (e) => { if (proctorActive) { e.preventDefault(); e.returnValue = ""; return ""; } };

  function startProctor() {
    if (proctorActive) return;
    proctorActive = true;
    strikes = strikes || 0;
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBeforeUnload);
    history.pushState(null, "", location.href);
  }
  function stopProctor() {
    proctorActive = false;
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("beforeunload", onBeforeUnload);
  }

  /* ================= LIVE NETWORK PING ================= */
  const P = CONFIG.PING || { url: "js/config.js", intervalMs: 3000, warnMs: 350, timeoutMs: 4000 };
  let pingTimer = null;
  const pingEl = $("#netping");

  function setPing(ms, state) {
    if (!pingEl) return;
    if (state === "offline") { pingEl.textContent = "! offline"; pingEl.className = "netping bad"; }
    else if (state === "fail") { pingEl.textContent = "! no signal"; pingEl.className = "netping bad"; }
    else if (state === "warn") { pingEl.textContent = "! " + ms + " ms"; pingEl.className = "netping warn"; }
    else { pingEl.textContent = "● " + ms + " ms"; pingEl.className = "netping ok"; }
  }
  function doPing() {
    if (!navigator.onLine) { setPing(null, "offline"); return; }
    const t0 = performance.now();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), P.timeoutMs);
    fetch(P.url + "?_=" + Date.now(), { cache: "no-store", signal: ctrl.signal })
      .then(() => { clearTimeout(to); const ms = Math.round(performance.now() - t0); setPing(ms, ms > P.warnMs ? "warn" : "ok"); })
      .catch(() => { clearTimeout(to); setPing(null, "fail"); });
  }
  function startPing() {
    if (pingTimer) return;
    doPing();
    pingTimer = setInterval(doPing, P.intervalMs);
    window.addEventListener("online", doPing);
    window.addEventListener("offline", doPing);
  }
  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    window.removeEventListener("online", doPing);
    window.removeEventListener("offline", doPing);
  }

  window.addEventListener("beforeunload", stopLoop);
})();
