/* =========================================================================
   BLOCK RIVALS — a friendly arena laser-paint-tag game
   Blue team (you + bot buddies) vs Red team (rival bots).
   First team to 30 tags wins the round. Tagged players pop into
   confetti and respawn — nobody gets hurt for real.
   ========================================================================= */

"use strict";

/* ------------------------------------------------------------------ *
 *  Basic setup
 * ------------------------------------------------------------------ */

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x8fd3ff, 90, 220);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 400
);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* lights */
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x7a9a5a, 0.75));
const sun = new THREE.DirectionalLight(0xfff3d0, 0.9);
sun.position.set(45, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 220;
scene.add(sun);

/* a big happy sun in the sky */
const sunBall = new THREE.Mesh(
  new THREE.SphereGeometry(7, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfff2a8, fog: false })
);
sunBall.position.set(120, 130, 60);
scene.add(sunBall);

/* fluffy clouds */
const clouds = [];
for (let i = 0; i < 10; i++) {
  const cloud = new THREE.Group();
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xf4f9ff });
  const puffs = 3 + Math.floor(Math.random() * 3);
  for (let p = 0; p < puffs; p++) {
    const puff = new THREE.Mesh(
      new THREE.BoxGeometry(8 + Math.random() * 8, 3, 6 + Math.random() * 6),
      puffMat
    );
    puff.position.set(p * 6 - puffs * 3, Math.random() * 1.5, Math.random() * 4);
    cloud.add(puff);
  }
  cloud.position.set(
    (Math.random() - 0.5) * 340,
    55 + Math.random() * 25,
    (Math.random() - 0.5) * 340
  );
  cloud.userData.speed = 0.4 + Math.random() * 0.6;
  scene.add(cloud);
  clouds.push(cloud);
}

/* ------------------------------------------------------------------ *
 *  Tiny synth sound effects (no audio files needed)
 * ------------------------------------------------------------------ */

let audioCtx = null;
function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function tone(freq, dur, { type = "square", vol = 0.12, slide = 0, delay = 0 } = {}) {
  try {
    const ctx = audio();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* audio is optional */ }
}
function noiseBurst(dur, { vol = 0.15, delay = 0 } = {}) {
  try {
    const ctx = audio();
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(t0);
  } catch (e) { /* audio is optional */ }
}
const sfx = {
  blaster()  { tone(880, 0.08, { type: "square", vol: 0.09, slide: -500 }); },
  scatter()  { noiseBurst(0.22, { vol: 0.22 }); tone(160, 0.15, { type: "sawtooth", vol: 0.1, slide: -80 }); },
  sniper()   { tone(1500, 0.25, { type: "sawtooth", vol: 0.1, slide: -1300 }); },
  launcher() { tone(220, 0.25, { type: "triangle", vol: 0.16, slide: 200 }); },
  explode()  { noiseBurst(0.45, { vol: 0.3 }); tone(90, 0.4, { type: "sine", vol: 0.25, slide: -50 }); },
  minigun()  { tone(650 + Math.random() * 250, 0.04, { type: "square", vol: 0.07, slide: -300 }); },
  hit()      { tone(1300, 0.05, { type: "square", vol: 0.1 }); },
  tag()      { tone(600, 0.09, { vol: 0.12 }); tone(900, 0.09, { vol: 0.12, delay: 0.08 }); tone(1200, 0.14, { vol: 0.12, delay: 0.16 }); },
  hurt()     { tone(220, 0.15, { type: "sawtooth", vol: 0.12, slide: -100 }); },
  reload()   { tone(500, 0.05, { vol: 0.08 }); tone(700, 0.05, { vol: 0.08, delay: 0.12 }); },
  jump()     { tone(400, 0.1, { type: "triangle", vol: 0.07, slide: 250 }); },
  dash()     { noiseBurst(0.18, { vol: 0.1 }); tone(300, 0.18, { type: "triangle", vol: 0.1, slide: 500 }); },
  respawn()  { tone(500, 0.08, { vol: 0.1 }); tone(750, 0.12, { vol: 0.1, delay: 0.09 }); },
  win()      { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { vol: 0.14, delay: i * 0.16 })); },
  lose()     { [400, 350, 300, 250].forEach((f, i) => tone(f, 0.25, { type: "triangle", vol: 0.14, delay: i * 0.18 })); },
};

/* ------------------------------------------------------------------ *
 *  The arena
 * ------------------------------------------------------------------ */

const colliders = [];   // world boxes you can't walk through

const ARENA_X = 64;     // half-size, left/right
const ARENA_Z = 44;     // half-size, blue side -z ... red side +z

function checkerTexture(c1, c2, n = 8) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  const s = 128 / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? c1 : c2;
      g.fillRect(x * s, y * s, s, s);
    }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/* floor */
{
  const tex = checkerTexture("#9ccc65", "#8bbf58", 2);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ARENA_X / 2, ARENA_Z / 2);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_X * 2, 1, ARENA_Z * 2),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);
}
/* ground far beyond the walls, just for looks */
{
  const far = new THREE.Mesh(
    new THREE.BoxGeometry(600, 1, 600),
    new THREE.MeshLambertMaterial({ color: 0x7fb356 })
  );
  far.position.y = -0.55;
  far.receiveShadow = true;
  scene.add(far);
}

function addBlock(x, y, z, w, h, d, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (!opts.noCollide) {
    colliders.push({
      min: new THREE.Vector3(x - w / 2, y, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h, z + d / 2),
    });
  }
  return mesh;
}

/* mirrored helper: builds the same block on both halves of the arena */
function addMirrored(x, y, z, w, h, d, color) {
  addBlock(x, y, -z, w, h, d, color);
  addBlock(-x, y, z, w, h, d, color);
}

