import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  RefreshCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { CAPTURE_MODES, VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';
import { HeadGuideOverlay } from './HeadGuideOverlay';

function SourceToggle({ mode, activeMode, onClick }) {
  const isActive = mode === activeMode;
  const label = mode === CAPTURE_MODES.camera ? 'Live camera' : 'Upload photo';
  const Icon = mode === CAPTURE_MODES.camera ? Camera : ImagePlus;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
        isActive ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export function CaptureView({
  selectedDocument,
  selectedPreset,
  captureMode,
  onCaptureModeChange,
  onPhotoReady,
  onBack,
}) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [draftPhoto, setDraftPhoto] = useState(null);

  const stopCamera = () => {
    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current = null;
    setStream(null);
    setCameraReady(false);
  };

  const clearDraft = () => setDraftPhoto(null);

  const handleModeChange = (nextMode) => {
    setCameraError('');
    clearDraft();
    if (nextMode === CAPTURE_MODES.upload) {
      stopCamera();
    }
    onCaptureModeChange(nextMode);
  };

  useEffect(() => {
    if (captureMode !== CAPTURE_MODES.camera || streamRef.current) {
      return undefined;
    }

    let cancelled = false;
    const videoNode = videoRef.current;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user' },
      })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);
      })
      .catch(() => {
        if (cancelled) return;
        setCameraError('Camera access was blocked. Switch to upload to continue.');
        onCaptureModeChange(CAPTURE_MODES.upload);
      });

    return () => {
      cancelled = true;
      if (captureMode === CAPTURE_MODES.camera) {
        const activeStream = streamRef.current;
        if (activeStream) {
          activeStream.getTracks().forEach((track) => track.stop());
        }
        if (videoNode) {
          videoNode.srcObject = null;
        }
        streamRef.current = null;
      }
    };
  }, [captureMode, onCaptureModeChange]);

  useEffect(() => {
    if (!stream || !videoRef.current) return undefined;

    const video = videoRef.current;
    const handleLoaded = () => {
      video.play().catch(() => {});
      setCameraReady(true);
    };

    video.srcObject = stream;
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !cameraReady) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setDraftPhoto(canvas.toDataURL('image/jpeg', 0.92));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setDraftPhoto(reader.result);
    };
    reader.readAsDataURL(file);

    if (event.target) {
      event.target.value = '';
    }
  };

  const bestPracticeItems = [
    'Look straight at the camera with a neutral expression.',
    'Keep some space above the hair and include the shoulders.',
    'Use even lighting and avoid shadows across the face.',
    'Stand in front of a plain wall so the background stays easy to review.',
  ];

  return (
    <FlowShell
      currentView={VIEWS.capture}
      title="Capture or upload a clean source photo"
      description="This step is only about getting a strong source image. The app handles the crop, size, white background, and export after you confirm the draft."
      onBack={onBack}
      backLabel="Back to document"
      chip={
        <span className="inline-flex items-center gap-2">
          <FlagMark src={selectedDocument.flagPath} label={selectedDocument.countryLabel} size="sm" />
          {selectedDocument.name}
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="surface-card overflow-hidden p-5 sm:p-6 animate-fade-up">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Source input</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Take a photo or upload one, then review the draft before processing begins.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <SourceToggle
                mode={CAPTURE_MODES.camera}
                activeMode={captureMode}
                onClick={() => handleModeChange(CAPTURE_MODES.camera)}
              />
              <SourceToggle
                mode={CAPTURE_MODES.upload}
                activeMode={captureMode}
                onClick={() => handleModeChange(CAPTURE_MODES.upload)}
              />
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {captureMode === CAPTURE_MODES.camera ? (
              <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 animate-scale-in">
                <div className="relative aspect-[4/5]">
                  {stream ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                      <HeadGuideOverlay />
                      {!cameraReady ? (
                        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-lg backdrop-blur">
                          Starting the live preview...
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-white">
                      <Camera className="h-14 w-14 text-blue-300" />
                      <div className="text-xl font-semibold">Preparing the camera</div>
                      <p className="max-w-md text-sm leading-6 text-slate-300">
                        If camera access fails, switch to upload and continue with an existing
                        source image.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/85 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-300">
                    {cameraError ||
                      'Keep your head centered inside the guide and make sure both shoulders stay in frame.'}
                  </div>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!cameraReady}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Camera className="h-4 w-4" />
                    {draftPhoto ? 'Capture again' : 'Capture photo'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[32px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center animate-scale-in">
                <div className="mx-auto flex max-w-xl flex-col items-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold text-slate-900">Upload an existing photo</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
                    Use a recent straight-on portrait with enough space around the head so the
                    processor can crop it cleanly.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="primary-button mt-8"
                  >
                    <Upload className="h-4 w-4" />
                    {draftPhoto ? 'Choose another image' : 'Select image'}
                  </button>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
                    JPG, PNG, or HEIC converted by your browser
                  </p>
                </div>
              </div>
            )}

            <div
              className={`rounded-[32px] border p-5 sm:p-6 transition ${
                draftPhoto
                  ? 'border-emerald-200 bg-emerald-50 shadow-[0_28px_80px_-46px_rgba(16,185,129,0.55)]'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              {draftPhoto ? (
                <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
                  <div className="rounded-[28px] bg-white p-3 shadow-sm">
                    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-100 aspect-[4/5]">
                      <img src={draftPhoto} alt="Draft source photo" className="h-full w-full object-cover" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        Draft photo ready
                      </div>
                      <h2 className="mt-4 text-2xl font-semibold text-slate-900">
                        Review this draft before automatic processing
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        When you continue, the processor will prepare the selected document size,
                        run the staged checks, and take you to the result screen.
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-emerald-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Document
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {selectedDocument.name}
                          </div>
                        </div>
                        <div className="rounded-3xl border border-emerald-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Output
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {selectedPreset.officialSize || selectedPreset.label}
                          </div>
                        </div>
                        <div className="rounded-3xl border border-emerald-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Export
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {selectedPreset.outputWidth} x {selectedPreset.outputHeight}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={
                          captureMode === CAPTURE_MODES.camera
                            ? clearDraft
                            : () => {
                                clearDraft();
                                fileInputRef.current?.click();
                              }
                        }
                        className="secondary-button justify-center"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        {captureMode === CAPTURE_MODES.camera ? 'Retake photo' : 'Replace photo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onPhotoReady(draftPhoto)}
                        className="primary-button justify-center"
                      >
                        <Sparkles className="h-4 w-4" />
                        Process photo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600" />
                  Capture or upload a draft to unlock the processing step.
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        <aside className="space-y-5 animate-slide-up">
          <div className="surface-card p-6 sm:p-7">
            <div className="text-sm font-semibold text-slate-900">Step guidance</div>
            <div className="mt-4 grid gap-3">
              {bestPracticeItems.map((item) => (
                <div key={item} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <FlagMark src={selectedDocument.flagPath} label={selectedDocument.countryLabel} size="md" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{selectedDocument.name}</div>
                <div className="text-sm text-slate-500">{selectedDocument.authority}</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {selectedDocument.requirements.slice(0, 4).map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </FlowShell>
  );
}
