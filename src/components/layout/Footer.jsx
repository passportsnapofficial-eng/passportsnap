import { FOOTER_LINKS } from '../../data/siteContent';
import { BrandLogo } from '../shared/BrandLogo';

export function Footer({ onScrollToSection, onOpenDashboard, onOpenPrivacy, onOpenTerms }) {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-slate-950 text-slate-300">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:gap-12 lg:px-8">
        <div className="space-y-4">
          <BrandLogo variant="white" alt="Passportsnap" className="h-10 w-auto" />
          <p className="max-w-md text-sm leading-7 text-slate-400">
            PassportSnap keeps passport-photo creation clear from document selection through download,
            with one simple flow and no manual editing detours.
          </p>
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
            Responsive photo workflow
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Explore</h3>
          <div className="mt-4 flex flex-col gap-3">
            {FOOTER_LINKS.services.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onScrollToSection(link.id)}
                className="text-left text-sm text-slate-400 transition hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Product</h3>
          <div className="mt-4 flex flex-col gap-3">
            {FOOTER_LINKS.product.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onScrollToSection(link.id)}
                className="text-left text-sm text-slate-400 transition hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Account</h3>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={onOpenDashboard}
              className="text-left text-sm text-slate-400 transition hover:text-white"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="text-left text-sm text-slate-400 transition hover:text-white"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={onOpenTerms}
              className="text-left text-sm text-slate-400 transition hover:text-white"
            >
              Terms of Use
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
