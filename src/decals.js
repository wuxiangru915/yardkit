// 程序化贴花 / 文字标识（零图片，全部 canvas 现画）。
// 抽自 Saltline 的 decal 图集（inline-2.js:19090 起，共 18 种）+ 它的 label 文字标识。
// 说明：原版的文字用了一套自带「桥梁/磨损」的 stencil 排版器（依赖字体文件），这里用
// canvas fillText 做了兼容实现：名称、宽高比、用途与游戏一致，笔画细节不如原版。
import * as THREE from 'three';

// 与游戏里出现的 18 种贴花一一对应
export const DECAL_KINDS = [
  'hazard_flammable', 'hazard_voltage', 'hazard_general', 'arrow', 'no_entry',
  'logo_a', 'logo_b', 'logo_c', 'logo_d', 'berth4', 'csc_plate', 'numbers_0_9',
  'caution_stripes', 'oil_stain', 'leak_stain', 'rust_run', 'grime_streak', 'scorch',
];

const INK = {
  black: '#15181c', white: '#e8e4d8', red: '#b92c22', yellow: '#e0a824',
  orange: '#d96126', blue: '#2c5a8a', green: '#2f6a48', grey: '#9aa0a6',
};

const sizeOf = (kind) => {
  switch (kind) {
    case 'caution_stripes': return [256, 64];
    case 'arrow': return [384, 192];
    case 'csc_plate': return [288, 200];
    case 'berth4': return [640, 224];
    case 'logo_a': case 'logo_b': case 'logo_c': case 'logo_d': return [640, 192];
    case 'numbers_0_9': return [512, 160];
    case 'grime_streak': case 'rust_run': case 'leak_stain': case 'oil_stain': return [256, 256];
    default: return [256, 256];
  }
};

// 在 canvas 上画出某种贴花（返回 canvas；Node 环境下返回 null）
export function decalCanvas(kind, scale = 1) {
  if (typeof document === 'undefined') return null;
  const [W, H] = sizeOf(kind).map((v) => Math.round(v * scale));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const m = c.getContext('2d');
  m.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;

  const warningTriangle = (fill) => {
    m.fillStyle = fill;
    m.beginPath();
    m.moveTo(cx, H * 0.12);
    m.lineTo(W * 0.9, H * 0.84);
    m.lineTo(W * 0.1, H * 0.84);
    m.closePath();
    m.fill();
    m.lineWidth = W * 0.045;
    m.strokeStyle = INK.black;
    m.stroke();
  };

  switch (kind) {
    case 'hazard_flammable': {
      m.save();
      m.translate(cx, cy);
      m.rotate(Math.PI / 4);
      m.fillStyle = INK.red;
      m.fillRect(-W * 0.33, -H * 0.33, W * 0.66, H * 0.66);
      m.strokeStyle = INK.white;
      m.lineWidth = W * 0.02;
      m.strokeRect(-W * 0.29, -H * 0.29, W * 0.58, H * 0.58);
      m.restore();
      m.fillStyle = INK.white;
      m.font = `bold ${Math.round(H * 0.3)}px sans-serif`;
      m.textAlign = 'center';
      m.textBaseline = 'middle';
      m.fillText('FLAMMABLE', cx, cy - H * 0.03);
      m.font = `${Math.round(H * 0.1)}px sans-serif`;
      m.fillText('1202', cx, cy + H * 0.2);
      break;
    }
    case 'hazard_voltage': {
      warningTriangle(INK.yellow);
      m.fillStyle = INK.black;
      m.save();
      m.translate(cx, H * 0.56);
      m.beginPath();
      [[12, -58], [-24, 4], [-3, 4], [-16, 50], [26, -14], [5, -14], [22, -58]]
        .forEach(([x, y], i) => (i ? m.lineTo(x * H / 256, y * H / 256) : m.moveTo(x * H / 256, y * H / 256)));
      m.closePath();
      m.fill();
      m.restore();
      break;
    }
    case 'hazard_general': {
      warningTriangle(INK.yellow);
      m.fillStyle = INK.black;
      m.fillRect(cx - 13 * H / 256, H * 0.34, 26 * H / 256, H * 0.2);
      m.beginPath();
      m.arc(cx, H * 0.62, 9 * H / 256, 0, Math.PI * 2);
      m.fill();
      break;
    }
    case 'arrow': {
      m.fillStyle = INK.white;
      m.beginPath();
      [[20, 68], [226, 68], [226, 22], [364, 96], [226, 170], [226, 124], [20, 124]]
        .forEach(([x, y], i) => (i ? m.lineTo(x * W / 384, y * H / 192) : m.moveTo(x * W / 384, y * H / 192)));
      m.closePath();
      m.fill();
      break;
    }
    case 'no_entry': {
      m.fillStyle = INK.white;
      m.beginPath(); m.arc(cx, cy, W * 0.44, 0, Math.PI * 2); m.fill();
      m.fillStyle = INK.red;
      m.beginPath(); m.arc(cx, cy, W * 0.4, 0, Math.PI * 2); m.fill();
      m.fillStyle = INK.white;
      m.fillRect(W * 0.2, H * 0.45, W * 0.6, H * 0.1);
      break;
    }
    case 'csc_plate': {
      m.fillStyle = '#c5cbd0';
      m.fillRect(W * 0.03, H * 0.1, W * 0.94, H * 0.8);
      m.strokeStyle = INK.black;
      m.lineWidth = W * 0.012;
      m.strokeRect(W * 0.06, H * 0.14, W * 0.88, H * 0.72);
      m.fillStyle = INK.black;
      m.font = `bold ${Math.round(H * 0.13)}px monospace`;
      m.fillText('CSC SAFETY', W * 0.1, H * 0.42);
      m.font = `${Math.round(H * 0.09)}px monospace`;
      m.fillText('APPROVAL 4291', W * 0.1, H * 0.62);
      m.fillText('MAX GROSS 32500 KG', W * 0.1, H * 0.76);
      break;
    }
    case 'berth4':
    case 'logo_a': case 'logo_b': case 'logo_c': case 'logo_d': {
      const bg = { logo_b: INK.orange, logo_c: INK.blue, logo_d: INK.grey, logo_a: '#d6d7d2', berth4: '#d6d7d2' }[kind];
      m.fillStyle = bg;
      m.fillRect(W * 0.02, H * 0.06, W * 0.96, H * 0.88);
      m.fillStyle = INK.black;
      m.font = `bold ${Math.round(H * 0.42)}px sans-serif`;
      m.textAlign = 'center';
      m.textBaseline = 'middle';
      m.fillText(kind === 'berth4' ? 'BERTH 4' : 'YARDKIT', cx, cy);
      m.font = `bold ${Math.round(H * 0.1)}px monospace`;
      m.fillText(kind.toUpperCase(), cx, H * 0.84);
      break;
    }
    case 'numbers_0_9': {
      m.fillStyle = '#d6d7d2';
      m.fillRect(0, 0, W, H);
      m.fillStyle = INK.black;
      m.font = `bold ${Math.round(H * 0.62)}px monospace`;
      m.textAlign = 'center';
      m.textBaseline = 'middle';
      m.fillText('0 1 2 3 4 5 6 7 8 9', cx, cy);
      break;
    }
    case 'caution_stripes': {
      m.fillStyle = INK.yellow;
      m.fillRect(0, 0, W, H);
      m.fillStyle = INK.black;
      for (let i = -H; i < W + H; i += H * 0.5) {
        m.beginPath();
        m.moveTo(i, 0);
        m.lineTo(i + H * 0.25, 0);
        m.lineTo(i + H * 0.25 - H, H);
        m.lineTo(i - H, H);
        m.closePath();
        m.fill();
      }
      break;
    }
    case 'oil_stain': case 'leak_stain': case 'rust_run': case 'grime_streak': case 'scorch': {
      const col = kind === 'rust_run' ? '92,42,18' : kind === 'leak_stain' ? '38,40,28'
        : kind === 'scorch' ? '24,22,20' : '28,26,24';
      const g = m.createRadialGradient(cx, cy * 0.8, W * 0.02, cx, cy, W * 0.5);
      g.addColorStop(0, `rgba(${col},0.72)`);
      g.addColorStop(0.55, `rgba(${col},0.34)`);
      g.addColorStop(1, `rgba(${col},0)`);
      m.fillStyle = g;
      m.fillRect(0, 0, W, H);
      // 竖向流痕
      for (let i = 0; i < 7; i++) {
        const x = cx + (Math.random() - 0.5) * W * 0.5;
        const h = H * (0.2 + Math.random() * 0.5);
        m.fillStyle = `rgba(${col},${0.06 + Math.random() * 0.12})`;
        m.fillRect(x, cy - h * 0.2, 2 + Math.random() * 5, h);
      }
      break;
    }
    default:
      warningTriangle(INK.yellow);
      break;
  }
  return c;
}

