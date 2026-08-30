import { createElement } from 'react';
import {
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  Focus,
  Glasses,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  ScanFace,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { RevealOnScroll } from './RevealOnScroll';

const FEATURE_GROUPS = [
  {
    title: 'Capture & formatting',
    description: 'Start with the right document and turn a phone photo into its required format.',
    accent: 'bg-blue-600',
    iconClassName: 'bg-blue-50 text-blue-600',
    items: [
      {
        icon: Globe2,
        title: 'Country and document presets',
        body: 'Choose the passport or visa format first so sizing, aspect ratio, and background rules match the selected authority.',
      },
      {
        icon: Camera,
        title: 'Camera or photo upload',
        body: 'Take a guided selfie on your device or upload an existing portrait from your camera roll.',
      },
      {
        icon: ImageIcon,
        title: 'Smart crop and framing',
        body: 'Position, scale, and crop the portrait while preserving the document’s exact proportions.',
      },
      {
        icon: Focus,
        title: 'Guided composition preview',
        body: 'Use the on-screen head guide and preview controls to keep the face and shoulders positioned naturally before processing.',
      },
      {
        icon: Upload,
        title: 'Policy-aware background handling',
        body: 'Background cleanup is applied only when the selected document permits it; unaltered-photo rules stay protected.',
      },
    ],
  },
  {
    title: 'AI & automated detection',
    description: 'Machine-learning signals and image analysis check the details most likely to cause rejection.',
    accent: 'bg-violet-600',
    iconClassName: 'bg-violet-50 text-violet-600',
    items: [
      {
        icon: Sparkles,
        title: 'AI-assisted photo analysis',
        body: 'Face landmarks and subject segmentation guide the crop, background analysis, and optional detail enhancement.',
      },
      {
        icon: ScanFace,
        title: 'Face, pose, and head position',
        body: 'Checks face count, centering, forward gaze, head angle, head size, visible chin, forehead, and both sides of the face.',
      },
      {
        icon: Eye,
        title: 'Eyes and expression',
        body: 'Reviews open and level eyes, feature visibility, mouth position, and neutral-expression signals.',
      },
      {
        icon: Glasses,
        title: 'Glasses, hat, and hijab detection',
        body: 'Flags eyewear and hats while treating hijabs and religious head coverings separately when the full face remains visible.',
      },
      {
        icon: Sun,
        title: 'Quality, lighting, and compliance',
        body: 'Checks sharpness, resolution, exposure, shadows, background tone and distractions, final dimensions, aspect ratio, and document rules.',
      },
    ],
  },
  {
    title: 'Output & delivery',
    description: 'Review the result, choose what you need, and keep access to the finished photo.',
    accent: 'bg-emerald-600',
    iconClassName: 'bg-emerald-50 text-emerald-600',
    items: [
      {
        icon: Download,
        title: '600 DPI, watermark-free JPG',
        body: 'Receive a high-resolution JPEG with embedded 600 DPI metadata and the correct document aspect ratio.',
      },
      {
        icon: CheckCircle2,
        title: 'Clear review and retake guidance',
        body: 'See what passed, what needs attention, and practical instructions for a stronger retake when required.',
      },
      {
        icon: FileCheck2,
        title: 'Digital and print options',
        body: 'Choose a digital photo, print packages, compliance review, or available retouching services.',
      },
      {
        icon: CreditCard,
        title: 'Secure checkout',
        body: 'Complete payment through the guided checkout before downloads and order delivery are released.',
      },
      {
        icon: LayoutDashboard,
        title: 'Downloads and order history',
        body: 'Access completed orders from your account dashboard and download the finished photo again when available.',
      },
    ],
  },
];

function FeatureGroup({ group }) {
  return (
    <article className="surface-card h-full overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_80px_-54px_rgba(15,23,42,0.4)]">
      <div className={`h-1.5 w-full ${group.accent}`} />
      <div className="p-5 sm:p-6">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">{group.title}</h3>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{group.description}</p>

        <div className="mt-5 space-y-3">
          {group.items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${group.iconClassName}`}>
                  {createElement(item.icon, { className: 'h-5 w-5', 'aria-hidden': true })}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function FeatureCardsSection({ onStart }) {
  return (
    <section id="features" className="scroll-mt-24 bg-slate-50/70 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <RevealOnScroll className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Everything in one flow</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Every feature working toward one compliant photo
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            PassportSnap combines guided capture, AI-assisted image analysis, automated
            passport checks, high-resolution formatting, and secure delivery. The checks
            provide practical guidance but do not replace an authority’s final decision.
          </p>
        </RevealOnScroll>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {FEATURE_GROUPS.map((group, index) => (
            <RevealOnScroll key={group.title} delay={index * 80} className="h-full">
              <FeatureGroup group={group} />
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll delay={160} className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[28px] bg-slate-950 px-6 py-6 text-center shadow-xl sm:flex-row sm:text-left">
          <div>
            <div className="text-lg font-semibold text-white">Ready to check your photo?</div>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              Choose a document, take a selfie or upload a portrait, and follow the guided review.
            </p>
          </div>
          <button type="button" onClick={onStart} className="primary-button min-w-44 justify-center">
            <Camera className="h-4 w-4" />
            Start photo
          </button>
        </RevealOnScroll>
      </div>
    </section>
  );
}
