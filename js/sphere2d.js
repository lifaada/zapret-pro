// Частицы без WebGL (обычный canvas 2D): та же история, что и в 3D, только легче —
// сфера → замок → разлёт с пролётом камеры → надпись ZAPRET PRO → значки видео и голоса → пыль → сфера.
// Рисуется сразу при загрузке; если 3D запустится, этот холст плавно гаснет и останавливается.
window.zpStart2D = function () {
  if (window.zp2dStarted) return;
  window.zp2dStarted = true;
  document.documentElement.classList.remove('webgl');
  document.documentElement.classList.add('canvas2d');
  const canvas = document.getElementById('scene2d');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowMQ = matchMedia('(max-width: 900px), (max-aspect-ratio: 23/20)');
  const finePointer = matchMedia('(pointer: fine)').matches;
  const weak = matchMedia('(max-width: 900px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  const N = weak ? 2200 : 4200;
  let W = 0, H = 0, dpr = 1;

  // ---------- Формы: каждая — N точек (те же единицы, что и в 3D) ----------
  function sampleCanvas(w, h, scale, depth, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const d = g.getImageData(0, 0, w, h).data, px = [];
    for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if (d[(y * w + x) * 4 + 3] > 120) px.push(x, y);
    const out = new Float32Array(N * 3), n = px.length / 2;
    for (let i = 0; i < N; i++) {
      const k = (Math.random() * n | 0) * 2;
      out[i * 3] = (px[k] - w / 2 + Math.random() * 3) * scale;
      out[i * 3 + 1] = -(px[k + 1] - h / 2 + Math.random() * 3) * scale;
      out[i * 3 + 2] = (Math.random() - 0.5) * depth;
    }
    return out;
  }
  function fill(fn) {
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const p = fn(i); out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; }
    return out;
  }
  const rdir = () => { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [Math.cos(t) * s, u, Math.sin(t) * s]; };

  const SPHERE = fill(i => {
    if (i % 7 === 0) { const d = rdir(), r = Math.cbrt(Math.random()) * 1.9; return [d[0] * r, d[1] * r, d[2] * r]; }
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963;
    return [Math.cos(t) * r * 2.1, y * 2.1, Math.sin(t) * r * 2.1];
  });
  const LOCK = sampleCanvas(600, 600, 5 / 600, 0.7, g => {
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 62; g.lineCap = 'round';
    g.beginPath(); g.moveTo(178, 300); g.lineTo(178, 220); g.arc(300, 220, 122, Math.PI, 0); g.lineTo(422, 300); g.stroke();
    g.fillRect(130, 270, 340, 270);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(300, 375, 38, 0, Math.PI * 2); g.fill();
    g.fillRect(284, 375, 32, 90);
  });
  const SHATTER = fill(() => { const d = rdir(), r = 3 + Math.pow(Math.random(), 0.7) * 14; return [d[0] * r, d[1] * r * 0.8, d[2] * r]; });
  const DUST = fill(() => [(Math.random() - 0.5) * 34, (Math.random() - 0.5) * 20, -16 + Math.random() * 18]);
  let TEXT = SPHERE, ICONS = SPHERE;
  function buildTextShapes() {
    TEXT = sampleCanvas(1500, 320, 9.2 / 1500, 0.35, (g, w, h) => {
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 200px Unbounded, "Segoe UI", sans-serif';
      g.fillText('ZAPRET PRO', w / 2, h / 2 + 6);
    });
    ICONS = sampleCanvas(1400, 520, 8.4 / 1400, 0.5, g => {
      g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      g.fillRect(130, 110, 560, 330);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.moveTo(350, 185); g.lineTo(350, 365); g.lineTo(510, 275); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.beginPath(); g.arc(1025, 145, 75, Math.PI, 0); g.lineTo(1100, 245); g.arc(1025, 245, 75, 0, Math.PI); g.closePath(); g.fill();
      g.lineWidth = 38; g.lineCap = 'round';
      g.beginPath(); g.arc(1025, 240, 150, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.beginPath(); g.moveTo(1025, 390); g.lineTo(1025, 455); g.stroke();
      g.beginPath(); g.moveTo(945, 462); g.lineTo(1105, 462); g.stroke();
    });
  }
  buildTextShapes();
  if (document.fonts && document.fonts.load) document.fonts.load('700 200px Unbounded').then(buildTextShapes).catch(() => {});

  const SHAPES = () => [SPHERE, LOCK, SHATTER, TEXT, ICONS, DUST, SPHERE];
  const STAGE = [
    { size: 1.9, bright: 1.0, spin: 1, wide: [3.0, 0.1, 1.0], narrow: [0, 1.9, 0.72] },
    { size: 2.1, bright: 1.15, spin: 0, wide: [0, 0.55, 0.95], narrow: [0, 1.1, 0.7] },
    { size: 1.7, bright: 0.85, spin: 1, wide: [0, 0, 1], narrow: [0, 0, 1] },
    { size: 1.45, bright: 1.2, spin: 0, wide: [0, 0.6, 1], narrow: [0, 1.0, 0] },
    { size: 1.55, bright: 1.15, spin: 0, wide: [0, 0.5, 1], narrow: [0, 1.0, 0] },
    { size: 1.25, bright: 0.32, spin: 1, wide: [0, 0, 1], narrow: [0, 0, 1] },
    { size: 1.8, bright: 0.7, spin: 1, wide: [0, 0.2, 0.9], narrow: [0, 0.6, 0.7] },
  ];

  // частицы сгруппированы по цвету — меньше переключений fillStyle
  const COLORS = ['34,227,238', '127,244,255', '139,92,246', '192,132,252', '45,212,191'];
  const rand = new Float32Array(N), group = [[], [], [], [], []];
  for (let i = 0; i < N; i++) {
    rand[i] = Math.random();
    const r = Math.random();
    group[r < 0.38 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : 4].push(i);
  }

  // ---------- Прокрутка → этап ----------
  let anchors = [];
  function measureAnchors() {
    anchors = [...document.querySelectorAll('[data-stage]')].map(el => {
      const r = el.getBoundingClientRect();
      return { v: +el.dataset.stage, y: r.top + scrollY + r.height / 2 };
    }).sort((a, b) => a.y - b.y);
  }
  function stageFromScroll() {
    if (!anchors.length) return 0;
    const y = scrollY + innerHeight / 2;
    if (y <= anchors[0].y) return anchors[0].v;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (y <= b.y) return a.v + (b.v - a.v) * (y - a.y) / Math.max(1, b.y - a.y);
    }
    return anchors[anchors.length - 1].v;
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureAnchors();
  }
  addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAnchors);
  addEventListener('load', measureAnchors);
  const anchorTimer = setInterval(measureAnchors, 2000);
  resize();

  // ---------- Мышь: разбегание, вращение, клик — взрыв ----------
  const mouse = { x: 0, y: 0, on: false };
  let dragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0, dragRotY = 0, dragRotX = 0, burst = 0;
  let downAt = 0, downX = 0, downY = 0;
  const interactive = el => el.closest && el.closest('a, button, summary, details, input, label, #demo, .glass, header');
  addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
    if (dragging) {
      velY = (e.clientX - lastX) * 0.006; velX = (e.clientY - lastY) * 0.004;
      dragRotY += velY; dragRotX += velX; lastX = e.clientX; lastY = e.clientY;
    }
    if (trailPts) trailPts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = false; });
  addEventListener('pointerdown', e => {
    if (e.button !== 0 || interactive(e.target)) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = performance.now(); downX = e.clientX; downY = e.clientY;
  });
  addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - downAt < 300 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) burst += 0.6;
  });
  addEventListener('zp-unlock', () => { burst += 0.25; });

  // ---------- Неоновый след за курсором ----------
  const trail = document.getElementById('trail');
  const tctx = trail && finePointer && !reduce ? trail.getContext('2d') : null;
  const trailPts = tctx ? [] : null;
  function sizeTrail() {
    if (!tctx) return;
    trail.width = innerWidth * dpr; trail.height = innerHeight * dpr;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', sizeTrail);
  sizeTrail();
  function drawTrail(now) {
    if (!tctx) return;
    while (trailPts.length && now - trailPts[0].t > 380) trailPts.shift();
    tctx.clearRect(0, 0, innerWidth, innerHeight);
    if (trailPts.length < 2) return;
    tctx.lineCap = 'round'; tctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < trailPts.length; i++) {
        const a = trailPts[i - 1], b = trailPts[i], k = 1 - (now - b.t) / 380;
        tctx.strokeStyle = pass ? `rgba(220,252,255,${k * 0.9})` : `rgba(${i % 2 ? '34,227,238' : '139,92,246'},${k * 0.35})`;
        tctx.lineWidth = pass ? 1.6 * k + 0.4 : 10 * k + 2;
        tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
      }
    }
  }

  // ---------- Анимация ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const bump = (x, c, w) => Math.max(0, 1 - Math.abs(x - c) / w);
  const TAN = Math.tan(21 * Math.PI / 180); // поле зрения как у 3D-камеры (42°)
  let stage = stageFromScroll(), spin = 0, mouseF = 0, last = performance.now(), t = 0;

  function frame(now) {
    if (window.zp2dStop) { // 3D готова — гасим холст (CSS) и останавливаемся
      clearInterval(anchorTimer);
      setTimeout(() => { ctx.clearRect(0, 0, W, H); if (tctx) tctx.clearRect(0, 0, innerWidth, innerHeight); }, 1300);
      return;
    }
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
    drawTrail(now);
    if (document.hidden || !W) return;

    stage += (stageFromScroll() - stage) * Math.min(1, dt * (reduce ? 20 : 5));
    const s = Math.max(0, Math.min(STAGE.length - 1, stage));
    const i = Math.min(STAGE.length - 2, Math.floor(s)), f = s - i;
    const S = SHAPES(), from = S[i], to = S[i + 1];
    const A = STAGE[i], B = STAGE[i + 1], e = ease(f);
    const size = lerp(A.size, B.size, e), bright = lerp(A.bright, B.bright, e);

    const narrow = narrowMQ.matches, va = narrow ? A.narrow : A.wide, vb = narrow ? B.narrow : B.wide;
    const fit = Math.min(1, 20 * TAN * (W / H) * 0.88 / 9.4);
    const scale = lerp(va[2] || fit, vb[2] || fit, e), ox = lerp(va[0], vb[0], e), oy = lerp(va[1], vb[1], e);

    const spinW = lerp(A.spin, B.spin, e);
    if (!reduce) {
      if (spinW > 0.5) spin += dt * 0.16;
      else spin += (Math.round(spin / (Math.PI * 2)) * Math.PI * 2 - spin) * Math.min(1, dt * 3);
    }
    if (!dragging) { velY *= 0.94; velX *= 0.94; dragRotY += velY; dragRotX += velX; dragRotY *= 1 - (1 - spinW) * dt * 2; dragRotX *= 1 - dt * 1.5; }
    const mx = mouse.on ? mouse.x / W * 2 - 1 : 0, my = mouse.on ? -(mouse.y / H * 2 - 1) : 0;
    const ry = spin + dragRotY + mx * 0.25, rx = -0.12 + dragRotX * spinW + my * 0.12;
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);

    // пролёт камеры сквозь облако осколков
    const fly = ease(bump(s, 2, 0.75));
    const camZ = 10 - fly * 8.2, camX = Math.sin(t * 0.2) * 0.3 * fly, roll = fly * 0.35 * Math.sin(s * 3);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const focal = (H / 2) / TAN;

    mouseF += ((mouse.on && !dragging ? 1 : 0) - mouseF) * Math.min(1, dt * 4);
    burst *= Math.exp(-dt * 2.6);
    const mR = Math.min(W, H) * 0.16, push = reduce ? 0 : mouseF;

    ctx.clearRect(0, 0, W, H);

    // мягкое свечение вокруг сферы и замка
    const glowA = 0.3 * (1 - bump(s, 2, 1.2)) * (1 - bump(s, 3, 1)) * (1 - bump(s, 4, 1)) * lerp(1, 0.2, bump(s, 5, 1));
    if (glowA > 0.01) {
      const gx = W / 2 + (ox - camX) * focal / camZ, gy = H / 2 - oy * focal / camZ, gr = 3.2 * scale * focal / camZ;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(34,227,238,${glowA * 0.55})`); g.addColorStop(0.45, `rgba(139,92,246,${glowA * 0.35})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = `rgba(${COLORS[c]},${Math.min(1, 0.95 * bright)})`;
      const list = group[c];
      for (let n = 0; n < list.length; n++) {
        const p = list[n], r = rand[p], j = p * 3;
        // каждая точка начинает перелёт со своей задержкой — форма «перетекает»
        const k = ease(Math.max(0, Math.min(1, (f * 1.35 - r * 0.35))));
        let x = lerp(from[j], to[j], k), y = lerp(from[j + 1], to[j + 1], k), z = lerp(from[j + 2], to[j + 2], k);
        const sw = Math.sin(Math.PI * k) * (0.6 + r);
        x += Math.sin(r * 40 + t) * sw * 0.5; y += Math.cos(r * 30 + t) * sw * 0.5;
        if (!reduce) { x += Math.sin(t * 0.7 + r * 50) * 0.03; y += Math.cos(t * 0.6 + r * 70) * 0.03; }
        const b = 1 + burst * (0.6 + r * 1.4);
        x *= b; y *= b; z *= b;
        // поворот сцены
        let X = x * cy + z * sy, Z = -x * sy + z * cy;
        let Y = y * cx - Z * sx; Z = y * sx + Z * cx;
        X = X * scale + ox - camX; Y = Y * scale + oy; Z *= scale;
        const d = camZ - Z;
        if (d < 0.4) continue;
        const q = focal / d;
        let px = X * q, py = -Y * q;
        const rx2 = px * cr - py * sr; py = px * sr + py * cr; px = W / 2 + rx2; py += H / 2;
        if (push > 0.01) {
          const dx = px - mouse.x, dy = py - mouse.y, dd = Math.hypot(dx, dy);
          if (dd < mR && dd > 0.1) { const m = (mR - dd) / mR * 46 * push; px += dx / dd * m; py += dy / dd * m; }
        }
        if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue;
        const sz = Math.min(8, Math.max(1.2, size * 1.25 * q / (focal / 10)));
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
};
