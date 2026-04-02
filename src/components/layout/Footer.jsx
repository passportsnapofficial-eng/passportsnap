import { FOOTER_LINKS } from '../../data/siteContent';

export function Footer({ onScrollToSection, onStartFlow, onOpenDashboard, onOpenAdmin }) {
  return (
    <footer className="border-t border-white/10 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr] lg:px-8">
        <div className="space-y-5">
          <img src="/logo white.png" alt="Logo" className="h-10 w-auto" />
          <p className="max-w-md text-sm leading-7 text-slate-400">
            A guided automated passport-photo flow with dedicated capture, processing, result,
            checkout, and download steps. Every document type listed on the site can move through
            the same active workflow.
          </p>
          <button type="button" onClick={() => onStartFlow('camera')} className="primary-button">
            Start photo flow
          </button>
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
              Orders dashboard
            </button>
            {onOpenAdmin ? (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="text-left text-sm text-slate-400 transition hover:text-white"
              >
                Admin demo
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => window.alert('Privacy details will land with the backend release.')}
              className="text-left text-sm text-slate-400 transition hover:text-white"
            >
              Privacy notice
            </button>
            <button
              type="button"
              onClick={() => window.alert('Terms will land with the backend release.')}
              className="text-left text-sm text-slate-400 transition hover:text-white"
            >
              Terms of use
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
