import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import grassShader from './shaders/grass.js';
import groundShader from './shaders/ground.js';
import cloudShader from './shaders/cloud.js';
import { BirdSwarm } from './Birds.js';
import { createMoon } from './Moon.js';

// =============================================================================
// 🌍 LITTLE PRINCE MODE - Spherical Planet!
// =============================================================================

// Shared Perlin noise instance for terrain
const terrainPerlin = new ImprovedNoise();
const TERRAIN_NOISE_SCALE = 0.2; // Reduced for smoother terrain
const TERRAIN_HEIGHT_SCALE = 1.2; // Reduced for gentler hills
const GRASS_HEIGHT_THRESHOLD = 1.0; // Adjusted for lower terrain
const GRASS_CANYON_THRESHOLD = -0.6; // Adjusted for lower terrain

// Planet Parameters
const PLANET_RADIUS = 15; // Base sphere radius
const SPHERE_SUBDIVISIONS = 64; // Resolution of the sphere mesh

// Atmosphere Parameters
const ATMOSPHERE_START = PLANET_RADIUS + 2;  // Where atmosphere begins to fade
const ATMOSPHERE_END = PLANET_RADIUS + 12;   // Full space beyond this
const SKY_COLOR = new THREE.Color(0x87ceeb);  // Light blue sky
const SPACE_COLOR = new THREE.Color(0x0a0a15); // Deep space
const HORIZON_COLOR = new THREE.Color(0x4a90d9); // Horizon blue

// Persistence Keys
const STORAGE_KEY_TERRAIN = 'terrainator_sphere_v1';
const STORAGE_KEY_CAMERA = 'terrainator_camera_sphere_v1';

function loadTerrainState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_TERRAIN);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load terrain state', e);
  }
  return null;
}

function loadCameraState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CAMERA);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load camera state', e);
  }
  return null;
}

const savedTerrain = loadTerrainState();
const savedCamera = loadCameraState();

// Random terrain seed
const TERRAIN_SEED = savedTerrain ? savedTerrain.seed : Math.random() * 1000;

// Get terrain height (radial displacement) at spherical coordinates
function getSphericalTerrainHeight(theta, phi) {
  // Use spherical coordinates as noise input
  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);
  
  // Multiple octaves of noise for interesting terrain
  let height = terrainPerlin.noise(
    x * TERRAIN_NOISE_SCALE * 10 + TERRAIN_SEED,
    y * TERRAIN_NOISE_SCALE * 10,
    z * TERRAIN_NOISE_SCALE * 10
  ) * TERRAIN_HEIGHT_SCALE;
  
  // Second octave
  height += terrainPerlin.noise(
    x * TERRAIN_NOISE_SCALE * 20 + TERRAIN_SEED,
    y * TERRAIN_NOISE_SCALE * 20,
    z * TERRAIN_NOISE_SCALE * 20
  ) * TERRAIN_HEIGHT_SCALE * 0.5;
  
  // Third octave for detail
  height += terrainPerlin.noise(
    x * TERRAIN_NOISE_SCALE * 40 + TERRAIN_SEED,
    y * TERRAIN_NOISE_SCALE * 40,
    z * TERRAIN_NOISE_SCALE * 40
  ) * TERRAIN_HEIGHT_SCALE * 0.25;
  
  return height;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// Parameters
const BLADE_COUNT = 80000;
const BLADE_WIDTH = 0.15;
const BLADE_HEIGHT = 0.15;
const BLADE_HEIGHT_VARIATION = 0.3;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =============================================================================
// Spherical Player Controller
// =============================================================================

// Player state
const playerUp = new THREE.Vector3(0, 1, 0); // Current "up" direction (away from planet)
const playerForward = new THREE.Vector3(0, 0, -1); // Current forward direction on surface
let playerTheta = 0; // Horizontal look angle
let playerPhi = 0; // Vertical look angle (relative to surface)

// Movement State
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let verticalVelocity = 0;
const PLAYER_HEIGHT = 1.0;
const MOVE_SPEED = 5.0;
const JUMP_VELOCITY = 8.0;
const GRAVITY = 2.5;
const MOUSE_SENSITIVITY = 0.002;

let isPointerLocked = false;

const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '50%';
instructions.style.left = '50%';
instructions.style.transform = 'translate(-50%, -50%)';
instructions.style.color = '#fff';
instructions.style.fontFamily = "'Cormorant Garamond', serif";
instructions.style.fontSize = '32px';
instructions.style.fontWeight = '300';
instructions.style.fontStyle = 'italic';
instructions.style.textAlign = 'center';
instructions.style.pointerEvents = 'none';
instructions.style.textShadow = '0 2px 10px rgba(0,0,0,0.2)';
instructions.innerHTML = 'Click to Play<br><span style="font-size: 20px; opacity: 0.8">(WASD to move, Mouse to look)</span><br><span style="font-size: 18px; opacity: 0.7">LMB: Raise | RMB: Lower | Scroll: Size | G: Regrow</span>';
document.body.appendChild(instructions);

