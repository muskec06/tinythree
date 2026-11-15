import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1f);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 2, 7);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const light = new THREE.PointLight(0xffffff, 30, 0);
light.position.set(3, 4, 5);
scene.add(light);

const nucleusMat = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff4d6d, emissiveIntensity: 0.6, roughness: 0.3 });
const shellMat = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, emissive: 0x4cc9f0, emissiveIntensity: 0.4, transparent: true, opacity: 0.35 });
const electronMat = new THREE.MeshStandardMaterial({ color: 0xf1fa8c, emissive: 0xf1fa8c, emissiveIntensity: 2 });

const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 16), nucleusMat);
scene.add(core);

const orbits = [];
for (const [radius, tiltY, period] of [[2, 0, 2], [2.5, 60, 3], [3, -60, -4]]) {
  const g = new THREE.Group();
  g.rotation.set(THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(tiltY), 0);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.015, 16, 64), shellMat));
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), electronMat);
  e.position.x = radius;
  g.add(e);
  scene.add(g);
  orbits.push({ g, period });
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (const { g, period } of orbits) g.rotation.z = t * Math.PI * 2 / period;
  core.scale.setScalar(1 + 0.05 * Math.sin(t * Math.PI * 2));
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