const C = {
  wall: 0xd8cfc0, crateA: 0xe8a33d, crateB: 0xc98a2b, cover: 0x9aa7b5,
  blue: 0x3f6fd8, red: 0xd84a3f, center: 0xb08cd8, accent: 0x5ec9c0,
};

/* perimeter walls */
addBlock(0, 0, -ARENA_Z - 1, ARENA_X * 2 + 4, 7, 2, C.wall);
addBlock(0, 0, ARENA_Z + 1, ARENA_X * 2 + 4, 7, 2, C.wall);
addBlock(-ARENA_X - 1, 0, 0, 2, 7, ARENA_Z * 2 + 4, C.wall);
addBlock(ARENA_X + 1, 0, 0, 2, 7, ARENA_Z * 2 + 4, C.wall);

/* team base pads (just paint, walk right over them) */
{
  const bluePad = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: C.blue })
  );
  bluePad.position.set(0, 0.06, -ARENA_Z + 7);
  bluePad.receiveShadow = true;
  scene.add(bluePad);
  const redPad = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: C.red })
  );
  redPad.position.set(0, 0.06, ARENA_Z - 7);
  redPad.receiveShadow = true;
  scene.add(redPad);
}

/* center hill — climbable steps up to a party platform */
addBlock(0, 0, 0, 18, 1, 14, C.center);
addBlock(0, 1, 0, 12, 1, 9, C.center);
addBlock(0, 2, 0, 7, 1, 5, 0x8f6bc4);

/* cover walls near the middle */
addMirrored(10, 0, 8, 8, 2.4, 1.2, C.cover);
addMirrored(-14, 0, 4, 1.2, 2.4, 8, C.cover);

/* crate clusters (climbable stairs of crates) */
function crateStack(x, z) {
  addBlock(x, 0, z, 2.4, 2.4, 2.4, C.crateA);
  addBlock(x + 2.4, 0, z, 2.4, 1.2, 2.4, C.crateB);
  addBlock(x, 2.4, z, 2.4, 1.2, 2.4, C.crateB);
}
crateStack(-24, -14); crateStack(24, 14);
crateStack(28, -16);  crateStack(-28, 16);
addMirrored(40, 0, 10, 2.4, 2.4, 2.4, C.crateA);
addMirrored(46, 0, 22, 2.4, 3.6, 2.4, C.crateB);

/* side towers with a lookout */
function tower(x, z) {
  addBlock(x, 0, z, 6, 1.2, 6, C.accent);
  addBlock(x, 1.2, z, 4.5, 1.2, 4.5, C.accent);
  addBlock(x, 2.4, z, 3, 1.2, 3, 0x46b0a8);
}
tower(-48, 0); tower(48, 0);

/* long cover walls on each flank */
addMirrored(30, 0, 30, 10, 2.2, 1.2, C.cover);
addMirrored(-42, 0, 12, 1.2, 2.2, 10, C.cover);

/* happy little trees outside the walls (looks only) */
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2;
  const r = 92 + Math.random() * 30;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  addBlock(x, 0, z, 1.4, 5, 1.4, 0x7a5230, { noCollide: true });
  addBlock(x, 4.5, z, 5, 4, 5, 0x4e9c3f, { noCollide: true });
}

/* spawn points */
const SPAWNS = {
  blue: [
    new THREE.Vector3(-8, 1.2, -ARENA_Z + 6),
    new THREE.Vector3(0, 1.2, -ARENA_Z + 8),
    new THREE.Vector3(8, 1.2, -ARENA_Z + 6),
    new THREE.Vector3(-16, 1.2, -ARENA_Z + 10),
  ],
  red: [
    new THREE.Vector3(-8, 1.2, ARENA_Z - 6),
    new THREE.Vector3(0, 1.2, ARENA_Z - 8),
    new THREE.Vector3(8, 1.2, ARENA_Z - 6),
    new THREE.Vector3(16, 1.2, ARENA_Z - 10),
  ],
};
function pickSpawn(team) {
  const list = SPAWNS[team];
  return list[Math.floor(Math.random() * list.length)].clone();
}

/* ------------------------------------------------------------------ *
 *  Collision helpers
 * ------------------------------------------------------------------ */

function overlaps(pos, half, box) {
  return (
    pos.x + half.x > box.min.x && pos.x - half.x < box.max.x &&
    pos.y + half.y > box.min.y && pos.y - half.y < box.max.y &&
    pos.z + half.z > box.min.z && pos.z - half.z < box.max.z
  );
}

/* Move a box-shaped character, sliding along walls. Mutates pos/vel.
   Returns true when standing on something. */
function moveCharacter(pos, vel, half, dt) {
  let onGround = false;
  const delta = { x: vel.x * dt, y: vel.y * dt, z: vel.z * dt };
  for (const axis of ["x", "y", "z"]) {
    pos[axis] += delta[axis];
    for (const box of colliders) {
      if (!overlaps(pos, half, box)) continue;
      if (axis === "y") {
        if (delta.y < 0) { pos.y = box.max.y + half.y; onGround = true; }
        else pos.y = box.min.y - half.y;
        vel.y = 0;
      } else if (axis === "x") {
        pos.x = delta.x > 0 ? box.min.x - half.x : box.max.x + half.x;
        vel.x = 0;
      } else {
        pos.z = delta.z > 0 ? box.min.z - half.z : box.max.z + half.z;
        vel.z = 0;
      }
    }
  }
  /* the ground itself */
  if (pos.y - half.y < 0) {
    pos.y = half.y;
    if (vel.y < 0) vel.y = 0;
    onGround = true;
  }
  return onGround;
}

