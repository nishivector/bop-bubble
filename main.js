import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Constants ────────────────────────────────────────────────
const BUBBLE_DRAG       = 0.92;
const BUBBLE_BUOYANCY   = 8;   // px/s²
const BUBBLE_MAX_SPEED  = 120; // px/s
const BUBBLE_RADIUS     = 22;  // px
const THERMAL_RADIUS    = 150; // px
const THERMAL_DURATION  = 1.5; // s (default tap)
const THERMAL_RISE      = 60;  // px/s
const THERMAL_JET_DELAY = 2.0; // s
const THERMAL_JET_RADIUS = 30; // px lethal
const NEAR_MISS_DIST    = 25;  // px
const POP_DIST          = 1;   // px
const GOAL_RADIUS       = 30;  // px
const CAM_LAG           = 0.15;
const FPS_DT            = 1 / 60;

// ── Scene / Renderer ─────────────────────────────────────────
const canvas = document.getElementById('c');
let W = window.innerWidth;
let H = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x5E8FA3);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5E8FA3);

// Orthographic camera — pixel-scale
const camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, -1000, 1000);
camera.position.set(0, 0, 100);

// Bloom
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.65, 0.4, 0.72);
composer.addPass(bloomPass);

// Camera world offset (used for scrolling levels)
let camOffsetY = 0; // world Y that maps to screen center
let camTargetY = 0;

// ── State ─────────────────────────────────────────────────────
let gameState = 'start'; // start | playing | dead | win | between
let hasEverActed = false;
let currentLevel = 0;
let score = 0;
let gameStartTime = 0;
let levelStartTime = 0;
let nearMissChain = 0;
let nearMissTimer = 0;
let lastThermalTime = -999;
let thermalCooldown = 0;

// Bubble physics
let bx = 0, by = 0, bvx = 0, bvy = 0;
let bubbleAlive = true;
let bubbleWinAnim = false;
let bubbleWinT = 0;
let bubbleStartX = 0, bubbleStartY = 0;

// Thermals list
let thermals = [];

// Active air currents
let streams = [];

// Obstacles
let obstacles = [];   // { type:'rect', x,y,w,h } (world coords)
let rotatingPipes = []; // { cx,cy,len,angle,speed,halfW }
let steamVents = [];    // { x,y, ox,oy, phase, period, amplitude, jetOn }
let coldZones = [];     // { x,y,w,h } world coords
let hairDryer = null;   // { x,y, period, burstT, duration, forceX, jetyMin,jetyMax, jetlen }

// Goal
let goalX = 0, goalY = 0;

// Thrill display
let thrillTimer = 0;

// ── Three.js objects ──────────────────────────────────────────
let bubbleMesh = null;
let bubbleRimMesh = null;
let goalMesh = null;
let goalGlowMesh = null;
let thermalMeshes = {}; // id → mesh
let streamMeshes = [];
let coldZoneMeshes = [];
let obstacleMeshes = [];
let pipeMeshes = [];
let ventMeshes = [];
let dreyerMesh = null;
let burstMesh = null;
let nearMissMesh = null;

let sceneGroup = new THREE.Group(); // all game world in here, shifted for camera
scene.add(sceneGroup);

// ── Materials ─────────────────────────────────────────────────
const matBubbleFill = new THREE.MeshBasicMaterial({
  color: 0xE8F0F4, transparent: true, opacity: 0.68, side: THREE.FrontSide
});
const matBubbleRim = new THREE.LineBasicMaterial({ color: 0x7BC8D4, linewidth: 2 });
const matGoal = new THREE.MeshBasicMaterial({ color: 0xF0C070, transparent: true, opacity: 0.9 });
const matCold = new THREE.MeshBasicMaterial({ color: 0xA8D5E2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
const matObstacle = new THREE.MeshBasicMaterial({ color: 0xC97B4B });
const matObstacleEdge = new THREE.LineBasicMaterial({ color: 0xD4956A });
const matJet = new THREE.MeshBasicMaterial({ color: 0xFAFAFA, transparent: true, opacity: 0.7 });
const matBurst = new THREE.MeshBasicMaterial({ color: 0xFAFAFA, transparent: true, opacity: 0 });
const matNearMiss = new THREE.MeshBasicMaterial({ color: 0xF4A261, transparent: true, opacity: 0 });

// ── Audio ─────────────────────────────────────────────────────
let audioReady = false;
let steamPad, glassHarmonica, breathBass, waterDrop, shimmerBell, coldDrone;
let bubbleHum;
let reverbLong, reverbMid, reverbShort;
let musicState = 'drift';

async function initAudio() {
  if (audioReady) return;
  await Tone.start();
  audioReady = true;

  reverbLong  = new Tone.Reverb({ decay: 6,  wet: 0.8  }).toDestination();
  reverbMid   = new Tone.Reverb({ decay: 3,  wet: 0.6  }).toDestination();
  reverbShort = new Tone.Reverb({ decay: 1.5, wet: 0.4 }).toDestination();
  await Promise.all([reverbLong.ready, reverbMid.ready, reverbShort.ready]);

  // 1. Glass Harmonica Lead (AMSynth)
  glassHarmonica = new Tone.AMSynth({
    harmonicity: 8,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 3.0 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 1, release: 2 }
  });
  glassHarmonica.volume.value = -20;
  glassHarmonica.connect(reverbLong);

  // 2. Breath Bass (FMSynth at low freq)
  breathBass = new Tone.FMSynth({
    harmonicity: 0.5,
    modulationIndex: 1.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 1.2, decay: 0.5, sustain: 1, release: 1.5 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 1.0, decay: 0.3, sustain: 1, release: 1.0 }
  });
  breathBass.frequency.value = 55;
  breathBass.volume.value = -30;
  breathBass.connect(reverbMid);

  // 3. Steam Pad (PolySynth)
  steamPad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 2.0, decay: 1.0, sustain: 1.0, release: 4.0 }
  });
  steamPad.set({ maxPolyphony: 4 });
  steamPad.volume.value = -24;
  steamPad.connect(reverbLong);

  // 4. Water Drop Pluck (PluckSynth)
  waterDrop = new Tone.PluckSynth({ resonance: 0.96, dampening: 0.35, attackNoise: 1 });
  waterDrop.volume.value = -18;
  waterDrop.connect(reverbMid);

  // 5. Shimmer Bell (FMSynth - replacing forbidden MetalSynth)
  shimmerBell = new Tone.FMSynth({
    harmonicity: 5.1,
    modulationIndex: 32,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.5 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.2 }
  });
  shimmerBell.frequency.value = 1800;
  shimmerBell.volume.value = -28;
  shimmerBell.connect(reverbMid);

  // 6. Cold Drone (Synth square wave)
  coldDrone = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.5, decay: 0, sustain: 1, release: 2 }
  });
  coldDrone.frequency.value = 65.41; // C2
  const coldFilter = new Tone.Filter(120, 'lowpass');
  const coldTremolo = new Tone.Tremolo({ frequency: 0.3, depth: 0.5 }).start();
  coldDrone.chain(coldTremolo, coldFilter, reverbMid);
  coldDrone.volume.value = -40;

  // 7. Bubble ambient hum
  const humOsc = new Tone.Oscillator({ frequency: 180, type: 'sine' }).toDestination();
  const humTremolo = new Tone.Tremolo({ frequency: 4, depth: 0.1 }).start();
  humOsc.connect(humTremolo);
  humTremolo.toDestination();
  bubbleHum = humOsc;
  bubbleHum.volume.value = -36;
  bubbleHum.start();

  // Start screen music - steam pad + harmonica hook
  startScreenMusic();
  scheduleWaterDrops();
}

