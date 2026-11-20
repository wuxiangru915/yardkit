// 性能测量：固定工作负载（一块近距离铺满画面的平面）下，逐帧测 live / baked / flat
// 三种材质模式的 frame time，并在 4 个 pixelRatio 缩放下取 p50 / p95。
//
// 为什么这么测：
//   · 单块大平面 = 纯填充率负载，不受 draw call / 三角数干扰，直接量到 surf() 的逐像素成本。
//   · 每帧 render() 后读 1 个像素：gl.finish() 在 ANGLE/WebGL 里是"提交完就返回"（实测 0.1ms，
//     完全量不到光栅），readPixels 才会等命令流真跑完，才是真实的 frame time。
//   · 报 p50 / p95，不报平均：卡顿由尾部决定。平均值漂亮、p95 翻三倍很常见。
//   · 单次采样有 2.5s 上限（SwiftShader 下一帧可能 1s），跑不满 frames 就按实到的样本算，n 会显示出来。
//
// URL 参数（都有默认值，正常打开就行）：
//   ?w=1280&h=720&mats=paint,hazard,concrete,grass,glass&scales=1,0.85,0.7,0.6
//   &frames=120&warmup=30&maxdpr=2&caprun=2000&capwarmup=600&auto=1
import * as THREE from 'three';
import {
  createMaterial, bakeAverage, bakeSurfaces, clearBakedSurfaces, createPost
} from '../materials.js';

/* ---------------------------------------------------------------- 配置 */
const P = new URLSearchParams(location.search);
const intParam = (k, d) => {
  const v = P.get(k);
  if (v === null || v === '') return d;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : d;
};
const CFG = {
  W: intParam('w', 1280),
  H: intParam('h', 720),
  mats: (P.get('mats') || 'paint,hazard,concrete,grass,glass').split(',').map((s) => s.trim()).filter(Boolean),
  scales: (P.get('scales') || '1,0.85,0.7,0.6').split(',').map(Number).filter((n) => n > 0),
  frames: intParam('frames', 120),        // 目标采样帧数
  warmup: intParam('warmup', 30),         // 预热帧数（编译着色器 / 填满管线）
  maxDpr: Number(P.get('maxdpr') || 2),   // 4K 屏 + DPR2 会测很久，默认封顶 2
  capRun: intParam('caprun', 2500),       // 采样阶段时间上限 ms
  capWarmup: intParam('capwarmup', 1200), // 预热阶段时间上限 ms
  auto: P.get('auto') === '1',
  bakeSize: intParam('bakesize', 256),
  budget: 20                              // p95 判据 ms（见 docs/PERF.md）
};

const $ = (id) => document.getElementById(id);
const el = { env: $('env'), start: $('start'), stop: $('stop'), prog: $('prog'),
  err: $('error'), matrix: $('matrix'), post: $('post'), rec: $('rec'), raw: $('raw') };

// headless 验收用：window.__bench.ready 在跑完之后为 true。
window.__bench = { ready: false, running: false, results: null, error: null };

/* ---------------------------------------------------------------- 渲染器 */
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance'
});
const gl = renderer.getContext();
const baseDpr = Math.min(window.devicePixelRatio || 1, CFG.maxDpr);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2028);
scene.add(new THREE.HemisphereLight(0xbfd4e6, 0x30302c, 1.4));
const sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
sun.position.set(2, 3, 4);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(55, CFG.W / CFG.H, 0.1, 60);
camera.position.set(0, 0, 2.2);      // 近距离 → suv 的 fwidth 很小 → 实时 GLSL 的 slFade ≈ 1（全细节）
const geometry = new THREE.PlaneGeometry(12, 12);   // 铺满画面，1 draw call / 2 三角
const mesh = new THREE.Mesh(geometry, null);
scene.add(mesh);
renderer.setSize(CFG.W, CFG.H);
renderer.setPixelRatio(baseDpr);