/* ray vs one AABB (slab method) — returns distance t or Infinity */
function rayBox(origin, dir, box) {
  let tmin = 0, tmax = Infinity;
  for (const axis of ["x", "y", "z"]) {
    const o = origin[axis], d = dir[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < box.min[axis] || o > box.max[axis]) return Infinity;
    } else {
      let t1 = (box.min[axis] - o) / d;
      let t2 = (box.max[axis] - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}
function rayWorld(origin, dir, maxDist) {
  let best = maxDist;
  for (const box of colliders) {
    const t = rayBox(origin, dir, box);
    if (t < best) best = t;
  }
  return best;
}

/* ------------------------------------------------------------------ *
 *  Roblox-style blocky avatars
 * ------------------------------------------------------------------ */

function faceTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  g.fillStyle = "#f5c542";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#222";
  g.fillRect(16, 20, 8, 12);   // eyes
  g.fillRect(40, 20, 8, 12);
  g.strokeStyle = "#222";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 40, 12, 0.15 * Math.PI, 0.85 * Math.PI); // big smile
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
const FACE_TEX = faceTexture();

function nameSprite(name, teamColor) {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 64;
  const g = cv.getContext("2d");
  g.font = "bold 34px 'Comic Sans MS', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,0.45)";
  const w = Math.min(250, g.measureText(name).width + 30);
  g.fillRect(128 - w / 2, 8, w, 48);
  g.fillStyle = teamColor;
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  return sprite;
}

/* builds a blocky avatar; the group's +z is its face direction */
function buildAvatar(team, name) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: team === "blue" ? C.blue : C.red });
  const pants = new THREE.MeshLambertMaterial({ color: team === "blue" ? 0x2a4a94 : 0x942e26 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf5c542 });
  const faceMats = [skin, skin, skin, skin, new THREE.MeshLambertMaterial({ map: FACE_TEX }), skin];

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.5), shirt);
  torso.position.y = 0.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), faceMats);
  head.position.y = 1.0;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.42), skin);
  armL.position.set(-0.68, 0.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.68;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.0, 0.46), pants);
  legL.position.set(-0.26, -0.9, 0);
  const legR = legL.clone();
  legR.position.x = 0.26;

  /* little blaster in the right hand */
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.24, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x444a52 })
  );
  gun.position.set(0.68, 0.05, 0.5);

  const tag = nameSprite(name, team === "blue" ? "#9ec5ff" : "#ffb3ab");
  tag.position.y = 1.75;

  for (const part of [torso, head, armL, armR, legL, legR, gun]) {
    part.castShadow = true;
    g.add(part);
  }
  g.add(tag);
  g.userData = { armL, armR, legL, legR, head };
  return g;
}

/* ------------------------------------------------------------------ *
 *  Particles & tracers
 * ------------------------------------------------------------------ */

const particles = [];
const PARTICLE_GEO = new THREE.BoxGeometry(0.18, 0.18, 0.18);
function burst(pos, colorList, count, speed) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      PARTICLE_GEO,
      new THREE.MeshBasicMaterial({ color: colorList[i % colorList.length] })
    );
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      mesh: m,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.9 + 2,
        (Math.random() - 0.5) * speed
      ),
      life: 0.9 + Math.random() * 0.7,
    });
  }
}
const CONFETTI = [0xff5252, 0xffe14d, 0x5ec9c0, 0x7db4ff, 0xb08cd8, 0x9ccc65];
function confetti(pos) { burst(pos, CONFETTI, 34, 9); }

const tracers = [];
function tracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  scene.add(line);
  tracers.push({ line, life: 0.12 });
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= 16 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 6;
    p.mesh.rotation.z += dt * 5;
    if (p.mesh.position.y < 0.05) {
      p.mesh.position.y = 0.05;
      p.vel.y *= -0.35; p.vel.x *= 0.7; p.vel.z *= 0.7;
    }
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Weapons
 * ------------------------------------------------------------------ */

const WEAPONS = [
  { name: "Blaster",    icon: "🔫", dmg: 11, rate: 8,   mag: 25, reload: 1.3, auto: true,  spread: 0.02,  pellets: 1, sound: "blaster",  tracerColor: 0x7df9ff },
  { name: "Scatter",    icon: "💥", dmg: 7,  rate: 1.6, mag: 6,  reload: 1.8, auto: false, spread: 0.085, pellets: 7, sound: "scatter",  tracerColor: 0xffd24d },
  { name: "Zap Bow",    icon: "⚡", dmg: 60, rate: 0.9, mag: 4,  reload: 2.1, auto: false, spread: 0.002, pellets: 1, sound: "sniper",   tracerColor: 0xffffff },
  { name: "Paint Bomb", icon: "🎨", dmg: 55, rate: 0.8, mag: 3,  reload: 2.3, auto: false, spread: 0,     pellets: 1, sound: "launcher", tracerColor: 0xff7ad9, projectile: true, radius: 4.5, speed: 26 },
  { name: "Minigun",    icon: "🌀", dmg: 6,  rate: 15,  mag: 60, reload: 2.6, auto: true,  spread: 0.05,  pellets: 1, sound: "minigun",  tracerColor: 0xaef25d, spinup: true },
];

/* ------------------------------------------------------------------ *
 *  The player
 * ------------------------------------------------------------------ */

const GOAL = 30;
const PLAYER_HALF = new THREE.Vector3(0.4, 0.95, 0.4);
const EYE = 0.72;              // eye height above body center

const player = {
  name: "YOU",
  team: "blue",
  pos: pickSpawn("blue"),
  vel: new THREE.Vector3(),
  yaw: Math.PI,                // face the red side
  pitch: 0,
  hp: 100,
  alive: true,
  respawnT: 0,
  invulnT: 2,
  onGround: false,
  jumpsLeft: 2,
  dashCd: 0,
  hurtT: 99,                   // time since last damage (for regen)
  weapon: 0,
  spin: 0,                     // minigun barrel rev, 0..1
  ammo: WEAPONS.map(w => w.mag),
  reloading: 0,
  fireCd: 0,
  tags: 0,
  outs: 0,
};

