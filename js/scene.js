// 3D-сцена первого экрана: голографическая сфера, дуги данных, частицы и замок, который открывается.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const hero = document.querySelector('.hero');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 900px)').matches;
// то же правило, что в CSS: на узких и вытянутых по высоте экранах сфера по центру над текстом
const narrowMQ = matchMedia('(max-width: 900px), (max-aspect-ratio: 23/20)');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  throw e;
}
document.documentElement.classList.add('webgl');
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0, 10);

const C = {
  cyan: new THREE.Color('#22e3ee'),
  mint: new THREE.Color('#2dd4bf'),
  violet: new THREE.Color('#8b5cf6'),
  blue: new THREE.Color('#3b82f6'),
  pink: new THREE.Color('#c084fc'),
};

const world = new THREE.Group();   // всё, что двигается вместе со сферой
scene.add(world);
const globe = new THREE.Group();
world.add(globe);
const R = 1.7;

// ---------- Ядро: стеклянная сфера со свечением по краям (френель) и бегущими строками сканирования ----------
const fresnelMat = (inner, outer, power, alpha, side, scan) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, cIn: { value: inner }, cOut: { value: outer }, uPow: { value: power }, uA: { value: alpha }, uScan: { value: scan } },
  vertexShader: `
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vP = position;
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `
    uniform float uTime, uPow, uA, uScan; uniform vec3 cIn, cOut;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
      vec3 col = mix(cIn, cOut, f);
      float scan = uScan * (0.5 + 0.5 * sin(vP.y * 38.0 - uTime * 2.2)) * 0.18;
      float band = uScan * smoothstep(0.035, 0.0, abs(fract(vP.y * 0.32 - uTime * 0.12) - 0.5)) * 0.9;
      gl_FragColor = vec4(col, (f + scan + band * f) * uA);
    }`,
});
const core = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), fresnelMat(C.violet, C.cyan, 2.6, 0.42, THREE.FrontSide, 0.55));
globe.add(core);
const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.22, 64, 64), fresnelMat(C.blue, C.violet, 3.2, 0.32, THREE.BackSide, 0));
world.add(atmosphere);

// ---------- Каркас ----------
const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 1.004, 4)),
  new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
globe.add(wire);

// ---------- Точки на поверхности (мерцают) ----------
const dotShader = (sizeMul) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uSize: { value: sizeMul } },
  vertexShader: `
    attribute float aSeed; attribute vec3 aColor;
    uniform float uTime, uPR, uSize; varying vec3 vC; varying float vT;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vT = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 40.0);
      vC = aColor;
      gl_PointSize = uSize * uPR * (0.6 + aSeed) * (22.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vC; varying float vT;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vC, a * vT);
    }`,
});
function points(count, place, colorPick, sizeMul) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = place(i);
    pos.set(p, i * 3);
    seed[i] = Math.random();
    colorPick(i).toArray(col, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, dotShader(sizeMul));
}
const SURF = mobile ? 1400 : 2600;
const surface = points(SURF, i => {
  const y = 1 - (i / (SURF - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963;
  return [Math.cos(t) * r * R * 1.01, y * R * 1.01, Math.sin(t) * r * R * 1.01];
}, () => (Math.random() < 0.72 ? C.cyan : C.pink), 1.0);
globe.add(surface);

// ---------- Звёздная пыль вокруг ----------
const DUST = mobile ? 900 : 2200;
const dust = points(DUST, () => {
  const r = 3.2 + Math.pow(Math.random(), 0.6) * 6.5, u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return [Math.cos(t) * s * r, u * r * 0.7, Math.sin(t) * s * r];
}, () => (Math.random() < 0.5 ? C.violet : Math.random() < 0.5 ? C.blue : C.cyan), 0.7);
world.add(dust);

// ---------- Орбиты со спутниками ----------
const rings = [];
[[2.45, 1.15, 0.25, C.cyan], [2.85, -0.9, -0.5, C.violet], [3.3, 0.35, 1.1, C.blue]].forEach(([r, tx, tz, color], i) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 220),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  const holder = new THREE.Group();
  holder.rotation.set(tx, 0, tz);
  holder.add(ring);
  const sat = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5) }));
  holder.add(sat);
  world.add(holder);
  rings.push({ holder, sat, r, speed: 0.25 + i * 0.12, phase: i * 2.1 });
});

// ---------- Дуги данных с бегущими импульсами ----------
const arcMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    attribute float aOffset; attribute float aSpeed; attribute vec3 aColor;
    varying vec2 vUv; varying float vO; varying float vS; varying vec3 vC;
    void main() { vUv = uv; vO = aOffset; vS = aSpeed; vC = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uTime; varying vec2 vUv; varying float vO; varying float vS; varying vec3 vC;
    void main() {
      float head = fract(uTime * vS + vO);
      float d = head - vUv.x;
      float pulse = d >= 0.0 ? exp(-d * 18.0) : 0.0;
      float base = 0.10;
      float a = base + pulse * 1.6;
      gl_FragColor = vec4(vC * (0.6 + pulse * 2.4), a);
    }`,
});
const randOnSphere = () => new THREE.Vector3().randomDirection().multiplyScalar(R * 1.01);
const ARCS = mobile ? 14 : 26;
for (let i = 0; i < ARCS; i++) {
  const a = randOnSphere(), b = randOnSphere();
  if (a.angleTo(b) < 0.6) { i--; continue; }
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.35 + Math.random() * 0.55));
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geo = new THREE.TubeGeometry(curve, 64, 0.0085, 6, false);
  const n = geo.attributes.position.count;
  const off = new Float32Array(n).fill(Math.random()), spd = new Float32Array(n).fill(0.18 + Math.random() * 0.35), col = new Float32Array(n * 3);
  const c = Math.random() < 0.65 ? C.cyan : C.pink;
  for (let k = 0; k < n; k++) c.toArray(col, k * 3);
  geo.setAttribute('aOffset', new THREE.BufferAttribute(off, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  globe.add(new THREE.Mesh(geo, arcMat));
}

// ---------- Замок в центре ----------
const lock = new THREE.Group();
world.add(lock);
const bodyShape = new THREE.Shape();
const w = 0.62, h = 0.5, rr = 0.12;
bodyShape.moveTo(-w + rr, -h); bodyShape.lineTo(w - rr, -h); bodyShape.quadraticCurveTo(w, -h, w, -h + rr);
bodyShape.lineTo(w, h - rr); bodyShape.quadraticCurveTo(w, h, w - rr, h); bodyShape.lineTo(-w + rr, h);
bodyShape.quadraticCurveTo(-w, h, -w, h - rr); bodyShape.lineTo(-w, -h + rr); bodyShape.quadraticCurveTo(-w, -h, -w + rr, -h);
const key = new THREE.Path();
key.absarc(0, 0.06, 0.11, 0, Math.PI * 2, true);
bodyShape.holes.push(key);
const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 6, curveSegments: 24 });
bodyGeo.center();
const bodyMat = new THREE.MeshStandardMaterial({ color: '#0a0d24', metalness: 0.8, roughness: 0.25, emissive: new THREE.Color('#2a1f8a'), emissiveIntensity: 0.45 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
lock.add(body);
const bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 25),
  new THREE.LineBasicMaterial({ color: C.cyan.clone().multiplyScalar(2.2), transparent: true, opacity: 0.95 }));
