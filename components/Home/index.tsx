import Grainient from "../Grainient";

const Home = () => {
  return (
    // page-bleed：绝对铺满 page-content（含左右 padding 区域），避免右侧露底
    <div className="page-bleed flex flex-col items-start justify-end">
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
      {/* 文案仍按页面内边距对齐，不随背景一起顶边 */}
      <div className="relative flex flex-col h-full justify-end pb-32 px-6 md:px-14 box-border">
        <div className="brand-hero">TH.AGENT</div>
        <div className="brand-hero-accent">My Agent Demo.</div>
      </div>
    </div>
  );
};

export default Home;