const keys = {};
let mouseDown = false;

/* ------------------------------------------------------------------ *
 *  View-model (the gun you see in your hands)
 * ------------------------------------------------------------------ */

const viewmodel = new THREE.Group();
camera.add(viewmodel);
scene.add(camera);

const gunModels = WEAPONS.map((w, i) => {
  const g = new THREE.Group();
  const bodyColor = [0x4a90d8, 0xe8873d, 0xbfa5ee, 0xff7ad9, 0x8fd85a][i];
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.16, 0.55),
    new THREE.MeshLambertMaterial({ color: bodyColor })
  );
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.18, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x39404a })
  );
  grip.position.set(0, -0.14, 0.15);
  g.add(body, grip);
  if (w.spinup) {               // ring of six spinning barrels
    const spinner = new THREE.Group();
    for (let b = 0; b < 6; b++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 0.5),
        new THREE.MeshLambertMaterial({ color: b % 2 ? 0x39404a : 0x2c3138 })
      );
      const a = (b / 6) * Math.PI * 2;
      bar.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, -0.45);
      spinner.add(bar);
    }
    spinner.position.set(0, 0.03, 0);
    g.add(spinner);
    g.userData.spinner = spinner;
  } else {
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x39404a })
    );
    barrel.position.set(0, 0.03, -0.4);
    g.add(barrel);
  }
  if (w.pellets > 1) {          // wider mouth for the scatter blaster
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x2c3138 })
    );
    mouth.position.set(0, 0.03, -0.55);
    g.add(mouth);
  }
  if (w.projectile) {           // fat paint tank
    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x7db4ff })
    );
    tank.position.set(0, 0.16, 0.05);
    g.add(tank);
  }
  g.position.set(0.26, -0.24, -0.5);
  g.scale.setScalar(0.32);
  g.visible = i === 0;
  viewmodel.add(g);
  return g;
});
const muzzleFlash = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.12, 0.12),
  new THREE.MeshBasicMaterial({ color: 0xfff2a8 })
);
muzzleFlash.position.set(0.3, -0.25, -0.85);
muzzleFlash.scale.setScalar(0.7);
muzzleFlash.visible = false;
viewmodel.add(muzzleFlash);
let recoil = 0;
let flashT = 0;

/* ------------------------------------------------------------------ *
 *  Bots
 * ------------------------------------------------------------------ */

const BOT_HALF = new THREE.Vector3(0.5, 1.1, 0.5);
const BOT_NAMES = {
  blue: ["Zippy", "Doodle", "Pixel"],
  red: ["NoobMaster", "Turbo", "Sparkle", "BlockNinja"],
};
const bots = [];

function makeBot(team, name) {
  const group = buildAvatar(team, name);
  scene.add(group);
  const bot = {
    name, team, group,
    pos: pickSpawn(team),
    vel: new THREE.Vector3(),
    hp: 100,
    alive: true,
    respawnT: 0,
    invulnT: 2,
    shootT: 1 + Math.random() * 2,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeT: 1 + Math.random() * 2,
    jumpT: 2 + Math.random() * 3,
    idealRange: 9 + Math.random() * 8,
    aim: 0.5 + Math.random() * 0.35,   // higher = better shot
    walkPhase: Math.random() * 10,
    tags: 0,
    outs: 0,
  };
  bots.push(bot);
  return bot;
}
BOT_NAMES.blue.forEach(n => makeBot("blue", n));
BOT_NAMES.red.forEach(n => makeBot("red", n));

function botHeadPos(bot) {
  return new THREE.Vector3(bot.pos.x, bot.pos.y + 0.85, bot.pos.z);
}
function botBoxes(bot) {
  const p = bot.pos;
  return {
    head: {
      min: new THREE.Vector3(p.x - 0.36, p.y + 0.5, p.z - 0.36),
      max: new THREE.Vector3(p.x + 0.36, p.y + 1.25, p.z + 0.36),
    },
    body: {
      min: new THREE.Vector3(p.x - 0.5, p.y - 1.1, p.z - 0.5),
      max: new THREE.Vector3(p.x + 0.5, p.y + 0.5, p.z + 0.5),
    },
  };
}

/* everyone on the other team who is still in play */
function enemiesOf(team) {
  const list = bots.filter(b => b.team !== team && b.alive);
  if (player.team !== team && player.alive) list.push(player);
  return list;
}
function centerOf(who) {
  return new THREE.Vector3(who.pos.x, who.pos.y + (who === player ? 0.3 : 0.2), who.pos.z);
}

/* ------------------------------------------------------------------ *
 *  Scores, kill feed, HUD
 * ------------------------------------------------------------------ */

const scores = { blue: 0, red: 0 };
let roundOver = false;
let roundResetT = 0;

const el = id => document.getElementById(id);
const feedEl = el("feed");

function addFeed(shooter, victim) {
  const line = document.createElement("div");
  line.className = "feedline";
  line.innerHTML =
    `<b class="${shooter.team}">${shooter.name}</b> 🎨 tagged <b class="${victim.team}">${victim.name}</b>`;
  feedEl.appendChild(line);
  while (feedEl.children.length > 5) feedEl.removeChild(feedEl.firstChild);
  setTimeout(() => { if (line.parentNode) line.parentNode.removeChild(line); }, 5000);
}

