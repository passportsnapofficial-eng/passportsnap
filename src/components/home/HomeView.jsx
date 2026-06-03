import { ComparisonSection } from './ComparisonSection';
import { DocumentPreviewSection } from './DocumentPreviewSection';
import { FinalCTA } from './FinalCTA';
import { HeroSection } from './HeroSection';
import { HowItWorks } from './HowItWorks';
import { SelfieGuide } from './SelfieGuide';
import { TrustStrip } from './TrustStrip';

export function HomeView({ onStartFlow }) {
  return (
    <main className="overflow-x-hidden bg-white">
      <HeroSection
        onStart={(mode) => onStartFlow(mode)}
        onUpload={() => onStartFlow('upload')}
      />
      <TrustStrip />
      <DocumentPreviewSection />
      <HowItWorks />
      <SelfieGuide onStart={() => onStartFlow('camera')} />
      <ComparisonSection />
      <FinalCTA onStart={() => onStartFlow('camera')} />
    </main>
  );
}
