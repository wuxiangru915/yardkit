// TypeScript declarations for yardkit.
//
// 说明：three 本身不带 .d.ts；使用方需要安装 `@types/three`（与 three 的
// minor 版本对齐）。这里的 import 都是 type-only，不会进入运行时。
import type * as THREE from 'three';

export type Vec2 = [number, number] | readonly [number, number];
export type Vec3 = [number, number, number] | readonly [number, number, number];
export type Anchor = 'center' | 'bottom';
export type Axis = 'x' | 'y' | 'z';
export type Face = 'z+' | 'z-' | 'x+' | 'x-' | 'y+';
export type Tier = 'low' | 'medium' | 'high' | 'ultra';
export type MaterialTier = 'live' | 'baked' | 'flat';
export type SurfaceName = string;
export type MaterialName = string;
export type ColorInput = number | string | THREE.Color;

// ---------------------------------------------------------------------------
// 共用
// ---------------------------------------------------------------------------

export interface SurfaceParams {
  tile?: number;
  bump?: number;
  amount?: number;
  ao?: number;
  tint?: number;
  cutout?: boolean;
  [key: string]: unknown;
}

export interface Collider {
  min: Vec3;
  max: Vec3;
  surface?: string;
  [key: string]: unknown;
}

export interface KitUserData {
  size?: Vec3;
  colliders?: Collider[];
  update?: (dt: number) => void;
  [key: string]: unknown;
}

/** 所有“道具/设施/载具”工厂返回的 Object3D 形状。 */
export type KitObject = THREE.Object3D & { userData: KitUserData };

export interface ModelOptions {
  seed?: number;
  materials?: MaterialStore;
  animate?: boolean;
  color?: string | number;
  [key: string]: unknown;
}

export interface TransformXf {
  p?: Vec3;
  r?: Vec3;
  s?: number | Vec3 | [number, number, number];
}

