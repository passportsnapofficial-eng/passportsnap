import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Menu, ShoppingCart, User, X } from 'lucide-react';
import { BrandLogo } from '../shared/BrandLogo';

const NAV_ITEMS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'documents', label: 'Documents' },
  { id: 'comparison', label: 'Pricing' },
  { id: 'about', label: 'About', type: 'page' },
  { id: 'selfie-guide', label: 'Support' },
];

function NavButton({ children, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${className}`}
    >
      {children}
    </button>
  );
}

export function Navbar({
  isHome = false,
  user,
  cartCount,
  onNavigateHome,
  onStartFlow,
  onScrollToSection,
  onOpenAbout,
  onOpenCart,
  onOpenDashboard,
  onLogin,
  onLogout,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 24);
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScrollState);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNavAction = (action) => {
    action();
    setMobileOpen(false);
    setIsUserMenuOpen(false);
  };

  const headerClassName = isScrolled || !isHome
    ? 'border-slate-200/80 bg-white/95 text-slate-950 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl'
    : 'border-transparent bg-white/80 text-slate-950 backdrop-blur-sm';

  const navWrapClassName = 'border-slate-200 bg-slate-100/80';
  const navItemClassName = 'text-slate-600 hover:bg-white hover:text-slate-950';
  const iconButtonClassName = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50';
  const profileButtonClassName = 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50';
  const profileBadgeClassName = 'bg-slate-100 text-slate-700';
  const startButtonClassName = 'inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)] transition hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98]';
  const authButtonClassName = 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.1)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]';
  const mobilePanelClassName = 'border-t border-slate-200 bg-white/98 text-slate-950 backdrop-blur-xl';
  const mobileItemClassName = 'rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900';
  const dropdownClassName = 'min-w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.24)]';
  const dropdownItemClassName = 'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950';

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${headerClassName}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <button
          type="button"
          onClick={() => handleNavAction(onNavigateHome)}
          className="flex items-center rounded-full px-1 py-1 transition duration-300 hover:opacity-90"
        >
          <BrandLogo variant="black" alt="Passportsnap" className="h-8 w-auto sm:h-9" />
        </button>

        <nav className={`hidden items-center gap-1 rounded-full border px-2 py-1.5 lg:flex ${navWrapClassName}`}>
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              onClick={() => handleNavAction(() => (item.type === 'page' ? onOpenAbout() : onScrollToSection(item.id)))}
              className={navItemClassName}
            >
              {item.label}
            </NavButton>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={() => handleNavAction(onStartFlow)}
            className={startButtonClassName}
          >
            Start Photo
          </button>

          <button
            type="button"
            onClick={() => handleNavAction(onOpenCart)}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition duration-300 ${iconButtonClassName}`}
            aria-label="Open cart"
          >
            <ShoppingCart className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem]" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white shadow-md">
                {cartCount}
              </span>
            ) : null}
          </button>

          {user ? (
            <div
              ref={userMenuRef}
              className="relative"
              onMouseEnter={() => setIsUserMenuOpen(true)}
              onMouseLeave={() => setIsUserMenuOpen(false)}
              onFocus={() => setIsUserMenuOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsUserMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className={`inline-flex max-w-[16rem] items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition duration-300 ${profileButtonClassName}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${profileBadgeClassName}`}>
                  <User className="h-4 w-4" />
                </span>
                <span className="truncate">{user.name}</span>
              </button>

              <div className={`absolute right-0 top-full z-20 pt-3 ${isUserMenuOpen ? 'block' : 'hidden'}`}>
                <div className={dropdownClassName}>
                  <button
                    type="button"
                    onClick={() => handleNavAction(onOpenDashboard)}
                    className={dropdownItemClassName}
                  >
                    <LayoutDashboard className="h-4 w-4 text-blue-600" />
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavAction(onLogout)}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={onLogin} className={authButtonClassName}>
              Sign in
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => handleNavAction(onOpenCart)}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition duration-300 ${iconButtonClassName}`}
            aria-label="Open cart"
          >
            <ShoppingCart className="h-[1.125rem] w-[1.125rem]" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                {cartCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition duration-300 ${iconButtonClassName}`}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className={`animate-fade-up px-4 pb-5 pt-3 lg:hidden ${mobilePanelClassName}`}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleNavAction(onStartFlow)}
              className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white"
            >
              Start Photo
            </button>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavAction(() => (item.type === 'page' ? onOpenAbout() : onScrollToSection(item.id)))}
                className={mobileItemClassName}
              >
                {item.label}
              </button>
            ))}
            {user ? (
              <button
                type="button"
                onClick={() => handleNavAction(onOpenDashboard)}
                className={mobileItemClassName}
              >
                Dashboard
              </button>
            ) : null}
            {user ? (
              <button
                type="button"
                onClick={() => handleNavAction(onLogout)}
                className="rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNavAction(onLogin)}
                className={`${authButtonClassName} mt-2 justify-center`}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
