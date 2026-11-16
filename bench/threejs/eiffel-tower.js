import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9cdee);
scene.fog = new THREE.Fog(0xcfe2f3, 60, 160);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(27, 8, 31);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 14, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8a55, 0.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 3);
sun.position.set(30, 45, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 180 });
scene.add(sun);

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, ...o });
const iron = std(0x7a5a40, { roughness: 0.6, metalness: 0.4 });
const deck = std(0x5e4532, { roughness: 0.7 });
const glass = std(0xcfe8ff, { emissive: 0xcfe8ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 });
const beacon = std(0xffe28a, { emissive: 0xffe28a, emissiveIntensity: 3 });
const leaf = std(0x3f7a3a, { roughness: 1, flatShading: true });
const stone = std(0xe9dfc9, { roughness: 0.9 });
const slate = std(0x6f7680, { roughness: 0.8 });
const water = std(0x4f86bd, { roughness: 0.2, metalness: 0.3 });
const white = std(0xffffff);

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

// Lattice segment: 4 corner posts, a ring per bay, X braces on each face — one InstancedMesh.
const beamGeo = new THREE.BoxGeometry(1, 1, 1);
function truss(w0, w1, h, x, y, z, lx = 0, lz = 0, bays = Math.max(1, Math.round(h / ((w0 + w1) * 0.3))), t = (w0 + w1) * 0.011) {
  const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const P = (k, yy) => {
    const f = yy / h, hw = (w0 + (w1 - w0) * f) / 2;
    return new THREE.Vector3(lx * f + C[k][0] * hw, yy, lz * f + C[k][1] * hw);
  };
  const beams = [];
  for (let i = 0; i < bays; i++) {
    const y0 = (i * h) / bays, y1 = ((i + 1) * h) / bays;
    for (let k = 0; k < 4; k++) {
      const j = (k + 1) % 4;
      beams.push([P(k, y0), P(k, y1), t * 2.2], [P(k, y1), P(j, y1), t], [P(k, y0), P(j, y1), t * 0.7], [P(j, y0), P(k, y1), t * 0.7]);
      if (i === 0) beams.push([P(k, y0), P(j, y0), t]);
    }
  }
  const m = new THREE.InstancedMesh(beamGeo, iron, beams.length);
  const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  beams.forEach(([a, b, th], i) => {
    const d = b.clone().sub(a), len = d.length();
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(up, d.normalize());
    o.scale.set(th, len, th);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.computeBoundingSphere();
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

// four curved legs, three segments each, leaning toward the axis
for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
  truss(2.6, 2.1, 3, 5 * sx, 0, 5 * sz, -1.25 * sx, -1.25 * sz);
  truss(2.1, 1.7, 2.76, 3.75 * sx, 3, 3.75 * sz, -0.85 * sx, -0.85 * sz);
  truss(1.7, 1.25, 5.84, 2.9 * sx, 5.76, 2.9 * sz, -1.5 * sx, -1.5 * sz);
}
for (let i = 0; i < 4; i++) {
  const a = (i * Math.PI) / 2;
  for (const [R, r, d] of [[3.4, 0.09, 4.55], [3.2, 0.045, 4.3]]) {
    const arch = mesh(new THREE.TorusGeometry(R, r, 16, 64, Math.PI), iron, Math.cos(a) * d, 0.5, Math.sin(a) * d);
    arch.rotation.y = Math.PI / 2 - a;
  }
}
box(7, 0.3, 7, deck, 0, 5.76, 0);
truss(7.4, 7.4, 0.8, 0, 5.9, 0, 0, 0, 14, 0.03);
box(4.2, 0.25, 4.2, deck, 0, 11.6, 0);
truss(4.5, 4.5, 0.5, 0, 11.72, 0, 0, 0, 10, 0.03);
truss(4, 2.9, 4.4, 0, 11.6, 0);
truss(2.9, 2, 5, 0, 16, 0);
truss(2, 1.15, 6.6, 0, 21, 0);
box(1.7, 0.12, 1.7, deck, 0, 27.6, 0);
box(1.2, 0.7, 1.2, glass, 0, 28.05, 0);
truss(1, 0.5, 1.4, 0, 28.4, 0, 0, 0, 3);
mesh(new THREE.CylinderGeometry(0.04, 0.09, 3, 32), iron, 0, 31.3, 0);
mesh(new THREE.SphereGeometry(0.14, 32, 16), beacon, 0, 29.9, 0);

// Champ de Mars
const ground = mesh(new THREE.PlaneGeometry(300, 300), std(0x8fb06a));
ground.rotation.x = -Math.PI / 2;
box(18, 0.04, 18, std(0xd9ceb4), 0, 0.02, 0);
for (const x of [-5, 5]) box(7, 0.05, 46, std(0x77a352), x, 0.03, 36);
box(2.6, 0.05, 46, std(0xe2d6bb), 0, 0.03, 36);
function tree(x, z) {
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 32), std(0x6b4b2a), x, 0.45, z);
  mesh(new THREE.SphereGeometry(0.8, 32, 16), leaf, x, 1.5, z).scale.set(1, 1.25, 1);
}
const grid = (nx, nz, x0, z0, dx, dz, fn) => {
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) fn(x0 + i * dx, z0 + j * dz);
};
grid(2, 9, -10, 14, 20, 5, tree);
grid(2, 8, -13, 16, 26, 5.5, tree);
grid(4, 3, -24, -6, 16, 6, tree);

// the Seine and the Right Bank
box(300, 0.06, 10, water, 0, 0.04, -18);
for (const z of [-12.6, 12.6]) box(300, 0.4, 1.2, stone, 0, 0.2, z);
function block(x, z, sy = 1, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.scale.set(1, sy, 1);
  box(6, 3.2, 4, stone, 0, 1.6, 0, g);
  box(6.2, 0.9, 4.2, slate, 0, 3.6, 0, g);
  scene.add(g);
}
for (let i = 0; i < 12; i++) {
  block(-33 + i * 6.4, -28);
  block(-33 + i * 6.4, -34, 1.2);
}
for (let i = 0; i < 6; i++) for (const x of [-28, 28]) block(x, 22 + i * 7, 1, Math.PI / 2);

// clouds
function cloud(x, y, z, s = 1) {
  const g = new THREE.Group();
  for (const [r, cx, cy, cz] of [[2.4, 0, 0, 0], [1.8, 2.4, -0.4, 0.3], [1.6, -2.3, -0.6, -0.2]]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), white);
    c.position.set(cx, cy, cz);
    g.add(c);
  }
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  scene.add(g);
  return g;
}
const c1 = cloud(-30, 30, -40);
const c2 = cloud(25, 36, -55, 1.4);
cloud(45, 26, 10, 0.9);

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (!userMoved) {
    const r = Math.hypot(27, 31), a = Math.atan2(31, 27) + (t * Math.PI * 2) / 60;
    camera.position.set(Math.cos(a) * r, 8, Math.sin(a) * r);
    camera.lookAt(0, 14, 0);
  }
  c1.position.x = -30 + 4 * Math.sin((t * Math.PI * 2) / 30);
  c2.position.x = 25 + 5 * Math.sin((t * Math.PI * 2) / 40);
  beacon.emissiveIntensity = 3 + 2 * Math.sin((t * Math.PI * 2) / 1.5);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
