import { THREE, GLTFLoader } from './lib.js';
import { makeCrowd } from './crowd.js?v=20261122k';
import { t as T, LANG, LANGS, TEAM_L, SURN_L } from './text.js?v=20261122k';

// ================= 基本 =================
const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const NR = new URLSearchParams(location.search).has('nr');
const REC = new URLSearchParams(location.search).has('rec');
const TS = +(new URLSearchParams(location.search).get('ts') || 1);
const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

// ピッチ（7人制）：長さ60m（z）、幅40m（x）
const REF_R = 0.8;
const HL = 30, HW = 20, GWH = 3.0, GH = 2.2, BR = 0.11;
const BOX_D = 9, BOX_W = 10, SPOT = 8;
const HALF_LEN = 180; // 3分

const SURN = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '前田', '藤田', '小川', '岡田', '後藤', '長谷川', '村上', '近藤', '石井', '坂本', '遠藤', '青木', '藤井', '西村', '福田', '太田', '三浦', '岡本', '松田', '中川', '中野', '原田', '小野', '竹内', '金子'];
const TEAMS = [
  { n: '南浜ユナイテッド', s: '南浜', shirt: '#d9262c', shorts: '#ffffff', socks: '#d9262c' },
  { n: '霧ヶ丘FC', s: '霧ヶ丘', shirt: '#1d4fd8', shorts: '#ffffff', socks: '#1d4fd8' },
  { n: '東雲ローヴァーズ', s: '東雲', shirt: '#f2f2f2', shorts: '#1b1b1b', socks: '#f2f2f2' },
  { n: '白樺シティ', s: '白樺', shirt: '#7ec8f2', shorts: '#0f2a4a', socks: '#7ec8f2' },
  { n: '紅葉台SC', s: '紅葉台', shirt: '#f07a1a', shorts: '#2a2a2a', socks: '#f07a1a' },
  { n: '三日月港FC', s: '三日月', shirt: '#ffd21f', shorts: '#1d3f8a', socks: '#ffd21f' },
  { n: '黒潮ワンダラーズ', s: '黒潮', shirt: '#14243a', shorts: '#14243a', socks: '#e8e8e8' },
  { n: '北灯台アスレチック', s: '北灯台', shirt: '#2e8b3e', shorts: '#ffffff', socks: '#2e8b3e' },
];
const GK_COL = ['#c6f21f', '#ff4fb0', '#9b59ff', '#20d6c7'];
// 1-2-3-1（攻める向きの座標：自分のゴールが -30）
const FORM = [[0, -28.4, 'GK'], [-8, -19, 'DF'], [8, -19, 'DF'], [-13, -7, 'MF'], [0, -9, 'MF'], [13, -7, 'MF'], [0, 3, 'FW']];

// ================= 描画 =================
try { $('load').textContent = T('load'); } catch (e) { }
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.6 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#070b16');
scene.fog = new THREE.Fog('#070b16', 90, 210);
const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 400);

scene.add(new THREE.HemisphereLight('#a9bfff', '#1d2b14', 0.75));
const sun = new THREE.DirectionalLight('#fff6e8', 2.3);
sun.position.set(25, 60, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 42, bottom: -42, near: 10, far: 140 });
sun.shadow.bias = -0.0004;
scene.add(sun);
const fill = new THREE.DirectionalLight('#cfe0ff', 0.7);
fill.position.set(-30, 40, -25);
scene.add(fill);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.fov = w < h ? 78 : 66;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- ピッチ ----------
function pitchTex() {
  const M = 6, W = HW * 2 + M * 2, L = HL * 2 + M * 2, S = 22;
  const c = document.createElement('canvas');
  c.width = W * S; c.height = L * S;
  const g = c.getContext('2d');
  const n = 12;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#2f7d33' : '#378c3a';
    g.fillRect(0, (M + i * (HL * 2 / n)) * S, c.width, (HL * 2 / n) * S + 1);
  }
  g.fillStyle = '#2f7d33'; g.fillRect(0, 0, c.width, M * S); g.fillRect(0, (L - M) * S, c.width, M * S);
  // ざらつき
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  const X = x => (x + HW + M) * S, Z = z => (z + HL + M) * S;
  g.strokeStyle = '#f2f5ee'; g.lineWidth = 0.12 * S;
  g.strokeRect(X(-HW), Z(-HL), HW * 2 * S, HL * 2 * S);
  g.beginPath(); g.moveTo(X(-HW), Z(0)); g.lineTo(X(HW), Z(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 6 * S, 0, Math.PI * 2); g.stroke();
  for (const s of [-1, 1]) {
    g.strokeRect(X(-BOX_W), s < 0 ? Z(-HL) : Z(HL - BOX_D), BOX_W * 2 * S, BOX_D * S);
    g.strokeRect(X(-5), s < 0 ? Z(-HL) : Z(HL - 3), 10 * S, 3 * S);
    g.beginPath(); g.arc(X(0), Z(s * (HL - SPOT)), 0.18 * S, 0, Math.PI * 2); g.fillStyle = '#f2f5ee'; g.fill();
    g.beginPath(); g.arc(X(0), Z(s * (HL - SPOT)), 5 * S, s < 0 ? 0.2 * Math.PI : 1.2 * Math.PI, s < 0 ? 0.8 * Math.PI : 1.8 * Math.PI); g.stroke();
  }
  g.beginPath(); g.arc(X(0), Z(0), 0.2 * S, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { t, W, L };
}
{
  const { t, W, L } = pitchTex();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  scene.add(m);
  const run = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, L + 30), new THREE.MeshStandardMaterial({ color: '#23502a', roughness: 1 }));
  run.rotation.x = -Math.PI / 2; run.position.y = -0.02; run.receiveShadow = true;
  scene.add(run);
}

// ---------- 広告看板 ----------
function boardTex(words, bg, fg) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 2048, 64);
  g.font = '900 40px "Hiragino Sans","Noto Sans JP",sans-serif'; g.textBaseline = 'middle';
  let x = 20, i = 0;
  while (x < 2048) { const w = words[i++ % words.length]; g.fillStyle = i % 2 ? fg : '#ffffff'; g.fillText(w, x, 34); x += g.measureText(w).width + 70; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
{
  const words = ['なすびのお庭', '八百長蹴球', 'NASUBI', '笛ひとつで試合が変わる', 'なすびのお庭', 'FAIR PLAY?'];
  const mk = (len, x, z, ry, col) => {
    const t = boardTex(words, col, '#ffd21f'); t.wrapS = THREE.RepeatWrapping; t.repeat.x = len / 40;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.12), [0, 0, 0, 0, 1, 1].map(k => k ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshStandardMaterial({ color: '#111' })));
    m.position.set(x, 0.45, z); m.rotation.y = ry; scene.add(m);
  };
  mk(HL * 2 + 6, -(HW + 3.5), 0, Math.PI / 2, '#0b2d6b'); mk(HL * 2 + 6, HW + 3.5, 0, -Math.PI / 2, '#0b2d6b');
  mk(HW * 2 + 6, 0, -(HL + 3.5), 0, '#6b0b16'); mk(HW * 2 + 6, 0, HL + 3.5, Math.PI, '#6b0b16');
}

// ---------- スタンドと観客 ----------
const crowdU = { uTime: { value: 0 }, uJump: { value: 0.05 }, uAng: { value: 0 } };
{
  const standMat = new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.9 });
  const sides = [
    { len: HL * 2 + 30, off: HW + 6, rot: 0, axis: 'x' }, { len: HL * 2 + 30, off: HW + 6, rot: Math.PI, axis: 'x' },
    { len: HW * 2 + 12, off: HL + 6, rot: 0, axis: 'z' }, { len: HW * 2 + 12, off: HL + 6, rot: Math.PI, axis: 'z' },
  ];
  const rows = 26, step = 0.75, rise = 0.5;
  const pts = [];
  for (const s of sides) {
    const n = Math.floor(s.len / 0.62);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.06) continue;
        const along = -s.len / 2 + i * 0.62 + rnd(-0.08, 0.08);
        const out = s.off + 1.2 + r * step, y = 1.0 + r * rise;
        const sg = s.rot ? -1 : 1;
        pts.push(s.axis === 'x' ? [sg * out, y, along] : [along, y, sg * out]);
      }
    }
    // 段
    const g = new THREE.BoxGeometry(1, 1, 1);
    for (let r = 0; r < rows; r += 1) {
      const m = new THREE.Mesh(g, standMat);
      const out = s.off + 1.2 + r * step, y = 0.5 + r * rise;
      const sg = s.rot ? -1 : 1;
      if (s.axis === 'x') { m.scale.set(step, 0.5 + 0.02, s.len); m.position.set(sg * out, y - 0.25 + 0.25, 0); }
      else { m.scale.set(s.len, 0.5, step); m.position.set(0, y, sg * out); }
      m.position.y = y - 0.05;
      scene.add(m);
    }
  }
  const geo = new THREE.CapsuleGeometry(0.2, 0.42, 2, 6);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, crowdU);
    sh.vertexShader = 'uniform float uTime;uniform float uJump;uniform float uAng;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float fid=float(gl_InstanceID);
      float ph=uTime*(6.0+mod(fid,5.0))+fid*1.37;
      transformed.y+=abs(sin(ph))*uJump*(0.5+mod(fid*0.618,1.0));
      transformed.x+=sin(uTime*2.0+fid)*0.03*uAng;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, pts.length);
  const mm = new THREE.Matrix4(), col = new THREE.Color();
  const pal = ['#d9262c', '#1d4fd8', '#f2f2f2', '#222', '#ffd21f', '#556', '#a33', '#35a', '#ddd', '#c84'];
  pts.forEach((p, i) => {
    mm.makeTranslation(p[0], p[1] + 0.4, p[2]); im.setMatrixAt(i, mm);
    col.set(pick(pal)).multiplyScalar(rnd(0.55, 1)); im.setColorAt(i, col);
  });
  im.frustumCulled = false;
  scene.add(im);
  // 照明塔
  const towerMat = new THREE.MeshStandardMaterial({ color: '#555b63', metalness: 0.5, roughness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  const glowT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,250,230,1)'); r.addColorStop(0.25, 'rgba(255,240,200,.5)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = sx * (HW + 26), z = sz * (HL + 22);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 42, 8), towerMat); pole.position.set(x, 21, z); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.6), lampMat); lamp.position.set(x, 43, z); lamp.lookAt(0, 0, 0); scene.add(lamp);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(26, 26, 1); sp.position.set(x * 0.98, 43, z * 0.98); scene.add(sp);
  }
}
// 電光掲示板
const sbC = document.createElement('canvas'); sbC.width = 512; sbC.height = 192;
const sbT = new THREE.CanvasTexture(sbC); sbT.colorSpace = THREE.SRGBColorSpace;
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ map: sbT, fog: false }));
  m.position.set(0, 24, -(HL + 6 + 1.2 + 26 * 0.75 + 1)); scene.add(m);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(17, 7, 0.5), new THREE.MeshStandardMaterial({ color: '#111' }));
  fr.position.copy(m.position); fr.position.z -= 0.3; scene.add(fr);
}
// ベンチ
{
  const bm = new THREE.MeshStandardMaterial({ color: '#c8d0d8', transparent: true, opacity: 0.55, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 6), bm); b.position.set(-(HW + 2.2), 1.1, s * 8); scene.add(b);
  }
}

// ================= モデル =================
let LIB = null;
const matCache = new Map();
function solid(hex, rough = 0.65) {
  const k = hex + rough;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));
  return matCache.get(k);
}
const SKINS = ['#e9c2a0', '#d9a882', '#c48d66', '#9c6a48', '#6e4630', '#f0cfb2'];
const HAIRS = ['#15100c', '#2b1d14', '#3d2a1a', '#6b4a2a', '#c9a35c', '#0b0b0b'];
function partClone(name, kit) {
  const o = LIB[name].clone(true);
  o.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = true;
    const n = m.material.name;
    if (kit[n]) m.material = kit[n];
  });
  return o;
}
function numTex(num, fg) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 92px "Arial Black",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = fg; g.fillText(String(num), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function contrast(hex) { const c = new THREE.Color(hex); return (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) > 0.55 ? '#111111' : '#ffffff'; }

function buildBody(kitCols, num) {
  const kit = {
    shirt: solid(kitCols.shirt, 0.7), shorts: solid(kitCols.shorts, 0.7), socks: solid(kitCols.socks, 0.8),
    skin: solid(kitCols.skin || pick(SKINS), 0.55), hair: solid(kitCols.hair || pick(HAIRS), 0.85),
  };
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const pelvis = new THREE.Group(); pelvis.position.y = 0.98; root.add(pelvis);
  const spine = new THREE.Group(); pelvis.add(spine);
  spine.add(partClone('torso', kit));
  pelvis.add(partClone('hips', kit));
  const P = { root, pelvis, spine };
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    const hip = new THREE.Group(); hip.position.set(0.095 * s, -0.06, 0); pelvis.add(hip);
    hip.add(partClone('thigh', kit));
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee); knee.add(partClone('shin', kit));
    const ank = new THREE.Group(); ank.position.y = -0.40; knee.add(ank); ank.add(partClone('boot', kit));
    const sh = new THREE.Group(); sh.position.set(0.205 * s, 0.45, 0); sh.rotation.z = 0.09 * s; spine.add(sh);
    sh.add(partClone('uarm', kit));
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el); el.add(partClone('farm', kit));
    P['hip' + k] = hip; P['knee' + k] = knee; P['sh' + k] = sh; P['el' + k] = el;
  }
  const neck = new THREE.Group(); neck.position.y = 0.53; spine.add(neck);
  neck.add(partClone('head', kit)); neck.add(partClone('hair', kit));
  P.neck = neck;
  if (num != null) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: numTex(num, contrast(kitCols.shirt)), transparent: true }));
    pl.position.set(0, 0.32, -0.118); pl.rotation.y = Math.PI; spine.add(pl);
    const pf = pl.clone(); pf.scale.setScalar(0.45); pf.position.set(0.07, 0.36, 0.118); pf.rotation.y = 0; spine.add(pf);
  }
  scene.add(root);
  return P;
}

// ================= 状態 =================
const G = {
  phase: 'title', half: 1, clock: 0, added: null, paused: true,
  teams: [], players: [], mgrs: [], subs: [],
  restart: null, lastFoul: null, offenses: [], sentOff: [],
  crowdAnger: 0, excite: 0, view: 3, roughSched: [], retal: [], violentNext: false, violentWait: 0,
  goalPending: null, pk: null, invader: null, throwT: 0, brawl: null, kickoffTeam: 0, whistleCount: 0,
};
window.G = G; G.st = { shot: 0, tackle: 0, foul: 0, save: 0, pass: 0 };
const ball = { pos: V3(0, BR, 0), vel: V3(), owner: null, held: false, last: null, lastKick: null, kickCd: 0, mesh: null, spin: V3() };
const ref = { downT: 0, slideT: 0, slideRec: 0, slideDir: 0, slideHit: new Set(), touchCd: 0, pos: V3(0, 0, -4), vel: V3(), yaw: 0, pitch: -0.12, body: null, cardT: 0, cardCol: null, hurtT: 0, kickHold: 0 };
const throwns = [];
const dusts = [];
const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
const dustMat = new THREE.SpriteMaterial({ map: dustTex, color: '#cdbf9f', transparent: true, opacity: 0.6, depthWrite: false });
function dust(x, z) { if (dusts.length > 60) return; const sp = new THREE.Sprite(dustMat.clone()); sp.position.set(x, 0.15, z); sp.scale.setScalar(0.3); scene.add(sp); dusts.push({ sp, t: 0, vy: rnd(0.4, 1.0) }); }
function updateDust(dt) { for (let i = dusts.length - 1; i >= 0; i--) { const d = dusts[i]; d.t += dt; d.sp.position.y += d.vy * dt; d.sp.scale.setScalar(0.3 + d.t * 1.4); d.sp.material.opacity = Math.max(0, 0.55 - d.t * 0.7); if (d.t > 0.8) { scene.remove(d.sp); d.sp.material.dispose(); dusts.splice(i, 1); } } }
window.__ref = ref; window.__ball = ball;

