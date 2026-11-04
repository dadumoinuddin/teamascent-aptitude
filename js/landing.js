/* TeamAscent — cinematic landing (vanilla, mobile-first) */
(function () {
  /* ---------- Hero video ----------
     Plays a pre-baked boomerang clip (assets/hero-loop.mp4 = forward +
     reversed, encoded as one file). Native `loop` replays it with no
     cut and no live seeking, so motion stays perfectly smooth and
     endless. We just fade it in once it can play; if it's missing the
     cinematic gradient backdrop shows through. */
  (function heroLoop() {
    const v = document.getElementById("hero-video");
    if (!v) return;
    v.muted = true; v.playsInline = true;
    const show = () => { v.style.opacity = "1"; v.play().catch(() => {}); };
    if (v.readyState >= 2) show();
    else v.addEventListener("canplay", show, { once: true });
  })();

  /* ---------- Word pull-up ---------- */
  function buildWords(container, text, { asterisk = false } = {}) {
    const words = text.split(" ");
    container.innerHTML = words
      .map((w, i) => {
        const last = i === words.length - 1;
        const star = asterisk && last ? `<span class="star serif">*</span>` : "";
        return `<span class="word"><span class="inner" style="transition-delay:${i * 0.08}s">${escapeHtml(w)}${star}</span></span>${i < words.length - 1 ? " " : ""}`;
      })
      .join("");
  }

  function buildMultiStyle(container, segments) {
    let i = 0, html = "";
    segments.forEach((seg) => {
      seg.text.split(" ").forEach((w) => {
        html += `<span class="word"><span class="inner ${seg.cls || ""}" style="transition-delay:${i * 0.06}s">${escapeHtml(w)}</span></span> `;
        i++;
      });
    });
    container.innerHTML = html;
  }

  function observeIn(el, cb, opts) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { cb(e.target); io.unobserve(e.target); }
      });
    }, opts || { threshold: 0.3 });
    io.observe(el);
  }

  const heroTitle = document.getElementById("hero-title");
  if (heroTitle) {
    // "Team" small, stacked above the giant "Ascent"
    heroTitle.innerHTML = `
      <span class="word pre"><span class="inner" style="transition-delay:0s">Team</span></span>
      <span class="word"><span class="inner" style="transition-delay:.09s">Ascent<span class="star serif">*</span></span></span>`;
    requestAnimationFrame(() => setTimeout(() => heroTitle.classList.add("in"), 120));
  }

  const aboutHead = document.getElementById("about-head");
  if (aboutHead) {
    buildMultiStyle(aboutHead, [
      { text: "This is TeamAscent —", cls: "" },
      { text: "a proving ground.", cls: "serif" },
      { text: "Fifteen minutes to show what you've got.", cls: "" },
    ]);
    aboutHead.classList.add("pull");
    observeIn(aboutHead, (el) => el.classList.add("in"));
  }

  const featHead = document.getElementById("features-head");
  if (featHead) {
    buildMultiStyle(featHead, [
      { text: "A clean arena for sharp minds.", cls: "" },
      { text: "Built for pressure. Powered by proof.", cls: "dim" },
    ]);
    featHead.classList.add("pull");
    observeIn(featHead, (el) => el.classList.add("in"));
  }

  /* ---------- Card entrances (staggered) ---------- */
  $$(".card").forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.12}s`;
    observeIn(card, (el) => el.classList.add("in"), { threshold: 0.15 });
  });

  /* ---------- Scroll-linked letter reveal (About body) ---------- */
  const aboutBody = document.getElementById("about-body");
  let chars = [];
  if (aboutBody) {
    const text = aboutBody.textContent;
    aboutBody.innerHTML = text
      .split("")
      .map((c) => `<span class="char" style="opacity:.2">${c === " " ? "&nbsp;" : escapeHtml(c)}</span>`)
      .join("");
    chars = $$(".char", aboutBody);
  }
  function revealOnScroll() {
    if (!aboutBody || !chars.length) return;
    const r = aboutBody.getBoundingClientRect();
    const vh = window.innerHeight;
    // progress 0 when top at 0.85*vh, 1 when bottom at 0.25*vh
    const start = vh * 0.85, end = vh * 0.2;
    const p = (start - r.top) / (start - end + r.height);
    const prog = Math.max(0, Math.min(1, p));
    const n = Math.floor(prog * chars.length);
    for (let i = 0; i < chars.length; i++) {
      chars[i].style.opacity = i < n ? "1" : "0.2";
    }
  }
  window.addEventListener("scroll", revealOnScroll, { passive: true });
  revealOnScroll();

  /* ---------- Live session chip + countdown ---------- */
  const chip = document.getElementById("session-chip");
  const chipText = document.getElementById("chip-text");
  let timer = null;

  Sessions.current().then((s) => {
    if (!s || !chip) return;
    chip.style.display = "inline-flex";

    function tick() {
      const st = Sessions.state(s);
      chip.classList.remove("soon", "closed");
      let txt;
      if (st.phase === "scheduled") {
        chip.classList.add("soon");
        txt = `${escapeHtml(s.title)} · starts in <b>${fmtClock(st.start - Date.now())}</b>`;
      } else if (st.phase === "live") {
        txt = `Live now · joining open <b>${fmtClock(st.joinEnd - Date.now())}</b>`;
      } else if (st.phase === "ended") {
        txt = `Joining closed · board closes in <b>${fmtClock(st.closeAt - Date.now())}</b>`;
      } else {
        chip.classList.add("closed");
        txt = `${escapeHtml(s.title)} · closed`;
      }
      chipText.innerHTML = txt;
    }
    tick();
    timer = setInterval(tick, 1000);
  });

  window.addEventListener("beforeunload", () => timer && clearInterval(timer));
})();
