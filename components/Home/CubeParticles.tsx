"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import gsap from "gsap";
import {
  Renderer,
  Program,
  Mesh,
  Geometry,
  Camera,
  Transform,
} from "ogl";

export type CubePose = { rotateX: number; rotateY: number };

export type CubeParticlesHandle = {
  rotateTo: (pose: CubePose) => Promise<void>;
  disperse: () => Promise<void>;
  assemble: () => Promise<void>;
  setPose: (pose: CubePose) => void;
};

type Props = {
  className?: string;
  /** DeepSeek：面文字改为无 RAG 的连续序（背 DOCS / 顶 SET） */
  hideRag?: boolean;
};

/** 面填充密度：越高聚合后间隙越小 */
const GRID = 72;
const HALF = 0.5;
/** 散开后仍是正方体，边长相对 home 放大 */
const EXPAND = 1.65;
const TEXT_RES = 160;

/**
 * 面顺序：前/后/右/左/上/下
 * 文案对齐原 DOM：TH / RAG / SET / AI / DOCS / CHAT
 */
const FACE_LABELS = ["TH", "RAG", "SET", "AI", "DOCS", "CHAT"] as const;
/**
 * DeepSeek：无 RAG 步。背=DOCS、顶=SET，配合 Home 连续 pose
 * （CHAT→DOCS→SETTINGS 各转 90°，不再路过原 RAG 面）
 */
const FACE_LABELS_NO_RAG = ["TH", "DOCS", "SET", "AI", "SET", "CHAT"] as const;

const FACE_COLORS: [number, number, number][] = [
  [196 / 255, 90 / 255, 42 / 255],
  [42 / 255, 34 / 255, 28 / 255],
  [240 / 255, 230 / 255, 212 / 255],
  [107 / 255, 62 / 255, 40 / 255],
  [212 / 255, 165 / 255, 116 / 255],
  [20 / 255, 17 / 255, 14 / 255],
];

/** 面上文字色（原 CSS color） */
const FACE_INK: [number, number, number][] = [
  [246 / 255, 243 / 255, 236 / 255],
  [232 / 255, 220 / 255, 200 / 255],
  [28 / 255, 24 / 255, 20 / 255],
  [246 / 255, 243 / 255, 236 / 255],
  [28 / 255, 24 / 255, 20 / 255],
  [196 / 255, 90 / 255, 42 / 255],
];

const FACE_NORMALS: [number, number, number][] = [
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
];

const FACE_POS: Array<(u: number, v: number, h: number) => [number, number, number]> = [
  (u, v, h) => [(u - 0.5) * 2 * h, (v - 0.5) * 2 * h, h],
  (u, v, h) => [(0.5 - u) * 2 * h, (v - 0.5) * 2 * h, -h],
  (u, v, h) => [h, (v - 0.5) * 2 * h, (0.5 - u) * 2 * h],
  (u, v, h) => [-h, (v - 0.5) * 2 * h, (u - 0.5) * 2 * h],
  (u, v, h) => [(u - 0.5) * 2 * h, h, (0.5 - v) * 2 * h],
  (u, v, h) => [(u - 0.5) * 2 * h, -h, (v - 0.5) * 2 * h],
];

/**
 * 各面转到镜头前（active）时，校正 UV，使文字 u→右、v→上。
 * 背面经 rotX(±180) 会倒立，需旋转 180°（与旧 CSS rotateZ(180) 同理）。
 */
const FACE_UV_ORIENT: Array<(u: number, v: number) => [number, number]> = [
  (u, v) => [u, v], // front TH
  (u, v) => [1 - u, 1 - v], // back RAG
  (u, v) => [u, v], // right SET
  (u, v) => [u, v], // left AI
  (u, v) => [u, v], // top DOCS
  (u, v) => [u, v], // bottom CHAT
];

/** 从 canvas 栅格采样文字 UV（v 向上） */
function sampleLabelUVs(label: string): Array<{ u: number; v: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = TEXT_RES;
  canvas.height = TEXT_RES;
  const c = canvas.getContext("2d");
  if (!c) return [];

  c.clearRect(0, 0, TEXT_RES, TEXT_RES);
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  // 长词略缩小；字体跟品牌 display（Fraunces CSS 变量）
  const size =
    label.length <= 2 ? TEXT_RES * 0.42 : TEXT_RES * (0.5 / Math.sqrt(label.length));
  const family =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-fraunces")
      .trim() || "Georgia, serif";
  c.font = `700 ${size}px ${family}, serif`;
  c.fillText(label, TEXT_RES / 2, TEXT_RES / 2 + size * 0.04);

  const { data } = c.getImageData(0, 0, TEXT_RES, TEXT_RES);
  const pts: Array<{ u: number; v: number }> = [];
  const step = 1;
  for (let y = 0; y < TEXT_RES; y += step) {
    for (let x = 0; x < TEXT_RES; x += step) {
      if (data[(y * TEXT_RES + x) * 4 + 3] > 140) {
        pts.push({
          u: x / (TEXT_RES - 1),
          v: 1 - y / (TEXT_RES - 1),
        });
      }
    }
  }
  return pts;
}

