import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe3f5);
scene.fog = new THREE.Fog(0xcfe3f5, 25, 70);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(12, 4.5, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7d5a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(6, 14, 8);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sun);

const iron = new THREE.MeshStandardMaterial({ color: 0x6a5240, roughness: 0.8, metalness: 0.3 });
const lattice = new THREE.MeshStandardMaterial({ color: 0x8a6d55, wireframe: true });
const deck = new THREE.MeshStandardMaterial({ color: 0x3e3027, roughness: 0.7 });
const beacon = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffd27a, emissiveIntensity: 3 });
const deg = THREE.MathUtils.degToRad;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x7c9a5c }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function add(geo, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
// four legs leaning inward, on the diagonals
for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + i * Math.PI / 2;
  const leg = add(new THREE.BoxGeometry(0.45, 2.4, 0.45), iron, Math.cos(a) * 1.9, 1.1, Math.sin(a) * 1.9);
  leg.rotation.set(0, -a, deg(22));
}
// arches between the legs
for (let i = 0; i < 4; i++) {
  const a = i * Math.PI / 2;
  const arch = add(new THREE.TorusGeometry(1.15, 0.07, 16, 64, Math.PI), iron, Math.cos(a) * 1.45, 0.85, Math.sin(a) * 1.45);
  arch.rotation.y = Math.PI / 2 - a;
}
add(new THREE.BoxGeometry(2.5, 0.16, 2.5), deck, 0, 2.25, 0);
function section(rTop, rBottom, h, y) {
  for (const [mat, k] of [[lattice, 1], [iron, 0.9]]) {
    const s = add(new THREE.CylinderGeometry(rTop * k, rBottom * k, h, 4), mat, 0, y, 0);
    s.rotation.y = Math.PI / 4;
  }
}
section(1.05, 1.65, 1.9, 3.25);
add(new THREE.BoxGeometry(1.5, 0.12, 1.5), deck, 0, 4.25, 0);
section(0.2, 1, 5.2, 6.9);
add(new THREE.BoxGeometry(0.45, 0.14, 0.45), deck, 0, 9.55, 0);
add(new THREE.CylinderGeometry(0.03, 0.07, 1.1, 16), iron, 0, 10.15, 0);
add(new THREE.SphereGeometry(0.09, 32, 16), beacon, 0, 10.75, 0);

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (!userMoved) {
    const a = Math.PI / 4 + t * Math.PI * 2 / 24;
    const r = Math.hypot(12, 12);
    camera.position.set(Math.cos(a) * r, 4.5, Math.sin(a) * r);
    camera.lookAt(0, 5, 0);
  }
  beacon.emissiveIntensity = 3 + 2 * Math.sin(t * Math.PI * 2 / 1.5);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
