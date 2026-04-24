import { LoaderCircle, Save, UserRound } from 'lucide-react';

export function ProfileCard({ user, saving, statusMessage, errorMessage, onSubmit }) {
  return (
    <section className="surface-card p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <div className="text-lg font-semibold text-slate-900">Profile details</div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Update the account information used for checkout receipts and the saved dashboard
            profile.
          </p>
        </div>
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

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          name="fullName"
          defaultValue={user?.name || ''}
          required
          className="input-shell sm:col-span-2"
          placeholder="Full name"
        />
        <input
          type="email"
          name="email"
          value={user?.email || ''}
          readOnly
          className="input-shell bg-slate-50 text-slate-500"
          placeholder="Email address"
        />
        <input
          type="text"
          name="phone"
          defaultValue={user?.phone || ''}
          className="input-shell"
          placeholder="Phone number"
        />

        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="primary-button justify-center">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
        </div>
      </form>
    </section>
  );
}
