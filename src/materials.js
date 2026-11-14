import * as THREE from 'three';

// Default PBR palette matching Saltline's industrial port aesthetic
export const MATERIAL_PRESETS = {
  armor_white:     { color: 0xd8dad3, roughness: 0.36, metalness: 0.18 },
  gunmetal:        { color: 0x2d3238, roughness: 0.42, metalness: 0.78 },
  steel_galv:      { color: 0x8d959c, roughness: 0.38, metalness: 0.82 },
  steel_bare:      { color: 0xb2b8be, roughness: 0.28, metalness: 0.90 },
  aluminium:       { color: 0xc8cdd2, roughness: 0.32, metalness: 0.86 },
  steel_dark:      { color: 0x24282e, roughness: 0.48, metalness: 0.76 },
  steel_worn:      { color: 0x555c63, roughness: 0.55, metalness: 0.68 },
  steel_rust:      { color: 0x6b3e28, roughness: 0.78, metalness: 0.35 },
  diamond_plate:   { color: 0x586068, roughness: 0.42, metalness: 0.78 },
  corrugated:      { color: 0x7a8288, roughness: 0.48, metalness: 0.62 },
  corrugated_roof: { color: 0x697178, roughness: 0.52, metalness: 0.58 },
  paint_red:       { color: 0xa63329, roughness: 0.52, metalness: 0.15 },
  paint_blue:      { color: 0x2c4e73, roughness: 0.50, metalness: 0.15 },
  paint_green:     { color: 0x355e43, roughness: 0.54, metalness: 0.14 },
  paint_yellow:    { color: 0xd69a29, roughness: 0.48, metalness: 0.16 },
  paint_orange:    { color: 0xd96126, roughness: 0.46, metalness: 0.16 },
  paint_white:     { color: 0xd6d7d2, roughness: 0.50, metalness: 0.10 },
  paint_grey:      { color: 0x5d656d, roughness: 0.52, metalness: 0.22 },
  paint_teal:      { color: 0x2f6a6c, roughness: 0.50, metalness: 0.15 },
  hull_paint:      { color: 0x25384d, roughness: 0.56, metalness: 0.22 },
  hull_red:        { color: 0x7d2922, roughness: 0.62, metalness: 0.14 },
  concrete:        { color: 0x757774, roughness: 0.88, metalness: 0.02 },
  concrete_painted:{ color: 0x626668, roughness: 0.80, metalness: 0.04 },
  concrete_dirty:  { color: 0x585752, roughness: 0.90, metalness: 0.02 },
  floor_epoxy:     { color: 0x4b5358, roughness: 0.45, metalness: 0.08 },
  wood_pallet:     { color: 0x8a6b47, roughness: 0.85, metalness: 0.02 },
  wood_dark:       { color: 0x4d3a27, roughness: 0.84, metalness: 0.02 },
  cardboard:       { color: 0x997950, roughness: 0.88, metalness: 0.0 },
  tarp:            { color: 0x3a4636, roughness: 0.82, metalness: 0.04 },
  rope:            { color: 0x8f7c54, roughness: 0.90, metalness: 0.0 },
  rubber:          { color: 0x1e2023, roughness: 0.82, metalness: 0.05 },
  tire:            { color: 0x181a1c, roughness: 0.85, metalness: 0.04 },
  plastic_grey:    { color: 0x6e767e, roughness: 0.45, metalness: 0.05 },
  plastic_red:     { color: 0xc93b28, roughness: 0.40, metalness: 0.05 },
  plastic_blue:    { color: 0x24568a, roughness: 0.42, metalness: 0.05 },
  polymer_black:   { color: 0x1f2227, roughness: 0.58, metalness: 0.06 },
  polymer_tan:     { color: 0x6e6049, roughness: 0.58, metalness: 0.05 },
  brass:           { color: 0xb8933e, roughness: 0.28, metalness: 0.88 },
  glove_fabric:    { color: 0x2c342b, roughness: 0.88, metalness: 0.02 },
  glass:           { color: 0x8ba8b5, roughness: 0.10, metalness: 0.15, transparent: true, opacity: 0.42 },
  glass_dirty:     { color: 0x6e858c, roughness: 0.28, metalness: 0.12, transparent: true, opacity: 0.55 },
  hazard_stripes:  { color: 0xd99b26, roughness: 0.50, metalness: 0.15, pattern: 'hazard' },
  chainlink:       { color: 0x7b838a, roughness: 0.45, metalness: 0.72, pattern: 'chainlink', transparent: true, alphaTest: 0.4 },
};

