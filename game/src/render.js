// The 3D view: a dusk city in three.js. This file builds the scene once from
// the world data, then every frame moves the meshes to match the game state
// and flies the chase camera behind Jax. All art is procedural — boxes, canvas
// window textures and emissive neon — nothing is loaded from outside game/.

import * as THREE from 'three';
import { AVENUES, BEACH_Z, ROAD_HALF, SEA_Z, STREETS, WORLD } from './config.js';
import { makeRandom } from './random.js';

const SUNSET = new THREE.Color('#ff7a3c');

/** A canvas texture of lit windows for one building face. */
function windowTexture(variant, color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 256);
  const rnd = makeRandom(1000 + variant * 77);
  for (let y = 10; y < 246; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rnd.chance(0.62);
      g.fillStyle = lit ? (rnd.chance(0.7) ? '#ffd98a' : '#9fd8ff') : '#20202e';
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A canvas texture with a neon sign's text on it. */
function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0a18';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts }),
  );
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/** A low-poly car: body, cabin, wheels, lights. */
function carMesh(color, police = false) {
  const g = new THREE.Group();
  const body = box(2.1, 0.75, 4.4, police ? '#e8ecf2' : color);
  body.position.y = 0.55;
  g.add(body);
  const cabin = box(1.8, 0.65, 2.2, '#1a2030', { roughness: 0.3, metalness: 0.4 });
  cabin.position.set(0, 1.2, -0.2);
  g.add(cabin);
  if (police) {
    const stripe = box(2.12, 0.3, 4.42, '#1d3fae');
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#14141a', roughness: 0.95 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff6c9', emissive: '#ffedb0', emissiveIntensity: 1.6 });
  for (const hx of [-0.7, 0.7]) {
    const h = box(0.35, 0.18, 0.1, '#fff6c9', { emissive: '#ffedb0', emissiveIntensity: 1.6 });
    h.position.set(hx, 0.6, 2.22);
    g.add(h);
    void headMat;
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff2e2e', emissive: '#ff2e2e', emissiveIntensity: 1.2 });
  for (const tx of [-0.7, 0.7]) {
    const t = box(0.35, 0.16, 0.1, '#ff2e2e', { emissive: '#ff2e2e', emissiveIntensity: 1.2 });
    t.position.set(tx, 0.62, -2.22);
    g.add(t);
    void tailMat;
  }
  if (police) {
    const bar = new THREE.Group();
    const red = box(0.5, 0.18, 0.3, '#ff2e2e', { emissive: '#ff2e2e', emissiveIntensity: 2 });
    red.position.x = -0.35;
    const blue = box(0.5, 0.18, 0.3, '#2e7dff', { emissive: '#2e7dff', emissiveIntensity: 2 });
    blue.position.x = 0.35;
    bar.add(red, blue);
    bar.position.set(0, 1.62, -0.2);
    bar.name = 'lightbar';
    g.add(bar);
  }
  return g;
}

/** A person on foot: jacket, head, legs that swing while walking. */
function personMesh(jacket) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.05, 8),
    new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.9 }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#d9a06b', roughness: 0.8 }),
  );
  head.position.y = 1.72;
  g.add(head);
  const legMat = new THREE.MeshStandardMaterial({ color: '#23232e', roughness: 0.9 });
  for (const lx of [-0.16, 0.16]) {
    const leg = box(0.22, 0.75, 0.24, '#23232e');
    leg.position.set(lx, 0.38, 0);
    leg.name = lx < 0 ? 'legL' : 'legR';
    g.add(leg);
    void legMat;
  }
  return g;
}

