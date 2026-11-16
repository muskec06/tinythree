import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6c7a1);
scene.fog = new THREE.Fog(0xf6c7a1, 20, 70);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(11, 4.5, 11);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xffe9d6, 0x50643a, 0.7));
const sun = new THREE.DirectionalLight(0xffc28a, 3);
sun.position.set(12, 9, -10);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
scene.add(sun);

const sarsen = new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 1, flatShading: true });
const blue = new THREE.MeshStandardMaterial({ color: 0x6f7782, roughness: 1, flatShading: true });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x7d9a52 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function block(w, h, d, mat, x, y, z, ry = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ring(n, r, make) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    make(Math.cos(a) * r, Math.sin(a) * r, -a);
  }
}
ring(30, 5, (x, z, a) => block(0.75, 2.1, 0.45, sarsen, x, 1.05, z, a));
ring(30, 5, (x, z, a) => block(1.1, 0.3, 0.45, sarsen, x, 2.25, z, a + Math.PI / 2));
ring(24, 3.9, (x, z, a) => block(0.35, 1.1, 0.3, blue, x, 0.55, z, a));
function trilithon(x, z, deg) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = THREE.MathUtils.degToRad(deg);
  block(0.75, 3, 0.55, sarsen, -0.45, 1.5, 0, 0, g);
  block(0.75, 3, 0.55, sarsen, 0.45, 1.5, 0, 0, g);
  block(1.8, 0.35, 0.6, sarsen, 0, 3.15, 0, 0, g);
  scene.add(g);
}
trilithon(0, -2.6, 0);
trilithon(-2, -1.5, 50);
trilithon(2, -1.5, -50);
trilithon(-2.4, 0.8, 95);
trilithon(2.4, 0.8, -95);
block(1.6, 0.25, 0.5, blue, 0, 0.12, -0.6);

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
renderer.setAnimationLoop(() => {
  if (!userMoved) {
    const a = Math.PI / 4 + clock.getElapsedTime() * Math.PI * 2 / 32;
    const r = Math.hypot(11, 11);
    camera.position.set(Math.cos(a) * r, 4.5, Math.sin(a) * r);
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