function pushParticle(
  arrays: {
    home: number[];
    free: number[];
    color: number[];
    phase: number[];
    seed: number[];
    normal: number[];
    faceUv: number[];
  },
  opts: {
    u: number;
    v: number;
    face: number;
    rgb: [number, number, number];
    shade?: number;
  },
) {
  const { u, v, face, rgb } = opts;
  const shade = opts.shade ?? 1;
  const [ou, ov] = FACE_UV_ORIENT[face](u, v);
  const posAt = FACE_POS[face];
  const [hx, hy, hz] = posAt(ou, ov, HALF);
  const [fx, fy, fz] = posAt(ou, ov, HALF * EXPAND);
  const [nx, ny, nz] = FACE_NORMALS[face];

  arrays.home.push(hx, hy, hz);
  arrays.free.push(fx, fy, fz);
  arrays.color.push(
    Math.min(1, rgb[0] * shade),
    Math.min(1, rgb[1] * shade),
    Math.min(1, rgb[2] * shade),
  );
  arrays.phase.push(Math.random());
  arrays.seed.push(
    Math.random() * Math.PI * 2,
    0.7 + Math.random() * 1.6,
    face + Math.random(),
  );
  arrays.normal.push(nx, ny, nz);
  arrays.faceUv.push(ou, ov);
}

function buildParticleData(faceLabels: readonly string[] = FACE_LABELS) {
  const arrays = {
    home: [] as number[],
    free: [] as number[],
    color: [] as number[],
    phase: [] as number[],
    seed: [] as number[],
    normal: [] as number[],
    faceUv: [] as number[],
  };

  const labelUVs = faceLabels.map((label) => sampleLabelUVs(label));

  for (let f = 0; f < 6; f++) {
    const base = FACE_COLORS[f];
    const ink = FACE_INK[f];

    // 面填充
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const u = x / (GRID - 1);
        const v = y / (GRID - 1);
        const shade = 0.78 + 0.16 * u + 0.08 * v;
        const lift = (c: number) => Math.min(1, c * shade * 0.9 + 0.12);
        pushParticle(arrays, {
          u,
          v,
          face: f,
          rgb: [lift(base[0]), lift(base[1]), lift(base[2])],
        });
      }
    }

    // 面文字（略亮，压在填充之上观感）
    for (const { u, v } of labelUVs[f]) {
      pushParticle(arrays, {
        u,
        v,
        face: f,
        rgb: ink,
        shade: 1,
      });
    }
  }

  const count = arrays.phase.length;
  return {
    home: new Float32Array(arrays.home),
    free: new Float32Array(arrays.free),
    color: new Float32Array(arrays.color),
    phase: new Float32Array(arrays.phase),
    seed: new Float32Array(arrays.seed),
    normal: new Float32Array(arrays.normal),
    faceUv: new Float32Array(arrays.faceUv),
    count,
  };
}

const vertex = `#version 300 es
in vec3 position;
in vec3 freePos;
in vec3 color;
in float phase;
in vec3 seed;
in vec3 normal;
in vec2 faceUv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uProgress;
uniform float uTime;
uniform float uPointSize;

out vec3 vColor;
out float vAlpha;

void main() {
  float p = clamp(uProgress + phase * 0.12, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  float drift = smoothstep(0.4, 1.0, uProgress);
  float t = uTime;

  // 各面独立随机波动（沿法线），散开态才明显
  float wave =
    sin(t * (1.1 + seed.y * 0.55) + faceUv.x * 9.0 + seed.x) * 0.045 +
    sin(t * (0.7 + seed.y * 0.35) + faceUv.y * 7.5 + phase * 6.2832) * 0.038 +
    sin(t * 1.6 + faceUv.x * 4.0 + faceUv.y * 5.0 + seed.z) * 0.028;
  // 面与面相位差：seed.z 含 face index
  wave += sin(t * 0.9 + seed.z * 2.2) * 0.02;

  vec3 expanded = freePos + normal * (wave * drift);

  vec3 pos = mix(position, expanded, p);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, uPointSize);
  vColor = color;
  vAlpha = mix(0.95, 0.82, p);
}
`;

