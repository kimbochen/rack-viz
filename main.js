import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const RACK_WIDTH = 6;
const RACK_DEPTH = 4;
const U = 0.35;

const TYPES = {
  ipmi: {
    name: 'IPMI',
    color: 0x4dd0e1,
    height: U,
    description: 'Intelligent Platform Management Interface module for out-of-band rack management and telemetry.',
    components: ['BMC controller', 'Management NIC', 'Console / serial port'],
  },
  power: {
    name: 'Power Shelf',
    color: 0xffb74d,
    height: U * 2,
    description: '33 kW power shelf delivering DC busbar power to the entire rack.',
    components: ['PSU 1', 'PSU 2', 'PSU 3', 'PSU 4', 'PSU 5', 'PSU 6', 'Busbar tap'],
  },
  compute: {
    name: 'Compute Tray',
    color: 0x64b5f6,
    height: U,
    description: 'GB200 compute tray with 2 Grace CPUs and 4 Blackwell GPUs interconnected via NVLink-C2C.',
    components: ['Bianca board ×2', 'Daughter board ×2', 'BlueField-3 ×2', 'Power distribution board', 'Storage bay'],
  },
  nvswitch: {
    name: 'NVSwitch5 Tray',
    color: 0x81c784,
    height: U,
    description: 'Non-scalable NVSwitch5 tray providing 5th-generation NVLink fabric to 72 GPUs in the rack.',
    components: ['NVSwitch5 ASIC 0', 'NVSwitch5 ASIC 1', 'OSFP cage row'],
  },
  drip: {
    name: 'Drip Tray',
    color: 0x9e9e9e,
    height: U * 0.6,
    description: 'Passive drip tray that catches any liquid cooling leakage between the upper and lower power zones.',
    components: ['Catch basin', 'Leak sensor'],
  },
};

const COMPUTE_PARTS = [
  { name: 'Bianca board',           color: 0x42a5f5, x: -2,   z: -1.2, w: 2,   d: 1.6 },
  { name: 'Bianca board',           color: 0x42a5f5, x:  2,   z: -1.2, w: 2,   d: 1.6 },
  { name: 'Daughter board',         color: 0xab47bc, x: -2,   z:  0.2, w: 0.4, d: 1.2 },
  { name: 'Daughter board',         color: 0xab47bc, x:  2,   z:  0.2, w: 0.4, d: 1.2 },
  { name: 'Power distribution',     color: 0xff7043, x:  0,   z:  0.2, w: 0.8, d: 1.2 },
  { name: 'BlueField-3',            color: 0x26a69a, x: -2,   z:  1.4, w: 1.2, d: 1.2 },
  { name: 'BlueField-3',            color: 0x26a69a, x:  2,   z:  1.4, w: 1.2, d: 1.2 },
  { name: 'Storage bay',            color: 0xffca28, x:  0,   z:  1.4, w: 0.8, d: 1.2 },
];

const RACK_LAYOUT = [
  { type: 'ipmi', count: 2 },
  { type: 'power', count: 2 },
  { type: 'compute', count: 10 },
  { type: 'nvswitch', count: 9 },
  { type: 'compute', count: 8 },
  { type: 'drip', count: 1 },
  { type: 'power', count: 2 },
];

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);
scene.fog = new THREE.Fog(0x0b0e14, 25, 60);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(14, 8, 16);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 40;
controls.target.set(0, 6, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(10, 18, 10);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x80a0ff, 0.35);
fillLight.position.set(-10, 6, -8);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(80, 80, 0x222831, 0x161a20);
grid.position.y = 0.001;
scene.add(grid);

const rackGroup = new THREE.Group();
scene.add(rackGroup);

const totalHeight = RACK_LAYOUT.reduce((acc, sec) => acc + TYPES[sec.type].height * sec.count, 0);