// ================= 音 =================
let AC = null, master = null;
let crowd = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = 1.0; master.connect(AC.destination);
  try { crowd = makeCrowd(AC, master); } catch (e) { console.error(e); }
}
function sWhistle(long = false) {
  if (!AC) return;
  const t = AC.currentTime, d = long ? 0.9 : 0.32;
  const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.setValueAtTime(0.25, t + d - 0.05); g.gain.linearRampToValueAtTime(0, t + d);
  const trem = AC.createOscillator(); trem.frequency.value = 28; const tg = AC.createGain(); tg.gain.value = 0.12; trem.connect(tg); tg.connect(g.gain);
  for (const f of [2950, 3120]) { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + d); }
  trem.start(t); trem.stop(t + d); g.connect(master);
}
function sSlide() {
  if (!AC) return;
  const t = AC.currentTime, n = Math.floor(AC.sampleRate * 0.6), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
  const g = AC.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
function sKick(pos, power = 1) {
  if (!AC) return;
  const d = cam.position.distanceTo(pos), vol = clamp(0.5 * power / (1 + d * 0.12), 0.01, 0.5);
  const t = AC.currentTime;
  const o = AC.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.13);
}
function sCheer(amt = 1) { if (crowd) crowd.ooh(); }
const CR = (k, ...a) => { try { crowd && crowd[k](...a); } catch (e) { } };
// ================= HUD =================
let msgT = 0;
function msg(t, dur = 2.6) { $('msg').innerHTML = t; $('msg').style.opacity = 1; msgT = dur; }
let hintText = '';
function hint(t) { if (t === hintText) return; hintText = t; $('hint').innerHTML = t; $('hint').style.opacity = t ? 1 : 0; }
function flash(a = 0.6) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
const tName = t => `<span class="tcol" style="background:${t.kit.shirt}"></span>${t.s}`;
const NM = n => { const i = SURN.indexOf(n); return i >= 0 && SURN_L[LANG.v] ? SURN_L[LANG.v][i] : n; };
const pName = p => p.role === 'MGR' ? `${tName(p.team)} ${T('mgr')} ${NM(p.name)}` : `${tName(p.team)} #${p.num} ${NM(p.name)}`;
const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
let sbLast = '';
function drawHUD() {
  const [A, B] = G.teams;
  $('sc').textContent = `${A.score} - ${B.score}`;
  $('ck').textContent = fmt(G.clock);
  $('hf').textContent = G.half === 1 ? T('first') : T('second');
  $('ad').textContent = G.added != null ? '+' + G.added : '';
  const key = A.score + '-' + B.score + fmt(G.clock) + G.half + G.added;
  if (key !== sbLast) {
    sbLast = key;
    const g = sbC.getContext('2d');
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 512, 192);
    g.font = '900 34px "Hiragino Sans","Noto Sans JP",sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = A.kit.shirt; g.fillRect(16, 26, 18, 44); g.fillStyle = B.kit.shirt; g.fillRect(478, 26, 18, 44);
    g.fillStyle = '#fff'; g.fillText(A.s, 120, 50); g.fillText(B.s, 392, 50);
    g.font = '900 64px ui-monospace,Menlo,monospace'; g.fillStyle = '#ffd21f'; g.fillText(`${A.score} - ${B.score}`, 256, 52);
    g.font = '900 46px ui-monospace,Menlo,monospace'; g.fillStyle = '#7dff9a';
    g.fillText((G.half === 1 ? '1st ' : '2nd ') + fmt(G.clock) + (G.added != null ? '  +' + G.added : ''), 256, 140);
    sbT.needsUpdate = true;
  }
}

// ================= 選手 =================
function attackZ(team, z) { return z * team.dir; }
function makeTeam(def, i, str) {
  const t = { ...def, i, kit: { shirt: def.shirt, shorts: def.shorts, socks: def.socks }, str, dir: i === 0 ? 1 : -1, score: 0, players: [], anger: 0, gkCol: GK_COL[i * 2 + ((Math.random() * 2) | 0)] };
  return t;
}
function makePlayer(team, slot, num, name) {
  const f = FORM[slot];
  const isGK = f[2] === 'GK';
  const cols = isGK ? { shirt: team.gkCol, shorts: '#1b1b1b', socks: team.gkCol } : team.kit;
  const p = {
    team, slot, role: f[2], num, name: name || pick(SURN), body: null,
    pos: V3(), vel: V3(), face: 0, ph: Math.random() * 6, state: 'play', stT: 0,
    yellow: 0, off: false, gone: false, tackCd: rnd(0.3, 1), decideT: 0, kickT: 0, act: null, actT: 0,
    injured: 0, needSub: false, speedMul: rnd(0.93, 1.05), appeal: 0, lean: 0, fallDir: 1,
  };
  p.body = buildBody({ ...cols, skin: pick(SKINS) }, num);
  return p;
}
function homeSpot(p, out) {
  const t = p.team, f = FORM[p.slot];
  const bz = attackZ(t, ball.pos.z), bx = ball.pos.x;
  const poss = ball.owner && ball.owner.team === t;
  let x = f[0], za = f[1];
  if (p.role === 'GK') {
    x = clamp(bx * 0.18, -1.8, 1.8); za = -28.6 + (bz < -18 ? clamp((bz + 18) * -0.15, 0, 2.5) : 0);
  } else {
    const shift = clamp(bz * 0.55, -13, 19) + (poss ? (p.role === 'DF' ? 3 : 6) : 0);
    za = clamp(f[1] + shift, -26, p.role === 'FW' ? 26 : 22);
    x = clamp(f[0] * 0.9 + bx * 0.28, -HW + 2, HW - 2);
    if (p.role === 'FW' && poss) { za = clamp(bz + 8, 4, 25); x = clamp(bx * 0.4 + (p.slot % 2 ? 4 : -4), -10, 10); }
  }
  return out.set(x, 0, za * t.dir);
}
const tmpV = V3(), tmpV2 = V3(), tmpV3 = V3();
function active(t) { return t.players.filter(p => !p.off && !p.gone && p.state !== 'leaving'); }
function allActive() { return G.players.filter(p => !p.off && !p.gone && p.state !== 'leaving'); }
function canMove(p) { return p.state === 'play' || p.state === 'protest' || p.state === 'appeal'; }
function maxSpeed(p) { return (6.1 + 1.4 * p.team.str) * p.speedMul * (p.injured > 0 && p.needSub ? 0.55 : 1); }

// ================= ボール =================
function kickBall(by, dir, speed, lift) {
  ball.owner = null; ball.held = false;
  ball.vel.set(dir.x * speed, lift, dir.z * speed);
  ball.last = by; ball.lastKick = by; ball.kickCd = 0.32;
  if (by && by !== 'ref') ball.lastP = by;
  if (by && by !== 'ref') { by.kickT = 0.35; by.act = 'kick'; by.actT = 0.35; }
  sKick(ball.pos, speed / 20);
}
function goalLineCross(prevZ) {
  for (const s of [-1, 1]) {
    const line = s * (HL + BR);
    if ((prevZ - line) * s <= 0 && (ball.pos.z - line) * s > 0) return s;
  }
  return 0;
}
function updateBall(dt) {
  if (ball.held) {
    tmpV.set(Math.sin(ref.yaw) * 0.45, 0, Math.cos(ref.yaw) * 0.45);
    ball.pos.set(ref.pos.x + tmpV.x, 1.05, ref.pos.z + tmpV.z);
    ball.vel.set(0, 0, 0);
  } else if (ball.owner) {
    const o = ball.owner;
    if (!o.gkHold && Math.hypot(ball.pos.x - ref.pos.x, ball.pos.z - ref.pos.z) < REF_R + 0.25 && Math.hypot(ref.vel.x, ref.vel.z) > 1.2 && ref.touchCd <= 0) {
      ball.owner = null; refTouchKick(Math.hypot(ref.vel.x, ref.vel.z)); o.team.anger += 5; startProtest(o, 1.2);
    }
  }
  if (ball.held) {} else if (ball.owner) {
    const o = ball.owner;
    if (o.role === 'GK' && o.gkHold) {
      ball.pos.set(o.pos.x + Math.sin(o.face) * 0.35, 1.0, o.pos.z + Math.cos(o.face) * 0.35);
      ball.vel.set(0, 0, 0);
    } else {
      const tx = o.pos.x + Math.sin(o.face) * 0.55, tz = o.pos.z + Math.cos(o.face) * 0.55;
      ball.pos.x = lerp(ball.pos.x, tx, clamp(dt * 12, 0, 1)); ball.pos.z = lerp(ball.pos.z, tz, clamp(dt * 12, 0, 1)); ball.pos.y = BR;
      ball.vel.copy(o.vel);
    }
  } else {
    const prevZ = ball.pos.z, prevX = ball.pos.x;
    ball.vel.y -= 9.8 * dt;
    ball.pos.addScaledVector(ball.vel, dt);
    if (ball.pos.y < BR) {
      ball.pos.y = BR;
      if (ball.vel.y < -1.2) { ball.vel.y *= -0.52; ball.vel.x *= 0.85; ball.vel.z *= 0.85; }
      else ball.vel.y = 0;
    }
    const h = Math.hypot(ball.vel.x, ball.vel.z);
    if (h > 0) {
      const dec = ball.pos.y <= BR + 0.01 ? (0.9 + 0.32 * h) * dt : 0.015 * h * dt;
      const nh = Math.max(0, h - dec); ball.vel.x *= nh / h; ball.vel.z *= nh / h;
    }
    // ポストとバー
    for (const s of [-1, 1]) {
      const gz = s * HL;
      for (const px of [-GWH, GWH]) {
        const dx = ball.pos.x - px, dz = ball.pos.z - gz, d = Math.hypot(dx, dz);
        if (d < BR + 0.06 && ball.pos.y < GH) { const nx = dx / d, nz = dz / d, vn = ball.vel.x * nx + ball.vel.z * nz; if (vn < 0) { ball.vel.x -= 1.7 * vn * nx; ball.vel.z -= 1.7 * vn * nz; sKick(ball.pos, 1.4); } }
      }
      { const dy = ball.pos.y - GH, dz = ball.pos.z - gz, d = Math.hypot(dy, dz); if (d < BR + 0.06 && Math.abs(ball.pos.x) < GWH) { const ny = dy / d, nz = dz / d, vn = ball.vel.y * ny + ball.vel.z * nz; if (vn < 0) { ball.vel.y -= 1.7 * vn * ny; ball.vel.z -= 1.7 * vn * nz; sKick(ball.pos, 1.4); } } }
      // ネットの中
      const inZ = (ball.pos.z - gz) * s;
      if (inZ > 0 && inZ < 2.2 && Math.abs(ball.pos.x) < GWH + 0.1 && ball.pos.y < GH + 0.1) {
        if (inZ > 1.55) { ball.pos.z = gz + s * 1.55; ball.vel.z *= -0.15; ball.vel.x *= 0.4; }
        if (Math.abs(ball.pos.x) > GWH - BR) { ball.pos.x = Math.sign(ball.pos.x) * (GWH - BR); ball.vel.x *= -0.2; }
        if (ball.pos.y > GH - BR) { ball.pos.y = GH - BR; ball.vel.y = -Math.abs(ball.vel.y) * 0.2; }
      }
    }
    // 選手の体に当たる（取れない速さのボールは跳ね返る）
    for (const p of G.players) {
      if (p.gone || p.off || (ball.lastKick === p && ball.kickCd > 0)) continue;
      const down = p.state === 'down';
      const R0 = down ? 0.55 : 0.33, H0 = down ? 0.45 : 1.85;
      if (ball.pos.y > H0) continue;
      // 1コマで通りぬけないよう、動いた線の上でいちばん近い点で調べる
      const sx = ball.pos.x - prevX, sz = ball.pos.z - prevZ, sl = sx * sx + sz * sz;
      const tt = sl > 1e-6 ? clamp(((p.pos.x - prevX) * sx + (p.pos.z - prevZ) * sz) / sl, 0, 1) : 1;
      const cx = prevX + sx * tt, cz = prevZ + sz * tt;
      let dx = cx - p.pos.x, dz = cz - p.pos.z, d = Math.hypot(dx, dz);
      if (d < R0 + BR) {
        if (d < 1e-4) { dx = -sx; dz = -sz; d = Math.hypot(dx, dz) || 1; }
        const nx = dx / d, nz = dz / d, vn = (ball.vel.x - p.vel.x) * nx + (ball.vel.z - p.vel.z) * nz;
        if (vn < 0) {
          ball.vel.x -= 1.45 * vn * nx; ball.vel.z -= 1.45 * vn * nz; ball.vel.x *= 0.75; ball.vel.z *= 0.75;
          ball.vel.x += rnd(-1, 1); ball.vel.z += rnd(-1, 1);
          ball.last = p; ball.lastP = p; sKick(ball.pos, 0.5);
          if (Math.abs(vn) > 16 && !down) { p.state = 'stumble'; p.stT = 0.6; }
        }
        ball.pos.x = p.pos.x + nx * (R0 + BR); ball.pos.z = p.pos.z + nz * (R0 + BR);
      }
    }
    // 審判の体に当たる：走っていれば、その向きと勢いで蹴る
    {
      const dx = ball.pos.x - ref.pos.x, dz = ball.pos.z - ref.pos.z, d = Math.hypot(dx, dz);
      if (d < REF_R + BR && ball.pos.y < 1.85) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        const rs = Math.hypot(ref.vel.x, ref.vel.z);
        if (rs > 1.2 && ball.pos.y < 1.3 && (ref.vel.x * nx + ref.vel.z * nz) > 0 && ref.touchCd <= 0) refTouchKick(rs);
        else {
          const rvx = ball.vel.x - ref.vel.x, rvz = ball.vel.z - ref.vel.z, vn = rvx * nx + rvz * nz;
          if (vn < 0) {
            ball.vel.x -= 1.6 * vn * nx; ball.vel.z -= 1.6 * vn * nz; ball.last = 'ref'; sKick(ball.pos, 0.6);
            if (Math.abs(vn) > 10) { ref.hurtT = 0.5; $('hurt').style.opacity = 0.7; setTimeout(() => $('hurt').style.opacity = 0, 250); }
          }
        }
        ball.pos.x = ref.pos.x + nx * (REF_R + BR); ball.pos.z = ref.pos.z + nz * (REF_R + BR);
      }
    }
    // 看板
    if (Math.abs(ball.pos.x) > HW + 3.3) { ball.pos.x = Math.sign(ball.pos.x) * (HW + 3.3); ball.vel.x *= -0.4; }
    if (Math.abs(ball.pos.z) > HL + 3.3 && !(Math.abs(ball.pos.x) < GWH && ball.pos.y < GH)) { ball.pos.z = Math.sign(ball.pos.z) * (HL + 3.3); ball.vel.z *= -0.4; }
    // ゴールと外
    if (G.phase === 'live' || G.phase === 'pkshot') {
      const s = goalLineCross(prevZ);
      if (s) {
        const t = (s * (HL + BR) - prevZ) / ((ball.pos.z - prevZ) || 1e-6), cx = lerp(prevX, ball.pos.x, t);
        if (Math.abs(cx) < GWH - BR && ball.pos.y < GH - BR) onGoal(s);
        else onOut('goal', s);
      } else if (Math.abs(ball.pos.x) > HW + BR) onOut('touch', Math.sign(ball.pos.x));
    }
  }
  if (ball.kickCd > 0) ball.kickCd -= dt;
  // 回転
  const hs = Math.hypot(ball.vel.x, ball.vel.z);
  if (hs > 0.05 && ball.mesh) { tmpV.set(ball.vel.z, 0, -ball.vel.x).normalize(); ball.mesh.rotateOnWorldAxis(tmpV, hs * dt / BR); }
  if (ball.mesh) ball.mesh.position.copy(ball.pos);
}