export interface AnimHandle {
  root: THREE.Group;
  update(dt: number, t?: number): void;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 材质 / 表面
// ---------------------------------------------------------------------------

export interface CreateMaterialOptions {
  /** 底色/漆色；GLSL 表面会把 albedo 乘到这个颜色上。 */
  tint?: number;
  /** 远处退化用的平均色；通常来自 bakeAverage()。 */
  avg?: ColorInput;
  tile?: number;
  bump?: number;
  amount?: number;
  ao?: number;
  seed?: number;
  cutout?: boolean;
  side?: THREE.Side;
  tier?: MaterialTier;
  /** 强制不用烘焙贴图（即使已经 bakeSurfaces）。 */
  bake?: boolean;
  [key: string]: unknown;
}

export function createMaterial(name: MaterialName, opts?: CreateMaterialOptions): THREE.MeshStandardMaterial;
export function bakeAverage(renderer: THREE.WebGLRenderer, name: MaterialName): THREE.Color;
export function registerSurface(name: string, glsl: string, params?: SurfaceParams): void;
export function surfaceNames(): string[];

export const NAMES: string[];
export const REGISTRY: Record<string, SurfaceParams>;
export const SURFS: Record<string, string>;
export const DSL: string;
export const GLSL_NOISE: string;
export const MATERIAL_PRESETS: Record<string, {
  color: number;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
  pattern?: string;
  [key: string]: unknown;
}>;

export interface StoreGetOptions {
  vertexColors?: boolean;
  doubleSide?: boolean;
  side?: THREE.Side;
  color?: number;
  [key: string]: unknown;
}

export interface LabelOptions {
  color?: 'black' | 'yellow' | 'red' | 'white' | string;
  bg?: string;
  [key: string]: unknown;
}

export interface LabelInfo {
  material: THREE.Material;
  aspect: number;
}

export interface DecalInfo {
  material: THREE.Material;
  aspect: number;
}

export interface MaterialStore {
  get(name: MaterialName, opts?: StoreGetOptions): THREE.Material;
  emissive(hex?: number, intensity?: number): THREE.MeshBasicMaterial;
  label(text: string, opts?: LabelOptions): LabelInfo;
  decal(kind: string): DecalInfo;
}

export function createMaterialStore(opts?: {
  createMaterial?: typeof createMaterial | null;
  averages?: Record<string, ColorInput> | null;
  surfaceMap?: Record<string, string> | null;
  tier?: MaterialTier;
}): MaterialStore;

export const defaultMaterials: MaterialStore;

export interface BakeEntry {
  name: MaterialName;
  size?: number;
  seed?: number;
}

export interface BakedSurface {
  alb: THREE.Texture;
  meta: THREE.Texture;
  size: number;
}

export function bakeSurfaces(renderer: THREE.WebGLRenderer, entries: BakeEntry[]): void;
export function getBakedSurface(name: MaterialName): BakedSurface | undefined;
export function setBakedSurface(name: MaterialName, entry: BakedSurface | null): void;
export function clearBakedSurfaces(): void;

// ---------------------------------------------------------------------------
// 天空 / 后处理
// ---------------------------------------------------------------------------

export interface SkyPalette {
  zenith: ColorInput;
  horizon: ColorInput;
  sun: ColorInput;
  cloud: ColorInput;
  [key: string]: unknown;
}

export interface SkyHandle {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function createSky(sunDir: THREE.Vector3, palette: SkyPalette): SkyHandle;
export function bakeEnvironment(renderer: THREE.WebGLRenderer, skyMesh: THREE.Mesh): THREE.Texture;

export interface PostChain {
  rtScene: THREE.WebGLRenderTarget;
  uniforms: Record<string, { value: unknown }>;
  readonly lastStats: { calls: number; tris: number };
  setSize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera, time: number): void;
  dispose(): void;
}

export function createPost(renderer: THREE.WebGLRenderer, opts?: { quality?: 'low' | 'high' }): PostChain;

// ---------------------------------------------------------------------------
// 画质 / 动态分辨率
// ---------------------------------------------------------------------------

export interface TierConfig {
  name: Tier;
  scale: number;
  post: 'low' | 'high';
  shadow: number;
  material: MaterialTier;
  maxPixels: number;
  targetMs: number;
  minScale: number;
  maxScale: number;
}

export const TIER_ORDER: Tier[];
export const QUALITY_TIERS: Record<Tier, Omit<TierConfig, 'targetMs' | 'minScale' | 'maxScale'>>;

export function detectRenderer(): string;
export function pickTier(opts?: {
  ua?: string;
  renderer?: string;
  maxTouchPoints?: number;
  minScreen?: number;
}): Tier;
export function tierConfig(name?: Tier | string): TierConfig;

export interface DynamicResolution {
  readonly scale: number;
  readonly didHitFloor: boolean;
  readonly changes: number;
  update(frameMs: number): void;
  reset(): void;
  clearFloor(): void;
  setLimits(opts?: { minScale?: number; maxScale?: number; targetMs?: number }): void;
}

export function createDynamicResolution(opts?: {
  targetMs?: number;
  minScale?: number;
  maxScale?: number;
  step?: number;
}): DynamicResolution;

export interface AutoQuality {
  readonly tier: Tier;
  readonly scale: number;
  readonly config: TierConfig;
  update(frameMs: number): void;
  setTier(name: Tier): Tier;
  dispose(): void;
}

export function createAutoQuality(opts?: {
  renderer?: THREE.WebGLRenderer | null;
  post?: PostChain | null;
  sun?: THREE.DirectionalLight | null;
  tier?: Tier | 'auto';
  targetMs?: number;
  allowTierDrop?: boolean;
  onTierChange?: ((to: Tier, from: Tier) => void) | null;
}): AutoQuality;

// ---------------------------------------------------------------------------
// 几何工具
// ---------------------------------------------------------------------------

export function createRng(seed?: number): () => number;
export function noise3(x: number, y?: number, z?: number): number;
export function box(w: number, h: number, d: number, anchor?: Anchor): THREE.BufferGeometry;
export function bevelBox(w: number, h: number, d: number, r?: number, anchor?: Anchor): THREE.BufferGeometry;
export function cyl(rTop: number, rBot: number, h: number, seg?: number, openEnded?: boolean, anchor?: Anchor): THREE.BufferGeometry;
export function sphere(r: number, ws?: number, hs?: number, sx?: number, sy?: number, sz?: number): THREE.BufferGeometry;
export function tube(points: Array<Vec3 | THREE.Vector3>, r?: number, radialSeg?: number, closed?: boolean, tension?: number): THREE.BufferGeometry;
export function lathe(profile: Vec2[], seg?: number): THREE.BufferGeometry;
export function plane(w: number, h: number): THREE.BufferGeometry;
export function rangeBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, bevel?: number): THREE.BufferGeometry;
export function cylAxis(rTop: number, rBot: number, h: number, axis: Axis, x: number, y: number, z: number, seg?: number, openEnded?: boolean): THREE.BufferGeometry;
export function pipeBetween(a: Vec3 | THREE.Vector3, b: Vec3 | THREE.Vector3, rTop: number, rBot?: number, seg?: number, openEnded?: boolean): THREE.BufferGeometry | null;
export function beamBetween(a: Vec3 | THREE.Vector3, b: Vec3 | THREE.Vector3, w: number, d: number, bevel?: number): THREE.BufferGeometry;
export function pipeChain(pts: Array<Vec3 | THREE.Vector3>, r?: number, seg?: number): THREE.BufferGeometry;
export function parabolaPoints(a: Vec3, b: Vec3, sag?: number, steps?: number): THREE.Vector3[];
export function signQuad(w: number, h: number, x: number, y: number, z: number, ry?: number, rx?: number): THREE.BufferGeometry;
export function xform(geo: THREE.BufferGeometry, xf?: TransformXf): THREE.BufferGeometry;
export function applyVertexColor(geo: THREE.BufferGeometry, color: number | Vec3 | ((x: number, y: number, z: number) => number | Vec3)): THREE.BufferGeometry;
export function mergeGeos(geos: Array<THREE.BufferGeometry | null | undefined>): THREE.BufferGeometry;
export function roundPoly2D(pts: Vec2[], radius: number | number[], steps?: number): Vec2[];
export function extrudeProfile(pts: Vec2[], depth: number, bevel: number, holes?: Vec2[][], bs?: number): THREE.BufferGeometry;
export function extrudeX(pts: Vec2[], x0: number, x1: number, bevel: number, color: number | Vec3, opts?: Record<string, unknown>): THREE.BufferGeometry;
export function extrudeZ(pts: Vec2[], z0: number, z1: number, bevel: number, color: number | Vec3, opts?: Record<string, unknown>): THREE.BufferGeometry;
export function latheSection(profile: Vec2[], seg: number, color: number | Vec3, opts?: Record<string, unknown>): THREE.BufferGeometry;
export function loftSections(sections: Vec3[][], color: number | Vec3, opts?: Record<string, unknown>): THREE.BufferGeometry;