let waterDropInterval = null;
let waterDropFast = false;
function scheduleWaterDrops() {
  if (waterDropInterval) clearInterval(waterDropInterval);
  const pentatonic = ['C4','Eb4','F4','G4','Bb4'];
  const delay = waterDropFast ? 400 : (2000 + Math.random() * 2000);
  waterDropInterval = setTimeout(() => {
    if (audioReady && waterDrop && gameState !== 'dead') {
      try { waterDrop.triggerAttackRelease(pentatonic[Math.floor(Math.random()*pentatonic.length)], '8n'); } catch(e){}
    }
    scheduleWaterDrops();
  }, delay);
}

function startScreenMusic() {
  try {
    steamPad.triggerAttack(['C4','E4','G4','B4'], Tone.now());
    // Glass harmonica motif
    const t = Tone.now();
    glassHarmonica.triggerAttackRelease('C4', '2n', t);
    glassHarmonica.triggerAttackRelease('E4', '2n', t + 0.8);
    glassHarmonica.triggerAttackRelease('G4', '2n', t + 1.6);
  } catch(e) {}
}

function enterPlayingMusic() {
  try {
    breathBass.triggerAttack(55, Tone.now());
    if (audioReady) steamPad.volume.rampTo(-18, 2);
  } catch(e) {}
}

function playHookMotif(inverted = false) {
  if (!audioReady || !glassHarmonica) return;
  try {
    const notes = inverted ? ['G4','E4','C4'] : ['C4','E4','G4','C5'];
    const t = Tone.now();
    notes.forEach((n, i) => glassHarmonica.triggerAttackRelease(n, '2n', t + i * 0.8));
  } catch(e) {}
}

function updateMusicState(state) {
  if (state === musicState) return;
  musicState = state;
  if (!audioReady) return;
  try {
    if (state === 'drift') {
      steamPad.volume.rampTo(-18, 1);
      coldDrone.volume.rampTo(-40, 0.5);
      waterDropFast = false;
    } else if (state === 'approach') {
      steamPad.volume.rampTo(-15, 0.5);
      waterDropFast = false;
      playHookMotif(true);
    } else if (state === 'danger') {
      steamPad.volume.rampTo(-12, 0.3);
      coldDrone.volume.rampTo(-18, 0.3);
      try { coldDrone.triggerAttack(65.41, Tone.now()); } catch(e){}
      try { shimmerBell.triggerAttackRelease(1800, '16n', Tone.now()); } catch(e){}
    } else if (state === 'goal') {
      steamPad.volume.rampTo(-12, 0.5);
      waterDropFast = true;
      playHookMotif(false);
    } else if (state === 'win') {
      waterDropFast = false;
      playHookMotif(false);
      setTimeout(() => { if(audioReady) playHookMotif(false); }, 2500);
    } else if (state === 'dead') {
      waterDropFast = false;
      // All cuts
      try { steamPad.releaseAll(); } catch(e){}
      try { breathBass.triggerRelease(Tone.now()); } catch(e){}
      try { glassHarmonica.triggerRelease(Tone.now()); } catch(e){}
      try { coldDrone.triggerRelease(Tone.now()); } catch(e){}
      // Single reversed pluck after 300ms silence
      setTimeout(() => {
        if (audioReady && waterDrop) {
          try { waterDrop.triggerAttackRelease('C3', '4n'); } catch(e) {}
        }
      }, 300);
    }
  } catch(e) {}
}

// SFX
function sfxPop() {
  if (!audioReady) return;
  try {
    const s = new Tone.AMSynth({ envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 } }).toDestination();
    s.volume.value = -8;
    s.triggerAttackRelease('C5', '16n');
    setTimeout(() => s.dispose(), 500);
  } catch(e) {}
}

function sfxThermalPlace() {
  if (!audioReady) return;
  try {
    const s = new Tone.Synth({ oscillator:{type:'sine'}, envelope:{attack:0.02,decay:0.3,sustain:0,release:0.6} });
    s.volume.value = -20;
    s.connect(reverbMid);
    s.triggerAttackRelease('C5', '8n');
    setTimeout(() => s.dispose(), 1500);
  } catch(e) {}
}

function sfxNearMiss() {
  if (!audioReady) return;
  try {
    const s = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 20,
      oscillator:{type:'sine'},
      envelope:{attack:0.001,decay:0.03,sustain:0,release:0.05},
      modulation:{type:'square'},
      modulationEnvelope:{attack:0.001,decay:0.03,sustain:0,release:0.05}
    }).toDestination();
    s.frequency.value = 440;
    s.volume.value = -18;
    s.triggerAttackRelease(440, '32n');
    setTimeout(() => s.dispose(), 500);
  } catch(e) {}
}

function sfxWin() {
  if (!audioReady) return;
  try {
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator:{type:'sine'},
      envelope:{attack:0.3,decay:1,sustain:1,release:8.0}
    });
    poly.volume.value = -10;
    poly.connect(reverbLong);
    poly.triggerAttackRelease(['C5','E5','G5','C6'], '4n');
    setTimeout(() => poly.dispose(), 12000);
  } catch(e) {}
}

function sfxColdEntry() {
  if (!audioReady) return;
  try {
    const s = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:1.0,decay:0,sustain:1,release:2.0} });
    s.volume.value = -18;
    const af = new Tone.AutoFilter({ frequency: 0.2, depth: 0.4 }).start();
    s.chain(af, reverbMid);
    s.triggerAttack('A2');
    setTimeout(() => { try{ s.triggerRelease(); setTimeout(() => { s.dispose(); af.dispose(); }, 2500); } catch(e){} }, 800);
  } catch(e) {}
}

function sfxHairDryer() {
  if (!audioReady) return;
  try {
    const noise = new Tone.NoiseSynth({ noise:{type:'pink'}, envelope:{attack:0.01,decay:0.3,sustain:0,release:0.01} });
    noise.volume.value = -10;
    const lp = new Tone.Filter(600,'lowpass');
    const am = new Tone.AMSynth({ oscillator:{type:'sine'}, envelope:{attack:0.01,decay:0.3,sustain:0,release:0.01} });
    am.frequency.value = 82; // E2
    am.volume.value = -16;
    const amMod = new Tone.Oscillator(20,'sine').start();
    noise.chain(lp, Tone.getDestination());
    am.toDestination();
    noise.triggerAttackRelease('16n');
    am.triggerAttackRelease('E2','16n');
    setTimeout(() => { try{ noise.dispose(); am.dispose(); lp.dispose(); amMod.dispose(); } catch(e){} }, 1000);
  } catch(e) {}
}

// ── Level Definitions ─────────────────────────────────────────
function getLevelData(idx) {
  // Returns level config in world coords (origin at bottom, y+ = up)
  // World height: H for levels 1-4, 1800 for level 5
  switch(idx) {
    case 0: return level1();
    case 1: return level2();
    case 2: return level3();
    case 3: return level4();
    case 4: return level5();
    default: return level1();
  }
}

function level1() {
  const wH = H; const wW = W;
  return {
    worldH: wH,
    name: 'The Ledge',
    spawnX: wW * 0.25,
    spawnY: wH * 0.20, // from bottom
    goalX: wW * 0.82,
    goalY: wH * 0.80,
    maxThermals: 2,
    thermalCooldown: 0,
    bgGradientTop: 0x5E8FA3,
    bgGradientBot: 0x5E8FA3,
    streams: [
      { type:'horizontal', y: wH*0.65, speed: 20, dir:  1, x0:0, x1: wW },
      { type:'horizontal', y: wH*0.35, speed: 22, dir: -1, x0:0, x1: wW },
      { type:'updraft',    x: wW*0.60, speed: 15, width: 80, y0:0, y1: wH },
    ],
    obstacles: [
      { type:'rect', x: wW*0.05,  y: wH*0.14, w:120, h:12 }, // soap dish ledge
      { type:'rect', x: wW*0.80,  y: wH*0.20, w:16, h: Math.min(200, wH*0.3) }, // faucet column
    ],
    rotating: [],
    vents: [],
    coldZones: [],
    hairDryer: null,
  };
}