// ================= 判定・進行 =================
function teamOfGoal(s) { return G.teams.find(t => t.dir === -s); } // そのゴールを守るチーム
function defendingTeamAtZ(z) { return z * G.teams[0].dir < 0 ? G.teams[0] : G.teams[1]; }
function inBox(team, pos) { return Math.abs(pos.x) < BOX_W && attackZ(team, pos.z) < -(HL - BOX_D); }
function setPhase(ph) { G.phase = ph; }
function whistleStop(stopAll = true) {
  sWhistle();
  ball.owner = null;
  for (const p of allActive()) { p.vel.multiplyScalar(0.2); p.freeze = 1.0; }
}
function onGoal(s) {
  const def = teamOfGoal(s), att = G.teams[1 - def.i];
  G.goalPending = { att, def, by: ball.last, t: 0 };
  setPhase('goal');
  att.score++;
  CR('goal'); flash(0.35);
  const by = ball.last === 'ref' ? `<b style="color:#ffd21f">${T('ref')}</b>` : ball.last && ball.last.team === def ? `${pName(ball.last)}${T('og')}` : ball.last ? pName(ball.last) : '';
  msg(`${T('goal')} ${tName(att)}<br><small>${by}</small>`, 4);
  for (const p of active(att)) { if (p.state === 'play') { p.act = 'cele'; p.actT = 4; } }
  for (const p of active(def)) { if (p.state === 'play') { p.act = 'sad'; p.actT = 3; } }
  if (ball.last === 'ref') { def.anger += 45; G.crowdAnger += 40; for (const p of nearest(active(def), ref.pos, 4)) startProtest(p, 5); }
  hint(T('hintCancel'));
  save();
}
function confirmGoal() {
  const gp = G.goalPending; G.goalPending = null; hint('');
  setRestart('kickoff', gp.def);
}
function cancelGoal() {
  const gp = G.goalPending; G.goalPending = null;
  gp.att.score--; gp.att.anger += 35; G.crowdAnger += 25; missJudge('missGoal');
  msg(T('goalCancelled', tName(gp.att)), 3);
  for (const p of nearest(active(gp.att), ref.pos, 4)) startProtest(p, 5);
  const gk = active(gp.def).find(p => p.role === 'GK');
  setRestart('goalkick', gp.def, V3(0, BR, -gp.def.dir * (HL - 3)));
}
function onOut(kind, s) {
  G.outs = (G.outs || 0) + 1;
  if (kind === 'goal' && performance.now() - (G.lastShot || 0) < 2500) CR('miss');
  ball.owner = null;
  const lastTeam = ball.last && ball.last !== 'ref' ? ball.last.team : (ball.lastP ? ball.lastP.team : null);
  const byRef = ball.last === 'ref';
  if (byRef) msg(T('refOut'), 1.6);
  let correct, type, spot;
  if (kind === 'touch') {
    const t = lastTeam ? G.teams[1 - lastTeam.i] : G.teams[Math.random() < .5 ? 0 : 1];
    correct = { type: 'throw', team: t };
    spot = V3(s * HW, BR, clamp(ball.pos.z, -HL + 1, HL - 1));
  } else {
    const def = teamOfGoal(s);
    if (lastTeam === def) { correct = { type: 'corner', team: G.teams[1 - def.i] }; spot = V3(Math.sign(ball.pos.x || 1) * (HW - 0.5), BR, s * (HL - 0.5)); }
    else { correct = { type: 'goalkick', team: def }; spot = V3(clamp(ball.pos.x * 0.2, -3, 3), BR, s * (HL - 3)); }
  }
  setPhase('out');
  G.outInfo = { correct, spot, kind, s, t: 0 };
  openOutPanel();
}
function setRestart(type, team, spot) {
  ball.owner = null; ball.held = false;
  const R = { type, team, spot: spot ? spot.clone() : ball.pos.clone(), t: 0, taker: null, ready: false };
  R.spot.y = BR;
  if (type === 'kickoff') R.spot.set(0, BR, 0);
  if (type === 'pk') { const def = G.teams[1 - team.i]; R.spot.set(0, BR, -def.dir * (HL - SPOT)); }
  const act = active(team);
  if (act.length === 0) { endMatch(); return; }
  if (type === 'goalkick') R.taker = act.find(p => p.role === 'GK') || act[0];
  else if (type === 'kickoff') R.taker = act.find(p => p.role === 'FW') || nearest(act.filter(p => p.role !== 'GK'), R.spot, 1)[0] || act[0];
  else if (type === 'pk') R.taker = act.find(p => p.role === 'FW') || act.filter(p => p.role !== 'GK').sort((a, b) => b.team.str - a.team.str)[0] || act[0];
  else R.taker = nearest(act.filter(p => p.role !== 'GK' || type === 'fk'), R.spot, 1)[0] || act[0];
  G.restart = R;
  ball.pos.copy(R.spot); ball.vel.set(0, 0, 0);
  setPhase('restart');
  const needW = type === 'kickoff' || type === 'fk' || type === 'pk' || type === 'drop';
  R.needW = needW;
  const lbl = { kickoff: T('kickoff'), fk: T('fk'), pk: T('pk'), throw: T('throw'), corner: T('cornerK'), goalkick: T('goalkick'), drop: T('drop') }[type];
  if (type !== 'kickoff') msg(`${lbl}：${tName(team)}`, 2.4);
  if (type === 'pk') { G.pk = { state: 'setup', t: 0, retakes: 0, side: pick([-1, 1]), high: Math.random() < 0.35 }; }
}
function restartPos(p, R, out) {
  const t = p.team, own = t === R.team, def = G.teams[1 - R.team.i];
  homeSpot(p, out);
  if (R.type === 'kickoff') {
    const za = clamp(attackZ(t, out.z), -27, -1.2); out.z = za * t.dir;
    if (p === R.taker) out.set(0.3, 0, -t.dir * 0.4);
    if (Math.hypot(out.x, out.z) < 6.5 && p !== R.taker) { const a = Math.atan2(out.x, out.z); out.x = Math.sin(a) * 6.8; out.z = Math.cos(a) * 6.8; }
  } else if (R.type === 'pk') {
    if (p === R.taker) out.set(0, 0, R.spot.z - (-def.dir) * 2.2);
    else if (p.role === 'GK' && t === def) out.set(0, 0, -def.dir * (HL - 0.1));
    else { const za = attackZ(def, R.spot.z); out.x = clamp(out.x, -15, 15); if (Math.abs(out.x) < BOX_W + 1) { const z2 = -def.dir * (HL - BOX_D - 2); out.z = z2; } }
  } else {
    if (p === R.taker) {
      tmpV3.set(-R.spot.x, 0, -R.spot.z).normalize();
      if (R.type === 'throw') out.set(R.spot.x + Math.sign(R.spot.x) * 0.3, 0, R.spot.z);
      else out.set(R.spot.x - tmpV3.x * 0.9, 0, R.spot.z - tmpV3.z * 0.9);
    } else if (!own && (R.type === 'fk' || R.type === 'corner' || R.type === 'goalkick')) {
      const d = out.distanceTo(R.spot);
      if (d < 9.2) { tmpV3.subVectors(out, R.spot).setY(0); if (tmpV3.lengthSq() < 0.01) tmpV3.set(1, 0, 0); tmpV3.normalize(); out.copy(R.spot).addScaledVector(tmpV3, 9.3); out.y = 0; }
      if (R.type === 'goalkick' && inBox(R.team, out)) out.z = -R.team.dir * (HL - BOX_D - 1.5);
    }
    if (R.type === 'corner' && p.role !== 'GK') {
      const dz = -R.team.dir; // 守る側のゴール
      const goalZ = R.spot.z > 0 ? HL : -HL;
      if (p !== R.taker && (own ? p.role !== 'DF' : true)) { out.z = goalZ - Math.sign(goalZ) * rnd(3, 9); out.x = rnd(-7, 7); }
    }
  }
  out.x = clamp(out.x, -HW - 1, HW + 1); out.z = clamp(out.z, -HL - 0.5, HL + 0.5);
  return out;
}
function executeRestart() {
  const R = G.restart; if (!R) return;
  const p = R.taker;
  if (R.type === 'pk') { G.pk.state = 'runup'; G.pk.t = 0; hint(''); return; }
  if (R.type === 'kickoff') { G.koDone = true; if (G.clock < 1) G.clock = 0; }
  G.restart = null; setPhase('live');
  hint('');
  if (!p || p.gone || p.off) return;
  ball.pos.copy(R.spot);
  if (R.type === 'drop') { ball.vel.set(0, 2, 0); ball.last = null; return; }
  const tgt = choosePass(p, R.type === 'corner' || R.type === 'goalkick' ? 'long' : 'safe');
  if (R.type === 'corner' && Math.random() < 0.85) {
    const gz = R.spot.z > 0 ? HL : -HL; tmpV.set(rnd(-4, 4), 0, gz - Math.sign(gz) * rnd(4, 8));
    passTo(p, tmpV, 1.3, true);
  } else if (tgt) { ball.intended = tgt; passTo(p, leadPoint(tgt), R.type === 'goalkick' ? 1.15 : 1, R.type === 'goalkick'); }
  else passTo(p, tmpV.set(p.pos.x, 0, p.pos.z + p.team.dir * 12), 1, false);
  if (R.type === 'throw') { p.act = 'throw'; p.actT = 0.5; ball.vel.y = 3.5; }
}
function nearest(list, pos, n = 1) { return list.slice().sort((a, b) => a.pos.distanceToSquared(pos) - b.pos.distanceToSquared(pos)).slice(0, n); }
function leadPoint(m) { return tmpV2.copy(m.pos).addScaledVector(m.vel, 0.35); }
// 転がるボールが止まるまでの距離（updateBall の減速と同じ式）
function rollDist(v) { return v / 0.32 - (0.9 / (0.32 * 0.32)) * Math.log(1 + 0.32 * v / 0.9); }
function speedFor(d) { let lo = 2, hi = 40; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (rollDist(m) < d) lo = m; else hi = m; } return (lo + hi) / 2; }
function passTo(p, target, mul = 1, air = false) {
  G.st.pass++;
  target.x = clamp(target.x, -HW + 2.5, HW - 2.5); target.z = clamp(target.z, -HL + 1.5, HL - 1.5);
  tmpV.subVectors(target, ball.pos); tmpV.y = 0;
  const d = tmpV.length() || 1; tmpV.divideScalar(d);
  const err = (1.1 - p.team.str) * 0.07; const a = rnd(-err, err);
  const c = Math.cos(a), s = Math.sin(a); const x = tmpV.x * c - tmpV.z * s, z = tmpV.x * s + tmpV.z * c; tmpV.set(x, 0, z);
  let sp, lift;
  if (air || d > 26) { lift = clamp(d * 0.2, 4, 8); const t = 2 * lift / 9.8; sp = clamp((d * 0.82) / t, 6, 24); }
  else { sp = clamp(speedFor(d + 3.5) * rnd(0.95, 1.06) * (mul > 1 ? 1.05 : 1), 5, 24); lift = 0.3; }
  kickBall(p, tmpV, sp, lift);
}
function choosePass(p, mode = 'normal') {
  const mates = active(p.team).filter(m => m !== p && m.state === 'play');
  const opp = active(G.teams[1 - p.team.i]);
  let best = null, bs = -1e9;
  for (const m of mates) {
    const d = m.pos.distanceTo(p.pos); if (d < 4 || d > (mode === 'long' ? 40 : 30)) continue;
    const prog = attackZ(p.team, m.pos.z) - attackZ(p.team, p.pos.z);
    let block = 0;
    for (const o of opp) { const dd = distToSeg(o.pos, p.pos, m.pos); if (dd < 3) block += (3 - dd) * 4; const om = o.pos.distanceTo(m.pos); if (om < 3.5) block += (3.5 - om) * 2.5; }
    const sc = prog * (mode === 'safe' ? 0.2 : 0.55) - block * 2.2 - Math.abs(d - 11) * 0.25 + (m.role === 'GK' ? -6 : 0) + rnd(-2, 2);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
function distToSeg(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z, l = abx * abx + abz * abz || 1;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / l, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}
function shoot(p) {
  ball.intended = null;
  G.st.shot++;
  const s = p.team.dir, gz = s * HL;
  const wide = Math.random() < 0.35 - p.team.str * 0.15;
  const tx = wide ? (Math.random() < .5 ? -1 : 1) * rnd(GWH + 0.3, GWH + 3) : rnd(-GWH + 0.25, GWH - 0.25) * (Math.random() < 0.6 ? 1 : 0.7);
  tmpV.set(tx - ball.pos.x, 0, gz - ball.pos.z);
  const d = tmpV.length(); tmpV.normalize();
  const err = (1.1 - p.team.str) * 0.09 + d * 0.002; const a = rnd(-err, err);
  const c = Math.cos(a), sn = Math.sin(a); const x = tmpV.x * c - tmpV.z * sn, z = tmpV.x * sn + tmpV.z * c; tmpV.set(x, 0, z);
  kickBall(p, tmpV, rnd(19, 27) * (0.9 + p.team.str * 0.15), rnd(0.8, 3.6) + d * 0.04);
  G.excite = Math.min(1, G.excite + 0.5);
  G.lastShot = performance.now(); CR('shot');
}

// ---------- タックル・反則 ----------
function scheduleRough() {
  const n1 = Math.random() < 0.5 ? 2 : 3, n2 = 5 - n1, arr = [];
  for (let i = 0; i < (G.half === 1 ? n1 : n2); i++) arr.push(rnd(20, HALF_LEN - 20));
  G.roughSched = arr.sort((a, b) => a - b);
}
function tackle(t, v) {
  t.tackCd = rnd(1.2, 2.4);
  if (Math.random() < 0.18 && !G.violentNext) return; // つめるだけ
  if (!canMove(t) || !canMove(v)) return;
  G.st.tackle++;
  // 倒れたふり（ダイブ）
  if (!G.violentNext && Math.random() < 0.08) { doDive(v, t); return; }
  let kind;
  if (G.violentNext) { kind = Math.random() < 0.6 ? 'drop' : 'slide'; }
  else { const r = Math.random(); kind = r < 0.13 ? 'clean' : r < 0.43 ? 'drop' : r < 0.75 ? 'slide' : 'pull'; }
  tmpV.subVectors(v.pos, t.pos).setY(0); const dl = tmpV.length() || 1; tmpV.divideScalar(dl);
  const dir = tmpV.clone();
  if (kind === 'clean') {
    t.act = 'slide'; t.actT = 0.6; t.vel.multiplyScalar(0.5);
    const winP = 0.5 + (t.team.str - v.team.str) * 0.4;
    if (Math.random() < winP) { ball.owner = null; tmpV.subVectors(ball.pos, t.pos).setY(0).normalize(); kickBall(t, tmpV, rnd(4, 9), 0.3); }
    else { t.state = 'stumble'; t.stT = 0.5; }
    return;
  }
  let sev; const r = Math.random();
  if (G.violentNext) { sev = 'red'; G.violentNext = false; }
  else if (kind === 'drop') sev = r < 0.5 ? 'red' : 'yellow';
  else if (kind === 'slide') sev = r < 0.2 ? 'red' : r < 0.6 ? 'yellow' : 'foul';
  else sev = r < 0.2 ? 'yellow' : 'foul';
  // 動き
  if (kind === 'drop') { t.act = 'drop'; t.actT = 0.8; t.vel.copy(dir).multiplyScalar(7); t.dropLand = true; }
  else if (kind === 'slide') { t.act = 'slide'; t.actT = 0.75; t.vel.copy(dir).multiplyScalar(6); }
  else { t.act = 'pull'; t.actT = 0.7; t.vel.multiplyScalar(0.3); }
  G.st.foul++;
  ball.owner = null;
  ball.vel.set(dir.x * rnd(1, 3) + rnd(-1.5, 1.5), 0.5, dir.z * rnd(1, 3) + rnd(-1.5, 1.5)); ball.last = t;
  const behind = (Math.sin(v.face) * dir.x + Math.cos(v.face) * dir.z) > 0; // 後ろから来たか
  foulFall(v, sev, { push: kind === 'drop' ? 3.6 : kind === 'slide' ? 1.6 : 0.6, dir, back: kind === 'pull' ? true : !behind });
  addFoul(t, v, sev);
  if (kind === 'drop') msg(`<span style="color:#ff8a8a">${T('dropkick', pName(t))}</span>`, 1.8);
  else if (sev === 'red') msg(`<span style="color:#ff8a8a">${T('danger')}</span>`, 1.6);
  else if (kind === 'pull' && sev === 'yellow') msg(T('pull', pName(t)), 1.4);
  if (Math.random() < (sev !== 'foul' ? 0.85 : 0.35)) G.retal.push({ team: v.team, target: t, at: G.clock + rnd(12, 35) });
}
function addFoul(t, v, sev) {
  if (sev === 'red' && G.phase === 'live') (G.unseen = G.unseen || []).push({ p: t, w: 0 });
  const spot = v.pos.clone();
  G.lastFoul = { by: t, on: v, team: v.team, spot, sev, pk: inBox(t.team, spot), time: G.clock, half: G.half, real: performance.now() };
  G.offenses.push({ p: t, sev, real: performance.now() });
  for (const m of nearest(active(v.team).filter(x => x !== v), spot, 2)) { m.appeal = 1.4; }
  if (sev !== 'foul') CR('foul');
  if (sev === 'red') { G.excite = 1; G.crowdAnger += 10; v.team.anger += 12; if (v.team.anger > 28 && !G.brawl && Math.random() < 0.55) startBrawl(spot); }
}
function doDive(v, t) {
  ball.owner = null; ball.vel.set(rnd(-2, 2), 0.3, rnd(-2, 2)); ball.last = v;
  v.state = 'down'; v.stT = rnd(1.4, 2.4); v.fallBack = Math.random() < 0.5; v.injured = 0;
  v.act = 'dive2'; v.actT = 0.3;
  const spot = v.pos.clone();
  G.lastFoul = { by: t, on: v, team: v.team, spot, sev: 'dive', pk: inBox(t.team, spot), time: G.clock, half: G.half, real: performance.now() };
  G.offenses.push({ p: v, sev: 'yellow', dive: true, real: performance.now() }); // 演技はイエローの対象
  for (const m of nearest(active(v.team).filter(x => x !== v), spot, 2)) { m.appeal = 1.4; }
}
function foulFall(v, sev, o = {}) {
  v.state = 'down'; v.fallDir = Math.random() < .5 ? 1 : -1; v.fallBack = o.back ?? (Math.random() < 0.5);
  v.stT = sev === 'red' ? rnd(9, 14) : sev === 'yellow' ? rnd(3, 5) : rnd(1.4, 2.6);
  if (o.dir) v.vel.copy(o.dir).multiplyScalar(o.push || 1); else v.vel.multiplyScalar(0.3);
  if (sev === 'red') { v.injured = 1; if (Math.random() < 0.45) { v.needSub = true; } }
}
function scuffle() {
  // ボールのない所の小競り合い（突き飛ばし・足かけ・ユニフォーム・頭突き）
  const list = allActive().filter(p => p.state === 'play' && p.role !== 'GK' && canMove(p) && ball.owner !== p);
  const near = nearest(list, ball.pos, 8);
  for (const a of near) for (const b of near) {
    if (a.team === b.team || a.pos.distanceTo(b.pos) > 6) continue;
    tmpV.subVectors(b.pos, a.pos).setY(0); const d = tmpV.length() || 1; tmpV.divideScalar(d);
    const dir = tmpV.clone(); const r = Math.random();
    const kind = r < 0.4 ? 'shove' : r < 0.65 ? 'trip' : r < 0.85 ? 'pull' : 'headb';
    const s2 = Math.random();
    const sev = kind === 'headb' ? 'red' : s2 < 0.5 ? 'foul' : s2 < 0.92 ? 'yellow' : 'red';
    a.pos.copy(b.pos).addScaledVector(dir, -0.9);
    a.act = kind === 'shove' ? 'punch' : kind === 'trip' ? 'slide' : kind === 'pull' ? 'pull' : 'elbow'; a.actT = 0.6;
    foulFall(b, sev, { push: kind === 'shove' ? 2.4 : kind === 'trip' ? 1.0 : kind === 'headb' ? 1.6 : 0.6, dir, back: kind !== 'trip' });
    addFoul(a, b, sev);
    msg(`<span style="color:#ff8a8a">${T(kind, pName(a))}</span>`, 1.6);
    G.st.scuf = (G.st.scuf || 0) + 1;
    if (Math.random() < 0.6) G.retal.push({ team: b.team, target: a, at: G.clock + rnd(4, 15) });
    return true;
  }
  return false;
}
function offBallViolence() {
  const list = allActive().filter(p => p.state === 'play' && p.role !== 'GK');
  // 倒れている選手を踏む
  const downs = allActive().filter(p => p.state === 'down');
  for (const d of downs) for (const a of list) {
    if (a.team !== d.team && a.pos.distanceTo(d.pos) < 5) {
      a.act = 'stomp'; a.actT = 0.6; d.stT = Math.max(d.stT, rnd(8, 12)); d.injured = 1;
      addFoul(a, d, 'red'); msg(`<span style="color:#ff8a8a">${T('stomp')}</span>`, 1.8);
      return true;
    }
  }
  const near = nearest(list, ball.pos, 7);
  for (const a of near) for (const b of near) {
    if (a.team !== b.team && a.pos.distanceTo(b.pos) < 4) {
      tmpV.subVectors(b.pos, a.pos).setY(0).normalize();
      const punch = Math.random() < 0.6;
      a.act = punch ? 'punch' : 'elbow'; a.actT = 0.6;
      foulFall(b, 'red', { push: 1.2, dir: tmpV.clone(), back: true });
      addFoul(a, b, 'red');
      msg(`<span style="color:#ff8a8a">${T(punch ? 'punch' : 'elbow')}</span>`, 1.8);
      return true;
    }
  }
  return false;
}
function updateRetal() {
  if (G.phase !== 'live' || !G.retal.length) return;
  for (let i = G.retal.length - 1; i >= 0; i--) {
    const R = G.retal[i]; if (G.clock < R.at) continue;
    G.retal.splice(i, 1);
    if (R.target.off || R.target.gone) continue;
    const av = nearest(active(R.team).filter(p => p.role !== 'GK' && p.state === 'play'), R.target.pos, 1)[0];
    if (!av) continue;
    av.state = 'retal'; av.stT = 8; av.retalT = R.target;
  }
}
function calmAll() {
  // 笛：だれでも必ず落ち着く
  G.brawl = null; G.retal = [];
  for (const p of G.players) {
    if (['brawl', 'protest', 'retal', 'attackRef'].includes(p.state)) { p.state = 'play'; p.freeze = 1.0; }
    p.pushed = false; p.retalT = null; p.appeal = 0; if (p.act === 'push' || p.act === 'protest') p.act = null;
  }
  for (const m of G.mgrs) if (m.state === 'brawl') m.state = 'back';
  for (const t of G.teams) t.anger *= 0.6;
}
// ---------- 抗議・怒り ----------
function startProtest(p, dur = 3) { if (p.off || p.gone || p.state === 'down' || p.state === 'leaving') return; p.state = 'protest'; p.stT = dur; }
function deserved(p, need) {
  const now = performance.now();
  return G.offenses.some(o => o.p === p && now - o.real < 25000 && (need === 'yellow' ? o.sev !== 'foul' || true : o.sev === 'red'));
}
function giveCard(p, col) {
  if (!p || p.gone || p.off) return;
  ref.cardT = 1.5; ref.cardCol = col;
  const c = $('card'); c.style.background = col === 'Y' ? 'var(--yel)' : 'var(--red)'; if (G.view === 1) c.classList.add('up'); setTimeout(() => c.classList.remove('up'), 1700);
  sWhistle();
  if (p.role === 'MGR') {
    if (col === 'R') { p.off = true; p.state = 'leaving'; msg(T('mgrOff', pName(p)), 3); G.sentOff.push({ p, t: G.clock, half: G.half }); }
    else msg(T('mgrWarn', pName(p)), 2.5);
    p.team.anger += 15; return;
  }
  const just = col === 'Y' ? G.offenses.some(o => o.p === p && performance.now() - o.real < 25000) : G.offenses.some(o => o.p === p && o.sev === 'red' && performance.now() - o.real < 25000);
  let sent = false;
  if (col === 'Y') { p.yellow++; if (p.yellow >= 2) sent = true; }
  else sent = true;
  if (sent) {
    p.off = true; p.state = 'leaving';
    if (ball.owner === p) ball.owner = null;
    G.sentOff.push({ p, t: G.clock, half: G.half, two: col === 'Y' });
    msg(`<span style="color:#ff6b6b">${T('off')}</span>: ${pName(p)}${col === 'Y' ? T('two2') : ''}`, 3.2);
    // GKが退場したら代わりを立てる
    if (p.role === 'GK') { const rep = active(p.team).filter(x => x.role !== 'GK').sort((a, b) => a.slot - b.slot)[0]; if (rep) { rep.role = 'GK'; rep.slot = 0; } }
    if (active(p.team).length === 0) { setTimeout(() => endMatch(), 2500); }
  } else msg(`${T('yel')}: ${pName(p)}`, 2.6);
  CR('card', just);
  G.unseen = (G.unseen || []).filter(u => u.p !== p);
  if (!just) missJudge('missCard');
  const ang = just ? 4 : 22;
  p.team.anger += ang; G.crowdAnger += just ? 2 : 14;
  if (!just) for (const m of nearest(active(p.team), p.pos, 3)) startProtest(m, 3.5);
  else if (Math.random() < 0.5) startProtest(p, 1.5);
  // 乱闘
  if (sent && !just && p.team.anger > 60 && Math.random() < 0.5) startBrawl(p.pos);
  save();
}
function startBrawl(at) {
  const ps = nearest(allActive().filter(x => x.role !== 'GK' && (x.state === 'play' || x.state === 'protest')), at, 7);
  if (ps.length < 4) return;
  G.brawl = { t: 9, ps, at: at.clone(), refT: 1.5 };
  for (const p of ps) { p.state = 'brawl'; p.stT = 9; }
  for (const m of G.mgrs) if (!m.off && m.state !== 'leaving' && m.state !== 'gone' && Math.random() < 0.7) { m.state = 'brawl'; m.home = m.home || m.pos.clone(); }
  msg(`<span style="color:#ff6b6b">${T('brawl')}</span> ${T('brawlSub')}`, 3);
  G.crowdAnger += 10; G.excite = 1;
}

// ================= 判定パネル =================
let panelOpen = null;
function openPanel(title, desc, choices) {
  panelOpen = true;
  $('dT').innerHTML = title; $('dP').innerHTML = desc || '';
  const g = $('dG'); g.innerHTML = '';
  for (const c of choices) {
    const b = document.createElement('button'); b.className = 'ch ' + (c.cls || '');
    b.innerHTML = c.label + (c.sub ? `<small>${c.sub}</small>` : '');
    b.onclick = () => { closePanel(); c.fn(); };
    g.appendChild(b);
  }
  $('dec').hidden = false;
}
function closePanel() { $('dec').hidden = true; panelOpen = null; }
function openWhistlePanel() {
  const [A, B] = G.teams;
  const lf = G.lastFoul && performance.now() - G.lastFoul.real < 6000 ? G.lastFoul : null;
  const lfS = lf && lf.sev !== 'dive' ? lf : null;
  const ch = [];
  const add = (lab, sub, cls, fn) => ch.push({ label: lab, sub, cls, fn });
  for (const t of [A, B]) {
    const sug = lfS && lfS.team === t;
    add(`${T('fk')} ${tName(t)}`, sug && !lfS.pk ? T('fromFoul') : T('fromBall'), sug && !lfS.pk ? 'ok' : '', () => { if (!(lfS && lfS.team === t)) missJudge('missFK'); setRestart('fk', t, sug ? lfS.spot : ball.pos); });
  }
  for (const t of [A, B]) {
    const sug = lfS && lfS.team === t && lfS.pk;
    add(`${T('pk')} ${tName(t)}`, sug ? T('boxFoul') : '', sug ? 'ok' : '', () => { if (!sug) missJudge('missPK'); setRestart('pk', t); });
  }
  add(T('drop'), T('dropSub'), 'full', () => setRestart('drop', ball.last && ball.last !== 'ref' ? ball.last.team : A, ball.pos.clone()));
  for (const p of G.players.filter(x => x.needSub && !x.gone && !x.off)) add(T('subOk'), `${p.team.s} #${p.num} ${NM(p.name)}${T('injured')}`, 'full', () => { doSub(p); setRestart('drop', p.team, ball.pos.clone()); });
  const left = HALF_LEN - G.clock;
  add(G.half === 1 ? T('endH1') : T('endH2'), left > 0 ? T('left', Math.ceil(left / 60)) : T('timeUp'), 'full ' + (left > 0 ? 'warn' : 'ok'), () => endHalf());
  add(T('close'), T('closeSub'), 'full', () => { hint(T('hintPanel')); });
  let desc = T('stopped');
  if (lf && lf.sev === 'dive') desc = T('lastFall', pName(lf.on));
  else if (lf) desc = T('lastFoul', pName(lf.by), pName(lf.on)) + (lf.sev === 'red' ? `<br><b style="color:#ff6b6b">${T('sevR')}</b>` : lf.sev === 'yellow' ? `<br><b style="color:#ffd21f">${T('sevY')}</b>` : '');
  openPanel(T('pi'), desc, ch);
}
function openOutPanel() {
  const O = G.outInfo, [A, B] = G.teams;
  const lbl = { throw: T('throw'), corner: T('corner'), goalkick: T('goalkick') };
  const ch = [];
  const types = O.kind === 'touch' ? ['throw'] : ['corner', 'goalkick'];
  for (const ty of types) for (const t of [A, B]) {
    if (ty === 'corner' && t === teamOfGoal(O.s)) continue;
    if (ty === 'goalkick' && t !== teamOfGoal(O.s)) continue;
    const ok = O.correct.type === ty && O.correct.team === t;
    ch.push({ label: `${lbl[ty]} ${tName(t)}`, sub: ok ? T('correct') : '', cls: ok ? 'ok' : '', fn: () => decideOut(ty, t) });
  }
  if (O.kind === 'touch') {} else {}
  ch.push({ label: T('makeGoal'), sub: T('notIn'), cls: 'full warn', fn: () => { G.outInfo = null; setPhase('live'); onGoal(O.s); } });
  openPanel(T('outT'), T('outP'), ch);
}
function decideOut(ty, t) {
  const O = G.outInfo; G.outInfo = null;
  if (!(O.correct.type === ty && O.correct.team === t)) { O.correct.team.anger += 12; G.crowdAnger += 8; for (const p of nearest(active(O.correct.team), ref.pos, 2)) startProtest(p, 2.5); }
  let spot = O.spot;
  if (ty !== O.correct.type) {
    if (ty === 'corner') spot = V3(Math.sign(ball.pos.x || 1) * (HW - 0.5), BR, O.s * (HL - 0.5));
    else spot = V3(0, BR, O.s * (HL - 3));
  }
  setRestart(ty, t, spot);
}
function doSub(p) {
  p.state = 'leaving'; p.off = true; p.subOut = true;
  const num = 12 + G.subs.length; G.subs.push(num);
  const np = makePlayer(p.team, p.slot, num);
  np.role = p.role; np.yellow = 0;
  np.pos.set(-(HW + 1.5), 0, p.team.dir * -6); np.face = Math.PI / 2;
  p.team.players.push(np); G.players.push(np);
  msg(T('subMsg', p.team.s, p.num, NM(p.name), num, NM(np.name)), 3);
}
function endHalf() {
  sWhistle(true);
  if (G.half === 1) {
    setPhase('halftime'); G.paused = true;
    $('hS').textContent = `${G.teams[0].score} - ${G.teams[1].score}`;
    $('hVs').innerHTML = vsHTML();
    $('half').hidden = false;
  } else endMatch();
}
function startSecondHalf() {
  $('half').hidden = true;
  G.half = 2; G.clock = 0; G.added = null; G.addShown = false; G.koDone = false; $('bA').hidden = true;
  for (const t of G.teams) { t.dir *= -1; t.anger *= 0.5; }
  G.crowdAnger *= 0.6;
  for (const p of G.players) { if (p.state === 'down') { p.state = 'play'; } p.injured = p.needSub ? 1 : 0; }
  scheduleRough();
  placeForKickoff(); setRestart('kickoff', G.teams[1 - G.kickoffTeam]);
  G.paused = false; save();
}
function endMatch() {
  if (G.phase === 'over') return;
  setPhase('over'); G.paused = true;
  sWhistle(true); setTimeout(() => sWhistle(true), 400);
  try { localStorage.removeItem('yaocho_save'); } catch (e) { }
  const [A, B] = G.teams;
  $('rVs').innerHTML = vsHTML();
  $('rS').textContent = `${A.score} - ${B.score}`;
  const n = G.sentOff.length;
  $('rN').textContent = n ? T('offN', n) : T('noOff');
  $('rOff').innerHTML = n ? G.sentOff.map(o => `<div><span class="rc"></span>${pName(o.p)}<span style="color:#9aa">（${o.half === 1 ? T('first') : T('second')} ${fmt(o.t)}${o.two ? T('two') : ''}）</span></div>`).join('') : `<div style="color:#9aa">${T('noneOff')}</div>`;
  $('rOff').hidden = false;
  $('result').hidden = false;
  try { gtag('event', 'result_view', { game: 'yaocho' }); } catch (e) { }
}
function teamNames() {
  G.teams.forEach((t, k) => { const i = G.ti[k], L = TEAM_L[LANG.v]; if (L) { t.n = L[i][0]; t.s = L[i][1]; } else { t.n = TEAMS[i].n; t.s = TEAMS[i].s; } });
}
function applyLang() {
  document.documentElement.lang = LANG.v === 'zh' ? 'zh-Hant' : LANG.v;
  const set = (sel, k) => { const e = document.querySelector(sel); if (e) e.innerHTML = T(k); };
  set('#title .lead', 'lead'); set('#go', 'go'); set('#cont', 'cont'); set('#title .how', 'how');
  for (const k of ['bW', 'bS', 'bY', 'bR', 'bV', 'bM', 'bA']) set('#' + k, k);
  set('#addp h2', 'addT'); set('#addp p', 'addP'); set('#aOk', 'aOk'); set('#aNo', 'aNo');
  set('#half h2', 'halfT'); set('#half p', 'halfP'); set('#hGo', 'hGo');
  set('#pause h2', 'pauseT'); set('#pRe', 'pRe'); set('#pEnd', 'pEnd');
  set('#result h2', 'resT'); set('#rX', 'rX'); set('#rAg', 'rAg');
  if (!$('load').hidden && !/:|：/.test($('load').textContent)) set('#load', 'load');
  document.querySelectorAll('#lang button').forEach(b => b.classList.toggle('on', b.dataset.l === LANG.v));
  if (G.teams.length) { teamNames(); $('nA').textContent = G.teams[0].s; $('nB').textContent = G.teams[1].s; $('tVs').innerHTML = vsHTML(); sbLast = ''; drawHUD(); }
}
{
  const box = document.createElement('div'); box.id = 'lang'; box.className = 'langs';
  for (const [k, name] of LANGS) { const b = document.createElement('button'); b.dataset.l = k; b.textContent = name; b.onclick = () => { LANG.v = k; try { localStorage.setItem('yaocho_lang', k); } catch (e) { } applyLang(); }; box.appendChild(b); }
  document.querySelector('#title .box').appendChild(box);
}
function vsHTML() { const [A, B] = G.teams; return `<span><span class="sw" style="background:${A.kit.shirt}"></span>${A.n}</span><span style="opacity:.6">${T('vs')}</span><span><span class="sw" style="background:${B.kit.shirt}"></span>${B.n}</span>`; }

// ================= 審判の操作 =================
function onWhistle() {
  audioInit();
  if (G.paused || panelOpen) return;
  G.whistleCount++;
  G.unseen = [];
  if (G.rush && !G.rush.leaving) { sWhistle(); G.rush.leaving = true; G.miss = 0; missHUD(); calmAll(); msg(T('rushBack'), 2.6); hint(T('rushHint2')); return; }
  { const rough = G.brawl || G.players.some(p => ['brawl', 'retal', 'attackRef'].includes(p.state)); calmAll(); if (rough) { msg(T('calm'), 2); if (G.phase === 'live') { whistleStop(); setPhase('dead'); openWhistlePanel(); } else sWhistle(); return; } }
  if (G.phase === 'live') { whistleStop(); setPhase('dead'); openWhistlePanel(); }
  else if (G.phase === 'dead') { sWhistle(); openWhistlePanel(); }
  else if (G.phase === 'goal') { sWhistle(); openPanel(T('goalJ'), T('goalQ'), [{ label: T('accept'), cls: 'ok', fn: confirmGoal }, { label: T('cancel'), sub: T('noReason'), cls: 'warn', fn: cancelGoal }]); }
  else if (G.phase === 'restart') {
    const R = G.restart;
    if (R.type === 'pk' && G.pk) {
      if (G.pk.state === 'ready') { sWhistle(); executeRestart(); }
      else if (G.pk.state === 'runup') { sWhistle(); G.pk.state = 'setup'; G.pk.retakes++; R.taker.state = 'protest'; R.taker.stT = 1.5; msg(T('pkRe'), 1.8); R.team.anger += 6; }
      else { sWhistle(); openWhistlePanel(); }
      return;
    }
    if (R.ready || (R.taker && R.taker.pos.distanceTo(R.spot) < 3 && R.t > 0.8)) { sWhistle(); R.ready = true; executeRestart(); }
    else msg(T('notReady'), 1.2);
  } else if (G.phase === 'pkshot') { whistleStop(); setPhase('dead'); openWhistlePanel(); }
  else if (G.phase === 'out') { sWhistle(); openOutPanel(); }
}
function refNearBall(r = 1.2) { return Math.hypot(ball.pos.x - ref.pos.x, ball.pos.z - ref.pos.z) < r && ball.pos.y < 1.6; }
function refKick(power) {
  if (ball.held) { refThrow(); return; }
  if (!refNearBall(1.7)) { msg(T('far'), 1); return; }
  const was = ball.owner; ball.owner = null;
  const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw);
  tmpV.set(fx, 0, fz);
  const sp = lerp(13, 34, power), lift = clamp(1 + (ref.pitch + 0.1) * 14 + power * 3, 0.3, 14);
  kickBall('ref', tmpV, sp, lift);
  ref.kickAnim = 0.35;
  if (was) { was.team.anger += 8; startProtest(was, 1.5); }
  if (G.phase === 'restart' && G.restart && G.restart.type === 'pk') { G.restart.team.anger += 10; startProtest(G.restart.taker, 3); msg(T('pkKick'), 2); }
}
const SLIDE_R = 1.4;
function refSlide(mx, mz) {
  if (ref.slideT > 0 || ref.slideRec > 0 || G.phase === 'title' || G.phase === 'over') return;
  const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw);
  let wx = fx * mz - fz * mx, wz = fz * mz + fx * mx; const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l;
  const sp = Math.max(12.5, Math.hypot(ref.vel.x, ref.vel.z) + 4);
  ref.vel.set(wx * sp, 0, wz * sp); ref.slideT = 0.75; ref.slideDir = Math.atan2(wx, wz); ref.slideHit = new Set();
  sSlide();
}
function updateSlide(dt) {
  if (ref.slideT > 0) {
    ref.slideT -= dt;
    ref.vel.multiplyScalar(Math.pow(0.3, dt));
    if (Math.random() < 0.8) dust(ref.pos.x + rnd(-0.2, 0.2), ref.pos.z + rnd(-0.2, 0.2));
    for (const p of allActive()) {
      if (ref.slideHit.has(p) || p.state === 'down') continue;
      if (Math.hypot(p.pos.x - ref.pos.x, p.pos.z - ref.pos.z) < SLIDE_R) {
        ref.slideHit.add(p);
        if (ball.owner === p) { ball.owner = null; ball.vel.set(ref.vel.x * 0.6 + rnd(-2, 2), 1.2, ref.vel.z * 0.6 + rnd(-2, 2)); ball.last = 'ref'; ball.lastKick = 'ref'; ball.kickCd = 0.4; }
        p.state = 'down'; p.fallDir = Math.random() < .5 ? 1 : -1; p.stT = rnd(2.2, 3.5); p.vel.set(ref.vel.x * 0.4, 0, ref.vel.z * 0.4);
        p.team.anger += 15; G.crowdAnger += 10; G.excite = 1;
        for (const m of nearest(active(p.team).filter(x => x !== p), p.pos, 2)) startProtest(m, 3);
        msg(`<span style="color:#ff8a8a">${T('refSlide', pName(p))}</span>`, 2.2); CR('foul');
        if (ref.hurtT <= 0) { ref.hurtT = 0; }
      }
    }
    if (ref.slideT <= 0) ref.slideRec = 0.7;
  } else if (ref.slideRec > 0) { ref.slideRec -= dt; ref.vel.multiplyScalar(Math.pow(0.02, dt)); }
}
function refTouchKick(rs) {
  // 走る向き（動いていなければ見ている向き）に、速さに応じて蹴る
  let dx = ref.vel.x, dz = ref.vel.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw);
  dx = dx * 0.35 + fx * 0.65; dz = dz * 0.35 + fz * 0.65; const l2 = Math.hypot(dx, dz) || 1;
  tmpV.set(dx / l2, 0, dz / l2);
  const sp = clamp(4 + rs * 2.6, 6, 30);
  const lift = clamp(0.3 + rs * 0.18 + (ref.pitch + 0.12) * 9, 0.2, 12);
  kickBall('ref', tmpV, sp, lift);
  ref.touchCd = 0.35; ref.kickAnim = 0.3;
  if (G.phase === 'restart' || G.phase === 'dead') {
    const R = G.restart;
    if (R && R.type === 'pk') { R.team.anger += 15; G.crowdAnger += 10; startProtest(R.taker, 2); msg(T('pkKick'), 2.4); }
    else if (R && R.type === 'kickoff') { msg(T('refKO'), 2); G.koDone = true; if (G.clock < 1) G.clock = 0; }
    else msg(T('refRe'), 2);
    if (R && R.team) { R.team.anger += 6; }
    G.restart = null; G.pk = null; hint('');
    for (const p of allActive()) p.freeze = 0;
    setPhase('live');
    G.excite = Math.min(1, G.excite + 0.4);
  }
}
function refHold() {
  if (ball.held) { refThrow(); return; }
  if (!refNearBall(1.4)) { msg(T('far'), 1); return; }
  const was = ball.owner; ball.owner = null; ball.held = true; ball.last = 'ref';
  if (was) { was.team.anger += 8; startProtest(was, 2); }
  if (G.phase === 'live') { G.crowdAnger += 6; }
  msg(T('hold'), 1.6);
}
function refThrow() {
  ball.held = false;
  tmpV.set(Math.sin(ref.yaw), 0, Math.cos(ref.yaw));
  kickBall('ref', tmpV, 13, 4 + ref.pitch * 8);
  ball.pos.y = 1.4;
}
function cardTarget() {
  const fw = V3(); cam.getWorldDirection(fw);
  let best = null, bd = 0.965;
  for (const p of [...allActive(), ...G.mgrs.filter(m => !m.off)]) {
    tmpV.copy(p.pos); tmpV.y = 1.3; tmpV.sub(cam.position);
    const d = tmpV.length(); if (d > 45 || d < 0.5) continue;
    const dot = tmpV.divideScalar(d).dot(fw) + (d < 6 ? 0.02 : 0);
    if (dot > bd) { bd = dot; best = p; }
  }
  return best;
}

