// 月球天空：纯黑 + 星星 + 一颗地球。真空，没有雾、没有大气渐变。
import * as THREE from 'three';
import { createRng } from '../../src/geo.js';

export function createMoonSky({ stars = 1800, earth = true, seed = 7 } = {}) {
  const group = new THREE.Group();
  group.name = 'moon-sky';

  const rng = createRng(seed);
  const pos = new Float32Array(stars * 3);
  const col = new Float32Array(stars * 3);
  for (let i = 0; i < stars; i++) {
    // 均匀撒在半径 900 的球面上（只在上半球多一点，地面以下看不见也没关系）
    const u = rng() * 2 - 1;
    const t = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(t) * r * 900;
    pos[i * 3 + 1] = u * 900;
    pos[i * 3 + 2] = Math.sin(t) * r * 900;
    const w = 0.55 + rng() * 0.45;
    col[i * 3] = w; col[i * 3 + 1] = w; col[i * 3 + 2] = w * (0.96 + rng() * 0.08);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starsMesh = new THREE.Points(g, new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false,
  }));
  starsMesh.frustumCulled = false;
  group.add(starsMesh);

  let earthMesh = null;
  if (earth && typeof document !== 'undefined') {
    earthMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 32), new THREE.MeshBasicMaterial({
      map: earthTexture(), fog: false,
    }));
    earthMesh.position.set(-420, 260, -700);
    group.add(earthMesh);
  }

  return { group, stars: starsMesh, earth: earthMesh };
}

// canvas 现画的地球（蓝海 + 白云 + 一点点陆地），零图片
function earthTexture() {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const m = c.getContext('2d');
  const sea = m.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, '#1c4f8a');
  sea.addColorStop(0.5, '#2f79b8');
  sea.addColorStop(1, '#1c4f8a');
  m.fillStyle = sea;
  m.fillRect(0, 0, w, h);
  // 陆地：几块低饱和的绿/褐，位置固定，保证每次一样
  const land = [[60, 96, 52, 30], [92, 150, 40, 46], [250, 70, 66, 34], [300, 130, 46, 40], [430, 100, 40, 30]];
  m.fillStyle = '#4c7a4a';
  for (const [x, y, rw, rh] of land) {
    m.beginPath();
    m.ellipse(x, y, rw, rh, 0.3, 0, Math.PI * 2);
    m.fill();
  }
  // 云：横向白色笔触
  m.globalAlpha = 0.5;
  m.strokeStyle = '#f2f6fa';
  for (let i = 0; i < 34; i++) {
    const x = (i * 53) % w;
    const y = 16 + ((i * 37) % 220);
    const len = 26 + (i % 5) * 16;
    m.lineWidth = 5 + (i % 4) * 3;
    m.beginPath();
    m.moveTo(x, y);
    m.bezierCurveTo(x + len * 0.35, y - 7, x + len * 0.7, y + 7, x + len, y);
    m.stroke();
  }
  m.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 真空里没有天光，但金属不能真的全黑：给一张「上黑下灰」的极简环境。
export function createMoonEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 24, 16);
  const canvas = document.createElement('canvas');
  canvas.width = 2; canvas.height = 64;
  const m = canvas.getContext('2d');
  const g = m.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#05070b');
  g.addColorStop(0.55, '#0b0f14');
  g.addColorStop(0.75, '#3a3a38');
  g.addColorStop(1, '#5b5a55');
  m.fillStyle = g;
  m.fillRect(0, 0, 2, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  geo.dispose(); mat.dispose(); tex.dispose();
  return rt.texture;
}