export function createRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(1280, 720, false);
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b1e4e');
  scene.fog = new THREE.Fog('#40305f', 220, 1000);

  const hemi = new THREE.HemisphereLight('#8a7bd8', '#3a2f28', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffb36b', 2.3);
  sun.position.set(-600, 180, -300);
  scene.add(sun);
  const amb = new THREE.AmbientLight('#40355e', 1.05);
  scene.add(amb);

  // The low sun on the north-western horizon, in frame on northbound runs.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: SUNSET, fog: false }),
  );
  sunDisc.position.set(-500, 120, -900);
  sunDisc.lookAt(0, 60, 0);
  scene.add(sunDisc);

  // Ground: city asphalt, beach sand, and the sea beyond it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, BEACH_Z - WORLD.minZ),
    new THREE.MeshStandardMaterial({ color: '#464354', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (BEACH_Z + WORLD.minZ) / 2);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, SEA_Z - BEACH_Z),
    new THREE.MeshStandardMaterial({ color: '#d9b380', roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, (SEA_Z + BEACH_Z) / 2);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, 700),
    new THREE.MeshStandardMaterial({ color: '#1d6f8e', roughness: 0.25, metalness: 0.4 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, SEA_Z + 350);
  scene.add(sea);

  // Roads: dark strips with a dashed centre line and crosswalks.
  const roadMat = new THREE.MeshStandardMaterial({ color: '#31343e', roughness: 1 });
  const lineMat = new THREE.MeshBasicMaterial({ color: '#d8c25a' });
  const walkMat = new THREE.MeshBasicMaterial({ color: '#cfc8bd' });
  function roadStrip(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.08, z);
    scene.add(m);
  }
  for (const ax of AVENUES) {
    roadStrip(ax, 0, ROAD_HALF * 2, WORLD.maxZ - WORLD.minZ);
    for (let z = WORLD.minZ + 40; z < WORLD.maxZ - 20; z += 44) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 18), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(ax, 0.12, z);
      scene.add(dash);
    }
  }
  for (const sz of STREETS) {
    roadStrip(0, sz, WORLD.maxX - WORLD.minX, ROAD_HALF * 2);
    for (let x = WORLD.minX + 40; x < WORLD.maxX - 20; x += 44) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.7), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.12, sz);
      scene.add(dash);
    }
  }
  for (const ax of AVENUES) {
    for (const sz of STREETS) {
      for (let i = -2; i <= 2; i += 1) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 8), walkMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(ax + i * 5, 0.11, sz - ROAD_HALF - 4);
        scene.add(stripe);
      }
    }
  }

  // Buildings with lit windows, rooftop boxes, and the odd neon sign.
  const winTex = [0, 1, 2, 3].map((v) => windowTexture(v, '#4b4365'));
  const buildingMeshes = [];
  for (const b of world.buildings) {
    const mat = new THREE.MeshStandardMaterial({
      map: winTex[b.variant % winTex.length], color: b.color, roughness: 0.9,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);
    buildingMeshes.push(mesh);
    if (b.roof) {
      const roof = box(Math.min(10, b.w * 0.3), 3, Math.min(10, b.d * 0.3), '#3a3348');
      roof.position.set(b.x - b.w * 0.2, b.h + 1.5, b.z + b.d * 0.15);
      scene.add(roof);
    }
  }
  for (const s of world.signs) {
    const tex = signTexture(s.text, s.color);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 5.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    sign.position.set(s.x, s.y, s.z);
    scene.add(sign);
  }

  // Palms and lamps.
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: '#2f7d4f', roughness: 1 });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.6, metalness: 0.5 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffdf8a', emissiveIntensity: 2 });
  for (const p of world.palms) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * p.s, 0.55 * p.s, 9 * p.s, 6), trunkMat);
    trunk.position.set(p.x, 4.5 * p.s, p.z);
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.4 * p.s, 4.5 * p.s, 7), crownMat);
    crown.position.set(p.x, 10.5 * p.s, p.z);
    scene.add(crown);
  }
  for (const l of world.lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 6), lampPoleMat);
    pole.position.set(l.x, 3.5, l.z);
    scene.add(pole);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlowMat);
    glow.position.set(l.x, 7.1, l.z);
    scene.add(glow);
  }

  // The marina dock and the escape boat.
  const dock = box(90, 1.2, 26, '#5a4632');
  dock.position.set(1180, 0.6, 640);
  scene.add(dock);
  const boat = new THREE.Group();
  const hull = box(6, 2.2, 16, '#e8ecf2');
  hull.position.y = 1.1;
  boat.add(hull);
  const cabinB = box(4, 1.8, 6, '#1d3fae');
  cabinB.position.set(0, 3, -1);
  boat.add(cabinB);
  boat.position.set(1180, 0.4, 700);
  boat.rotation.y = Math.PI / 2;
  scene.add(boat);

  // The mission beacon: a shaft of light and a floating diamond.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 160, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 80;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.4),
    new THREE.MeshStandardMaterial({ color: '#ffd23c', emissive: '#ffbf00', emissiveIntensity: 1.4 }),
  );
  diamond.position.y = 14;
  scene.add(diamond);

  // Headlights for the player's car: one real spotlight, switched on at dusk.
  const headlight = new THREE.SpotLight('#ffe9a8', 90, 90, 0.5, 0.5, 1.2);
  headlight.position.set(0, 1.4, 2);
  const headTarget = new THREE.Object3D();
  headTarget.position.set(0, 0, 30);
  scene.add(headTarget);
  headlight.target = headTarget;

  // The helicopter's searchlight.
  const search = new THREE.SpotLight('#fff6c9', 160, 140, 0.32, 0.45, 1);
  const searchTarget = new THREE.Object3D();
  scene.add(searchTarget);
  search.target = searchTarget;
  const searchCone = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff6c9', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(searchCone);

  // Particles: one THREE.Points cloud, refilled every frame from game.particles.
  const MAXP = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 3000);
  const camPos = new THREE.Vector3(0, 40, -80);
  const camLook = new THREE.Vector3(0, 0, 0);

  // One mesh per entity and kind, keyed by the entity object itself: the
  // player switches between a figure and a car, so the kind is part of the key.
  // Every mesh created here is registered, so the frame can hide the ones its
  // entity no longer uses (a driven car, a removed pedestrian, a dead cruiser).
  const meshes = new Map();
  const allMeshes = new Set();
  function meshFor(entity, kind, color) {
    let byKind = meshes.get(entity);
    if (!byKind) {
      byKind = new Map();
      meshes.set(entity, byKind);
    }
    let m = byKind.get(kind);
    if (!m) {
      if (kind === 'car') m = carMesh(color, false);
      else if (kind === 'police') m = carMesh(color, true);
      else if (kind === 'interceptor') {
        m = carMesh('#15161c', true);
      } else if (kind === 'tank') {
        m = new THREE.Group();
        const hull = box(3.4, 1.4, 5.6, '#4c5a3c');
        hull.position.y = 0.9;
        m.add(hull);
        const turret = box(2, 0.9, 2.6, '#3d4a30');
        turret.position.set(0, 1.9, -0.3);
        turret.name = 'turret';
        m.add(turret);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 8), new THREE.MeshStandardMaterial({ color: '#2c3524' }));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 1.9, 2.4);
        barrel.name = 'barrel';
        m.add(barrel);
      } else if (kind === 'heli') {
        m = new THREE.Group();
        const body = box(2.4, 1.8, 6.5, '#2e3442');
        body.position.y = 0;
        m.add(body);
        const tail = box(0.7, 0.7, 5, '#2e3442');
        tail.position.set(0, 0.3, -5);
        m.add(tail);
        const beaconLight = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: '#ff2e2e', emissive: '#ff2e2e', emissiveIntensity: 3 }),
        );
        beaconLight.position.set(0, 1.1, 0);
        beaconLight.name = 'beaconLight';
        m.add(beaconLight);
        const rotor = box(11, 0.12, 0.5, '#14161c');
        rotor.position.y = 1.15;
        rotor.name = 'rotor';
        m.add(rotor);
        const skids = box(2.6, 0.15, 4.5, '#14161c');
        skids.position.y = -1.15;
        m.add(skids);
      } else if (kind === 'person') {
        m = personMesh(color);
      } else if (kind === 'shell') {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 10, 8),
          new THREE.MeshStandardMaterial({ color: '#ffcf3d', emissive: '#ff9a00', emissiveIntensity: 3 }),
        );
      }
      byKind.set(kind, m);
      allMeshes.add(m);
      scene.add(m);
    }
    return m;
  }

  function place(mesh, x, y, z, angle) {
    mesh.position.set(x, y, z);
    mesh.rotation.y = angle;
  }

  let walkPhase = 0;

  return {
    /** Draw one frame from the game state. */
    render(game, dt) {
      const p = game.player.state;
      const px = p.x;
      const pz = p.z;
      const seen = new Set();
      // The player: a walking figure on foot, a car mesh when driving.
      const playerMesh = meshFor(p, p.onFoot ? 'person' : 'car', '#ffcf3d');
      seen.add(playerMesh);
      if (p.onFoot) {
        place(playerMesh, px, 0, pz, p.angle);
        walkPhase += dt * (p.speed > 0.5 ? 9 : 0);
        const legL = playerMesh.getObjectByName('legL');
        const legR = playerMesh.getObjectByName('legR');
        if (legL) legL.rotation.x = Math.sin(walkPhase) * 0.6;
        if (legR) legR.rotation.x = -Math.sin(walkPhase) * 0.6;
      } else {
        place(playerMesh, px, 0, pz, p.angle);
      }
      // Headlights follow the player's car.
      if (!p.onFoot && p.car) {
        if (!headlight.parent) scene.add(headlight);
        headlight.position.set(px + Math.sin(p.angle) * 2, 1.4, pz + Math.cos(p.angle) * 2);
        headTarget.position.set(px + Math.sin(p.angle) * 30, 0, pz + Math.cos(p.angle) * 30);
        headTarget.updateMatrixWorld();
      } else if (headlight.parent) {
        scene.remove(headlight);
      }
      for (const car of game.traffic.cars) {
        if (car.driven) continue;
        const m = meshFor(car, 'car', car.color);
        place(m, car.x, 0, car.z, car.angle);
        seen.add(m);
      }
      for (const ped of game.traffic.peds) {
        const m = meshFor(ped, 'person', ped.color);
        place(m, ped.x, 0, ped.z, ped.angle);
        seen.add(m);
      }
      for (const c of game.police.state.cruisers) {
        const m = meshFor(c, c.type === 'interceptor' ? 'interceptor' : 'police', '#e8ecf2');
        place(m, c.x, 0, c.z, c.angle);
        seen.add(m);
        const bar = m.getObjectByName('lightbar');
        if (bar) {
          bar.children[0].material.emissiveIntensity = Math.sin(c.lightPhase) > 0 ? 2.4 : 0.2;
          bar.children[1].material.emissiveIntensity = Math.sin(c.lightPhase) > 0 ? 0.2 : 2.4;
        }
      }
      const heli = game.police.state.heli;
      if (heli) {
        const m = meshFor(heli, 'heli', '#20242e');
        place(m, heli.x, heli.y, heli.z, heli.angle);
        seen.add(m);
        const rotor = m.getObjectByName('rotor');
        if (rotor) rotor.rotation.y = heli.rotor;
        search.position.set(heli.x, heli.y - 1, heli.z);
        searchTarget.position.set(px, 0, pz);
        searchTarget.updateMatrixWorld();
        // The shaft: apex at the helicopter, base on the ground at the player.
        const coneDir = new THREE.Vector3(heli.x - px, heli.y, heli.z - pz);
        const coneLen = coneDir.length();
        searchCone.position.set((heli.x + px) / 2, heli.y / 2, (heli.z + pz) / 2);
        searchCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), coneDir.normalize());
        searchCone.scale.set(1, Math.max(0.5, coneLen / 60), 1);
        searchCone.visible = true;
        search.visible = true;
      } else {
        search.visible = false;
        searchCone.visible = false;
      }
      const tank = game.police.state.tank;
      if (tank) {
        const m = meshFor(tank, 'tank', '#4c5a3c');
        place(m, tank.x, 0, tank.z, tank.angle);
        seen.add(m);
        const turret = m.getObjectByName('turret');
        if (turret) turret.rotation.y = tank.turret - tank.angle;
      }
      // Shells are small glowing spheres.
      for (const s of game.police.state.shells) {
        const m = meshFor(s, 'shell', '#ffcf3d');
        place(m, s.x, s.y, s.z, 0);
        seen.add(m);
      }
      // Hide every entity mesh this frame did not use.
      for (const m of allMeshes) m.visible = seen.has(m);
      // The mission beacon and its diamond hover over the target.
      const target = game.missions.target();
      if (target) {
        beacon.visible = true;
        diamond.visible = true;
        beacon.position.set(target.x, 80, target.z);
        diamond.position.set(target.x, 14 + Math.sin(game.time * 2) * 1.2, target.z);
        diamond.rotation.y = game.time * 1.5;
      } else {
        beacon.visible = false;
        diamond.visible = false;
      }
      // Particles: smoke, sparks and explosion fire.
      let pi = 0;
      for (const pt of game.particles) {
        if (pi >= MAXP) break;
        pPos[pi * 3] = pt.x;
        pPos[pi * 3 + 1] = pt.y;
        pPos[pi * 3 + 2] = pt.z;
        const c = new THREE.Color(pt.color);
        pCol[pi * 3] = c.r;
        pCol[pi * 3 + 1] = c.g;
        pCol[pi * 3 + 2] = c.b;
        pi += 1;
      }
      pGeo.setDrawRange(0, pi);
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      // The chase camera: behind and above, eased, with a shake on impacts.
      const dist = p.onFoot ? 10 : 15;
      const height = p.onFoot ? 5 : 6.5;
      const fx = Math.sin(p.angle);
      const fz = Math.cos(p.angle);
      const wantX = px - fx * dist;
      const wantY = height;
      const wantZ = pz - fz * dist;
      const k = Math.min(1, dt * 5);
      camPos.x += (wantX - camPos.x) * k;
      camPos.y += (wantY - camPos.y) * k;
      camPos.z += (wantZ - camPos.z) * k;
      const shake = game.camera.shake;
      camera.position.set(
        camPos.x + (Math.random() - 0.5) * shake,
        camPos.y + (Math.random() - 0.5) * shake * 0.5,
        camPos.z + (Math.random() - 0.5) * shake,
      );
      camLook.set(px + fx * 9, 1.6, pz + fz * 9);
      camera.lookAt(camLook);
      camera.fov = 62 + Math.min(10, Math.abs(p.speed) * 0.35);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
  };
}
