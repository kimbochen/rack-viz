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

// Spec is rows × columns (depth × width). Layout 9 wide × 10 deep, scaled by 0.4
// to fit the tray's 4-unit depth; plate is also narrowed in X to match (3.6 wide).
// Row 1 (back, depth 2):  A | X (gap) | A   - A is 4w × 5d
// Row 2 (mid,  depth 0.8): B | D | B         - B 3w×1d back-aligned, D 3w×2d
// Row 3 (front,depth 1.2): C | E | C         - C 3w×3d, E 3w×2d centered
const COMPUTE_PARTS = [
  { name: 'Bianca board',       color: 0x42a5f5, x: -1.0, z: -1.0, w: 1.6, d: 2.0 },
  { name: 'Bianca board',       color: 0x42a5f5, x:  1.0, z: -1.0, w: 1.6, d: 2.0 },
  { name: 'Daughter board',     color: 0xab47bc, x: -1.2, z:  0.2, w: 1.2, d: 0.4 },
  { name: 'Daughter board',     color: 0xab47bc, x:  1.2, z:  0.2, w: 1.2, d: 0.4 },
  { name: 'Power distribution', color: 0xff7043, x:  0.0, z:  0.4, w: 1.2, d: 0.8 },
  { name: 'BlueField-3',        color: 0x26a69a, x: -1.2, z:  1.4, w: 1.2, d: 1.2 },
  { name: 'BlueField-3',        color: 0x26a69a, x:  1.2, z:  1.4, w: 1.2, d: 1.2 },
  { name: 'Storage bay',        color: 0xffca28, x:  0.0, z:  1.4, w: 1.2, d: 0.8 },
];

// Bianca board layout. Spec rows × cols. Layout 6.5 wide × 7.5 deep (unscaled),
// scaled by BIANCA_SCALE = 0.55 to render as a roughly 3.6 × 4 platter.
const BIANCA_SCALE = 0.55;
const BIANCA_PLATE_W = 6.5 * BIANCA_SCALE;
const BIANCA_PLATE_D = 7.5 * BIANCA_SCALE;
const BIANCA_PARTS = [
  { name: 'NVLink5 Connector', color: 0x424242, x:  0,    z: -3.5,  w: 4,   d: 0.5 },
  { name: 'Blackwell GPU',     color: 0x76d275, x: -1.75, z: -1.75, w: 3,   d: 3   },
  { name: 'Blackwell GPU',     color: 0x76d275, x:  1.75, z: -1.75, w: 3,   d: 3   },
  { name: 'LPDDR5X',           color: 0xb39ddb, x: -2,    z:  0.75, w: 1,   d: 2   },
  { name: 'Grace CPU',         color: 0xff8a65, x:  0,    z:  0.75, w: 3,   d: 2   },
  { name: 'LPDDR5X',           color: 0xb39ddb, x:  2,    z:  0.75, w: 1,   d: 2   },
  { name: 'CX-7',              color: 0x4dd0e1, x: -1,    z:  2.75, w: 1.5, d: 2   },
  { name: 'CX-7',              color: 0x4dd0e1, x:  1,    z:  2.75, w: 1.5, d: 2   },
];

const BIANCA_COMPONENT_LIST = [
  { name: 'NVLink5 Connector', count: 1, color: 0x424242 },
  { name: 'Blackwell GPU',     count: 2, color: 0x76d275 },
  { name: 'Grace CPU',         count: 1, color: 0xff8a65 },
  { name: 'LPDDR5X',           count: 2, color: 0xb39ddb },
  { name: 'CX-7',              count: 2, color: 0x4dd0e1 },
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

const biancaGroup = new THREE.Group();
biancaGroup.visible = false;
scene.add(biancaGroup);

const PLATE_SCALE_Y = 0.18;
const COMPONENT_HEIGHT = 0.55;
const PLATE_THICKNESS_FALLBACK = U * 0.9 * PLATE_SCALE_Y;

function plateXScaleFor(type) {
  if (type === 'compute') return 0.6;
  return 1;
}

function addPart(group, p, partHeight, cx, cy, cz, scale = 1) {
  const geom = new THREE.BoxGeometry(p.w * scale, partHeight, p.d * scale);
  const mat = new THREE.MeshStandardMaterial({
    color: p.color,
    roughness: 0.4,
    metalness: 0.45,
    emissive: p.color,
    emissiveIntensity: 0.18,
  });
  const part = new THREE.Mesh(geom, mat);
  part.position.set(cx + p.x * scale, cy, cz + p.z * scale);
  part.userData = { partName: p.name };
  part.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geom),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
  ));
  group.add(part);
  return part;
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
  const plateThickness = def.height * 0.9 * PLATE_SCALE_Y;
  const plateTopY = box.position.y + plateThickness / 2;
  const centerY = plateTopY + COMPONENT_HEIGHT / 2;

  if (box.userData.type === 'compute') {
    for (const p of COMPUTE_PARTS) {
      addPart(componentGroup, p, COMPONENT_HEIGHT, box.position.x, centerY, box.position.z);
    }
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
    addPart(componentGroup, {
      name: components[i],
      color: def.color,
      x, z,
      w: cellW - margin,
      d: cellD - margin,
    }, COMPONENT_HEIGHT, box.position.x, centerY, box.position.z);
  }
}

