/* Three.js scene for the Infrastructure Atlas.
 *
 * Stylized, not dimensional. Proportions are roughly 1 unit = 100 mm so the
 * layout reads as a real ATX tower, but nothing here is CAD data.
 *
 * Orientation:  -Z = front of case   +Z = rear (I/O)
 *               +X = removed side panel (the camera side)
 *               -X = motherboard tray
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const CASE = { w: 2.4, h: 5.5, d: 5.6 };
const HX = CASE.w / 2, HY = CASE.h / 2, HZ = CASE.d / 2;

const COL = {
  steel:  0x2b333f,
  steelD: 0x1b212a,
  board:  0x1d2b26,
  pcb:    0x24313d,
  drive:  0x39424f,
  cyan:   0x45d9e8,
  amber:  0xf2a950,
  line:   0x46566a,
};

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- small builders ---------- */

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.65,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function edges(mesh, color, opacity = 0.5) {
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 30),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(e);
  return e;
}

/* A component group: everything selectable lives in one of these. */
function component(id, explode) {
  const g = new THREE.Group();
  g.userData.componentId = id;
  g.userData.explode = explode || new THREE.Vector3();
  g.userData.home = new THREE.Vector3();
  return g;
}

/* ---------- scene assembly ---------- */

export function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    // alpha:true is required for the transparent clear colour below to work;
    // without it the canvas paints opaque black over the stage's CSS gradient.
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x080b10, 16, 34);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

  /* lights */
  scene.add(new THREE.HemisphereLight(0x93b8ff, 0x070a0e, 1.1));

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(7, 9, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fd8ff, 0.7);
  fill.position.set(-6, 3, -5);
  scene.add(fill);

  const rimC = new THREE.PointLight(COL.cyan, 42, 16, 2);
  rimC.position.set(3.4, 1.2, -2.2);
  scene.add(rimC);

  const rimA = new THREE.PointLight(COL.amber, 26, 14, 2);
  rimA.position.set(2.2, -2.2, 2.4);
  scene.add(rimA);

  /* ground */
  const grid = new THREE.GridHelper(40, 40, 0x1d2735, 0x141c27);
  grid.position.y = -HY - 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const root = new THREE.Group();
  scene.add(root);

  const groups = {};
  const pickables = [];

  function register(g) {
    groups[g.userData.componentId] = g;
    g.traverse((o) => {
      if (o.isMesh) {
        o.userData.componentId = g.userData.componentId;
        pickables.push(o);
      }
    });
    root.add(g);
  }

  /* ---- 1. chassis (frame, floor, rear, top rail — +X panel removed) ---- */
  {
    const g = component('chassis', new THREE.Vector3(0, 0, 0));

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(CASE.w, CASE.h, CASE.d),
      new THREE.MeshStandardMaterial({
        color: COL.steelD, roughness: 0.85, metalness: 0.4,
        transparent: true, opacity: 0.10, side: THREE.BackSide,
      })
    );
    g.add(shell);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CASE.w, CASE.h, CASE.d)),
      new THREE.LineBasicMaterial({ color: COL.line, transparent: true, opacity: 0.85 })
    );
    g.add(frame);

    const floor = box(CASE.w - 0.06, 0.09, CASE.d - 0.06, COL.steel, { roughness: 0.8 });
    floor.position.y = -HY + 0.045;
    g.add(floor);

    const roof = box(CASE.w - 0.06, 0.07, CASE.d - 0.06, COL.steel, { roughness: 0.8 });
    roof.position.y = HY - 0.035;
    roof.material.transparent = true;
    roof.material.opacity = 0.45;
    g.add(roof);

    const rear = box(CASE.w - 0.06, CASE.h - 0.2, 0.07, COL.steel, { roughness: 0.8 });
    rear.position.set(0, 0, HZ - 0.035);
    g.add(rear);

    const front = box(CASE.w - 0.06, CASE.h - 0.2, 0.08, COL.steelD, { roughness: 0.9 });
    front.position.set(0, 0, -HZ + 0.04);
    g.add(front);
    edges(front, COL.line, 0.5);

    // motherboard tray + board
    const tray = box(0.06, CASE.h - 0.5, CASE.d - 0.5, COL.steel, { roughness: 0.8 });
    tray.position.set(-HX + 0.16, 0, 0.1);
    g.add(tray);

    const mobo = box(0.05, 2.44, 3.05, COL.board, { roughness: 0.75, metalness: 0.25 });
    mobo.position.set(-HX + 0.22, 0.7, 0.65);
    g.add(mobo);
    edges(mobo, 0x3f7a63, 0.45);

    register(g);
  }

  /* ---- 2. drive cage / 75 TB pool ---- */
  {
    const g = component('pool', new THREE.Vector3(0.7, 0, -1.9));
    const N = 7;
    for (let i = 0; i < N; i++) {
      // 2 x 6 TB sit at the bottom of the cage, 5 x 14 TB above
      const big = i >= 2;
      const d = box(1.0, 0.24, 1.45, big ? COL.drive : 0x333c48, {
        roughness: 0.5, metalness: 0.75,
      });
      d.position.set(-0.12, -2.02 + i * 0.335, -1.85);
      edges(d, COL.amber, big ? 0.42 : 0.26);
      g.add(d);

      // tray rails
      const rail = box(1.06, 0.03, 0.06, COL.steel, { roughness: 0.8 });
      rail.position.set(-0.12, -2.02 + i * 0.335 - 0.145, -1.2);
      g.add(rail);
    }
    register(g);
  }

  /* ---- 3. CPU + 360 mm AIO ---- */
  {
    const g = component('cpu', new THREE.Vector3(0.9, 0.5, 0));

    const socket = box(0.08, 0.5, 0.5, 0x161d24, { roughness: 0.6 });
    socket.position.set(-HX + 0.27, 1.28, 0.45);
    g.add(socket);

    const pump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.42, 28),
      new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.35, metalness: 0.8 })
    );
    pump.rotation.z = Math.PI / 2;
    pump.position.set(-HX + 0.55, 1.28, 0.45);
    g.add(pump);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.028, 10, 34),
      new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.9 })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-HX + 0.77, 1.28, 0.45);
    g.add(ring);

    // 360 mm radiator, top exhaust
    const rad = box(1.15, 0.28, 3.55, 0x1e252f, { roughness: 0.7, metalness: 0.6 });
    rad.position.set(-0.35, HY - 0.32, 0.15);
    edges(rad, COL.line, 0.55);
    g.add(rad);

    for (let i = 0; i < 3; i++) {
      const fan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.6, metalness: 0.5 })
      );
      fan.position.set(-0.35, HY - 0.55, -1.05 + i * 1.15);
      g.add(fan);
    }

    // tubing
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-HX + 0.78, 1.45, 0.30),
      new THREE.Vector3(-0.75, 2.05, -0.15),
      new THREE.Vector3(-0.45, HY - 0.52, -0.35),
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 26, 0.075, 10, false),
      new THREE.MeshStandardMaterial({ color: 0x171d25, roughness: 0.85, metalness: 0.2 })
    );
    g.add(tube);

    register(g);
  }

  /* ---- 4. memory ---- */
  {
    const g = component('ram', new THREE.Vector3(1.0, 0.9, 0.4));
    for (let i = 0; i < 4; i++) {
      const stick = box(0.34, 1.3, 0.09, COL.pcb, { roughness: 0.45, metalness: 0.5 });
      stick.position.set(-HX + 0.42, 1.42, 1.28 + i * 0.16);
      edges(stick, COL.cyan, 0.4);
      g.add(stick);

      const heat = box(0.36, 0.42, 0.11, 0x323d4b, { roughness: 0.35, metalness: 0.85 });
      heat.position.set(-HX + 0.42, 1.85, 1.28 + i * 0.16);
      g.add(heat);
    }
    register(g);
  }

  /* ---- 5. RTX 3060 ---- */
  {
    const g = component('gpu', new THREE.Vector3(1.25, 0.15, 0));

    const pcb = box(0.06, 1.02, 2.42, COL.pcb, { roughness: 0.5, metalness: 0.5 });
    pcb.position.set(-HX + 0.28, 0.28, 1.0);
    g.add(pcb);

    const shroud = box(0.42, 1.12, 2.42, 0x232b36, { roughness: 0.42, metalness: 0.7 });
    shroud.position.set(-HX + 0.55, 0.28, 1.0);
    edges(shroud, COL.cyan, 0.42);
    g.add(shroud);

    for (let i = 0; i < 2; i++) {
      const fan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.1, 22),
        new THREE.MeshStandardMaterial({ color: 0x171d25, roughness: 0.7 })
      );
      fan.rotation.z = Math.PI / 2;
      fan.position.set(-HX + 0.77, 0.28, 0.35 + i * 1.15);
      g.add(fan);
    }

    const bracket = box(0.36, 1.1, 0.06, 0x38414e, { roughness: 0.5, metalness: 0.8 });
    bracket.position.set(-HX + 0.55, 0.28, 2.24);
    g.add(bracket);

    register(g);
  }

  /* ---- 6. Quick Sync / iGPU callout ---- */
  {
    const g = component('igpu', new THREE.Vector3(0.75, -0.35, -0.55));
    const die = box(0.1, 0.3, 0.42, 0x1b2530, { roughness: 0.4, metalness: 0.7 });
    die.position.set(-HX + 0.30, 0.86, 0.45);
    g.add(die);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.2, 0.32),
      new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.75 })
    );
    glow.position.set(-HX + 0.37, 0.86, 0.45);
    g.add(glow);

    register(g);
  }

  /* ---- 7. NVMe ---- */
  {
    const g = component('nvme', new THREE.Vector3(0.8, -0.55, -0.9));
    const m2 = box(0.05, 0.22, 0.8, 0x2b3a49, { roughness: 0.45, metalness: 0.55 });
    m2.position.set(-HX + 0.27, -0.62, 0.35);
    edges(m2, COL.cyan, 0.55);
    g.add(m2);

    const shield = box(0.09, 0.3, 0.9, 0x39434f, { roughness: 0.35, metalness: 0.85 });
    shield.position.set(-HX + 0.33, -0.62, 0.35);
    g.add(shield);

    // second M.2 (scratch drive), lower slot under its own heatsink plate
    const m2b = box(0.05, 0.22, 0.8, 0x2b3a49, { roughness: 0.45, metalness: 0.55 });
    m2b.position.set(-HX + 0.27, -1.35, 0.55);
    edges(m2b, COL.cyan, 0.4);
    g.add(m2b);

    const shieldB = box(0.09, 0.3, 0.9, 0x39434f, { roughness: 0.35, metalness: 0.85 });
    shieldB.position.set(-HX + 0.33, -1.35, 0.55);
    g.add(shieldB);

    register(g);
  }

  /* ---- 8. ASM1166 (current HBA) ---- */
  {
    const g = component('hba', new THREE.Vector3(1.05, -0.5, 0.25));
    const card = box(0.05, 0.58, 1.25, 0x2f2a3d, { roughness: 0.5, metalness: 0.45 });
    card.position.set(-HX + 0.28, -1.05, 1.5);
    edges(card, COL.amber, 0.55);
    g.add(card);

    const chip = box(0.1, 0.24, 0.24, 0x1a2029, { roughness: 0.4, metalness: 0.7 });
    chip.position.set(-HX + 0.35, -1.05, 1.35);
    g.add(chip);

    const brk = box(0.3, 0.62, 0.05, 0x38414e, { roughness: 0.5, metalness: 0.8 });
    brk.position.set(-HX + 0.42, -1.05, 2.15);
    g.add(brk);

    register(g);
  }

  /* ---- 9. LSI 9207-8i (incoming — rendered ghosted) ---- */
  {
    const g = component('hba_new', new THREE.Vector3(1.2, -1.0, 0.25));
    const card = box(0.05, 0.68, 1.72, COL.amber, {
      roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.16,
    });
    card.position.set(-HX + 0.28, -1.85, 1.35);
    edges(card, COL.amber, 0.95);
    g.add(card);

    const sink = box(0.16, 0.42, 0.42, COL.amber, {
      roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.2,
    });
    sink.position.set(-HX + 0.38, -1.85, 1.05);
    edges(sink, COL.amber, 0.85);
    g.add(sink);

    register(g);
  }

  /* ---- 10. NIC ---- */
  {
    const g = component('nic', new THREE.Vector3(0.7, 0.75, 0.95));
    const chip = box(0.09, 0.26, 0.26, 0x263140, { roughness: 0.4, metalness: 0.7 });
    chip.position.set(-HX + 0.29, 1.72, 2.02);
    edges(chip, COL.cyan, 0.6);
    g.add(chip);

    const port = box(0.26, 0.3, 0.34, 0x1a212a, { roughness: 0.5, metalness: 0.7 });
    port.position.set(-HX + 0.42, 1.72, 2.32);
    g.add(port);

    register(g);
  }

  /* ---- 11. PSU ---- */
  {
    const g = component('psu', new THREE.Vector3(0.6, -1.15, 0.7));
    const body = box(1.5, 0.86, 1.8, 0x222a34, { roughness: 0.55, metalness: 0.7 });
    body.position.set(-0.18, -HY + 0.55, 1.35);
    edges(body, COL.line, 0.6);
    g.add(body);

    const fan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x151b23, roughness: 0.7 })
    );
    fan.position.set(-0.18, -HY + 0.99, 1.35);
    g.add(fan);

    register(g);
  }

  /* label anchors, in world space at rest */
  const ANCHORS = {
    chassis: new THREE.Vector3(0.4, 2.55, -2.4),
    pool:    new THREE.Vector3(0.5, -0.95, -1.85),
    cpu:     new THREE.Vector3(0.3, 1.35, 0.45),
    ram:     new THREE.Vector3(0.2, 2.0, 1.5),
    gpu:     new THREE.Vector3(0.4, 0.3, 1.0),
    igpu:    new THREE.Vector3(-0.4, 0.86, 0.45),
    nvme:    new THREE.Vector3(0.1, -0.95, 0.45),
    hba:     new THREE.Vector3(0.3, -1.05, 1.5),
    hba_new: new THREE.Vector3(0.5, -1.85, 1.35),
    nic:     new THREE.Vector3(0.2, 1.72, 2.15),
    psu:     new THREE.Vector3(0.7, -2.2, 1.35),
  };

  /* ---------- camera controls (hand-rolled: no addon, no importmap) ---------- */

  const HOME = { radius: 11.5, theta: 0.72, phi: 1.17 };
  const ctl = {
    target: new THREE.Vector3(0, -0.1, 0),
    radius: HOME.radius, theta: HOME.theta, phi: HOME.phi,
    rT: HOME.radius, thT: HOME.theta, phT: HOME.phi,
    minR: 4.2, maxR: 24,
    minPhi: 0.22, maxPhi: Math.PI - 0.22,
    autoRotate: !REDUCED,
  };

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

  function tint(id, mode) {
    const g = groups[id];
    if (!g) return;
    const isAmber = id === 'pool' || id === 'hba' || id === 'hba_new';
    const hex = isAmber ? COL.amber : COL.cyan;
    g.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      if (o.userData.baseEmissive === undefined) {
        o.userData.baseEmissive = o.material.emissive.getHex();
      }
      if (mode === 'select') {
        o.material.emissive.setHex(hex);
        o.material.emissiveIntensity = 0.5;
      } else if (mode === 'hover') {
        o.material.emissive.setHex(hex);
        o.material.emissiveIntensity = 0.2;
      } else {
        o.material.emissive.setHex(o.userData.baseEmissive);
        o.material.emissiveIntensity = 1;
      }
    });
  }

  function select(id) {
    if (selected && selected !== id) tint(selected, null);
    selected = id;
    if (id) tint(id, 'select');
  }

  function hover(id) {
    if (hovered && hovered !== selected) tint(hovered, null);
    hovered = id;
    if (id && id !== selected) tint(id, 'hover');
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
    // prefer an interior part over the surrounding chassis shell
    for (const h of hits) {
      if (h.object.userData.componentId !== 'chassis') return h.object.userData.componentId;
    }
    return hits.length ? hits[0].object.userData.componentId : null;
  }

  /* ---------- frame loop ---------- */

  const damp = REDUCED ? 1 : 0.12;
  const tmp = new THREE.Vector3();

  function update(dt) {
    if (ctl.autoRotate) ctl.thT += dt * 0.055;

    ctl.radius += (ctl.rT - ctl.radius) * damp;
    ctl.theta  += (ctl.thT - ctl.theta) * damp;
    ctl.phi    += (ctl.phT - ctl.phi) * damp;
    applyCamera();

    explodeT += (explodeGoal - explodeT) * (REDUCED ? 1 : 0.09);
    for (const id in groups) {
      const g = groups[id];
      g.position.copy(g.userData.explode).multiplyScalar(explodeT);
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
