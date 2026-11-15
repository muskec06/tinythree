import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd8e3);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(26, 15, 26);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(2, 6, -2);

scene.add(new THREE.HemisphereLight(0xffffff, 0x7a7a6a, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(10, 20, 8);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 });
scene.add(sun);

const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b5ac, roughness: 0.9 });
const steel = new THREE.MeshStandardMaterial({ color: 0xf2b705, metalness: 0.5, roughness: 0.4 });
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x8a8170 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

function level(y) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) g.add(box(0.4, 3, 0.4, concrete, -6 + i * 3, 1.5, -4 + j * 4));
  g.add(box(12.8, 0.3, 8.8, concrete, 0, 3.15, 0));
  g.position.y = y;
  scene.add(g);
  return g;
}
level(0);
const l2 = level(3.3);
const l3 = level(6.6);

const crane = new THREE.Group();
crane.position.set(9, 0, -6);
crane.add(box(0.8, 16, 0.8, steel, 0, 8, 0));
const jib = new THREE.Group();
jib.position.y = 16;
jib.add(box(14, 0.6, 0.6, steel, 3, 0, 0));
jib.add(box(1.6, 1.2, 1, new THREE.MeshStandardMaterial({ color: 0x555555 }), -4, -0.4, 0));
const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
rope.position.set(8, -3, 0);
jib.add(rope);
crane.add(jib);
scene.add(crane);

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const grow = (t, start, dur) => Math.max(0.001, ease(THREE.MathUtils.clamp((t - start) / dur, 0, 1)));
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  l2.scale.setScalar(grow(t, 1.5, 1));
  l3.scale.setScalar(grow(t, 4, 1));
  jib.rotation.y = THREE.MathUtils.degToRad(40) * Math.sin(t * Math.PI * 2 / 10);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