lock.add(bodyEdges);
// светящаяся замочная скважина
const keyGlow = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ color: C.cyan.clone().multiplyScalar(3) }));
keyGlow.position.set(0, 0.06, 0.215);
lock.add(keyGlow);
const slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.24), new THREE.MeshBasicMaterial({ color: C.cyan.clone().multiplyScalar(3) }));
slotGlow.position.set(0, -0.08, 0.215);
lock.add(slotGlow);

// дужка: половина тора + две ножки; вращается вокруг левой ножки
const shackle = new THREE.Group();
const shMat = new THREE.MeshStandardMaterial({ color: '#cfe9ff', metalness: 1, roughness: 0.18, emissive: C.cyan, emissiveIntensity: 0.35 });
const sr = 0.38, st = 0.075;
const arc = new THREE.Mesh(new THREE.TorusGeometry(sr, st, 20, 48, Math.PI), shMat);
arc.position.y = 0.42;
const legL = new THREE.Mesh(new THREE.CylinderGeometry(st, st, 0.42, 20), shMat);
legL.position.set(-sr, 0.21, 0);
const legR = legL.clone();
legR.position.x = sr;
const shInner = new THREE.Group();
shInner.add(arc, legL, legR);
shInner.position.set(sr, 0, 0);   // точка вращения — левая ножка
shackle.add(shInner);
shackle.position.set(-sr, h - 0.02, 0);
lock.add(shackle);
lock.scale.setScalar(0.92);

