import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4c58d);
scene.fog = new THREE.Fog(0xf4c58d, 40, 110);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(26, 9, 30);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-6, 2, 8);

scene.add(new THREE.HemisphereLight(0xfff1d6, 0xb88a52, 0.7));
const sun = new THREE.DirectionalLight(0xffd9a0, 3);
sun.position.set(-20, 12, 14);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 180 });
scene.add(sun);

const sand = new THREE.MeshStandardMaterial({ color: 0xd9b680, roughness: 1, flatShading: true });
const stone = new THREE.MeshStandardMaterial({ color: 0xcfa56a, roughness: 0.9, flatShading: true });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), sand);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// a square pyramid is a 4-sided cone turned 45°; r = half the base diagonal
function pyramid(r, h, x, z, mat = stone, y = h / 2) {
  const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat);
  p.position.set(x, y, z);
  p.rotation.y = Math.PI / 4;
  p.castShadow = p.receiveShadow = true;
  scene.add(p);
}
pyramid(8.13, 7.3, 0, 0);
pyramid(7.6, 6.8, -11, 10);
pyramid(1.1, 0.98, -11, 10, new THREE.MeshStandardMaterial({ color: 0xefe3cf }), 6.31);
pyramid(3.64, 3.25, -19, 21);
for (let i = 0; i < 3; i++) pyramid(1.2, 1.05, 8, -4 + i * 3.4);
for (let i = 0; i < 3; i++) pyramid(0.95, 0.85, -19 + i * 2.6, 26);

const clock = new THREE.Clock();
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
renderer.setAnimationLoop(() => {
  if (!userMoved) {
    const dx = 32, dz = 22, r = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx) + clock.getElapsedTime() * Math.PI * 2 / 40;
    camera.position.set(-6 + Math.cos(a) * r, 9, 8 + Math.sin(a) * r);
    camera.lookAt(-6, 2, 8);
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