function level2() {
  const wH = H; const wW = W;
  return {
    worldH: wH,
    name: 'Steam City',
    spawnX: wW * 0.5,
    spawnY: wH * 0.15,
    goalX: wW * 0.5,
    goalY: wH * 0.88,
    maxThermals: 2,
    thermalCooldown: 0,
    streams: [
      { type:'updraft',    x: wW*0.25, speed: 35, width:100, y0:0, y1: wH },
      { type:'horizontal', y: wH*0.75, speed: 28, dir:  1, x0:0, x1: wW },
      { type:'horizontal', y: wH*0.45, speed: 24, dir: -1, x0:0, x1: wW },
      { type:'updraft',    x: wW*0.75, speed: 18, width: 70, y0:0, y1: wH },
    ],
    obstacles: [
      { type:'rect', x:0,      y: wH*0.0, w: 12, h: wH*0.6 }, // left wall
      { type:'rect', x: wW-12, y: wH*0.0, w: 12, h: wH*0.6 }, // right wall
      { type:'rect', x: wW*0.60, y: wH*0.78, w:80, h:16 },    // showerhead horizontal
      { type:'rect', x: wW*0.76, y: wH*0.62, w:16, h:60 },    // showerhead vertical
    ],
    rotating: [],
    vents: [
      { bx: wW*0.5, by: wH*0.10, amplitude: wW*0.35, period: 3.0, phase:0 },
    ],
    coldZones: [],
    hairDryer: null,
  };
}

function level3() {
  const wH = H; const wW = W;
  return {
    worldH: wH,
    name: 'The Mirror',
    spawnX: wW * 0.5,
    spawnY: wH * 0.12,
    goalX: wW * 0.5,
    goalY: wH * 0.88,
    maxThermals: 2,
    thermalCooldown: 0,
    streams: [
      { type:'updraft',    x: wW*0.50, speed: 40, width: 90, y0:0, y1:wH },
      { type:'horizontal', y: wH*0.80, speed: 30, dir:  1, x0:0, x1: wW },
      { type:'horizontal', y: wH*0.60, speed: 32, dir: -1, x0:0, x1: wW },
      { type:'spiral',     cx: wW*0.35, cy: wH*0.45, radius:110, rotation: 0.4, dir: 1 },
      { type:'updraft',    x: wW*0.80, speed: 22, width: 60, y0:0, y1:wH },
    ],
    obstacles: [
      { type:'rect', x: wW-10, y:0,      w:10, h: wH },       // mirror (right wall)
      { type:'rect', x: wW*0.3, y:0,     w: wW*0.55, h:14 },  // sink basin top
      { type:'rect', x: wW*0.68, y: wH*0.42, w:160, h: 8 },  // towel rail
    ],
    rotating: [],
    vents: [
      { bx: wW*0.2,  by: wH*0.10, amplitude: 60, period: 2.5, phase: 0 },
      { bx: wW*0.72, by: wH*0.45, amplitude: 60, period: 2.5, phase: Math.PI },
    ],
    coldZones: [
      { x: 10, y: wH*0.05, w: wW*0.22, h: wH*0.30 },
    ],
    hairDryer: null,
  };
}

function level4() {
  const wH = H; const wW = W;
  return {
    worldH: wH,
    name: 'Chrome Maze',
    spawnX: wW * 0.5,
    spawnY: wH * 0.12,
    goalX: wW * 0.82,
    goalY: wH * 0.88,
    maxThermals: 2,
    thermalCooldown: 0.8,
    streams: [
      { type:'updraft',    x: wW*0.30, speed: 45, width: 80, y0:0, y1:wH },
      { type:'updraft',    x: wW*0.70, speed: 38, width: 60, y0:0, y1:wH },
      { type:'horizontal', y: wH*0.85, speed: 30, dir:  1, x0:0, x1: wW },
      { type:'horizontal', y: wH*0.55, speed: 35, dir: -1, x0:0, x1: wW },
      { type:'spiral',     cx: wW*0.55, cy: wH*0.35, radius: 100, rotation: 0.5, dir:-1 },
      { type:'ventpulse',  x: wW*0.92, y: wH*0.40, period: 3, maxSpeed: 50, axis:'x', dir:-1 },
    ],
    obstacles: [
      { type:'rect', x: wW*0.1,  y: wH*0.60, w:10, h:70 },
      { type:'rect', x: wW*0.35, y: wH*0.70, w:10, h:80 },
      { type:'rect', x: wW*0.65, y: wH*0.55, w:10, h:60 },
      { type:'rect', x: wW*0.85, y: wH*0.70, w:10, h:70 },
      { type:'rect', x: wW*0.22, y: wH*0.45, w:70, h:10 },
    ],
    rotating: [
      { cx: wW*0.30, cy: wH*0.55, len:120, speed: 0.3, angle: 0 },
      { cx: wW*0.65, cy: wH*0.35, len:120, speed: 0.3, angle: Math.PI/2 },
    ],
    vents: [
      { bx: wW*0.22, by: wH*0.10, amplitude: 60, period: 2.5, phase: 0 },
      { bx: wW*0.65, by: wH*0.28, amplitude: 50, period: 2.0, phase: Math.PI*0.7 },
    ],
    coldZones: [
      { x: 10,      y: wH*0.08, w: wW*0.22, h: wH*0.20 },
      { x: wW*0.72, y: wH*0.68, w: wW*0.24, h: wH*0.20 },
    ],
    hairDryer: null,
  };
}

function level5() {
  const wH = 1800; const wW = W;
  return {
    worldH: wH,
    name: 'The Ascent',
    spawnX: wW * 0.5,
    spawnY: wH * 0.06,
    goalX: wW * 0.5,
    goalY: wH * 0.92,
    maxThermals: 1,
    thermalCooldown: 0,
    streams: [
      { type:'updraft',    x: wW*0.20, speed: 55, width:100, y0:0, y1:wH },
      { type:'updraft',    x: wW*0.80, speed: 42, width: 80, y0:0, y1:wH },
      { type:'horizontal', y: wH*0.90, speed: 38, dir:  1, x0:0, x1: wW },
      { type:'horizontal', y: wH*0.70, speed: 45, dir: -1, x0:0, x1: wW },
      { type:'spiral',     cx: wW*0.50, cy: wH*0.50, radius:140, rotation: 0.45, dir: 1 },
      { type:'ventpulse',  x: 12, y: wH*0.65, period: 3, maxSpeed: 60, axis:'x', dir: 1 },
      { type:'updraft',    x: wW*0.50, speed: 70, width:120, y0:0, y1:wH },
    ],
    obstacles: [
      { type:'rect', x: wW*0.1,  y: wH*0.35, w:10, h:90 },
      { type:'rect', x: wW*0.85, y: wH*0.45, w:10, h:80 },
      { type:'rect', x: wW*0.25, y: wH*0.58, w:10, h:90 },
      { type:'rect', x: wW*0.70, y: wH*0.65, w:10, h:80 },
      { type:'rect', x: wW*0.45, y: wH*0.28, w:70, h:10 },
    ],
    rotating: [
      { cx: wW*0.35, cy: wH*0.40, len:120, speed: 0.3, angle: 0 },
      { cx: wW*0.65, cy: wH*0.60, len:120, speed: 0.3, angle: Math.PI/3 },
      { cx: wW*0.50, cy: wH*0.75, len:120, speed: 0.3, angle: Math.PI*2/3 },
    ],
    vents: [
      { bx: wW*0.25, by: wH*0.20, amplitude: 70, period: 2.5, phase: 0 },
      { bx: wW*0.70, by: wH*0.40, amplitude: 70, period: 2.0, phase: Math.PI },
      { bx: wW*0.40, by: wH*0.60, amplitude: 70, period: 3.5, phase: Math.PI*0.5 },
    ],
    coldZones: [
      { x: wW*0.05, y: wH*0.48, w: wW*0.28, h: wH*0.10 },
      { x: wW*0.62, y: wH*0.55, w: wW*0.28, h: wH*0.10 },
    ],
    hairDryer: {
      x: wW*0.08, y: wH*0.32,
      dir: 1, // shoots right
      period: 4.0, burstDur: 0.3,
      jetW: 50, jetLen: 300,
      forceX: 200
    },
  };
}