// Pointer lock
document.addEventListener('click', () => {
  if (!isPointerLocked) {
    document.body.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === document.body;
  // Show/Hide Settings Panel based on pointer lock
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) {
    settingsPanel.style.display = isPointerLocked ? 'none' : 'flex';
  }
  instructions.style.display = isPointerLocked ? 'none' : 'block';
  brushUI.style.display = isPointerLocked ? 'block' : 'none';
  
  // Trigger audio update to handle ducking
  if (audioInitialized) updateAmbientAudio(lastAtmosphereT);
});

// Mouse look
document.addEventListener('mousemove', (event) => {
  if (!isPointerLocked) return;
  
  playerTheta -= event.movementX * MOUSE_SENSITIVITY;
  playerPhi -= event.movementY * MOUSE_SENSITIVITY;
  
  // Clamp vertical look
  playerPhi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, playerPhi));
});

const onKeyDown = function (event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (canJump === true) {
        verticalVelocity = JUMP_VELOCITY;
        canJump = false;
      }
      break;
    // case 'KeyG':
    //   regenerateGrassAsync();
    //   break;
  }
};

const onKeyUp = function (event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Initialize camera position on top of the planet
if (savedCamera) {
  camera.position.set(savedCamera.position.x, savedCamera.position.y, savedCamera.position.z);
  playerTheta = savedCamera.playerTheta || 0;
  playerPhi = savedCamera.playerPhi || 0;
} else {
  camera.position.set(0, PLANET_RADIUS + PLAYER_HEIGHT + 2, 0);
}

// Auto-save camera position
setInterval(() => {
  const cameraData = {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    playerTheta,
    playerPhi
  };
  localStorage.setItem(STORAGE_KEY_CAMERA, JSON.stringify(cameraData));
}, 1000);

// Textures
const grassTexture = new THREE.TextureLoader().load('assets/images/grass.jpg');
const cloudTexture = new THREE.TextureLoader().load('assets/images/cloud.jpg');
cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;

// =============================================================================
// Audio System - Immersive soundscape! 🎵
// =============================================================================

// Audio context (created on first user interaction)
let audioContext = null;
let audioInitialized = false;

// Audio sources
const audioSources = {
  meadow: { audio: null, gainNode: null },
  space: { audio: null, gainNode: null },
  walking: { audio: null, gainNode: null },
  sculpting: { audio: null, gainNode: null }
};

// Audio settings
const MEADOW_MAX_VOLUME = 0.5;
const SPACE_MAX_VOLUME = 0.6;
const WALKING_VOLUME = 0.4;
const SCULPTING_VOLUME = 0.5;

// Settings state
let settings = {
  ambientVolume: 1.0,
  effectsVolume: 1.0,
  isMuted: false
};

// Expose settings to global scope for UI interaction
window.updateAudioSettings = (key, value) => {
  if (key === 'ambientVolume') settings.ambientVolume = value;
  if (key === 'effectsVolume') settings.effectsVolume = value;
  if (key === 'isMuted') settings.isMuted = value;
  
  if (audioInitialized) {
    // Force update volumes
    updateAmbientAudio(lastAtmosphereT);
  }
};

// Walking/sculpting state
let isWalking = false;
let isSculpting = false;

function initAudio() {
  if (audioInitialized) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Meadow ambient
    audioSources.meadow.audio = new Audio('assets/sounds/meadows-ambient.mp3');
    audioSources.meadow.audio.loop = true;
    const meadowSource = audioContext.createMediaElementSource(audioSources.meadow.audio);
    audioSources.meadow.gainNode = audioContext.createGain();
    audioSources.meadow.gainNode.gain.value = MEADOW_MAX_VOLUME;
    meadowSource.connect(audioSources.meadow.gainNode);
    audioSources.meadow.gainNode.connect(audioContext.destination);
    
    // Space ambient
    audioSources.space.audio = new Audio('assets/sounds/space.mp3');
    audioSources.space.audio.loop = true;
    const spaceSource = audioContext.createMediaElementSource(audioSources.space.audio);
    audioSources.space.gainNode = audioContext.createGain();
    audioSources.space.gainNode.gain.value = 0;
    spaceSource.connect(audioSources.space.gainNode);
    audioSources.space.gainNode.connect(audioContext.destination);
    
    // Walking sound
    audioSources.walking.audio = new Audio('assets/sounds/walking.mp3');
    audioSources.walking.audio.loop = true;
    const walkingSource = audioContext.createMediaElementSource(audioSources.walking.audio);
    audioSources.walking.gainNode = audioContext.createGain();
    audioSources.walking.gainNode.gain.value = 0;
    walkingSource.connect(audioSources.walking.gainNode);
    audioSources.walking.gainNode.connect(audioContext.destination);
    
    // Sculpting sound
    audioSources.sculpting.audio = new Audio('assets/sounds/sand-movement.mp3');
    audioSources.sculpting.audio.loop = true;
    const sculptingSource = audioContext.createMediaElementSource(audioSources.sculpting.audio);
    audioSources.sculpting.gainNode = audioContext.createGain();
    audioSources.sculpting.gainNode.gain.value = 0;
    sculptingSource.connect(audioSources.sculpting.gainNode);
    audioSources.sculpting.gainNode.connect(audioContext.destination);
    
    // Start ambient sounds
    audioSources.meadow.audio.play().catch(() => {});
    audioSources.space.audio.play().catch(() => {});
    audioSources.walking.audio.play().catch(() => {});
    audioSources.sculpting.audio.play().catch(() => {});
    
    audioInitialized = true;
    console.log('🎵 Audio system initialized!');
  } catch (e) {
    console.warn('Audio initialization failed:', e);
  }
}