// ================= 入力 =================
const input = { mx: 0, mz: 0, keys: {} };
let curTarget = null;
{
  const stick = $('stick'), knob = $('knob');
  let sid = null, sx = 0, sy = 0;
  let fT = 0, fMax = 0, fX = 0, fZ = 0, fS = [], fLast = 0;
  const stStart = (id, x, y) => { fT = performance.now(); fMax = 0; sid = id; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; stMove(x, y); };
  const stMove = (x, y) => { let dx = x - sx, dy = y - sy; const d = Math.hypot(dx, dy), m = 50; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.mx = dx / m; input.mz = -dy / m; const mg = Math.hypot(input.mx, input.mz); if (mg > fMax) { fMax = mg; fX = input.mx; fZ = input.mz; }
    const now = performance.now(); fS.push([now, x, y]); while (fS.length && now - fS[0][0] > 90) fS.shift();
    if (fS.length > 1 && mg > 0.8) { const a = fS[fS.length - 2], dd = Math.hypot(x - a[1], y - a[2]), sp = dd / Math.max(8, now - a[0]) * 1000; if (dd > 15 && sp > 650 && now - fLast > 900 && !G.paused && !panelOpen) { fLast = now; fS.length = 0; refSlide(input.mx, input.mz); } } };
  const stEnd = () => { const quick = performance.now() - fT < 230 && fMax > 0.85 && performance.now() - fLast > 400; fS = []; sid = null; knob.style.transform = ''; input.mx = input.mz = 0; if (quick && !G.paused && !panelOpen) refSlide(fX, fZ); };
  if ('ontouchstart' in window) {
    stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; stStart(t.identifier, t.clientX, t.clientY); }, { passive: false });
    addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === sid) stMove(t.clientX, t.clientY); }, { passive: false });
    const te = e => { for (const t of e.changedTouches) if (t.identifier === sid) stEnd(); };
    addEventListener('touchend', te); addEventListener('touchcancel', te);
  } else {
    stick.addEventListener('pointerdown', e => stStart(e.pointerId, e.clientX, e.clientY));
    addEventListener('pointermove', e => { if (e.pointerId === sid) stMove(e.clientX, e.clientY); });
    addEventListener('pointerup', e => { if (e.pointerId === sid) stEnd(); });
  }
  // 視点：指の番号で追いかけ、指が離れたら必ずリセットする
  const look = $('look'); let lid = null, lx = 0, ly = 0;
  const lookStart = (id, x, y) => { lid = id; lx = x; ly = y; };
  const lookMove = (x, y) => { ref.yaw -= (x - lx) * 0.0058; ref.pitch = clamp(ref.pitch - (y - ly) * 0.0045, -1.1, 0.9); lx = x; ly = y; };
  if ('ontouchstart' in window) {
    look.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; lookStart(t.identifier, t.clientX, t.clientY); }, { passive: false });
    addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lid) { lookMove(t.clientX, t.clientY); } }, { passive: false });
    const te = e => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; };
    addEventListener('touchend', te); addEventListener('touchcancel', te);
  } else {
    look.addEventListener('pointerdown', e => { lookStart(e.pointerId, e.clientX, e.clientY); });
    addEventListener('pointermove', e => { if (e.pointerId === lid) lookMove(e.clientX, e.clientY); });
    addEventListener('pointerup', e => { if (e.pointerId === lid) lid = null; });
  }
  // PC：画面ドラッグで視点
  let md = false; canvas.addEventListener('mousedown', e => { if (IS_TOUCH) return; md = true; lx = e.clientX; ly = e.clientY; });
  addEventListener('mouseup', () => md = false);
  addEventListener('mousemove', e => { if (!md || IS_TOUCH) return; ref.yaw -= (e.clientX - lx) * 0.004; ref.pitch = clamp(ref.pitch - (e.clientY - ly) * 0.003, -1.1, 0.9); lx = e.clientX; ly = e.clientY; });
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); fn(); });
  tap('bW', onWhistle);
  tap('bS', () => { if (G.paused || panelOpen) return; let mx = input.mx, mz = input.mz; if (input.keys.KeyW || input.keys.ArrowUp) mz = 1; if (input.keys.KeyS || input.keys.ArrowDown) mz = -1; if (input.keys.KeyA || input.keys.ArrowLeft) mx = -1; if (input.keys.KeyD || input.keys.ArrowRight) mx = 1; if (Math.hypot(mx, mz) < 0.2) { mx = 0; mz = 1; } refSlide(mx, mz); });
  tap('bY', () => { if (!G.paused && !panelOpen) { const t = curTarget || cardTarget(); t ? giveCard(t, 'Y') : msg(T('aimTip'), 1.6); } });
  tap('bR', () => { if (!G.paused && !panelOpen) { const t = curTarget || cardTarget(); t ? giveCard(t, 'R') : msg(T('aimTip'), 1.6); } });
  tap('bV', () => { G.view = G.view === 1 ? 3 : 1; });
  tap('bM', () => { if (G.phase === 'over') return; G.paused = true; $('pause').hidden = false; });
  tap('bA', () => openAdd());
  addEventListener('keydown', e => {
    input.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyF') onWhistle();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !G.paused && !panelOpen) { let mx = 0, mz = 0; if (input.keys.KeyW || input.keys.ArrowUp) mz = 1; if (input.keys.KeyS || input.keys.ArrowDown) mz = -1; if (input.keys.KeyA || input.keys.ArrowLeft) mx = -1; if (input.keys.KeyD || input.keys.ArrowRight) mx = 1; if (!mx && !mz) mz = 1; refSlide(mx, mz); }
    if (e.code === 'KeyY') $('bY').dispatchEvent(new PointerEvent('pointerdown'));
    if (e.code === 'KeyR') $('bR').dispatchEvent(new PointerEvent('pointerdown'));
    if (e.code === 'KeyV') G.view = G.view === 1 ? 3 : 1;
    if (e.code === 'KeyT') openAdd();
  });
  addEventListener('keyup', e => { input.keys[e.code] = false; });
  document.addEventListener('visibilitychange', () => { input.mx = input.mz = 0; if (document.hidden && !G.paused && G.phase !== 'title' && G.phase !== 'over') { G.paused = true; $('pause').hidden = false; } });
}
let addN = 3;
function openAdd() {
  if (G.paused || G.phase === 'title') return;
  addN = G.added ?? 3; $('aN').textContent = '+' + addN; $('addp').hidden = false; G.pausedAdd = true;
}
$('aM').onclick = () => { addN = Math.max(0, addN - 1); $('aN').textContent = '+' + addN; };
$('aP').onclick = () => { addN = Math.min(99, addN + 1); $('aN').textContent = '+' + addN; };
let boardT = 0;
$('aOk').onclick = () => { $('addp').hidden = true; G.added = addN; G.addShown = true; boardT = 10; msg(T('addMsg', `<b style="color:#7dff9a">${addN}</b>`), 3); if (addN >= 8) { G.crowdAnger += 8; } };
$('aNo').onclick = () => { $('addp').hidden = true; };
$('pRe').onclick = () => { $('pause').hidden = true; G.paused = false; };
$('pEnd').onclick = () => { $('pause').hidden = true; save(); location.reload(); };
$('hGo').onclick = () => { audioInit(); startSecondHalf(); };
$('rAg').onclick = () => { location.reload(); };
let QUOTE = {};
fetch('https://ft-red-default-rtdb.asia-southeast1.firebasedatabase.app/xquote/g/yaocho.json').then(r => r.json()).then(d => { if (d && typeof d === 'object') QUOTE = d; }).catch(() => { });
function quoteURL() { const u = QUOTE.ja || ''; return /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}$/.test(u) ? u : ''; }
$('rX').onclick = () => {
  const [A, B] = G.teams; const n = G.sentOff.length;
  const t = T('share', A.n, A.score, B.score, B.n, n ? T('offN', n) : T('noOff'), 'https://nasubi-no-oniwa.com/yaocho/');
  try { gtag('event', 'x_share', { game: 'yaocho' }); } catch (e) { }
  const q = quoteURL();
  const u = 'https://x.com/intent/post?text=' + encodeURIComponent(t) + (q ? '&url=' + encodeURIComponent(q) : ''); const w = window.open(u, '_blank'); if (!w) location.href = u;
};

