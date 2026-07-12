import Grainient from "../Grainient";

const Home = () => {
  return (
    <div className="page-center relative overflow-hidden flex flex-col items-start justify-end">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Grainient
          color1="#ffffff"
          color2="#000000"
          color3="#94a3b8"
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
      <div className="relative z-10 flex flex-col h-full justify-end pb-32">
        <div className="brand-hero">TH.AGENT</div>
        <div className="brand-hero">My Agent Demo.</div>
      </div>
    </div>
  );
};

export default Home;
