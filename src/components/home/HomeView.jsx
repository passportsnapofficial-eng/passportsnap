import { DOCUMENT_TYPES } from '../../data/documentTypes';
import { HeroSection } from './HeroSection';
import { HowItWorks } from './HowItWorks';
import { ProcessPreviewSection } from './ProcessPreviewSection';
import { ServicesGrid } from './ServicesGrid';
import { Testimonials } from './Testimonials';
import { TrustBar } from './TrustBar';

export function HomeView({ onStartFlow }) {
  return (
    <>
      <HeroSection
        onStartCamera={() => onStartFlow('camera')}
        onStartUpload={() => onStartFlow('upload')}
      />
      <TrustBar />
      <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_26%,#ffffff_100%)]">
        <ServicesGrid documents={DOCUMENT_TYPES} onStartFlow={onStartFlow} />
        <HowItWorks />
        <ProcessPreviewSection />
        <Testimonials />
      </div>
    </>
  );
}