// ── World Build ───────────────────────────────────────────────
let levelData = null;
let worldH = H;

function clearWorld() {
  // Remove all meshes from sceneGroup
  while (sceneGroup.children.length) sceneGroup.remove(sceneGroup.children[0]);
  thermals = [];
  thermalMeshes = {};
  streams = [];
  obstacles = [];
  rotatingPipes = [];
  steamVents = [];
  coldZones = [];
  hairDryer = null;
  obstacleMeshes = [];
  pipeMeshes = [];
  ventMeshes = [];
  streamMeshes = [];
  coldZoneMeshes = [];
  bubbleMesh = null;
  bubbleRimMesh = null;
  goalMesh = null;
  goalGlowMesh = null;
  dreyerMesh = null;
  burstMesh = null;
  nearMissMesh = null;
}

function worldToScreen(wx, wy) {
  // Convert world coords to Three.js scene coords
  // World: origin at bottom-left, y+ up
  // Three.js ortho: origin at center, y+ up
  return new THREE.Vector2(wx - W/2, wy - worldH/2 + camOffsetY);
}

function buildLevel(idx) {
  clearWorld();
  levelData = getLevelData(idx);
  worldH = levelData.worldH;

  // Spawn bubble
  bx = levelData.spawnX;
  by = levelData.spawnY;
  bvx = 0; bvy = 0;
  bubbleAlive = true;
  bubbleWinAnim = false;
  hasEverActed = false;

  // Camera
  camOffsetY = by;
  camTargetY = by;

  // Goal
  goalX = levelData.goalX;
  goalY = levelData.goalY;

  // Thermal config
  thermalCooldown = levelData.thermalCooldown || 0;
  lastThermalTime = -999;

  // Config
  streams = levelData.streams || [];
  obstacles = levelData.obstacles || [];
  rotatingPipes = (levelData.rotating || []).map(r => ({ ...r, angle: r.angle || 0, halfW: 4 }));
  steamVents = (levelData.vents || []).map(v => ({ ...v, phase: v.phase || 0, jetOn: true }));
  coldZones = levelData.coldZones || [];
  hairDryer = levelData.hairDryer ? { ...levelData.hairDryer, timer: 0 } : null;

  // Build meshes
  buildBubble();
  buildGoal();
  buildObstacleMeshes();
  buildPipeMeshes();
  buildVentMeshes();
  buildColdZoneMeshes();
  buildStreamMeshes();
  if (hairDryer) buildHairDryer();
  buildBurstMesh();
  buildNearMissMesh();

  nearMissChain = 0;
  nearMissTimer = 0;
  score = 10000;
  updateHUD();
}

function w2s(wx, wy) {
  // World to scene transform (accounting for camera offset)
  return {
    x: wx - W/2,
    y: wy - worldH/2
  };
}

function buildBubble() {
  const geo = new THREE.CircleGeometry(BUBBLE_RADIUS, 32);
  bubbleMesh = new THREE.Mesh(geo, matBubbleFill.clone());

  // Rim (ring)
  const rimGeo = new THREE.RingGeometry(BUBBLE_RADIUS - 2, BUBBLE_RADIUS + 1, 32);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x7BC8D4, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  bubbleRimMesh = new THREE.Mesh(rimGeo, rimMat);

  // Iridescent highlight arc
  const arcCurve = new THREE.EllipseCurve(0, 0, BUBBLE_RADIUS * 0.7, BUBBLE_RADIUS * 0.7, Math.PI * 0.15, Math.PI * 0.85, false, 0);
  const arcPts = arcCurve.getPoints(20);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts.map(p => new THREE.Vector3(p.x, p.y, 1)));
  const arcMat = new THREE.LineBasicMaterial({ color: 0xF4A261, transparent: true, opacity: 0.8 });
  const arcLine = new THREE.Line(arcGeo, arcMat);

  // Warm arc (lower)
  const arc2Curve = new THREE.EllipseCurve(0, 0, BUBBLE_RADIUS * 0.65, BUBBLE_RADIUS * 0.65, Math.PI * 1.1, Math.PI * 1.75, false, 0);
  const arc2Pts = arc2Curve.getPoints(20);
  const arc2Geo = new THREE.BufferGeometry().setFromPoints(arc2Pts.map(p => new THREE.Vector3(p.x, p.y, 1)));
  const arc2Mat = new THREE.LineBasicMaterial({ color: 0x7BC8D4, transparent: true, opacity: 0.6 });
  const arc2Line = new THREE.Line(arc2Geo, arc2Mat);

  bubbleMesh.add(bubbleRimMesh);
  bubbleMesh.add(arcLine);
  bubbleMesh.add(arc2Line);
  sceneGroup.add(bubbleMesh);
}

function buildGoal() {
  // Glowing vent at goal
  const geo = new THREE.CircleGeometry(GOAL_RADIUS, 24);
  goalMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xF0C070, transparent: true, opacity: 0.85 }));

  // Outer glow ring
  const glowGeo = new THREE.RingGeometry(GOAL_RADIUS, GOAL_RADIUS + 12, 24);
  goalGlowMesh = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xF0C070, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
  goalMesh.add(goalGlowMesh);
  sceneGroup.add(goalMesh);

  updateGoalPos();
}

function updateGoalPos() {
  const p = w2s(goalX, goalY);
  goalMesh.position.set(p.x, p.y, 0);
}

function buildObstacleMeshes() {
  obstacles.forEach(ob => {
    // ob: { type:'rect', x, y (bottom-left in world), w, h }
    const geo = new THREE.PlaneGeometry(ob.w, ob.h);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xC97B4B }));
    const p = w2s(ob.x + ob.w/2, ob.y + ob.h/2);
    mesh.position.set(p.x, p.y, 0);
    sceneGroup.add(mesh);
    obstacleMeshes.push({ mesh, ob });
  });
}

function buildPipeMeshes() {
  rotatingPipes.forEach(pipe => {
    const geo = new THREE.PlaneGeometry(pipe.len, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xC0C8D4 }));
    const p = w2s(pipe.cx, pipe.cy);
    mesh.position.set(p.x, p.y, 0.5);
    mesh.rotation.z = pipe.angle;
    sceneGroup.add(mesh);
    pipeMeshes.push({ mesh, pipe });
  });
}

function buildVentMeshes() {
  steamVents.forEach(vent => {
    // Vent body
    const geo = new THREE.PlaneGeometry(20, 30);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xC97B4B }));
    sceneGroup.add(mesh);

    // Jet column (visual, updated each frame)
    const jetGeo = new THREE.PlaneGeometry(30, 200);
    const jetMesh = new THREE.Mesh(jetGeo, new THREE.MeshBasicMaterial({ color: 0xF9E4C8, transparent: true, opacity: 0.35 }));
    sceneGroup.add(jetMesh);

    ventMeshes.push({ mesh, jetMesh, vent });
  });
}

function buildColdZoneMeshes() {
  coldZones.forEach(cz => {
    const geo = new THREE.PlaneGeometry(cz.w, cz.h);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xA8D5E2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    const p = w2s(cz.x + cz.w/2, cz.y + cz.h/2);
    mesh.position.set(p.x, p.y, -0.5);
    sceneGroup.add(mesh);
    coldZoneMeshes.push(mesh);
  });
}

