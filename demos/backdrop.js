// 港区背板：boat / crane / ship / skyline / lamps / gulls 一次装配。
import * as THREE from 'three';
import { createBackdrop } from '../src/backdrop.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3a48);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 4000);
scene.add(new THREE.HemisphereLight(0xb9cde0, 0x2a2620, 1.0));
const sun = new THREE.DirectionalLight(0xffd9b0, 2.4);
sun.position.set(-60, 55, 90);
scene.add(sun);

const bd = createBackdrop({});
scene.add(bd.root);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x233244, roughness: 0.9 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -1.7;
scene.add(sea);

const CAMS = {
  crane: [[0, 1.7, 27], [33, 13, 0]],
  ship: [[24, 1.7, -2], [38, 9, -24]],
  boat: [[19.5, 1.7, 11.5], [24, 0.9, 15]],
  wide: [[-40, 26, 70], [16, 14, -30]],
};
const [pos, target] = CAMS[q.get('cam') || 'wide'];
camera.position.set(...pos);
camera.lookAt(...target);

document.getElementById('stats').textContent =
  `${bd.stats.drawCalls} draw calls · ${(bd.stats.tris / 1000).toFixed(0)}k tris · ${bd.colliders.length} colliders`;

const clock = new THREE.Clock();
let t = 0;
function tick() {
  const dt = clock.getDelta();
  t += dt;
  bd.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
window.__backdrop = { ready: true, stats: bd.stats, colliders: bd.colliders.length };
