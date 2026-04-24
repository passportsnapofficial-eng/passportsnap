import { HeroSection } from './HeroSection';
import { HowItWorks } from './HowItWorks';
import { TrustStrip } from './TrustStrip';

export function HomeView({ onStartFlow }) {
  return (
    <main className="relative overflow-hidden bg-[linear-gradient(180deg,#020617_0%,#071326_14%,#0d1d35_26%,#1a3452_40%,#395777_54%,#6583a3_66%,#96afc6_76%,#c3d2e2_86%,#e8eff8_94%,#fbfdff_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(56,189,248,0.12),transparent_18%),radial-gradient(circle_at_78%_22%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.015)_38%,rgba(255,255,255,0.05)_56%,rgba(255,255,255,0.1)_72%,rgba(255,255,255,0.18)_100%)]" />
      <HeroSection onStart={() => onStartFlow()} />
      <TrustStrip />
      <HowItWorks />
    </main>
  );
}