const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.7, metalness: 0.3 });
const frameThickness = 0.08;
const frameOffsetX = RACK_WIDTH / 2 + frameThickness / 2;
const frameOffsetZ = RACK_DEPTH / 2 + frameThickness / 2;
const postPositions = [
  [frameOffsetX, frameOffsetZ],
  [-frameOffsetX, frameOffsetZ],
  [frameOffsetX, -frameOffsetZ],
  [-frameOffsetX, -frameOffsetZ],
];
for (const [x, z] of postPositions) {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, totalHeight + 0.4, frameThickness),
    frameMaterial
  );
  post.position.set(x, totalHeight / 2 + 0.2, z);
  rackGroup.add(post);
}
const baseFrame = new THREE.Mesh(
  new THREE.BoxGeometry(RACK_WIDTH + 0.3, 0.2, RACK_DEPTH + 0.3),
  frameMaterial
);
baseFrame.position.y = 0.1;
rackGroup.add(baseFrame);

const boxes = [];
let cursorY = totalHeight + 0.2;

for (const section of RACK_LAYOUT) {
  const def = TYPES[section.type];
  for (let i = 0; i < section.count; i++) {
    cursorY -= def.height;
    const geometry = new THREE.BoxGeometry(RACK_WIDTH, def.height * 0.9, RACK_DEPTH);
    const material = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.55,
      metalness: 0.25,
      emissive: def.color,
      emissiveIntensity: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, cursorY + def.height / 2, 0);
    mesh.userData = { type: section.type, indexInSection: i, totalInSection: section.count };

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    mesh.add(edges);

    rackGroup.add(mesh);
    boxes.push(mesh);
  }
}

const componentGroup = new THREE.Group();
componentGroup.visible = false;
scene.add(componentGroup);

function addPart(box, p, partHeight) {
  const geom = new THREE.BoxGeometry(p.w, partHeight, p.d);
  const mat = new THREE.MeshStandardMaterial({
    color: p.color,
    roughness: 0.4,
    metalness: 0.45,
    emissive: p.color,
    emissiveIntensity: 0.18,
  });
  const part = new THREE.Mesh(geom, mat);
  part.position.set(box.position.x + p.x, box.position.y, box.position.z + p.z);
  part.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geom),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
  ));
  componentGroup.add(part);
}

const COMPUTE_COMPONENT_LIST = [
  { name: 'Bianca board',           count: 2, color: 0x42a5f5 },
  { name: 'Daughter board',         count: 2, color: 0xab47bc },
  { name: 'BlueField-3',            count: 2, color: 0x26a69a },
  { name: 'Power distribution',     count: 1, color: 0xff7043 },
  { name: 'Storage bay',            count: 1, color: 0xffca28 },
];

function getComponentList(type) {
  if (type === 'compute') return COMPUTE_COMPONENT_LIST;
  const def = TYPES[type];
  return def.components.map((name) => ({ name, count: 1, color: def.color }));
}