export class MeshBatcher {
  add(mat: THREE.Material, geo: THREE.BufferGeometry, tint?: number | null): THREE.BufferGeometry;
  build(opts?: { cast?: boolean; recv?: boolean }): THREE.Mesh;
}

export class RigBuilder {
  add(slot: string, boneName: string, geo: THREE.BufferGeometry, color?: Vec3, shadeNormals?: boolean): void;
  build(): THREE.Group;
}

export class PropBuilder {
  constructor(mats: MaterialStore, name?: string, seed?: number);
  readonly mats: MaterialStore;
  readonly name: string;
  readonly seed: number;
  add(mat: MaterialName | THREE.Material, geo: THREE.BufferGeometry | null, xf?: TransformXf | null, col?: number | Vec3, opts?: { raw?: boolean; cast?: boolean }): THREE.BufferGeometry | null;
  push(xf: TransformXf): this;
  pop(): this;
  label(text: string, opts?: LabelOptions, maxWidth?: number, h?: number, xf?: TransformXf): THREE.BufferGeometry | null;
  decal(info: DecalInfo, h: number, xf?: TransformXf): THREE.BufferGeometry | null;
  cdecal(info: DecalInfo, radius: number, h: number, xf?: TransformXf, wOverride?: number): THREE.BufferGeometry | null;
  finish(opts?: { grime?: number; size?: Vec3; colliders?: Collider[]; surface?: string }): KitObject;
}

