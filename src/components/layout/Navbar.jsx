import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Menu, ShoppingCart, User, X } from 'lucide-react';
import { BrandLogo } from '../shared/BrandLogo';

const NAV_ITEMS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'documents', label: 'Documents' },
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

  const useDarkHeroHeader = isHome && !isScrolled;
  const headerClassName = useDarkHeroHeader
    ? 'border-transparent bg-transparent text-white shadow-none'
    : 'border-transparent bg-white/[0.95] text-slate-950 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl';
  const navWrapClassName = useDarkHeroHeader
    ? 'border-white/10 bg-white/[0.08] backdrop-blur-md'
    : 'border-slate-200 bg-slate-100/90';
  const navItemClassName = useDarkHeroHeader
    ? 'text-white hover:bg-white/10'
    : 'text-slate-700 hover:bg-white hover:text-slate-950';
  const iconButtonClassName = useDarkHeroHeader
    ? 'border-white/16 bg-white/10 text-white backdrop-blur-md hover:border-white/28 hover:bg-white/18'
    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50';
  const profileButtonClassName = useDarkHeroHeader
    ? 'border-white/16 bg-white/10 text-white hover:border-white/28 hover:bg-white/18'
    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50';
  const profileBadgeClassName = useDarkHeroHeader ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700';
  const startButtonClassName = useDarkHeroHeader
    ? 'inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_20px_50px_-28px_rgba(255,255,255,0.7)] transition hover:-translate-y-0.5 hover:bg-slate-100 active:scale-[0.98]'
    : 'inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_50px_-30px_rgba(15,23,42,0.44)] transition hover:-translate-y-0.5 hover:bg-slate-900 active:scale-[0.98]';
  const authButtonClassName = useDarkHeroHeader
    ? 'inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-none transition hover:-translate-y-0.5 hover:border-white/28 hover:bg-white/18 active:scale-[0.98]'
    : 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]';
  const mobilePanelClassName = useDarkHeroHeader
    ? 'border-t border-transparent bg-[linear-gradient(180deg,rgba(6,18,37,0.9)_0%,rgba(9,22,43,0.96)_100%)] text-white backdrop-blur-xl'
    : 'border-t border-slate-200 bg-white/[0.95] text-slate-950 backdrop-blur-xl';
  const mobileItemClassName = useDarkHeroHeader
    ? 'rounded-2xl px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-white/10'
    : 'rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:bg-slate-100';
  const dropdownClassName = useDarkHeroHeader
    ? 'min-w-56 overflow-hidden rounded-3xl border border-white/12 bg-[rgba(10,25,60,0.92)] p-2 text-white shadow-2xl shadow-slate-950/40 backdrop-blur'
    : 'min-w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.42)]';
  const dropdownItemClassName = useDarkHeroHeader
    ? 'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/10'
    : 'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950';

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${headerClassName}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <button
          type="button"
          onClick={() => handleNavAction(onNavigateHome)}
          className="flex items-center rounded-full px-1 py-1 transition duration-300 hover:opacity-90"
        >
          <BrandLogo variant={useDarkHeroHeader ? 'white' : 'black'} alt="Passportsnap" className="h-8 w-auto sm:h-9" />
        </button>

        <nav className={`hidden items-center gap-1 rounded-full border px-2 py-1.5 lg:flex ${navWrapClassName}`}>
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              onClick={() => handleNavAction(() => onScrollToSection(item.id))}
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
            className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition duration-300 ${iconButtonClassName}`}
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/25">
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
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${profileBadgeClassName}`}>
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
                    <LayoutDashboard className={`h-4 w-4 ${useDarkHeroHeader ? 'text-blue-300' : 'text-blue-600'}`} />
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavAction(onLogout)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${useDarkHeroHeader ? 'text-red-200 hover:bg-red-400/10' : 'text-red-600 hover:bg-red-50'}`}
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
            className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition duration-300 ${iconButtonClassName}`}
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                {cartCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition duration-300 ${iconButtonClassName}`}
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
              className={`${startButtonClassName} w-full`}
            >
              Start Photo
            </button>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavAction(() => onScrollToSection(item.id))}
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
                className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${useDarkHeroHeader ? 'text-red-200 hover:bg-red-400/10' : 'text-red-600 hover:bg-red-50'}`}
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
