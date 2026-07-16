/* Block World — a tiny Minecraft-style game in one file.
   Runs completely offline: just open index.html in a browser. */

(function () {
  "use strict";

  // ---------------------------------------------------------------- world size
  const WX = 256, WY = 64, WZ = 256;   // world dimensions in blocks
  const WATER_LEVEL = 12;
  const SNOW_LINE = 42;                // mountain tops above this get snow

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
    11: { name: "Snow", color: 0xf4f8fb, solid: true },
    12: { name: "Flower", color: 0xe74c3c, solid: false, flower: true },
    13: { name: "Flower", color: 0xf1c40f, solid: false, flower: true },
    14: { name: "Wild Grass", color: 0x4da83c, solid: false, flower: true },
  };
  const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11]; // keys 1-9, then 0 for snow

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

    const noiseMtn = makeNoise(seed + 5555);

    for (let x = 0; x < WX; x++) {
      for (let z = 0; z < WZ; z++) {
        const n = noiseBig(x / 22, z / 22) * 0.75 + noiseSmall(x / 7, z / 7) * 0.25;
        let height = Math.floor(8 + n * 14); // rolling hills 8..22

        // mountains rise where the mountain noise is strong
        const m = Math.max(0, noiseMtn(x / 34, z / 34) - 0.52) / 0.48;
        height += Math.floor(Math.pow(m, 1.6) * 36);
        height = Math.min(height, WY - 6);

        const rocky = height > 30;
        for (let y = 0; y <= height; y++) {
          let t;
          if (y === height) {
            if (height <= WATER_LEVEL + 1) t = 4;        // sandy shores
            else if (height >= SNOW_LINE) t = 11;        // snowy peaks
            else if (rocky) t = 3;                       // rocky slopes
            else t = 1;                                  // grass
          }
          else if (!rocky && y >= height - 3) t = 2;     // dirt under grass
          else t = 3;                                    // stone
          setBlock(x, y, z, t);
        }
        for (let y = height + 1; y <= WATER_LEVEL; y++) setBlock(x, y, z, 9); // water fills valleys
      }
    }

    // caves: wiggly tunnels carved through the underground
    for (let i = 0; i < 60; i++) {
      let cx = rand() * WX, cy = 6 + rand() * 18, cz = rand() * WZ;
      let ang = rand() * Math.PI * 2;
      let pitch = (rand() - 0.5) * 0.5;
      const len = 40 + rand() * 60;
      for (let s = 0; s < len; s++) {
        const r = 1.6 + rand() * 1.2;
        const ri = Math.ceil(r);
        for (let dx = -ri; dx <= ri; dx++)
          for (let dy = -ri; dy <= ri; dy++)
            for (let dz = -ri; dz <= ri; dz++) {
              if (dx * dx + dy * dy + dz * dz > r * r) continue;
              const bx = Math.floor(cx + dx), by = Math.floor(cy + dy), bz = Math.floor(cz + dz);
              if (by < 2) continue;                      // keep a solid floor
              const b = getBlock(bx, by, bz);
              if (b !== AIR && b !== 9) setBlock(bx, by, bz, AIR);
            }
        ang += (rand() - 0.5) * 0.6;
        pitch = Math.max(-0.6, Math.min(0.6, pitch + (rand() - 0.5) * 0.3));
        cx += Math.cos(ang) * 1.5;
        cz += Math.sin(ang) * 1.5;
        cy = Math.max(4, Math.min(26, cy + Math.sin(pitch)));
      }
    }

    // trees
    for (let i = 0; i < 420; i++) {
      const x = 3 + Math.floor(rand() * (WX - 6));
      const z = 3 + Math.floor(rand() * (WZ - 6));
      let top = -1;
      for (let y = WY - 1; y >= 0; y--) {
        if (getBlock(x, y, z) !== AIR) { top = y; break; }
      }
      if (top < 0 || getBlock(x, top, z) !== 1) continue; // only on grass
      const big = rand() < 0.25;                          // some trees are big oaks
      const trunkH = big ? 5 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 3);
      const R = big ? 3 : 2;
      for (let y = 1; y <= trunkH; y++) setBlock(x, top + y, z, 5);
      const ly = top + trunkH;
      for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
          for (let dy = 0; dy <= R; dy++) {
            const d = Math.abs(dx) + Math.abs(dz) + dy;
            if (d > R + 1 && !(dy === 0 && d <= R + 2)) continue;
            if (dx === 0 && dz === 0 && dy < 2) continue; // keep trunk visible
            if (getBlock(x + dx, ly + dy, z + dz) === AIR)
              setBlock(x + dx, ly + dy, z + dz, 6);
          }
        }
      }
    }

    // flowers and wild grass sprinkled across the meadows
    for (let i = 0; i < 3200; i++) {
      const x = Math.floor(rand() * WX), z = Math.floor(rand() * WZ);
      const gy = groundHeight(x, z);
      if (getBlock(x, gy, z) === 1 && getBlock(x, gy + 1, z) === AIR) {
        const r = rand();
        setBlock(x, gy + 1, z, r < 0.6 ? 14 : r < 0.8 ? 12 : 13);
      }
    }
  }

  function groundHeight(x, z) {
    for (let y = WY - 1; y >= 0; y--) if (isSolid(x, y, z)) return y;
    return 0;
  }

  // ---------------------------------------------------------------- save / load
  // Saves use run-length encoding (count,value pairs) — the huge world is
  // mostly long runs of the same block, so this squeezes it down massively.
  const SAVE_KEY = "blockworld-save-v4"; // v4: 256x256 world, RLE compressed

  function saveWorld() {
    try {
      const parts = [];
      let i = 0;
      while (i < world.length) {
        const v = world[i];
        let run = 1;
        while (i + run < world.length && world[i + run] === v && run < 40000) run++;
        parts.push(String.fromCharCode(run, v + 32));
        i += run;
      }
      localStorage.setItem(SAVE_KEY, parts.join(""));
    } catch (e) { /* storage may be unavailable on file:// in some browsers */ }
  }

  function loadWorld() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      if (!data) return false;
      let i = 0, pos = 0;
      while (i + 1 < data.length && pos < world.length) {
        const run = data.charCodeAt(i), v = data.charCodeAt(i + 1) - 32;
        world.fill(v, pos, Math.min(pos + run, world.length));
        pos += run;
        i += 2;
      }
      return pos === world.length;
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
  scene.background = new THREE.Color(0xbfe3ff);
  scene.fog = new THREE.Fog(0xbfe3ff, 60, 200);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 900);

  // real shadows from the sun
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sun = new THREE.DirectionalLight(0xfff4d6, 1.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;   sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 10;  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x9a8a6a, 0.42));
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));

  // the sun's shadows follow you around the world
  function updateSunShadow() {
    const p = player.pos;
    sun.position.set(p.x + 60, p.y + 110, p.z + 40);
    sun.target.position.set(p.x, p.y, p.z);
  }

  // a big sky dome: deep blue overhead melting into haze at the horizon
  const sky = (() => {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 128;
    const ctx = c.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#2f7fd6");
    grad.addColorStop(0.55, "#7db9ef");
    grad.addColorStop(0.8, "#bfe3ff");
    grad.addColorStop(1, "#d8ecff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 128);
    const tex = new THREE.CanvasTexture(c);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(600, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -2;
    scene.add(dome);
    return dome;
  })();

  // a friendly sun you can see in the sky
  const sunBall = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false })
  );
  sunBall.position.set(WX / 2 + 90, 80, WZ / 2 + 60);
  sunBall.lookAt(WX / 2, 15, WZ / 2);
  sunBall.renderOrder = -1;
  scene.add(sunBall);

  // fluffy clouds drifting across the sky
  const clouds = [];
  {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85,
    });
    for (let i = 0; i < 14; i++) {
      const w = 8 + Math.random() * 14, d = 5 + Math.random() * 8;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), cloudMat);
      cloud.castShadow = true;                 // cloud shadows drift over the land
      cloud.position.set(Math.random() * (WX + 80) - 40, 54 + Math.random() * 7, Math.random() * WZ);
      scene.add(cloud);
      clouds.push(cloud);
    }
  }

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

  // ---- detailed textures, painted on 64x64 canvases --------------------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  function makeTexture(paint, pixelArt) {
    const c = document.createElement("canvas");
    c.width = c.height = pixelArt ? 16 : 64;
    paint(c.getContext("2d"), c.width);
    const tex = new THREE.CanvasTexture(c);
    if (pixelArt) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
    } else {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = maxAniso;
    }
    return tex;
  }

  const rnd = Math.random;

  // fill with a base color, then sprinkle grain dots from a palette
  function speckle(ctx, base, colors, amount, size) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    grain(ctx, colors, amount, size);
  }
  function grain(ctx, colors, amount, size) {
    for (let i = 0; i < amount; i++) {
      ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
      ctx.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64),
                   1 + Math.floor(rnd() * (size || 1)), 1 + Math.floor(rnd() * (size || 1)));
    }
  }
  // soft translucent blotches for mottled surfaces
  function blotch(ctx, color, alpha, count, rMin, rMax) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const r = rMin + rnd() * (rMax - rMin);
      ctx.beginPath();
      ctx.arc(rnd() * 64, rnd() * 64, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // darker toward the bottom, like soil in shade
  function shadeDown(ctx, strength) {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0," + strength + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }

  function paintGrassTop(ctx) {
    ctx.fillStyle = "#4f9e3a"; ctx.fillRect(0, 0, 64, 64);
    blotch(ctx, "#66b84e", 0.25, 10, 5, 13);
    blotch(ctx, "#3f8a2e", 0.2, 8, 4, 10);
    const blades = ["#3f8a2e", "#5cb547", "#6ac455", "#478f35", "#7ed06a"];
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = blades[Math.floor(rnd() * blades.length)];
      ctx.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 2 + Math.floor(rnd() * 3));
    }
  }

  function paintDirtBase(ctx) {
    speckle(ctx, "#8a5d36", ["#7a5230", "#996b3f", "#6b4726", "#a3744a"], 1300, 2);
    for (let i = 0; i < 14; i++) {                    // little pebbles
      const x = rnd() * 60, y = rnd() * 60;
      ctx.fillStyle = "#5f4020"; ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = "#a87c4d"; ctx.fillRect(x, y, 1, 1);
    }
  }

  const texs = {
    grassTop: makeTexture(paintGrassTop),
    grassSide: makeTexture(ctx => {
      paintDirtBase(ctx);
      shadeDown(ctx, 0.22);
      ctx.fillStyle = "#4f9e3a"; ctx.fillRect(0, 0, 64, 5);   // grass lip
      const greens = ["#3f8a2e", "#5cb547", "#478f35"];
      for (let x = 0; x < 64; x++) {                          // hanging blades
        ctx.fillStyle = greens[Math.floor(rnd() * greens.length)];
        ctx.fillRect(x, 0, 1, 5 + Math.floor(rnd() * 8));
      }
    }),
    dirt: makeTexture(ctx => { paintDirtBase(ctx); shadeDown(ctx, 0.08); }),
    stone: makeTexture(ctx => {
      speckle(ctx, "#8d8d90", ["#818186", "#98989c", "#77777c", "#a2a2a6"], 900, 2);
      blotch(ctx, "#6f6f75", 0.14, 14, 4, 12);
      blotch(ctx, "#a8a8ac", 0.12, 10, 3, 9);
      ctx.strokeStyle = "#5f5f66"; ctx.lineWidth = 1;         // cracks
      for (let i = 0; i < 6; i++) {
        let x = rnd() * 64, y = rnd() * 64;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          x += (rnd() - 0.5) * 14; y += (rnd() - 0.3) * 10;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }),
    sand: makeTexture(ctx => {
      speckle(ctx, "#ecd9a0", ["#f7e9b8", "#dcc78d", "#e5d095"], 900, 1);
      ctx.strokeStyle = "rgba(190,160,100,0.5)"; ctx.lineWidth = 1;
      for (let y = 4; y < 64; y += 7) {                       // wind ripples
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x <= 64; x += 8)
          ctx.lineTo(x, y + Math.sin(x * 0.4 + y) * 2);
        ctx.stroke();
      }
    }),
    woodSide: makeTexture(ctx => {
      ctx.fillStyle = "#6e4a2a"; ctx.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x++) {                          // bark ridges
        const shade = 0.12 + 0.1 * Math.sin(x * 0.7);
        ctx.fillStyle = "rgba(0,0,0," + Math.max(0, shade) + ")";
        ctx.fillRect(x, 0, 1, 64);
      }
      ctx.strokeStyle = "#55371d"; ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {                           // deep grooves
        const x0 = rnd() * 64;
        ctx.beginPath(); ctx.moveTo(x0, 0);
        for (let y = 0; y <= 64; y += 8)
          ctx.lineTo(x0 + Math.sin(y * 0.3 + x0) * 2, y);
        ctx.stroke();
      }
      grain(ctx, ["#7d5530", "#5c3c20"], 250, 1);
    }),
    woodTop: makeTexture(ctx => {
      speckle(ctx, "#9c6b3d", ["#93622f", "#a8794a"], 300, 1);
      for (let r = 4; r < 46; r += 6) {                       // growth rings
        ctx.strokeStyle = r % 12 < 6 ? "#7a5230" : "#8a5f39";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(32, 32, r / 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#6e4a2a"; ctx.fillRect(30, 30, 4, 4);  // heartwood
    }),
    leaves: makeTexture(ctx => {
      ctx.fillStyle = "#2e7d32"; ctx.fillRect(0, 0, 64, 64);
      blotch(ctx, "#1b5e20", 0.3, 16, 3, 9);
      blotch(ctx, "#43a047", 0.3, 14, 3, 8);
      const tones = ["#1b5e20", "#43a047", "#66bb6a", "#388e3c", "#81c784"];
      for (let i = 0; i < 700; i++) {                         // leaf clusters
        ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
        ctx.fillRect(Math.floor(rnd() * 63), Math.floor(rnd() * 63), 2, 2);
      }
      ctx.fillStyle = "#143d16";                              // shadow holes
      for (let i = 0; i < 40; i++)
        ctx.fillRect(Math.floor(rnd() * 62), Math.floor(rnd() * 62), 2, 2);
    }),
    planks: makeTexture(ctx => {
      ctx.fillStyle = "#c09055"; ctx.fillRect(0, 0, 64, 64);
      for (let b = 0; b < 4; b++) {                           // four boards
        const y = b * 16;
        ctx.fillStyle = "rgba(" + (rnd() < 0.5 ? "255,255,255" : "60,30,0") + ",0.06)";
        ctx.fillRect(0, y, 64, 16);
        ctx.strokeStyle = "rgba(150,105,60,0.8)"; ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {                         // wood grain
          const gy = y + 2 + rnd() * 12;
          ctx.beginPath(); ctx.moveTo(rnd() * 20, gy);
          ctx.bezierCurveTo(20, gy + rnd() * 2 - 1, 44, gy + rnd() * 2 - 1, 64 - rnd() * 20, gy);
          ctx.stroke();
        }
        ctx.fillStyle = "#7d5a2f";                            // seams + joints
        ctx.fillRect(0, y + 14, 64, 2);
        const jx = (b % 2) * 32 + 16;
        ctx.fillRect(jx, y, 2, 14);
        ctx.fillStyle = "#5c4326";                            // nails
        ctx.fillRect(jx - 6, y + 6, 2, 2); ctx.fillRect(jx + 6, y + 6, 2, 2);
      }
    }),
    brick: makeTexture(ctx => {
      ctx.fillStyle = "#cfc6ba"; ctx.fillRect(0, 0, 64, 64);  // mortar
      const reds = ["#b2452c", "#a63e28", "#bd4f33", "#c25a3d", "#9e3a25"];
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 8;
        for (let col = -1; col < 5; col++) {
          const bx = col * 16 + off, by = row * 8;
          ctx.fillStyle = reds[Math.floor(rnd() * reds.length)];
          ctx.fillRect(bx + 1, by + 1, 14, 6);
          ctx.fillStyle = "rgba(255,255,255,0.18)";           // sunlit edge
          ctx.fillRect(bx + 1, by + 1, 14, 1);
          ctx.fillStyle = "rgba(0,0,0,0.22)";                 // shaded edge
          ctx.fillRect(bx + 1, by + 6, 14, 1);
        }
      }
      grain(ctx, ["rgba(0,0,0,0.15)", "rgba(255,255,255,0.1)"], 300, 1);
    }),
    water: makeTexture(ctx => {
      ctx.fillStyle = "#3a6fd8"; ctx.fillRect(0, 0, 64, 64);
      blotch(ctx, "#2c56b0", 0.18, 12, 5, 14);
      const waves = ["#5b8ee8", "#7fabf2", "#4a7de0"];
      for (let i = 0; i < 40; i++) {                          // wave streaks
        ctx.fillStyle = waves[Math.floor(rnd() * waves.length)];
        ctx.fillRect(Math.floor(rnd() * 50), Math.floor(rnd() * 64), 6 + rnd() * 16, 1);
      }
      ctx.fillStyle = "rgba(220,236,255,0.7)";                // sparkles
      for (let i = 0; i < 12; i++)
        ctx.fillRect(Math.floor(rnd() * 60), Math.floor(rnd() * 64), 2, 1);
    }),
    snow: makeTexture(ctx => {
      speckle(ctx, "#f2f6fa", ["#e4edf5", "#ffffff", "#dde8f0"], 700, 2);
      blotch(ctx, "#dbe7f2", 0.3, 10, 5, 12);
      ctx.fillStyle = "#ffffff";                              // sparkles
      for (let i = 0; i < 30; i++)
        ctx.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 1);
    }),
    craftTop: makeTexture(ctx => {
      speckle(ctx, "#a97d4b", ["#93683a", "#b98d5b"], 400, 1);
      ctx.fillStyle = "#4a3315";                              // crafting grid
      ctx.fillRect(12, 12, 40, 3); ctx.fillRect(12, 49, 40, 3);
      ctx.fillRect(12, 12, 3, 40); ctx.fillRect(49, 12, 3, 40);
      ctx.fillRect(30, 12, 4, 40); ctx.fillRect(12, 30, 40, 4);
    }),
    craftSide: makeTexture(ctx => {
      speckle(ctx, "#a97d4b", ["#8a6238", "#b98d5b"], 400, 1);
      ctx.fillStyle = "#4a3315";
      ctx.fillRect(0, 0, 64, 4); ctx.fillRect(0, 58, 64, 6);
      ctx.fillStyle = "#c0392b";                              // saw
      ctx.fillRect(10, 16, 18, 10);
      ctx.fillStyle = "#8f2c20";
      for (let x = 10; x < 28; x += 4) ctx.fillRect(x, 26, 2, 3);
      ctx.fillStyle = "#95a5a6";                              // hammer
      ctx.fillRect(38, 18, 16, 8);
      ctx.fillStyle = "#7d6547";
      ctx.fillRect(44, 26, 4, 20);
    }),
    flowerRed: makeTexture(ctx => {
      ctx.fillStyle = "#3e8e2f"; ctx.fillRect(7, 8, 2, 8);    // stem
      ctx.fillStyle = "#e74c3c"; ctx.fillRect(4, 2, 8, 7);    // petals
      ctx.fillStyle = "#ffd54f"; ctx.fillRect(7, 4, 2, 2);    // center
    }, true),
    flowerYellow: makeTexture(ctx => {
      ctx.fillStyle = "#3e8e2f"; ctx.fillRect(7, 8, 2, 8);
      ctx.fillStyle = "#f1c40f"; ctx.fillRect(4, 2, 8, 7);
      ctx.fillStyle = "#e67e22"; ctx.fillRect(7, 4, 2, 2);
    }, true),
    wildGrass: makeTexture(ctx => {
      ctx.fillStyle = "#4da83c";
      for (const [x, h] of [[2, 9], [5, 12], [8, 10], [11, 13], [13, 8]])
        ctx.fillRect(x, 16 - h, 2, h);
      ctx.fillStyle = "#63c24f";
      for (const [x, h] of [[4, 7], [7, 11], [10, 6]])
        ctx.fillRect(x, 16 - h, 1, h);
    }, true),
  };

  // water shimmers by slowly sliding its texture
  texs.water.wrapS = texs.water.wrapT = THREE.RepeatWrapping;

  // blocks use the texture itself as a bump map, so surfaces catch the light
  const lam = (tex, opts) => new THREE.MeshPhongMaterial(Object.assign({
    map: tex, bumpMap: tex, bumpScale: 0.1, shininess: 4, specular: 0x1c1c1c,
  }, opts));
  // BoxGeometry face order: +x, -x, top, bottom, +z, -z
  const materials = {
    1: [lam(texs.grassSide), lam(texs.grassSide), lam(texs.grassTop),
        lam(texs.dirt), lam(texs.grassSide), lam(texs.grassSide)],
    2: lam(texs.dirt),
    3: lam(texs.stone),
    4: lam(texs.sand),
    5: [lam(texs.woodSide), lam(texs.woodSide), lam(texs.woodTop),
        lam(texs.woodTop), lam(texs.woodSide), lam(texs.woodSide)],
    6: lam(texs.leaves),
    7: lam(texs.planks),
    8: lam(texs.brick),
    9: new THREE.MeshPhongMaterial({ map: texs.water, transparent: true, opacity: 0.7,
                                     shininess: 90, specular: 0x9ec4ff }),
    10: [lam(texs.craftSide), lam(texs.craftSide), lam(texs.craftTop),
         lam(texs.planks), lam(texs.craftSide), lam(texs.craftSide)],
    11: lam(texs.snow),
    12: lam(texs.flowerRed, { transparent: true, alphaTest: 0.4 }),
    13: lam(texs.flowerYellow, { transparent: true, alphaTest: 0.4 }),
    14: lam(texs.wildGrass, { transparent: true, alphaTest: 0.4 }),
  };

  // flowers are drawn as slim little boxes, not full cubes
  const flowerGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
  flowerGeo.translate(0, -0.1, 0);
  function isExposed(x, y, z) {
    return !covers(x + 1, y, z) || !covers(x - 1, y, z) ||
           !covers(x, y + 1, z) || !covers(x, y - 1, z) ||
           !covers(x, y, z + 1) || !covers(x, y, z - 1);
  }
  // does this cell hide the face of the block next to it?
  function covers(x, y, z) {
    if (!inWorld(x, y, z)) return false;
    const b = world[idx(x, y, z)];
    return b !== AIR && !BLOCKS[b].flower;
  }

  // The world is drawn in 32x32 chunks so edits only redraw one small piece.
  const CHUNK = 32;
  const chunkMeshes = new Map(); // "cx,cz" -> [InstancedMesh, ...]

  function rebuildChunk(cx, cz) {
    const key = cx + "," + cz;
    const old = chunkMeshes.get(key);
    if (old) for (const m of old) { scene.remove(m); m.dispose(); }

    const positions = {};
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let y = 0; y < WY; y++)
      for (let z = z0; z < z0 + CHUNK; z++)
        for (let x = x0; x < x0 + CHUNK; x++) {
          const t = world[idx(x, y, z)];
          if (t === AIR || !isExposed(x, y, z)) continue;
          (positions[t] || (positions[t] = [])).push(x, y, z);
        }

    const m4 = new THREE.Matrix4();
    const meshes = [];
    // natural blocks get a subtle per-block tint so fields don't repeat
    const TINT = { 1: 0.09, 2: 0.07, 3: 0.06, 4: 0.05, 6: 0.11, 11: 0.04, 14: 0.1 };
    const tintColor = new THREE.Color();
    for (const t in positions) {
      const pts = positions[t];
      const geo = BLOCKS[t].flower ? flowerGeo : cubeGeo;
      const mesh = new THREE.InstancedMesh(geo, materials[t], pts.length / 3);
      const tint = TINT[t];
      for (let i = 0; i < pts.length; i += 3) {
        m4.makeTranslation(pts[i] + 0.5, pts[i + 1] + 0.5, pts[i + 2] + 0.5);
        mesh.setMatrixAt(i / 3, m4);
        if (tint) {
          // deterministic hash of the block position, stable across redraws
          const h = ((pts[i] * 73856093) ^ (pts[i + 1] * 19349663) ^ (pts[i + 2] * 83492791)) >>> 0;
          const v = 1 - tint + ((h % 1000) / 1000) * tint * 2;
          tintColor.setRGB(v, v, v);
          mesh.setColorAt(i / 3, tintColor);
        }
      }
      if (tint && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (!BLOCKS[t].flower && !BLOCKS[t].water) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      } else if (BLOCKS[t].water) {
        mesh.receiveShadow = true;
      }
      scene.add(mesh);
      meshes.push(mesh);
    }
    chunkMeshes.set(key, meshes);
  }

  function rebuildWorldMesh() {
    for (let cx = 0; cx < WX / CHUNK; cx++)
      for (let cz = 0; cz < WZ / CHUNK; cz++)
        rebuildChunk(cx, cz);
  }

  // hide chunks that are hidden behind the fog anyway — a big speed boost
  let cullClock = 0;
  function updateChunkVisibility(dt) {
    cullClock -= dt;
    if (cullClock > 0) return;
    cullClock = 0.5;
    for (const [key, meshes] of chunkMeshes) {
      const c = key.split(",");
      const dx = (+c[0] + 0.5) * CHUNK - player.pos.x;
      const dz = (+c[1] + 0.5) * CHUNK - player.pos.z;
      const visible = dx * dx + dz * dz < 240 * 240;
      for (const m of meshes) m.visible = visible;
    }
  }

  // redraw the chunk containing (x,z), plus neighbors when on a border
  function rebuildAt(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const maxC = WX / CHUNK - 1, maxZ = WZ / CHUNK - 1;
    rebuildChunk(cx, cz);
    if (x % CHUNK === 0 && cx > 0) rebuildChunk(cx - 1, cz);
    if (x % CHUNK === CHUNK - 1 && cx < maxC) rebuildChunk(cx + 1, cz);
    if (z % CHUNK === 0 && cz > 0) rebuildChunk(cx, cz - 1);
    if (z % CHUNK === CHUNK - 1 && cz < maxZ) rebuildChunk(cx, cz + 1);
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
    kx: 0, kz: 0,                       // knockback push from bonks
  };

  function spawnPlayer() {
    // start at the middle, but walk outward until we find dry grassy land
    let x = WX / 2, z = WZ / 2;
    outer:
    for (let r = 0; r < 50; r += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        for (let dz = -r; dz <= r; dz += 2) {
          const tx = WX / 2 + dx, tz = WZ / 2 + dz;
          if (!inWorld(tx, 0, tz)) continue;
          const gy = groundHeight(tx, tz);
          if (gy > WATER_LEVEL && getBlock(tx, gy, tz) === 1) {
            x = tx; z = tz;
            break outer;
          }
        }
      }
    }
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
  let bobPhase = 0, lastBobSin = 0;

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
    let speed = inWater ? SPEED * 0.6 : SPEED;
    if (inv.hunger <= 2) speed *= 0.6;        // too hungry to run — eat something!
    player.vel.x = (mx * cos - mz * sin) * speed + player.kx;
    player.vel.z = (mx * sin + mz * cos) * speed + player.kz;
    const kd = Math.max(0, 1 - 6 * dt);       // knockback fades quickly
    player.kx *= kd; player.kz *= kd;

    // hearts slowly come back when your belly is full
    if (inv.hearts < 10 && inv.hunger >= 8) {
      regenClock += dt;
      if (regenClock > 9) {
        regenClock = 0;
        inv.hearts++;
        updateHearts();
      }
    }

    // walking makes you hungry over time
    if (len > 0) {
      hungerClock += dt;
      if (hungerClock > 30) {
        hungerClock = 0;
        if (inv.hunger > 0) {
          inv.hunger--;
          updateHunger();
          if (inv.hunger === 3) toast("Getting hungry! Press E to eat 🍗");
        }
      }
    }

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

    // a gentle bounce while walking, with soft footsteps
    if (len > 0 && player.onGround) {
      bobPhase += dt * 9;
      const s = Math.sin(bobPhase);
      camera.position.y += s * 0.055;
      if (s < 0 && lastBobSin >= 0) blip(90 + Math.random() * 25, 0.04, 0.02);
      lastBobSin = s;
    }
  }

  // ---------------------------------------------------------------- animals
  const animals = [];

  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    m.position.set(x, y, z);
    m.castShadow = true;
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

  function buildZombie() {
    const skin = 0x6fbf5a, shirt = 0x3a7a8c, pants = 0x44447e;
    const g = new THREE.Group();
    g.add(box(0.5, 0.55, 0.28, shirt, 0, 0.85, 0));       // shirt
    g.add(box(0.4, 0.4, 0.4, skin, 0, 1.32, 0));          // head
    g.add(box(0.08, 0.08, 0.03, 0x1c1c1c, -0.1, 1.38, 0.21)); // derpy eyes
    g.add(box(0.08, 0.08, 0.03, 0x1c1c1c, 0.1, 1.34, 0.21));
    g.add(box(0.13, 0.13, 0.5, skin, -0.2, 1.0, 0.3));    // arms straight out
    g.add(box(0.13, 0.13, 0.5, skin, 0.2, 1.0, 0.3));
    const legs = [
      box(0.16, 0.55, 0.16, pants, -0.13, 0.28, 0),
      box(0.16, 0.55, 0.16, pants, 0.13, 0.28, 0),
    ];
    legs.forEach(l => g.add(l));
    return { group: g, legs };
  }

  function buildCreeper() {
    const green = 0x3d8f2c, dark = 0x2c6b1f, mottle = 0x255c19;
    const g = new THREE.Group();
    g.add(box(0.5, 0.85, 0.3, green, 0, 0.9, 0));         // body
    g.add(box(0.14, 0.2, 0.02, mottle, -0.12, 1.0, 0.16)); // mottled patches
    g.add(box(0.12, 0.16, 0.02, mottle, 0.14, 0.7, 0.16));
    g.add(box(0.48, 0.48, 0.48, green, 0, 1.58, 0));      // head
    g.add(box(0.11, 0.13, 0.03, 0x000000, -0.11, 1.66, 0.25)); // angry eyes
    g.add(box(0.11, 0.13, 0.03, 0x000000, 0.11, 1.66, 0.25));
    g.add(box(0.08, 0.04, 0.03, 0x000000, -0.14, 1.75, 0.25)); // slanted brows
    g.add(box(0.08, 0.04, 0.03, 0x000000, 0.14, 1.75, 0.25));
    g.add(box(0.1, 0.18, 0.03, 0x000000, 0, 1.46, 0.25)); // gaping frown
    g.add(box(0.2, 0.08, 0.03, 0x000000, 0, 1.52, 0.25));
    const legs = [
      box(0.18, 0.5, 0.18, dark, -0.15, 0.25, 0.18),
      box(0.18, 0.5, 0.18, dark, 0.15, 0.25, 0.18),
      box(0.18, 0.5, 0.18, dark, -0.15, 0.25, -0.18),
      box(0.18, 0.5, 0.18, dark, 0.15, 0.25, -0.18),
    ];
    legs.forEach(l => g.add(l));
    return { group: g, legs };
  }

  const MONSTER_KINDS = [
    { make: buildZombie,  color: 0x6fbf5a, monster: true, hp: 3, zombie: true },
    { make: buildCreeper, color: 0x3d8f2c, monster: true, hp: 3, creeper: true },
  ];

  const ANIMAL_KINDS = [
    { make: buildPig,     color: 0xf0a0a8, drops: { meat: 2 },              msg: "+2 🍖 meat!" },
    { make: buildSheep,   color: 0xf5f5f0, drops: { meat: 1 },              msg: "+1 🍖 meat!" },
    { make: buildChicken, color: 0xfafafa, drops: { eggs: 1, feathers: 2 }, msg: "+1 🥚 and +2 🪶!" },
    { make: buildChicken, color: 0xfafafa, drops: { eggs: 1, feathers: 2 }, msg: "+1 🥚 and +2 🪶!" },
    { make: buildVillager, villager: true },
  ];

  function spawnOneAnimal(rand) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 4 + Math.floor(rand() * (WX - 8));
      const z = 4 + Math.floor(rand() * (WZ - 8));
      const gy = groundHeight(x, z);
      if (getBlock(x, gy, z) !== 1) continue;            // only on grass
      const kind = ANIMAL_KINDS[Math.floor(rand() * ANIMAL_KINDS.length)];
      const built = kind.make();
      built.group.position.set(x + 0.5, gy + 1, z + 0.5);
      scene.add(built.group);
      animals.push({
        group: built.group, legs: built.legs, kind,
        hp: 2,
        yaw: rand() * Math.PI * 2,
        speed: 0, vy: 0,
        timer: rand() * 4,
        walkPhase: rand() * 10,
      });
      return;
    }
  }

  function spawnOneMonster(rand) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 4 + Math.floor(rand() * (WX - 8));
      const z = 4 + Math.floor(rand() * (WZ - 8));
      // never right where the player starts
      const dx = x - player.pos.x, dz = z - player.pos.z;
      if (dx * dx + dz * dz < 30 * 30) continue;
      const gy = groundHeight(x, z);
      if (gy <= WATER_LEVEL || !isSolid(x, gy, z)) continue;
      const kind = MONSTER_KINDS[Math.floor(rand() * MONSTER_KINDS.length)];
      const built = kind.make();
      built.group.position.set(x + 0.5, gy + 1, z + 0.5);
      scene.add(built.group);
      animals.push({
        group: built.group, legs: built.legs, kind,
        hp: kind.hp,
        yaw: rand() * Math.PI * 2,
        speed: 0, vy: 0,
        timer: rand() * 4,
        walkPhase: rand() * 10,
        hitCooldown: 0, fuse: -1,
      });
      return;
    }
  }

  function spawnAnimals(count) {
    for (const a of animals) scene.remove(a.group);
    animals.length = 0;
    const rand = makeRandom(Math.floor(Math.random() * 1e9));
    for (let i = 0; i < count; i++) spawnOneAnimal(rand);
    for (let i = 0; i < 13; i++) spawnOneMonster(rand);
  }

  function updateAnimals(dt, time) {
    for (let ai = animals.length - 1; ai >= 0; ai--) {
      const a = animals[ai];
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

      // monsters have their own plans...
      if (a.kind.monster) {
        a.hitCooldown -= dt;
        const pdx = player.pos.x - p.x, pdz = player.pos.z - p.z;
        const dist = Math.hypot(pdx, pdz);

        if (a.kind.creeper && a.fuse >= 0) {
          // fuse is lit: freeze, flash white, then POOF
          a.fuse -= dt;
          a.speed = 0;
          const flash = Math.sin(a.fuse * 25) > 0;
          a.group.traverse(o => {
            if (o.isMesh && o.material.emissive) o.material.emissive.setScalar(flash ? 0.8 : 0);
          });
          if (a.fuse <= 0) {
            explodeCreeper(ai);
            continue;
          }
        } else if (playing && dist < (a.kind.creeper ? 16 : 12)) {
          // spotted you — here it comes!
          a.yaw = Math.atan2(pdx, pdz);
          a.speed = a.kind.zombie ? 1.7 : 1.9;         // creepers sneak up FAST
          a.timer = 1;
          if (a.kind.zombie && Math.random() < dt * 0.2)
            sweep(130, 70, 0.5, 0.03);                 // goofy groan
          if (a.kind.creeper && dist < 3 && a.fuse < 0) {
            a.fuse = 1.3;                              // SSSSSSS...
            sweep(1400, 120, 1.3, 0.09);
          }
          if (a.kind.zombie && dist < 1.3 && a.hitCooldown <= 0) {
            a.hitCooldown = 1.4;                       // bonk!
            damagePlayer(1, p);
          }
        }
      }
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

  // ------- your food pouch -------
  const INV_KEY = "blockworld-inv-v1";
  const inv = { meat: 0, eggs: 0, feathers: 0, hunger: 10, hearts: 10 };
  try { Object.assign(inv, JSON.parse(localStorage.getItem(INV_KEY) || "{}")); } catch (e) {}
  const invEl = document.getElementById("inv");
  const hungerEl = document.getElementById("hunger");
  const heartsEl = document.getElementById("hearts");
  const hurtEl = document.getElementById("hurt");
  const toolsEl = document.getElementById("tools");
  let hungerClock = 0, regenClock = 0;

  function updateHearts() {
    heartsEl.textContent = "❤️".repeat(inv.hearts) + "🤍".repeat(10 - inv.hearts);
    try { localStorage.setItem(INV_KEY, JSON.stringify(inv)); } catch (e) {}
  }

  function damagePlayer(n, fromPos) {
    inv.hearts = Math.max(0, inv.hearts - n);
    updateHearts();
    hurtEl.style.opacity = 0.45;                       // quick red flash
    setTimeout(() => { hurtEl.style.opacity = 0; }, 350);
    sweep(220, 90, 0.25, 0.07);
    if (fromPos) {                                     // get knocked back
      const dx = player.pos.x - fromPos.x, dz = player.pos.z - fromPos.z;
      const d = Math.hypot(dx, dz) || 1;
      player.kx = (dx / d) * 9;
      player.kz = (dz / d) * 9;
      player.vel.y = 5;
    }
    if (inv.hearts <= 0) {                             // just a little nap
      toast("Ouch! You took a nap and woke up at home 😴");
      inv.hearts = 10;
      updateHearts();
      spawnPlayer();
    }
  }

  // ------- tools: press Q to switch -------
  const TOOLS = [
    { name: "Fist",    icon: "👊", dmg: 1 },
    { name: "Sword",   icon: "🗡️", dmg: 2 },
    { name: "Pickaxe", icon: "⛏️", dmg: 1 },
  ];
  let toolIdx = 0;

  function updateTools() {
    toolsEl.innerHTML = "";
    TOOLS.forEach((t, i) => {
      const s = document.createElement("span");
      s.className = "toolslot" + (i === toolIdx ? " sel" : "");
      s.textContent = t.icon;
      toolsEl.appendChild(s);
    });
  }

  function updateInv() {
    invEl.textContent = `🍖 ${inv.meat}   🥚 ${inv.eggs}   🪶 ${inv.feathers}`;
    try { localStorage.setItem(INV_KEY, JSON.stringify(inv)); } catch (e) {}
  }

  function updateHunger() {
    hungerEl.textContent = "🍗".repeat(inv.hunger) + "▫️".repeat(10 - inv.hunger);
    try { localStorage.setItem(INV_KEY, JSON.stringify(inv)); } catch (e) {}
  }

  // press E to eat: meat first, then eggs
  function eat() {
    if (inv.hunger >= 10) { toast("You're full! 😊"); return; }
    if (inv.meat > 0) {
      inv.meat--;
      inv.hunger = Math.min(10, inv.hunger + 4);
    } else if (inv.eggs > 0) {
      inv.eggs--;
      inv.hunger = Math.min(10, inv.hunger + 2);
    } else {
      toast("No food yet — go hunting! 🍖");
      return;
    }
    toast("Yum! 😋");
    blip(140, 0.08); setTimeout(() => blip(110, 0.08), 110); setTimeout(() => blip(130, 0.08), 220);
    updateInv();
    updateHunger();
  }

  // creepers go POOF: a burst of crumbs, a little crater, a big thump
  function explodeCreeper(index) {
    const a = animals[index];
    const p = a.group.position;
    sweep(120, 28, 0.7, 0.16);                           // THUMP
    const cx = Math.floor(p.x), cy = Math.floor(p.y), cz = Math.floor(p.z);
    spawnCrumbs(cx, cy, cz, 0x4fae3d);
    spawnCrumbs(cx, cy + 1, cz, 0x8a8a8a);
    spawnCrumbs(cx, cy, cz, 0x6b4726);
    for (let dx = -3; dx <= 3; dx++)                     // a real crater
      for (let dy = -3; dy <= 3; dy++)
        for (let dz = -3; dz <= 3; dz++) {
          if (dx * dx + dy * dy + dz * dz > 10) continue;
          const bx = cx + dx, by = cy + dy, bz = cz + dz;
          if (by < 3) continue;
          const b = getBlock(bx, by, bz);
          if (b !== AIR && b !== 9) setBlock(bx, by, bz, AIR);
        }
    const seen = new Set();                              // redraw touched chunks
    for (const [qx, qz] of [[cx - 3, cz - 3], [cx + 3, cz - 3], [cx - 3, cz + 3], [cx + 3, cz + 3]]) {
      const key = Math.floor(qx / CHUNK) + "," + Math.floor(qz / CHUNK);
      if (!seen.has(key)) { seen.add(key); rebuildChunk(Math.floor(qx / CHUNK), Math.floor(qz / CHUNK)); }
    }
    saveSoon();
    const pd = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
    if (pd < 5) damagePlayer(3, p);                      // big bonk if you're close
    scene.remove(a.group);
    animals.splice(index, 1);
    setTimeout(() => spawnOneMonster(makeRandom(Math.floor(Math.random() * 1e9))), 25000);
  }

  // Click to swing your tool: hunt animals, fight monsters.
  // Villagers are people — they just say hello.
  const animalRay = new THREE.Raycaster();
  function pokeAnimal() {
    animalRay.setFromCamera(new THREE.Vector2(0, 0), camera);
    animalRay.far = 6;
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i];
      if (animalRay.intersectObject(a.group, true).length === 0) continue;

      if (a.kind.villager) {
        a.group.position.y += 0.02;
        a.vy = 6;                                        // happy hop
        blip(700, 0.12);
        setTimeout(() => blip(880, 0.1), 90);
        toast("The villager says hi! 👋");
        return true;
      }

      if (TOOLS[toolIdx].name === "Sword") sweep(950, 350, 0.09, 0.04); // swish!
      a.hp -= TOOLS[toolIdx].dmg;

      if (a.hp > 0) {                                    // ouch!
        a.group.position.y += 0.02;
        a.vy = 5;
        if (a.kind.monster) {                            // monsters get knocked back
          const dx = a.group.position.x - player.pos.x;
          const dz = a.group.position.z - player.pos.z;
          a.yaw = Math.atan2(dx, dz);
          a.speed = 3;
          a.timer = 0.5;
        } else {                                         // animals run away
          a.yaw = player.yaw;
          a.speed = 2.5;
          a.timer = 2;
        }
        blip(300, 0.1);
      } else {                                           // defeated!
        const p = a.group.position;
        spawnCrumbs(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), a.kind.color);
        scene.remove(a.group);
        animals.splice(i, 1);
        if (a.kind.monster) {
          toast(a.kind.zombie ? "Got the zombie! 💥" : "Got the creeper before it popped! 💥");
          blip(500, 0.12);
          setTimeout(() => spawnOneMonster(makeRandom(Math.floor(Math.random() * 1e9))), 25000);
        } else {
          for (const k in a.kind.drops) inv[k] += a.kind.drops[k];
          updateInv();
          toast(a.kind.msg);
          blip(180, 0.15);
          setTimeout(() => spawnOneAnimal(makeRandom(Math.floor(Math.random() * 1e9))), 20000);
        }
      }
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- butterflies
  const butterflies = [];

  function spawnButterflies(count) {
    for (const b of butterflies) scene.remove(b.group);
    butterflies.length = 0;
    const colors = [0xff8fb3, 0xffb84d, 0x7ec8ff, 0xc59fff];
    for (let i = 0; i < count; i++) {
      const x = 8 + Math.random() * (WX - 16), z = 8 + Math.random() * (WZ - 16);
      const gy = groundHeight(Math.floor(x), Math.floor(z));
      if (gy <= WATER_LEVEL) continue;                   // not over lakes
      const c = colors[i % colors.length];
      const g = new THREE.Group();
      const wingL = box(0.16, 0.02, 0.12, c, -0.09, 0, 0);
      const wingR = box(0.16, 0.02, 0.12, c, 0.09, 0, 0);
      g.add(wingL, wingR, box(0.04, 0.05, 0.15, 0x453b2f, 0, 0, 0));
      g.position.set(x, gy + 2, z);
      scene.add(g);
      butterflies.push({ group: g, home: g.position.clone(), phase: Math.random() * 40, wingL, wingR });
    }
  }

  function updateButterflies(t) {
    for (const b of butterflies) {
      const s = t + b.phase;
      b.group.position.set(
        b.home.x + Math.sin(s * 0.6) * 2.2,
        b.home.y + Math.sin(s * 1.7) * 0.5,
        b.home.z + Math.cos(s * 0.8) * 2.2
      );
      const flap = Math.sin(s * 16) * 0.9;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
    }
  }

  // ---------------------------------------------------------------- birds
  const birds = [];

  function spawnBirds(count) {
    for (const b of birds) scene.remove(b.group);
    birds.length = 0;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const wingL = box(0.55, 0.03, 0.18, 0x4a4a52, -0.3, 0, 0);
      const wingR = box(0.55, 0.03, 0.18, 0x4a4a52, 0.3, 0, 0);
      g.add(wingL, wingR, box(0.12, 0.1, 0.42, 0x5c5c66, 0, 0, 0));
      scene.add(g);
      birds.push({
        group: g, wingL, wingR,
        cx: 20 + Math.random() * (WX - 40),
        cz: 20 + Math.random() * (WZ - 40),
        r: 10 + Math.random() * 14,
        h: 40 + Math.random() * 12,
        speed: 0.12 + Math.random() * 0.1,
        phase: Math.random() * 100,
      });
    }
  }

  function updateBirds(t) {
    for (const b of birds) {
      const a = t * b.speed + b.phase;
      b.group.position.set(
        b.cx + Math.cos(a) * b.r,
        b.h + Math.sin(t * 0.5 + b.phase) * 2,
        b.cz + Math.sin(a) * b.r
      );
      b.group.rotation.y = -a;                 // face the way it flies
      const flap = Math.sin(t * 5 + b.phase) * 0.45;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
    }
  }

  // little birdsong now and then
  let nextChirp = 0;
  function maybeChirp(t) {
    if (t < nextChirp) return;
    nextChirp = t + 7 + Math.random() * 12;
    if (!playing) return;
    blip(1500 + Math.random() * 300, 0.07, 0.025);
    setTimeout(() => blip(1850 + Math.random() * 250, 0.06, 0.02), 130);
    setTimeout(() => blip(1650, 0.05, 0.015), 260);
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

  // ---------------------------------------------------------------- break particles
  const particles = [];
  const particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

  function spawnCrumbs(x, y, z, color) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(particleGeo, new THREE.MeshLambertMaterial({ color }));
      m.position.set(
        x + 0.5 + (Math.random() - 0.5) * 0.6,
        y + 0.5 + (Math.random() - 0.5) * 0.6,
        z + 0.5 + (Math.random() - 0.5) * 0.6
      );
      m.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4
      );
      m.userData.life = 0.5 + Math.random() * 0.3;
      scene.add(m);
      particles.push(m);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const m = particles[i];
      m.userData.vel.y -= 18 * dt;
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.life -= dt;
      if (m.userData.life <= 0) {
        scene.remove(m);
        m.material.dispose();
        particles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- tiny sound effects
  let audioCtx = null;
  function blip(freq, duration, volume) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(volume || 0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + duration);
    } catch (e) { /* sound is optional */ }
  }

  // a sliding whoosh/growl: frequency glides from f1 to f2
  function sweep(f1, f2, duration, volume) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(25, f2), t + duration);
      g.gain.setValueAtTime(volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(t + duration);
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
      num.textContent = (i + 1) % 10;   // the key that picks this slot
      slot.appendChild(cube);
      slot.appendChild(label);
      slot.appendChild(num);
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
    invEl.style.display = on ? "block" : "none";
    hungerEl.style.display = on ? "block" : "none";
    heartsEl.style.display = on ? "block" : "none";
    toolsEl.style.display = on ? "flex" : "none";
    if (!on) for (const k in keys) keys[k] = false;
  }

  function startGame() {
    dragLook = false;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* fall through to drag-look mode */ }
    // If the game hasn't started shortly after (no pointerlockchange event
    // arrived), start anyway — with drag-look controls if we have no lock.
    setTimeout(() => {
      if (!playing) {
        dragLook = document.pointerLockElement !== canvas;
        setPlaying(true);
        if (dragLook) toast("Drag the mouse to look around 👀");
      }
    }, 300);
  }

  document.getElementById("playBtn").addEventListener("click", startGame);

  document.getElementById("newWorldBtn").addEventListener("click", () => {
    generateWorld(Math.floor(Math.random() * 1e9));
    rebuildWorldMesh();
    spawnPlayer();
    spawnAnimals(55);
    spawnButterflies(36);
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
    if (e.code === "KeyE") eat();
    if (e.code === "KeyQ") {                             // switch tools
      toolIdx = (toolIdx + 1) % TOOLS.length;
      updateTools();
      toast(TOOLS[toolIdx].icon + " " + TOOLS[toolIdx].name + " ready!");
      sweep(700, 350, 0.08, 0.03);
    }
    if (e.code.startsWith("Digit")) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1);
      else if (n === 0 && HOTBAR.length >= 10) selectSlot(9);
    }
  });
  document.addEventListener("keyup", (e) => { keys[e.code] = false; });

  document.addEventListener("wheel", (e) => {
    if (playing) selectSlot(selected + (e.deltaY > 0 ? 1 : -1));
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // hard blocks need 3 punches — or just 1 hit with the pickaxe
  const HARD_BLOCKS = { 3: true, 5: true, 7: true, 8: true, 10: true };
  let digTarget = null; // { x, y, z, left }

  function breakOrPlace(button) {
    if (button === 0 && pokeAnimal()) return;           // swing at creatures first
    const hit = raycastBlock(6);
    if (!hit) return;

    if (button === 0) {                                 // dig
      const broken = getBlock(hit.x, hit.y, hit.z);
      const needed = HARD_BLOCKS[broken] && TOOLS[toolIdx].name !== "Pickaxe" ? 3 : 1;
      if (!digTarget || digTarget.x !== hit.x || digTarget.y !== hit.y || digTarget.z !== hit.z)
        digTarget = { x: hit.x, y: hit.y, z: hit.z, left: needed };

      digTarget.left--;
      spawnCrumbs(hit.x, hit.y, hit.z, BLOCKS[broken] ? BLOCKS[broken].color : 0x888888);
      if (digTarget.left > 0) {                         // crack... keep hitting!
        blip(220 + digTarget.left * 60, 0.08);
        return;
      }
      digTarget = null;
      setBlock(hit.x, hit.y, hit.z, AIR);
      rebuildAt(hit.x, hit.z);
      saveSoon();
      blip(160, 0.12);
    } else if (button === 2) {                          // place
      const px = hit.x + hit.face[0];
      const py = hit.y + hit.face[1];
      const pz = hit.z + hit.face[2];
      if (inWorld(px, py, pz) && !isSolid(px, py, pz) && !placeWouldTouchPlayer(px, py, pz)) {
        setBlock(px, py, pz, HOTBAR[selected]);
        rebuildAt(px, pz);
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
    updateButterflies(now / 1000);
    updateBirds(now / 1000);
    updateParticles(dt);
    updateSunShadow();
    updateChunkVisibility(dt);
    maybeChirp(now / 1000);
    sky.position.copy(camera.position);       // the sky always surrounds you

    // clouds drift gently and loop around the world
    for (const cloud of clouds) {
      cloud.position.x += 1.1 * dt;
      if (cloud.position.x > WX + 50) cloud.position.x = -50;
    }
    texs.water.offset.x = (now / 9000) % 1;   // water shimmer

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
  spawnAnimals(55);
  spawnButterflies(36);
  spawnBirds(10);
  buildHotbar();
  updateInv();
  updateHunger();
  updateHearts();
  updateTools();
  requestAnimationFrame(frame);
})();