// ================= 第4審判のボード =================
const board = (() => {
  const body = { pos: V3(-(HW + 1.2), 0, 0) };
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.05), new THREE.MeshBasicMaterial({ map: t }));
  m.visible = false; scene.add(m);
  return { c, t, m, body, draw(n) { const g = c.getContext('2d'); g.fillStyle = '#050505'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#7dff9a'; g.font = '900 64px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+' + n, 64, 52); t.needsUpdate = true; } };
})();

// ================= 試合の準備 =================
function newMatch(saved) {
  clearRush(); G.miss = 0; G.unseen = []; missHUD();
  let ia, ib;
  if (saved) { ia = saved.ta; ib = saved.tb; }
  else { ia = (Math.random() * TEAMS.length) | 0; do { ib = (Math.random() * TEAMS.length) | 0; } while (ib === ia || colorClash(TEAMS[ia], TEAMS[ib])); }
  const strong = Math.random() < 0.5 ? 0 : 1;
  const strs = saved ? saved.str : [strong === 0 ? rnd(0.85, 1) : rnd(0.42, 0.62), strong === 1 ? rnd(0.85, 1) : rnd(0.42, 0.62)];
  G.teams = [makeTeam(TEAMS[ia], 0, strs[0]), makeTeam(TEAMS[ib], 1, strs[1])];
  G.ti = [ia, ib];
  teamNames();
  const used = new Set();
  for (const t of G.teams) {
    for (let s = 0; s < FORM.length; s++) {
      let nm; do { nm = pick(SURN); } while (used.has(nm)); used.add(nm);
      const num = [1, 2, 4, 6, 8, 10, 9][s];
      const p = makePlayer(t, s, num, nm);
      t.players.push(p); G.players.push(p);
    }
    const mg = { team: t, role: 'MGR', name: pick(SURN), pos: V3(-(HW + 2.5), 0, -t.dir * 8 + (t.i ? -2 : 2)), off: false, state: 'stand', yellow: 0, face: Math.PI / 2, vel: V3() };
    mg.body = buildBody({ shirt: '#2a2a2a', shorts: '#2a2a2a', socks: '#111', skin: pick(SKINS), hair: pick(HAIRS) }, null);
    G.mgrs.push(mg);
  }
  if (saved) {
    G.teams[0].score = saved.score[0]; G.teams[1].score = saved.score[1];
    G.half = saved.half; G.clock = saved.clock; G.added = saved.added;
    if (G.half === 2) for (const t of G.teams) t.dir *= -1;
    saved.pl.forEach((s, i) => { const p = G.players[i]; if (!p) return; p.yellow = s.y; if (s.off) { p.off = true; p.gone = true; p.body.root.visible = false; G.sentOff.push({ p, t: s.t, half: s.h, two: s.two }); } });
    G.kickoffTeam = saved.ko || 0;
  }
  scheduleRough();
  $('cA').style.background = G.teams[0].kit.shirt; $('cB').style.background = G.teams[1].kit.shirt;
  $('nA').textContent = G.teams[0].s; $('nB').textContent = G.teams[1].s;
  $('tVs').innerHTML = vsHTML();
  // 審判
  ref.body = buildBody({ shirt: '#151515', shorts: '#151515', socks: '#151515', skin: SKINS[1], hair: HAIRS[0] }, null);
  // 第4審判
  board.ref = buildBody({ shirt: '#151515', shorts: '#151515', socks: '#151515' }, null);
  board.ref.root.position.copy(board.body.pos); board.ref.root.rotation.y = Math.PI / 2;
}
function colorClash(a, b) { const ca = new THREE.Color(a.shirt), cb = new THREE.Color(b.shirt); return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b) < 0.7; }
function placeForKickoff() {
  for (const p of allActive()) {
    homeSpot(p, tmpV); const za = clamp(attackZ(p.team, tmpV.z), -27, -2); tmpV.z = za * p.team.dir;
    p.pos.copy(tmpV); p.vel.set(0, 0, 0); p.face = p.team.dir > 0 ? 0 : Math.PI; p.state = 'play'; p.act = null;
  }
  ball.pos.set(0, BR, 0); ball.vel.set(0, 0, 0); ball.owner = null; ball.held = false;
  ref.pos.set(-4, 0, -3 * G.teams[0].dir); ref.yaw = G.teams[0].dir > 0 ? 0.5 : Math.PI + 0.5;
}
function save() {
  if (G.phase === 'over' || !G.teams.length) return;
  try {
    localStorage.setItem('yaocho_save', JSON.stringify({
      ta: G.ti[0], tb: G.ti[1], str: G.teams.map(t => t.str), score: G.teams.map(t => t.score), half: G.half, clock: G.clock, added: G.added, ko: G.kickoffTeam,
      pl: G.players.slice(0, 14).map(p => ({ y: p.yellow, off: p.off, t: (G.sentOff.find(o => o.p === p) || {}).t, h: (G.sentOff.find(o => o.p === p) || {}).half, two: (G.sentOff.find(o => o.p === p) || {}).two })),
    }));
  } catch (e) { }
}

