"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Grainient from "../Grainient";
import { APP_ROUTES } from "@/constants/app.routes";

gsap.registerPlugin(useGSAP, ScrollTrigger, Observer);

const LABELS = ["TH.AGENT", "CHAT", "RAG", "DOCS", "SETTINGS"] as const;

/** 面文案与 active 对齐；左面备用 */
const CUBE_FACES = [
  { className: "home-cube-face-front", label: "TH" },
  { className: "home-cube-face-bottom", label: "CHAT" },
  { className: "home-cube-face-back", label: "RAG" },
  { className: "home-cube-face-top", label: "DOCS" },
  { className: "home-cube-face-right", label: "SET" },
  { className: "home-cube-face-left", label: "AI" },
] as const;

/** 始终保持的斜视倾角：对应面最突出，但不正对镜头 */
const CUBE_TILT = { rotateX: -22, rotateY: -32 };

/** 与 LABELS 下标一一对应：下滑 index+ → rotateX 正向翻面，再叠斜角 */
const CUBE_POSES = [
  { rotateX: 0 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: 90 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: 180 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: 270 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: 360 + CUBE_TILT.rotateX, rotateY: -90 + CUBE_TILT.rotateY },
] as const;

const Home = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<(typeof LABELS)[number]>("TH.AGENT");
  const activeRef = useRef(0);
  const lockedRef = useRef(false);
  const router = useRouter();

  useGSAP(
    (_ctx, contextSafe) => {
      const cube = cubeRef.current;
      // 初始对准 TH.AGENT（正面）
      if (cube) {
        gsap.set(cube, {
          ...CUBE_POSES[0],
          transformPerspective: 900,
        });
      }

      const faceTo = (index: number) => {
        if (!cube) return;
        gsap.to(cube, {
          ...CUBE_POSES[index],
          duration: 0.55,
          ease: "power2.inOut",
          overwrite: "auto",
        });
      };

      // 壳层 overflow 锁死，无原生滚动；用 Observer 吃滚轮/触摸
      const step = (next: number) => {
        if (lockedRef.current) return;
        const clamped = Math.max(0, Math.min(LABELS.length - 1, next));
        if (clamped === activeRef.current) return;
        lockedRef.current = true;
        activeRef.current = clamped;
        setActive(LABELS[clamped]);
        faceTo(clamped);
        gsap.delayedCall(0.55, () => {
          lockedRef.current = false;
        });
      };
      // contextSafe：卸载后回调不再 setState
      const goTo = contextSafe?.(step) ?? step;

      const obs = Observer.create({
        target: rootRef.current,
        type: "wheel,touch",
        wheelSpeed: -1,
        tolerance: 20,
        preventDefault: true,
        onUp: () => {
          let next
          if (activeRef.current === LABELS.length - 1) {
            next = 0
          } else {
            next = activeRef.current + 1
          }
          goTo(next)
        },
        onDown: () => {
          let next
          if (activeRef.current === 0) {
            next = LABELS.length - 1
          } else {
            next = activeRef.current - 1
          }
          goTo(next)
        },
      })

      return () => obs.kill();
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="page-bleed flex flex-col items-start justify-end"
      onClick={() => {
        router.push(APP_ROUTES[active as keyof typeof APP_ROUTES]);
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* 暖纸 / 墨棕 / 赭红，对齐 Editorial Minimal 色板 */}
        <Grainient
          color1="#F6F3EC"
          color2="#1C1814"
          color3="#B0431B"
          timeSpeed={0.25}
          colorBalance={0}
          warpStrength={1}
          warpFrequency={5}
          warpSpeed={2}
          warpAmplitude={50}
          blendAngle={0}
          blendSoftness={0.05}
          rotationAmount={500}
          noiseScale={2}
          grainAmount={0.1}
          grainScale={2}
          grainAnimated={false}
          contrast={1.5}
          gamma={1}
          saturation={1}
          centerX={0}
          centerY={0}
          zoom={0.9}
        />
      </div>

      {/* 右侧正方体：绝对叠层，不参与左侧文案布局 */}
      <div className="home-cube-stage" aria-hidden="true">
        <div ref={cubeRef} className="home-cube">
          {CUBE_FACES.map((face) => (
            <div
              key={face.className}
              className={`home-cube-face ${face.className}`}
            >
              {face.label}
            </div>
          ))}
        </div>
      </div>

      {/* 文案仍按页面内边距对齐，不随背景一起顶边 */}
      <div className="relative flex h-full flex-col justify-end px-6 pb-32 box-border md:px-14">
        {LABELS.map((label) => (
          <div
            key={label}
            className={
              label === active ? "brand-hero brand-hero-active" : "brand-hero"
            }
            aria-current={label === active ? "true" : undefined}
          >
            {label}
          </div>
        ))}
        <div className="brand-hero-accent">My Agent Demo</div>
      </div>
    </div>
  );
};

export default Home;
