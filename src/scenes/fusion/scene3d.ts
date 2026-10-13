// 3D-сцена слияния (SITE-12) — только отрисовка. Позы, камера, окно и подписи считает choreo.ts (чистые функции p).
// Пять болей по очереди, одно окно забирает всё и складывается в чистый знак VILAX. Частиц, вспышек и свечения нет.
// Предметы — модели из простых форм (models.ts) с общим атласом; каждый вид — один вызов отрисовки.
import {
  CanvasTexture,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Version } from './faces';
import { buildAtlas } from './atlas';
import { buildModels } from './models';
import { HALF, ITEMS, LOGO_H, LOGO_W, LOGO_Y, WIN, cameraAt, intersectingPairs, poseAt, type Kind } from './choreo';

export interface FusionOptions {
  canvas: HTMLCanvasElement;
  version: Version;
  pixelRatio: number;
}

/** Где на экране (в px от левого верхнего угла холста) окно и знак — для HTML-слоёв поверх. */
export interface FusionLayout {
  win: { x: number; y: number; w: number; h: number };
  mark: { x: number; y: number; w: number; h: number };
}

export interface FusionScene {
  render(p: number): FusionLayout;
  /** Пары пересекающихся предметов при данной p (проверка в local; должно быть 0). */
  overlaps(p: number): number;
  resize(): void;
  setPixelRatio(dpr: number): void;
  dispose(): void;
}

const FOV = 40;

const THEME = {
  ru: { fog: [0x020817, 16, 33], rim: 0x18f2df, rimI: 1.6, hemi: 1.1, key: 2.4, env: 0.5, exposure: 1.05 },
  en: { fog: [0xf5f7fa, 20, 44], rim: 0x2297ff, rimI: 0.8, hemi: 1.3, key: 2.0, env: 0.55, exposure: 1.0 },
} as const;

export function createFusionScene(opts: FusionOptions): FusionScene {
  const { canvas, version } = opts;
  const theme = THEME[version];

  // antialias всегда включён (MSAA): иначе на DPR>1 кромки предметов и знака ступенчатые (жалоба 12.10).
  // powerPreference по умолчанию: на гибридных ноутбуках не будим дискретную видеокарту
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' });
  renderer.setPixelRatio(opts.pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = theme.exposure;

  const scene = new Scene();
  scene.fog = new Fog(theme.fog[0], theme.fog[1], theme.fog[2]);
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
  scene.add(new HemisphereLight(0xffffff, 0x1a2638, theme.hemi));
  const key = new DirectionalLight(0xffffff, theme.key);
  key.position.set(-5, 7, 10);
  scene.add(key);
  const rim = new DirectionalLight(theme.rim, theme.rimI);
  rim.position.set(6, 3, -9);
  scene.add(rim);

  // --- атлас, модели, по одной InstancedMesh на вид ---
  const atlas = buildAtlas(version);
  const colorTex = new CanvasTexture(atlas.color);
  colorTex.colorSpace = SRGBColorSpace;
  colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rmTex = new CanvasTexture(atlas.rm);
  const material = new MeshStandardMaterial({
    map: colorTex,
    roughnessMap: rmTex,
    metalnessMap: rmTex,
    roughness: 1,
    metalness: 1,
    envMapIntensity: theme.env,
    alphaTest: 0.5,
  });
  const models = buildModels(atlas);
  const meshes = new Map<Kind, InstancedMesh>();
  for (const m of models) {
    const count = ITEMS.filter((it) => it.kind === m.id).length;
    if (!count) continue;
    const mesh = new InstancedMesh(m.geometry, material, count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.set(m.id, mesh);
    // габариты из choreo.ts должны совпадать с геометрией, иначе проверка пересечений врёт
    if (document.documentElement.dataset.mode !== 'prod') {
      const h = HALF[m.id];
      if (m.half.some((v, i) => v > h[i] + 0.04)) {
        console.warn(`fusion: габариты ${m.id} в choreo.ts ${h.join('/')} меньше геометрии ${m.half.map((v) => v.toFixed(2)).join('/')}`);
      }
    }
  }
  const slots = ITEMS.map((it, i) => ITEMS.slice(0, i).filter((x) => x.kind === it.kind).length);

  // --- кадр ---
  const m4 = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const pos = new Vector3();
  const scl = new Vector3();
  const tmp = new Vector3();
  let width = 1;
  let height = 1;

  function project(x: number, y: number): [number, number] {
    tmp.set(x, y, 0).project(camera);
    return [(tmp.x * 0.5 + 0.5) * width, (-tmp.y * 0.5 + 0.5) * height];
  }

  function render(p: number): FusionLayout {
    const cam = cameraAt(p);
    const fit = Math.max(1, 1.5 / (width / height));
    camera.position.set(cam.x, cam.y, cam.z * fit);
    // на узких окнах камера отъезжает — туман отъезжает вместе с ней, иначе предметы тонут в фоне
    const fog = scene.fog as Fog;
    fog.near = theme.fog[1] + cam.z * (fit - 1);
    fog.far = theme.fog[2] + cam.z * (fit - 1);
    camera.lookAt(cam.x, cam.y, 0);
    camera.updateMatrixWorld();

    ITEMS.forEach((it, i) => {
      const o = poseAt(i, p);
      pos.set(o.x, o.y, o.z);
      e.set(o.rx, o.ry, o.rz);
      q.setFromEuler(e);
      scl.setScalar(Math.max(o.s, 0.0001));
      m4.compose(pos, q, scl);
      meshes.get(it.kind)!.setMatrixAt(slots[i], m4);
    });
    for (const mesh of meshes.values()) mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);

    const [wx0, wy0] = project(WIN.x0, WIN.y1);
    const [wx1, wy1] = project(WIN.x1, WIN.y0);
    const [mx0, my0] = project(-LOGO_W / 2, LOGO_Y + LOGO_H / 2);
    const [mx1, my1] = project(LOGO_W / 2, LOGO_Y - LOGO_H / 2);
    return {
      win: { x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0 },
      mark: { x: mx0, y: my0, w: mx1 - mx0, h: my1 - my0 },
    };
  }

  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setPixelRatio(dpr: number) {
    renderer.setPixelRatio(dpr);
    resize();
  }

  function dispose() {
    for (const m of models) m.geometry.dispose();
    material.dispose();
    colorTex.dispose();
    rmTex.dispose();
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  resize();
  return { render, overlaps: (p) => intersectingPairs(p).length, resize, setPixelRatio, dispose };
}
