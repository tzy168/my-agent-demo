"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Grainient from "../Grainient";
import CubeParticles, {
  type CubeParticlesHandle,
} from "./CubeParticles";
import { APP_ROUTES } from "@/constants/app.routes";

gsap.registerPlugin(useGSAP, ScrollTrigger, Observer);

const LABELS = ["TH.AGENT", "CHAT", "RAG", "DOCS", "SETTINGS"] as const;

/** 与 LABELS 下标一一对应；不能直接用 label 当 APP_ROUTES key（TH.AGENT ≠ HOME） */
const LABEL_HREFS = [
  APP_ROUTES.HOME,
  APP_ROUTES.CHAT,
  APP_ROUTES.RAG,
  APP_ROUTES.DOCS,
  APP_ROUTES.SETTINGS,
] as const;

/** 始终保持的斜视倾角：对应面最突出，但不正对镜头 */
const CUBE_TILT = { rotateX: -22, rotateY: -32 };

/**
 * WebGL 右手系姿态（与旧 CSS 立方体符号相反）：
 * rotateX 负向翻面 → 底 / 背 / 顶依次转到镜头前，文字才能正向。
 */
const CUBE_POSES = [
  { rotateX: 0 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: -90 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: -180 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: -270 + CUBE_TILT.rotateX, rotateY: 0 + CUBE_TILT.rotateY },
  { rotateX: -360 + CUBE_TILT.rotateX, rotateY: -90 + CUBE_TILT.rotateY },
] as const;

const IDLE_MS = 5000;

type CubeMode = "solid" | "dispersing" | "drift" | "assembling";

const Home = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<CubeParticlesHandle>(null);
  const [active, setActive] = useState<(typeof LABELS)[number]>("TH.AGENT");
  const activeRef = useRef(0);
  const lockedRef = useRef(false);
  const modeRef = useRef<CubeMode>("solid");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useGSAP(
    (_ctx, contextSafe) => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // 初始对准 TH.AGENT（WebGL 未就绪时会进 pendingPose）
      particlesRef.current?.setPose(CUBE_POSES[0]);

      const clearIdle = () => {
        if (idleTimerRef.current !== null) {
          clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
      };

      let armIdle: () => void;

      const disperse = async () => {
        if (modeRef.current !== "solid" || lockedRef.current) {
          if (modeRef.current === "solid") armIdle();
          return;
        }
        const particles = particlesRef.current;
        if (!particles) return;

        modeRef.current = "dispersing";
        clearIdle();
        await particles.disperse();
        if (modeRef.current === "dispersing") {
          modeRef.current = "drift";
        }
      };

      const assemble = async () => {
        if (
          modeRef.current === "solid" ||
          modeRef.current === "assembling"
        ) {
          return;
        }
        const particles = particlesRef.current;
        if (!particles) return;

        modeRef.current = "assembling";
        await particles.assemble();
        // 聚回当前 active 姿态（散开期间未翻面）
        particles.setPose(CUBE_POSES[activeRef.current]);
        modeRef.current = "solid";
        armIdle();
      };

      armIdle = () => {
        clearIdle();
        if (reduceMotion) return;
        idleTimerRef.current = setTimeout(() => {
          idleTimerRef.current = null;
          void disperseSafe();
        }, IDLE_MS);
      };

      const step = (next: number) => {
        if (lockedRef.current) return;
        const clamped = Math.max(0, Math.min(LABELS.length - 1, next));
        if (clamped === activeRef.current) return;
        const particles = particlesRef.current;
        if (!particles) return;

        lockedRef.current = true;
        activeRef.current = clamped;
        setActive(LABELS[clamped]);
        clearIdle();
        void particles.rotateTo(CUBE_POSES[clamped]).then(() => {
          lockedRef.current = false;
          armIdle();
        });
      };

      const goTo = contextSafe?.(step) ?? step;
      const assembleSafe = contextSafe?.(assemble) ?? assemble;
      const disperseSafe = contextSafe?.(disperse) ?? disperse;

      const obs = Observer.create({
        target: rootRef.current,
        type: "wheel,touch",
        wheelSpeed: -1,
        tolerance: 20,
        preventDefault: true,
        onUp: () => {
          if (modeRef.current !== "solid") {
            void assembleSafe();
            return;
          }
          const next =
            activeRef.current === LABELS.length - 1
              ? 0
              : activeRef.current + 1;
          goTo(next);
        },
        onDown: () => {
          if (modeRef.current !== "solid") {
            void assembleSafe();
            return;
          }
          const next =
            activeRef.current === 0
              ? LABELS.length - 1
              : activeRef.current - 1;
          goTo(next);
        },
      });

      armIdle();

      return () => {
        clearIdle();
        obs.kill();
      };
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="page-bleed flex flex-col items-start justify-end"
      onClick={() => {
        router.push(LABEL_HREFS[activeRef.current]);
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
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

      {/* 全舞台粒子立方体（实心/散开同一套） */}
      <div className="home-cube-stage" aria-hidden="true">
        <CubeParticles ref={particlesRef} />
      </div>

      <div className="home-copy">
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
