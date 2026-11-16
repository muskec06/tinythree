import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1430);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(13, 5, 14);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 6, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
scene.add(new THREE.HemisphereLight(0x4a6cff, 0x0b1430, 0.4));
const moon = new THREE.DirectionalLight(0x9fb6ff, 1.5);
moon.position.set(-6, 10, 12);
moon.castShadow = true;
Object.assign(moon.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
scene.add(moon);

const steel = new THREE.MeshStandardMaterial({ color: 0xdfe6f0, metalness: 0.7, roughness: 0.3 });
const neon = new THREE.MeshStandardMaterial({ color: 0x36c6ff, emissive: 0x36c6ff, emissiveIntensity: 1.5 });
const podMat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, emissive: 0xe8f6ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x10264f, metalness: 0.4, roughness: 0.2 }));
water.rotation.x = -Math.PI / 2;
water.receiveShadow = true;
scene.add(water);

function mesh(geo, mat, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
// the wheel turns around its own Z axis
const wheel = new THREE.Group();
wheel.position.set(0, 7, -0.4);
scene.add(wheel);
mesh(new THREE.TorusGeometry(6, 0.08, 16, 64), neon, wheel);
mesh(new THREE.TorusGeometry(5.6, 0.05, 16, 64), steel, wheel);
mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 32), steel, wheel).rotation.x = Math.PI / 2;
for (let i = 0; i < 32; i++) {
  const a = (i / 32) * Math.PI * 2;
  const spoke = mesh(new THREE.CylinderGeometry(0.012, 0.012, 6, 8), steel, wheel);
  spoke.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0);
  spoke.rotation.z = a - Math.PI / 2;
  const pod = mesh(new THREE.CapsuleGeometry(0.26, 0.4, 8, 16), podMat, wheel);
  pod.position.set(Math.cos(a) * 6.25, Math.sin(a) * 6.25, -0.4);
  pod.rotation.x = Math.PI / 2;
}
// A-frame support leaning toward the hub
for (const s of [-1, 1]) {
  const leg = mesh(new THREE.BoxGeometry(0.25, 8.4, 0.25), steel, scene);
  leg.position.set(1.5 * s, 3.5, -2.3);
  leg.rotation.set(THREE.MathUtils.degToRad(26), 0, THREE.MathUtils.degToRad(21 * s));
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  wheel.rotation.z = -t * Math.PI * 2 / 30;
  neon.emissiveIntensity = 1.5 + 0.6 * Math.sin(t * Math.PI);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
