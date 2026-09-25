/* Three.js scene for the Infrastructure Atlas.
 *
 * Stylized, not dimensional. Proportions are roughly 1 unit = 100 mm so the
 * layout reads as a real full tower, but nothing here is CAD data. The
 * arrangement (what sits where, which way cards face, where the fans are)
 * follows photographs of the actual build in its storage layout.
 *
 * Everything visual is generated in code: geometry from primitives and
 * extruded shapes, textures painted onto canvases at start-up, lighting from a
 * small procedural environment. No image assets, no addons, no importmap.
 *
 * Orientation:  -Z = front of case   +Z = rear (I/O)
 *               +X = removed side panel (the camera side)
 *               -X = motherboard tray
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/* Define 7 XL is roughly 240 wide, 604 tall, 566 deep (mm). */
const CASE = { w: 2.4, h: 6.0, d: 5.66 };
const HX = CASE.w / 2, HY = CASE.h / 2, HZ = CASE.d / 2;

/* Motherboard plane and the ATX card-slot ladder. */
const BX = -HX + 0.22;            // board surface x
const BOARD = { top: 2.3, bot: -0.75, rear: 2.45, front: 0.0 };
const SLOT_Y = (n) => 0.45 - (n - 1) * 0.2;   // slot 1 is nearest the CPU
const SHROUD_TOP = -HY + 1.0;
const DRIVE_Z = -HZ + 1.45;

const COL = {
  paint:   0x1c2027,   // powder-coated steel
  paintD:  0x14171c,
  alu:     0x3a424d,
  fanFrame:0x1d2228,
  blade:   0x2a3038,
  pcbBlk:  0x161a1f,
  pcbGrn:  0x1c3a2c,
  cable:   0x0c0e11,
  cyan:    0x45d9e8,
  amber:   0xf2a950,
  magenta: 0xff4fd8,
  line:    0x46566a,
};

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

/* =====================================================================
   Procedural textures
   ===================================================================== */