// ================= 選手の更新 =================
function updatePlayers(dt) {
  const live = G.phase === 'live' || G.phase === 'pkshot';
  const [A, B] = G.teams;
  // ボールを追う人を決める
  const chasers = new Set();
  if (live && !ball.held) {
    for (const t of [A, B]) {
      if (ball.owner && ball.owner.team === t) continue;
      const cand = active(t).filter(p => canMove(p) && (p.role !== 'GK' || inBox(t, ball.pos)));
      const s = cand.sort((a, b) => a.pos.distanceToSquared(ball.pos) - b.pos.distanceToSquared(ball.pos));
      const it = ball.intended && ball.intended.team === t && !ball.intended.off && canMove(ball.intended) ? ball.intended : null;
      if (it) chasers.add(it); else if (s[0]) chasers.add(s[0]);
      if (s[1] && ball.owner && s[1].pos.distanceTo(ball.pos) < 9) chasers.add(s[1]);
    }
  }
  const heldChasers = ball.held ? new Set(nearest(allActive().filter(p => canMove(p) && p.role !== 'GK'), ref.pos, 3)) : null;
  for (const p of G.players) {
    if (p.gone) continue;
    if (p.freeze > 0) p.freeze -= dt;
    p.stT -= dt; p.actT -= dt; p.appeal -= dt; p.tackCd -= dt;
    if (p.actT <= 0) { if (p.act === 'drop' && p.dropLand) { p.dropLand = false; if (p.state === 'play' || p.state === 'brawl') { p.state = 'down'; p.stT = rnd(0.9, 1.4); p.fallBack = true; p.injured = 0; } } p.act = null; }
    const tgt = tmpV3; let run = 0.55, hasTgt = true;
    // 状態
    if (p.state === 'leaving') {
      tgt.set(-(HW + 4), 0, 0); run = 0.32;
      if (p.pos.distanceTo(tgt) < 1) { p.gone = true; p.body.root.visible = false; continue; }
    } else if (p.state === 'down') {
      hasTgt = false; p.vel.multiplyScalar(Math.pow(0.02, dt));
      if (p.stT <= 0) { p.state = 'play'; if (p.injured && !p.needSub) p.injured = 0; }
      if (p.stT > 0 && p.injured && live && Math.random() < dt * 0.15) { p.team.anger += 3; G.crowdAnger += 2; }
    } else if (p.state === 'stumble') {
      hasTgt = false; p.vel.multiplyScalar(Math.pow(0.1, dt)); if (p.stT <= 0) p.state = 'play';
    } else if (p.state === 'brawl') {
      const b = G.brawl; if (!b || p.stT <= 0) { p.state = 'play'; hasTgt = false; }
      else { tgt.copy(b.at); tgt.x += Math.sin(p.ph * 3) * 1.2; tgt.z += Math.cos(p.ph * 2.3) * 1.2; run = 0.4; p.act = 'push'; p.actT = 0.3; }
    } else if (p.state === 'retal') {
      const tg = p.retalT;
      if (!tg || tg.off || tg.gone || p.stT <= 0) { p.state = 'play'; p.retalT = null; hasTgt = false; }
      else {
        tgt.copy(tg.pos); run = 1;
        if (p.pos.distanceTo(tg.pos) < 1.3 && tg.state !== 'down') {
          tmpV.subVectors(tg.pos, p.pos).setY(0).normalize();
          const drop = Math.random() < 0.5; p.act = drop ? 'drop' : 'punch'; p.actT = drop ? 0.8 : 0.6; if (drop) { p.dropLand = true; p.vel.copy(tmpV).multiplyScalar(6); }
          if (ball.owner === tg) ball.owner = null;
          foulFall(tg, 'red', { push: drop ? 3.4 : 1.2, dir: tmpV.clone(), back: Math.random() < 0.5 });
          addFoul(p, tg, 'red'); msg(`<span style="color:#ff8a8a">${T('revenge', pName(p))}</span>`, 2.2);
          p.state = 'play'; p.retalT = null;
        }
      }
    } else if (p.state === 'attackRef') {
      if (p.stT <= 0) { p.state = 'play'; hasTgt = false; }
      else {
        tgt.copy(ref.pos); run = 1;
        if (p.pos.distanceTo(ref.pos) < 1.4) {
          tmpV.subVectors(ref.pos, p.pos).setY(0).normalize();
          p.act = 'drop'; p.actT = 0.8; p.dropLand = true; p.vel.copy(tmpV).multiplyScalar(6);
          ref.vel.addScaledVector(tmpV, 6.5); ref.downT = 1.6; ref.hurtT = 0;
          $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 500); flash(0.25);
          G.offenses.push({ p, sev: 'red', real: performance.now() });
          msg(`<span style="color:#ff6b6b">${T('refDrop', pName(p))}</span>`, 2.6); CR('foul'); G.crowdAnger += 8; G.excite = 1;
          p.state = 'play';
        }
      }
    } else if (p.state === 'protest') {
      tgt.copy(ref.pos); tmpV.subVectors(p.pos, ref.pos).setY(0); const d = tmpV.length() || 1;
      tgt.addScaledVector(tmpV.divideScalar(d), 1.6); run = 0.7;
      if (p.stT <= 0) p.state = 'play';
      // 押す
      if (d < 2.2 && p.team.anger > 75 && Math.random() < dt * 0.25 && !p.pushed) {
        p.pushed = true; p.act = 'push'; p.actT = 0.6;
        tmpV.subVectors(ref.pos, p.pos).setY(0).normalize(); ref.vel.addScaledVector(tmpV, 7); ref.hurtT = 0.8;
        $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 400);
        G.offenses.push({ p, sev: 'red', real: performance.now() });
        msg(`<span style="color:#ff6b6b">${T('pushed', pName(p))}</span>`, 2.6); p.team.anger -= 25;
      }
    } else if (p.freeze > 0) { hasTgt = false; p.vel.multiplyScalar(Math.pow(0.001, dt)); }
    else if (G.phase === 'restart' && G.restart) {
      restartPos(p, G.restart, tgt); run = p === G.restart.taker ? 0.6 : 0.42;
      if (G.restart.type === 'pk' && p === G.restart.taker && G.pk && G.pk.state === 'runup') {
        tgt.copy(ball.pos); run = 0.7;
        G.pk.t += dt;
        if (p.pos.distanceTo(ball.pos) < 0.75 || G.pk.t > 2.2) {
          if (p.pos.distanceTo(ball.pos) < 1.4 && ball.pos.distanceTo(G.restart.spot) < 0.5) pkShoot(p);
          else { G.pk.state = 'ready'; }
        }
      }
    } else if (G.phase === 'goal' || G.phase === 'dead' || G.phase === 'out' || G.phase === 'halftime') {
      homeSpot(p, tgt); run = 0.25;
      if (G.phase === 'goal' && p.act === 'cele') { tgt.copy(p.pos); tgt.x += Math.sin(p.ph) * 0.5; }
    } else if (live) {
      if (ball.held) {
        if (heldChasers.has(p)) { tgt.copy(ref.pos); tmpV.subVectors(p.pos, ref.pos).setY(0); const d = tmpV.length() || 1; tgt.addScaledVector(tmpV.divideScalar(d), 1.5); run = 0.9; if (d < 2.2) { p.act = 'protest'; p.actT = 0.3; } }
        else homeSpot(p, tgt);
      } else if (ball.owner === p) {
        hasTgt = false; dribble(p, dt);
      } else if (p.role === 'GK') {
        gkLogic(p, dt, tgt); run = 0.8;
      } else if (chasers.has(p)) {
        // ボールの先を読む（パスの受け手は通り道に先回り）
        const hs = Math.hypot(ball.vel.x, ball.vel.z);
        if (!ball.owner && ball.intended === p && hs > 1) {
          const ux = ball.vel.x / hs, uz = ball.vel.z / hs;
          const along = Math.max(0, (p.pos.x - ball.pos.x) * ux + (p.pos.z - ball.pos.z) * uz);
          const stop = rollDist(hs);
          const a = Math.min(along, stop);
          tgt.set(ball.pos.x + ux * a, 0, ball.pos.z + uz * a);
          if (along > stop) tgt.set(ball.pos.x + ux * stop, 0, ball.pos.z + uz * stop);
        } else {
          const tt = clamp(p.pos.distanceTo(ball.pos) / 8, 0, 1.2);
          tgt.copy(ball.pos).addScaledVector(ball.vel, tt * (ball.owner ? 0.4 : 1)); tgt.y = 0;
        }
        run = 1;
      } else {
        homeSpot(p, tgt); run = 0.6;
        if (ball.owner && ball.owner.team === p.team && p.role !== 'DF') run = 0.75;
      }
    } else { homeSpot(p, tgt); run = 0.3; }
    // 動き
    if (hasTgt && (canMove(p) || ['brawl', 'leaving', 'retal', 'attackRef'].includes(p.state)) && !(p.freeze > 0)) {
      tmpV.subVectors(tgt, p.pos).setY(0);
      const d = tmpV.length();
      const ms = maxSpeed(p) * run * (d < 3 ? clamp(d / 3, 0.15, 1) : 1);
      if (d > 0.15) tmpV.multiplyScalar(ms / d); else tmpV.set(0, 0, 0);
      // よける
      for (const o of G.players) { if (o === p || o.gone) continue; const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, dd = dx * dx + dz * dz; if (dd < 1.3 && dd > 1e-4) { const k = (1.3 - dd) * 4; tmpV.x += dx * k; tmpV.z += dz * k; } }
      { const dx = p.pos.x - ref.pos.x, dz = p.pos.z - ref.pos.z, dd = dx * dx + dz * dz; if (dd < 1.4 && dd > 1e-4) { const k = (1.4 - dd) * 5; tmpV.x += dx * k; tmpV.z += dz * k; } }
      const acc = 14 * dt;
      p.vel.x += clamp(tmpV.x - p.vel.x, -acc, acc); p.vel.z += clamp(tmpV.z - p.vel.z, -acc, acc);
    }
    p.pos.addScaledVector(p.vel, dt);
    p.pos.x = clamp(p.pos.x, -HW - 4, HW + 4); p.pos.z = clamp(p.pos.z, -HL - 2.5, HL + 2.5);
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if (p.state === 'protest' || (p.act === 'protest')) { tmpV.subVectors(ref.pos, p.pos); p.face = turn(p.face, Math.atan2(tmpV.x, tmpV.z), dt * 8); }
    else if (G.phase === 'restart' && G.restart && sp < 0.6) { tmpV.subVectors(ball.pos, p.pos); p.face = turn(p.face, Math.atan2(tmpV.x, tmpV.z), dt * 5); }
    else if (sp > 0.4 && p.state !== 'down') p.face = turn(p.face, Math.atan2(p.vel.x, p.vel.z), dt * 10);
    else if (live && p.state === 'play') { tmpV.subVectors(ball.pos, p.pos); p.face = turn(p.face, Math.atan2(tmpV.x, tmpV.z), dt * 4); }
    // ボールを取る
    if (live && !ball.owner && !ball.held && canMove(p) && p.state === 'play' && !(p.freeze > 0)) {
      const dx = ball.pos.x - p.pos.x, dz = ball.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      const reach = p.role === 'GK' && inBox(p.team, p.pos) ? 1.3 : (ball.intended === p ? 1.15 : 0.8);
      const hs = Math.hypot(ball.vel.x, ball.vel.z);
      if (d < reach && ball.pos.y < (p.role === 'GK' ? 2.3 : 1.0) && !(ball.lastKick === p && ball.kickCd > 0) && (p.role === 'GK' ? (hs < 13 || (d < 0.8 && hs < 21)) : hs < 22)) {
        if (ball.intended) { if (ball.intended.team === p.team) G.st.ok = (G.st.ok || 0) + 1; else G.st.cut = (G.st.cut || 0) + 1; }
        ball.owner = p; ball.last = p; ball.lastP = p; ball.intended = null; p.decideT = rnd(0.15, 0.45);
        if (p.role === 'GK' && inBox(p.team, p.pos)) { p.gkHold = true; p.holdT = rnd(1.2, 2.2); }
        if (G.phase === 'pkshot') setPhase('live');
      }
    }
    // タックル
    if (live && ball.owner && ball.owner.team !== p.team && p.state === 'play' && p.tackCd <= 0 && !(p.freeze > 0) && !(ball.owner.gkHold)) {
      if (p.pos.distanceTo(ball.owner.pos) < 1.35) tackle(p, ball.owner);
    }
    animate(p, dt, sp);
  }
  // 監督
  for (const m of G.mgrs) {
    if (m.state === 'brawl' || m.state === 'back') {
      const tg = m.state === 'brawl' && G.brawl ? G.brawl.at : (m.home || m.pos);
      tmpV.subVectors(tg, m.pos).setY(0); const d = tmpV.length();
      if (d > 0.6) { m.pos.addScaledVector(tmpV, Math.min(1, 6.5 * dt / d)); m.face = Math.atan2(tmpV.x, tmpV.z); }
      else if (m.state === 'back') { m.state = 'stand'; }
      if (m.state === 'brawl' && !G.brawl) m.state = 'back';
      m.act = m.state === 'brawl' && d < 2 ? 'push' : null; m.actT = 1;
      animate(m, dt, d > 0.6 ? 6.5 : 0); continue;
    }
    if (m.state === 'leaving') { m.pos.x -= dt * 2; if (m.pos.x < -(HW + 9)) { m.body.root.visible = false; m.state = 'gone'; } }
    const ang = m.team.anger > 40;
    m.face = Math.PI / 2 + (ang ? Math.sin(perf * 0.002) * 0.3 : 0);
    m.act = ang ? 'protest' : null; m.actT = 1;
    animate(m, dt, m.state === 'leaving' ? 2 : 0);
  }
}
function turn(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * clamp(k, 0, 1); }
function dribble(p, dt) {
  const t = p.team, opp = active(G.teams[1 - t.i]);
  if (p.gkHold) {
    p.vel.multiplyScalar(Math.pow(0.05, dt)); p.holdT -= dt;
    if (p.holdT <= 0) { p.gkHold = false; const m = choosePass(p, 'long'); if (m) { ball.intended = m; } if (m) passTo(p, leadPoint(m), 1.1, m.pos.distanceTo(p.pos) > 18); else passTo(p, tmpV.set(rnd(-10, 10), 0, p.pos.z + t.dir * 30), 1, true); }
    return;
  }
  const gz = t.dir * HL;
  // 前へ進む向き（相手をよける）
  tmpV.set(-p.pos.x * 0.15, 0, gz - p.pos.z).normalize();
  if (Math.abs(p.pos.x) > HW - 5) tmpV.x -= Math.sign(p.pos.x) * (Math.abs(p.pos.x) - (HW - 5)) * 0.6;
  if (Math.abs(p.pos.z) > HL - 3 && Math.abs(p.pos.x) > GWH + 3) tmpV.z -= Math.sign(p.pos.z) * 0.8;
  let near = null, nd = 99;
  for (const o of opp) { const d = o.pos.distanceTo(p.pos); if (d < nd) { nd = d; near = o; } if (d < 5) { tmpV2.subVectors(p.pos, o.pos).setY(0).normalize(); tmpV.addScaledVector(tmpV2, (5 - d) * 0.25); } }
  tmpV.normalize();
  const ms = maxSpeed(p) * 0.9;
  const acc = 10 * dt;
  p.vel.x += clamp(tmpV.x * ms - p.vel.x, -acc, acc); p.vel.z += clamp(tmpV.z * ms - p.vel.z, -acc, acc);
  p.decideT -= dt;
  if (p.decideT > 0) return;
  p.decideT = rnd(0.25, 0.5);
  const dG = Math.hypot(p.pos.x, gz - p.pos.z);
  if (dG < 22 && (Math.random() < 0.25 + (22 - dG) * 0.05)) { shoot(p); return; }
  const pressure = nd < 2.6;
  if ((pressure && Math.random() < 0.65) || Math.random() < 0.1) {
    const m = choosePass(p, pressure ? 'normal' : 'normal'); if (m) { ball.intended = m; passTo(p, m.pos.distanceTo(p.pos) > 8 ? leadPoint(m) : m.pos.clone(), 1, m.pos.distanceTo(p.pos) > 24 && Math.random() < 0.5); return; }
  }
}
function gkLogic(p, dt, tgt) {
  homeSpot(p, tgt);
  const t = p.team, gz = -t.dir * HL;
  // シュートに反応
  const vz = ball.vel.z * -t.dir;
  if (!ball.owner && vz > 6) {
    const tt = (Math.abs(gz - ball.pos.z)) / Math.max(1, Math.abs(ball.vel.z));
    if (tt < 1.4) {
      const cx = ball.pos.x + ball.vel.x * tt, cy = ball.pos.y + ball.vel.y * tt - 4.9 * tt * tt;
      tgt.set(clamp(cx, -GWH, GWH), 0, gz + t.dir * 0.4);
      const dx = cx - p.pos.x;
      if (Math.abs(cx) < GWH + 0.5 && tt < 0.6 && !p.dived) {
        p.dived = true; p.act = 'dive'; p.actT = 1.2; p.fallDir = Math.sign(dx) || 1;
        p.vel.x = clamp(dx / Math.max(tt, 0.15), -9, 9);
        const reach = 1.6 + 1.2 * t.str;
        const hsp = Math.hypot(ball.vel.x, ball.vel.z);
        const fromRef = ball.last === 'ref';
        const pSave = (fromRef ? 0.75 : 1) * clamp(0.62 + t.str * 0.3 - (hsp - 20) * 0.02 - (Math.abs(dx) > reach ? 0.35 : 0) - (cy > 2.0 ? 0.1 : 0), 0.1, 0.88);
        if (Math.random() < pSave) {
          G.pendingSave = { p, at: tt * 0.85, catch: hsp < 21 && Math.random() < 0.55 };
        }
      }
    }
  } else p.dived = false;
  if (!ball.owner && inBox(t, ball.pos) && Math.hypot(ball.vel.x, ball.vel.z) < 8) { tgt.copy(ball.pos); tgt.y = 0; }
  return tgt;
}
function pkShoot(p) {
  const def = G.teams[1 - G.restart.team.i];
  const gz = -def.dir * HL;
  G.restart = null; setPhase('pkshot');
  const side = G.pk.side, tx = side * rnd(1.2, GWH - 0.35), ty = G.pk.high ? 1.6 : 0.4;
  tmpV.set(tx - ball.pos.x, 0, gz - ball.pos.z); const d = tmpV.length(); tmpV.normalize();
  kickBall(p, tmpV, rnd(19, 24), ty * 1.6 + 0.5);
  // GK
  const gk = active(def).find(x => x.role === 'GK');
  if (gk) {
    const dive = pick([-1, 1, side]);
    gk.act = 'dive'; gk.actT = 1.4; gk.fallDir = dive; gk.dived = true;
    gk.vel.x = dive * 5;
    if (dive === side && Math.random() < 0.45 + def.str * 0.25) G.pendingSave = { p: gk, at: (d / 21) * 0.85, catch: false };
  }
  G.pk = null; hint('');
}

