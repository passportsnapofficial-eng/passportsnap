import { useState } from 'react';
import { Camera, Check, ChevronDown, Upload } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { VIEWS } from '../../lib/utils/constants';
import { FlagMark } from '../shared/FlagMark';
import { FlowShell } from './FlowShell';

function CountryDropdown({ documents, selectedDocument, onSelectDocument }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="surface-card flex w-full items-center gap-3 p-4 text-left"
      >
        <FlagMark src={selectedDocument.flagPath} label={selectedDocument.countryLabel} size="md" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document</div>
          <div className="truncate text-base font-semibold text-slate-950">{selectedDocument.name}</div>
          <div className="truncate text-sm text-slate-500">{selectedDocument.countryLabel}</div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900">
          {formatCurrency(selectedDocument.price)}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_64px_-40px_rgba(15,23,42,0.35)]">
          <div className="max-h-[22rem] overflow-y-auto p-2">
            {documents.map((document) => {
              const selected = document.id === selectedDocument.id;

              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => {
                    onSelectDocument(document.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition ${
                    selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <FlagMark src={document.flagPath} label={document.countryLabel} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-950">{document.name}</div>
                    <div className="truncate text-xs text-slate-500">{document.countryLabel}</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{formatCurrency(document.price)}</div>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DocumentSelectionView({
  documents,
  selectedDocument,
  onSelectDocument,
  onStartCapture,
  onBackHome,
}) {
  return (
    <FlowShell
      currentView={VIEWS.document}
      title="Choose your document"
      description="Pick the country you need, then take a selfie or upload a photo. We handle the sizing, crop, background, and passport rules automatically."
      onBack={onBackHome}
      backLabel="Back to home"
      chip="Step 1 of 4"
      compactHeader
      summaryItems={[
        { label: 'Selected', value: selectedDocument.countryLabel },
        { label: 'Format', value: selectedDocument.officialSizeLabel },
      ]}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <CountryDropdown
          documents={documents}
          selectedDocument={selectedDocument}
          onSelectDocument={onSelectDocument}
        />

        <div className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <FlagMark src={selectedDocument.flagPath} label={selectedDocument.countryLabel} size="md" />
              <div className="min-w-0">
                <div className="text-xl font-semibold text-slate-950">{selectedDocument.name}</div>
                <div className="mt-1 text-sm text-slate-500">{selectedDocument.countryLabel}</div>
                <div className="mt-2 text-sm text-slate-600">{selectedDocument.requirementSummary}</div>
              </div>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">
              {formatCurrency(selectedDocument.price)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onStartCapture(selectedDocument.id, 'camera')}
              className="primary-button w-full justify-center"
            >
              <Camera className="h-4 w-4" />
              Take Selfie
            </button>
            <button
              type="button"
              onClick={() => onStartCapture(selectedDocument.id, 'upload')}
              className="secondary-button w-full justify-center"
            >
              <Upload className="h-4 w-4" />
              Upload Photo
            </button>
          </div>
        </div>
      </div>
    </FlowShell>
  );
}