function showToast(msg, ms = 2200) {
  const t = el("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (t.style.display = "none"), ms);
}

function showBanner(msg, ms) {
  const b = el("banner");
  b.textContent = msg;
  b.style.display = "block";
  clearTimeout(showBanner._t);
  if (ms) showBanner._t = setTimeout(() => (b.style.display = "none"), ms);
}
function hideBanner() { el("banner").style.display = "none"; }

function updateScoreHud() {
  el("scoreBlue").textContent = scores.blue;
  el("scoreRed").textContent = scores.red;
}

/* weapon slot HUD */
const weaponSlots = WEAPONS.map((w, i) => {
  const div = document.createElement("div");
  div.className = "wslot";
  div.textContent = `${i + 1}  ${w.icon} ${w.name}`;
  el("weapons").appendChild(div);
  return div;
});

function updateHud() {
  el("healthBar").style.width = Math.max(0, player.hp) + "%";
  el("healthBar").style.background =
    player.hp > 50 ? "linear-gradient(#7dff7d,#2fbf2f)"
    : player.hp > 25 ? "linear-gradient(#ffe14d,#d8a52f)"
    : "linear-gradient(#ff7d7d,#bf2f2f)";
  const w = WEAPONS[player.weapon];
  el("ammoNum").textContent = `${player.ammo[player.weapon]} / ${w.mag}`;
  el("weapName").textContent = `${w.icon} ${w.name}`;
  el("reloadNote").textContent =
    player.reloading > 0 ? "reloading…"
    : player.ammo[player.weapon] === 0 ? "press R!" : "";
  el("abDash").className = "ability" + (player.dashCd <= 0 ? " ready" : "");
  el("abJump").className = "ability" + (player.jumpsLeft > 0 ? " ready" : "");
  for (let i = 0; i < WEAPONS.length; i++)
    weaponSlots[i].className = "wslot" + (i === player.weapon ? " sel" : "");
}

/* scoreboard (hold TAB) */
function refreshBoard() {
  const everyone = [player, ...bots].sort((a, b) => b.tags - a.tags);
  let html = `<h3 style="margin:0 0 8px">🏆 Scoreboard — first to ${GOAL}</h3>
    <table><tr><th>Player</th><th>Tags</th><th>Outs</th></tr>`;
  for (const p of everyone) {
    html += `<tr class="${p.team}"><td>${p.name}${p === player ? " ⭐" : ""}</td>
      <td>${p.tags}</td><td>${p.outs}</td></tr>`;
  }
  el("board").innerHTML = html + "</table>";
}

function showHitmarker() {
  const h = el("hitmarker");
  h.style.opacity = 1;
  clearTimeout(showHitmarker._t);
  showHitmarker._t = setTimeout(() => (h.style.opacity = 0), 120);
}

/* ------------------------------------------------------------------ *
 *  Damage & tagging
 * ------------------------------------------------------------------ */

function tagOut(victim, shooter) {
  victim.alive = false;
  victim.respawnT = 3;
  victim.outs++;
  shooter.tags++;
  scores[shooter.team]++;
  updateScoreHud();
  addFeed(shooter, victim);
  confetti(victim === player
    ? new THREE.Vector3(player.pos.x, player.pos.y, player.pos.z)
    : botHeadPos(victim));
  sfx.tag();

  if (victim === player) {
    showBanner("💦 You got tagged!\nRespawning…");
    el("hurt").style.opacity = 0.6;
  } else {
    victim.group.visible = false;
  }
  if (shooter === player) showToast(`🎉 You tagged ${victim.name}!`, 1600);

  if (!roundOver && scores[shooter.team] >= GOAL) endRound(shooter.team);
}

function damage(victim, amount, shooter) {
  if (!victim.alive || roundOver) return;
  if (victim.invulnT > 0) return;
  victim.hp -= amount;
  if (victim === player) {
    player.hurtT = 0;
    el("hurt").style.opacity = Math.min(0.85, 0.3 + (100 - player.hp) / 130);
    setTimeout(() => { if (player.alive) el("hurt").style.opacity = 0; }, 220);
    sfx.hurt();
  }
  if (shooter === player) { showHitmarker(); sfx.hit(); }
  if (victim.hp <= 0) tagOut(victim, shooter);
}

function respawn(who) {
  who.pos.copy(pickSpawn(who.team));
  who.vel.set(0, 0, 0);
  who.hp = 100;
  who.alive = true;
  who.invulnT = 2;
  if (who === player) {
    player.jumpsLeft = 2;
    player.reloading = 0;
    player.hurtT = 99;
    player.ammo = WEAPONS.map(w => w.mag);
    el("hurt").style.opacity = 0;
    if (!roundOver) hideBanner();
    sfx.respawn();
  } else {
    who.group.visible = true;
  }
}

/* ------------------------------------------------------------------ *
 *  Round flow
 * ------------------------------------------------------------------ */

function endRound(winner) {
  roundOver = true;
  roundResetT = 6;
  if (winner === player.team) {
    showBanner(`🏆 BLUE TEAM WINS! 🏆\n${scores.blue} – ${scores.red}\nNew round starting…`);
    sfx.win();
    for (let i = 0; i < 5; i++)
      setTimeout(() => confetti(new THREE.Vector3(
        player.pos.x + (Math.random() - 0.5) * 8, player.pos.y + 2,
        player.pos.z + (Math.random() - 0.5) * 8)), i * 300);
  } else {
    showBanner(`😅 Red team wins this one!\n${scores.blue} – ${scores.red}\nRematch starting…`);
    sfx.lose();
  }
}

function resetRound() {
  roundOver = false;
  scores.blue = 0;
  scores.red = 0;
  player.tags = 0; player.outs = 0;
  for (const b of bots) { b.tags = 0; b.outs = 0; }
  updateScoreHud();
  hideBanner();
  respawn(player);
  for (const b of bots) respawn(b);
  showToast("🔔 New round — go go go!", 2000);
}

/* ------------------------------------------------------------------ *
 *  Shooting (player)
 * ------------------------------------------------------------------ */

const projectiles = [];

function cameraDir() {
  const d = new THREE.Vector3(0, 0, -1);
  d.applyQuaternion(camera.quaternion);
  return d;
}
function muzzleWorld() {
  const d = cameraDir();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  return camera.position.clone()
    .addScaledVector(d, 0.7)
    .addScaledVector(right, 0.25)
    .add(new THREE.Vector3(0, -0.2, 0));
}
function spreadDir(base, amount) {
  return base.clone()
    .add(new THREE.Vector3(
      (Math.random() - 0.5) * amount * 2,
      (Math.random() - 0.5) * amount * 2,
      (Math.random() - 0.5) * amount * 2))
    .normalize();
}

function startReload() {
  const w = WEAPONS[player.weapon];
  if (player.reloading > 0 || player.ammo[player.weapon] === w.mag) return;
  player.reloading = w.reload;
  sfx.reload();
}

function playerShoot() {
  const w = WEAPONS[player.weapon];
  if (player.fireCd > 0 || player.reloading > 0 || !player.alive || roundOver) return;
  if (player.ammo[player.weapon] <= 0) { startReload(); return; }
  if (w.spinup && player.spin < 1) return;   // barrels still revving up

  player.ammo[player.weapon]--;
  player.fireCd = 1 / w.rate;
  recoil = 1;
  flashT = 0.05;
  sfx[w.sound]();

  const origin = camera.position.clone();
  const muzzle = muzzleWorld();

  if (w.projectile) {
    const dir = cameraDir();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xff7ad9 })
    );
    mesh.castShadow = true;
    mesh.position.copy(muzzle);
    scene.add(mesh);
    projectiles.push({
      mesh,
      vel: dir.multiplyScalar(w.speed).add(new THREE.Vector3(0, 3, 0)),
      shooter: player,
      dmg: w.dmg,
      radius: w.radius,
      life: 5,
    });
    if (player.ammo[player.weapon] === 0) startReload();
    return;
  }

  for (let p = 0; p < w.pellets; p++) {
    const dir = spreadDir(cameraDir(), w.spread);
    let bestT = rayWorld(origin, dir, 150);
    let hitBot = null, headshot = false;
    for (const bot of bots) {
      if (!bot.alive || bot.team === player.team) continue;
      const boxes = botBoxes(bot);
      const tHead = rayBox(origin, dir, boxes.head);
      const tBody = rayBox(origin, dir, boxes.body);
      const t = Math.min(tHead, tBody);
      if (t < bestT) { bestT = t; hitBot = bot; headshot = tHead <= tBody; }
    }
    const end = origin.clone().addScaledVector(dir, bestT);
    tracer(muzzle, end, w.tracerColor);
    if (hitBot) {
      burst(end, [w.tracerColor, 0xffffff], 4, 4);
      damage(hitBot, headshot ? w.dmg * 2 : w.dmg, player);
      if (headshot) showToast("💫 Headshot!", 700);
    } else if (bestT < 150) {
      burst(end, [w.tracerColor], 3, 3);
    }
  }
  if (player.ammo[player.weapon] === 0) startReload();
}