function buildComponentsForBox(box) {
  while (componentGroup.children.length) componentGroup.remove(componentGroup.children[0]);

  const def = TYPES[box.userData.type];
  const partHeight = def.height * 0.65;

  if (box.userData.type === 'compute') {
    for (const p of COMPUTE_PARTS) addPart(box, p, partHeight);
    return;
  }

  const components = def.components;
  const innerW = RACK_WIDTH * 0.92;
  const innerD = RACK_DEPTH * 0.92;
  const cols = Math.ceil(Math.sqrt(components.length * (innerW / innerD)));
  const rows = Math.ceil(components.length / cols);
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const margin = 0.08;

  for (let i = 0; i < components.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = -innerW / 2 + cellW / 2 + c * cellW;
    const z = -innerD / 2 + cellD / 2 + r * cellD;
    addPart(box, {
      name: components[i],
      color: def.color,
      x, z,
      w: cellW - margin,
      d: cellD - margin,
    }, partHeight);
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const downPos = new THREE.Vector2();

let hovered = null;
let selected = null;

const camAnim = {
  active: false,
  t: 0,
  duration: 0.8,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3(),
};

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateCameraTo(toPos, toTarget) {
  camAnim.fromPos.copy(camera.position);
  camAnim.toPos.copy(toPos);
  camAnim.fromTarget.copy(controls.target);
  camAnim.toTarget.copy(toTarget);
  camAnim.t = 0;
  camAnim.active = true;
}

const defaultCamPos = camera.position.clone();
const defaultTarget = controls.target.clone();

function selectBox(box) {
  selected = box;
  buildComponentsForBox(box);
  componentGroup.visible = true;
  for (const b of boxes) {
    if (b === box) {
      b.material.transparent = true;
      b.material.opacity = 0.0;
      b.visible = true;
    } else {
      b.visible = false;
    }
  }
  rackGroup.children.forEach((c) => {
    if (c.material === frameMaterial) c.visible = false;
  });

  const offset = box.userData.type === 'compute'
    ? new THREE.Vector3(2, 4.5, 5.5)
    : new THREE.Vector3(RACK_WIDTH * 0.6, RACK_DEPTH * 1.2, RACK_DEPTH * 1.6);
  const camTo = box.position.clone().add(offset);
  animateCameraTo(camTo, box.position.clone());

  const def = TYPES[box.userData.type];
  document.getElementById('info-breadcrumb').textContent = `GB200 NVL72  ›  ${def.name}`;
  document.getElementById('info-title').textContent = def.name;
  document.getElementById('info-count').textContent = `Unit ${box.userData.indexInSection + 1} of ${box.userData.totalInSection}`;
  document.getElementById('info-desc').textContent = def.description;
  const ul = document.getElementById('info-components');
  ul.innerHTML = '';
  for (const c of getComponentList(box.userData.type)) {
    const li = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'comp-swatch';
    swatch.style.background = '#' + c.color.toString(16).padStart(6, '0');
    li.appendChild(swatch);
    const txt = document.createElement('span');
    txt.textContent = c.count > 1 ? `${c.name} ×${c.count}` : c.name;
    li.appendChild(txt);
    ul.appendChild(li);
  }
  document.getElementById('info-panel').classList.remove('hidden');
}

function deselect() {
  selected = null;
  componentGroup.visible = false;
  for (const b of boxes) {
    b.material.transparent = false;
    b.material.opacity = 1.0;
    b.visible = true;
  }
  rackGroup.children.forEach((c) => {
    if (c.material === frameMaterial) c.visible = true;
  });
  animateCameraTo(defaultCamPos, defaultTarget);
  document.getElementById('info-panel').classList.add('hidden');
}

function setPointer(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener('pointerdown', (e) => {
  downPos.set(e.clientX, e.clientY);
});

canvas.addEventListener('pointerup', (e) => {
  const dx = e.clientX - downPos.x;
  const dy = e.clientY - downPos.y;
  if (Math.hypot(dx, dy) > 4) return;
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(boxes, false);
  if (hits.length > 0) {
    selectBox(hits[0].object);
  }
});

canvas.addEventListener('pointermove', (e) => {
  setPointer(e);
  if (selected) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(boxes, false);
  const top = hits[0]?.object || null;
  if (top !== hovered) {
    if (hovered) hovered.material.emissiveIntensity = 0.05;
    hovered = top;
    if (hovered) hovered.material.emissiveIntensity = 0.4;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }
});

document.getElementById('back-btn').addEventListener('click', deselect);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selected) deselect();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const legend = document.getElementById('legend');
for (const key of Object.keys(TYPES)) {
  const def = TYPES[key];
  const item = document.createElement('div');
  item.className = 'legend-item';
  const swatch = document.createElement('div');
  swatch.className = 'legend-swatch';
  swatch.style.background = '#' + def.color.toString(16).padStart(6, '0');
  const label = document.createElement('span');
  label.textContent = def.name;
  item.appendChild(swatch);
  item.appendChild(label);
  legend.appendChild(item);
}

const clock = new THREE.Clock();

function animate() {
  const dt = clock.getDelta();
  if (camAnim.active) {
    camAnim.t += dt / camAnim.duration;
    const k = easeInOutCubic(Math.min(camAnim.t, 1));
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
    if (camAnim.t >= 1) camAnim.active = false;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
