/* Block World — a tiny Minecraft-style game in one file.
   Runs completely offline: just open index.html in a browser. */

(function () {
  "use strict";

  // ---------------------------------------------------------------- world size
  const WX = 64, WY = 40, WZ = 64;     // world dimensions in blocks
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
  };
  const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8]; // placeable blocks on keys 1-8

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
    for (let i = 0; i < 26; i++) {
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
  const SAVE_KEY = "blockworld-save-v1";

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
  scene.fog = new THREE.Fog(0x87ceeb, 40, 110);

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
  const materials = {};
  for (const t in BLOCKS) {
    const b = BLOCKS[t];
    materials[t] = b.water
      ? new THREE.MeshLambertMaterial({ color: b.color, transparent: true, opacity: 0.65 })
      : new THREE.MeshLambertMaterial({ color: b.color });
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

  document.getElementById("playBtn").addEventListener("click", () => {
    canvas.requestPointerLock();
  });

  document.getElementById("newWorldBtn").addEventListener("click", () => {
    generateWorld(Math.floor(Math.random() * 1e9));
    rebuildWorldMesh();
    spawnPlayer();
    saveWorld();
    toast("A brand new world! 🌍");
    canvas.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    playing = document.pointerLockElement === canvas;
    overlay.style.display = playing ? "none" : "flex";
    crosshair.style.display = playing ? "block" : "none";
    hotbarEl.style.display = playing ? "flex" : "none";
    if (!playing) for (const k in keys) keys[k] = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (!playing) return;
    player.yaw += e.movementX * 0.0026;
    player.pitch += e.movementY * 0.0026;
    const lim = Math.PI / 2 - 0.01;
    player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
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

  document.addEventListener("mousedown", (e) => {
    if (!playing) return;
    const hit = raycastBlock(6);
    if (!hit) return;

    if (e.button === 0) {                               // break
      setBlock(hit.x, hit.y, hit.z, AIR);
      rebuildWorldMesh();
      saveSoon();
      blip(160, 0.12);
    } else if (e.button === 2) {                        // place
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
  });

  // ---------------------------------------------------------------- main loop
  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

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
  buildHotbar();
  requestAnimationFrame(frame);
})();