/* paint bombs */
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.life -= dt;
    pr.vel.y -= 14 * dt;
    pr.mesh.position.addScaledVector(pr.vel, dt);
    const p = pr.mesh.position;
    let boom = pr.life <= 0 || p.y <= 0.25;
    if (!boom) {
      for (const box of colliders) {
        if (p.x > box.min.x - 0.25 && p.x < box.max.x + 0.25 &&
            p.y > box.min.y - 0.25 && p.y < box.max.y + 0.25 &&
            p.z > box.min.z - 0.25 && p.z < box.max.z + 0.25) { boom = true; break; }
      }
    }
    if (!boom) {
      for (const enemy of enemiesOf(pr.shooter.team)) {
        if (centerOf(enemy).distanceTo(p) < 1.2) { boom = true; break; }
      }
    }
    if (boom) {
      explode(p, pr.radius, pr.dmg, pr.shooter);
      scene.remove(pr.mesh);
      pr.mesh.material.dispose();
      projectiles.splice(i, 1);
    }
  }
}

function explode(pos, radius, dmg, shooter) {
  sfx.explode();
  burst(pos, [0xff7ad9, 0xffe14d, 0xffffff], 26, 11);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.6, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0.7 })
  );
  flash.position.copy(pos);
  scene.add(flash);
  let t = 0;
  const grow = () => {
    t += 0.05;
    flash.scale.setScalar(1 + t * 2.2);
    flash.material.opacity = Math.max(0, 0.7 * (1 - t / 0.4));
    if (t < 0.4) requestAnimationFrame(grow);
    else { scene.remove(flash); flash.material.dispose(); }
  };
  grow();
  for (const enemy of enemiesOf(shooter.team)) {
    const d = centerOf(enemy).distanceTo(pos);
    if (d < radius) {
      const falloff = 1 - (d / radius) * 0.6;
      damage(enemy, Math.round(dmg * falloff), shooter);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Bot brains
 * ------------------------------------------------------------------ */

function botShoot(bot, target, dt) {
  bot.shootT -= dt;
  if (bot.shootT > 0) return;
  const from = botHeadPos(bot);
  const targetPos = centerOf(target);
  const dist = from.distanceTo(targetPos);
  if (dist > 42) return;

  /* line of sight? */
  const dir0 = targetPos.clone().sub(from).normalize();
  if (rayWorld(from, dir0, dist) < dist - 0.6) return;   // a wall is in the way

  bot.shootT = 0.55 + Math.random() * 0.7;

  /* aim with some wobble — better bots wobble less, far shots wobble more */
  const wobble = (1.1 - bot.aim) * 0.05 * (1 + dist / 22);
  const dir = spreadDir(dir0, wobble);
  const worldT = rayWorld(from, dir, dist + 4);
  let hit = false, hitT = dist;

  if (target === player) {
    const box = {
      min: new THREE.Vector3(player.pos.x - PLAYER_HALF.x, player.pos.y - PLAYER_HALF.y, player.pos.z - PLAYER_HALF.z),
      max: new THREE.Vector3(player.pos.x + PLAYER_HALF.x, player.pos.y + PLAYER_HALF.y, player.pos.z + PLAYER_HALF.z),
    };
    const t = rayBox(from, dir, box);
    if (t < worldT) { hit = true; hitT = t; }
  } else {
    const boxes = botBoxes(target);
    const t = Math.min(rayBox(from, dir, boxes.head), rayBox(from, dir, boxes.body));
    if (t < worldT) { hit = true; hitT = t; }
  }

  const end = from.clone().addScaledVector(dir, hit ? hitT : Math.min(worldT, dist + 4));
  tracer(from, end, bot.team === "red" ? 0xff9d7a : 0x7df9ff);
  tone(760 + Math.random() * 200, 0.05, { vol: 0.03, slide: -300 });
  if (hit) {
    burst(end, [bot.team === "red" ? 0xff9d7a : 0x7df9ff], 3, 3);
    damage(target, 8 + Math.floor(Math.random() * 5), bot);
  }
}

function updateBot(bot, dt) {
  if (!bot.alive) {
    bot.respawnT -= dt;
    if (bot.respawnT <= 0 && !roundOver) respawn(bot);
    return;
  }
  bot.invulnT = Math.max(0, bot.invulnT - dt);

  /* pick the closest enemy */
  let target = null, bestD = Infinity;
  for (const enemy of enemiesOf(bot.team)) {
    const d = bot.pos.distanceTo(enemy.pos);
    if (d < bestD) { bestD = d; target = enemy; }
  }

  /* steering: close in to a comfy range, strafe side to side */
  const speed = 5.2;
  const move = new THREE.Vector3();
  if (target && !roundOver) {
    const tp = target.pos;
    const toT = new THREE.Vector3(tp.x - bot.pos.x, 0, tp.z - bot.pos.z);
    const dist = toT.length();
    toT.normalize();
    const side = new THREE.Vector3(-toT.z, 0, toT.x);

    bot.strafeT -= dt;
    if (bot.strafeT <= 0) {
      bot.strafeDir *= -1;
      bot.strafeT = 0.8 + Math.random() * 1.6;
    }
    if (dist > bot.idealRange + 2) move.add(toT);
    else if (dist < bot.idealRange - 3) move.addScaledVector(toT, -0.8);
    move.addScaledVector(side, bot.strafeDir * 0.8);
    if (move.lengthSq() > 0) move.normalize();

    bot.group.lookAt(tp.x, bot.pos.y, tp.z);
    botShoot(bot, target, dt);
  }

  /* hop over things once in a while, or when stuck against a wall */
  bot.jumpT -= dt;
  const wantJump = bot.jumpT <= 0 ||
    (move.lengthSq() > 0 && Math.abs(bot.vel.x) + Math.abs(bot.vel.z) < 0.6);
  bot.vel.x += (move.x * speed - bot.vel.x) * Math.min(1, dt * 8);
  bot.vel.z += (move.z * speed - bot.vel.z) * Math.min(1, dt * 8);
  bot.vel.y -= 22 * dt;
  const onGround = moveCharacter(bot.pos, bot.vel, BOT_HALF, dt);
  if (onGround && wantJump) {
    bot.vel.y = 8;
    bot.jumpT = 2.5 + Math.random() * 3.5;
  }

  /* keep inside the arena */
  bot.pos.x = Math.max(-ARENA_X + 1, Math.min(ARENA_X - 1, bot.pos.x));
  bot.pos.z = Math.max(-ARENA_Z + 1, Math.min(ARENA_Z - 1, bot.pos.z));

  /* animate limbs while running */
  const running = Math.hypot(bot.vel.x, bot.vel.z) > 1;
  bot.walkPhase += dt * (running ? 11 : 2);
  const swing = Math.sin(bot.walkPhase) * (running ? 0.7 : 0.06);
  const u = bot.group.userData;
  u.armL.rotation.x = swing;
  u.armR.rotation.x = -swing * 0.4;   // gun arm swings less
  u.legL.rotation.x = -swing;
  u.legR.rotation.x = swing;

  bot.group.position.copy(bot.pos);
}

/* ------------------------------------------------------------------ *
 *  Input
 * ------------------------------------------------------------------ */

let locked = false;
const overlay = el("overlay");

el("playBtn").addEventListener("click", () => {
  audio();
  canvas.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
  overlay.style.display = locked ? "none" : "flex";
  for (const id of ["crosshair", "health", "ammo"])
    el(id).style.display = locked ? "block" : "none";
  el("score").style.display = locked ? "flex" : "none";
  el("weapons").style.display = locked ? "flex" : "none";
  el("abilities").style.display = locked ? "flex" : "none";
  el("feed").style.display = locked ? "flex" : "none";
  if (!locked) el("board").style.display = "none";
});

document.addEventListener("mousemove", e => {
  if (!locked) return;
  player.yaw -= e.movementX * 0.0023;
  player.pitch -= e.movementY * 0.0023;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
});
document.addEventListener("mousedown", e => {
  if (!locked) return;
  if (e.button === 0) { mouseDown = true; playerShoot(); }
});
document.addEventListener("mouseup", e => {
  if (e.button === 0) mouseDown = false;
});

document.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (!locked) return;
  if (e.code === "Tab") {
    e.preventDefault();
    refreshBoard();
    el("board").style.display = "block";
  }
  if (e.code === "KeyR") startReload();
  if (e.code === "Space") {
    e.preventDefault();
    if (player.alive && !roundOver) {
      if (player.onGround) {
        player.vel.y = 8.6;
        player.jumpsLeft = 1;
        sfx.jump();
      } else if (player.jumpsLeft > 0) {
        player.vel.y = 8.2;
        player.jumpsLeft--;
        sfx.jump();
        burst(new THREE.Vector3(player.pos.x, player.pos.y - 0.8, player.pos.z),
              [0xffffff, 0x7df9ff], 6, 3);
      }
    }
  }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (player.alive && !roundOver && player.dashCd <= 0) {
      const fwd = cameraDir();
      fwd.y = 0;
      if (fwd.lengthSq() < 0.01) fwd.set(0, 0, -1);
      fwd.normalize();
      /* dash the way you're steering, or forward if standing still */
      const wish = new THREE.Vector3();
      if (keys.KeyW || keys.ArrowUp) wish.add(fwd);
      if (keys.KeyS || keys.ArrowDown) wish.addScaledVector(fwd, -1);
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      if (keys.KeyD || keys.ArrowRight) wish.add(right);
      if (keys.KeyA || keys.ArrowLeft) wish.addScaledVector(right, -1);
      if (wish.lengthSq() < 0.01) wish.copy(fwd);
      wish.normalize();
      player.vel.x = wish.x * 24;
      player.vel.z = wish.z * 24;
      player.dashCd = 3;
      sfx.dash();
    }
  }
  const num = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code];
  if (num !== undefined && num !== player.weapon) {
    player.weapon = num;
    player.spin = 0;
    player.reloading = 0;
    player.fireCd = Math.max(player.fireCd, 0.25);
    gunModels.forEach((g, i) => (g.visible = i === num));
    sfx.reload();
  }
});
document.addEventListener("keyup", e => {
  keys[e.code] = false;
  if (e.code === "Tab") el("board").style.display = "none";
});