/* ---------------------------------------------------------------- 环境信息 */
function gpuInfo() {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const out = {
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    version: gl.getParameter(gl.VERSION),
    webgl2: renderer.capabilities.isWebGL2,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy()
  };
  out.software = /swiftshader|llvmpipe|software|angle \(google, vulkan 1\.|microsoft basic/i.test(out.renderer);
  return out;
}

const ENV = {
  ua: navigator.userAgent,
  mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  dpr: window.devicePixelRatio || 1,
  baseDpr,
  css: { w: CFG.W, h: CFG.H },
  gl: gpuInfo(),
  workerNav: navigator.hardwareConcurrency || null
};

function envLine() {
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  return `<b>${ENV.gl.renderer}</b><br>` +
    `DPR <b>${ENV.dpr}</b> · 基准 pixelRatio <b>${baseDpr}</b> · ` +
    `drawingBuffer <b>${buf.x}×${buf.y}</b> · canvas ${CFG.W}×${CFG.H} CSS<br>` +
    `maxTextureSize <b>${ENV.gl.maxTextureSize}</b> · WebGL2 <b>${ENV.gl.webgl2}</b> · ` +
    `移动端 UA <b>${ENV.mobile ? '是' : '否'}</b> · CPU 线程 <b>${ENV.workerNav ?? '?'}</b>` +
    (ENV.gl.software ? `<br><span class="warn">软件渲染（SwiftShader / llvmpipe）：绝对毫秒数只代表 CPU 光栅，不代表任何 GPU。</span>` : '');
}
el.env.innerHTML = envLine();

/* ---------------------------------------------------------------- 测量原语 */
const tick = () => new Promise((r) => setTimeout(r, 0));

const px = new Uint8Array(4);
function frameTime() {
  const t0 = performance.now();
  renderer.render(scene, camera);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // 同步点：等光栅真的跑完
  return performance.now() - t0;
}

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

function setScale(scale) {
  renderer.setPixelRatio(baseDpr * scale);
  renderer.setSize(CFG.W, CFG.H);
  return renderer.getDrawingBufferSize(new THREE.Vector2());
}

// 一次采样：warmup 帧丢弃（至少 3 帧：编译 + 首次光栅），之后最多 frames 帧、最多 capRun 毫秒。
// 慢帧（> 150ms）每帧让出一次事件循环，否则一整段同步 GPU 工作会把渲染进程拖死。
async function sample(fn, { frames = CFG.frames, warmup = CFG.warmup } = {}) {
  const times = [];
  let firstMs = 0;
  const wEnd = performance.now() + CFG.capWarmup;
  for (let i = 0; i < warmup; i++) {
    const dt = fn();
    if (i === 0) firstMs = dt;
    if (i % 6 === 5 || dt > 150) { await tick(); if (STATE.aborted) break; }
    if (i >= 2 && performance.now() > wEnd) break;
  }
  renderer.info.reset();
  const rEnd = performance.now() + CFG.capRun;
  for (let i = 0; i < frames; i++) {
    const dt = fn();
    times.push(dt);
    if (i % 6 === 5 || dt > 150) { await tick(); if (STATE.aborted) break; }
    if (performance.now() > rEnd) break;
  }
  const info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  const s = [...times].sort((a, b) => a - b);
  return {
    n: s.length,
    firstMs: +firstMs.toFixed(2),
    p50: +percentile(s, 0.5).toFixed(2),
    p95: +percentile(s, 0.95).toFixed(2),
    min: s.length ? +s[0].toFixed(2) : NaN,
    max: s.length ? +s[s.length - 1].toFixed(2) : NaN,
    calls: info.calls, tris: info.tris
  };
}

const STATE = { aborted: false, running: false };

/* ---------------------------------------------------------------- 主流程 */
async function run() {
  STATE.aborted = false;
  STATE.running = true;
  window.__bench = { ready: false, running: true, results: null, error: null };
  el.start.disabled = true;
  el.stop.disabled = false;
  el.err.textContent = '';
  el.matrix.innerHTML = '';
  el.post.innerHTML = '';
  el.rec.innerHTML = '';
  el.raw.textContent = '—';

  const rows = [];
  const avgColors = {};
  const total = CFG.mats.length * 3 * CFG.scales.length;
  let done = 0;
  const progress = (label) => {
    el.prog.textContent = `${label} · ${done}/${total} 采样`;
  };

  const record = async (material, mode, scale, buf) => {
    const r = await sample(() => frameTime());
    rows.push({
      material, mode, scale,
      buffer: `${buf.x}×${buf.y}`,
      ...r
    });
    done++;
    progress(`${material} / ${mode} / ×${scale}`);
    drawMatrix(rows);
  };

  try {
    for (const name of CFG.mats) {
      if (STATE.aborted) break;
      progress(`${name}：建材质`);
      clearBakedSurfaces();

      // flat 的色值：和库自己"远处退化"用的平均色一致，比较才公平。
      const avg = bakeAverage(renderer, name);
      avgColors[name] = avg.getHexString();

      const live = createMaterial(name, { bake: false });   // 强制实时 GLSL
      const flat = new THREE.MeshStandardMaterial({ color: avg, roughness: 0.9, metalness: 0.0 });

      for (const scale of CFG.scales) {
        if (STATE.aborted) break;
        const buf = setScale(scale);
        mesh.material = live;
        await record(name, 'live', scale, buf);
      }
      live.dispose();

      if (!STATE.aborted) {
        progress(`${name}：烘焙 ${CFG.bakeSize}²`);
        bakeSurfaces(renderer, [{ name, size: CFG.bakeSize }]);
        const baked = createMaterial(name, { bake: true });
        for (const scale of CFG.scales) {
          if (STATE.aborted) break;
          const buf = setScale(scale);
          mesh.material = baked;
          await record(name, 'baked', scale, buf);
        }
        baked.dispose();
        clearBakedSurfaces();     // 关键：烘焙改的是全局注册表，不清会污染下一个材质
      }

      for (const scale of CFG.scales) {
        if (STATE.aborted) break;
        const buf = setScale(scale);
        mesh.material = flat;
        await record(name, 'flat', scale, buf);
      }
      flat.dispose();
    }

    /* ---- 后处理开销：最重的材质 + scale 1.0，off / low / high ---- */
    const postRows = [];
    if (!STATE.aborted) {
      progress('后处理开销');
      const heaviest = [...rows.filter((r) => r.mode === 'live' && r.scale === CFG.scales[0])]
        .sort((a, b) => b.p95 - a.p95)[0];
      const pname = heaviest ? heaviest.material : CFG.mats[0];
      setScale(CFG.scales[0]);
      const mat = createMaterial(pname, { bake: false });
      mesh.material = mat;
      postRows.push({ quality: 'off', ...(await sample(() => frameTime())) });
      for (const quality of ['low', 'high']) {
        if (STATE.aborted) break;
        const post = createPost(renderer, { quality });
        postRows.push({ quality, ...(await sample(() => {
          const t0 = performance.now();
          post.render(scene, camera, performance.now() * 0.001);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          return performance.now() - t0;
        })) });
      }
      mesh.material = null;
      mat.dispose();
      drawPost(postRows, pname);
    }

    const rec = buildRecommendation(rows, postRows);
    drawRecommendation(rec);
    const results = {
      when: new Date().toISOString(),
      env: ENV,
      cfg: { ...CFG, baseDpr },
      rows,
      post: postRows,
      recommend: rec
    };
    window.__bench.results = results;
    window.__bench.ready = true;
    el.raw.textContent = JSON.stringify(results, null, 1);
    el.prog.textContent = STATE.aborted ? '已停止（数据是部分结果）' : `完成 · ${rows.length} 个采样`;
  } catch (err) {
    const msg = (err && (err.stack || err.message)) || String(err);
    el.err.textContent = msg;
    window.__bench.error = msg;
    window.__bench.ready = false;
    el.prog.textContent = '出错（见上方红字）';
  } finally {
    STATE.running = false;
    el.start.disabled = false;
    el.stop.disabled = true;
  }
}

/* ---------------------------------------------------------------- 推荐 */
// 判据只有一条：p95 ≤ CFG.budget (20ms)。60fps 是 16.7ms，留 3ms 给浏览器 / 合成 / GC。
// 每档的分辨率乘数、阴影、后处理怎么配，见 docs/PERF.md 的预算表。
function buildRecommendation(rows, postRows) {
  const key = (m, mode, s) => `${m}|${mode}|${s}`;
  const map = new Map(rows.map((r) => [key(r.material, r.mode, r.scale), r]));
  const B = CFG.budget;
  const lowest = CFG.scales[CFG.scales.length - 1];

  let chosen = null;
  let assign = {};
  let reportScale = lowest;                   // 全都超预算时，报告最低档的数字
  for (const scale of CFG.scales) {            // 从大到小，第一个"全都够"的档就是答案
    const a = {};
    let ok = true;
    for (const m of CFG.mats) {
      const live = map.get(key(m, 'live', scale))?.p95 ?? Infinity;
      const baked = map.get(key(m, 'baked', scale))?.p95 ?? Infinity;
      const flat = map.get(key(m, 'flat', scale))?.p95 ?? Infinity;
      if (live <= B) a[m] = 'live';
      else if (baked <= B) a[m] = 'baked';
      else if (flat <= B) a[m] = 'flat';
      else { a[m] = 'over'; ok = false; }
    }
    if (ok) { chosen = scale; assign = a; break; }
    if (scale === lowest) { reportScale = scale; assign = a; }
  }

  const post = postRows.find((r) => r.quality === 'low');
  const postHigh = postRows.find((r) => r.quality === 'high');
  let postRec = 'off';
  if (post && post.p95 <= B) postRec = postHigh && postHigh.p95 <= B ? 'high' : 'low';

  const bakeList = CFG.mats.filter((m) => assign[m] === 'baked');
  const flatList = CFG.mats.filter((m) => assign[m] === 'flat');
  const overList = CFG.mats.filter((m) => assign[m] === 'over');
  const worst = (mode) => Math.max(...CFG.mats
    .map((m) => map.get(key(m, mode, reportScale))?.p95 ?? 0), 0);

  const lines = [];
  lines.push(`// tools/bench.html 生成 · ${ENV.gl.renderer}`);
  lines.push(`// ${CFG.W}×${CFG.H} CSS · DPR ${ENV.dpr} · 判据 p95 ≤ ${B}ms`);
  if (ENV.gl.software) lines.push('// 注意：软件渲染（SwiftShader/llvmpipe），毫秒数只能做相对比较，不代表任何 GPU。');
  if (chosen === null) {
    lines.push(`// 连最低档 ×${lowest} 都超预算：这个环境不适合全屏程序化表面。`);
    lines.push('// 最后的办法：关后处理 + 降窗口尺寸 + 下面的材质全部 flat。');
  }
  lines.push(`const DPR_CAP = ${chosen ?? lowest};   // 实测能守住预算的最大 pixelRatio 乘数`);
  lines.push('renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_CAP));');
  lines.push(postRec === 'off'
    ? '// 后处理：本机连 low 都超预算，直接不挂 createPost'
    : `const post = createPost(renderer, { quality: '${postRec}' });`);
  if (bakeList.length) {
    lines.push(`bakeSurfaces(renderer, [\n${bakeList.map((m) => `  { name: '${m}', size: ${CFG.bakeSize} }`).join(',\n')}\n]);`);
  } else if (flatList.length) {
    lines.push('// 需要烘焙的材质：无 —— 这一档已经退到平均色（flat）');
  } else {
    lines.push('// 本机所有材质 live 也够，不必烘焙');
  }
  if (flatList.length) {
    lines.push(`const FLAT = new Set([${flatList.map((m) => `'${m}'`).join(', ')}]);`);
    lines.push('// FLAT 里的表面：new THREE.MeshStandardMaterial({ color: bakeAverage(renderer, name) })');
  }
  if (overList.length) {
    lines.push(`// 平均色都超预算：${overList.join(', ')} —— 这种设备上别铺满屏`);
  }

  return {
    budget: B,
    scale: chosen,
    reportScale,
    assign,
    bakeList, flatList, overList, post: postRec,
    worstLive: +worst('live').toFixed(2),
    worstBaked: +worst('baked').toFixed(2),
    worstFlat: +worst('flat').toFixed(2),
    code: lines.join('\n')
  };
}

/* ---------------------------------------------------------------- 渲染表格 */
function cell(p50, p95) {
  if (!Number.isFinite(p95)) return '<td class="dim">—</td>';
  const cls = p95 <= CFG.budget ? 'ok' : p95 <= 33.3 ? 'warn' : 'bad';
  return `<td class="${cls}">${p50.toFixed(1)} / ${p95.toFixed(1)}</td>`;
}

function drawMatrix(rows) {
  if (!rows.length) { el.matrix.innerHTML = ''; return; }
  const bufAt = (s) => rows.find((r) => r.scale === s)?.buffer ?? '';
  const head = `<tr><th class="l">材质</th><th class="l">模式</th>` +
    CFG.scales.map((s) => `<th>×${s}<br><span class="dim">${bufAt(s)}</span></th>`).join('') +
    `<th>首帧</th><th>calls</th></tr>`;
  const body = [];
  for (const m of CFG.mats) {
    for (const mode of ['live', 'baked', 'flat']) {
      const cells = CFG.scales.map((s) => {
        const r = rows.find((x) => x.material === m && x.mode === mode && x.scale === s);
        if (!r) return '<td class="dim">… / …</td>';
        return cell(r.p50, r.p95);
      }).join('');
      const first = rows.find((x) => x.material === m && x.mode === mode);
      body.push(`<tr><td class="l">${m}</td><td class="l dim">${mode}</td>${cells}` +
        `<td class="dim">${first ? first.firstMs.toFixed(1) : ''}</td>` +
        `<td class="dim">${first ? first.calls : ''}</td></tr>`);
    }
  }
  el.matrix.innerHTML = `<table>${head}${body.join('')}</table>`;
}

function drawPost(postRows, pname) {
  if (!postRows.length) { el.post.innerHTML = ''; return; }
  const rows = postRows.map((r) => `<tr><td class="l">${r.quality}</td>` +
    `${cell(r.p50, r.p95)}<td class="dim">${r.n}</td></tr>`).join('');
  el.post.innerHTML = `<table><tr><th class="l">档位</th><th>p50 / p95 (ms)</th><th>n</th></tr>${rows}</table>` +
    `<div class="dim">${pname} live · 后处理 p95 要叠到场景 p95 上一起看</div>`;
}

function drawRecommendation(rec) {
  el.rec.innerHTML = `<pre>${rec.code}</pre>` +
    `<div class="dim">×${rec.reportScale} 下最差 p95：live ${rec.worstLive}ms · baked ${rec.worstBaked}ms · ` +
    `flat ${rec.worstFlat}ms。矩阵不含后处理，后处理单独测，见上表。</div>`;
}

/* ---------------------------------------------------------------- 绑定 */
el.start.addEventListener('click', () => run());
el.stop.addEventListener('click', () => {
  STATE.aborted = true;
  el.prog.textContent = '正在停止…';
});
if (CFG.auto) run();
