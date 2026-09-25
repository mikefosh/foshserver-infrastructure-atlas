/* Three.js scene for the Infrastructure Atlas.
 *
 * Stylized, not dimensional. Proportions are roughly 1 unit = 100 mm so the
 * layout reads as a real full tower, but nothing here is CAD data. The
 * arrangement (what sits where, which way cards face, where the fans are)
 * follows photographs of the actual build in its storage layout.
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

const COL = {
  steel:  0x2b333f,
  steelD: 0x1b212a,
  board:  0x1d2b26,
  pcb:    0x24313d,
  drive:  0x39424f,
  fan:    0x1a2029,
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

/* A case fan: frame + hub, axis along `axis` ('x' | 'y' | 'z'). */
function fan(radius, thick, axis, opts = {}) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, thick, 28),
    new THREE.MeshStandardMaterial({ color: opts.color ?? 0x232b36, roughness: 0.6, metalness: 0.5 })
  );
  const blades = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, thick * 0.35, 28),
    new THREE.MeshStandardMaterial({ color: COL.fan, roughness: 0.75, metalness: 0.3 })
  );
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, thick * 1.05, 20),
    new THREE.MeshStandardMaterial({ color: 0x2f3946, roughness: 0.4, metalness: 0.7 })
  );
  g.add(frame, blades, hub);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  return g;
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
  scene.fog = new THREE.Fog(0x080b10, 17, 36);

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
  rimC.position.set(3.4, 1.4, 1.2);
  scene.add(rimC);

  const rimA = new THREE.PointLight(COL.amber, 26, 14, 2);
  rimA.position.set(2.4, -1.4, -2.2);
  scene.add(rimA);

  // soft interior light so the board and cards read against the dark tray
  const inner = new THREE.PointLight(0xdbe7ff, 18, 9, 2);
  inner.position.set(0.6, 1.0, 1.4);
  scene.add(inner);

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

  /* ---- 1. chassis: frame, panels, tray, board, shroud, case fans ---- */
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

    // vented top panel — translucent so the radiator reads through it
    const roof = box(CASE.w - 0.06, 0.07, CASE.d - 0.06, COL.steel, { roughness: 0.8 });
    roof.position.y = HY - 0.035;
    roof.material.transparent = true;
    roof.material.opacity = 0.4;
    g.add(roof);

    // rear panel, with the 140 mm exhaust fan up top and the I/O block below it
    const rear = box(CASE.w - 0.06, CASE.h - 0.2, 0.07, COL.steel, { roughness: 0.8 });
    rear.position.set(0, 0, HZ - 0.035);
    g.add(rear);

    const rearFan = fan(0.68, 0.25, 'z');
    rearFan.position.set(-0.32, 2.05, HZ - 0.24);
    g.add(rearFan);

    const io = box(0.3, 1.25, 0.28, 0x151b23, { roughness: 0.6, metalness: 0.7 });
    io.position.set(BX + 0.15, 1.05, HZ - 0.2);
    edges(io, COL.line, 0.4);
    g.add(io);

    // front: solid sound-dampened door, dust filter, three 140 mm intakes
    const front = box(CASE.w - 0.06, CASE.h - 0.2, 0.1, COL.steelD, { roughness: 0.9 });
    front.position.set(0, 0, -HZ + 0.05);
    g.add(front);
    edges(front, COL.line, 0.5);

    for (let i = 0; i < 3; i++) {
      const f = fan(0.68, 0.25, 'z');
      f.position.set(-0.05, -1.55 + i * 1.42, -HZ + 0.32);
      g.add(f);
    }

    // motherboard tray + ATX board
    const tray = box(0.06, CASE.h - 0.5, CASE.d - 0.5, COL.steel, { roughness: 0.8 });
    tray.position.set(-HX + 0.16, 0, 0.1);
    g.add(tray);

    const mobo = box(0.05, BOARD.top - BOARD.bot, BOARD.rear - BOARD.front, COL.board,
      { roughness: 0.75, metalness: 0.25 });
    mobo.position.set(BX, (BOARD.top + BOARD.bot) / 2, (BOARD.rear + BOARD.front) / 2);
    edges(mobo, 0x3f7a63, 0.45);
    g.add(mobo);

    // VRM heatsinks around the socket (rear side and top)
    const vrmR = box(0.32, 1.35, 0.3, 0x262b3a, { roughness: 0.5, metalness: 0.8 });
    vrmR.position.set(BX + 0.18, 1.5, 2.22);
    g.add(vrmR);
    const vrmT = box(0.26, 0.28, 1.0, 0x262b3a, { roughness: 0.5, metalness: 0.8 });
    vrmT.position.set(BX + 0.15, 2.12, 1.55);
    g.add(vrmT);

    // full-length PSU shroud, translucent so the supply beneath stays legible
    const shroud = box(CASE.w - 0.34, SHROUD_TOP - (-HY + 0.09), CASE.d - 0.2, 0x1f2731,
      { roughness: 0.75, metalness: 0.5, transparent: true, opacity: 0.42 });
    shroud.position.set(0.02, (SHROUD_TOP + (-HY + 0.09)) / 2, 0.02);
    edges(shroud, COL.line, 0.6);
    g.add(shroud);

    // drive-bay cover plate on the side-panel face of the storage section
    const plate = box(0.04, CASE.h - 1.4, 1.75, 0x222a34,
      { roughness: 0.7, metalness: 0.6, transparent: true, opacity: 0.35 });
    plate.position.set(0.72, SHROUD_TOP + (CASE.h - 1.4) / 2 + 0.1, -HZ + 1.45);
    edges(plate, COL.line, 0.5);
    g.add(plate);
    for (let r = 0; r < 9; r++) {
      const slot = box(0.05, 0.05, 0.9, 0x0c1015, { roughness: 1, metalness: 0 });
      slot.position.set(0.72, -1.7 + r * 0.5, -HZ + 1.45);
      g.add(slot);
    }

    register(g);
  }

  /* ---- 2. drive column / 75 TB pool: seven 3.5" drives, one stack, front ---- */
  {
    const g = component('pool', new THREE.Vector3(0.9, 0, -1.6));
    const N = 7;
    for (let i = 0; i < N; i++) {
      // 2 x 6 TB at the bottom of the column, 5 x 14 TB above
      const big = i >= 2;
      const d = box(1.02, 0.26, 1.47, big ? COL.drive : 0x333c48, {
        roughness: 0.5, metalness: 0.75,
      });
      const y = -1.85 + i * 0.46;
      d.position.set(-0.28, y, -HZ + 1.45);
      edges(d, COL.amber, big ? 0.42 : 0.26);
      g.add(d);

      // SATA/power tail on the rear face
      const tail = box(0.34, 0.08, 0.1, 0x0f1318, { roughness: 0.9, metalness: 0.1 });
      tail.position.set(-0.45, y - 0.05, -HZ + 1.45 + 0.78);
      g.add(tail);

      // tray rails either side
      for (const sx of [-1, 1]) {
        const rail = box(0.05, 0.12, 1.5, COL.steel, { roughness: 0.8 });
        rail.position.set(-0.28 + sx * 0.55, y, -HZ + 1.45);
        g.add(rail);
      }
    }
    register(g);
  }

  /* ---- 3. CPU + 360 mm AIO (top-mounted, fans under the radiator) ---- */
  {
    const g = component('cpu', new THREE.Vector3(0.9, 0.6, 0));
    const CPU_Y = 1.5, CPU_Z = 1.5;

    const socket = box(0.06, 0.6, 0.6, 0x161d24, { roughness: 0.6 });
    socket.position.set(BX + 0.05, CPU_Y, CPU_Z);
    g.add(socket);

    // square pump block, light shell with the illuminated logo facing out
    const pump = box(0.36, 0.74, 0.74, 0xd8dde3, { roughness: 0.35, metalness: 0.5 });
    pump.position.set(BX + 0.24, CPU_Y, CPU_Z);
    edges(pump, 0x8b95a3, 0.5);
    g.add(pump);

    const face = box(0.02, 0.5, 0.5, 0x0f1318, { roughness: 0.3, metalness: 0.2 });
    face.position.set(BX + 0.43, CPU_Y, CPU_Z);
    face.rotation.x = Math.PI / 4;
    g.add(face);

    const logo = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.16, 0.16),
      new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.9 })
    );
    logo.position.set(BX + 0.45, CPU_Y, CPU_Z);
    g.add(logo);

    // 360 mm radiator against the top panel, three fans mounted beneath it
    const RAD_Y = HY - 0.22, RAD_Z = 0.55;
    const rad = box(1.2, 0.28, 3.95, 0x1e252f, { roughness: 0.7, metalness: 0.6 });
    rad.position.set(-0.3, RAD_Y, RAD_Z);
    edges(rad, COL.line, 0.55);
    g.add(rad);

    for (let i = 0; i < 3; i++) {
      const f = fan(0.58, 0.25, 'y');
      f.position.set(-0.3, RAD_Y - 0.27, RAD_Z - 1.25 + i * 1.25);
      g.add(f);
    }

    // two braided tubes from the top of the pump up to the front of the radiator
    for (const off of [-0.12, 0.12]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(BX + 0.3, CPU_Y + 0.37, CPU_Z + off),
        new THREE.Vector3(BX + 0.45, CPU_Y + 1.0, CPU_Z - 0.6 + off),
        new THREE.Vector3(-0.35, RAD_Y - 0.45, RAD_Z - 1.55 + off),
      ]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 30, 0.07, 10, false),
        new THREE.MeshStandardMaterial({ color: 0x171d25, roughness: 0.85, metalness: 0.2 })
      );
      g.add(tube);
    }

    register(g);
  }

  /* ---- 4. memory: four DIMMs, front side of the socket ---- */
  {
    const g = component('ram', new THREE.Vector3(1.0, 0.9, -0.3));
    for (let i = 0; i < 4; i++) {
      const z = 0.62 + i * 0.11;
      const stick = box(0.34, 1.33, 0.05, COL.pcb, { roughness: 0.45, metalness: 0.5 });
      stick.position.set(BX + 0.2, 1.5, z);
      edges(stick, COL.cyan, 0.4);
      g.add(stick);

      const heat = box(0.36, 1.15, 0.075, 0x323d4b, { roughness: 0.35, metalness: 0.85 });
      heat.position.set(BX + 0.22, 1.55, z);
      g.add(heat);
    }
    register(g);
  }

  /* ---- 5. RTX 3060: dual-slot card lying flat in slot 1, fans facing down ---- */
  {
    const g = component('gpu', new THREE.Vector3(1.3, 0.2, 0));
    const Y = SLOT_Y(1), LEN = 2.35, ZC = BOARD.rear - LEN / 2;

    const pcb = box(1.1, 0.03, LEN, COL.pcb, { roughness: 0.5, metalness: 0.5 });
    pcb.position.set(BX + 0.55, Y, ZC);
    g.add(pcb);

    const shroud = box(1.12, 0.42, LEN, 0x232b36, { roughness: 0.42, metalness: 0.7 });
    shroud.position.set(BX + 0.56, Y - 0.23, ZC);
    edges(shroud, COL.cyan, 0.42);
    g.add(shroud);

    for (let i = 0; i < 2; i++) {
      const f = fan(0.44, 0.08, 'y', { color: 0x1c232d });
      f.position.set(BX + 0.62, Y - 0.45, ZC - 0.62 + i * 1.24);
      g.add(f);
    }

    // rear bracket, and the 8-pin power tail on the outer edge
    const bracket = box(1.15, 0.42, 0.04, 0x38414e, { roughness: 0.5, metalness: 0.8 });
    bracket.position.set(BX + 0.58, Y - 0.2, BOARD.rear + 0.02);
    g.add(bracket);

    const pwr = box(0.16, 0.14, 0.3, 0x0f1318, { roughness: 0.9, metalness: 0.1 });
    pwr.position.set(BX + 1.06, Y - 0.1, ZC + 0.2);
    g.add(pwr);

    register(g);
  }

  /* ---- 6. Quick Sync / iGPU callout: on the processor die ---- */
  {
    const g = component('igpu', new THREE.Vector3(0.75, -0.3, -0.7));
    const die = box(0.08, 0.3, 0.42, 0x1b2530, { roughness: 0.4, metalness: 0.7 });
    die.position.set(BX + 0.02, 1.5 - 0.62, 1.5);
    g.add(die);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.2, 0.32),
      new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.75 })
    );
    glow.position.set(BX + 0.08, 1.5 - 0.62, 1.5);
    g.add(glow);

    register(g);
  }

  /* ---- 7. NVMe: two M.2 slots under their heatsink shields ---- */
  {
    const g = component('nvme', new THREE.Vector3(0.8, -0.6, -0.9));

    // primary slot between the socket and the first PCIe slot (CPU lanes)
    const s1 = box(0.08, 0.26, 1.05, 0x39434f, { roughness: 0.35, metalness: 0.85 });
    s1.position.set(BX + 0.06, 0.8, 1.05);
    edges(s1, COL.cyan, 0.55);
    g.add(s1);

    // second slot lower on the board, below the graphics card
    const s2 = box(0.08, 0.26, 0.95, 0x39434f, { roughness: 0.35, metalness: 0.85 });
    s2.position.set(BX + 0.06, SLOT_Y(3) - 0.02, 1.15);
    edges(s2, COL.cyan, 0.4);
    g.add(s2);

    register(g);
  }

  /* ---- 8. ASM1166 (current HBA): short card in slot 5 ---- */
  {
    const g = component('hba', new THREE.Vector3(1.05, -0.5, 0.2));
    const Y = SLOT_Y(5), LEN = 0.95, ZC = BOARD.rear - LEN / 2;

    const card = box(0.62, 0.03, LEN, 0x2f2a3d, { roughness: 0.5, metalness: 0.45 });
    card.position.set(BX + 0.31, Y, ZC);
    edges(card, COL.amber, 0.55);
    g.add(card);

    const chip = box(0.22, 0.08, 0.22, 0x1a2029, { roughness: 0.4, metalness: 0.7 });
    chip.position.set(BX + 0.3, Y - 0.05, ZC);
    g.add(chip);

    // six SATA ports along the outer edge, cables leave toward the drive column
    for (let i = 0; i < 6; i++) {
      const port = box(0.08, 0.1, 0.1, 0x0f1318, { roughness: 0.9, metalness: 0.1 });
      port.position.set(BX + 0.58, Y - 0.06, ZC - 0.36 + i * 0.14);
      g.add(port);
    }

    const brk = box(0.7, 0.18, 0.04, 0x9aa3ad, { roughness: 0.4, metalness: 0.9 });
    brk.position.set(BX + 0.36, Y - 0.05, BOARD.rear + 0.02);
    g.add(brk);

    register(g);
  }

  /* ---- 9. LSI 9207-8i (incoming — rendered ghosted) in slot 7 ---- */
  {
    const g = component('hba_new', new THREE.Vector3(1.2, -0.9, 0.2));
    const Y = SLOT_Y(7), LEN = 1.68, ZC = BOARD.rear - LEN / 2;

    const card = box(0.68, 0.03, LEN, COL.amber, {
      roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.16,
    });
    card.position.set(BX + 0.34, Y, ZC);
    edges(card, COL.amber, 0.95);
    g.add(card);

    const sink = box(0.42, 0.14, 0.42, COL.amber, {
      roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.2,
    });
    sink.position.set(BX + 0.3, Y - 0.08, ZC + 0.1);
    edges(sink, COL.amber, 0.85);
    g.add(sink);

    // two SFF-8087 connectors on the front edge
    for (let i = 0; i < 2; i++) {
      const c = box(0.2, 0.12, 0.12, COL.amber, {
        roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.2,
      });
      c.position.set(BX + 0.18 + i * 0.28, Y - 0.07, ZC - LEN / 2 + 0.08);
      edges(c, COL.amber, 0.8);
      g.add(c);
    }

    register(g);
  }

  /* ---- 10. NIC: I225-V near the rear I/O ---- */
  {
    const g = component('nic', new THREE.Vector3(0.7, 0.7, 0.9));
    const chip = box(0.06, 0.24, 0.24, 0x263140, { roughness: 0.4, metalness: 0.7 });
    chip.position.set(BX + 0.04, 0.55, 2.2);
    edges(chip, COL.cyan, 0.6);
    g.add(chip);

    const port = box(0.2, 0.22, 0.24, 0x1a212a, { roughness: 0.5, metalness: 0.7 });
    port.position.set(BX + 0.16, 0.55, HZ - 0.2);
    edges(port, COL.cyan, 0.35);
    g.add(port);

    register(g);
  }

  /* ---- 11. PSU: under the shroud, rear-bottom, fan facing the floor ---- */
  {
    const g = component('psu', new THREE.Vector3(0.7, -1.2, 0.6));
    const body = box(1.5, 0.86, 1.8, 0x222a34, { roughness: 0.55, metalness: 0.7 });
    body.position.set(-0.15, -HY + 0.55, HZ - 1.0);
    edges(body, COL.line, 0.6);
    g.add(body);

    const f = fan(0.55, 0.06, 'y', { color: 0x1c232d });
    f.position.set(-0.15, -HY + 0.13, HZ - 1.0);
    g.add(f);

    // modular cable stubs on the front face
    for (let i = 0; i < 4; i++) {
      const c = box(0.16, 0.12, 0.1, 0x0f1318, { roughness: 0.9, metalness: 0.1 });
      c.position.set(-0.65 + i * 0.32, -HY + 0.55, HZ - 1.95);
      g.add(c);
    }

    register(g);
  }

  /* label anchors, in world space at rest */
  const ANCHORS = {
    chassis: new THREE.Vector3(0.4, 2.85, -2.3),
    pool:    new THREE.Vector3(0.45, -0.5, -HZ + 1.45),
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

  const HOME = { radius: 12.6, theta: 0.72, phi: 1.17 };
  const ctl = {
    target: new THREE.Vector3(0, -0.05, 0),
    radius: HOME.radius, theta: HOME.theta, phi: HOME.phi,
    rT: HOME.radius, thT: HOME.theta, phT: HOME.phi,
    minR: 4.2, maxR: 26,
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
    // prefer an interior part over the surrounding chassis shell / shroud / cover plate
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