// 把 Saltline 的道具材质名映射到 ./materials 的 GLSL registry 名
const YARDKIT_TO_GLSL = {
  armor_white: 'armor',
  gunmetal: 'gunmetal',
  steel_galv: 'galv',
  steel_bare: 'brushed',
  aluminium: 'brushed',
  steel_dark: 'metal',
  steel_worn: 'metal',
  steel_rust: 'rust',
  diamond_plate: 'diamond',
  corrugated: 'corrugated',
  corrugated_roof: 'corrugated',
  paint_red: 'paint',
  paint_blue: 'paint',
  paint_green: 'paint',
  paint_yellow: 'paint',
  paint_orange: 'paint',
  paint_white: 'paint',
  paint_grey: 'paint',
  paint_teal: 'paint',
  hull_paint: 'hull',
  hull_red: 'hull',
  concrete: 'concrete',
  concrete_painted: 'concrete',
  concrete_dirty: 'concrete',
  floor_epoxy: 'epoxy',
  wood_pallet: 'wood',
  wood_dark: 'wood',
  cardboard: 'cardboard',
  tarp: 'tarp',
  rope: 'rope',
  rubber: 'tire',
  tire: 'tire',
  plastic_grey: 'plastic',
  plastic_red: 'plastic',
  plastic_blue: 'plastic',
  polymer_black: 'polymer',
  polymer_tan: 'polymer',
  brass: 'brushed',
  glove_fabric: 'fabric',
  glass: 'glass',
  glass_dirty: 'glass',
  hazard_stripes: 'hazard',
  chainlink: 'chainlink',
};