const cache = new Map();

// -> { material, aspect, texture }
export function createDecal(kind, { scale = 1, roughness = 0.7, metalness = 0, doubleSide = false } = {}) {
  const key = `${kind}|${scale}|${roughness}|${metalness}|${doubleSide}`;
  if (cache.has(key)) return cache.get(key);
  let material;
  if (typeof document === 'undefined') {
    material = new THREE.MeshStandardMaterial({ color: 0xb9a04a, roughness, metalness });
  } else {
    const canvas = decalCanvas(kind, scale);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    material = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      roughness, metalness,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    material.name = `decal:${kind}`;
  }
  const res = { material, aspect: (sizeOf(kind)[0] / sizeOf(kind)[1]), texture: material.map || null };
  cache.set(key, res);
  return res;
}

// 文字/编号标识（原版是 stencil 排版器 + 磨损，这里用 canvas 文字）
export function createLabel(text, { color = 'white', bg = null, font = 'sans', height = 96, scale = 1 } = {}) {
  const key = `label|${text}|${color}|${bg}|${font}|${height}|${scale}`;
  if (cache.has(key)) return cache.get(key);
  const aspect = Math.max(1.6, text.length * (font === 'mono' ? 0.66 : 0.6));
  let material;
  if (typeof document === 'undefined') {
    material = new THREE.MeshStandardMaterial({ color: 0xd6d7d2, roughness: 0.75 });
  } else {
    const h = Math.round(height * scale);
    const w = Math.round(h * aspect);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const m = c.getContext('2d');
    if (bg) { m.fillStyle = typeof bg === 'string' ? bg : INK[bg] || INK.grey; m.fillRect(0, 0, w, h); }
    m.fillStyle = INK[color] || INK.white;
    m.font = `bold ${Math.round(h * 0.62)}px ${font === 'mono' ? 'monospace' : font === 'stencil' ? 'Impact, sans-serif' : 'sans-serif'}`;
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    m.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.75,
    });
    material.name = `label:${text}`;
  }
  const res = { material, aspect };
  cache.set(key, res);
  return res;
}

export function disposeDecalCache() {
  for (const { material } of cache.values()) {
    if (material.map) material.map.dispose();
    material.dispose();
  }
  cache.clear();
}
