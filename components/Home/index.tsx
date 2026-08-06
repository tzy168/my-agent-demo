"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Grainient from "../Grainient";
import CubeParticles, {
  type CubeParticlesHandle,
} from "./CubeParticles";
import { APP_ROUTES } from "@/constants/app.routes";
import { SETTINGS_EVENT, readSettings } from "@/lib/settings";
import type { LlmProvider } from "@/types/settings";

gsap.registerPlugin(useGSAP, ScrollTrigger, Observer);

/** 与立方体翻面顺序对应；DeepSeek 时去掉 RAG */
const HOME_ITEMS = [
  { label: "TH.AGENT", href: APP_ROUTES.HOME, poseIdx: 0 },
  { label: "CHAT", href: APP_ROUTES.CHAT, poseIdx: 1 },
  { label: "RAG", href: APP_ROUTES.RAG, poseIdx: 2 },
  { label: "DOCS", href: APP_ROUTES.DOCS, poseIdx: 3 },
  { label: "SETTINGS", href: APP_ROUTES.SETTINGS, poseIdx: 4 },
] as const;

/** 始终保持的斜视倾角：对应面最突出，但不正对镜头 */
const CUBE_TILT = { rotateX: -22, rotateY: -32 };

/**
 * WebGL 右手系姿态（与旧 CSS 立方体符号相反）：
 * rotateX 负向翻面 → 底 / 背 / 顶依次转到镜头前，文字才能正向。
 * 下标与 HOME_ITEMS.poseIdx 对齐（含 RAG 位）。
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
  const [provider, setProvider] = useState<LlmProvider>("ollama");
  // DeepSeek 模式首页不展示 RAG 入口
  const items =
    provider === "deepseek"
      ? HOME_ITEMS.filter((i) => i.label !== "RAG")
      : HOME_ITEMS;
  const [active, setActive] = useState<(typeof HOME_ITEMS)[number]["label"]>(
    "TH.AGENT",
  );
  const activeRef = useRef(0);
  const lockedRef = useRef(false);
  const modeRef = useRef<CubeMode>("solid");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const sync = () => setProvider(readSettings().provider);
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // provider 切换后重置到第一面，避免索引越界
  useEffect(() => {
    activeRef.current = 0;
    setActive(items[0]?.label ?? "TH.AGENT");
    particlesRef.current?.setPose(CUBE_POSES[items[0]?.poseIdx ?? 0]);
  }, [provider]);

  useGSAP(
    (_ctx, contextSafe) => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // 初始对准当前第一项（WebGL 未就绪时会进 pendingPose）
      particlesRef.current?.setPose(CUBE_POSES[items[0]?.poseIdx ?? 0]);
      activeRef.current = 0;

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
        const poseIdx = items[activeRef.current]?.poseIdx ?? 0;
        particles.setPose(CUBE_POSES[poseIdx]);
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
        const clamped = Math.max(0, Math.min(items.length - 1, next));
        if (clamped === activeRef.current) return;
        const particles = particlesRef.current;
        if (!particles) return;

        lockedRef.current = true;
        activeRef.current = clamped;
        setActive(items[clamped].label);
        clearIdle();
        void particles.rotateTo(CUBE_POSES[items[clamped].poseIdx]).then(() => {
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
            activeRef.current === items.length - 1
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
              ? items.length - 1
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
    { scope: rootRef, dependencies: [provider] },
  );

  return (
    <div
      ref={rootRef}
      className="page-bleed flex flex-col items-start justify-end"
      onClick={() => {
        const href = items[activeRef.current]?.href;
        if (href) router.push(href);
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

      {/* 全舞台粒子立方体（实心/散开同一套）；key 保证切 provider 时重建面文字 */}
      <div className="home-cube-stage" aria-hidden="true">
        <CubeParticles
          key={provider}
          ref={particlesRef}
          hideRag={provider === "deepseek"}
        />
      </div>

      <div className="home-copy">
        {items.map((item) => (
          <div
            key={item.label}
            className={
              item.label === active
                ? "brand-hero brand-hero-active"
                : "brand-hero"
            }
            aria-current={item.label === active ? "true" : undefined}
          >
            {item.label}
          </div>
        ))}
        <div className="brand-hero-accent">My Agent Demo</div>
      </div>
    </div>
  );
};

export default Home;
