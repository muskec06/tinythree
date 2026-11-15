import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9ff);
scene.fog = new THREE.Fog(0x9cc9ff, 25, 60);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(14, 8, 14);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6b3a, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(8, 15, 6);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
scene.add(sun);

const ground = new THREE.MeshStandardMaterial({ color: 0x6f8f4a, roughness: 1 });
const panelMat = new THREE.MeshStandardMaterial({ color: 0x2a4d8f, roughness: 0.3, metalness: 0.2 });
const frame = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.8, roughness: 0.35 });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), ground);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const row = new THREE.Group();
const panel = mesh(new THREE.BoxGeometry(2.6, 0.06, 1.6), panelMat, 0, 1.1, 0);
panel.rotation.x = THREE.MathUtils.degToRad(25);
row.add(panel);
row.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 32), frame, 0, 0.5, 0.4));
row.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 32), frame, 0, 0.7, -0.4));
for (let i = 0; i < 6; i++) {
  for (let j = 0; j < 4; j++) {
    const r = row.clone();
    r.position.set(-7.5 + i * 3, 0, -6 + j * 4);
    scene.add(r);
  }
}
scene.add(mesh(new THREE.BoxGeometry(1.2, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 }), 9, 0.8, 0));
scene.add(mesh(new THREE.BoxGeometry(0.05, 1.2, 24), frame, 11, 0.6, 0));

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (!userMoved) {
    const a = Math.PI / 4 + t * (Math.PI * 2 / 24);
    const r = Math.hypot(14, 14);
    camera.position.set(Math.cos(a) * r, 8, Math.sin(a) * r);
    camera.lookAt(0, 0, 0);
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