function makePatternTexture(type) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (type === 'hazard') {
    ctx.fillStyle = '#d99b26';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1d1e20';
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 144, 128);
      ctx.lineTo(i + 128, 128);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === 'chainlink') {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#aab4bd';
    ctx.lineWidth = 4;
    for (let i = -128; i < 256; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterialStore({ createMaterial = null, averages = null, surfaceMap = null } = {}) {
  const cache = new Map();
  const textures = new Map();

  function getPattern(kind) {
    if (!textures.has(kind)) textures.set(kind, makePatternTexture(kind));
    return textures.get(kind);
  }

  function get(name, opts = {}) {
    const side = opts.doubleSide ? THREE.DoubleSide : opts.side;
    const key = `${name}|${!!opts.vertexColors}|${side ?? ''}|${opts.color ?? ''}`;
    if (cache.has(key)) return cache.get(key);

    const preset = MATERIAL_PRESETS[name] || { color: 0x808488, roughness: 0.6, metalness: 0.2 };
    const baseColor = opts.color !== undefined ? opts.color : preset.color;

    // 可选：接上 ./materials 的 GLSL 材质
    const glslName = (surfaceMap && surfaceMap[name]) || YARDKIT_TO_GLSL[name];
    if (createMaterial && glslName && !preset.transparent && opts.color === undefined) {
      const m = createMaterial(glslName, {
        tint: baseColor,
        avg: averages ? averages[glslName] : undefined,
      });
      if (opts.vertexColors) m.vertexColors = true;
      if (side !== undefined) m.side = side;
      cache.set(key, m);
      return m;
    }

    const params = {
      color: baseColor,
      roughness: preset.roughness,
      metalness: preset.metalness,
      vertexColors: !!opts.vertexColors,
    };
    if (preset.transparent) {
      params.transparent = true;
      params.opacity = preset.opacity ?? 0.5;
      params.depthWrite = false;
    }
    if (preset.alphaTest) params.alphaTest = preset.alphaTest;
    if (preset.pattern) {
      const tex = getPattern(preset.pattern);
      if (tex) {
        params.map = tex;
        if (preset.pattern === 'hazard' && opts.color === undefined) params.color = 0xffffff;
      }
    }
    if (side !== undefined) params.side = side;
    else if (preset.pattern === 'chainlink') params.side = THREE.DoubleSide;

    const mat = new THREE.MeshStandardMaterial(params);
    mat.name = name;
    cache.set(key, mat);
    return mat;
  }

  function emissive(hex = 0xffffff, intensity = 2) {
    const key = `emissive|${hex}|${intensity}`;
    if (cache.has(key)) return cache.get(key);
    const c = new THREE.Color(hex).multiplyScalar(intensity);
    const mat = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    cache.set(key, mat);
    return mat;
  }

  function label(text, opts = {}) {
    const key = `label|${text}|${JSON.stringify(opts)}`;
    if (cache.has(key)) return cache.get(key);
    const aspect = Math.max(1.8, text.length * 0.62);
    let material;
    if (typeof document !== 'undefined') {
      const w = 256, h = Math.max(64, Math.round(w / aspect));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      if (opts.bg) {
        ctx.fillStyle = opts.bg;
        ctx.fillRect(0, 0, w, h);
      }
      const ink = { black: '#16181a', yellow: '#e6b835', red: '#c83424', white: '#e8e4d8' };
      ctx.fillStyle = ink[opts.color] || '#e8e4d8';
      ctx.font = `bold ${Math.round(h * 0.66)}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.7,
        metalness: 0.05,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
    } else {
      material = get(opts.color === 'black' ? 'polymer_black' : 'paint_white');
    }
    const res = { material, aspect };
    cache.set(key, res);
    return res;
  }

  function decal(kind) {
    const key = `decal|${kind}`;
    if (cache.has(key)) return cache.get(key);
    let aspect = 1;
    let material;
    if (typeof document !== 'undefined') {
      const w = kind === 'caution_stripes' ? 256 : kind === 'csc_plate' ? 192 : 128;
      const h = kind === 'caution_stripes' ? 64 : 128;
      aspect = w / h;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      if (kind === 'rust_run' || kind === 'grime_streak' || kind === 'leak_stain' || kind === 'scorch') {
        const g = ctx.createRadialGradient(w / 2, h * 0.35, 4, w / 2, h * 0.5, w * 0.48);
        const col = kind === 'rust_run' ? '92,42,18' : kind === 'leak_stain' ? '38,40,28' : '24,22,20';
        g.addColorStop(0, `rgba(${col},0.65)`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else if (kind === 'caution_stripes') {
        ctx.fillStyle = '#d99b26';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#191a1c';
        for (let i = -h; i < w + h; i += 32) {
          ctx.beginPath();
          ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 16 - h, h); ctx.lineTo(i - h, h);
          ctx.closePath(); ctx.fill();
        }
      } else if (kind === 'csc_plate') {
        ctx.fillStyle = '#c5cbd0';
        ctx.fillRect(4, 16, w - 8, h - 32);
        ctx.strokeStyle = '#202428';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 20, w - 16, h - 40);
        ctx.fillStyle = '#181a1c';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('CSC SAFETY', 18, 52);
        ctx.font = '14px monospace';
        ctx.fillText('APPROVAL 4291', 18, 80);
      } else if (kind === 'no_entry') {
        ctx.fillStyle = '#b92c22';
        ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8e4d8';
        ctx.fillRect(22, 52, 84, 24);
      } else if (kind === 'arrow') {
        ctx.fillStyle = '#16181a';
        ctx.beginPath();
        ctx.moveTo(64, 12); ctx.lineTo(110, 62); ctx.lineTo(80, 62);
        ctx.lineTo(80, 114); ctx.lineTo(48, 114); ctx.lineTo(48, 62); ctx.lineTo(18, 62);
        ctx.closePath(); ctx.fill();
      } else if (kind.startsWith('logo_') || kind === 'berth4' || kind === 'numbers_0_9') {
        aspect = 2.2;
        ctx.fillStyle = kind === 'logo_b' ? '#d96126' : kind === 'logo_c' ? '#2c5a8a' : '#d6d7d2';
        ctx.fillRect(8, 20, 112, 88);
        ctx.fillStyle = '#15181c';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        const txt = kind === 'berth4' ? 'BERTH 4' : kind === 'numbers_0_9' ? '012345' : 'YARDKIT';
        ctx.fillText(txt, 64, 72);
      } else {
        ctx.fillStyle = kind === 'hazard_flammable' ? '#c83424' : '#e6a824';
        ctx.beginPath();
        ctx.moveTo(64, 8); ctx.lineTo(120, 114); ctx.lineTo(8, 114);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#151618';
        ctx.stroke();
        ctx.fillStyle = '#151618';
        ctx.font = 'bold 52px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(kind === 'hazard_flammable' ? '!' : '⚡', 64, 96);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.65,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
    } else {
      material = get('paint_yellow');
    }
    const res = { material, aspect };
    cache.set(key, res);
    return res;
  }

  return { get, emissive, label, decal };
}

export const defaultMaterials = createMaterialStore();