function buildStreamMeshes() {
  // Simple wisp visualizations for streams
  streams.forEach(stream => {
    if (stream.type === 'horizontal') {
      for (let xi = 0; xi < 4; xi++) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const wx = t * W;
          const wy = stream.y + Math.sin(t * Math.PI * 2 + xi) * 6;
          const p = w2s(wx, wy);
          pts.push(new THREE.Vector3(p.x, p.y, -1));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0xE8F0F4, transparent: true, opacity: 0.15 });
        const line = new THREE.Line(geo, mat);
        sceneGroup.add(line);
        streamMeshes.push({ line, stream, phase: xi * 0.8 });
      }
    } else if (stream.type === 'updraft') {
      for (let yi = 0; yi < 3; yi++) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const wx = stream.x + Math.sin(t * Math.PI * 3 + yi) * 10;
          const wy = t * H;
          const p = w2s(wx, wy);
          pts.push(new THREE.Vector3(p.x, p.y, -1));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0xF9E4C8, transparent: true, opacity: 0.18 });
        const line = new THREE.Line(geo, mat);
        sceneGroup.add(line);
        streamMeshes.push({ line, stream, phase: yi * 1.2 });
      }
    }
  });
}

function buildHairDryer() {
  if (!hairDryer) return;
  const geo = new THREE.PlaneGeometry(40, 20);
  dreyerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xC97B4B }));
  const p = w2s(hairDryer.x, hairDryer.y);
  dreyerMesh.position.set(p.x, p.y, 0.5);
  sceneGroup.add(dreyerMesh);
}

function buildBurstMesh() {
  const geo = new THREE.PlaneGeometry(400, 50);
  burstMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xFAFAFA, transparent: true, opacity: 0 }));
  burstMesh.position.z = 1;
  sceneGroup.add(burstMesh);
}

function buildNearMissMesh() {
  const geo = new THREE.RingGeometry(BUBBLE_RADIUS + 2, BUBBLE_RADIUS + 8, 32);
  nearMissMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xF4A261, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  nearMissMesh.position.z = 2;
  sceneGroup.add(nearMissMesh);
}

// ── Thermal Management ────────────────────────────────────────
let thermalIdCounter = 0;

function placeThermal(wx, wy) {
  const now = performance.now() / 1000;
  if (thermalCooldown > 0 && (now - lastThermalTime) < thermalCooldown) return;

  const maxT = levelData ? levelData.maxThermals : 2;
  if (thermals.length >= maxT) {
    // Remove oldest
    const old = thermals.shift();
    const m = thermalMeshes[old.id];
    if (m) { sceneGroup.remove(m.group); delete thermalMeshes[old.id]; }
  }

  const id = ++thermalIdCounter;
  const thermal = { id, wx, wy, startTime: now, holdTime: 0, alive: true, riseY: 0 };
  thermals.push(thermal);
  lastThermalTime = now;

  // Mesh: puff column
  const group = new THREE.Group();

  const baseGeo = new THREE.CircleGeometry(40, 16);
  const baseMesh = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color: 0xF9E4C8, transparent: true, opacity: 0.35 }));
  baseMesh.position.z = -0.5;
  group.add(baseMesh);

  const colGeo = new THREE.PlaneGeometry(40, 200);
  const colMesh = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ color: 0xF9E4C8, transparent: true, opacity: 0.25 }));
  colMesh.position.y = 100;
  colMesh.position.z = -0.5;
  group.add(colMesh);

  const p = w2s(wx, wy);
  group.position.set(p.x, p.y, 0);
  sceneGroup.add(group);

  thermalMeshes[id] = { group, baseMesh, colMesh, thermal };
  sfxThermalPlace();
  try { if (audioReady) shimmerBell.triggerAttackRelease(1800, '16n'); } catch(e) {}
}

// ── Input ─────────────────────────────────────────────────────
let pointerHeld = false;
let pointerHeldStart = 0;
let heldThermalId = null;

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup',   onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);

document.getElementById('startScreen').addEventListener('pointerdown', onStartTap, { once: true });
document.getElementById('instructionsScreen').addEventListener('pointerdown', onInstrTap, { once: true });

// Win/death screens
document.addEventListener('pointerdown', (e) => {
  if (gameState === 'win') {
    e.stopPropagation();
    const ws = document.getElementById('winScreen');
    ws.classList.remove('visible');
    currentLevel = (currentLevel + 1) % 5;
    setTimeout(() => startLevel(currentLevel), 350);
  } else if (gameState === 'dead') {
    e.stopPropagation();
    const ds = document.getElementById('deathScreen');
    ds.classList.remove('visible');
    setTimeout(() => startLevel(currentLevel), 350);
  }
}, { capture: true });

function onStartTap() {
  showInstructions();
}

function onInstrTap() {
  const el = document.getElementById('instructionsScreen');
  el.style.opacity = '0';
  setTimeout(() => {
    el.classList.add('hidden');
    startLevel(currentLevel);
  }, 300);
}

function showInstructions() {
  document.getElementById('startScreen').classList.add('hidden');
  const el = document.getElementById('instructionsScreen');
  el.classList.remove('hidden');
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; });
  initAudio().catch(() => {});
}

function startLevel(idx) {
  gameState = 'playing';
  gameStartTime = performance.now();
  levelStartTime = performance.now();
  document.getElementById('hud').classList.remove('hidden');
  buildLevel(idx);
  updateMusicState('drift');
  enterPlayingMusic();
}

function getWorldCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  // Screen y: 0 = top; world y: 0 = bottom
  const wx = sx / rect.width * W;
  const wy = (1 - sy / rect.height) * H + (camOffsetY - H/2);
  return { wx, wy };
}

// Lean mechanic: tap left half = lean left, tap right half = lean right
const LEAN_ACCEL = 180; // px/s² applied while held
const LEAN_MAX_VX = 1.8; // px/s horizontal cap
let leanDir = 0; // -1 left, 0 none, +1 right

function onPointerDown(e) {
  if (gameState !== 'playing') return;
  hasEverActed = true;
  pointerHeld = true;
  const rect = renderer.domElement.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  leanDir = screenX < rect.width / 2 ? -1 : 1;
}

function onPointerMove(e) {
  // no-op
}

function onPointerUp(e) {
  pointerHeld = false;
  leanDir = 0;
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('levelLabel').textContent = `Level ${currentLevel + 1}`;
  document.getElementById('scoreLabel').textContent = Math.max(0, Math.floor(score)).toLocaleString();
  const leanHint = leanDir < 0 ? '← leaning' : leanDir > 0 ? 'leaning →' : '';
  document.getElementById('thermalLabel').textContent = leanHint;
}

function showThrill() {
  const el = document.getElementById('thrill');
  el.textContent = `×${nearMissChain} Thrill`;
  el.style.opacity = '1';
  thrillTimer = 1.5;
}

// ── Physics ───────────────────────────────────────────────────
function inColdZone(x, y) {
  for (const cz of coldZones) {
    if (x > cz.x && x < cz.x + cz.w && y > cz.y && y < cz.y + cz.h) return true;
  }
  return false;
}

