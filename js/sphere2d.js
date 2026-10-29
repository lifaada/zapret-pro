// Запасная сфера без WebGL (обычный canvas 2D): точки, меридианы, дуги данных и замок в центре.
// Включается, если браузер не дал видеокарту (выключено аппаратное ускорение) или 3D-скрипт не загрузился.
window.zpStart2D = function () {
  if (window.zp2dStarted) return;
  window.zp2dStarted = true;
  document.documentElement.classList.remove('webgl');
  document.documentElement.classList.add('canvas2d');
  const canvas = document.getElementById('scene2d');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowMQ = matchMedia('(max-width: 900px), (max-aspect-ratio: 23/20)');
  let W = 0, H = 0, R = 0, CX = 0, CY = 0, dpr = 1, visible = true;

  const N = 700, pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r, Math.random()]);
  }
  const rnd = () => { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [Math.cos(t) * s, u, Math.sin(t) * s]; };
  const slerp = (a, b, t) => {
    const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), w = Math.acos(d);
    if (w < 1e-4) return a;
    const s = Math.sin(w), k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  };
  const newArc = () => ({ a: rnd(), b: rnd(), lift: 1.15 + Math.random() * .3, t: Math.random(), speed: .003 + Math.random() * .004, c: Math.random() < .65 ? '34,227,238' : '192,132,252' });
  const arcs = Array.from({ length: 18 }, newArc);
  const stars = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random() * 1.4 + .3, Math.random()]);

  let rotY = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  addEventListener('pointermove', e => { tmx = (e.clientX / innerWidth - .5) * .7; tmy = (e.clientY / innerHeight - .5) * .4; });

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = !narrowMQ.matches;
    R = wide ? Math.min(W * .17, H * .27) : Math.min(W * .32, H * .28);
    CX = wide ? W * .72 : W / 2;
    CY = wide ? H * .48 : H * .45;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function project(p, lift) {
    const k = lift || 1;
    const cy = Math.cos(rotY + mx), sy = Math.sin(rotY + mx), cx = Math.cos(-.35 + my), sx = Math.sin(-.35 + my);
    let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
    let y = p[1] * cx - z * sx; z = p[1] * sx + z * cx;
    const f = 3 / (3 - z * k);
    return [CX + x * R * k * f, CY + y * R * k * f, z];
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lock(t) {
    const s = R * .32, open = (Math.sin(t * .9) > .2 ? 1 : 0);
    const k = window.zpLockK = (window.zpLockK || 0) + ((open ? 1 : 0) - (window.zpLockK || 0)) * .08;
    ctx.save();
    ctx.translate(CX, CY + Math.sin(t * 1.3) * R * .02);
    ctx.shadowColor = 'rgba(34,227,238,.9)'; ctx.shadowBlur = 24;
    // дужка
    ctx.save();
    ctx.translate(-s * .38, -s * .2 - k * s * .22);
    ctx.rotate(-k * .55);
    ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = s * .13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, s * .25); ctx.lineTo(0, -s * .15); ctx.arc(s * .38, -s * .15, s * .38, Math.PI, 0); ctx.lineTo(s * .76, s * .25); ctx.stroke();
    ctx.restore();
    // корпус
    const g = ctx.createLinearGradient(0, -s * .2, 0, s * .6);
    g.addColorStop(0, 'rgba(59,130,246,.55)'); g.addColorStop(1, 'rgba(76,29,149,.75)');
    ctx.fillStyle = g; roundRect(-s * .62, -s * .2, s * 1.24, s * .86, s * .16); ctx.fill();
    ctx.strokeStyle = 'rgba(127,244,255,.95)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = k > .5 ? '#7cf5d9' : '#bff8ff';
    ctx.beginPath(); ctx.arc(0, s * .14, s * .1, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-s * .04, s * .14, s * .08, s * .2);
    ctx.restore();
  }

  function frame(now) {
    if (window.zp2dStop) { setTimeout(() => ctx.clearRect(0, 0, W, H), 1300); return; } // 3D готова — 2D больше не нужна
    requestAnimationFrame(frame);
    if (!visible || document.hidden || !W) return;
    const t = now / 1000;
    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      ctx.fillStyle = `rgba(167,139,250,${.15 + .35 * (.5 + .5 * Math.sin(t * 1.5 + s[3] * 20))})`;
      ctx.fillRect(s[0] * W, s[1] * H, s[2], s[2]);
    }
    const glow = ctx.createRadialGradient(CX, CY, R * .1, CX, CY, R * 1.7);
    glow.addColorStop(0, 'rgba(34,227,238,.22)'); glow.addColorStop(.45, 'rgba(139,92,246,.14)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(CX, CY, R * 1.7, 0, Math.PI * 2); ctx.fill();

    const rim = ctx.createRadialGradient(CX, CY, R * .82, CX, CY, R * 1.04);
    rim.addColorStop(0, 'rgba(139,92,246,0)'); rim.addColorStop(.8, 'rgba(34,227,238,.28)'); rim.addColorStop(1, 'rgba(34,227,238,0)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(CX, CY, R * 1.04, 0, Math.PI * 2); ctx.fill();

    // орбиты
    [[1.45, -.35, '34,227,238'], [1.7, .5, '139,92,246']].forEach(([k, a, c], i) => {
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(a); ctx.scale(1, .3);
      ctx.strokeStyle = `rgba(${c},.35)`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke();
      const ang = t * (.4 + i * .2);
      ctx.fillStyle = `rgba(${c},1)`; ctx.shadowColor = `rgba(${c},1)`; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(Math.cos(ang) * R * k, Math.sin(ang) * R * k, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // меридианы
    ctx.lineWidth = 1;
    for (let m = 0; m < 12; m++) {
      const a = m / 12 * Math.PI;
      ctx.beginPath();
      for (let k = 0; k <= 48; k++) {
        const th = k / 48 * Math.PI * 2, p = project([Math.cos(a) * Math.cos(th), Math.sin(th), Math.sin(a) * Math.cos(th)]);
        k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = 'rgba(139,92,246,.12)'; ctx.stroke();
    }
    // точки
    for (const p of pts) {
      const q = project(p), d = (q[2] + 1) / 2, tw = .6 + .4 * Math.sin(t * 2 + p[3] * 30);
      ctx.fillStyle = d > .45 ? `rgba(127,244,255,${(.2 + d * .7) * tw})` : `rgba(192,132,252,${(.08 + d * .3) * tw})`;
      const sz = 1.2 + d * 1.4;
      ctx.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
    }
    // дуги данных
    for (let i = 0; i < arcs.length; i++) {
      const A = arcs[i];
      if (!reduce) A.t += A.speed;
      if (A.t > 1.3) { arcs[i] = newArc(); arcs[i].t = 0; continue; }
      ctx.beginPath();
      for (let k = 0; k <= 36; k++) {
        const u = k / 36, h = 1 + (A.lift - 1) * Math.sin(Math.PI * u), v = slerp(A.a, A.b, u), p = project([v[0] * h, v[1] * h, v[2] * h]);
        k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = `rgba(${A.c},.18)`; ctx.stroke();
      if (A.t <= 1) {
        const h = 1 + (A.lift - 1) * Math.sin(Math.PI * A.t), v = slerp(A.a, A.b, A.t), p = project([v[0] * h, v[1] * h, v[2] * h]);
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 10);
        g.addColorStop(0, `rgba(${A.c},1)`); g.addColorStop(1, `rgba(${A.c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, Math.PI * 2); ctx.fill();
      }
    }
    lock(t);
    if (!reduce) rotY += .0035;
  }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  requestAnimationFrame(frame);
};