// ---------------------------------------------------------------------------
// 道具 / 设施 / 载具 / 敌人
// ---------------------------------------------------------------------------

export const PROP_NAMES: string[];
export const FIXTURE_NAMES: string[];
export const CONTAINER_TYPES: Array<'container20' | 'container40' | 'container40hc'>;
export const CONTAINER_COLORS: string[];
export const CONTAINER_HEIGHT: number;
export const CONTAINER_META: Record<string, Record<string, string | number>>;

export function createProp(name: string, opts?: ModelOptions): KitObject;
export function createFixture(name: string, opts?: ModelOptions): KitObject;
export function createContainer(type: 'container20' | 'container40' | 'container40hc', opts?: ModelOptions): KitObject;
export function collectParts(builder: PropBuilder): Array<{ mat: THREE.Material; geo: THREE.BufferGeometry; cast: boolean }>;
export function partsToGroup(parts: Array<{ mat: THREE.Material; geo: THREE.BufferGeometry; cast: boolean }>, matRemap?: Map<THREE.Material, THREE.Material> | null): THREE.Group;

export function createBoat(opts?: { materials?: MaterialStore; animate?: boolean }): AnimHandle;
export function createCrane(opts?: { materials?: MaterialStore; animate?: boolean; centered?: boolean }): AnimHandle;
export function createDistantCrane(opts?: Record<string, unknown>): KitObject;
export function createShip(opts?: { materials?: MaterialStore; animate?: boolean; centered?: boolean }): AnimHandle;
export function createSeagulls(opts?: { count?: number; height?: number; seed?: number; animate?: boolean }): AnimHandle;

export function createPAC9(opts?: { materials?: MaterialStore; animate?: boolean }): AnimHandle;
export function createPAC4(opts?: { materials?: MaterialStore; animate?: boolean }): AnimHandle;
export function createHound(opts?: { materials?: MaterialStore; animate?: boolean }): AnimHandle;
export function createGull(opts?: { materials?: MaterialStore; showCone?: boolean; animate?: boolean }): AnimHandle;

export function createSkyline(opts?: { materials?: MaterialStore; seed?: number; lamps?: boolean }): KitObject;
export function createLamps(opts?: { materials?: MaterialStore; specs?: unknown; posts?: boolean }): KitObject;
export function createBackdrop(opts?: {
  boat?: unknown;
  crane?: unknown;
  ship?: unknown;
  skyline?: unknown;
  lamps?: unknown;
  gulls?: unknown;
  showcase?: boolean;
  materials?: MaterialStore;
}): AnimHandle;

// ---------------------------------------------------------------------------
// 关卡
// ---------------------------------------------------------------------------

export interface AddOptions {
  p?: Vec3;
  r?: Vec3;
  parent?: THREE.Object3D;
  cast?: boolean;
  recv?: boolean;
  bevel?: number;
  [key: string]: unknown;
}

export interface PlaceFlags {
  dynamic?: boolean;
  noCol?: boolean;
  inert?: boolean;
  colOpts?: Record<string, unknown>;
}

export interface BuiltLevel {
  root: THREE.Group;
  colliders: Collider[];
  stats: { tris: number; drawCalls: number };
}

export interface Level {
  root: THREE.Group;
  staticRoot: THREE.Group;
  dynRoot: THREE.Group;
  materials: MaterialStore;
  M(name: string, opts?: StoreGetOptions): THREE.Material;
  MI(name: string, opts?: StoreGetOptions): THREE.Material;

