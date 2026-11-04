/* =============================================================
   TeamAscent — 16-bit pixel-art hero scene
   -------------------------------------------------------------
   Renders to a 320x180 buffer, scaled 6x, imageSmoothingEnabled
   = false. Fixed SWEETIE-16 palette (+greys). Shading by Bayer
   dithering only. Sprite animates ~10fps, camera pans in whole
   pixels, dialogue types out in a bordered pixel box.
   ============================================================= */

(function () {
  const W = 320, H = 180, SCALE = 6;

  // Fixed palette (SWEETIE-16 + greys)
  const HEX = [
    "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070",
    "#38b764", "#41a6f6", "#333c57", "#566c86", "#94b0c2", "#f4f4f4",
  ];
  const RGB = HEX.map((h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);

  // 4x4 Bayer matrix for ordered dithering (0..15)
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  function init() {
    const canvas = document.getElementById("hero-canvas");
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    canvas.style.imageRendering = "pixelated";
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const img = ctx.createImageData(W, H);
    const buf = img.data;

    const setPx = (x, y, idx) => {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H || idx < 0) return;
      const o = (y * W + x) * 4;
      const c = RGB[idx];
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
    };
    const fill = (x, y, w, h, idx) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setPx(x + i, y + j, idx);
    };
    // Vertical dithered gradient between two palette colours
    const ditherV = (x, y, w, h, top, bot) => {
      for (let j = 0; j < h; j++) {
        const t = h <= 1 ? 0 : j / (h - 1); // 0 top -> 1 bottom
        const thr = BAYER[j & 3];
        for (let i = 0; i < w; i++) {
          const b = thr[(x + i) & 3] / 16;
          setPx(x + i, y + j, t > b ? bot : top);
        }
      }
    };

    // Stars (fixed positions, twinkle by frame)
    const stars = [];
    for (let i = 0; i < 46; i++) {
      stars.push({ x: (i * 53 + 7) % W, y: (i * 29 + 3) % 90, ph: i % 3 });
    }

    // Staircase geometry (the "ascent")
    const STEP_W = 20, STEP_H = 12, STEPS = 8;
    const baseX = 54, baseY = 150;
    const stepTop = (i) => ({ x: baseX + i * STEP_W, y: baseY - i * STEP_H });

    // Climber sprite 8x11 (indices, -1 transparent) — two walk frames
    const S = {
      a: [
        "..44....",
        "..44....",
        ".2222...",
        "72222...",
        "72222...",
        ".2222...",
        ".8..8...",
        ".8..8...",
        ".8..8...",
        ".8...8..",
        ".8...8..",
      ],
      b: [
        "..44....",
        "..44....",
        ".2222...",
        "72222...",
        "72222...",
        ".2222...",
        ".88.8...",
        ".8..8...",
        "8...8...",
        "8...8...",
        ".8..8...",
      ],
    };
    const drawSprite = (frame, px, py) => {
      const g = S[frame];
      for (let y = 0; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) {
          const ch = g[y][x];
          if (ch === ".") continue;
          setPx(px + x, py - g.length + y, parseInt(ch, 16));
        }
      }
    };

    // Dialogue lines (typewriter)
    const LINES = [
      "TEAMASCENT // APTITUDE ARENA",
      "15 QUESTIONS. 15 MINUTES. ONE SHOT.",
      "CLIMB THE RANKS. CLAIM THE SUMMIT.",
    ];

    let frame = 0, acc = 0, last = performance.now();
    let climbT = 0;             // progress along steps (0..STEPS)
    let camX = 0, camY = 0;     // whole-pixel camera
    let line = 0, typed = 0, typeAcc = 0, holdAcc = 0, holding = false;

    function render(now) {
      const dt = now - last; last = now;
      acc += dt;

      // ~10fps logic tick
      if (acc >= 100) {
        acc -= 100;
        frame ^= 1;
        climbT += 0.12;
        if (climbT >= STEPS + 0.5) climbT = 0; // loop back to base
      }

      // Camera follows climber in WHOLE pixels (parallax target)
      const ci = Math.min(climbT, STEPS - 1);
      const foot = stepTop(Math.floor(ci));
      const tx = Math.round((foot.x - 140) * 0.25);
      const ty = Math.round((90 - foot.y) * 0.25);
      camX += Math.sign(tx - camX);
      camY += Math.sign(ty - camY);

      // ---- SKY (dithered gradient) ----
      ditherV(0, 0, W, 70, 0, 1);    // night -> purple
      ditherV(0, 70, W, 40, 1, 2);   // purple -> red horizon
      ditherV(0, 110, W, 20, 2, 3);  // red -> orange glow

      // Stars (parallax 0 = far, barely moves)
      for (const s of stars) {
        const tw = (Math.floor(now / 400) + s.ph) % 3;
        if (tw !== 0) setPx(s.x - (camX >> 2), s.y, tw === 1 ? 11 : 10);
      }

      // Big pixel sun behind summit
      const sunX = 232 - (camX >> 1), sunY = 54 - (camY >> 1);
      for (let y = -16; y <= 16; y++)
        for (let x = -16; x <= 16; x++)
          if (x * x + y * y <= 256) {
            const band = ((y + 16) >> 2) & 1;
            setPx(sunX + x, sunY + y, band ? 4 : 3);
          }

      // Far mountains (parallax, dithered body)
      const farBase = 128 - (camY >> 1);
      for (let x = 0; x < W; x++) {
        const mx = x + (camX >> 1);
        const peak = farBase - (Math.floor(Math.abs(((mx + 40) % 160) - 80) * -0.5) + 40);
        for (let y = peak; y < farBase; y++) {
          const b = BAYER[y & 3][x & 3] / 16;
          setPx(x, y, (y - peak) / 24 > b ? 8 : 1);
        }
      }

      // ---- Foreground staircase (the ascent) ----
      for (let i = 0; i < STEPS; i++) {
        const p = stepTop(i);
        const sx = p.x - camX, sy = p.y - camY;
        // step top
        fill(sx, sy, STEP_W, 3, 6);       // green top
        ditherV(sx, sy + 3, STEP_W, STEP_H + 4, 6, 8); // face dithered green->grey
        // edge highlight + shadow
        for (let k = 0; k < STEP_W; k++) setPx(sx + k, sy, 5);
        for (let k = 0; k < STEP_H + 7; k++) setPx(sx, sy + k, 10);
      }
      // ground base
      fill(0 - 0, baseY + 2 - camY, W, H, 8);

      // Summit flag
      const top = stepTop(STEPS - 1);
      const fx = top.x - camX + STEP_W - 6, fy = top.y - camY - 14;
      for (let k = 0; k < 14; k++) setPx(fx, fy + k, 10);
      const wave = (Math.floor(now / 160) & 1);
      fill(fx + 1, fy + wave, 8, 5, 2);
      fill(fx + 1, fy + wave, 2, 5, 3);

      // Climber
      const seg = Math.min(Math.floor(climbT), STEPS - 1);
      const frac = Math.max(0, Math.min(1, climbT - seg));
      const from = stepTop(seg);
      const to = stepTop(Math.min(seg + 1, STEPS - 1));
      const cx = Math.round(from.x + (to.x - from.x) * frac) + 5 - camX;
      const cy = Math.round(from.y + (to.y - from.y) * frac) - camY;
      const atTop = climbT >= STEPS - 0.1;
      drawSprite(atTop ? "a" : (frame ? "a" : "b"), cx, cy);

      // push buffer
      ctx.putImageData(img, 0, 0);

      // ---- Dialogue box (drawn on top with pixel font) ----
      const boxX = 10, boxY = 150, boxW = W - 20, boxH = 22;
      ctx.fillStyle = HEX[0];
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = HEX[4];
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
      ctx.fillStyle = HEX[11];
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textBaseline = "middle";
      // typewriter
      typeAcc += dt;
      if (holding) {
        holdAcc += dt;
        if (holdAcc > 1400) { holding = false; holdAcc = 0; typed = 0; line = (line + 1) % LINES.length; }
      } else if (typeAcc > 45) {
        typeAcc = 0;
        typed++;
        if (typed >= LINES[line].length) holding = true;
      }
      const shown = LINES[line].slice(0, typed);
      ctx.fillText(shown, boxX + 8, boxY + boxH / 2 + 1);
      // blinking caret
      if (!holding && (Math.floor(now / 250) & 1)) {
        const cw = ctx.measureText(shown).width;
        ctx.fillRect(boxX + 8 + cw + 1, boxY + 6, 5, 9);
      }

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