function buildBianca(centerPos) {
  while (biancaGroup.children.length) biancaGroup.remove(biancaGroup.children[0]);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(BIANCA_PLATE_W, PLATE_THICKNESS_FALLBACK, BIANCA_PLATE_D),
    new THREE.MeshStandardMaterial({
      color: 0x42a5f5, roughness: 0.55, metalness: 0.25,
      emissive: 0x42a5f5, emissiveIntensity: 0.05,
    })
  );
  plate.position.set(centerPos.x, centerPos.y, centerPos.z);
  plate.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(plate.geometry),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
  ));
  biancaGroup.add(plate);

  const centerY = centerPos.y + PLATE_THICKNESS_FALLBACK / 2 + COMPONENT_HEIGHT / 2;
  for (const p of BIANCA_PARTS) {
    addPart(biancaGroup, p, COMPONENT_HEIGHT, centerPos.x, centerY, centerPos.z, BIANCA_SCALE);
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const downPos = new THREE.Vector2();

let hovered = null;
let selected = null;
let biancaActive = false;

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

function renderSidebar({ breadcrumb, title, count, desc, items }) {
  document.getElementById('info-breadcrumb').textContent = breadcrumb;
  document.getElementById('info-title').textContent = title;
  document.getElementById('info-count').textContent = count || '';
  document.getElementById('info-desc').textContent = desc || '';
  const ul = document.getElementById('info-components');
  ul.innerHTML = '';
  for (const c of items) {
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
  document.getElementById('sidebar-default').classList.add('hidden');
  document.getElementById('sidebar-detail').classList.remove('hidden');
}

function showTrayView(box) {
  biancaActive = false;
  biancaGroup.visible = false;
  for (const b of boxes) {
    if (b === box) {
      b.scale.set(plateXScaleFor(b.userData.type), PLATE_SCALE_Y, 1);
      b.visible = true;
    } else {
      b.visible = false;
      b.scale.set(1, 1, 1);
    }
  }
  rackGroup.children.forEach((c) => {
    if (c.material === frameMaterial) c.visible = false;
  });
  buildComponentsForBox(box);
  componentGroup.visible = true;

  const def = TYPES[box.userData.type];
  const offset = new THREE.Vector3(2.5, 4, 5.5);
  const target = box.position.clone();
  target.y += COMPONENT_HEIGHT / 2;
  animateCameraTo(target.clone().add(offset), target);

  renderSidebar({
    breadcrumb: `GB200 NVL72  ›  ${def.name}`,
    title: def.name,
    count: `Unit ${box.userData.indexInSection + 1} of ${box.userData.totalInSection}`,
    desc: def.description,
    items: getComponentList(box.userData.type),
  });
}

function selectBox(box) {
  selected = box;
  showTrayView(box);
}

function selectBianca() {
  if (!selected) return;
  biancaActive = true;
  componentGroup.visible = false;
  selected.visible = false;
  buildBianca(selected.position);
  biancaGroup.visible = true;

  const offset = new THREE.Vector3(3, 4.5, 6);
  const target = selected.position.clone();
  target.y += COMPONENT_HEIGHT / 2;
  animateCameraTo(target.clone().add(offset), target);

  const trayName = TYPES[selected.userData.type].name;
  renderSidebar({
    breadcrumb: `GB200 NVL72  ›  ${trayName}  ›  Bianca board`,
    title: 'Bianca board',
    count: '2 per Compute Tray',
    desc: 'Carrier board hosting one Grace CPU, two Blackwell GPUs, LPDDR5X memory and ConnectX-7 NICs.',
    items: BIANCA_COMPONENT_LIST,
  });
}

function goBack() {
  if (biancaActive) {
    biancaGroup.visible = false;
    showTrayView(selected);
    return;
  }
  deselect();
}

function deselect() {
  selected = null;
  biancaActive = false;
  componentGroup.visible = false;
  biancaGroup.visible = false;
  for (const b of boxes) {
    b.scale.set(1, 1, 1);
    b.visible = true;
  }
  rackGroup.children.forEach((c) => {
    if (c.material === frameMaterial) c.visible = true;
  });
  animateCameraTo(defaultCamPos, defaultTarget);
  document.getElementById('sidebar-detail').classList.add('hidden');
  document.getElementById('sidebar-default').classList.remove('hidden');
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

  if (biancaActive) return;

  if (selected) {
    const partHits = raycaster.intersectObjects(componentGroup.children, false);
    if (partHits.length > 0 && partHits[0].object.userData.partName === 'Bianca board') {
      selectBianca();
    }
    return;
  }

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

document.getElementById('back-btn').addEventListener('click', goBack);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selected) goBack();
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