/* ------------------------------------------------------------------ *
 *  Player update
 * ------------------------------------------------------------------ */

let bobPhase = 0;

function updatePlayer(dt) {
  if (!player.alive) {
    player.respawnT -= dt;
    if (player.respawnT <= 0 && !roundOver) respawn(player);
    return;
  }
  player.invulnT = Math.max(0, player.invulnT - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);
  player.fireCd = Math.max(0, player.fireCd - dt);
  player.hurtT += dt;

  /* health slowly comes back if you avoid paint for a bit */
  if (player.hurtT > 4 && player.hp < 100)
    player.hp = Math.min(100, player.hp + 22 * dt);

  /* reloading */
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      player.reloading = 0;
      player.ammo[player.weapon] = WEAPONS[player.weapon].mag;
    }
  }

  /* minigun barrels rev up while you hold the button, wind down after */
  const cw = WEAPONS[player.weapon];
  if (cw.spinup) {
    const revving = mouseDown && player.reloading <= 0 && player.ammo[player.weapon] > 0;
    player.spin = Math.max(0, Math.min(1, player.spin + (revving ? dt / 0.45 : -dt * 2)));
    const spinner = gunModels[player.weapon].userData.spinner;
    if (spinner) spinner.rotation.z -= dt * (2 + player.spin * 45);
    if (revving && player.spin < 1 && Math.random() < dt * 22)
      tone(180 + player.spin * 420, 0.06, { type: "triangle", vol: 0.045 });
  } else {
    player.spin = 0;
  }

  /* holding the button down keeps auto weapons firing */
  if (mouseDown && cw.auto) playerShoot();

  /* movement */
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const wish = new THREE.Vector3();
  if (keys.KeyW || keys.ArrowUp) wish.add(forward);
  if (keys.KeyS || keys.ArrowDown) wish.addScaledVector(forward, -1);
  if (keys.KeyD || keys.ArrowRight) wish.add(right);
  if (keys.KeyA || keys.ArrowLeft) wish.addScaledVector(right, -1);
  if (wish.lengthSq() > 0) wish.normalize();

  const speed = 8;
  const accel = player.onGround ? 10 : 3.5;
  player.vel.x += (wish.x * speed - player.vel.x) * Math.min(1, dt * accel);
  player.vel.z += (wish.z * speed - player.vel.z) * Math.min(1, dt * accel);
  player.vel.y -= 22 * dt;

  player.onGround = moveCharacter(player.pos, player.vel, PLAYER_HALF, dt);
  if (player.onGround) player.jumpsLeft = 2;

  player.pos.x = Math.max(-ARENA_X + 0.8, Math.min(ARENA_X - 0.8, player.pos.x));
  player.pos.z = Math.max(-ARENA_Z + 0.8, Math.min(ARENA_Z - 0.8, player.pos.z));

  /* camera */
  const moving = wish.lengthSq() > 0 && player.onGround;
  bobPhase += dt * (moving ? 11 : 0);
  const bob = moving ? Math.sin(bobPhase) * 0.045 : 0;
  camera.position.set(player.pos.x, player.pos.y + EYE + bob, player.pos.z);
  camera.rotation.order = "YXZ";
  camera.rotation.set(player.pitch, player.yaw, 0);

  /* view-model recoil & muzzle flash */
  recoil = Math.max(0, recoil - dt * 8);
  viewmodel.position.set(0, Math.sin(bobPhase * 0.5) * 0.008, recoil * 0.09);
  viewmodel.rotation.x = recoil * 0.12;
  flashT -= dt;
  muzzleFlash.visible = flashT > 0;
  if (muzzleFlash.visible) muzzleFlash.rotation.z += dt * 30;
}

/* ------------------------------------------------------------------ *
 *  Main loop
 * ------------------------------------------------------------------ */

updateScoreHud();
el("scoreGoal").textContent = `first to ${GOAL}`;

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (locked) {
    if (roundOver) {
      roundResetT -= dt;
      if (roundResetT <= 0) resetRound();
    }
    updatePlayer(dt);
    for (const bot of bots) updateBot(bot, dt);
    updateProjectiles(dt);
    updateHud();
  }
  updateEffects(dt);
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 190) cloud.position.x = -190;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
