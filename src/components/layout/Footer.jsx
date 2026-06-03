import { Lock, Shield } from 'lucide-react';
import { FOOTER_LINKS } from '../../data/siteContent';
import { BrandLogo } from '../shared/BrandLogo';

export function Footer({ onScrollToSection, onOpenDashboard, onOpenAbout, onOpenPrivacy, onOpenTerms }) {
  const handleLink = (id) => {
    if (id === 'about') { onOpenAbout(); return; }
    if (id === 'privacy') { onOpenPrivacy(); return; }
    if (id === 'terms') { onOpenTerms(); return; }
    if (id === 'dashboard') { onOpenDashboard(); return; }
    onScrollToSection(id);
  };

  return (
    <footer className="border-t border-slate-100 bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr] lg:gap-12 lg:px-8">
        <div className="space-y-4">
          <BrandLogo variant="white" alt="Passportsnap" className="h-9 w-auto" />
          <p className="max-w-xs text-sm leading-7 text-slate-400">
            Passport photos from your phone. Clean sizing, guided checks, and privacy-first checkout in minutes.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              We never store your photo after delivery
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              Secured by Stripe - industry-standard payments
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Explore</h3>
          <div className="mt-4 flex flex-col gap-3">
            {FOOTER_LINKS.services.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleLink(link.id)}
                className="text-left text-sm text-slate-400 transition hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Support</h3>
          <div className="mt-4 flex flex-col gap-3">
            {FOOTER_LINKS.support.map((link) => (
              <button
                key={link.id + link.label}
                type="button"
                onClick={() => handleLink(link.id)}
                className="text-left text-sm text-slate-400 transition hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Company</h3>
          <div className="mt-4 flex flex-col gap-3">
            {FOOTER_LINKS.company.map((link) => (
              <button
                key={link.id + link.label}
                type="button"
                onClick={() => handleLink(link.id)}
                className="text-left text-sm text-slate-400 transition hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-slate-600">
            (c) {new Date().getFullYear()} PassportSnap. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <button type="button" onClick={onOpenPrivacy} className="transition hover:text-slate-300">
              Privacy Policy
            </button>
            <button type="button" onClick={onOpenTerms} className="transition hover:text-slate-300">
              Terms of Use
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