// ================= アニメ =================
function animate(p, dt, sp) {
  const B = p.body; if (!B) return;
  const r = B.root;
  r.position.set(p.pos.x, 0, p.pos.z);
  const amp = clamp(sp / 7, 0, 1);
  p.ph += dt * (4 + sp * 1.25);
  const s = Math.sin(p.ph), c = Math.cos(p.ph);
  let hipL = -s * 0.85 * amp, hipR = s * 0.85 * amp;
  let knL = (0.15 + Math.max(0, Math.sin(p.ph + 1.9)) * 1.25) * amp + 0.05, knR = (0.15 + Math.max(0, Math.sin(p.ph + 1.9 + Math.PI)) * 1.25) * amp + 0.05;
  let shL = s * 0.75 * amp, shR = -s * 0.75 * amp, elL = -0.35 - amp * 0.9, elR = -0.35 - amp * 0.9;
  let shZL = 0.09, shZR = -0.09, lean = 0.14 * amp, pelY = 0.98 + Math.abs(c) * 0.05 * amp - amp * 0.03;
  let tiltX = 0, tiltZ = 0, lift = 0, neck = 0;
  const t = perf * 0.001;
  if (amp < 0.05) { shL = shR = 0.03 * Math.sin(t * 2); elL = elR = -0.15; }
  const st = p.state, act = p.act;
  if (st === 'down') {
    const f = clamp(1 - Math.max(0, p.stT - (p.stT0 || 0)) , 0, 1);
    tiltX = (p.fallBack ? -1 : 1) * Math.PI / 2 * 0.98; lift = 0.13; pelY = 0.98; hipL = -0.2; hipR = p.injured ? -1.6 : -0.3; knL = 0.3; knR = p.injured ? 2.2 : 0.4;
    shL = -0.4; shR = -0.4 + (p.injured ? Math.sin(t * 5) * 0.4 - 1.2 : 0); elL = elR = -1.2;
    tiltZ = p.injured ? Math.sin(t * 3) * 0.25 : 0;
  } else if (st === 'stumble') { lean = 0.5; }
  if (act === 'kick') { const k = clamp(p.actT / 0.35, 0, 1); hipR = -1.4 * Math.sin(k * Math.PI) + 0.4 * (k > 0.6 ? 1 : 0); knR = 0.2 + k * 0.9; shL = -0.6; shR = 0.5; lean = -0.15; }
  if (act === 'slide') { pelY = 0.45; lean = -0.7; hipR = -1.5; knR = 0.1; hipL = -0.6; knL = 1.4; shL = -0.4; shR = 0.6; }
  if (act === 'drop') {
    const k = clamp(1 - p.actT / 0.8, 0, 1);
    tiltX = -1.3 * Math.min(1, k * 3); lift = 0.15 + Math.sin(k * Math.PI) * 0.75; pelY = 0.98;
    hipL = hipR = -1.45; knL = knR = 0.05; shL = shR = -0.6; shZL = 0.9; shZR = -0.9; elL = elR = -0.3;
  }
  if (act === 'pull') { shR = -1.55; elR = -0.15; shL = -0.9; elL = -0.6; lean = -0.25; }
  if (act === 'punch') { const k = clamp(1 - p.actT / 0.6, 0, 1); shR = -1.5; elR = k < 0.4 ? -1.6 : -0.05; shL = -0.6; elL = -1.6; lean = 0.2; }
  if (act === 'stomp') { const k = clamp(1 - p.actT / 0.6, 0, 1); hipR = k < 0.5 ? -1.2 : -0.2; knR = k < 0.5 ? 1.4 : 0.1; shL = shR = -0.4; lean = 0.15; }
  if (act === 'elbow') { shR = -0.4; tiltZ = 0; elR = -2.3; B.spine.rotation.y = 0.9; }
  if (act === 'push' || st === 'brawl') { const k = Math.sin(t * 12) * 0.5 + 0.5; shL = shR = -1.3 - 0.2 * k; elL = elR = -0.2 * k; lean = 0.25; }
  if (act === 'protest' || st === 'protest' || p.appeal > 0 || (p.role === 'MGR' && act === 'protest')) { shL = -2.5 + Math.sin(t * 9) * 0.35; shR = -2.3 + Math.cos(t * 8) * 0.35; elL = elR = -0.5; shZL = 0.35; shZR = -0.35; }
  if (act === 'cele') { shL = -2.9; shR = -2.9; shZL = 0.5; shZR = -0.5; elL = elR = -0.2; pelY += Math.abs(Math.sin(t * 8)) * 0.18; }
  if (act === 'sad') { lean = 0.5; shL = shR = -0.1; neck = 0.5; }
  if (act === 'throw') { shL = shR = -3.0 + (1 - p.actT / 0.5) * 1.4; elL = elR = -0.8; }
  if (act === 'dive') { tiltZ = -p.fallDir * 1.25 * clamp(1.4 - p.actT, 0, 1) * 1.2; lift = 0.3; shL = shR = -2.8; shZL = 0.4; shZR = -0.4; }
  r.rotation.set(tiltX, p.face, tiltZ);
  r.position.y = lift;
  B.pelvis.position.y = pelY;
  B.spine.rotation.x = lean; if (act !== 'elbow') B.spine.rotation.y = 0;
  B.hipL.rotation.x = hipL; B.hipR.rotation.x = hipR; B.kneeL.rotation.x = knL; B.kneeR.rotation.x = knR;
  B.shL.rotation.x = shL; B.shR.rotation.x = shR; B.shL.rotation.z = shZL; B.shR.rotation.z = shZR;
  B.elL.rotation.x = elL; B.elR.rotation.x = elR;
  B.neck.rotation.x = neck - lean * 0.5;
}
function animateRef(dt) {
  const B = ref.body; const sp = Math.hypot(ref.vel.x, ref.vel.z);
  const sliding = ref.slideT > 0 || ref.slideRec > 0.4; const refDown = ref.downT > 0;
  const fake = { body: B, pos: ref.pos, face: sliding ? ref.slideDir : ref.yaw, ph: ref.ph || 0, state: refDown ? 'down' : 'play', fallBack: true, stT: 1, act: refDown ? null : sliding ? 'slide' : ref.kickAnim > 0 ? 'kick' : null, actT: sliding ? 1 : ref.kickAnim, appeal: 0, role: 'REF' };
  if (ref.cardT > 0) { fake.act = null; }
  animate(fake, dt, sp); ref.ph = fake.ph;
  if (ref.slideT > 0 || ref.slideRec > 0) {
    const k = ref.slideT > 0 ? 1 : clamp(ref.slideRec / 0.7, 0, 1); // 1=寝ている, 0=立った
    B.root.rotation.x = -1.2 * k; B.root.position.y = -0.14 * k;
    B.pelvis.position.y = lerp(0.98, 0.9, k);
    B.hipR.rotation.x = lerp(B.hipR.rotation.x, -0.2, k); B.kneeR.rotation.x = lerp(B.kneeR.rotation.x, 0.05, k);
    B.hipL.rotation.x = lerp(B.hipL.rotation.x, 0.15, k); B.kneeL.rotation.x = lerp(B.kneeL.rotation.x, 1.5, k);
    B.shL.rotation.x = lerp(B.shL.rotation.x, 0.9, k); B.shR.rotation.x = lerp(B.shR.rotation.x, 0.7, k); B.shL.rotation.z = 0.5 * k + 0.09; B.shR.rotation.z = -0.5 * k - 0.09;
    B.spine.rotation.x = 0.35 * k; B.neck.rotation.x = 0.6 * k;
  }
  if (ref.cardT > 0) { B.shR.rotation.x = -2.9; B.shR.rotation.z = -0.15; B.elR.rotation.x = -0.1; }
  if (!ref.cardMesh) { ref.cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.105, 0.006), new THREE.MeshBasicMaterial({ color: '#d9262c' })); ref.cardMesh.position.set(0, -0.36, 0.03); B.elR.add(ref.cardMesh); }
  ref.cardMesh.visible = ref.cardT > 0; if (ref.cardT > 0) ref.cardMesh.material.color.set(ref.cardCol === 'Y' ? '#ffd21f' : '#e0242b');
  if (ball.held) { B.shL.rotation.x = B.shR.rotation.x = -0.9; B.elL.rotation.x = B.elR.rotation.x = -0.9; }
  B.root.visible = G.view === 3;
}