function canvasTex(size, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* soft horizontal streaks — roughness map for painted / brushed metal */
function brushedRoughness(repeat = [4, 4]) {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const y = rnd() * s, w = 20 + rnd() * 120, a = rnd() * 0.18;
      ctx.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${a})`;
      ctx.fillRect(rnd() * s, y, w, 1);
    }
  }, { repeat });
}

/* printed circuit board: traces, vias, a few chips */
function pcbTexture(base, trace, repeat = [1, 1]) {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = trace;
    for (let i = 0; i < 90; i++) {
      let x = rnd() * s, y = rnd() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      const segs = 2 + Math.floor(rnd() * 4);
      for (let k = 0; k < segs; k++) {
        const len = 20 + rnd() * 90;
        const dir = Math.floor(rnd() * 8) * Math.PI / 4;
        x += Math.cos(dir) * len; y += Math.sin(dir) * len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#6f6a55' : '#4a5a63';
      ctx.beginPath(); ctx.arc(rnd() * s, rnd() * s, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 26; i++) {
      const w = 8 + rnd() * 30, h = 8 + rnd() * 30, x = rnd() * s, y = rnd() * s;
      ctx.fillStyle = '#0c0f12';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#2a2f36';
      ctx.fillRect(x + 1, y + 1, w - 2, 1);
    }
  }, { repeat, srgb: true });
}

/* perforated steel: white = solid, black = hole (used as alphaMap) */
function perfAlpha(kind = 'hex', repeat = [6, 6]) {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#000';
    if (kind === 'hex') {
      const r = 6, dx = 16, dy = 14;
      for (let y = 0, row = 0; y < s + dy; y += dy, row++) {
        for (let x = (row % 2) * dx / 2; x < s + dx; x += dx) {
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else {
      for (let y = 6; y < s; y += 16) {
        for (let x = 0; x < s; x += 32) {
          ctx.fillRect(x + ((y / 16) % 2) * 16, y, 22, 5);
        }
      }
    }
  }, { repeat });
}

/* fine parallel fins — radiator, heatsinks, heatspreaders */
function finTexture(period = 6, dark = '#0d1013', light = '#3c444d', repeat = [1, 1]) {
  return canvasTex(128, (ctx, s) => {
    for (let x = 0; x < s; x += period) {
      ctx.fillStyle = dark; ctx.fillRect(x, 0, period, s);
      ctx.fillStyle = light; ctx.fillRect(x, 0, Math.max(1, period * 0.35), s);
    }
  }, { repeat, srgb: true });
}

/* braid pattern for sleeved cables */
function braidTexture() {
  return canvasTex(64, (ctx, s) => {
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#1d2126'; ctx.lineWidth = 3;
    for (let i = -s; i < s * 2; i += 12) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
    }
  }, { repeat: [24, 1], srgb: true });
}

/* top of a 3.5" drive: lid, label, screws */
function driveLidTexture() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#2b3037'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#353b43'; ctx.fillRect(14, 14, s - 28, s - 28);
    ctx.fillStyle = '#e6e8ea'; ctx.fillRect(40, 60, 176, 110);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rnd() > 0.4 ? '#1a1a1a' : '#9a9a9a';
      ctx.fillRect(52 + i * 6, 74, rnd() > 0.5 ? 2 : 3, 40);
    }
    ctx.fillStyle = '#777'; for (let i = 0; i < 4; i++) ctx.fillRect(54, 126 + i * 9, 120, 2);
    ctx.fillStyle = '#0f1215';
    for (const [x, y] of [[22, 22], [s - 22, 22], [22, s - 22], [s - 22, s - 22], [s / 2, 22], [s / 2, s - 22]]) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }, { srgb: true });
}

/* =====================================================================
   Materials
   ===================================================================== */

const TEX = {};
function buildTextures() {
  TEX.rough = brushedRoughness();
  TEX.pcbBlack = pcbTexture('#15181d', '#2a2f37', [2, 2]);
  TEX.pcbGreen = pcbTexture('#1a3a2a', '#2f5a42', [1, 1]);
  TEX.hex = perfAlpha('hex', [5, 5]);
  TEX.slots = perfAlpha('slot', [2, 8]);
  TEX.fins = finTexture(6, '#0c0f12', '#3a4149', [40, 1]);
  TEX.finsFine = finTexture(4, '#101317', '#4a525b', [14, 1]);
  TEX.braid = braidTexture();
  TEX.lid = driveLidTexture();
}

const M = {};
function buildMaterials() {
  M.paint = new THREE.MeshStandardMaterial({
    color: COL.paint, roughness: 0.62, metalness: 0.55, roughnessMap: TEX.rough,
  });
  M.paintDark = new THREE.MeshStandardMaterial({
    color: COL.paintD, roughness: 0.7, metalness: 0.5, roughnessMap: TEX.rough,
  });
  M.alu = new THREE.MeshStandardMaterial({
    color: COL.alu, roughness: 0.35, metalness: 0.9, roughnessMap: TEX.rough,
  });
  M.fanFrame = new THREE.MeshStandardMaterial({ color: COL.fanFrame, roughness: 0.75, metalness: 0.15 });
  M.blade = new THREE.MeshStandardMaterial({ color: COL.blade, roughness: 0.55, metalness: 0.2 });
  M.hub = new THREE.MeshStandardMaterial({ color: 0x0f1216, roughness: 0.4, metalness: 0.3 });
  M.pcbBlack = new THREE.MeshStandardMaterial({ map: TEX.pcbBlack, roughness: 0.6, metalness: 0.15 });
  M.pcbGreen = new THREE.MeshStandardMaterial({ map: TEX.pcbGreen, roughness: 0.6, metalness: 0.15 });
  M.plastic = new THREE.MeshStandardMaterial({ color: 0x0e1114, roughness: 0.55, metalness: 0.05 });
  M.plasticGrey = new THREE.MeshStandardMaterial({ color: 0x272c33, roughness: 0.5, metalness: 0.1 });
  M.cable = new THREE.MeshStandardMaterial({ map: TEX.braid, roughness: 0.6, metalness: 0.15 });
  M.flatCable = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.5, metalness: 0.1 });
  M.pump = new THREE.MeshPhysicalMaterial({
    color: 0xe8ebee, roughness: 0.3, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.2,
  });
  M.pumpCap = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c0f, roughness: 0.15, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1,
  });
  M.gpuShroud = new THREE.MeshStandardMaterial({ color: 0x171b21, roughness: 0.45, metalness: 0.5, roughnessMap: TEX.rough });
  M.backplate = new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.4, metalness: 0.85, roughnessMap: TEX.rough });
  M.fins = new THREE.MeshStandardMaterial({ map: TEX.fins, roughness: 0.5, metalness: 0.8, bumpMap: TEX.fins, bumpScale: 0.6 });
  M.finsFine = new THREE.MeshStandardMaterial({ map: TEX.finsFine, roughness: 0.45, metalness: 0.85, bumpMap: TEX.finsFine, bumpScale: 0.4 });
  M.drive = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.45, metalness: 0.75, roughnessMap: TEX.rough });
  M.driveLid = new THREE.MeshStandardMaterial({ map: TEX.lid, roughness: 0.5, metalness: 0.6 });
  M.mesh = new THREE.MeshStandardMaterial({
    color: COL.paintD, roughness: 0.8, metalness: 0.4, alphaMap: TEX.hex,
    transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  M.slotCover = new THREE.MeshStandardMaterial({
    color: 0x272c33, roughness: 0.6, metalness: 0.7, alphaMap: TEX.slots,
    transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  M.steelBracket = new THREE.MeshStandardMaterial({ color: 0xa7adb5, roughness: 0.35, metalness: 0.95 });
  M.glowCyan = new THREE.MeshBasicMaterial({ color: COL.cyan });
  M.glowMagenta = new THREE.MeshStandardMaterial({ color: 0x1a0a16, emissive: COL.magenta, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.2 });
  M.ghost = new THREE.MeshStandardMaterial({
    color: COL.amber, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.18, depthWrite: false,
  });
}

/* =====================================================================
   Geometry helpers
   ===================================================================== */

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* box with rounded edges: shape in XY extruded along Z, then centred */
function roundedBoxGeo(w, h, d, r = 0.03) {
  const bevel = Math.min(r, d / 2.2);
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(r - bevel, 0.001)), {
    depth: Math.max(d - bevel * 2, 0.001), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 4,
  });
  g.center();
  return g;
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w, h, d, mat, x, y, z) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
function rbox(w, h, d, mat, x, y, z, r) { return mesh(roundedBoxGeo(w, h, d, r), mat, x, y, z); }

function edges(m, color, opacity = 0.5) {
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(m.geometry, 30),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  m.add(e);
  return e;
}

/* ---- fan: square frame with a round bore, seven pitched blades, hub ---- */
const bladeGeoCache = {};
function bladeGeo(R) {
  const key = R.toFixed(3);
  if (bladeGeoCache[key]) return bladeGeoCache[key];
  const rin = R * 0.3, rout = R * 0.93;
  const s = new THREE.Shape();
  s.moveTo(rin, -R * 0.07);
  s.quadraticCurveTo(R * 0.62, R * 0.3, rout, R * 0.16);
  s.lineTo(rout, -R * 0.1);
  s.quadraticCurveTo(R * 0.6, -R * 0.02, rin, -R * 0.24);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: R * 0.05, bevelEnabled: false, curveSegments: 6 });
  bladeGeoCache[key] = g;
  return g;
}

const frameGeoCache = {};
function fanFrameGeo(R, thick) {
  const key = R.toFixed(3) + ':' + thick.toFixed(3);
  if (frameGeoCache[key]) return frameGeoCache[key];
  const side = R * 2.12;
  const shape = roundedRect(side, side, R * 0.18);
  const hole = new THREE.Path();
  hole.absarc(0, 0, R * 0.98, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, -thick / 2);
  frameGeoCache[key] = g;
  return g;
}

/* returns a Group; the fan's axis is local +Z; use rotation to aim it */
function fan(R, thick, opts = {}) {
  const g = new THREE.Group();
  const frame = mesh(fanFrameGeo(R, thick), opts.frameMat || M.fanFrame);
  g.add(frame);
  // four struts holding the motor
  for (let i = 0; i < 4; i++) {
    const strut = box(R * 0.7, R * 0.06, thick * 0.3, M.fanFrame);
    strut.position.set(Math.cos(i * Math.PI / 2 + Math.PI / 4) * R * 0.62, Math.sin(i * Math.PI / 2 + Math.PI / 4) * R * 0.62, -thick * 0.32);
    strut.rotation.z = i * Math.PI / 2 + Math.PI / 4;
    g.add(strut);
  }
  const hub = mesh(new THREE.CylinderGeometry(R * 0.32, R * 0.34, thick * 0.7, 24), M.hub);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const cap = mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, 0.01, 20), M.plasticGrey, 0, 0, thick * 0.36);
  cap.rotation.x = Math.PI / 2;
  g.add(cap);
  const bg = bladeGeo(R);
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 7) * Math.PI * 2;
    const b = mesh(bg, opts.bladeMat || M.blade);
    b.rotation.x = 0.55;          // blade pitch
    pivot.add(b);
    g.add(pivot);
  }
  // corner screws
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const sc = mesh(new THREE.CylinderGeometry(R * 0.05, R * 0.05, 0.012, 10), M.steelBracket, sx * R * 0.92, sy * R * 0.92, thick / 2 + 0.005);
    sc.rotation.x = Math.PI / 2;
    g.add(sc);
  }
  return g;
}

/* sleeved cable along a set of points */
function cable(points, radius = 0.045, mat = M.cable, tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
  const m = mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 10), radius, 10, false), mat);
  return m;
}

/* flat SATA-style ribbon along a set of points (thin box swept as a tube with elliptical scale) */
function ribbon(points, mat = M.flatCable) {
  const m = cable(points, 0.035, mat, 0.6);
  m.scale.set(1, 1, 1);
  return m;
}

/* =====================================================================
   Scene
   ===================================================================== */

/* A component group: everything selectable lives in one of these. */
function component(id, explode) {
  const g = new THREE.Group();
  g.userData.componentId = id;
  g.userData.explode = explode || new THREE.Vector3();
  return g;
}

/* small procedural room used only to light the metals via PMREM */
function makeEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 30, 40), new THREE.MeshBasicMaterial({ color: 0x0b0e12, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, col, pos, rot) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    p.position.set(...pos); p.rotation.set(...rot); env.add(p);
  };
  panel(14, 10, new THREE.Color(2.6, 2.7, 2.9), [0, 14, 0], [Math.PI / 2, 0, 0]);          // big soft ceiling light
  panel(10, 14, new THREE.Color(0.7, 1.5, 1.8), [18, 2, -4], [0, -Math.PI / 2, 0]);        // cool wash from the open side
  panel(6, 4, new THREE.Color(1.8, 1.1, 0.5), [6, -6, -16], [0, Math.PI, 0]);              // warm kick low front
  panel(8, 6, new THREE.Color(0.5, 0.6, 0.8), [-18, 4, 6], [0, Math.PI / 2, 0]);           // faint fill behind the tray
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}

export function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;

  buildTextures();
  buildMaterials();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x080b10, 18, 40);
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 1.0;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

  /* lights */
  scene.add(new THREE.HemisphereLight(0x8fb0e0, 0x05070a, 1.15));

  const key = new THREE.DirectionalLight(0xfff1e0, 3.8);
  key.position.set(9, 8, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fd0ff, 0.5);
  fill.position.set(-4, 3, -7);
  scene.add(fill);

  const inner = new THREE.PointLight(0xe9f1ff, 8, 10, 2);   // just outside the open side, like a room lamp
  inner.position.set(2.4, 1.6, 0.6);
  scene.add(inner);

  const innerLow = new THREE.PointLight(0xdfe8ff, 3, 8, 2);
  innerLow.position.set(2.2, -0.8, 0.2);
  scene.add(innerLow);

  const rimA = new THREE.PointLight(COL.amber, 1.6, 7, 2);   // faint warm accent on the drive column
  rimA.position.set(1.9, -0.6, -1.4);
  scene.add(rimA);

  /* ground: catches the shadow, plus the faint grid */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.55 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -HY - 0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(40, 40, 0x1a2330, 0x121924);
  grid.position.y = -HY - 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  const root = new THREE.Group();
  scene.add(root);

  const groups = {};
  const pickables = [];
  const reveal = { psu: [], pool: [] };   // meshes that fade when these parts are inspected

  function register(g) {
    groups[g.userData.componentId] = g;
    const clones = new Map();   // materials are shared globally; give this group its own copies
    g.traverse((o) => {
      if (o.isMesh) {
        o.userData.componentId = g.userData.componentId;
        if (!o.userData.ownMaterial) {
          if (!clones.has(o.material)) clones.set(o.material, o.material.clone());
          o.material = clones.get(o.material);
        }
        pickables.push(o);
      }
    });
    root.add(g);
  }

  /* ---- 1. chassis ---- */
  {
    const g = component('chassis', new THREE.Vector3(0, 0, 0));
    const T = 0.05; // sheet thickness

    // floor, with four rubber feet
    g.add(box(CASE.w, T, CASE.d, M.paint, 0, -HY + T / 2, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const foot = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 16), M.plastic, sx * (HX - 0.4), -HY - 0.06, sz * (HZ - 0.5));
      g.add(foot);
    }

    // top: steel frame + perforated mesh insert (the radiator sits under it)
    g.add(box(CASE.w, T, CASE.d, M.paint, 0, HY - T / 2, 0));
    const topMesh = mesh(new THREE.PlaneGeometry(1.7, 4.4), M.mesh, -0.1, HY + 0.002, 0.3);
    topMesh.rotation.x = -Math.PI / 2;
    g.add(topMesh);
    g.add(box(1.75, 0.02, 0.06, M.paintDark, -0.1, HY + 0.01, 0.3 - 2.22));
    g.add(box(1.75, 0.02, 0.06, M.paintDark, -0.1, HY + 0.01, 0.3 + 2.22));

    // rear panel with fan grille, I/O opening, slot covers, PSU cut-out
    g.add(box(CASE.w, CASE.h, T, M.paint, 0, 0, HZ - T / 2));
    const grille = mesh(new THREE.PlaneGeometry(1.5, 1.5), M.mesh, -0.32, 2.05, HZ + 0.002);
    g.add(grille);
    g.add(box(0.36, 1.45, 0.08, M.plastic, BX + 0.18, 1.05, HZ - 0.02));   // I/O shield block
    for (let n = 1; n <= 7; n++) {
      const sc = mesh(new THREE.PlaneGeometry(1.2, 0.17), M.slotCover, BX + 0.62, SLOT_Y(n) - 0.09, HZ + 0.003);
      sc.rotation.z = 0;
      sc.rotation.y = 0;
      // slot covers stand vertically on the rear face, one per slot, long axis = X
      g.add(sc);
    }
    g.add(box(1.55, 0.9, 0.02, M.paintDark, -0.15, -HY + 0.55, HZ + 0.005));   // PSU mounting plate
    const psuGrille = mesh(new THREE.PlaneGeometry(1.3, 0.7), M.mesh, -0.15, -HY + 0.55, HZ + 0.02);
    g.add(psuGrille);

    // front: solid sound-dampened door with a slight bevel, side intake vents
    g.add(rbox(CASE.w, CASE.h, 0.16, M.paintDark, 0, 0, -HZ + 0.08, 0.05));
    g.add(box(0.02, CASE.h - 0.8, 0.1, M.mesh, HX - 0.01, 0.2, -HZ + 0.25));
    // front I/O on the top edge: power button and a row of ports
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), M.alu, 0.6, HY + 0.01, -HZ + 0.45));
    for (let i = 0; i < 4; i++) g.add(box(0.14, 0.015, 0.07, M.plastic, -0.2 + i * 0.22, HY + 0.008, -HZ + 0.45));
    // inner front bulkhead + three 140 mm intakes + dust filter frame
    g.add(box(CASE.w - 0.1, CASE.h - 0.2, 0.03, M.paintDark, 0, 0, -HZ + 0.18));
    for (let i = 0; i < 3; i++) {
      const f = fan(0.7, 0.25);
      f.position.set(-0.05, -1.55 + i * 1.42, -HZ + 0.36);
      g.add(f);
    }

    // motherboard tray, standoff plane and the ATX board
    g.add(box(0.05, CASE.h - 0.3, CASE.d - 0.45, M.paint, -HX + 0.16, 0.05, 0.1));
    // cable grommets in the tray
    for (const [y, z] of [[1.7, -0.5], [0.3, -0.5], [-1.2, -0.5], [2.35, 1.6]]) {
      const gr = mesh(roundedBoxGeo(0.06, 0.55, 0.22, 0.06), M.plastic, -HX + 0.17, y, z);
      g.add(gr);
    }
    const mobo = box(0.035, BOARD.top - BOARD.bot, BOARD.rear - BOARD.front, M.pcbBlack,
      BX, (BOARD.top + BOARD.bot) / 2, (BOARD.rear + BOARD.front) / 2);
    g.add(mobo);

    // VRM heatsinks: rear tower with the illuminated I/O cover, top block
    g.add(rbox(0.32, 1.35, 0.32, M.finsFine, BX + 0.18, 1.5, 2.22, 0.03));
    g.add(rbox(0.36, 0.9, 0.34, M.plastic, BX + 0.2, 1.95, 2.24, 0.04));   // I/O cover
    g.add(mesh(new THREE.PlaneGeometry(0.1, 0.42), M.glowMagenta, BX + 0.385, 1.95, 2.3).rotateY(Math.PI / 2));
    g.add(rbox(0.26, 0.28, 1.0, M.finsFine, BX + 0.15, 2.12, 1.55, 0.03));
    // chipset heatsink low on the board
    g.add(rbox(0.1, 0.5, 0.5, M.finsFine, BX + 0.07, -0.45, 0.5, 0.02));
    // PCIe slots (the empty ones show as dark connectors)
    for (let n = 2; n <= 7; n++) {
      if (n === 5 || n === 7) continue;
      g.add(box(0.06, 0.06, n === 3 || n === 6 ? 0.9 : 0.4, M.plastic, BX + 0.04, SLOT_Y(n), BOARD.rear - 0.7));
    }
    // 24-pin + front-panel headers on the board edge
    g.add(box(0.12, 0.28, 0.1, M.plastic, BX + 0.07, 1.2, 0.08));

    // full-length PSU shroud with a perforated section toward the front
    const shroudTopY = SHROUD_TOP, shroudH = shroudTopY - (-HY + T);
    const shroud = rbox(CASE.w - 0.36, shroudH, CASE.d - 0.24, M.paint, 0.0, (shroudTopY + (-HY + T)) / 2, 0.0, 0.04);
    shroud.material = M.paint.clone(); shroud.material.transparent = true; shroud.userData.ownMaterial = true;
    g.add(shroud);
    reveal.psu.push(shroud);
    const shroudVent = mesh(new THREE.PlaneGeometry(1.6, 1.6), M.mesh, 0.0, shroudTopY + 0.003, -HZ + 1.45);
    shroudVent.rotation.x = -Math.PI / 2;
    g.add(shroudVent);
    for (const z of [0.6, 1.6]) {   // grommets on the shroud top
      g.add(mesh(roundedBoxGeo(0.5, 0.05, 0.18, 0.04), M.plastic, 0.35, shroudTopY + 0.01, z));
    }

    // drive-bay cover plate: slotted steel on the open side of the storage section
    const plate = box(0.03, CASE.h - 1.4, 1.75, M.paint, 0.72, shroudTopY + (CASE.h - 1.4) / 2 + 0.1, DRIVE_Z);
    plate.material = M.paint.clone(); plate.material.transparent = true; plate.userData.ownMaterial = true;
    g.add(plate);
    reveal.pool.push(plate);
    for (let r = 0; r < 9; r++) {
      const slot = box(0.04, 0.05, 0.9, M.plastic, 0.72, -1.7 + r * 0.5, DRIVE_Z);
      slot.material = M.plastic.clone(); slot.material.transparent = true; slot.userData.ownMaterial = true;
      g.add(slot);
      reveal.pool.push(slot);
    }
    // cable bundles: 24-pin up from the shroud grommet, CPU power over the top,
    // and a couple of drive power leads heading forward
    g.add(cable([[0.4, shroudTopY, 0.6], [0.5, -0.3, 0.2], [0.15, 0.9, -0.05], [BX + 0.1, 1.2, 0.05]], 0.07));
    g.add(cable([[-HX + 0.2, 2.35, 1.6], [-0.4, 2.55, 1.9], [BX + 0.35, 2.3, 2.0], [BX + 0.15, 2.05, 2.05]], 0.045));
    g.add(cable([[0.35, shroudTopY, 1.6], [0.6, -1.2, 0.9], [0.35, -1.0, -0.2], [0.3, -0.5, -1.0], [0.2, -0.3, DRIVE_Z + 0.75]], 0.04));
    g.add(cable([[0.3, shroudTopY, 0.62], [0.7, -0.9, -0.2], [0.55, -1.6, -1.1], [0.25, -1.7, DRIVE_Z + 0.75]], 0.04));

    // silhouette hint of the removed side (thin frame lines only)
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CASE.w, CASE.h, CASE.d)),
      new THREE.LineBasicMaterial({ color: COL.line, transparent: true, opacity: 0.35 })
    );
    g.add(frame);

    register(g);
  }

  /* ---- 2. drive column / 75 TB pool ---- */
  {
    const g = component('pool', new THREE.Vector3(0.9, 0, -1.4));
    for (let i = 0; i < 7; i++) {
      const y = -1.85 + i * 0.46;
      const body = rbox(1.02, 0.26, 1.47, M.drive, -0.28, y, DRIVE_Z, 0.02);
      g.add(body);
      const lid = mesh(new THREE.PlaneGeometry(0.98, 1.43), M.driveLid, -0.28, y + 0.131, DRIVE_Z);
      lid.rotation.x = -Math.PI / 2;
      lid.rotation.z = Math.PI / 2;
      g.add(lid);
      // pcb on the underside, connectors at the rear
      g.add(box(0.9, 0.02, 0.9, M.pcbGreen, -0.28, y - 0.135, DRIVE_Z + 0.2));
      g.add(box(0.36, 0.08, 0.1, M.plastic, -0.42, y - 0.06, DRIVE_Z + 0.78));
      // tray rails with thumbscrews
      for (const sx of [-1, 1]) {
        g.add(box(0.05, 0.14, 1.5, M.paintDark, -0.28 + sx * 0.55, y, DRIVE_Z));
        const ts = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10), M.steelBracket, -0.28 + sx * 0.585, y, DRIVE_Z + 0.55);
        ts.rotation.z = Math.PI / 2;
        g.add(ts);
      }
      // data + power tails to the rear of each drive
      g.add(ribbon([[-0.45, y - 0.06, DRIVE_Z + 0.84], [-0.3, y - 0.12, DRIVE_Z + 1.1], [0.1, y - 0.3, DRIVE_Z + 1.35]]));
    }
    register(g);
  }

  /* ---- 3. CPU + 360 mm AIO ---- */
  {
    const g = component('cpu', new THREE.Vector3(0.9, 0.6, 0));
    const CPU_Y = 1.5, CPU_Z = 1.5;

    g.add(box(0.05, 0.62, 0.62, M.alu, BX + 0.04, CPU_Y, CPU_Z));           // retention frame
    const pump = rbox(0.38, 0.76, 0.76, M.pump, BX + 0.25, CPU_Y, CPU_Z, 0.09);
    g.add(pump);
    const cap = rbox(0.03, 0.52, 0.52, M.pumpCap, BX + 0.45, CPU_Y, CPU_Z, 0.06);
    cap.rotation.x = Math.PI / 4;
    g.add(cap);
    g.add(mesh(new THREE.PlaneGeometry(0.14, 0.14), M.glowCyan, BX + 0.467, CPU_Y, CPU_Z).rotateY(Math.PI / 2));
    // pump fittings
    for (const off of [-0.13, 0.13]) {
      const fit = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 12), M.plasticGrey, BX + 0.3, CPU_Y + 0.42, CPU_Z + off);
      g.add(fit);
    }

    // radiator: finned core, end tanks, mounting rails; fans underneath
    const RAD_Y = HY - 0.22, RAD_Z = 0.55;
    g.add(box(1.15, 0.26, 3.6, M.fins, -0.3, RAD_Y, RAD_Z));
    for (const ez of [-1.9, 1.9]) g.add(rbox(1.2, 0.3, 0.35, M.paintDark, -0.3, RAD_Y, RAD_Z + ez, 0.04));
    g.add(box(1.22, 0.02, 3.95, M.paintDark, -0.3, RAD_Y + 0.15, RAD_Z));
    for (let i = 0; i < 3; i++) {
      const f = fan(0.58, 0.25);
      f.rotation.x = Math.PI / 2;
      f.position.set(-0.3, RAD_Y - 0.28, RAD_Z - 1.25 + i * 1.25);
      g.add(f);
    }

    // two braided tubes: up from the pump, forward and into the front end tank
    for (const off of [-0.13, 0.13]) {
      g.add(cable([
        [BX + 0.3, CPU_Y + 0.5, CPU_Z + off],
        [BX + 0.5, CPU_Y + 1.0, CPU_Z - 0.55 + off * 1.5],
        [-0.55, RAD_Y - 0.6, RAD_Z - 1.55 + off * 2],
        [-0.3 + off, RAD_Y - 0.15, RAD_Z - 2.05],
      ], 0.075, M.cable, 0.4));
    }

    register(g);
  }

  /* ---- 4. memory: four DIMMs with heatspreaders ---- */
  {
    const g = component('ram', new THREE.Vector3(1.0, 0.9, -0.3));
    for (let i = 0; i < 4; i++) {
      const z = 0.62 + i * 0.11;
      g.add(box(0.33, 1.33, 0.02, M.pcbGreen, BX + 0.18, 1.5, z));
      g.add(rbox(0.36, 1.2, 0.07, M.backplate, BX + 0.22, 1.55, z, 0.02));
      g.add(box(0.02, 1.36, 0.035, M.plastic, BX + 0.02, 1.5, z));   // slot latch body
    }
    register(g);
  }

  /* ---- 5. RTX 3060: dual-slot, twin fans facing down, backplate on top ---- */
  {
    const g = component('gpu', new THREE.Vector3(1.3, 0.2, 0));
    const Y = SLOT_Y(1), LEN = 2.35, ZC = BOARD.rear - LEN / 2;

    g.add(box(1.08, 0.025, LEN, M.pcbBlack, BX + 0.54, Y, ZC));
    g.add(rbox(1.12, 0.03, LEN, M.backplate, BX + 0.56, Y + 0.03, ZC, 0.02));      // backplate
    const shroud = rbox(1.14, 0.42, LEN + 0.02, M.gpuShroud, BX + 0.57, Y - 0.23, ZC, 0.06);
    g.add(shroud);
    g.add(box(1.0, 0.36, LEN - 0.3, M.fins, BX + 0.55, Y - 0.2, ZC));             // fin stack peeking through
    for (let i = 0; i < 2; i++) {
      const f = fan(0.44, 0.1, { frameMat: M.gpuShroud });
      f.rotation.x = Math.PI / 2;
      f.position.set(BX + 0.62, Y - 0.44, ZC - 0.62 + i * 1.24);
      g.add(f);
    }
    // bracket + display outputs, 8-pin power on the outer edge
    g.add(box(1.16, 0.44, 0.03, M.steelBracket, BX + 0.58, Y - 0.2, BOARD.rear + 0.02));
    for (let i = 0; i < 4; i++) g.add(box(0.14, 0.09, 0.05, M.plastic, BX + 0.25 + i * 0.22, Y - 0.12, BOARD.rear + 0.04));
    g.add(box(0.16, 0.14, 0.3, M.plastic, BX + 1.06, Y - 0.12, ZC + 0.2));
    g.add(cable([[BX + 1.1, Y - 0.05, ZC + 0.2], [BX + 1.35, Y + 0.3, ZC + 0.1], [0.6, 0.9, -0.4], [-HX + 0.2, 0.3, -0.5]], 0.06));

    register(g);
  }

  /* ---- 6. Quick Sync / iGPU callout ---- */
  {
    const g = component('igpu', new THREE.Vector3(0.75, -0.3, -0.7));
    g.add(box(0.06, 0.28, 0.4, M.plastic, BX + 0.02, 1.5 - 0.62, 1.5));
    g.add(mesh(new THREE.PlaneGeometry(0.3, 0.18), M.glowCyan, BX + 0.055, 1.5 - 0.62, 1.5).rotateY(Math.PI / 2));
    register(g);
  }

  /* ---- 7. NVMe: two M.2 heatsink shields ---- */
  {
    const g = component('nvme', new THREE.Vector3(0.8, -0.6, -0.9));
    const s1 = rbox(0.07, 0.26, 1.05, M.finsFine, BX + 0.05, 0.8, 1.05, 0.02);
    g.add(s1);
    g.add(box(0.02, 0.1, 0.5, M.alu, BX + 0.09, 0.8, 1.05));
    const s2 = rbox(0.07, 0.26, 0.95, M.finsFine, BX + 0.05, SLOT_Y(3) - 0.02, 1.15, 0.02);
    g.add(s2);
    register(g);
  }

  /* ---- 8. ASM1166 (current HBA): short green card in slot 5 ---- */
  {
    const g = component('hba', new THREE.Vector3(1.05, -0.5, 0.2));
    const Y = SLOT_Y(5), LEN = 0.95, ZC = BOARD.rear - LEN / 2;
    g.add(box(0.62, 0.02, LEN, M.pcbGreen, BX + 0.31, Y, ZC));
    g.add(rbox(0.2, 0.06, 0.2, M.alu, BX + 0.3, Y - 0.04, ZC, 0.01));
    for (let i = 0; i < 6; i++) g.add(box(0.08, 0.09, 0.1, M.plastic, BX + 0.58, Y - 0.055, ZC - 0.36 + i * 0.14));
    g.add(box(0.7, 0.16, 0.03, M.steelBracket, BX + 0.36, Y - 0.04, BOARD.rear + 0.02));
    // three data ribbons leaving the ports toward the drive column
    for (let i = 0; i < 3; i++) {
      g.add(ribbon([[BX + 0.64, Y - 0.06, ZC - 0.3 + i * 0.28], [BX + 0.95, Y - 0.25, 0.8], [0.35, -0.6 - i * 0.1, -0.6], [0.15, -0.2 - i * 0.35, DRIVE_Z + 1.3]]));
    }
    register(g);
  }

  /* ---- 9. LSI 9207-8i (incoming — rendered ghosted) in slot 7 ---- */
  {
    const g = component('hba_new', new THREE.Vector3(1.2, -0.9, 0.2));
    const Y = SLOT_Y(7), LEN = 1.68, ZC = BOARD.rear - LEN / 2;
    const card = box(0.68, 0.02, LEN, M.ghost, BX + 0.34, Y, ZC);
    card.castShadow = false;
    edges(card, COL.amber, 0.95);
    g.add(card);
    const sink = box(0.42, 0.14, 0.42, M.ghost, BX + 0.3, Y - 0.08, ZC + 0.1);
    sink.castShadow = false;
    edges(sink, COL.amber, 0.85);
    g.add(sink);
    for (let i = 0; i < 2; i++) {
      const c = box(0.2, 0.12, 0.12, M.ghost, BX + 0.18 + i * 0.28, Y - 0.07, ZC - LEN / 2 + 0.08);
      c.castShadow = false;
      edges(c, COL.amber, 0.8);
      g.add(c);
    }
    register(g);
  }

  /* ---- 10. NIC: I225-V by the rear I/O ---- */
  {
    const g = component('nic', new THREE.Vector3(0.7, 0.7, 0.9));
    const chip = box(0.04, 0.22, 0.22, M.plastic, BX + 0.03, 0.55, 2.2);
    edges(chip, COL.cyan, 0.5);
    g.add(chip);
    const port = box(0.2, 0.2, 0.22, M.alu, BX + 0.16, 0.55, HZ - 0.12);
    edges(port, COL.cyan, 0.35);
    g.add(port);
    register(g);
  }

  /* ---- 11. PSU: under the shroud, rear-bottom, fan facing the floor ---- */
  {
    const g = component('psu', new THREE.Vector3(0.7, -1.3, 0.6));
    g.add(rbox(1.5, 0.86, 1.8, M.paintDark, -0.15, -HY + 0.55, HZ - 1.0, 0.04));
    const f = fan(0.56, 0.06, { frameMat: M.paintDark });
    f.rotation.x = -Math.PI / 2;
    f.position.set(-0.15, -HY + 0.11, HZ - 1.0);
    g.add(f);
    g.add(mesh(new THREE.PlaneGeometry(1.2, 1.2), M.mesh, -0.15, -HY + 0.085, HZ - 1.0).rotateX(Math.PI / 2));
    g.add(box(0.9, 0.24, 0.01, M.plasticGrey, -0.15, -HY + 0.75, HZ - 0.099));    // label strip
    for (let i = 0; i < 5; i++) g.add(box(0.16, 0.12, 0.08, M.plastic, -0.7 + i * 0.28, -HY + 0.55, HZ - 1.92));
    register(g);
  }

  /* label anchors, in world space at rest */
  const ANCHORS = {
    chassis: new THREE.Vector3(0.4, 2.85, -2.3),
    pool:    new THREE.Vector3(0.45, -0.5, DRIVE_Z),
    cpu:     new THREE.Vector3(BX + 0.55, 1.5, 1.5),
    ram:     new THREE.Vector3(BX + 0.3, 2.25, 0.8),
    gpu:     new THREE.Vector3(BX + 0.9, 0.35, 1.1),
    igpu:    new THREE.Vector3(BX + 0.1, 0.95, 1.7),
    nvme:    new THREE.Vector3(BX + 0.15, 0.62, 0.35),
    hba:     new THREE.Vector3(BX + 0.55, SLOT_Y(5), 1.95),
    hba_new: new THREE.Vector3(BX + 0.75, SLOT_Y(7) - 0.15, 1.2),
    nic:     new THREE.Vector3(BX + 0.55, 0.55, 2.45),
    psu:     new THREE.Vector3(0.6, -2.45, HZ - 1.0),
  };

  /* ---------- camera controls (hand-rolled: no addon, no importmap) ---------- */

  const HOME = { radius: 12.4, theta: 1.32, phi: 1.24 };
  const ctl = {
    target: new THREE.Vector3(0, -0.05, 0),
    radius: HOME.radius, theta: HOME.theta, phi: HOME.phi,
    rT: HOME.radius, thT: HOME.theta, phT: HOME.phi,
    minR: 4.2, maxR: 26,
    minPhi: 0.22, maxPhi: Math.PI - 0.22,
    autoRotate: !REDUCED,
  };
  let idleT = 0;

  function applyCamera() {
    const sp = Math.sin(ctl.phi), cp = Math.cos(ctl.phi);
    camera.position.set(
      ctl.target.x + ctl.radius * sp * Math.sin(ctl.theta),
      ctl.target.y + ctl.radius * cp,
      ctl.target.z + ctl.radius * sp * Math.cos(ctl.theta)
    );
    camera.lookAt(ctl.target);
  }

  function resetView() {
    ctl.rT = HOME.radius; ctl.thT = HOME.theta; ctl.phT = HOME.phi;
    ctl.autoRotate = false;
  }

  function zoomBy(f) {
    ctl.rT = THREE.MathUtils.clamp(ctl.rT * f, ctl.minR, ctl.maxR);
    ctl.autoRotate = false;
  }

  function orbitBy(dx, dy) {
    ctl.thT -= dx;
    ctl.phT = THREE.MathUtils.clamp(ctl.phT - dy, ctl.minPhi, ctl.maxPhi);
    ctl.autoRotate = false;
  }

  /* ---------- exploded view ---------- */

  let explodeT = 0, explodeGoal = 0;
  function setExploded(on) { explodeGoal = on ? 1 : 0; }

  /* ---------- selection + hover highlight ---------- */

  let selected = null, hovered = null;
  const revealGoal = { psu: 0, pool: 0 }, revealT = { psu: 0, pool: 0 };

  function tint(id, mode) {
    const g = groups[id];
    if (!g) return;
    const isAmber = id === 'pool' || id === 'hba' || id === 'hba_new';
    const hex = isAmber ? COL.amber : COL.cyan;
    g.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      if (o.userData.baseEmissive === undefined) {
        o.userData.baseEmissive = o.material.emissive.getHex();
        o.userData.baseEmissiveI = o.material.emissiveIntensity;
      }
      const k = id === 'chassis' ? 0.25 : 1;
      if (mode === 'select') {
        o.material.emissive.setHex(hex);
        o.material.emissiveIntensity = 0.16 * k;
      } else if (mode === 'hover') {
        o.material.emissive.setHex(hex);
        o.material.emissiveIntensity = 0.07 * k;
      } else {
        o.material.emissive.setHex(o.userData.baseEmissive);
        o.material.emissiveIntensity = o.userData.baseEmissiveI;
      }
    });
  }

  function updateReveal() {
    revealGoal.psu = (selected === 'psu' || hovered === 'psu') ? 1 : 0;
    revealGoal.pool = (selected === 'pool' || hovered === 'pool') ? 1 : 0;
  }

  function select(id) {
    if (selected && selected !== id) tint(selected, null);
    selected = id;
    if (id) tint(id, 'select');
    updateReveal();
  }

  function hover(id) {
    if (hovered && hovered !== selected) tint(hovered, null);
    hovered = id;
    if (id && id !== selected) tint(id, 'hover');
    updateReveal();
  }

  /* ---------- picking ---------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, false);
    // the shroud and the drive cover plate hand the click to what they cover
    for (const h of hits) {
      const o = h.object;
      if (reveal.psu.includes(o) || reveal.pool.includes(o)) continue;
      return o.userData.componentId;
    }
    if (hits.length) {
      const o = hits[0].object;
      if (reveal.psu.includes(o)) return 'psu';
      if (reveal.pool.includes(o)) return 'pool';
      return o.userData.componentId;
    }
    return null;
  }

  /* ---------- frame loop ---------- */

  const damp = REDUCED ? 1 : 0.12;
  const tmp = new THREE.Vector3();

  function update(dt) {
    if (ctl.autoRotate) {                       // gentle sway around the open side, not a full spin
      idleT += dt;
      ctl.thT = HOME.theta + Math.sin(idleT * 0.18) * 0.22;
    }

    ctl.radius += (ctl.rT - ctl.radius) * damp;
    ctl.theta  += (ctl.thT - ctl.theta) * damp;
    ctl.phi    += (ctl.phT - ctl.phi) * damp;
    applyCamera();

    explodeT += (explodeGoal - explodeT) * (REDUCED ? 1 : 0.09);
    for (const id in groups) {
      const g = groups[id];
      g.position.copy(g.userData.explode).multiplyScalar(explodeT);
    }

    for (const k of ['psu', 'pool']) {
      revealT[k] += (revealGoal[k] - revealT[k]) * (REDUCED ? 1 : 0.15);
      const op = 1 - revealT[k] * 0.82;
      for (const m of reveal[k]) { m.material.opacity = op; m.castShadow = op > 0.6; }
    }

    renderer.render(scene, camera);
  }

  /* screen position of each label anchor, for the HTML overlay */
  function labelPositions() {
    const out = [];
    const r = canvas.getBoundingClientRect();
    for (const id in ANCHORS) {
      const g = groups[id];
      tmp.copy(ANCHORS[id]).addScaledVector(g.userData.explode, explodeT);
      tmp.project(camera);
      if (tmp.z > 1) continue;
      out.push({
        id,
        x: (tmp.x * 0.5 + 0.5) * r.width,
        y: (-tmp.y * 0.5 + 0.5) * r.height,
        depth: tmp.z,
      });
    }
    return out;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  applyCamera();
  resize();

  return {
    renderer, scene, camera, ctl,
    update, resize, resetView, zoomBy, orbitBy,
    setExploded, select, hover, pick, labelPositions,
    get selected() { return selected; },
    stopAuto() { ctl.autoRotate = false; },
  };
}
