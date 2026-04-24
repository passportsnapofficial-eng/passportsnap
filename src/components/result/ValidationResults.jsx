import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

function getStatusMeta(status) {
  if (status === 'passed') {
    return {
      label: 'Passed',
      badgeClassName: 'bg-emerald-100 text-emerald-700',
      containerClassName: 'border-emerald-100 bg-emerald-50',
      iconClassName: 'bg-white text-emerald-600',
      Icon: CheckCircle2,
    };
  }

  if (status === 'info') {
    return {
      label: 'Info',
      badgeClassName: 'bg-slate-200 text-slate-700',
      containerClassName: 'border-slate-200 bg-slate-50',
      iconClassName: 'bg-white text-slate-600',
      Icon: Info,
    };
  }

  return {
    label: 'Failed',
    badgeClassName: 'bg-red-100 text-red-700',
    containerClassName: 'border-red-100 bg-red-50',
    iconClassName: 'bg-white text-red-600',
    Icon: AlertCircle,
  };
}

function groupChecks(checks) {
  return checks.reduce((groups, check) => {
    const currentGroup = groups.find((group) => group.label === check.group);

    if (currentGroup) {
      currentGroup.checks.push(check);
      return groups;
    }

    groups.push({
      label: check.group,
      checks: [check],
    });

    return groups;
  }, []);
}

export function ValidationResults({ checks }) {
  const groupedChecks = groupChecks(checks);
  const passedCount = checks.filter((check) => check.status === 'passed').length;
  const failedCount = checks.filter((check) => check.status === 'failed').length;
  const infoCount = checks.filter((check) => check.status === 'info').length;
  const recoverableCount = checks.filter((check) => check.status === 'failed' && check.recoverable).length;

  return (
    <div className="surface-card p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Validation results</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Each item below comes from the local MediaPipe and canvas validation pass. Recoverable failures can proceed only with paid editing; other failures need a retake before checkout.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {passedCount} passed
          </span>
          <span className="rounded-full bg-red-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
            {failedCount} failed
          </span>
          {recoverableCount ? (
            <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              {recoverableCount} editor fix
            </span>
          ) : null}
          {infoCount ? (
            <span className="rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              {infoCount} info
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {groupedChecks.map((group) => (
          <section key={group.label}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </div>

            <div className="mt-3 space-y-3">
              {group.checks.map((check) => {
                const meta = check.status === 'failed' && check.recoverable
                  ? {
                      label: 'Editor fix',
                      badgeClassName: 'bg-amber-100 text-amber-700',
                      containerClassName: 'border-amber-100 bg-amber-50',
                      iconClassName: 'bg-white text-amber-600',
                      Icon: AlertCircle,
                    }
                  : getStatusMeta(check.status);
                const Icon = meta.Icon;

                return (
                  <div key={check.key} className={`rounded-[28px] border p-4 ${meta.containerClassName}`}>
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl ${meta.iconClassName}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{check.label}</div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.badgeClassName}`}>
                            {meta.label}
                          </span>
                        </div>

                        {check.noteText ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">{check.noteText}</p>
                        ) : null}

                        {check.helpText && check.status !== 'passed' ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">{check.helpText}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