// ================= ループ =================
let perf = 0, last = performance.now(), saveT = 0, outT = 0;
const ringM = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32), new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: 0.85, depthWrite: false }));
ringM.rotation.x = -Math.PI / 2; ringM.visible = false; scene.add(ringM);
const throwGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), throwMat = new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.2, transparent: true, opacity: 0.85 });
function tick() {
  if (REC) return;
  requestAnimationFrame(tick);
  const now = performance.now(); let dt = Math.min(0.05, (now - last) / 1000); last = now; perf = now;
  crowdU.uTime.value = now / 1000;
  if (!G.paused && !panelOpen && $('addp').hidden) { for (let k = 0; k < TS; k++) step(dt); }
  else if (G.phase === 'title') { cam.position.set(Math.sin(now * 0.00008) * 48, 22, Math.cos(now * 0.00008) * 48); cam.lookAt(0, 0, 0); }
  if (G.phase !== 'title') updateCam(dt);
  // 観客
  const ex = clamp(G.excite, 0, 1);
  crowdU.uJump.value = lerp(crowdU.uJump.value, 0.04 + ex * 0.35, 0.05);
  crowdU.uAng.value = clamp(G.crowdAnger / 100, 0, 1);
  if (!NR || (perf | 0) % 20 === 0) renderer.render(scene, cam);
}
function step(dt) {
  if (G.phase === 'title' || G.phase === 'over' || G.phase === 'halftime') return;
  if (!(G.phase === 'restart' && G.restart && G.restart.type === 'kickoff' && G.clock < 1 && !G.koDone)) G.clock += dt;
  G.excite = Math.max(0, G.excite - dt * 0.25);
  G.crowdAnger = clamp(G.crowdAnger - dt * 0.6, 0, 100);
  for (const t of G.teams) t.anger = clamp(t.anger - dt * 0.8, 0, 100);
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
  // 審判の移動
  let mx = input.mx, mz = input.mz;
  if (input.keys.KeyW || input.keys.ArrowUp) mz = 1; if (input.keys.KeyS || input.keys.ArrowDown) mz = -1;
  if (input.keys.KeyA || input.keys.ArrowLeft) mx = -1; if (input.keys.KeyD || input.keys.ArrowRight) mx = 1;
  const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw);
  const wx = fx * mz - fz * mx, wz = fz * mz + fx * mx;
  const m = Math.min(1, Math.hypot(mx, mz)), sp = 9.6 * m;
  const acc = 30 * dt;
  const tvx = m > 0.02 ? wx / Math.hypot(wx, wz) * sp : 0, tvz = m > 0.02 ? wz / Math.hypot(wx, wz) * sp : 0;
  if (ref.downT > 0) { ref.downT -= dt; ref.vel.multiplyScalar(Math.pow(0.05, dt)); }
  else if (ref.slideT > 0 || ref.slideRec > 0) updateSlide(dt);
  else if (ref.hurtT > 0) { ref.hurtT -= dt; ref.vel.multiplyScalar(Math.pow(0.08, dt)); }
  else { ref.vel.x += clamp(tvx - ref.vel.x, -acc, acc); ref.vel.z += clamp(tvz - ref.vel.z, -acc, acc); }
  ref.pos.addScaledVector(ref.vel, dt);
  ref.pos.x = clamp(ref.pos.x, -HW - 3, HW + 3); ref.pos.z = clamp(ref.pos.z, -HL - 3, HL + 3);
  if (ref.touchCd > 0) ref.touchCd -= dt;
  if (ref.cardT > 0) ref.cardT -= dt; if (ref.kickAnim > 0) ref.kickAnim -= dt;
  if (input.keys.Space && ref.kickHold === 0 && !G.kd) { }
  // 反則の予定
  if (G.phase === 'live' && G.roughSched.length && G.clock >= G.roughSched[0]) { G.roughSched.shift(); G.violentNext = true; G.violentWait = 9; }
  if (G.violentNext) { G.violentWait -= dt; if (G.violentWait <= 0 && G.phase === 'live') { if (offBallViolence()) G.violentNext = false; else G.violentWait = 2; } }
  if (G.phase === 'live') { G.scufT = (G.scufT ?? rnd(8, 14)) - dt; if (G.scufT <= 0) G.scufT = scuffle() ? rnd(9, 17) : 2; }
  // GKのセーブ
  if (G.pendingSave) G.pendingSave.at -= dt;
  if (G.pendingSave && G.pendingSave.at <= 0) {
    const s = G.pendingSave; G.pendingSave = null;
    const gzS = -s.p.team.dir * HL;
    if (!ball.owner && !ball.held && Math.abs(ball.pos.z) < HL + 0.3 && Math.abs(ball.pos.z - gzS) < 4 && Math.abs(ball.pos.x - s.p.pos.x) < 3.4 && ball.pos.y < 2.8) {
      ball.pos.z = gzS + s.p.team.dir * 0.9;
      G.st.save++;
    if (s.catch) { ball.owner = s.p; s.p.gkHold = true; s.p.holdT = 1.6; ball.last = s.p; msg(T('catchB'), 1.2); }
      else { ball.vel.z *= -0.35; ball.vel.x = rnd(-6, 6); ball.vel.y = rnd(1, 4); ball.last = s.p; sKick(ball.pos, 1); msg(T('save'), 1.2); }
      if (G.phase === 'pkshot') setPhase('live');
      G.excite = 1; CR('save');
    }
  }
  if (G.phase === 'pkshot' && Math.hypot(ball.vel.x, ball.vel.z) < 1.5) setPhase('live');
  updatePlayers(dt);
  updateBall(dt);
  updateDust(dt);
  {
    const dG = Math.min(Math.hypot(ball.pos.x, ball.pos.z - HL), Math.hypot(ball.pos.x, ball.pos.z + HL));
    let ex = clamp(1 - dG / 26, 0, 1) * (G.phase === 'live' ? 1 : 0.25);
    if (ball.held) ex = Math.max(ex, 0.3);
    ex = Math.max(ex * 0.85, G.excite * 0.7);
    if (crowd) crowd.update(dt, ex, G.crowdAnger);
  }
  animateRef(dt);
  // リスタートの準備
  if (G.phase === 'restart' && G.restart) {
    const R = G.restart; R.t += dt;
    const tk = R.taker;
    if (!tk || tk.gone || tk.off) { R.taker = nearest(active(R.team), R.spot, 1)[0]; if (!R.taker) { endMatch(); return; } }
    const settled = R.t > 1.6 && R.taker.pos.distanceTo(restartPos(R.taker, R, tmpV)) < 1.0;
    if (R.type === 'pk') {
      if (G.pk && G.pk.state === 'setup' && settled) { G.pk.state = 'ready'; G.pk.t = 0; }
      if (G.pk && G.pk.state === 'ready') { G.pk.t += dt; hint(G.pk.t > 6 ? T('hPKwait') : T('hPK')); if (G.pk.t > 8 && Math.random() < dt) { for (const p of nearest(active(R.team), ref.pos, 1)) startProtest(p, 2); } }
      if (ball.held || ball.pos.distanceTo(R.spot) > 0.6) { if (G.pk && G.pk.state !== 'setup') { G.pk.state = 'setup'; } if (!ball.held && ball.vel.lengthSq() < 0.5 && R.t > 3) { } }
    } else if (R.needW) {
      if (settled && !R.ready) R.ready = true;
      if (R.ready) hint(R.type === 'kickoff' ? T('hKO') : R.type === 'drop' ? T('hDrop') : T('hFK'));
    } else {
      if (settled) { R.ready = true; if (R.t > 2.6) executeRestart(); }
    }
    if (!ball.held && R.type !== 'pk' && ball.pos.distanceTo(R.spot) > 0.5 && Math.hypot(ball.vel.x, ball.vel.z) < 0.4) { ball.pos.lerp(R.spot, dt * 2); }
    if (R.type === 'pk' && !ball.held && G.pk && G.pk.state === 'setup' && ball.pos.distanceTo(R.spot) > 0.5 && Math.hypot(ball.vel.x, ball.vel.z) < 0.4 && R.t > 2) { ball.pos.copy(R.spot); }
  }
  // 外に出たとき：5秒で自動
  if (G.phase === 'out' && G.outInfo) { G.outInfo.t += dt; if (G.outInfo.t > 5) { closePanel(); decideOut(G.outInfo.correct.type, G.outInfo.correct.team); } }
  if (G.phase === 'goal' && G.goalPending) { G.goalPending.t += dt; if (G.goalPending.t > 6) confirmGoal(); }
  // 時間
  if (G.clock > HALF_LEN - 60 && G.added == null) $('bA').hidden = false;
  if (G.clock > HALF_LEN + (G.added || 0) * 60 && G.phase === 'live') hint(G.half === 1 ? T('hTime1') : T('hTime2'));
  else if (G.phase === 'live' || G.phase === 'dead') { if (hintText === T('hTime1') || hintText === T('hTime2')) hint(''); }
  // 第4審判のボード
  if (boardT > 0) { boardT -= dt; board.m.visible = true; board.draw(G.added); board.m.position.set(board.body.pos.x + 0.3, 2.2, board.body.pos.z); board.m.rotation.y = Math.PI / 2; board.ref.shL.rotation.x = board.ref.shR.rotation.x = -2.9; }
  else { board.m.visible = false; if (board.ref) board.ref.shL.rotation.x = board.ref.shR.rotation.x = 0; }
  // 観客が物を投げる
  if (G.crowdAnger > 55) { G.throwT -= dt; if (G.throwT <= 0) { G.throwT = rnd(0.4, 2.2) * (100 / G.crowdAnger); spawnThrow(); } }
  for (let i = throwns.length - 1; i >= 0; i--) {
    const o = throwns[i]; o.t += dt;
    if (!o.landed) { o.v.y -= 9.8 * dt; o.m.position.addScaledVector(o.v, dt); o.m.rotation.x += dt * 9; if (o.m.position.y < 0.05) { o.landed = true; o.m.position.y = 0.04; o.m.rotation.set(Math.PI / 2, rnd(0, 6), 0); if (o.m.position.distanceTo(ref.pos) < 1.2) { ref.hurtT = 0.4; $('hurt').style.opacity = 0.6; setTimeout(() => $('hurt').style.opacity = 0, 250); } } }
    if (o.t > 25) { scene.remove(o.m); throwns.splice(i, 1); }
  }
  // 乱入
  if (!G.invader && G.crowdAnger > 85 && Math.random() < dt * 0.02 && !G.invDone) spawnInvader();
  if (G.invader) updateInvader(dt);
  if (G.unseen && G.unseen.length && G.phase === 'live') { for (let i = G.unseen.length - 1; i >= 0; i--) { const u = G.unseen[i]; u.w += dt; if (u.w > 7) { G.unseen.splice(i, 1); missJudge('missSeen'); } } }
  if (G.rush) updateRush(dt);
  updateRetal();
  if (G.brawl) {
    G.brawl.t -= dt; G.brawl.refT -= dt;
    if (G.brawl.refT <= 0) {
      G.brawl.refT = rnd(1.2, 2.5);
      if (ref.pos.distanceTo(G.brawl.at) < 10 && Math.random() < 0.45) {
        const c = G.brawl.ps.filter(p => p.state === 'brawl'); const a = c[(Math.random() * c.length) | 0];
        if (a) { a.state = 'attackRef'; a.stT = 5; }
      }
    }
    if (G.brawl.t <= 0) { for (const p of G.brawl.ps) if (p.state === 'brawl') p.state = 'play'; G.brawl = null; for (const m of G.mgrs) if (m.state === 'brawl') m.state = 'back'; }
  }
  // カードの的
  curTarget = cardTarget();
  if (curTarget) {
    ringM.visible = true; ringM.position.set(curTarget.pos.x, 0.03, curTarget.pos.z);
    tmpV.set(curTarget.pos.x, 2.15, curTarget.pos.z).project(cam);
    const tg = $('tgt'); tg.style.opacity = tmpV.z < 1 ? 1 : 0; tg.style.left = ((tmpV.x + 1) / 2 * innerWidth) + 'px'; tg.style.top = ((1 - tmpV.y) / 2 * innerHeight) + 'px';
    tg.innerHTML = pName(curTarget) + (curTarget.yellow ? ' <span style="color:#ffd21f">■</span>' : '');
  } else { ringM.visible = false; $('tgt').style.opacity = 0; }
  // ボタン表示
  drawHUD();
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
}
function spawnThrow() {
  const m = new THREE.Mesh(throwGeo, throwMat); m.castShadow = true;
  const side = Math.abs(ref.pos.x) > Math.abs(ref.pos.z) * 0.66 ? 'x' : 'z';
  const start = side === 'x' ? V3(Math.sign(ref.pos.x || 1) * (HW + 8), 5, ref.pos.z + rnd(-6, 6)) : V3(ref.pos.x + rnd(-6, 6), 5, Math.sign(ref.pos.z || 1) * (HL + 8));
  const target = V3(ref.pos.x + rnd(-3, 3), 0, ref.pos.z + rnd(-3, 3));
  const T = 1.4; const v = V3((target.x - start.x) / T, (0 - start.y + 4.9 * T * T) / T, (target.z - start.z) / T);
  m.position.copy(start); scene.add(m); throwns.push({ m, v, t: 0 });
}
// ---------- 誤審と観客のなだれ込み ----------
let missLblT = 0;
function missHUD(why) {
  const e = $('miss'); if (!e) return;
  e.innerHTML = `${T('missN', G.miss || 0)}` + (why ? `<span>${T(why)}</span>` : '');
  e.classList.toggle('hot', (G.miss || 0) >= 7);
  if (why) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); clearTimeout(missLblT); missLblT = setTimeout(() => missHUD(), 2600); }
}
function missJudge(why) {
  if (G.rush || G.phase === 'over') return;
  G.miss = (G.miss || 0) + 1; G.crowdAnger += 4;
  missHUD(why);
  if (G.miss >= 10) startRush();
}
const FAN_COLS = ['#e8e8e8', '#222222', '#c83030', '#2a5fb0', '#f2c200', '#2e8b57', '#7a3fa0', '#e07020'];
function startRush() {
  const fans = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const sh = pick(FAN_COLS);
    const b = buildBody({ shirt: sh, shorts: pick(['#3a5a8a', '#222', '#555']), socks: '#ddd' }, null);
    const side = i % 4;
    const home = side === 0 ? V3(HW + rnd(5, 9), 0, rnd(-HL, HL)) : side === 1 ? V3(-HW - rnd(5, 9), 0, rnd(-HL, HL)) : side === 2 ? V3(rnd(-HW, HW), 0, HL + rnd(5, 9)) : V3(rnd(-HW, HW), 0, -HL - rnd(5, 9));
    fans.push({ b, pos: home.clone(), home, ph: rnd(0, 6), face: 0, chase: i % 2 === 0, cd: rnd(0, 1), act: null, actT: 0, tgt: V3(rnd(-HW, HW), 0, rnd(-HL, HL)), sp: rnd(6.8, 8.6), delay: rnd(0, 1.5) });
  }
  G.rush = { fans, t: 0, leaving: false };
  if (G.phase === 'live' || G.phase === 'pkshot') { ball.owner = null; ball.vel.multiplyScalar(0.3); setPhase('dead'); }
  for (const p of allActive()) { p.vel.multiplyScalar(0.2); }
  G.crowdAnger = 100; G.excite = 1; CR('goal'); flash(0.3);
  msg(`<span style="color:#ff6b6b">${T('rush')}</span>`, 3.2); hint(T('rushHint'));
}
function clearRush() { if (!G.rush) return; for (const f of G.rush.fans) scene.remove(f.b.root); G.rush = null; }
function updateRush(dt) {
  const R = G.rush; R.t += dt;
  for (let i = R.fans.length - 1; i >= 0; i--) {
    const f = R.fans[i];
    if (f.delay > 0 && !R.leaving) { f.delay -= dt; }
    f.cd -= dt; if (f.actT > 0) { f.actT -= dt; if (f.actT <= 0) f.act = null; }
    let tgt;
    if (R.leaving) tgt = f.home;
    else if (f.delay > 0) tgt = f.pos;
    else if (f.chase) tgt = ref.pos;
    else { if (f.pos.distanceTo(f.tgt) < 1.5) f.tgt.set(rnd(-HW + 2, HW - 2), 0, rnd(-HL + 2, HL - 2)); tgt = f.tgt; }
    tmpV.subVectors(tgt, f.pos).setY(0); const d = tmpV.length();
    const v = d > (f.chase && !R.leaving ? 0.8 : 0.3) ? f.sp * (R.leaving ? 1.1 : 1) : 0;
    if (d > 0.01) tmpV.multiplyScalar(v / d);
    if (f.act !== 'drop') f.pos.addScaledVector(tmpV, dt);
    if (v > 0) f.face = Math.atan2(tmpV.x, tmpV.z);
    // 主審をつかまえる
    if (!R.leaving && f.chase && f.delay <= 0 && d < 1.2 && f.cd <= 0 && ref.downT <= 0) {
      f.cd = 3.5; f.act = 'drop'; f.actT = 0.8;
      tmpV.subVectors(ref.pos, f.pos).setY(0).normalize();
      ref.vel.addScaledVector(tmpV, 6); ref.downT = 1.4;
      $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 500); flash(0.2);
      msg(`<span style="color:#ff6b6b">${T('rushHit')}</span>`, 1.6); CR('foul');
    }
    const fake = { body: f.b, pos: f.pos, face: f.face, ph: f.ph, state: 'play', act: f.act || (!R.leaving && !f.chase && v === 0 ? 'cele' : null), actT: f.act ? f.actT : 1, appeal: 0 };
    animate(fake, dt, v); f.ph = fake.ph;
    if (R.leaving && d < 1) { scene.remove(f.b.root); R.fans.splice(i, 1); }
  }
  if (R.leaving && (!R.fans.length || R.t > 60)) { clearRush(); G.crowdAnger *= 0.5; }
}
function spawnInvader() {
  G.invDone = true;
  const b = buildBody({ shirt: '#e8e8e8', shorts: '#3a5a8a', socks: '#e8e8e8' }, null);
  G.invader = { b, pos: V3(HW + 5, 0, rnd(-10, 10)), t: 0, face: -Math.PI / 2, ph: 0 };
  msg(T('invader'), 2.5); G.excite = 1;
}
function updateInvader(dt) {
  const I = G.invader; I.t += dt;
  const tgt = I.t < 12 ? ref.pos : V3(HW + 8, 0, 0);
  tmpV.subVectors(tgt, I.pos).setY(0); const d = tmpV.length();
  const v = d > 2 ? 7.5 : 0; if (d > 0.1) tmpV.multiplyScalar(v / d);
  I.pos.addScaledVector(tmpV, dt);
  const fake = { body: I.b, pos: I.pos, face: Math.atan2(tmpV.x, tmpV.z) || I.face, ph: I.ph, state: 'play', act: d < 2.5 ? 'cele' : null, actT: 1, appeal: 0 };
  animate(fake, dt, v); I.ph = fake.ph; I.face = fake.face;
  if (I.t > 12 && d < 1) { scene.remove(I.b.root); G.invader = null; G.crowdAnger *= 0.7; }
}
function updateCam(dt) {
  const bob = G.view === 1 ? Math.sin(perf * 0.012) * 0.03 * clamp(Math.hypot(ref.vel.x, ref.vel.z) / 9, 0, 1) : 0;
  const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw);
  if (G.view === 1) {
    const low = ref.downT > 0 ? 1.4 : (ref.slideT > 0 || ref.slideRec > 0.3) ? 0.85 : 0;
    cam.position.set(ref.pos.x + fx * 0.12, 1.72 + bob - low, ref.pos.z + fz * 0.12);
    tmpV.set(cam.position.x + fx * Math.cos(ref.pitch), cam.position.y + Math.sin(ref.pitch), cam.position.z + fz * Math.cos(ref.pitch));
    cam.lookAt(tmpV);
  } else {
    const sl = (ref.slideT > 0 || ref.slideRec > 0.3) ? 1 : 0; const back = 4.6 + sl * 0.6, up = 2.5 - sl * 0.9;
    tmpV.set(ref.pos.x - fx * back, up - ref.pitch * 2.2, ref.pos.z - fz * back);
    cam.position.lerp(tmpV, clamp(dt * 10, 0, 1));
    tmpV2.set(ref.pos.x + fx * 3, 1.3 + ref.pitch * 4, ref.pos.z + fz * 3);
    cam.lookAt(tmpV2);
  }
  if (ref.hurtT > 0) { cam.position.x += rnd(-0.06, 0.06); cam.position.y += rnd(-0.04, 0.04); }
}

// ================= 起動 =================
fetch('yaocho.glb').then(r => r.arrayBuffer()).then(buf => new Promise((ok, ng) => new GLTFLoader().parse(buf, '', ok, ng))).then(gl => {
  LIB = {};
  gl.scene.traverse(o => { if (o.parent === gl.scene) LIB[o.name] = o; });
  for (const k in LIB) { LIB[k].position.set(0, 0, 0); LIB[k].traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
  // ボール
  ball.mesh = LIB.ball.clone(true); ball.mesh.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(ball.mesh);
  // ゴール
  for (const s of [-1, 1]) {
    const g = LIB.goal.clone(true); g.scale.set(GWH / 3.66, GH / 2.44, 0.8); g.position.set(0, 0, s * HL); g.rotation.y = s > 0 ? Math.PI : 0; scene.add(g);
    // ネット
    const net = new THREE.Mesh(new THREE.BoxGeometry(GWH * 2, GH, 1.6, 12, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.35 }));
    net.position.set(0, GH / 2, s * (HL + 0.8)); scene.add(net);
  }
  let saved = null; try { saved = JSON.parse(localStorage.getItem('yaocho_save') || 'null'); } catch (e) { }
  G.saved = saved;
  newMatch(null);
  placeForKickoff();
  for (const p of G.players) animate(p, 0.016, 0);
  for (const mg of G.mgrs) animate(mg, 0.016, 0);
  applyLang();
  $('load').hidden = true;
  $('title').hidden = false;
  if (saved) $('cont').hidden = false;
  drawHUD();
  requestAnimationFrame(tick);
}).catch(e => { $('load').textContent = T('loadErr') + e.message; });

function clearMatch() {
  for (const p of [...G.players, ...G.mgrs]) scene.remove(p.body.root);
  if (ref.body) scene.remove(ref.body.root); if (board.ref) scene.remove(board.ref.root);
  G.players = []; G.mgrs = []; G.teams = []; G.sentOff = []; G.subs = [];
}
function begin(saved) {
  audioInit();
  if (saved) { clearMatch(); newMatch(saved); }
  $('title').hidden = true; $('ctl').hidden = false;
  G.paused = false; G.view = 3;
  placeForKickoff();
  G.kickoffTeam = saved ? saved.ko : (Math.random() < .5 ? 0 : 1);
  setRestart('kickoff', G.teams[G.half === 1 ? G.kickoffTeam : 1 - G.kickoffTeam]);
  msg(`${G.teams[0].n} <span style="opacity:.6">${T('vs')}</span> ${G.teams[1].n}`, 3);
  try { gtag('event', 'game_start', { game: 'yaocho' }); } catch (e) { }
}
$('go').onclick = () => begin(null);
if (REC) {
  window.__api = { missJudge, endMatch, G, ref, ball, giveCard, onWhistle, setRestart, refTouchKick, offBallViolence, tackle, startProtest, msg, hint, closePanel, active, allActive, nearest, begin, flash, board: () => board,
    setBoard: n => { G.added = n; boardT = 10; },
    advance(n, dt = 1 / 30) { for (let i = 0; i < n; i++) { perf += dt * 1000; crowdU.uTime.value = perf / 1000; if (!G.paused && !panelOpen) step(dt); updateCam(dt); const ex = clamp(G.excite, 0, 1); crowdU.uJump.value = lerp(crowdU.uJump.value, 0.04 + ex * 0.35, 0.05); } renderer.render(scene, cam); },
    render() { renderer.render(scene, cam); } };
}
$('cont').onclick = () => begin(G.saved);