let lastAtmosphereT = 0;

function updateAmbientAudio(atmosphereT) {
  if (!audioInitialized) return;
  lastAtmosphereT = atmosphereT;
  
  // Ducking when settings are open (not pointer locked)
  const duckingFactor = isPointerLocked ? 1.0 : 0.4;
  const masterVolume = settings.isMuted ? 0 : duckingFactor;
  
  // Crossfade between meadow and space based on altitude
  // atmosphereT: 0 = on ground, 1 = in space
  const meadowVolume = MEADOW_MAX_VOLUME * (1 - atmosphereT) * settings.ambientVolume * masterVolume;
  const spaceVolume = SPACE_MAX_VOLUME * atmosphereT * settings.ambientVolume * masterVolume;
  
  audioSources.meadow.gainNode.gain.value = meadowVolume;
  audioSources.space.gainNode.gain.value = spaceVolume;
}

function updateWalkingAudio(walking, onGround) {
  if (!audioInitialized) return;
  
  const shouldPlay = walking && onGround;
  
  if (shouldPlay && !isWalking) {
    // Start walking sound
    const masterVolume = settings.isMuted ? 0 : 1.0;
    audioSources.walking.gainNode.gain.value = WALKING_VOLUME * settings.effectsVolume * masterVolume;
    isWalking = true;
  } else if (!shouldPlay && isWalking) {
    // Stop walking sound
    audioSources.walking.gainNode.gain.value = 0;
    isWalking = false;
  }
}

function updateSculptingAudio(sculpting) {
  if (!audioInitialized) return;
  
  if (sculpting && !isSculpting) {
    // Start sculpting sound
    const masterVolume = settings.isMuted ? 0 : 1.0;
    audioSources.sculpting.gainNode.gain.value = SCULPTING_VOLUME * settings.effectsVolume * masterVolume;
    isSculpting = true;
  } else if (!sculpting && isSculpting) {
    // Stop sculpting sound
    audioSources.sculpting.gainNode.gain.value = 0;
    isSculpting = false;
  }
}

// Initialize audio on first user interaction
document.addEventListener('click', () => {
  initAudio();
}, { once: true });

// Time Uniform
const startTime = Date.now();
const timeUniform = { type: 'f', value: 0.0 };
let prevTime = performance.now();

// Grass Shader
const grassUniforms = {
  textures: { value: [grassTexture, cloudTexture] },
  iTime: timeUniform,
  grassMinHeight: { value: GRASS_CANYON_THRESHOLD },
  planetCenter: { value: new THREE.Vector3(0, 0, 0) }
};

const grassMaterial = new THREE.ShaderMaterial({
  uniforms: grassUniforms,
  vertexShader: grassShader.vert,
  fragmentShader: grassShader.frag,
  vertexColors: true,
  side: THREE.DoubleSide
});

// Ground Shader
const groundUniforms = {
  cloudTexture: { value: cloudTexture },
  groundColor: { value: new THREE.Color(0x8B6914) },
  iTime: timeUniform,
  planetCenter: { value: new THREE.Vector3(0, 0, 0) },
  planetRadius: { value: PLANET_RADIUS }
};

