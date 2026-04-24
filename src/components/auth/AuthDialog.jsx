import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, LockKeyhole, Mail, UserRound, X } from 'lucide-react';

function AuthModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-slate-950 bg-slate-950 text-white ring-4 ring-slate-200 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]'
          : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
      }`}
    >
      {active ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /> : null}
      {children}
    </button>
  );
}

export function AuthDialog({
  open,
  mode = 'signin',
  onModeChange,
  loading,
  errorMessage,
  statusMessage,
  configured,
  onClose,
  onSubmit,
}) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef(null);

  const handleCloseRequest = useCallback(() => {
    if (loading) return;
    if (isClosing) return;

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [isClosing, loading, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleCloseRequest();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleCloseRequest, open]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
  }, []);

  if (!open && !isClosing) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
      fullName: String(formData.get('fullName') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      confirmPassword: String(formData.get('confirmPassword') || ''),
    };

    if (mode === 'signup' && payload.password !== payload.confirmPassword) {
      await onSubmit(mode, null, 'Passwords do not match.');
      return;
    }

    await onSubmit(mode, payload);
  };

  const visible = open && !isClosing;
  const isSignup = mode === 'signup';

  return (
    <div
      className={`fixed inset-0 z-[70] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-md transition-opacity duration-200 sm:flex sm:items-center sm:justify-center sm:p-4 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleCloseRequest();
        }
      }}
    >
      <div
        className={`surface-card relative my-2 w-full overflow-hidden border-slate-200 bg-white transition-all duration-200 sm:my-2 ${
          isSignup ? 'max-w-5xl sm:max-h-[calc(100vh-1rem)]' : 'max-w-lg'
        } ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.985] opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={handleCloseRequest}
          disabled={loading}
          className="icon-button absolute right-5 top-5 z-10 h-10 w-10"
          aria-label="Close sign in dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className={isSignup ? 'lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]' : ''}>
          <div
            className={`relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_42%),linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] px-6 py-6 sm:px-7 md:px-8 ${
              isSignup ? 'border-b border-slate-200 lg:border-b-0 lg:border-r lg:py-8' : 'border-b border-slate-200'
            }`}
          >
            <div className="eyebrow">Account access</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Save orders to a real account
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">
              Create an account or sign in to keep your dashboard, order history, and profile
              details available across devices.
            </p>

            {isSignup ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[24px] border border-slate-200 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-700">
                  Track every order in one dashboard without losing your selected document setup.
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-700">
                  Confirm your email once, then return to checkout and downloads without friction.
                </div>
              </div>
            ) : null}
          </div>

          <div className={`px-6 py-6 sm:px-7 md:px-8 ${isSignup ? 'lg:overflow-y-auto lg:py-8' : ''}`}>
            {!configured ? (
              <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                Account access is unavailable right now. Please try again later.
              </div>
            ) : null}

            <div className={`${configured ? '' : 'mt-5'} inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)]`}>
              <AuthModeButton active={mode === 'signin'} onClick={() => onModeChange('signin')}>
                Sign in
              </AuthModeButton>
              <AuthModeButton active={mode === 'signup'} onClick={() => onModeChange('signup')}>
                Create account
              </AuthModeButton>
            </div>

            {statusMessage ? (
              <div className="mt-5 rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
                {statusMessage}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-5 rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">
                {errorMessage}
              </div>
            ) : null}

            <form
              onSubmit={handleSubmit}
              className={`mt-6 ${isSignup ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}`}
            >
              {mode === 'signup' ? (
                <>
                  <label className="block">
                    <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <UserRound className="h-4 w-4 text-blue-600" />
                      Full name
                    </span>
                    <input
                      type="text"
                      name="fullName"
                      required
                      className="input-shell"
                      placeholder="Jordan Miles"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <UserRound className="h-4 w-4 text-blue-600" />
                      Phone
                    </span>
                    <input
                      type="text"
                      name="phone"
                      className="input-shell"
                      placeholder="+1 (555) 123-4567"
                    />
                  </label>
                </>
              ) : null}

              <label className={`block ${isSignup ? 'md:col-span-2' : ''}`}>
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Email
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  className="input-shell"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <LockKeyhole className="h-4 w-4 text-blue-600" />
                  Password
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  className="input-shell"
                  placeholder="At least 8 characters"
                />
              </label>

              {mode === 'signup' ? (
                <label className="block">
                  <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <LockKeyhole className="h-4 w-4 text-blue-600" />
                    Confirm password
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    minLength={8}
                    className="input-shell"
                    placeholder="Repeat password"
                  />
                </label>
              ) : null}

              <button
                type="submit"
                disabled={!configured || loading}
                className={`primary-button mt-2 w-full justify-center py-4 text-base ${isSignup ? 'md:col-span-2' : ''}`}
              >
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
                {mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
