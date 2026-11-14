// 每个材质的"物理参数"：一块贴图重复多大（米）、凹凸强度、uP.x（磨损/损坏量）、是否挖孔
// 数值来自原项目的 p_ 参数表（tile/bump），其余是按观感给的默认值。
export const REGISTRY = {
  asphalt:        { tile: 2.0,   bump: 1.6, amount: 0.5, ao: 1.0 },
  concrete:       { tile: 3.0,   bump: 2.5, amount: 0.5, ao: 1.0 },
  brick:          { tile: 1.8,   bump: 6.0, amount: 0.5, ao: 1.0 },
  epoxy:          { tile: 4.0,   bump: 3.0, amount: 0.5, ao: 1.0 },
  paint:          { tile: 2.5,   bump: 2.5, amount: 0.55, ao: 1.0, tint: 0x6f7a6a },
  hazard:         { tile: 1.0,   bump: 2.5, amount: 1.4, ao: 1.0 },
  hull:           { tile: 4.0,   bump: 12.0, amount: 0.6, ao: 1.0, tint: 0x2b3f57 },
  galv:           { tile: 1.0,   bump: 0.8, amount: 0.5, ao: 1.0 },
  metal:          { tile: 1.0,   bump: 0.5, amount: 1.0, ao: 1.0, tint: 0x6b7076 },
  brushed:        { tile: 0.5,   bump: 0.4, amount: 0.5, ao: 1.0, tint: 0x9aa0a6 },
  rust:           { tile: 1.2,   bump: 3.0, amount: 0.7, ao: 1.0 },
  diamond:        { tile: 0.5,   bump: 2.0, amount: 0.5, ao: 1.0 },
  corrugated:     { tile: 1.0,   bump: 19.0, amount: 0.5, ao: 1.0, tint: 0x8a9096 },
  chainlink:      { tile: 0.5,   bump: 5.0, amount: 0.5, ao: 1.0, cutout: true },
  gunmetal:       { tile: 0.25,  bump: 0.3, amount: 0.7, ao: 1.0, tint: 0x2a2d31 },
  polymer:        { tile: 0.1,   bump: 0.4, amount: 0.5, ao: 1.0, tint: 0x22252a },
  carbon:         { tile: 0.05,  bump: 0.5, amount: 0.5, ao: 1.0 },
  fabric:         { tile: 0.05,  bump: 0.4, amount: 0.5, ao: 1.0, tint: 0x2f3a2c },
  armor:          { tile: 0.5,   bump: 0.8, amount: 0.4, ao: 1.0, tint: 0x8a8a80 },
  wood:           { tile: 1.2,   bump: 2.6, amount: 0.5, ao: 1.0, tint: 0x7a5a38 },
  plastic:        { tile: 1.0,   bump: 1.0, amount: 0.5, ao: 1.0, tint: 0x3a4a5a },
  tarp:           { tile: 1.5,   bump: 20.0, amount: 0.5, ao: 1.0, tint: 0x3a4436 },
  cardboard:      { tile: 1.0,   bump: 0.8, amount: 0.5, ao: 1.0, tint: 0x8a6f46 },
  rope:           { tile: 0.1,   bump: 4.0, amount: 0.5, ao: 1.0, tint: 0x8a7a52 },
  tire:           { tile: 0.5,   bump: 7.0, amount: 0.5, ao: 1.0, tint: 0x141414 },
  glass:          { tile: 1.5,   bump: 1.5, amount: 0.3, ao: 1.0, tint: 0x9fb4bd },
  water:          { tile: 4.0,   bump: 30.0, amount: 0.5, ao: 1.0, tint: 0x2a3a3c },
  // —— 清新 / 自然系（新增，证明这套 shader 不绑风格）——
  sand:           { tile: 2.0,   bump: 2.0,  amount: 0.5, ao: 1.0 },
  mud:            { tile: 2.5,   bump: 3.0,  amount: 0.5, ao: 1.0 },
  grass:          { tile: 1.2,   bump: 3.5,  amount: 0.5, ao: 1.0 }
};

export const NAMES = Object.keys(REGISTRY);