const fragment = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 fragColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.22, d) * vAlpha;
  fragColor = vec4(vColor, a);
}
`;

type Ctx = {
  renderer: InstanceType<typeof Renderer>;
  camera: InstanceType<typeof Camera>;
  scene: InstanceType<typeof Transform>;
  mesh: InstanceType<typeof Mesh>;
  program: InstanceType<typeof Program>;
  progress: { value: number };
  pose: CubePose;
  /** 散开后额外自转（度） */
  driftSpin: { x: number; y: number; z: number };
  lastT: number;
  tween: gsap.core.Tween | null;
  rotTween: gsap.core.Tween | null;
  spinTween: gsap.core.Tween | null;
  resolveAnim: (() => void) | null;
  resolveRot: (() => void) | null;
  raf: number;
  running: boolean;
  t0: number;
  disposed: boolean;
  startLoop: () => void;
  stopLoop: () => void;
  applyMeshRotation: () => void;
};

/** 放大后的立方体 + 散开膨胀 / 旋转角点仍留在画幅内 */
const VIEW_HEIGHT = 8.2;
const CUBE_SCALE = 2.85;

const CubeParticles = forwardRef<CubeParticlesHandle, Props>(
  function CubeParticles({ className = "", hideRag = false }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const ctxRef = useRef<Ctx | null>(null);
    const pendingPoseRef = useRef<CubePose | null>(null);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const data = buildParticleData(hideRag ? FACE_LABELS_NO_RAG : FACE_LABELS);
      const renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
      const gl = renderer.gl;
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      container.appendChild(canvas);
      gl.clearColor(0, 0, 0, 0);

      const camera = new Camera(gl, { fov: 32, near: 0.1, far: 100 });
      const scene = new Transform();
      const geometry = new Geometry(gl, {
        position: { size: 3, data: data.home },
        freePos: { size: 3, data: data.free },
        color: { size: 3, data: data.color },
        phase: { size: 1, data: data.phase },
        seed: { size: 3, data: data.seed },
        normal: { size: 3, data: data.normal },
        faceUv: { size: 2, data: data.faceUv },
      });

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uPointSize: { value: 2.5 },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        cullFace: false,
      });

      const mesh = new Mesh(gl, {
        geometry,
        program,
        mode: gl.POINTS,
      });
      mesh.frustumCulled = false;
      mesh.rotation.order = "XYZ";
      mesh.scale.set(CUBE_SCALE, CUBE_SCALE, CUBE_SCALE);
      mesh.setParent(scene);

      const progress = { value: 0 };
      const pose: CubePose = { rotateX: 0, rotateY: 0 };
      const driftSpin = { x: 0, y: 0, z: 0 };

      const applyMeshRotation = () => {
        mesh.rotation.x = ((pose.rotateX + driftSpin.x) * Math.PI) / 180;
        mesh.rotation.y = ((pose.rotateY + driftSpin.y) * Math.PI) / 180;
        mesh.rotation.z = (driftSpin.z * Math.PI) / 180;
      };

      const loop = (t: number) => {
        const ctx = ctxRef.current;
        if (!ctx || ctx.disposed || !ctx.running) {
          if (ctx) ctx.raf = 0;
          return;
        }
        const sec = (t - ctx.t0) * 0.001;
        const dt = Math.min(0.05, (t - ctx.lastT) * 0.001);
        ctx.lastT = t;

        (program.uniforms.uTime as { value: number }).value = sec;
        (program.uniforms.uProgress as { value: number }).value =
          progress.value;

        // 散开后持续自转
        if (progress.value > 0.35) {
          const w = (progress.value - 0.35) / 0.65;
          driftSpin.y += dt * 28 * w;
          driftSpin.x += dt * 11 * w;
          driftSpin.z += dt * 7 * w;
          applyMeshRotation();
        }

        camera.updateMatrixWorld();
        scene.updateMatrixWorld();
        renderer.render({ scene, camera });
        ctx.raf = requestAnimationFrame(loop);
      };

      const startLoop = () => {
        const ctx = ctxRef.current;
        if (!ctx || ctx.disposed || ctx.running) return;
        ctx.running = true;
        ctx.lastT = performance.now();
        if (ctx.raf === 0) ctx.raf = requestAnimationFrame(loop);
      };
      const stopLoop = () => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.running = false;
        if (ctx.raf !== 0) {
          cancelAnimationFrame(ctx.raf);
          ctx.raf = 0;
        }
      };

      const ctx: Ctx = {
        renderer,
        camera,
        scene,
        mesh,
        program,
        progress,
        pose,
        driftSpin,
        lastT: performance.now(),
        tween: null,
        rotTween: null,
        spinTween: null,
        resolveAnim: null,
        resolveRot: null,
        raf: 0,
        running: false,
        t0: performance.now(),
        disposed: false,
        startLoop,
        stopLoop,
        applyMeshRotation,
      };
      ctxRef.current = ctx;

      if (pendingPoseRef.current) {
        const p = pendingPoseRef.current;
        pendingPoseRef.current = null;
        pose.rotateX = p.rotateX;
        pose.rotateY = p.rotateY;
        applyMeshRotation();
      }

      const setSize = () => {
        if (ctx.disposed) return;
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        renderer.setSize(w, h);
        const fov = 32;
        const fovRad = (fov * Math.PI) / 180;
        const camZ = VIEW_HEIGHT / 2 / Math.tan(fovRad / 2);
        camera.perspective({ fov, aspect: w / h });
        camera.position.z = camZ;
      };

      const ro = new ResizeObserver(setSize);
      ro.observe(container);
      setSize();

      const onVisibility = () => {
        if (document.hidden) stopLoop();
        else startLoop();
      };
      document.addEventListener("visibilitychange", onVisibility);
      startLoop();

      return () => {
        ctx.disposed = true;
        ctx.tween?.kill();
        ctx.rotTween?.kill();
        ctx.spinTween?.kill();
        ctx.resolveAnim?.();
        ctx.resolveRot?.();
        stopLoop();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        ctxRef.current = null;
        try {
          container.removeChild(canvas);
        } catch {
          /* ignore */
        }
      };
    }, [hideRag]);

    useImperativeHandle(
      ref,
      () => {
        const applyPose = (p: CubePose) => {
          const ctx = ctxRef.current;
          if (!ctx) {
            pendingPoseRef.current = p;
            return;
          }
          ctx.pose.rotateX = p.rotateX;
          ctx.pose.rotateY = p.rotateY;
          ctx.applyMeshRotation();
        };

        const resetSpin = (animate: boolean) => {
          const ctx = ctxRef.current;
          if (!ctx) return Promise.resolve();
          ctx.spinTween?.kill();
          if (!animate) {
            ctx.driftSpin.x = 0;
            ctx.driftSpin.y = 0;
            ctx.driftSpin.z = 0;
            ctx.applyMeshRotation();
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            ctx.spinTween = gsap.to(ctx.driftSpin, {
              x: 0,
              y: 0,
              z: 0,
              duration: 0.45,
              ease: "power2.inOut",
              onUpdate: () => ctx.applyMeshRotation(),
              onComplete: () => {
                ctx.spinTween = null;
                resolve();
              },
            });
          });
        };

        const animateProgress = (to: number, duration: number, ease: string) => {
          const ctx = ctxRef.current;
          if (!ctx) return Promise.resolve();

          ctx.startLoop();
          ctx.tween?.kill();
          ctx.resolveAnim?.();
          ctx.resolveAnim = null;

          const from = ctx.progress.value;
          const dist = Math.abs(to - from);
          if (dist < 0.001) {
            ctx.progress.value = to;
            (ctx.program.uniforms.uProgress as { value: number }).value = to;
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            ctx.resolveAnim = resolve;
            ctx.tween = gsap.to(ctx.progress, {
              value: to,
              duration: duration * dist,
              ease,
              onUpdate: () => {
                (ctx.program.uniforms.uProgress as { value: number }).value =
                  ctx.progress.value;
              },
              onComplete: () => {
                ctx.tween = null;
                ctx.resolveAnim = null;
                resolve();
              },
            });
          });
        };

        return {
          setPose: applyPose,
          rotateTo: (next) => {
            const ctx = ctxRef.current;
            if (!ctx) {
              pendingPoseRef.current = next;
              return Promise.resolve();
            }
            ctx.startLoop();
            ctx.rotTween?.kill();
            ctx.resolveRot?.();
            ctx.resolveRot = null;

            return new Promise<void>((resolve) => {
              ctx.resolveRot = resolve;
              ctx.rotTween = gsap.to(ctx.pose, {
                rotateX: next.rotateX,
                rotateY: next.rotateY,
                duration: 0.55,
                ease: "power2.inOut",
                onUpdate: () => applyPose(ctx.pose),
                onComplete: () => {
                  ctx.rotTween = null;
                  ctx.resolveRot = null;
                  applyPose(next);
                  resolve();
                },
              });
            });
          },
          disperse: () => animateProgress(1, 1.35, "power2.out"),
          assemble: async () => {
            await Promise.all([
              animateProgress(0, 0.55, "power3.inOut"),
              resetSpin(true),
            ]);
          },
        };
      },
      [],
    );

    return (
      <div
        ref={containerRef}
        className={`home-cube-particles-canvas ${className}`.trim()}
        aria-hidden="true"
      />
    );
  },
);

export default CubeParticles;
