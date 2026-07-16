/* Block World — a tiny Minecraft-style game in one file.
   Runs completely offline: just open index.html in a browser. */

(function () {
  "use strict";

  // ---------------------------------------------------------------- world size
  const WX = 128, WY = 40, WZ = 128;   // world dimensions in blocks
  const WATER_LEVEL = 12;

  // ---------------------------------------------------------------- block types
  const AIR = 0;
  const BLOCKS = {
    1: { name: "Grass",  color: 0x5dbb46, solid: true },
    2: { name: "Dirt",   color: 0x9b6a3d, solid: true },
    3: { name: "Stone",  color: 0x8f8f8f, solid: true },
    4: { name: "Sand",   color: 0xf2e2a0, solid: true },
    5: { name: "Wood",   color: 0x7a5230, solid: true },
    6: { name: "Leaves", color: 0x2e9e3e, solid: true },
    7: { name: "Planks", color: 0xc9a05a, solid: true },
    8: { name: "Brick",  color: 0xc4574d, solid: true },
    9: { name: "Water",  color: 0x3f76e4, solid: false, water: true },
    10: { name: "Craft Table", color: 0xa97d4b, solid: true, craftTable: true },
  };
  const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8, 10]; // placeable blocks on keys 1-9

  const world = new Uint8Array(WX * WY * WZ);
  const idx = (x, y, z) => (y * WZ + z) * WX + x;
  const inWorld = (x, y, z) => x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ;
  const getBlock = (x, y, z) => (inWorld(x, y, z) ? world[idx(x, y, z)] : AIR);
  const setBlock = (x, y, z, t) => { if (inWorld(x, y, z)) world[idx(x, y, z)] = t; };
  const isSolid = (x, y, z) => {
    const b = getBlock(x, y, z);
    return b !== AIR && BLOCKS[b].solid;
  };
  const isWater = (x, y, z) => getBlock(x, y, z) === 9;

  // ---------------------------------------------------------------- world generation
  function makeRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // smooth 2D value noise built from a seeded grid
  function makeNoise(seed) {
    const rand = makeRandom(seed);
    const N = 32;
    const grid = [];
    for (let i = 0; i < (N + 1) * (N + 1); i++) grid.push(rand());
    const smooth = t => t * t * (3 - 2 * t);
    return function (x, z) {
      const gx = Math.floor(x), gz = Math.floor(z);
      const fx = smooth(x - gx), fz = smooth(z - gz);
      const g = (a, b) => grid[((b % (N + 1)) * (N + 1)) + (a % (N + 1))];
      const v00 = g(gx, gz),     v10 = g(gx + 1, gz);
      const v01 = g(gx, gz + 1), v11 = g(gx + 1, gz + 1);
      return (v00 * (1 - fx) + v10 * fx) * (1 - fz) +
             (v01 * (1 - fx) + v11 * fx) * fz;
    };
  }

  function generateWorld(seed) {
    world.fill(AIR);
    const noiseBig = makeNoise(seed);
    const noiseSmall = makeNoise(seed + 999);
    const rand = makeRandom(seed + 12345);

    for (let x = 0; x < WX; x++) {
      for (let z = 0; z < WZ; z++) {
        const n = noiseBig(x / 22, z / 22) * 0.75 + noiseSmall(x / 7, z / 7) * 0.25;
        const height = Math.floor(8 + n * 14); // ground height 8..22
        for (let y = 0; y <= height; y++) {
          let t;
          if (y === height) t = height <= WATER_LEVEL + 1 ? 4 : 1; // sand near water, else grass
          else if (y >= height - 3) t = 2;                          // dirt
          else t = 3;                                               // stone
          setBlock(x, y, z, t);
        }
        for (let y = height + 1; y <= WATER_LEVEL; y++) setBlock(x, y, z, 9); // water fills valleys
      }
    }

    // trees
    for (let i = 0; i < 110; i++) {
      const x = 3 + Math.floor(rand() * (WX - 6));
      const z = 3 + Math.floor(rand() * (WZ - 6));
      let top = -1;
      for (let y = WY - 1; y >= 0; y--) {
        if (getBlock(x, y, z) !== AIR) { top = y; break; }
      }
      if (top < 0 || getBlock(x, top, z) !== 1) continue; // only on grass
      const trunkH = 3 + Math.floor(rand() * 3);
      for (let y = 1; y <= trunkH; y++) setBlock(x, top + y, z, 5);
      const ly = top + trunkH;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = 0; dy <= 2; dy++) {
            const d = Math.abs(dx) + Math.abs(dz) + dy;
            if (d > 3 && !(dy === 0 && d <= 4)) continue;
            if (dx === 0 && dz === 0 && dy < 2) continue; // keep trunk visible
            if (getBlock(x + dx, ly + dy, z + dz) === AIR)
              setBlock(x + dx, ly + dy, z + dz, 6);
          }
        }
      }
    }
  }

  function groundHeight(x, z) {
    for (let y = WY - 1; y >= 0; y--) if (isSolid(x, y, z)) return y;
    return 0;
  }

  // ---------------------------------------------------------------- save / load
  const SAVE_KEY = "blockworld-save-v2"; // v2: world grew to 128x128

  function saveWorld() {
    try {
      let bin = "";
      for (let i = 0; i < world.length; i += 8192)
        bin += String.fromCharCode.apply(null, world.subarray(i, i + 8192));
      localStorage.setItem(SAVE_KEY, btoa(bin));
    } catch (e) { /* storage may be unavailable on file:// in some browsers */ }
  }

  function loadWorld() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      if (!data) return false;
      const bin = atob(data);
      if (bin.length !== world.length) return false;
      for (let i = 0; i < bin.length; i++) world[i] = bin.charCodeAt(i);
      return true;
    } catch (e) { return false; }
  }

  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWorld, 800);
  }

  // ---------------------------------------------------------------- three.js scene
  const canvas = document.getElementById("game");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 140);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 300);

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(0.6, 1, 0.4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------------------------------------------------------------- world meshing
  // One InstancedMesh per block type, holding every block that touches air.
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);

  // pixel-art texture for the crafting table: planks, a 2x2 grid top, tool marks
  function makeCraftTableTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#a97d4b";                   // planks
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#8a6238";                   // plank seams
    for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = "#5d3f1f";                   // dark border
    ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 14, 16, 2);
    ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16);
    ctx.fillStyle = "#5d3f1f";                   // 2x2 crafting grid
    ctx.fillRect(4, 4, 8, 1); ctx.fillRect(4, 11, 8, 1);
    ctx.fillRect(4, 4, 1, 8); ctx.fillRect(11, 4, 1, 8);
    ctx.fillRect(7, 4, 1, 8); ctx.fillRect(4, 7, 8, 1);
    ctx.fillStyle = "#c0392b";                   // little tool marks
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillStyle = "#95a5a6";
    ctx.fillRect(9, 8, 2, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  const materials = {};
  for (const t in BLOCKS) {
    const b = BLOCKS[t];
    if (b.water)
      materials[t] = new THREE.MeshLambertMaterial({ color: b.color, transparent: true, opacity: 0.65 });
    else if (b.craftTable)
      materials[t] = new THREE.MeshLambertMaterial({ map: makeCraftTableTexture() });
    else
      materials[t] = new THREE.MeshLambertMaterial({ color: b.color });
  }
  let typeMeshes = {};

  function isExposed(x, y, z) {
    return !isSolidOrWater(x + 1, y, z) || !isSolidOrWater(x - 1, y, z) ||
           !isSolidOrWater(x, y + 1, z) || !isSolidOrWater(x, y - 1, z) ||
           !isSolidOrWater(x, y, z + 1) || !isSolidOrWater(x, y, z - 1);
  }
  function isSolidOrWater(x, y, z) {
    if (!inWorld(x, y, z)) return false;
    return world[idx(x, y, z)] !== AIR;
  }

  function rebuildWorldMesh() {
    for (const t in typeMeshes) {
      scene.remove(typeMeshes[t]);
      typeMeshes[t].dispose();
    }
    typeMeshes = {};

    const positions = {};
    for (let y = 0; y < WY; y++) {
      for (let z = 0; z < WZ; z++) {
        for (let x = 0; x < WX; x++) {
          const t = world[idx(x, y, z)];
          if (t === AIR || !isExposed(x, y, z)) continue;
          (positions[t] || (positions[t] = [])).push(x, y, z);
        }
      }
    }

    const m4 = new THREE.Matrix4();
    for (const t in positions) {
      const pts = positions[t];
      const mesh = new THREE.InstancedMesh(cubeGeo, materials[t], pts.length / 3);
      for (let i = 0; i < pts.length; i += 3) {
        m4.makeTranslation(pts[i] + 0.5, pts[i + 1] + 0.5, pts[i + 2] + 0.5);
        mesh.setMatrixAt(i / 3, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      typeMeshes[t] = mesh;
    }
  }

  // highlight box around the block you are looking at
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    new THREE.LineBasicMaterial({ color: 0x111111 })
  );
  highlight.visible = false;
  scene.add(highlight);

  // ---------------------------------------------------------------- player
  const player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    onGround: false,
    width: 0.6, height: 1.8, eye: 1.6,
  };

  function spawnPlayer() {
    const x = WX / 2, z = WZ / 2;
    player.pos.set(x + 0.5, groundHeight(x, z) + 2, z + 0.5);
    player.vel.set(0, 0, 0);
    player.yaw = Math.PI * 0.25;
    player.pitch = 0;
    updateCamera();
  }

  function updateCamera() {
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(-player.yaw);
    camera.rotateX(-player.pitch);
  }

  function collides(px, py, pz) {
    const hw = player.width / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
    const y0 = Math.floor(py),      y1 = Math.floor(py + player.height);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (isSolid(x, y, z)) return true;
    return false;
  }

  function bodyInWater() {
    const p = player.pos;
    return isWater(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) ||
           isWater(Math.floor(p.x), Math.floor(p.y + 1.0), Math.floor(p.z));
  }

  const keys = {};
  const GRAVITY = 26, JUMP = 9, SPEED = 5.4;

  function updatePlayer(dt) {
    const inWater = bodyInWater();

    // walk direction from keys, relative to where we look
    let mx = 0, mz = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) mz -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) mz += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    const speed = inWater ? SPEED * 0.6 : SPEED;
    player.vel.x = (mx * cos - mz * sin) * speed;
    player.vel.z = (mx * sin + mz * cos) * speed;

    // gravity, jumping, swimming
    player.vel.y -= GRAVITY * dt;
    if (inWater) {
      player.vel.y = Math.max(player.vel.y, -3);       // sink slowly
      if (keys["Space"]) player.vel.y = 4;             // swim up
    } else if (keys["Space"] && player.onGround) {
      player.vel.y = JUMP;
    }

    // move one axis at a time so we can slide along walls
    const p = player.pos;
    let nx = p.x + player.vel.x * dt;
    if (!collides(nx, p.y, p.z)) p.x = nx; else player.vel.x = 0;

    let nz = p.z + player.vel.z * dt;
    if (!collides(p.x, p.y, nz)) p.z = nz; else player.vel.z = 0;

    let ny = p.y + player.vel.y * dt;
    player.onGround = false;
    if (!collides(p.x, ny, p.z)) {
      p.y = ny;
    } else {
      if (player.vel.y < 0) player.onGround = true;
      player.vel.y = 0;
    }

    // fell off the world? pop back to the top
    if (p.y < -12) spawnPlayer();

    updateCamera();
  }

  // ---------------------------------------------------------------- animals
  const animals = [];

  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    m.position.set(x, y, z);
    return m;
  }

  // Each builder returns { group, legs } with the animal facing +Z.
  function buildPig() {
    const g = new THREE.Group();
    const pink = 0xf0a0a8, dark = 0xd97f8a;
    g.add(box(0.6, 0.5, 0.9, pink, 0, 0.55, 0));          // body
    g.add(box(0.45, 0.42, 0.35, pink, 0, 0.72, 0.6));     // head
    g.add(box(0.2, 0.14, 0.08, dark, 0, 0.66, 0.8));      // snout
    const legs = [
      box(0.16, 0.35, 0.16, dark, -0.2, 0.18, 0.3),
      box(0.16, 0.35, 0.16, dark, 0.2, 0.18, 0.3),
      box(0.16, 0.35, 0.16, dark, -0.2, 0.18, -0.3),
      box(0.16, 0.35, 0.16, dark, 0.2, 0.18, -0.3),
    ];
    legs.forEach(l => g.add(l));
    return { group: g, legs };
  }

  function buildSheep() {
    const g = new THREE.Group();
    const wool = 0xf5f5f0, skin = 0xcfae95;
    g.add(box(0.7, 0.6, 1.0, wool, 0, 0.75, 0));          // fluffy body
    g.add(box(0.35, 0.38, 0.35, skin, 0, 0.95, 0.62));    // head
    g.add(box(0.42, 0.25, 0.25, wool, 0, 1.1, 0.55));     // wool hat
    const legs = [
      box(0.15, 0.45, 0.15, skin, -0.22, 0.23, 0.33),
      box(0.15, 0.45, 0.15, skin, 0.22, 0.23, 0.33),
      box(0.15, 0.45, 0.15, skin, -0.22, 0.23, -0.33),
      box(0.15, 0.45, 0.15, skin, 0.22, 0.23, -0.33),
    ];
    legs.forEach(l => g.add(l));
    return { group: g, legs };
  }

  function buildChicken() {
    const g = new THREE.Group();
    const white = 0xfafafa, beak = 0xf2a71b, comb = 0xe04b3f, leg = 0xf2a71b;
    g.add(box(0.35, 0.35, 0.5, white, 0, 0.42, 0));       // body
    g.add(box(0.25, 0.3, 0.25, white, 0, 0.7, 0.28));     // head
    g.add(box(0.1, 0.08, 0.12, beak, 0, 0.68, 0.45));     // beak
    g.add(box(0.08, 0.1, 0.12, comb, 0, 0.87, 0.28));     // comb
    const legs = [
      box(0.07, 0.25, 0.07, leg, -0.09, 0.12, 0),
      box(0.07, 0.25, 0.07, leg, 0.09, 0.12, 0),
    ];
    legs.forEach(l => g.add(l));
    return { group: g, legs };
  }

  function buildVillager() {
    const robes = [0x7a5b3a, 0x5b7a3a, 0x6a4a7a];
    const robe = robes[Math.floor(Math.random() * robes.length)];
    const skin = 0xd8a77b, hair = 0x4a3320;
    const g = new THREE.Group();
    g.add(box(0.5, 0.95, 0.3, robe, 0, 0.48, 0));         // robe
    g.add(box(0.4, 0.4, 0.4, skin, 0, 1.16, 0));          // head
    g.add(box(0.09, 0.22, 0.09, skin, 0, 1.06, 0.22));    // the big nose
    g.add(box(0.42, 0.1, 0.42, hair, 0, 1.4, 0));         // hair
    const arms = [                                        // arms swing like legs
      box(0.13, 0.55, 0.13, robe, -0.32, 0.65, 0),
      box(0.13, 0.55, 0.13, robe, 0.32, 0.65, 0),
    ];
    arms.forEach(a => g.add(a));
    return { group: g, legs: arms };
  }

  const ANIMAL_KINDS = [buildPig, buildSheep, buildChicken, buildChicken, buildVillager];

  function spawnAnimals(count) {
    for (const a of animals) scene.remove(a.group);
    animals.length = 0;
    const rand = makeRandom(Math.floor(Math.random() * 1e9));
    let tries = 0;
    while (animals.length < count && tries++ < count * 30) {
      const x = 4 + Math.floor(rand() * (WX - 8));
      const z = 4 + Math.floor(rand() * (WZ - 8));
      const gy = groundHeight(x, z);
      if (getBlock(x, gy, z) !== 1) continue;            // only on grass
      const kind = ANIMAL_KINDS[Math.floor(rand() * ANIMAL_KINDS.length)]();
      kind.group.position.set(x + 0.5, gy + 1, z + 0.5);
      scene.add(kind.group);
      animals.push({
        group: kind.group, legs: kind.legs,
        yaw: rand() * Math.PI * 2,
        speed: 0, vy: 0,
        timer: rand() * 4,
        walkPhase: rand() * 10,
      });
    }
  }

  function updateAnimals(dt, time) {
    for (const a of animals) {
      // every few seconds: pick a new plan (wander or rest)
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 1.5 + Math.random() * 4;
        if (Math.random() < 0.55) {
          a.yaw = Math.random() * Math.PI * 2;
          a.speed = 1.1;
        } else {
          a.speed = 0;
        }
      }

      const p = a.group.position;
      if (a.speed > 0) {
        const nx = p.x + Math.sin(a.yaw) * a.speed * dt;
        const nz = p.z + Math.cos(a.yaw) * a.speed * dt;
        const bx = Math.floor(nx), bz = Math.floor(nz);
        const gy = groundHeight(bx, bz);
        const stepOk = inWorld(bx, 0, bz) &&
                       Math.abs((gy + 1) - p.y) <= 1.05 &&
                       !isWater(bx, gy + 1, bz);
        if (stepOk) {
          p.x = nx; p.z = nz;
        } else {
          a.yaw += Math.PI * (0.5 + Math.random());       // blocked: turn away
          a.timer = Math.min(a.timer, 1);
        }
      }

      // stick to the ground (falls if you dig it away, rises if you build)
      const gy = groundHeight(Math.floor(p.x), Math.floor(p.z)) + 1;
      if (p.y > gy + 0.01) {
        a.vy -= GRAVITY * dt;
        p.y = Math.max(p.y + a.vy * dt, gy);
      } else {
        p.y = gy;
        a.vy = 0;
      }

      // face where it walks, waddle the legs
      a.group.rotation.y = a.yaw;
      if (a.speed > 0 && p.y === gy) {
        a.walkPhase += dt * 9;
        a.legs.forEach((l, i) => {
          l.rotation.x = Math.sin(a.walkPhase + (i % 2) * Math.PI) * 0.6;
        });
      } else {
        a.legs.forEach(l => { l.rotation.x *= 0.8; });
      }
    }
  }

  // click an animal to make it hop!
  const animalRay = new THREE.Raycaster();
  function pokeAnimal() {
    animalRay.setFromCamera(new THREE.Vector2(0, 0), camera);
    animalRay.far = 6;
    for (const a of animals) {
      if (animalRay.intersectObject(a.group, true).length > 0) {
        a.vy = 0;
        a.group.position.y += 0.02;                       // lift off the ground
        a.vy = 6;                                         // hop!
        blip(700, 0.12);
        setTimeout(() => blip(880, 0.1), 90);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- block targeting (voxel raycast)
  function raycastBlock(maxDist) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const pos = camera.position.clone();
    let x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    const frac = (v) => v - Math.floor(v);
    let tMaxX = dir.x > 0 ? (1 - frac(pos.x)) * tDeltaX : frac(pos.x) * tDeltaX;
    let tMaxY = dir.y > 0 ? (1 - frac(pos.y)) * tDeltaY : frac(pos.y) * tDeltaY;
    let tMaxZ = dir.z > 0 ? (1 - frac(pos.z)) * tDeltaZ : frac(pos.z) * tDeltaZ;
    let face = [0, 0, 0];

    for (let i = 0; i < 128; i++) {
      const b = getBlock(x, y, z);
      if (b !== AIR && !BLOCKS[b].water) {
        return { x, y, z, face };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        if (tMaxX > maxDist) break;
        x += stepX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        if (tMaxY > maxDist) break;
        y += stepY; tMaxY += tDeltaY; face = [0, -stepY, 0];
      } else {
        if (tMaxZ > maxDist) break;
        z += stepZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
      }
    }
    return null;
  }

  function placeWouldTouchPlayer(x, y, z) {
    const hw = player.width / 2, p = player.pos;
    return x + 1 > p.x - hw && x < p.x + hw &&
           y + 1 > p.y      && y < p.y + player.height &&
           z + 1 > p.z - hw && z < p.z + hw;
  }

  // ---------------------------------------------------------------- tiny sound effects
  let audioCtx = null;
  function blip(freq, duration) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + duration);
    } catch (e) { /* sound is optional */ }
  }

  // ---------------------------------------------------------------- hotbar UI
  let selected = 0;
  const hotbarEl = document.getElementById("hotbar");
  const toastEl = document.getElementById("toast");
  let toastTimer = null;

  function buildHotbar() {
    hotbarEl.innerHTML = "";
    HOTBAR.forEach((t, i) => {
      const slot = document.createElement("div");
      slot.className = "slot" + (i === selected ? " selected" : "");
      const cube = document.createElement("div");
      cube.className = "cube";
      cube.style.background = "#" + BLOCKS[t].color.toString(16).padStart(6, "0");
      const label = document.createElement("div");
      label.textContent = BLOCKS[t].name;
      const num = document.createElement("div");
      num.className = "num";
      num.textContent = i + 1;
      slot.appendChild(cube);
      slot.appendChild(label);
      hotbarEl.appendChild(slot);
    });
  }

  function selectSlot(i) {
    selected = ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
    buildHotbar();
    toast(BLOCKS[HOTBAR[selected]].name);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = "none"; }, 1200);
  }

  // ---------------------------------------------------------------- input
  const overlay = document.getElementById("overlay");
  const crosshair = document.getElementById("crosshair");
  let playing = false;
  // When the browser won't let us grab the mouse (e.g. inside an embedded
  // page), we fall back to "drag the mouse to look around" controls.
  let dragLook = false;

  function setPlaying(on) {
    playing = on;
    overlay.style.display = on ? "none" : "flex";
    crosshair.style.display = on ? "block" : "none";
    hotbarEl.style.display = on ? "flex" : "none";
    if (!on) for (const k in keys) keys[k] = false;
  }

  function startGame() {
    dragLook = false;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* fall through to drag-look mode */ }
    // If the pointer didn't actually lock shortly after, use drag-look mode.
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        dragLook = true;
        setPlaying(true);
        toast("Drag the mouse to look around 👀");
      }
    }, 300);
  }

  document.getElementById("playBtn").addEventListener("click", startGame);

  document.getElementById("newWorldBtn").addEventListener("click", () => {
    generateWorld(Math.floor(Math.random() * 1e9));
    rebuildWorldMesh();
    spawnPlayer();
    spawnAnimals(40);
    saveWorld();
    toast("A brand new world! 🌍");
    startGame();
  });

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
      dragLook = false;
      setPlaying(true);
    } else if (!dragLook) {
      setPlaying(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && dragLook && playing) {
      dragLook = false;
      setPlaying(false);
    }
  });

  let dragging = false, dragMoved = 0;

  function look(dx, dy) {
    player.yaw += dx * 0.0026;
    player.pitch += dy * 0.0026;
    const lim = Math.PI / 2 - 0.01;
    player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
  }

  document.addEventListener("mousemove", (e) => {
    if (!playing) return;
    if (dragLook) {
      if (dragging) {
        look(e.movementX, e.movementY);
        dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
      }
    } else {
      look(e.movementX, e.movementY);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code.startsWith("Digit")) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1);
    }
  });
  document.addEventListener("keyup", (e) => { keys[e.code] = false; });

  document.addEventListener("wheel", (e) => {
    if (playing) selectSlot(selected + (e.deltaY > 0 ? 1 : -1));
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function breakOrPlace(button) {
    if (button === 0 && pokeAnimal()) return;           // pet before you dig!
    const hit = raycastBlock(6);
    if (!hit) return;

    if (button === 0) {                                 // break
      setBlock(hit.x, hit.y, hit.z, AIR);
      rebuildWorldMesh();
      saveSoon();
      blip(160, 0.12);
    } else if (button === 2) {                          // place
      const px = hit.x + hit.face[0];
      const py = hit.y + hit.face[1];
      const pz = hit.z + hit.face[2];
      if (inWorld(px, py, pz) && !isSolid(px, py, pz) && !placeWouldTouchPlayer(px, py, pz)) {
        setBlock(px, py, pz, HOTBAR[selected]);
        rebuildWorldMesh();
        saveSoon();
        blip(420, 0.1);
      }
    }
  }

  document.addEventListener("mousedown", (e) => {
    if (!playing) return;
    if (dragLook) {
      dragging = true;
      dragMoved = 0;
    } else {
      breakOrPlace(e.button);
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!playing || !dragLook || !dragging) return;
    dragging = false;
    if (dragMoved < 6) breakOrPlace(e.button);          // a click, not a drag
  });

  // ---------------------------------------------------------------- main loop
  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    updateAnimals(dt, now / 1000);

    if (playing) {
      updatePlayer(dt);
      const hit = raycastBlock(6);
      if (hit) {
        highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        highlight.visible = true;
      } else {
        highlight.visible = false;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- go!
  if (!loadWorld()) {
    generateWorld(Math.floor(Math.random() * 1e9));
    saveWorld();
  }
  rebuildWorldMesh();
  spawnPlayer();
  spawnAnimals(40);
  buildHotbar();
  requestAnimationFrame(frame);
})();