// вспышка-кольцо при открытии
const burst = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 96),
  new THREE.MeshBasicMaterial({ color: C.cyan.clone().multiplyScalar(2), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
world.add(burst);

// свет для металла замка
scene.add(new THREE.AmbientLight('#4a3d8f', 0.6));
const l1 = new THREE.PointLight(C.cyan, 30, 20); l1.position.set(3, 2.5, 4); scene.add(l1);
const l2 = new THREE.PointLight(C.violet, 30, 20); l2.position.set(-3.5, -1.5, 3); scene.add(l2);
const l3 = new THREE.PointLight('#ffffff', 8, 10); l3.position.set(0, 0, 4); scene.add(l3);

// ---------- Свечение (bloom) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), mobile ? 0.7 : 0.82, 0.55, 0.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Размер, мышь, прокрутка ----------
let W = 1, H = 1;
function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  renderer.setSize(W, H, false);
  composer.setSize(W, H);
  bloom.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  // на широком экране сфера справа от текста, на узком — по центру позади
  const wide = !narrowMQ.matches;
  world.position.set(wide ? 3.05 : 0, wide ? 0.1 : 0.15, 0);
  world.scale.setScalar(wide ? 0.86 : Math.min(0.78, 0.5 * camera.aspect + 0.28));
}
addEventListener('resize', resize);
resize();

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { mouse.tx = (e.clientX / innerWidth - 0.5); mouse.ty = (e.clientY / innerHeight - 0.5); });
let scrollK = 0;
addEventListener('scroll', () => { scrollK = Math.min(1, scrollY / Math.max(1, H)); }, { passive: true });

// ---------- Анимация открытия замка ----------
let unlockAt = 1.4, relockAt = Infinity, state = 0; // 0 закрыт, 1 открыт
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
window.addEventListener('zp-unlock', () => { if (state === 0) unlockAt = clock.elapsedTime; });

let visible = true;
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);
document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  if (!visible || document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const sp = reduce ? 0 : 1;

  for (const m of [core.material, atmosphere.material, surface.material, dust.material, arcMat]) m.uniforms.uTime.value = t * sp;
  globe.rotation.y += dt * 0.12 * sp;
  dust.rotation.y -= dt * 0.015 * sp;
  rings.forEach(r => {
    const a = t * r.speed * sp + r.phase;
    r.sat.position.set(Math.cos(a) * r.r, Math.sin(a) * r.r, 0);
    r.holder.rotation.y += dt * 0.05 * sp;
  });

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  world.rotation.y = mouse.x * 0.5;
  world.rotation.x = mouse.y * 0.3 + scrollK * 0.4;
  lock.rotation.y = -world.rotation.y * 0.6 + Math.sin(t * 0.8) * 0.12 * sp;
  lock.rotation.x = -world.rotation.x * 0.6;
  lock.position.y = Math.sin(t * 1.3) * 0.05 * sp;
  camera.position.z = 10 + scrollK * 2.5;
  camera.position.y = -scrollK * 1.2;
  camera.lookAt(world.position.x * 0.35, world.position.y * 0.5 - scrollK * 0.6, 0);

  // замок: открывается, через 7 с закрывается, снова открывается — «обход блокировки»
  if (state === 0 && t >= unlockAt) { state = 1; relockAt = t + 7; burstStart = t; }
  if (state === 1 && t >= relockAt) { state = 0; unlockAt = t + 2.2; }
  const k = state === 1 ? ease((t - (relockAt - 7)) / 0.9) : 1 - ease((t - (unlockAt - 2.2)) / 0.6);
  shackle.position.y = (h - 0.02) + k * 0.22;
  shInner.rotation.y = k * -1.05;
  shInner.parent.rotation.y = 0;
  keyGlow.material.color.copy(C.cyan).lerp(C.mint, k).multiplyScalar(3 + k * 2);
  bodyMat.emissiveIntensity = 0.55 + k * 0.35;

  const bt = (t - burstStart) / 1.4;
  if (bt >= 0 && bt <= 1) {
    burst.scale.setScalar(0.4 + ease(bt) * 2.8);
    burst.material.opacity = (1 - bt) * 0.9;
  } else burst.material.opacity = 0;
  burst.lookAt(camera.position);

  composer.render();
}
let burstStart = -10;
tick();
