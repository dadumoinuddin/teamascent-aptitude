/* TeamAscent — Admin control panel */
(function () {
  renderHeader("admin");
  renderFooter();

  const loginView = $("#login-view");
  const adminView = $("#admin-view");

  // ---------- Auth ----------
  function enter() {
    loginView.classList.add("hidden");
    adminView.classList.remove("hidden");
    loadQuestions();
    loadSessions();
  }
  if (Admin.isAuthed()) enter();

  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = $("#admin-pass").value;
    Admin.login(pass).then((res) => {
      if (res.ok) { $("#login-error").textContent = ""; enter(); }
      else $("#login-error").textContent = "Incorrect password.";
    });
  });
  $("#logout-btn").addEventListener("click", () => { Admin.logout(); location.reload(); });

  // ---------- Tabs ----------
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const name = tab.dataset.tab;
      $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== name));
      if (name === "participants") loadParticipants();
      if (name === "sessions") loadSessions();
    });
  });

  // ================= QUESTIONS =================
  const keys = ["A", "B", "C", "D"];
  function loadQuestions() {
    Questions.list().then((qs) => {
      $("#q-count").textContent = `${qs.length} question${qs.length === 1 ? "" : "s"}`;
      if (!qs.length) {
        $("#q-list").innerHTML = `<p class="muted">No questions yet. Add one below or bulk import.</p>`;
        return;
      }
      $("#q-list").innerHTML = qs
        .map(
          (q, i) => `
        <div style="padding:12px 0;border-bottom:2px solid var(--border);">
          <div class="row space-between">
            <strong style="font-size:17px;">${i + 1}. ${escapeHtml(q.text)}</strong>
            <span class="row-actions">
              <button class="btn btn-sm btn-ghost" data-up="${q.id}">↑</button>
              <button class="btn btn-sm btn-ghost" data-down="${q.id}">↓</button>
              <button class="btn btn-sm btn-accent" data-edit="${q.id}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${q.id}">Del</button>
            </span>
          </div>
          <div class="muted" style="font-size:16px;margin-top:6px;">
            ${q.options
              .map((o, k) => `<span class="${k === q.correct ? "q-correct" : ""}">${keys[k]}. ${escapeHtml(o)}${k === q.correct ? " ✓" : ""}</span>`)
              .join(" &nbsp;·&nbsp; ")}
          </div>
        </div>`
        )
        .join("");

      $$("#q-list [data-edit]").forEach((b) =>
        b.addEventListener("click", () => editQuestion(b.dataset.edit, qs))
      );
      $$("#q-list [data-del]").forEach((b) =>
        b.addEventListener("click", () => {
          if (confirm("Delete this question?"))
            Questions.remove(b.dataset.del).then(loadQuestions);
        })
      );
      $$("#q-list [data-up]").forEach((b) =>
        b.addEventListener("click", () => Questions.move(b.dataset.up, -1).then(loadQuestions))
      );
      $$("#q-list [data-down]").forEach((b) =>
        b.addEventListener("click", () => Questions.move(b.dataset.down, 1).then(loadQuestions))
      );
    });
  }

  function editQuestion(id, qs) {
    const q = qs.find((x) => x.id === id);
    if (!q) return;
    $("#q-id").value = q.id;
    $("#q-text").value = q.text;
    [0, 1, 2, 3].forEach((k) => ($(`#q-o${k}`).value = q.options[k] || ""));
    $("#q-correct").value = q.correct;
    $("#q-form-title").textContent = "Edit Question";
    $("#q-cancel").style.display = "";
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
  function resetQForm() {
    $("#q-form").reset();
    $("#q-id").value = "";
    $("#q-form-title").textContent = "Add Question";
    $("#q-cancel").style.display = "none";
  }
  $("#q-cancel").addEventListener("click", resetQForm);

  $("#q-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = {
      id: $("#q-id").value || undefined,
      text: $("#q-text").value.trim(),
      options: [0, 1, 2, 3].map((k) => $(`#q-o${k}`).value.trim()),
      correct: parseInt($("#q-correct").value, 10),
      active: true,
    };
    Questions.save(q).then(() => {
      toast("Question saved", "ok");
      resetQForm();
      loadQuestions();
    });
  });

  $("#bulk-btn").addEventListener("click", () => {
    const text = $("#bulk-text").value.trim();
    $("#bulk-error").textContent = "";
    if (!text) { $("#bulk-error").textContent = "Paste some lines first."; return; }
    Questions.bulkImport(text, $("#bulk-replace").checked).then((res) => {
      if (!res.ok) { $("#bulk-error").textContent = res.errors.join(" · "); return; }
      toast(`Imported ${res.count} questions`, "ok");
      $("#bulk-text").value = "";
      loadQuestions();
    });
  });

  // ================= SESSIONS =================
  function toLocalInput(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocalInput(val) {
    const d = new Date(val);
    return isNaN(d) ? null : d.toISOString();
  }

  function phasePill(phase) {
    const map = {
      scheduled: ["Upcoming", "pill-soon"], live: ["Live", "pill-live"],
      ended: ["Scoring", "pill-live"], closed: ["Closed", "pill-closed"],
      paused: ["Paused", "pill-closed"],
    };
    const [l, c] = map[phase] || ["—", "pill-closed"];
    return `<span class="pill ${c}">${l}</span>`;
  }

  // Global pause / resume for ALL sessions
  $("#pause-all").addEventListener("click", () =>
    Sessions.pauseAll(true).then((r) => { toast(`Paused ${r.count} session(s)`, "ok"); loadSessions(); })
  );
  $("#resume-all").addEventListener("click", () =>
    Sessions.pauseAll(false).then((r) => { toast(`Resumed ${r.count} session(s)`, "ok"); loadSessions(); })
  );

  function loadSessions() {
    Sessions.list().then((list) => {
      if (!list.length) {
        $("#s-list").innerHTML = `<p class="muted">No sessions yet. Create one below.</p>`;
      } else {
        $("#s-list").innerHTML = list
          .map((s) => {
            const st = Sessions.state(s);
            return `
          <div class="row space-between" style="padding:12px 0;border-bottom:2px solid var(--border);">
            <div>
              <div class="row" style="gap:10px;">
                <strong style="font-size:17px;">${escapeHtml(s.title)}</strong>${phasePill(st.phase)}
              </div>
              <div class="muted" style="font-size:16px;">
                Code <b>${escapeHtml(String(s.code))}</b> · ${fmtDateTime(s.startTime)} ·
                ${s.durationMin}m test · ${s.perQuestionSec}s/q · join ${s.joinWindowMin}m · close ${s.closeAfterHours}h
              </div>
            </div>
            <span class="row-actions">
              <button class="btn btn-sm ${s.paused ? "btn-accent" : "btn-ghost"}" data-stoggle="${s.id}" data-paused="${s.paused ? 1 : 0}">${s.paused ? "▶ Resume" : "⏸ Pause"}</button>
              <button class="btn btn-sm btn-accent" data-sedit="${s.id}">Edit</button>
              <button class="btn btn-sm btn-ghost" data-sboard="${s.id}">Board</button>
              <button class="btn btn-sm btn-danger" data-sdel="${s.id}">Del</button>
            </span>
          </div>`;
          })
          .join("");

        $$("#s-list [data-stoggle]").forEach((b) =>
          b.addEventListener("click", () =>
            Sessions.setPaused(b.dataset.stoggle, b.dataset.paused !== "1").then(() => {
              toast(b.dataset.paused === "1" ? "Session resumed" : "Session paused", "ok");
              loadSessions();
            })
          )
        );
        $$("#s-list [data-sedit]").forEach((b) =>
          b.addEventListener("click", () => editSession(b.dataset.sedit, list))
        );
        $$("#s-list [data-sdel]").forEach((b) =>
          b.addEventListener("click", () => {
            if (confirm("Delete this session and its participants?"))
              Sessions.remove(b.dataset.sdel).then(() => { loadSessions(); loadParticipants(); });
          })
        );
        $$("#s-list [data-sboard]").forEach((b) =>
          b.addEventListener("click", () => (location.href = `leaderboard.html?s=${b.dataset.sboard}`))
        );
      }
      // refresh participant session selector
      populateSessionSelect(list);
    });
  }

  function editSession(id, list) {
    const s = list.find((x) => x.id === id);
    if (!s) return;
    $("#s-id").value = s.id;
    $("#s-title").value = s.title;
    $("#s-code").value = s.code;
    $("#s-start").value = toLocalInput(s.startTime);
    $("#s-duration").value = s.durationMin;
    $("#s-perq").value = s.perQuestionSec;
    $("#s-join").value = s.joinWindowMin;
    $("#s-close").value = s.closeAfterHours;
    $("#s-form-title").textContent = "Edit Session";
    $("#s-cancel").style.display = "";
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
  function resetSForm() {
    $("#s-form").reset();
    $("#s-id").value = "";
    $("#s-duration").value = 15; $("#s-perq").value = 60;
    $("#s-join").value = 90; $("#s-close").value = 3;
    $("#s-form-title").textContent = "New Session";
    $("#s-cancel").style.display = "none";
  }
  $("#s-cancel").addEventListener("click", resetSForm);
  $("#s-startnow").addEventListener("click", () => {
    $("#s-start").value = toLocalInput(new Date().toISOString());
  });

  $("#s-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $("#s-code").value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { toast("Code must be exactly 5 letters/digits", "err"); return; }
    const iso = fromLocalInput($("#s-start").value);
    if (!iso) { toast("Pick a valid start time", "err"); return; }
    const s = {
      id: $("#s-id").value || undefined,
      title: $("#s-title").value.trim(),
      code,
      startTime: iso,
      durationMin: +$("#s-duration").value || 15,
      perQuestionSec: +$("#s-perq").value || 60,
      joinWindowMin: +$("#s-join").value || 90,
      closeAfterHours: +$("#s-close").value || 3,
      status: "scheduled",
    };
    Sessions.save(s).then(() => { toast("Session saved", "ok"); resetSForm(); loadSessions(); });
  });

  // ================= PARTICIPANTS =================
  function populateSessionSelect(list) {
    const sel = $("#p-session");
    const prev = sel.value;
    sel.innerHTML = list.map((s) => `<option value="${s.id}">${escapeHtml(s.title)} (${s.code})</option>`).join("");
    if (prev) sel.value = prev;
  }
  $("#p-session").addEventListener("change", loadParticipants);

  function loadParticipants() {
    const sid = $("#p-session").value;
    if (!sid) { $("#p-list").innerHTML = `<p class="muted">No session selected.</p>`; return; }
    Participants.listForSession(sid).then((parts) => {
      if (!parts.length) {
        $("#p-list").innerHTML = `<p class="muted">No participants have joined this session yet.</p>`;
        return;
      }
      parts.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      $("#p-list").innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Tab exits</th><th>Score</th><th>Actions</th></tr></thead>
          <tbody>
          ${parts
            .map((p) => {
              const status = p.blocked
                ? `<span class="pill pill-closed">Blocked</span>`
                : p.submittedAt
                ? `<span class="pill pill-live">Finished</span>`
                : `<span class="pill pill-soon">In progress</span>`;
              const v = p.violations || 0;
              const vCell = v > 0 ? `<span style="color:var(--red);font-weight:bold;">⚠ ${v}</span>` : "0";
              return `<tr>
                <td>${escapeHtml(p.name)}</td>
                <td class="muted">${escapeHtml(p.email)}</td>
                <td>${status}</td>
                <td>${vCell}</td>
                <td>${p.submittedAt ? p.score : "—"}</td>
                <td><span class="row-actions">
                  <button class="btn btn-sm ${p.blocked ? "btn-accent" : "btn-danger"}" data-block="${p.id}" data-on="${p.blocked ? 0 : 1}">
                    ${p.blocked ? "Unblock" : "Block"}</button>
                  <button class="btn btn-sm btn-ghost" data-premove="${p.id}">Remove</button>
                </span></td>
              </tr>`;
            })
            .join("")}
          </tbody>
        </table>`;

      $$("#p-list [data-block]").forEach((b) =>
        b.addEventListener("click", () =>
          Participants.setBlocked(b.dataset.block, b.dataset.on === "1").then(loadParticipants)
        )
      );
      $$("#p-list [data-premove]").forEach((b) =>
        b.addEventListener("click", () => {
          if (confirm("Remove this participant?"))
            Participants.remove(b.dataset.premove).then(loadParticipants);
        })
      );
    });
  }
})();
