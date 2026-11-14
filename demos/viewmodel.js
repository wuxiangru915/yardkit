// 第一人称武器挂点：复用 createPAC9/createPAC4 的几何 + 程序化手部。
import * as THREE from 'three';
import { createViewModel } from '../src/viewmodel.js';

const q = new URLSearchParams(location.search);
const which = q.get('w') || 'pac9';
const ads = q.get('ads') === '1';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3238);
scene.fog = new THREE.Fog(0x2b3238, 6, 22);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 60);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x4c545b, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.6;
scene.add(floor);

scene.add(new THREE.HemisphereLight(0xc3d6e4, 0x2b2720, 1.2));
const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
key.position.set(-1.4, 2.2, 1.6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fc7ff, 1.2);
rim.position.set(2.4, 1.2, -2.0);
scene.add(rim);

// 一点环境，让枪械的金属有反射
const env = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x3b4650);
scene.environment = env.fromScene(envScene, 0.04).texture;
env.dispose();

const vm = createViewModel(which, {});
const debug = q.get('debug') === '1';
camera.rotation.y = ads ? 0 : -0.05;
scene.add(camera);

// 游戏里的做法：viewmodel 用一台更窄 FOV 的相机单独渲染（否则枪托会顶到脸上）。
// ?debug=1 时改用侧上方机位，直接看手有没有真的抓在握把上。
const vmCamera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.01, 60);
if (debug) {
  camera.position.set(1.05, 0.42, 0.9);
  camera.lookAt(0.1, -0.12, -0.35);
  scene.add(vm.root);   // 脱离相机，才能从侧面看抓握
} else {
  vmCamera.position.copy(camera.position);
  vmCamera.rotation.copy(camera.rotation);
  vmCamera.add(vm.root);
  scene.add(vmCamera);
}

let t = 0;
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  vm.update(dt, { ads, trigger: 0 });
  renderer.render(scene, camera);
  if (!debug) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, vmCamera);
    renderer.autoClear = true;
  }
  requestAnimationFrame(tick);
}
tick();

document.getElementById('stats').textContent = `${which} · hands ${vm.hands.R.root.children.length}+${vm.hands.L.root.children.length} parts`;
window.__vm = { ready: true, bones: vm.hands.R.root.children.length };
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
