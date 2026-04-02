import { useState } from 'react';
import { LayoutDashboard, Menu, ShoppingCart, User, X } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'reviews', label: 'Reviews' },
];

function NavButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

export function Navbar({
  user,
  cartCount,
  currentView,
  onNavigateHome,
  onScrollToSection,
  onOpenCart,
  onOpenDashboard,
  onLogin,
  onLogout,
  onStartFlow,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavAction = (action) => {
    action();
    setMobileOpen(false);
  };

  const isHome = currentView === 'home';

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => handleNavAction(onNavigateHome)}
          className="flex items-center rounded-full px-1 py-1 transition hover:opacity-90"
        >
          <img src="/logo black.png" alt="Home" className="h-9 w-auto sm:h-10" />
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} onClick={() => handleNavAction(() => onScrollToSection(item.id))}>
              {item.label}
            </NavButton>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={() => handleNavAction(onOpenCart)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <User className="h-4 w-4" />
                </span>
                <span>{user.name}</span>
              </button>

              <div className="absolute right-0 mt-3 hidden min-w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10 group-hover:block">
                <button
                  type="button"
                  onClick={() => handleNavAction(onOpenDashboard)}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
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
          ) : (
            <button type="button" onClick={onLogin} className="secondary-button">
              Demo dashboard
            </button>
          )}

          {isHome ? (
            <button type="button" onClick={() => handleNavAction(() => onStartFlow('camera'))} className="primary-button">
              Start photo flow
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => handleNavAction(onOpenCart)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white/95 px-4 pb-6 pt-4 shadow-lg shadow-slate-900/5 lg:hidden">
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavAction(() => onScrollToSection(item.id))}
                className="rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleNavAction(onOpenDashboard)}
              className="rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {user ? 'Dashboard' : 'Open demo dashboard'}
            </button>
            <button
              type="button"
              onClick={() => handleNavAction(() => onStartFlow('camera'))}
              className="primary-button mt-2 justify-center"
            >
              Start photo flow
            </button>
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
                className="secondary-button mt-2 justify-center"
              >
                Demo dashboard
              </button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