const groundMaterial = new THREE.ShaderMaterial({
  uniforms: groundUniforms,
  vertexShader: groundShader.vert,
  fragmentShader: groundShader.frag,
  side: THREE.DoubleSide
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(-50, 100, 50);
scene.add(dirLight);

// Dynamic atmosphere - will update based on altitude
scene.background = SKY_COLOR.clone();

// Stars background - twinkling!
const starsGeometry = new THREE.BufferGeometry();
const starPositions = [];
const starSizes = [];
const starPhases = []; // For twinkling animation
for (let i = 0; i < 3000; i++) {
  const r = 150 + Math.random() * 350;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI;
  starPositions.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
  starSizes.push(0.3 + Math.random() * 1.5); // Varied sizes
  starPhases.push(Math.random() * Math.PI * 2); // Random phase for twinkling
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
starsGeometry.setAttribute('phase', new THREE.Float32BufferAttribute(starPhases, 1));

const starsMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    opacity: { value: 0 }
  },
  vertexShader: `
    attribute float size;
    attribute float phase;
    varying float vPhase;
    varying float vSize;
    void main() {
      vPhase = phase;
      vSize = size;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform float opacity;
    varying float vPhase;
    varying float vSize;
    void main() {
      // Circular star shape
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      
      // Twinkling effect
      float twinkle = 0.5 + 0.5 * sin(time * 2.0 + vPhase * 10.0);
      float brightness = mix(0.4, 1.0, twinkle);
      
      // Soft glow
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      
      // Color variation - some stars slightly colored
      vec3 starColor = vec3(1.0, 1.0, 1.0);
      if (vPhase > 4.5) starColor = vec3(1.0, 0.9, 0.8); // Warm
      if (vPhase < 1.5) starColor = vec3(0.8, 0.9, 1.0); // Cool
      
      gl_FragColor = vec4(starColor * brightness * glow, opacity * glow);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// Atmosphere glow around planet
const atmosphereGeometry = new THREE.SphereBufferGeometry(PLANET_RADIUS + 0.5, 32, 32);
const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: {
    glowColor: { value: new THREE.Color(0x88ccff) },
    viewVector: { value: camera.position }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.0);
      gl_FragColor = vec4(glowColor, intensity * 0.4);
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true
});
const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphereMesh);

// =============================================================================
// Water Sphere (Hacky Ocean) 🌊
// =============================================================================
// Placed slightly below base radius to fill deep valleys (-0.2 cutoff generally)
const waterGeometry = new THREE.SphereBufferGeometry(PLANET_RADIUS - 0.5, 64, 64);
const waterMaterial = new THREE.MeshPhongMaterial({
  color: 0x1e6091, // Deep Blue
  shininess: 90,
  opacity: 0.7,
  transparent: true,
  side: THREE.DoubleSide
});
const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
scene.add(waterMesh);

// =============================================================================
// Orbital Clouds - textured clouds drifting around the planet
// =============================================================================

const cloudMeshes = [];
const CLOUD_ORBIT_RADIUS = PLANET_RADIUS + 5; // Much higher above terrain!
const CLOUD_COUNT = 80; // Way more clouds!

for (let i = 0; i < CLOUD_COUNT; i++) {
  // Random position on sphere
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1); // Uniform sphere dist
  
  // Create cloud plane with cloud texture shader
  // Varied sizes: Some huge atmosphere patches, some small puffs
  const isBig = Math.random() > 0.8;
  const cloudSize = isBig ? (15 + Math.random() * 10) : (6 + Math.random() * 4);
  
  const cloudGeom = new THREE.PlaneBufferGeometry(cloudSize, cloudSize);
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      cloudTexture: { value: cloudTexture },
      opacity: { value: isBig ? 0.3 : 0.6 + Math.random() * 0.2 } // Big ones are fainter
    },
    vertexShader: cloudShader.vert,
    fragmentShader: cloudShader.frag,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  const cloud = new THREE.Mesh(cloudGeom, cloudMat);
  
  // Position cloud on orbit
  const x = Math.sin(phi) * Math.cos(theta) * CLOUD_ORBIT_RADIUS;
  const y = Math.cos(phi) * CLOUD_ORBIT_RADIUS;
  const z = Math.sin(phi) * Math.sin(theta) * CLOUD_ORBIT_RADIUS;
  cloud.position.set(x, y, z);
  
  // Orient cloud to face outward from planet (tangent to surface)
  cloud.lookAt(0, 0, 0);
  
  // Store orbital data for animation
  cloud.userData = {
    theta: theta,
    phi: phi,
    speed: 0.01 + Math.random() * 0.02, // Slow orbital speed
    verticalDrift: (Math.random() - 0.5) * 0.005
  };
  
  scene.add(cloud);
  cloudMeshes.push(cloud);
}

// =============================================================================
// New Features: Birds & Moon
// =============================================================================

const birdSwarm = new BirdSwarm(scene, 100); // 100 birds
const moonMesh = createMoon(scene, PLANET_RADIUS);

// =============================================================================
// Terrain Sculpting
// =============================================================================

let groundMesh = null;
let grassMesh = null;
let brushRadius = 0.15; // Halved! Angular radius in radians
const BRUSH_MIN = 0.05;
const BRUSH_MAX = 0.4;
const SCULPT_STRENGTH = 0.2; // Slightly gentler
const raycaster = new THREE.Raycaster();
let isMouseDown = false;
let sculptMode = 0;

// Brush Cursor
const cursorGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
const cursorMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8,
  depthTest: false
});
const brushCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
brushCursor.visible = false;
scene.add(brushCursor);

function updateBrushCursor() {
  if (!groundMesh || !isPointerLocked) {
    brushCursor.visible = false;
    return;
  }
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObject(groundMesh);
  
  if (intersects.length > 0) {
    const hit = intersects[0];
    brushCursor.visible = true;
    
    // Position on surface
    brushCursor.position.copy(hit.point);
    
    // Orient to face outward from planet
    const normal = hit.point.clone().normalize();
    brushCursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    
    // Scale based on brush size and distance from center
    const surfaceRadius = hit.point.length();
    brushCursor.scale.setScalar(brushRadius * surfaceRadius);
    
    // Color based on mode
    if (sculptMode === 1) {
      cursorMaterial.color.setHex(0x00ff00);
    } else if (sculptMode === -1) {
      cursorMaterial.color.setHex(0xff4444);
    } else {
      cursorMaterial.color.setHex(0xffffff);
    }
  } else {
    brushCursor.visible = false;
  }
}

// Brush UI
const brushUI = document.createElement('div');
brushUI.style.position = 'absolute';
brushUI.style.bottom = '30px';
brushUI.style.right = '30px';
brushUI.style.color = '#fff';
brushUI.style.fontFamily = "'Cormorant Garamond', serif";
brushUI.style.fontSize = '24px';
brushUI.style.fontStyle = 'italic';
brushUI.style.textAlign = 'right';
brushUI.style.pointerEvents = 'none';
brushUI.style.textShadow = '0 1px 4px rgba(0,0,0,0.5)';
brushUI.style.display = 'none';
document.body.appendChild(brushUI);

function updateBrushUI() {
  brushUI.innerHTML = `Brush Size: ${(brushRadius * 100).toFixed(0)}%<br><span style="font-size: 18px; opacity: 0.8">LMB: Raise · RMB: Lower · MMB: Flatten</span>`;
}

// updateBrushUI();

// Generate everything
// Delay generation slightly to allow UI to paint
setTimeout(() => {
  try {
    generatePlanet();
    grassMesh = generateSphericalGrass(!!savedTerrain);
    
    // Hide loader
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 1000);
    }
  } catch (err) {
    console.error('Generation failed:', err);
    const loader = document.getElementById('loader');
    if (loader) {
      const text = loader.querySelector('.loading-text');
      if (text) text.innerText = 'Error: ' + err.message;
      loader.querySelector('.spinner').style.borderColor = 'red';
    }
  }
}, 100);

// Sculpting handlers
document.addEventListener('mousedown', (event) => {
  if (!isPointerLocked) return;
  
  if (event.button === 0) {
    sculptMode = 1;
    isMouseDown = true;
  } else if (event.button === 2) {
    sculptMode = -1;
    isMouseDown = true;
  } else if (event.button === 1) { // Middle click for flatten
    sculptMode = 2; // Flatten
    isMouseDown = true;
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 0 || event.button === 2) {
    isMouseDown = false;
    sculptMode = 0;
  }
});

document.addEventListener('wheel', (event) => {
  if (!isPointerLocked) return;
  brushRadius -= event.deltaY * 0.001;
  brushRadius = Math.max(BRUSH_MIN, Math.min(BRUSH_MAX, brushRadius));
  updateBrushUI();
});

document.addEventListener('contextmenu', (event) => {
  if (isPointerLocked) event.preventDefault();
});

// =============================================================================
// Animation Loop
// =============================================================================

const animate = function () {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  const elapsedTime = Date.now() - startTime;
  grassUniforms.iTime.value = elapsedTime;
  groundUniforms.iTime.value = elapsedTime;

  // Spherical Player Movement
  if (isPointerLocked) {
    // Get current up direction (away from planet center)
    playerUp.copy(camera.position).normalize();
    
    // Calculate forward direction on the sphere surface
    // Start with a reference forward (any direction perpendicular to up)
    const refForward = new THREE.Vector3(0, 0, -1);
    if (Math.abs(playerUp.dot(refForward)) > 0.99) {
      refForward.set(1, 0, 0);
    }
    
    // Get tangent forward by removing up component
    playerForward.copy(refForward).sub(playerUp.clone().multiplyScalar(refForward.dot(playerUp))).normalize();
    
    // Rotate forward by player's horizontal look angle
    const rotationAroundUp = new THREE.Quaternion().setFromAxisAngle(playerUp, playerTheta);
    playerForward.applyQuaternion(rotationAroundUp);
    
    // Get right direction
    const playerRight = new THREE.Vector3().crossVectors(playerForward, playerUp).normalize();
    
    // Calculate movement
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (moveForward) moveDir.add(playerForward);
    if (moveBackward) moveDir.sub(playerForward);
    if (moveRight) moveDir.add(playerRight);
    if (moveLeft) moveDir.sub(playerRight);
    
    if (moveDir.length() > 0) {
      moveDir.normalize().multiplyScalar(MOVE_SPEED * delta);
      camera.position.add(moveDir);
    }
    
    // Apply gravity (pull toward center)
    verticalVelocity -= GRAVITY * delta;
    camera.position.add(playerUp.clone().multiplyScalar(verticalVelocity * delta));
    
    // Get terrain height at current position
    const currentRadius = camera.position.length();
    const surfaceHeight = getTerrainHeightAtPosition(camera.position);
    const targetRadius = surfaceHeight + PLAYER_HEIGHT;
    
    // Ground collision
    if (currentRadius < targetRadius) {
      camera.position.normalize().multiplyScalar(targetRadius);
      verticalVelocity = 0;
      canJump = true;
    }

    // [Fix] Smoothly interpolate up vector to prevent jitter
    const targetUp = camera.position.clone().normalize();
    playerUp.lerp(targetUp, 0.1).normalize();
    
    // Update camera orientation
    // Camera looks along the surface with vertical tilt
    const lookForward = playerForward.clone();
    const lookUp = playerUp.clone();
    
    // Apply vertical look (pitch)
    const pitchAxis = playerRight.clone();
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(pitchAxis, playerPhi);
    lookForward.applyQuaternion(pitchQuat);
    lookUp.applyQuaternion(pitchQuat);
    
    const lookTarget = camera.position.clone().add(lookForward);
    camera.up.copy(playerUp);
    camera.lookAt(lookTarget);
    
    // Update atmosphere based on altitude
    const altitude = currentRadius;
    const atmosphereT = Math.max(0, Math.min(1, (altitude - ATMOSPHERE_START) / (ATMOSPHERE_END - ATMOSPHERE_START)));
    
    // Blend background from sky to space
    scene.background.copy(SKY_COLOR).lerp(SPACE_COLOR, atmosphereT);
    
    // Fade in stars as we go higher (use uniform for shader)
    starsMaterial.uniforms.opacity.value = atmosphereT;
    starsMaterial.uniforms.time.value = elapsedTime / 1000; // Animate twinkling
    
    // Fade atmosphere glow
    atmosphereMaterial.uniforms.viewVector.value.copy(camera.position);
    
    // 🎵 Update ambient audio crossfade
    updateAmbientAudio(atmosphereT);
    
    // 🎵 Update walking audio (only when moving AND on ground)
    const isMoving = moveForward || moveBackward || moveLeft || moveRight;
    updateWalkingAudio(isMoving, canJump);
  }
  
  // Animate clouds - slow orbit around planet
  cloudMeshes.forEach(cloud => {
    const data = cloud.userData;
    data.theta += data.speed * delta;
    data.phi += data.verticalDrift * delta;
    
    // Keep phi in bounds
    if (data.phi < 0.2 || data.phi > 2.9) {
      data.verticalDrift *= -1;
    }
    
    const x = Math.sin(data.phi) * Math.cos(data.theta) * CLOUD_ORBIT_RADIUS;
    const y = Math.cos(data.phi) * CLOUD_ORBIT_RADIUS;
    const z = Math.sin(data.phi) * Math.sin(data.theta) * CLOUD_ORBIT_RADIUS;
    
    cloud.position.set(x, y, z);
    cloud.lookAt(0, 0, 0);
    cloud.rotateX(Math.PI);
  });
  
  // Animate Birds
  birdSwarm.update(delta);

  // Sculpt terrain while mouse is held
  if (isMouseDown && sculptMode !== 0) {
    sculptTerrain(sculptMode);
  }
  
  // 🎵 Update sculpting audio
  updateSculptingAudio(isMouseDown && sculptMode !== 0);
  
  updateBrushCursor();
  
  prevTime = time;
  renderer.render(scene, camera);
};

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =============================================================================
// Planet Generation
// =============================================================================

function generatePlanet() {
  const geometry = new THREE.SphereBufferGeometry(
    PLANET_RADIUS,
    SPHERE_SUBDIVISIONS,
    SPHERE_SUBDIVISIONS
  );
  
  const positions = geometry.attributes.position.array;
  
  if (savedTerrain && savedTerrain.vertices && savedTerrain.vertices.length === positions.length) {
    console.log('💾 Restoring saved spherical terrain...');
    for (let i = 0; i < positions.length; i++) {
      positions[i] = savedTerrain.vertices[i];
    }
  } else {
    // Generate terrain by displacing vertices radially
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      
      // Get spherical coordinates
      const r = Math.sqrt(x * x + y * y + z * z);
      const theta = Math.atan2(z, x);
      const phi = Math.acos(y / r);
      
      // Get terrain height at this location
      const terrainHeight = getSphericalTerrainHeight(theta, phi);
      
      // Displace vertex radially
      const newRadius = PLANET_RADIUS + terrainHeight;
      const scale = newRadius / r;
      
      positions[i] *= scale;
      positions[i + 1] *= scale;
      positions[i + 2] *= scale;
    }
  }
  
  geometry.computeVertexNormals();
  
  groundMesh = new THREE.Mesh(geometry, groundMaterial);
  scene.add(groundMesh);
}

function getTerrainHeightAtPosition(pos) {
  if (!groundMesh) return PLANET_RADIUS;
  
  // Raycast from outside the planet toward center
  const direction = pos.clone().normalize().negate();
  const origin = pos.clone().normalize().multiplyScalar(PLANET_RADIUS * 2);
  
  raycaster.set(origin, direction);
  const hits = raycaster.intersectObject(groundMesh);
  
  if (hits.length > 0) {
    return hits[0].point.length();
  }
  
  return PLANET_RADIUS;
}

// =============================================================================
// Terrain Sculpting
// =============================================================================

function sculptTerrain(direction) {
  if (!groundMesh) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObject(groundMesh);
  
  if (intersects.length > 0) {
    const hitPoint = intersects[0].point;
    const hitNormal = hitPoint.clone().normalize();
    
    const geometry = groundMesh.geometry;
    const positions = geometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vy = positions[i + 1];
      const vz = positions[i + 2];
      
      const vertexPos = new THREE.Vector3(vx, vy, vz);
      const vertexNormal = vertexPos.clone().normalize();
      
      // Calculate angular distance on sphere surface
      const angularDist = Math.acos(Math.min(1, Math.max(-1, hitNormal.dot(vertexNormal))));
      
      if (angularDist < brushRadius) {
        // Smooth falloff
        const falloff = 1 - (angularDist / brushRadius);
        const smoothFalloff = falloff * falloff;
        
        // Displace radially
        const currentRadius = vertexPos.length();
        
        let newRadius;
        if (direction === 2) { // Flatten Mode
             // Flatten to player's feet level (approx)
             // or just smooth average? Let's flatten to fixed radius for now or average
             // Simple flatten: Lerp towards PLANET_RADIUS
             newRadius = THREE.MathUtils.lerp(currentRadius, PLANET_RADIUS + 0.5, 0.05); // Gently flatten to "sea level + 0.5"
        } else {
             const displacement = direction * SCULPT_STRENGTH * smoothFalloff;
             newRadius = Math.max(PLANET_RADIUS * 0.7, Math.min(PLANET_RADIUS * 1.5, currentRadius + displacement));
        }
        
        const scale = newRadius / currentRadius;
        positions[i] *= scale;
        positions[i + 1] *= scale;
        positions[i + 2] *= scale;
      }
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    triggerSave();
  }
}

let saveTimeout;
function triggerSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTerrainState(groundMesh);
  }, 1000);
}

function saveTerrainState(mesh) {
  if (!mesh) return;
  
  const data = {
    seed: TERRAIN_SEED,
    vertices: Array.from(mesh.geometry.attributes.position.array)
  };
  
  try {
    localStorage.setItem(STORAGE_KEY_TERRAIN, JSON.stringify(data));
    console.log('💾 Spherical terrain saved!');
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

// =============================================================================
// Spherical Grass Generation
// =============================================================================

function generateSphericalGrass(useSaved = false) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  let bladesGenerated = 0;
  const targetBlades = useSaved ? 40000 : BLADE_COUNT;
  let attempts = 0;
  const maxAttempts = targetBlades * 3;
  
  while (bladesGenerated < targetBlades && attempts < maxAttempts) {
    attempts++;
    
    // Random point on sphere using spherical coordinates
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1); // Uniform distribution on sphere
    
    // Get direction from center
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );
    
    // Get actual terrain height at this location
    let surfaceRadius;
    if (useSaved && groundMesh) {
      // Sample from mesh
      const origin = dir.clone().multiplyScalar(PLANET_RADIUS * 2);
      const rayDir = dir.clone().negate();
      raycaster.set(origin, rayDir);
      const hits = raycaster.intersectObject(groundMesh);
      if (hits.length > 0) {
        surfaceRadius = hits[0].point.length();
      } else {
        continue;
      }
    } else {
      const terrainHeight = getSphericalTerrainHeight(theta, phi);
      surfaceRadius = PLANET_RADIUS + terrainHeight;
    }
    
    const displacement = surfaceRadius - PLANET_RADIUS;
    
    // [Biome Logic] Only place grass in the "Midlands" (Green Zone)
    // Lowlands = Sand (< -0.2), Midlands = Grass (-0.2 to 0.5), Highlands = Rock (> 0.5)
    if (displacement < -0.2 * 3.0) continue; // Too low (Sand)
    if (displacement > 0.5 * 3.0) continue;  // Too high (Rock/Snow)

    // Skip steep slopes (optional, but good for realism)
    // We'd need normal capability here, skipping for now to keep it simple

    // Random thinning
    if (Math.random() > 0.7) continue;
    
    const surfacePos = dir.clone().multiplyScalar(surfaceRadius);
    
    // Generate blade with surface normal as "up"
    const blade = generateSphericalBlade(surfacePos, dir, bladesGenerated * 5, theta, phi);
    blade.verts.forEach(vert => {
      positions.push(...vert.pos);
      uvs.push(...vert.uv);
      colors.push(...vert.color);
    });
    blade.indices.forEach(idx => indices.push(idx));
    bladesGenerated++;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, grassMaterial);
  scene.add(mesh);
  
  console.log(`🌿 Generated ${bladesGenerated} grass blades on planet`);
  return mesh;
}

function generateSphericalBlade(center, surfaceNormal, vArrOffset, theta, phi) {
  const MID_WIDTH = BLADE_WIDTH * 0.5;
  const TIP_OFFSET = 0.05;
  const height = BLADE_HEIGHT + (Math.random() * BLADE_HEIGHT_VARIATION);

  // Create a coordinate system on the sphere surface
  // "up" is the surface normal, we need two perpendicular tangent vectors
  const up = surfaceNormal.clone();
  
  // Find a perpendicular vector
  let tangent1 = new THREE.Vector3(1, 0, 0);
  if (Math.abs(up.dot(tangent1)) > 0.9) {
    tangent1.set(0, 1, 0);
  }
  tangent1.sub(up.clone().multiplyScalar(up.dot(tangent1))).normalize();
  
  const tangent2 = new THREE.Vector3().crossVectors(up, tangent1).normalize();
  
  // Random yaw rotation around surface normal
  const yaw = Math.random() * Math.PI * 2;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  
  // Blade direction in tangent plane
  const bladeDir = tangent1.clone().multiplyScalar(cosYaw).add(tangent2.clone().multiplyScalar(sinYaw));
  const bladePerp = tangent1.clone().multiplyScalar(-sinYaw).add(tangent2.clone().multiplyScalar(cosYaw));
  
  // Tip bend
  const tipBend = Math.random() * Math.PI * 2;
  const tipDir = tangent1.clone().multiplyScalar(Math.cos(tipBend)).add(tangent2.clone().multiplyScalar(Math.sin(tipBend)));

  // Vertex positions
  const bl = center.clone().add(bladeDir.clone().multiplyScalar(BLADE_WIDTH / 2));
  const br = center.clone().add(bladeDir.clone().multiplyScalar(-BLADE_WIDTH / 2));
  const tl = center.clone().add(bladeDir.clone().multiplyScalar(MID_WIDTH / 2)).add(up.clone().multiplyScalar(height / 2));
  const tr = center.clone().add(bladeDir.clone().multiplyScalar(-MID_WIDTH / 2)).add(up.clone().multiplyScalar(height / 2));
  const tc = center.clone().add(tipDir.clone().multiplyScalar(TIP_OFFSET)).add(up.clone().multiplyScalar(height));

  // Colors
  const black = [0, 0, 0];
  const gray = [0.5, 0.5, 0.5];
  const white = [1.0, 1.0, 1.0];
  
  // UVs based on spherical position
  const uv = [theta / (Math.PI * 2), phi / Math.PI];

  const verts = [
    { pos: bl.toArray(), uv: uv, color: black },
    { pos: br.toArray(), uv: uv, color: black },
    { pos: tr.toArray(), uv: uv, color: gray },
    { pos: tl.toArray(), uv: uv, color: gray },
    { pos: tc.toArray(), uv: uv, color: white }
  ];

  const indices = [
    vArrOffset,
    vArrOffset + 1,
    vArrOffset + 2,
    vArrOffset + 2,
    vArrOffset + 4,
    vArrOffset + 3,
    vArrOffset + 3,
    vArrOffset + 1,
    vArrOffset + 2
  ];

  return { verts, indices };
}

// Async grass regeneration
let isRegeneratingGrass = false;

function regenerateGrassAsync() {
  if (isRegeneratingGrass) return;
  
  console.log('🌿 Starting async grass regeneration...');
  isRegeneratingGrass = true;
  
  if (grassMesh) {
    scene.remove(grassMesh);
    grassMesh.geometry.dispose();
    grassMesh = null;
  }
  
  // Use requestAnimationFrame to avoid blocking
  requestAnimationFrame(() => {
    grassMesh = generateSphericalGrass(true);
    isRegeneratingGrass = false;
  });
}
