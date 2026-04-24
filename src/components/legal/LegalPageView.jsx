export function LegalPageView({ eyebrow, title, description, sections, onBackHome }) {
  return (
    <div className="page-shell py-10 sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white sm:px-8">
            <div className="text-sm uppercase tracking-[0.22em] text-blue-200">{eyebrow}</div>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{description}</p>
          </div>

          <div className="px-6 py-8 sm:px-8">
            <div className="space-y-6">
              {sections.map((section) => (
                <section key={section.title} className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
                </section>
              ))}
            </div>

            <div className="mt-8">
              <button type="button" onClick={onBackHome} className="secondary-button">
                Back to home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
