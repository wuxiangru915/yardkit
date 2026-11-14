# 验收与截图

## 三条验收（缺一不可）

```bash
cd "${KIT:-/home/wxr/.project/yardkit}"

# 1) Node 侧：实例化 / 尺寸 / 碰撞盒 / 无 NaN
node test/check.mjs | tail -5          # 期望 "N checks passed"，0 failed

# 2) 浏览器侧：每个 demo 0 console 错误
node test/render.mjs | tail -20        # 期望每行 "ready=true errors=0"

# 3) 内核没被动过
md5sum -c /tmp/kit-src-baseline.txt | grep -v ': OK' || echo 'kernel unchanged'
```

`test/render.mjs` 会自己起 `python3 -m http.server 8177`，跑完自动关。
新增 demo 后把它加进 `test/render.mjs` 的 `targets`（`[名字, 路径, ready 探针, 宽, 高]`）。

## 基线（开工前先拍一张）

```bash
cd /home/wxr/.project/yardkit
md5sum src/*.js src/materials/*.js assets/glsl/*.glsl > /tmp/kit-src-baseline.txt
```

## 单独截图（调试用）

```bash
cd /home/wxr/.project/yardkit && (python3 -m http.server 8177 --bind 127.0.0.1 &) ; sleep 1
```

```js
// /tmp/shot.mjs
import { chromium } from '/home/wxr/.project/saltline2/tools/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({
  executablePath: '/home/wxr/.cache/ms-playwright/chromium-snapshot/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8177/demos/XXX.html', { waitUntil: 'load' });
await p.waitForTimeout(9000);          // swiftshader 慢，给足时间
console.log(JSON.stringify(await p.evaluate(() => window.__probe)));
console.log('errors', errs);
await p.screenshot({ path: '/tmp/shot.png' });
await b.close();
```

页面里的探针约定：`window.__moon`、`window.__moonScene`、`window.__cozyScene`、`window.__kit` 等，
至少含 `{ ready: true }`。

## 拼对比图（PIL）

```python
from PIL import Image, ImageDraw, ImageFont
font = ImageFont.truetype('/home/wxr/.local/share/fonts/NotoSansSC-Bold.otf', 24)
font_s = ImageFont.truetype('/home/wxr/.local/share/fonts/NotoSansSC-Regular.otf', 17)
```

- 三宫格：`shots/packs.png`（工业 / 月球 / 治愈）
- A/B：`shots/moon-ab.png`
- 版面：顶部标题 + 每格下方两行说明（标题、副标题），格子 760×434，间隔 16。

## 报告格式（给用户看的）

1. 结论先行（能/不能，为什么）
2. 真实数字：检查项数、demo 数、代码行数、内核改动行数
3. 失败与简化：列 3–5 条（模型缺口、材质偏黑、装不下等）
4. 截图路径
5. 下一步选项（2–3 个，各一句话）

不要写"已完成/效果很好"这种没有数字和截图的总结。
