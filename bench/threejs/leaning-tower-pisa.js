import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9d3f5);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(6.5, 3.4, 6.5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.9, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a6a, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(8, 12, 5);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sun);

const marble = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.6 });
const shade = new THREE.MeshStandardMaterial({ color: 0xd9d0bd, roughness: 0.8 });
const roof = new THREE.MeshStandardMaterial({ color: 0xc9bfae, roughness: 0.7 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x79a85a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function cyl(r, h, mat, y, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
  m.position.y = y;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function colonnade(n, radius, r, h, y, parent) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    cyl(r, h, marble, y, parent).position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
  }
}
const tower = new THREE.Group();
tower.rotation.z = THREE.MathUtils.degToRad(-3.97);
tower.scale.set(0.75, 1, 0.75);
scene.add(tower);
cyl(1.08, 1.1, marble, 0.55, tower);
colonnade(15, 1.1, 0.04, 1, 0.55, tower);
for (let i = 0; i < 6; i++) {
  const y = 1.1 + i * 0.66;
  cyl(0.92, 0.66, shade, y + 0.33, tower);
  colonnade(24, 1.02, 0.035, 0.6, y + 0.3, tower);
  cyl(1.1, 0.06, marble, y + 0.66, tower);
}
cyl(0.78, 0.62, marble, 5.37, tower);
colonnade(12, 0.82, 0.03, 0.55, 5.37, tower);
cyl(0.82, 0.08, roof, 5.72, tower);

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
renderer.setAnimationLoop(() => {
  if (!userMoved) {
    const a = Math.PI / 4 + clock.getElapsedTime() * Math.PI * 2 / 24;
    const r = Math.hypot(6.5, 6.5);
    camera.position.set(Math.cos(a) * r, 3.4, Math.sin(a) * r);
    camera.lookAt(0, 2.9, 0);
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