function getStreamForce(x, y, dt) {
  let fx = 0, fy = 0;
  for (const s of streams) {
    if (s.type === 'horizontal') {
      const dy = Math.abs(y - s.y);
      if (dy < 40) {
        const influence = Math.max(0, 1 - dy/40);
        fx += s.dir * s.speed * influence;
      }
    } else if (s.type === 'updraft') {
      const dx = Math.abs(x - s.x);
      if (dx < s.width / 2) {
        const influence = Math.max(0, 1 - dx / (s.width/2));
        fy += s.speed * influence;
      }
    } else if (s.type === 'spiral') {
      const dx = x - s.cx, dy = y - s.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < s.radius && dist > 5) {
        const influence = Math.max(0, 1 - dist/s.radius);
        const angle = Math.atan2(dy, dx) + (s.dir > 0 ? Math.PI/2 : -Math.PI/2);
        fx += Math.cos(angle) * s.rotation * dist * influence * 0.5;
        fy += Math.sin(angle) * s.rotation * dist * influence * 0.5;
      }
    } else if (s.type === 'ventpulse') {
      const elapsed = performance.now() / 1000;
      const phase = (elapsed % s.period) / s.period;
      const pulse = Math.sin(phase * Math.PI * 2);
      if (s.axis === 'x') {
        const dy = Math.abs(y - s.y);
        if (dy < 40) {
          fx += s.dir * pulse * s.maxSpeed * Math.max(0, 1 - dy/40);
        }
      }
    }
  }
  return { fx, fy };
}

function getThermalForce(x, y) {
  let fx = 0, fy = 0;
  const now = performance.now() / 1000;
  for (const th of thermals) {
    if (!th.alive) continue;
    const dx = x - th.wx;
    const dy = y - th.wy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < THERMAL_RADIUS) {
      const influence = Math.max(0, 1 - dist / THERMAL_RADIUS);
      const mult = getThermalMult(th, now);
      // Upward acceleration at base
      fy += 20 * influence * mult;
      // Lateral pull toward center (proportional to horizontal distance)
      if (Math.abs(dx) < THERMAL_RADIUS) {
        const lateralStrength = 15 * (1 - Math.abs(dx) / THERMAL_RADIUS) * mult;
        fx -= Math.sign(dx) * lateralStrength;
      }
    }
  }
  return { fx, fy };
}

function getThermalMult(th, now) {
  const held = th.holdTime;
  if (held >= 2.0) return 2.5;
  if (held >= 1.0) return 2.5;
  if (held >= 0.5) return 1.8;
  if (held >= 0.3) return 1.4;
  return 1.0;
}

// Collision: returns distance to nearest surface (and which surface)
function nearestSurfaceDist(x, y) {
  let minDist = Infinity;

  // Static obstacles
  for (const ob of obstacles) {
    const d = rectBubbleDist(x, y, ob.x, ob.y, ob.w, ob.h);
    if (d < minDist) minDist = d;
  }

  // Rotating pipes
  for (const pipe of rotatingPipes) {
    const d = pipeBubbleDist(x, y, pipe);
    if (d < minDist) minDist = d;
  }

  // Steam vents (body)
  for (const vent of steamVents) {
    const vx = vent.bx + Math.sin((performance.now()/1000/vent.period) * Math.PI * 2 + vent.phase) * vent.amplitude;
    const vy = vent.by;
    const d = rectBubbleDist(x, y, vx - 10, vy - 15, 20, 30);
    if (d < minDist) minDist = d;
  }

  // World boundary (left, right walls; bottom floor)
  const dLeft  = x - BUBBLE_RADIUS;
  const dRight = W - BUBBLE_RADIUS - x;
  const dBot   = y - BUBBLE_RADIUS;
  if (dLeft < minDist)  minDist = dLeft;
  if (dRight < minDist) minDist = dRight;
  if (dBot < minDist)   minDist = dBot;

  return minDist;
}

function rectBubbleDist(bx, by, rx, ry, rw, rh) {
  // Distance from bubble center to nearest edge of axis-aligned rect
  const cx = rx + rw/2, cy = ry + rh/2;
  const dx = Math.max(0, Math.abs(bx - cx) - rw/2);
  const dy = Math.max(0, Math.abs(by - cy) - rh/2);
  return Math.sqrt(dx*dx + dy*dy) - BUBBLE_RADIUS;
}

function pipeBubbleDist(bx, by, pipe) {
  // Closest point on rotated line segment to bubble center
  const cos = Math.cos(pipe.angle), sin = Math.sin(pipe.angle);
  const halfLen = pipe.len / 2;
  // Transform bubble to pipe local space
  const dx = bx - pipe.cx, dy = by - pipe.cy;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  // Clamp to line segment
  const clampedL = Math.max(-halfLen, Math.min(halfLen, lx));
  const closestX = clampedL, closestY = 0;
  const distX = lx - closestX, distY = ly - closestY;
  const dist = Math.sqrt(distX*distX + distY*distY);
  return dist - BUBBLE_RADIUS - 4; // 4 = half pipe width
}

function checkJetCollision(x, y) {
  const now = performance.now() / 1000;
  // Steam vents jet
  for (const vent of steamVents) {
    const vx = vent.bx + Math.sin((now/vent.period) * Math.PI * 2 + vent.phase) * vent.amplitude;
    const vy = vent.by;
    // Jet goes upward from vent
    const dx = Math.abs(x - vx);
    if (dx < 15 && y > vy && y < vy + 250) return true;
  }

  // Thermal jets (held > 2s)
  for (const th of thermals) {
    if (!th.alive) continue;
    if (th.holdTime >= THERMAL_JET_DELAY) {
      const dx = Math.abs(x - th.wx);
      const dy = y - th.wy;
      if (dx < THERMAL_JET_RADIUS && dy > 0 && dy < 300) return true;
    }
  }

  // Hair dryer burst
  if (hairDryer && hairDryer.burstActive) {
    const dx = x - hairDryer.x;
    const dy = Math.abs(y - hairDryer.y);
    if (dy < hairDryer.jetW/2 && dx > 0 && dx < hairDryer.jetLen) return true;
  }
  return false;
}

// ── Update Loop ───────────────────────────────────────────────
let lastFrameTime = 0;
let streamAnimT = 0;
let goalPulseT = 0;
let startIdleT = 0;

// Start screen idle bubbles
const idleBubbles = [
  { r: 24, x: 0.25, y: 0.70, vx: 12, vy: 0, ampY: 8, periodY: 4.0, t: 0, dir: 1 },
  { r: 16, x: 0.70, y: 0.40, vx: -8, vy: 0, ampY: 6, periodY: 3.2, t: 0, dir: -1 },
  { r: 32, x: 0.50, y: 0.48, vx: 0,  vy: 6, ampX: 14, periodX: 5.5, t: 0, dir: 0 },
];
let idleBubbleMeshes = [];
let idleScene = null;
let idleCamera = null;
let idleRenderer = null; // we'll reuse main renderer & scene

// Build idle scene objects (on top of sceneGroup but in a separate group)
let idleGroup = null;

function buildIdleScene() {
  if (idleGroup) scene.remove(idleGroup);
  idleGroup = new THREE.Group();

  // Steam wisps as line segments
  const wispDefs = [
    { xPct: 0.18, speed: 22, sway: 15, freq: 0.12, opacity: 0.28 },
    { xPct: 0.52, speed: 26, sway: 20, freq: 0.09, opacity: 0.20 },
    { xPct: 0.76, speed: 19, sway: 12, freq: 0.15, opacity: 0.24 },
  ];
  const wispMeshes = wispDefs.map(def => {
    const pts = Array.from({length:20}, (_, i) => new THREE.Vector3(0, i * 12, 0));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xE8F0F4, transparent: true, opacity: def.opacity });
    const line = new THREE.Line(geo, mat);
    line.position.set(def.xPct * W - W/2, -H/2, -1);
    idleGroup.add(line);
    return { line, def, y: -H/2, pts };
  });

  // Idle bubbles
  idleBubbleMeshes = idleBubbles.map((ib, idx) => {
    const geo = new THREE.CircleGeometry(ib.r, 24);
    const colors = [0xE8F0F4, 0xF0EAE0, 0xE8F4F8];
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[idx], transparent: true, opacity: 0.7 }));
    const rimGeo = new THREE.RingGeometry(ib.r - 1.5, ib.r + 1.5, 24);
    const rimColors = [0x7BC8D4, 0xF4A261, 0x7BC8D4];
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: rimColors[idx], transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    mesh.add(rim);
    idleGroup.add(mesh);

    ib.px = ib.x * W - W/2;
    ib.py = (1 - ib.y) * H - H/2;
    return { mesh, ib, wispMeshes };
  });

  scene.add(idleGroup);
  return { wispMeshes, idleBubbleMeshes };
}