  add(geo: THREE.BufferGeometry, mat: MaterialName | THREE.Material, o?: AddOptions): THREE.Mesh;
  box(mat: MaterialName | THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, o?: AddOptions): THREE.Mesh;
  slab(mat: MaterialName | THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o?: AddOptions): THREE.Mesh;
  cyl(mat: MaterialName | THREE.Material, r: number, h: number, x: number, y: number, z: number, o?: AddOptions & { rTop?: number; seg?: number; open?: boolean; axis?: Axis }): THREE.Mesh;
  tube(mat: MaterialName | THREE.Material, points: Vec3[], r?: number, o?: AddOptions & { radial?: number; tension?: number }): THREE.Mesh;
  rod(mat: MaterialName | THREE.Material, a: Vec3, b: Vec3, r?: number, o?: AddOptions & { seg?: number }): THREE.Mesh;
  ibeam(mat: MaterialName | THREE.Material, axis: Axis, span: number, x: number, y: number, z: number, o?: AddOptions & { depth?: number; width?: number; tf?: number; tw?: number; depthAxis?: Axis }): THREE.Group;
  quad(mat: MaterialName | THREE.Material, w: number, h: number, x: number, y: number, z: number, face?: Face, rot?: number): THREE.Mesh;
  decal(kind: string, size: number, x: number, y: number, z: number, face?: Face, rot?: number): THREE.Mesh | null;
  label(text: string, size: number, x: number, y: number, z: number, face?: Face, opts?: LabelOptions): THREE.Mesh | null;

  col(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface?: string, opts?: Record<string, unknown>): Collider;
  col(min: Vec3, max: Vec3, surface?: string, opts?: Record<string, unknown>): Collider;
  colliders: Collider[];
  metalRects: number[][];
  isMetal(x: number, z: number): boolean;

  place(name: string, x: number, z: number, yaw?: number, opts?: ModelOptions, y?: number, flags?: PlaceFlags): KitObject;
  stairs(x: number, z: number, yaw?: number, y?: number, opts?: ModelOptions): KitObject;
  catwalk(x: number, z: number, yaw?: number, y?: number, opts?: ModelOptions, rails?: [boolean, boolean]): KitObject;
  stack(x: number, z: number, rows: Array<[20 | 40 | 'hc', string, Record<string, unknown>?]>, yaw?: number, wobble?: number): { top: number; objs: KitObject[] };

  placed: Array<Record<string, unknown>>;
  explosives: Array<Record<string, unknown>>;
  updaters: Array<(dt: number) => void>;
  rng: () => number;
  rnd(a: number, b: number): number;
  seed: number;

  build(): BuiltLevel;
  dispose(): void;
}

export function createLevel(opts?: {
  materials?: MaterialStore;
  seed?: number;
  physics?: { addBox(min: Vec3, max: Vec3, opts?: Record<string, unknown>): void } | null;
  rng?: (() => number) & { fork?: () => () => number };
  container?: (name: string, opts?: ModelOptions) => KitObject;
}): Level;

// ---------------------------------------------------------------------------
// 手 / 第一人称武器
// ---------------------------------------------------------------------------

export interface HandRigHandle {
  root: THREE.Group;
  R: KitObject;
  L: KitObject;
  hands: { R: KitObject; L: KitObject };
  update(dt: number, state?: Record<string, unknown>): THREE.Group;
  setPose(pose: unknown): THREE.Group;
  dispose(): void;
}

export interface ViewModelHandle {
  root: THREE.Group;
  hands: { R: KitObject; L: KitObject };
  groups: { R: THREE.Group; L: THREE.Group };
  weapon: KitObject;
  grips: unknown;
  update(dt: number, state?: Record<string, unknown>): THREE.Group;
  setPose(pose: unknown): THREE.Group;
  shot(): void;
  reload(): void;
  readonly reloading: boolean;
  dispose(): void;
}

export function createHandRig(opts?: Record<string, unknown>): HandRigHandle;
export function createViewModel(weapon?: 'pac9' | 'pac4' | string, opts?: Record<string, unknown>): ViewModelHandle;
