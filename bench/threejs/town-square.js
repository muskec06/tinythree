import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe0f7);
scene.fog = new THREE.Fog(0xbfe0f7, 50, 120);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(22, 13, 24);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a50, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 130 });
scene.add(sun);

// procedural canvas textures
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function canvasTexture(draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  draw(g, (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}
const grassTex = canvasTexture((g) => {
  const d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const k = 0.8 + rnd() * 0.4;
    d.data.set([74 * k, 130 * k, 58 * k, 255], i);
  }
  g.putImageData(d, 0, 0);
}, 30);
const tilesTex = canvasTexture((g, fill) => {
  fill('#a49a88', 0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) fill(`hsl(38,25%,${70 + rnd() * 10}%)`, i * 64 + 2, j * 64 + 2, 60, 60);
}, 8);
const brickTex = canvasTexture((g, fill) => {
  fill('#c9c3b8', 0, 0, 256, 256);
  for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) fill(`hsl(${10 + rnd() * 10},55%,${36 + rnd() * 10}%)`, k * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28);
}, 1);
brickTex.repeat.set(3, 2);
const woodTex = canvasTexture((g, fill) => {
  fill('#9a6a3e', 0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) fill(`rgba(60,30,10,${rnd() * 0.35})`, 0, y, 256, 2 + rnd() * 3);
}, 1);

const std = (o) => new THREE.MeshStandardMaterial(o);
const colorMat = (c) => std({ color: c, roughness: 0.6 });
const glass = std({ color: 0xbcd9ef, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.8 });
const lampGlow = std({ color: 0xfff4c8, emissive: 0xfff4c8, emissiveIntensity: 2 });

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? colorMat(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const cyl = (r, h, mat, x, y, z, p) => mesh(new THREE.CylinderGeometry(r, r, h, 32), mat, x, y, z, p);
function place(obj, x, z, ry = 0) {
  const o = obj.clone();
  o.position.set(x, 0, z);
  o.rotation.y = THREE.MathUtils.degToRad(ry);
  scene.add(o);
  return o;
}

// reusable parts (1 unit = 1 m)
const house = new THREE.Group();
box(6, 3, 5, 0xefe6d8, 0, 1.5, 0, house);
const shape = new THREE.Shape([new THREE.Vector2(-3.4, 0), new THREE.Vector2(3.4, 0), new THREE.Vector2(0, 2)]);
mesh(new THREE.ExtrudeGeometry(shape, { depth: 5.4, bevelEnabled: false }), 0xa5452c, 0, 3, -2.7, house);
box(1, 2, 0.1, 0x7b4a26, 0, 1, 2.5, house);
for (const x of [-1.8, 1.8]) box(1, 1, 0.1, 0x9ec9e8, x, 1.7, 2.5, house);
const tree = new THREE.Group();
cyl(0.15, 1.6, 0x6b4b2a, 0, 0.8, 0, tree);
mesh(new THREE.SphereGeometry(1.2, 32, 16), 0x3f7a3a, 0, 2.6, 0, tree).scale.set(1, 1.2, 1);
const bench = new THREE.Group();
box(1.6, 0.08, 0.45, 0x8b5a2b, 0, 0.45, 0, bench);
box(1.6, 0.4, 0.06, 0x8b5a2b, 0, 0.75, -0.2, bench);
for (const x of [-0.7, 0.7]) box(0.06, 0.45, 0.4, 0x333333, x, 0.22, 0, bench);
const lamp = new THREE.Group();
mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.5, 32), 0x2d3436, 0, 1.75, 0, lamp);
mesh(new THREE.SphereGeometry(0.18, 32, 16), lampGlow, 0, 3.6, 0, lamp);
const person = new THREE.Group();
for (const x of [-0.1, 0.1]) cyl(0.09, 0.85, 0x2b3a55, x, 0.43, 0, person);
mesh(new THREE.CapsuleGeometry(0.2, 0.45, 8, 16), 0xc0392b, 0, 1.17, 0, person);
mesh(new THREE.SphereGeometry(0.13, 32, 16), 0xe0b48c, 0, 1.66, 0, person);
const carModel = new THREE.Group();
box(4, 0.8, 1.8, 0x2e86de, 0, 0.7, 0, carModel);
box(2.2, 0.7, 1.6, glass, -0.2, 1.45, 0, carModel);
for (const x of [-1.3, 1.3]) for (const z of [-0.85, 0.85]) cyl(0.35, 0.25, 0x222222, x, 0.35, z, carModel).rotation.x = Math.PI / 2;
const fence = new THREE.Group();
for (let i = 0; i < 6; i++) box(0.08, 1, 0.08, 0x8b5a2b, i * 0.5, 0.5, 0, fence);
for (const y of [0.75, 0.35]) box(2.6, 0.06, 0.04, 0x8b5a2b, 1.25, y, 0, fence);

// the square
const ground = mesh(new THREE.PlaneGeometry(120, 120), std({ map: grassTex }), 0, 0, 0, scene);
ground.rotation.x = -Math.PI / 2;
box(22, 0.06, 22, std({ map: tilesTex }), 0, 0.03, 0, scene);
box(2.4, 0.8, 2.4, std({ map: brickTex }), 0, 0.4, 0, scene);
const woodMat = std({ map: woodTex });
box(2.8, 0.12, 2.8, woodMat, 0, 2.2, 0, scene);
for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) cyl(0.08, 1.4, woodMat, x, 1.5, z, scene);
for (let i = 0; i < 3; i++) place(house, -7 + i * 7, -15);
for (let i = 0; i < 2; i++) place(house, -16, -5 + i * 8, 90);
for (let i = 0; i < 5; i++) place(tree, -10 + i * 5, 10);
for (let i = 0; i < 3; i++) place(bench, -4 + i * 4, -5);
for (const x of [-10, 10]) for (const z of [-10, 10]) place(lamp, x, z);
place(person, 2, 3, -30);
place(person, 3, 2.4, 150);
const car = place(carModel, 14, 0, 90);
for (let i = 0; i < 3; i++) place(fence, 12, -12 + i * 2.6, 90);

// glTF model with its own animation
let mixer = null;
new GLTFLoader().load('assets/windmill.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.scene.position.set(14, 0, -12);
  g.scene.rotation.y = THREE.MathUtils.degToRad(-30);
  g.scene.scale.setScalar(1.5);
  scene.add(g.scene);
  mixer = new THREE.AnimationMixer(g.scene);
  g.animations.forEach((clip) => mixer.clipAction(clip).play());
});

// text label as a sprite
const c = document.createElement('canvas');
const g = c.getContext('2d');
g.font = 'bold 96px system-ui, sans-serif';
const w = Math.ceil(g.measureText('Town Square').width) + 48;
c.width = w; c.height = 128;
g.fillStyle = '#1b2a4a'; g.beginPath(); g.roundRect(0, 0, w, 128, 28); g.fill();
g.font = 'bold 96px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
g.fillText('Town Square', 24, 68);
const labelTex = new THREE.CanvasTexture(c);
labelTex.colorSpace = THREE.SRGBColorSpace;
const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex }));
label.scale.set((w / 128) * 1.4, 1.4, 1);
label.position.set(0, 4, 0);
scene.add(label);

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  car.position.z = 9 * ease(Math.min(1, t / 6));
  if (mixer) mixer.setTime(t);
  if (!userMoved) {
    const r = Math.hypot(22, 24), a = Math.atan2(24, 22) + (t * Math.PI * 2) / 48;
    camera.position.set(Math.cos(a) * r, 13, Math.sin(a) * r);
    camera.lookAt(0, 1, 0);
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
