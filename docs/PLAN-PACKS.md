# 两条主题包并行（TODOLIST）

目标：同时验证两个方向，做完再决定要不要"停"。

- **包 A（月球）**：给已验证的月球主题补 5 个新模型，看"换题材的真实成本"。
- **包 B（治愈）**：从零做一个相反风格的包（表面 + 模型 + 软光），验证工具箱是否真的与风格无关。
- 两个包都**不改内核**、不碰对方的文件；我只做集成、测试和文档。

## T0 基线（我做）

- [x] 记录当前状态：`node test/check.mjs` = 71 项通过；8 个 demo 0 报错
- [x] 明确边界：内核（`src/`）冻结；两个包各自独立目录
- [x] 分配文件所有权，避免并行冲突（见下表）

| 是谁 | 只能改/新建 |
|---|---|
| 包 A 代理 | `packs/moon/*`、`demos/moon.js`（新增 `mode=c`） |
| 包 B 代理 | `packs/cozy/*`、`demos/cozy-scene.{html,js}` |
| 我 | `test/`、`docs/`、`shots/`、内核（如需，最小改动） |

## T1 月球包：5 个新模型（代理 A）

- [x] `createAirlock()` 气闸：圆筒 + 门框 + 台阶 + 警示灯
- [x] `createRover()` 月球车：底盘 + 4 轮 + 座椅 + 小太阳能板 + 天线
- [x] `createSolarArray()` 太阳能阵列：3 块倾斜板 + 支架
- [x] `createHabitat()` 居住舱：带肋圆筒 + 舷窗 + 对接环
- [x] `createFlag()` 旗：杆 + 布面（低模、轻微波动）
- [x] 全部走 `PropBuilder` + `finish({ size, colliders })`，零贴图
- [x] `demos/moon.html?mode=c`：保留 A/B 对照不变，新增 C = 月球包 + 月球模型
- [x] 验收：node 实例化无 NaN、包围盒合理、截图无 console 错误

## T2 治愈包：表面 + 模型 + 软光（代理 B）

- [x] 表面 5 个：`plaster`（墙面）、`painted_wood`、`ceramic`（陶器）、`weave`（织物）、`foliage`（叶簇）
- [x] 模型 6–8 个：椅子、桌子、茶杯、书架、盆栽、地毯、灯笼、篱笆（至少 6 个）
- [x] 灯光预设：`createCozyLighting()` —— 高环境光、低对比、软阴影
- [x] 天空/雾：浅蓝白天 + 淡淡的雾
- [x] `packs/cozy/index.js`：`installCozyPack()` 注册表面 + 提供 `surfaceMap` + 低磨损预设
- [x] `demos/cozy-scene.html/js`：一间小屋/小院，用新模型 + 软光
- [x] 验收：同上，另加"不得出现工业材质（锈/警示条/瓦楞）"

## T3 集成与验收（我做）

- [x] `test/check.mjs` 增加两个包的检查项
- [x] `test/render.mjs` 增加两个 demo
- [x] 截图（`npm run render` → `shots/*.png`）；与 `shots/moon-ab.jpg` 并排
- [x] `docs/PACKS.md`：主题包的目录规范 + 一个"新包清单"（照抄即可）
- [x] 全量跑一遍：71+ 项检查、全部 demo 0 报错
- [x] 明确写出两个包的**实际代码量**与**哪部分最花时间**

## T4 复盘：要不要"停"（我做，产出结论）

- [ ] 换题材成本表：内核 / 表面 / 模型 / 灯光 / 调试各占多少
- [ ] 判断：这套分层是否值得继续投入；下一款游戏该走哪条路
- [ ] 把这几个实验写成一篇可复用的"主题包手册"

## 结果（已完成）

- 检查：**85 项通过**（原 71 + 月球模型 5 + 治愈包表面/模型 9），0 失败
- 演示：**10 个页面**，0 console 错误
- 并行：两个代理各约 26 分钟，互不冲突；内核 `src/` **一个字节没改**
- 代码量：
  - 月球包：`models.js` 367 行（5 个模型）+ sky/lighting/surfaces 224 行
  - 治愈包：`models.js` 291 行（8 个模型）+ surfaces/sky/lighting 251 行
  - 内核：月球实验时加的 25 行（`registerSurface` + `surfaceMap`），之后没再动

## T4 结论

见 `docs/PACKS.md` 末尾的「成本与判断」。