let idleWispMeshes = [];
function initIdleScene() {
  const { wispMeshes } = buildIdleScene();
  idleWispMeshes = wispMeshes;
}
initIdleScene();

function updateIdle(dt) {
  startIdleT += dt;
  const t = startIdleT;

  // Wisps
  idleWispMeshes.forEach(({ line, def, pts }) => {
    def._y = (def._y || -H/2) + def.speed * dt;
    if (def._y > H/2 + 250) def._y = -H/2;
    const pts3 = Array.from({length:20}, (_, i) => {
      const frac = i / 19;
      const sway = Math.sin(t * def.freq * Math.PI * 2 + frac * Math.PI) * def.sway;
      return new THREE.Vector3(sway, i * 12, 0);
    });
    line.geometry.setFromPoints(pts3);
    line.geometry.attributes.position.needsUpdate = true;
    line.position.set(def.xPct * W - W/2, def._y, -1);
  });

  // Idle bubbles
  idleBubbleMeshes.forEach(({ mesh, ib }, idx) => {
    if (idx === 0) {
      // Drifts right
      ib.px += ib.vx * dt;
      if (ib.px > W/2 + ib.r + 10) ib.px = -W/2 - ib.r;
      const py = (1 - ib.y) * H - H/2 + Math.cos(t / ib.periodY * Math.PI * 2) * ib.ampY;
      mesh.position.set(ib.px, py, 0);
    } else if (idx === 1) {
      // Drifts left
      ib.px += ib.vx * dt;
      if (ib.px < -W/2 - ib.r - 10) ib.px = W/2 + ib.r;
      const py = (1 - ib.y) * H - H/2 + Math.cos(t / ib.periodY * Math.PI * 2) * ib.ampY;
      mesh.position.set(ib.px, py, 0);
    } else {
      // Sphera — drifts up, oscillates left-right
      if (ib._popAnim) {
        ib._popT += dt;
        if (ib._popT < 0.2) {
          const s = 1 - ib._popT / 0.2;
          mesh.scale.set(s, s, 1);
        } else if (ib._popT < 0.6) {
          const s = (ib._popT - 0.2) / 0.4;
          mesh.scale.set(s, s, 1);
          if (ib._popT > 0.35) ib._popAnim = false;
        }
      }
      ib.py -= ib.vy * dt;
      if (ib.py < -H/2 - ib.r - 10) {
        ib.py = H/2 * 0.7;
        ib.px = 0;
        ib._popAnim = true;
        ib._popT = 0;
      }
      const px = Math.sin(t / ib.periodX * Math.PI * 2) * ib.ampX;
      mesh.position.set(px, ib.py, 0);
    }
  });
}

function updatePlaying(dt) {
  const now = performance.now() / 1000;

  // Update thermals
  for (let i = thermals.length - 1; i >= 0; i--) {
    const th = thermals[i];
    const age = now - th.startTime;

    // Hold time
    if (pointerHeld && heldThermalId === th.id) {
      th.holdTime += dt;
    }

    // Thermal visual update
    const m = thermalMeshes[th.id];
    if (m) {
      const mult = getThermalMult(th, now);
      const isJet = th.holdTime >= THERMAL_JET_DELAY;
      const opacity = isJet ? 0.9 : Math.min(0.45, 0.3 * mult);
      const color = isJet ? 0xFAFAFA : 0xF9E4C8;
      m.baseMesh.material.color.setHex(color);
      m.baseMesh.material.opacity = opacity;
      m.colMesh.material.color.setHex(color);
      m.colMesh.material.opacity = opacity * 0.7;

      // Rise animation
      th.riseY += THERMAL_RISE * dt;
      m.colMesh.position.y = 100 + th.riseY * 0.3;
    }

    // Dissipate: default tap duration, or held keeps it alive
    const duration = pointerHeld && heldThermalId === th.id ? 999 : THERMAL_DURATION;
    if (!pointerHeld || heldThermalId !== th.id) {
      // fade out after release
      if (age > THERMAL_DURATION) {
        const fadeAge = age - THERMAL_DURATION;
        if (fadeAge > 0.8) {
          th.alive = false;
          if (m) { sceneGroup.remove(m.group); delete thermalMeshes[th.id]; }
          thermals.splice(i, 1);
          continue;
        }
        const fade = 1 - fadeAge / 0.8;
        if (m) {
          m.baseMesh.material.opacity = 0.3 * fade;
          m.colMesh.material.opacity = 0.2 * fade;
        }
      }
    }
  }

  // Hair dryer
  if (hairDryer) {
    hairDryer.timer = (hairDryer.timer + dt);
    const cycle = hairDryer.timer % hairDryer.period;
    const prevBurst = hairDryer.burstActive;
    hairDryer.burstActive = cycle < hairDryer.burstDur;
    if (hairDryer.burstActive && !prevBurst) {
      sfxHairDryer();
    }
    if (burstMesh) {
      if (hairDryer.burstActive) {
        burstMesh.material.opacity = 0.75;
        const p = w2s(hairDryer.x + hairDryer.jetLen/2, hairDryer.y);
        burstMesh.position.set(p.x, p.y, 1);
        burstMesh.scale.set(hairDryer.jetLen/400, hairDryer.jetW/50, 1);
      } else {
        // Residual warm air (±0.5s from burst)
        const residual = (cycle < hairDryer.burstDur + 0.5 || cycle > hairDryer.period - 0.5);
        burstMesh.material.opacity = residual ? 0.12 : 0;
      }
    }
  }

  // Vent positions
  for (let vi = 0; vi < steamVents.length; vi++) {
    const vent = steamVents[vi];
    const vm = ventMeshes[vi];
    if (!vm) continue;
    const vx = vent.bx + Math.sin((now/vent.period) * Math.PI * 2 + vent.phase) * vent.amplitude;
    const vy = vent.by;
    const p = w2s(vx, vy);
    vm.mesh.position.set(p.x, p.y, 0);
    // Jet column rising upward
    const jp = w2s(vx, vy + 100);
    vm.jetMesh.position.set(jp.x, jp.y, -0.3);
    vm.jetMesh.material.opacity = 0.3;
  }

  // Rotating pipes
  rotatingPipes.forEach((pipe, i) => {
    pipe.angle += pipe.speed * dt;
    const pm = pipeMeshes[i];
    if (pm) pm.mesh.rotation.z = pipe.angle;
  });

  // Goal pulse
  goalPulseT += dt;
  if (goalGlowMesh) {
    goalGlowMesh.material.opacity = 0.3 + Math.sin(goalPulseT * 3) * 0.2;
    const s = 1 + Math.sin(goalPulseT * 2) * 0.08;
    goalMesh.scale.set(s, s, 1);
  }

  // Bubble physics
  if (!bubbleAlive || bubbleWinAnim) return;

  const cold = inColdZone(bx, by);
  const buoyancy = cold ? -8 : BUBBLE_BUOYANCY;

  // Air currents
  const { fx: sfx, fy: sfy } = getStreamForce(bx, by, dt);

  // Lean force from player input
  const leanFx = leanDir * LEAN_ACCEL;

  bvx += (sfx + leanFx) * dt;
  bvy += (buoyancy + sfy) * dt;

  // Drag
  bvx *= Math.pow(BUBBLE_DRAG, 60 * dt);
  bvy *= Math.pow(BUBBLE_DRAG, 60 * dt);

  // Clamp horizontal speed from lean
  if (Math.abs(bvx) > LEAN_MAX_VX) bvx = Math.sign(bvx) * LEAN_MAX_VX;

  // Clamp total speed
  const spd = Math.sqrt(bvx*bvx + bvy*bvy);
  if (spd > BUBBLE_MAX_SPEED) {
    bvx = bvx / spd * BUBBLE_MAX_SPEED;
    bvy = bvy / spd * BUBBLE_MAX_SPEED;
  }

  // Update position
  bx += bvx * dt;
  by += bvy * dt;

  // Boundary: don't let bubble go below 0 or above worldH
  if (by < BUBBLE_RADIUS) { by = BUBBLE_RADIUS; bvy = Math.abs(bvy) * 0.5; }
  if (by > worldH - BUBBLE_RADIUS) { by = worldH - BUBBLE_RADIUS; bvy = -Math.abs(bvy) * 0.5; }
  if (bx < BUBBLE_RADIUS) { bx = BUBBLE_RADIUS; bvx = Math.abs(bvx) * 0.5; }
  if (bx > W - BUBBLE_RADIUS) { bx = W - BUBBLE_RADIUS; bvx = -Math.abs(bvx) * 0.5; }

  // Camera follow (with lag)
  camTargetY = by;
  camOffsetY += (camTargetY - camOffsetY) * Math.min(1, CAM_LAG * 60 * dt);

  // Camera world-to-scene transform
  // sceneGroup offset: shift everything so world-y = camOffsetY appears at screen center
  sceneGroup.position.y = -(worldH/2 - camOffsetY);

  // Bubble mesh position
  if (bubbleMesh) {
    const p = w2s(bx, by);
    bubbleMesh.position.set(p.x, p.y, 2);
    if (nearMissMesh) nearMissMesh.position.set(p.x, p.y, 2.5);
  }

  // Collision detection
  if (!hasEverActed) return; // no win/lose before first action

  // Jet collision
  if (checkJetCollision(bx, by)) {
    triggerPop();
    return;
  }

  const nearest = nearestSurfaceDist(bx, by);

  if (nearest <= POP_DIST) {
    triggerPop();
    return;
  }

  // Near-miss
  if (nearest < NEAR_MISS_DIST) {
    nearMissChain++;
    score += 50;
    if (nearMissTimer <= 0) sfxNearMiss();
    nearMissTimer = 0.5;
    if (nearMissMesh) nearMissMesh.material.opacity = 0.6;
    showThrill();
  } else {
    if (nearMissMesh) nearMissMesh.material.opacity = Math.max(0, (nearMissMesh.material.opacity || 0) - dt * 3);
  }

  // Near miss timer
  if (nearMissTimer > 0) nearMissTimer -= dt;
  if (thrillTimer > 0) {
    thrillTimer -= dt;
    if (thrillTimer <= 0) {
      document.getElementById('thrill').style.opacity = '0';
    }
  }

  // Dynamic music
  const distToGoal = Math.sqrt((bx-goalX)**2 + (by-goalY)**2);
  if (nearest < 40) updateMusicState('danger');
  else if (nearest < 120) updateMusicState('approach');
  else if (distToGoal < 100) updateMusicState('goal');
  else updateMusicState('drift');

  // Cold zone music
  if (cold && musicState !== 'danger' && musicState !== 'dead') {
    if (!coldDrone._active) {
      coldDrone._active = true;
      try { coldDrone.triggerAttack(65.41, Tone.now()); } catch(e) {}
      sfxColdEntry();
    }
    coldDrone.volume.rampTo(-22, 0.5);
  } else if (!cold) {
    if (coldDrone._active) {
      coldDrone._active = false;
      coldDrone.volume.rampTo(-40, 0.5);
    }
  }

  // Score tick down
  score -= dt;

  // Win check
  if (distToGoal < GOAL_RADIUS) {
    triggerWin();
    return;
  }

  updateHUD();
}

