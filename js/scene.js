// Кино из частиц: ~24 000 светящихся точек перетекают по ходу прокрутки
// сфера → замок → взрыв (камера пролетает сквозь осколки) → надпись ZAPRET PRO → значки видео и голоса → звёздная пыль → сфера.
// Интерактив: частицы разбегаются от курсора, сферу можно крутить мышью, клик — взрыв, за курсором неоновый след.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowMQ = matchMedia('(max-width: 900px), (max-aspect-ratio: 23/20)');
const finePointer = matchMedia('(pointer: fine)').matches;
const weak = matchMedia('(max-width: 900px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
const N = weak ? 12000 : 24000;

// Ошибка здесь отклоняет import() — страница оставит 2D-сферу.
// Холст непрозрачный: свечение (bloom) на прозрачном фоне даёт «молочную» дымку поверх страницы.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, weak ? 1.25 : 1.6));
renderer.toneMapping = THREE.NoToneMapping;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); window.zpSceneFail && window.zpSceneFail('видеокарта сбросила WebGL'); });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
camera.position.set(0, 0, 10);
const world = new THREE.Group();
scene.add(world);

// ---------- Формы: каждая — N точек ----------
function sampleCanvas(w, h, scale, depth, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data, px = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 120) px.push(x, y);
  const out = new Float32Array(N * 3);
  const n = px.length / 2;
  for (let i = 0; i < N; i++) {
    const k = (Math.random() * n | 0) * 2;
    out[i * 3] = (px[k] - w / 2 + Math.random() * 2) * scale;
    out[i * 3 + 1] = -(px[k + 1] - h / 2 + Math.random() * 2) * scale;
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
  if (i % 7 === 0) { const d = rdir(), r = Math.cbrt(Math.random()) * 1.9; return [d[0] * r, d[1] * r, d[2] * r]; } // немного внутри
  const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963, R = 2.1 + (Math.random() - 0.5) * 0.05;
  return [Math.cos(t) * r * R, y * R, Math.sin(t) * r * R];
});
const LOCK = sampleCanvas(600, 600, 5 / 600, 0.7, (g) => {
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  g.lineWidth = 62; g.lineCap = 'round';
  g.beginPath(); g.moveTo(178, 300); g.lineTo(178, 220); g.arc(300, 220, 122, Math.PI, 0); g.lineTo(422, 300); g.stroke();
  g.beginPath(); g.roundRect(130, 270, 340, 270, 46); g.fill();
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
  ICONS = sampleCanvas(1400, 520, 8.4 / 1400, 0.5, (g) => {
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    // видео: скруглённый прямоугольник с треугольником «play»
    g.beginPath(); g.roundRect(130, 110, 560, 330, 90); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(350, 185); g.lineTo(350, 365); g.lineTo(510, 275); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    // голос: микрофон
    g.beginPath(); g.roundRect(950, 70, 150, 250, 75); g.fill();
    g.lineWidth = 38; g.lineCap = 'round';
    g.beginPath(); g.arc(1025, 240, 150, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.moveTo(1025, 390); g.lineTo(1025, 455); g.stroke();
    g.beginPath(); g.moveTo(945, 462); g.lineTo(1105, 462); g.stroke();
  });
}
buildTextShapes();
// Надпись рисуется шрифтом Unbounded — пересобираем, когда он загрузится.
if (document.fonts && document.fonts.load) document.fonts.load('700 200px Unbounded').then(() => { buildTextShapes(); pairIndex = -1; }).catch(() => {});

// Порядок сцен (индексы — этапы прокрутки 0…6)
const SHAPES = () => [SPHERE, LOCK, SHATTER, TEXT, ICONS, DUST, SPHERE];
// size — размер точек, bright — яркость, spin — вращается ли форма;
// wide/narrow — положение (x, y) и масштаб на широком и узком экране (масштаб 0 = вписать в ширину)
const STAGE = [
  { size: 1.9, bright: 1.0, spin: 1, wide: [3.0, 0.1, 1.0], narrow: [0, 1.9, 0.72] },
  { size: 2.1, bright: 1.15, spin: 0, wide: [0, 0.55, 0.95], narrow: [0, 1.1, 0.7] },
  { size: 1.7, bright: 0.85, spin: 1, wide: [0, 0, 1], narrow: [0, 0, 1] },
  { size: 1.45, bright: 1.2, spin: 0, wide: [0, 0.6, 1], narrow: [0, 1.0, 0] },
  { size: 1.55, bright: 1.15, spin: 0, wide: [0, 0.5, 1], narrow: [0, 1.0, 0] },
  { size: 1.25, bright: 0.32, spin: 1, wide: [0, 0, 1], narrow: [0, 0, 1] },
  { size: 1.8, bright: 0.7, spin: 1, wide: [0, 0.2, 0.9], narrow: [0, 0.6, 0.7] },
];

// ---------- Частицы ----------
const geo = new THREE.BufferGeometry();
const aFrom = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
const aTo = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
aFrom.setUsage(THREE.DynamicDrawUsage); aTo.setUsage(THREE.DynamicDrawUsage);
const rand = new Float32Array(N), col = new Float32Array(N * 3);
const palette = [new THREE.Color('#22e3ee'), new THREE.Color('#7ff4ff'), new THREE.Color('#8b5cf6'), new THREE.Color('#c084fc'), new THREE.Color('#2dd4bf')];
for (let i = 0; i < N; i++) {
  rand[i] = Math.random();
  const r = Math.random(), c = r < 0.38 ? palette[0] : r < 0.55 ? palette[1] : r < 0.75 ? palette[2] : r < 0.9 ? palette[3] : palette[4];
  c.toArray(col, i * 3);
}
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); // реальные позиции считает шейдер
geo.setAttribute('aFrom', aFrom);
geo.setAttribute('aTo', aTo);
geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

const uniforms = {
  uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: 1.9 }, uBright: { value: 1 }, uPR: { value: renderer.getPixelRatio() },
  uBurst: { value: 0 }, uSwirl: { value: 1.3 },
  uMouse: { value: new THREE.Vector2(9, 9) }, uMouseF: { value: 0 }, uTan: { value: new THREE.Vector2(1, 1) },
};
const mat = new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uMix, uTime, uSize, uPR, uBurst, uSwirl, uMouseF;
    uniform vec2 uMouse, uTan;
    attribute vec3 aFrom, aTo, aColor; attribute float aRand;
    varying vec3 vC; varying float vA;
    void main() {
      float m = clamp((uMix - aRand * 0.35) / 0.65, 0.0, 1.0);
      m = m * m * (3.0 - 2.0 * m);
      vec3 p = mix(aFrom, aTo, m);
      float sw = sin(3.14159 * m) * uSwirl;
      p += vec3(sin(aRand * 40.0 + uTime * 0.7), cos(aRand * 31.0 + uTime * 0.6), sin(aRand * 17.0 - uTime * 0.5)) * sw * (0.5 + aRand);
      p += vec3(sin(uTime * 0.9 + aRand * 60.0), cos(uTime * 0.8 + aRand * 50.0), sin(uTime * 0.7 + aRand * 70.0)) * 0.022;
      p += normalize(p + vec3(0.0001)) * uBurst * (0.8 + aRand * 2.2);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      // частицы разбегаются от курсора
      vec2 mp = uMouse * uTan * -mv.z;
      vec2 d = mv.xy - mp; float dl = length(d);
      float r = 0.13 * -mv.z;
      mv.xy += normalize(d + 0.00001) * (1.0 - smoothstep(0.0, r, dl)) * uMouseF * r * 0.9;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * uPR * (0.55 + aRand * 0.9) * (10.0 / -mv.z);
      vC = aColor;
      vA = 0.6 + 0.4 * sin(uTime * 2.2 + aRand * 80.0);
    }`,
  fragmentShader: `
    uniform float uBright; varying vec3 vC; varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vC * (0.45 + 0.75 * a), a * vA * uBright * 0.85);
    }`,
});
world.add(new THREE.Points(geo, mat));

// мягкое ядро-свечение под сферой
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(34,227,238,.4)'); gr.addColorStop(0.45, 'rgba(139,92,246,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
glow.scale.setScalar(6);
world.add(glow);

// ---------- Свечение ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), weak ? 0.55 : 0.7, 0.2, 0.35);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Размер ----------
let W = 1, H = 1;
function resize() {
  W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
  renderer.setSize(W, H, false);
  composer.setSize(W, H);
  bloom.setSize(Math.round(W * 0.6), Math.round(H * 0.6));
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  uniforms.uTan.value.set(t * camera.aspect, t);
  measureAnchors();
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

let pairIndex = -1;
function setPair(i) {
  if (i === pairIndex) return;
  pairIndex = i;
  const S = SHAPES();
  aFrom.array.set(S[i]); aTo.array.set(S[Math.min(i + 1, S.length - 1)]);
  aFrom.needsUpdate = true; aTo.needsUpdate = true;
}

// ---------- Мышь: разбегание, вращение, взрыв ----------
const mouse = { x: 9, y: 9, on: false };
let dragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0, dragRotY = 0, dragRotX = 0, burst = 0, burstV = 0;
let downAt = 0, downX = 0, downY = 0;
const interactive = el => el.closest && el.closest('a, button, summary, details, input, label, #demo, .glass, header');
addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; mouse.on = true;
  if (dragging) {
    velY = (e.clientX - lastX) * 0.006; velX = (e.clientY - lastY) * 0.004;
    dragRotY += velY; dragRotX += velX;
    lastX = e.clientX; lastY = e.clientY;
  }
}, { passive: true });
document.addEventListener('pointerleave', () => { mouse.on = false; });
addEventListener('pointerdown', e => {
  if (e.button !== 0 || interactive(e.target)) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = performance.now(); downX = e.clientX; downY = e.clientY;
});
addEventListener('pointerup', e => {
  if (!dragging) return;
  dragging = false;
  // короткий клик без перетаскивания — взрыв
  if (performance.now() - downAt < 300 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) burstV += 0.6;
});
window.addEventListener('zp-unlock', () => { burstV += 0.25; });

// ---------- Неоновый след за курсором ----------
const trail = document.getElementById('trail');
const tctx = trail && finePointer && !reduce ? trail.getContext('2d') : null;
const pts = [];
function sizeTrail() {
  if (!tctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  trail.width = innerWidth * dpr; trail.height = innerHeight * dpr;
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
if (tctx) addEventListener('pointermove', e => { pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); }, { passive: true });
let trailDirty = false;
function drawTrail(now) {
  if (!tctx) return;
  while (pts.length && now - pts[0].t > 380) pts.shift();
  if (pts.length < 2) { if (trailDirty) { tctx.clearRect(0, 0, innerWidth, innerHeight); trailDirty = false; } return; }
  tctx.clearRect(0, 0, innerWidth, innerHeight);
  trailDirty = true;
  tctx.lineCap = 'round'; tctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = 1 - (now - b.t) / 380;
      tctx.strokeStyle = pass ? `rgba(220,252,255,${k * 0.9})` : `rgba(${i % 2 ? '34,227,238' : '139,92,246'},${k * 0.35})`;
      tctx.lineWidth = pass ? 1.6 * k + 0.4 : 10 * k + 2;
      tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
    }
  }
}

new ResizeObserver(() => resize()).observe(canvas);
addEventListener('resize', () => { resize(); sizeTrail(); });
document.addEventListener('fullscreenchange', resize);
(narrowMQ.addEventListener ? narrowMQ.addEventListener('change', resize) : narrowMQ.addListener(resize));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAnchors);
addEventListener('load', measureAnchors);
setInterval(measureAnchors, 2000); // высота страницы меняется (картинки, раскрытые вопросы)
resize(); sizeTrail();

// ---------- Анимация ----------
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const bump = (x, c, w) => Math.max(0, 1 - Math.abs(x - c) / w);
let stage = stageFromScroll(), spin = 0, mouseF = 0;
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  if (window.zpStop3D) return;
  requestAnimationFrame(tick);
  const now = performance.now();
  drawTrail(now);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  // плавно догоняем этап прокрутки
  const target = stageFromScroll();
  stage += (target - stage) * Math.min(1, dt * (reduce ? 20 : 5));
  const s = Math.max(0, Math.min(STAGE.length - 1, stage));
  const i = Math.min(STAGE.length - 2, Math.floor(s)), f = s - i;
  setPair(i);
  uniforms.uMix.value = f;
  const A = STAGE[i], B = STAGE[i + 1], e = ease(f);
  uniforms.uSize.value = lerp(A.size, B.size, e);
  uniforms.uBright.value = lerp(A.bright, B.bright, e);
  uniforms.uTime.value = reduce ? 0 : t;

  // расположение формы: справа от текста на широком экране, над текстом на узком
  const narrow = narrowMQ.matches, va = narrow ? A.narrow : A.wide, vb = narrow ? B.narrow : B.wide;
  const fit = Math.min(1, 20 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.88 / 9.4); // надпись и значки вписываем в ширину
  const sa = va[2] || fit, sb = vb[2] || fit;
  world.position.set(lerp(va[0], vb[0], e), lerp(va[1], vb[1], e), 0);
  world.scale.setScalar(lerp(sa, sb, e));

  // вращение: сфера и облака крутятся, замок/надпись/значки разворачиваются к зрителю
  const spinW = lerp(A.spin, B.spin, e);
  if (!reduce) {
    if (spinW > 0.5) spin += dt * 0.16;
    else spin += (Math.round(spin / (Math.PI * 2)) * Math.PI * 2 - spin) * Math.min(1, dt * 3);
  }
  if (!dragging) { velY *= 0.94; velX *= 0.94; dragRotY += velY; dragRotX += velX; dragRotY *= 1 - (1 - spinW) * dt * 2; dragRotX *= 1 - dt * 1.5; }
  const mx = mouse.on ? mouse.x : 0, my = mouse.on ? mouse.y : 0;
  world.rotation.y = spin + dragRotY + mx * 0.25;
  world.rotation.x = -0.12 + dragRotX * spinW + my * 0.12;

  // кино: пролёт камеры сквозь облако осколков
  const fly = ease(bump(s, 2, 0.75));
  camera.position.z = 10 - fly * 8.2;
  camera.position.x = Math.sin(t * 0.2) * 0.3 * fly;
  camera.rotation.z = fly * 0.35 * Math.sin(s * 3);

  // мышь и взрыв
  mouseF += ((mouse.on && !dragging ? 1 : 0) - mouseF) * Math.min(1, dt * 4);
  uniforms.uMouse.value.set(mx, my);
  uniforms.uMouseF.value = reduce ? 0 : mouseF;
  burst += burstV; burstV = 0;
  burst *= Math.exp(-dt * 2.6);
  uniforms.uBurst.value = burst;
  glow.material.opacity = 0.32 * (1 - bump(s, 2, 1.2)) * (1 - bump(s, 3, 1)) * (1 - bump(s, 4, 1)) * lerp(1, 0.2, bump(s, 5, 1));

  composer.render();
  if (firstFrame) { firstFrame = false; window.zpSceneReady && window.zpSceneReady(); measureAnchors(); }
}
tick();
