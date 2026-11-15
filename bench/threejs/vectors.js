import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(3.6, 2.8, 4.2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(1, 0.6, 0.4);

scene.add(new THREE.AmbientLight(0xffffff, 1));
scene.add(new THREE.GridHelper(20, 20, 0x335577, 0x223344));
scene.add(new THREE.AxesHelper(2));

function arrow(dir, origin, color) {
  const len = dir.length();
  scene.add(new THREE.ArrowHelper(dir.clone().normalize(), origin, len, color, len * 0.2, len * 0.1));
}
const a = new THREE.Vector3(2, 0, 0);
const b = new THREE.Vector3(0, 1.06, 1.06);
arrow(a, new THREE.Vector3(), 0xff5555);
arrow(b, a, 0x55ff88);
arrow(a.clone().add(b), new THREE.Vector3(), 0x5599ff);
const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
tip.position.copy(a.clone().add(b));
scene.add(tip);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  tip.scale.setScalar(1 + 0.4 * Math.sin(clock.getElapsedTime() * Math.PI * 2));
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
