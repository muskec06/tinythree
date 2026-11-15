import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3.5, 2.6, 4.5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dir = new THREE.DirectionalLight(0xffffff, 2);
dir.position.set(5, 10, 7);
dir.castShadow = true;
scene.add(dir);

const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
const metal = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
const neon = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2 });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x1a2340 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const table = new THREE.Group();
const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), wood);
top.position.set(0, 1, 0);
top.castShadow = true;
table.add(top);
for (const [x, z] of [[0.9, 0.4], [-0.9, 0.4], [0.9, -0.4], [-0.9, -0.4]]) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), wood);
  leg.position.set(x, 0.5, z);
  leg.castShadow = true;
  table.add(leg);
}
scene.add(table);

const lamp = new THREE.Group();
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.05, 32), metal);
base.position.set(0, 0.025, 0);
lamp.add(base);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16), metal);
pole.position.set(0, 0.275, 0);
lamp.add(pole);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 16), neon);
bulb.position.set(0, 0.56, 0);
lamp.add(bulb);
const bulbLight = new THREE.PointLight(0x00e5ff, 3, 4);
bulbLight.position.set(0, 0.56, 0);
lamp.add(bulbLight);
lamp.position.set(0.5, 1.05, 0);
lamp.traverse(o => { if (o.isMesh) o.castShadow = true; });
scene.add(lamp);

const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 16, 64), neon);
ring.position.set(-0.5, 1.5, 0);
scene.add(ring);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  ring.rotation.y = t * (Math.PI * 2 / 4);
  ring.position.y = 1.5 + Math.sin(t * Math.PI * 2 / 3) * 0.1;
  neon.emissiveIntensity = 2 + Math.sin(t * Math.PI) * 0.5;
  controls.update();
  renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