function triggerPop() {
  if (!bubbleAlive) return;
  bubbleAlive = false;
  gameState = 'dead';
  sfxPop();
  updateMusicState('dead');
  if (bubbleMesh) bubbleMesh.visible = false;
  setTimeout(() => {
    const ds = document.getElementById('deathScreen');
    document.getElementById('deathDetails').textContent = `Score: ${Math.max(0, Math.floor(score)).toLocaleString()}`;
    ds.classList.add('visible');
  }, 400);
}

function triggerWin() {
  if (!bubbleAlive) return;
  bubbleAlive = false;
  bubbleWinAnim = true;
  bubbleWinT = 0;
  gameState = 'win';
  updateMusicState('win');
  sfxWin();
  if (bubbleMesh) {
    bubbleMesh.material.color.setHex(0xF0C070);
    bubbleMesh.material.opacity = 0.95;
  }
  const finalScore = Math.max(0, Math.floor(score));
  setTimeout(() => {
    const ws = document.getElementById('winScreen');
    document.getElementById('winDetails').textContent = `Score: ${finalScore.toLocaleString()} — Level ${currentLevel + 1} Clear!`;
    ws.classList.add('visible');
  }, 2000);
}

function updateWinAnim(dt) {
  bubbleWinT += dt;
  if (bubbleMesh && bubbleWinAnim) {
    const p = w2s(bx, by + 80 + bubbleWinT * 60);
    bubbleMesh.position.set(p.x, p.y, 2);
    bubbleMesh.material.opacity = Math.max(0, 0.95 - bubbleWinT * 0.4);
    goalGlowMesh.material.opacity = 0.8 + Math.sin(bubbleWinT * 10) * 0.2;
  }
}

// Stream animation
function updateStreamWisps(dt) {
  streamAnimT += dt;
  streamMeshes.forEach(({ line, stream, phase }) => {
    if (!line || !line.geometry) return;
    if (stream.type === 'horizontal') {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const wx = t * W;
        const wy = stream.y + Math.sin(t * Math.PI * 3 + streamAnimT * stream.dir * 2 + phase) * 8;
        const p = w2s(wx, wy);
        pts.push(new THREE.Vector3(p.x, p.y, -1));
      }
      line.geometry.setFromPoints(pts);
      line.geometry.attributes.position.needsUpdate = true;
    }
  });
}

// ── Main render loop ──────────────────────────────────────────
function animate(ts) {
  requestAnimationFrame(animate);
  const dt = Math.min((ts - lastFrameTime) / 1000, 0.05);
  lastFrameTime = ts;

  if (gameState === 'start') {
    updateIdle(dt);
    composer.render();
    return;
  }

  if (gameState === 'playing' || gameState === 'dead' || gameState === 'win') {
    if (idleGroup) { idleGroup.visible = false; }
    updatePlaying(dt);
    if (bubbleWinAnim) updateWinAnim(dt);
    updateStreamWisps(dt);
    composer.render();
  }
}

requestAnimationFrame(animate);

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  W = window.innerWidth;
  H = window.innerHeight;
  renderer.setSize(W, H);
  composer.setSize(W, H);
  camera.left = -W/2; camera.right = W/2;
  camera.top = H/2;   camera.bottom = -H/2;
  camera.updateProjectionMatrix();
  if (gameState === 'playing') buildLevel(currentLevel);
});

// ── Hook motif scheduler ──────────────────────────────────────
let hookInterval = null;
function scheduleHookMotif() {
  // Play hook every ~32 bars (≈213 seconds at 72 BPM / 8 beats per bar)
  hookInterval = setInterval(() => {
    if (audioReady && gameState === 'playing') {
      playHookMotif(musicState === 'approach' || musicState === 'danger');
    }
  }, 26000); // ~every 26s
}
scheduleHookMotif();
