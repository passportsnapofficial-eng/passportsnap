import { Camera, Upload } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { VIEWS } from '../../lib/utils/constants';
import { FlagMark } from '../shared/FlagMark';
import { FlowShell } from './FlowShell';

function DocumentCard({ document, selected, onSelect, onStartCapture }) {
  return (
    <div
      className={`surface-card p-5 transition ${selected ? 'ring-2 ring-blue-200' : ''}`}
    >
      <button type="button" onClick={() => onSelect(document.id)} className="w-full text-left">
        <div className="flex items-center gap-3">
          <FlagMark src={document.flagPath} label={document.countryLabel} size="md" />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-950">{document.countryLabel}</div>
          <div className="text-sm text-slate-500">{document.name}</div>
        </div>
        <div className="ml-auto rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
          {formatCurrency(document.price)}
        </div>
      </div>
      </button>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onStartCapture(document.id, 'camera')}
          className="primary-button w-full justify-center"
        >
          <Camera className="h-4 w-4" />
          Take Selfie
        </button>
        <button
          type="button"
          onClick={() => onStartCapture(document.id, 'upload')}
          className="secondary-button w-full justify-center"
        >
          <Upload className="h-4 w-4" />
          Upload Photo
        </button>
      </div>
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
      description="Pick the format you need, then take a selfie or upload a photo. We handle the sizing, crop, background, and passport rules automatically."
      onBack={onBackHome}
      backLabel="Back to home"
      chip="Step 1 of 4"
      compactHeader
      summaryItems={[
        { label: 'Selected', value: selectedDocument.countryLabel },
        { label: 'Format', value: selectedDocument.officialSizeLabel },
      ]}
    >
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        {documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            selected={document.id === selectedDocument.id}
            onSelect={onSelectDocument}
            onStartCapture={onStartCapture}
          />
        ))}
      </div>
    </FlowShell>
  );
}
