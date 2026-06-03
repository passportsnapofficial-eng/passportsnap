import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  RefreshCcw,
  Upload,
} from 'lucide-react';
import { CAPTURE_MODES, VIEWS } from '../../lib/utils/constants';
import {
  DEFAULT_REVIEW_ADJUSTMENTS,
  getReviewFrameLayout,
  normalizeReviewAdjustments,
} from '../../lib/processing/reviewTransform';
import { FlowShell } from '../flow/FlowShell';
import { HeadGuideOverlay } from './HeadGuideOverlay';

const MAX_UPLOAD_LANDSCAPE_RATIO = 1.05;
const MAX_REVIEW_SCALE = 1.8;

function getCameraApi() {
  if (typeof navigator === 'undefined') {
    return null;
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return {
      getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    };
  }

  return null;
}

function shouldUseNativePhoneCamera() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || '';
  const mobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  return mobileDevice || coarsePointer;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageMetrics(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => reject(new Error('Could not read the selected image.'));
    image.src = dataUrl;
  });
}

async function normalizePortraitUpload(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const metrics = await loadImageMetrics(dataUrl);
  const aspectRatio = metrics.width / Math.max(metrics.height, 1);

  // Some square-ish uploads decode one pixel off in the browser
  // (for example 600x599 WebP files). Keep rejecting clearly landscape
  // photos, but allow near-square portraits that the crop pipeline can
  // already handle safely.
  if (aspectRatio > MAX_UPLOAD_LANDSCAPE_RATIO) {
    throw new Error('Use a vertical selfie or portrait photo so we can process it correctly.');
  }

  return dataUrl;
}

function capturePortraitFromVideo(video, targetAspectRatio) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const targetWidth = Math.round(sourceHeight * targetAspectRatio);
  const cropWidth = Math.min(sourceWidth, targetWidth);
  const cropHeight = Math.round(cropWidth / targetAspectRatio);
  const cropX = Math.round((sourceWidth - cropWidth) / 2);
  const cropY = Math.max(0, Math.round((sourceHeight - cropHeight) / 2));

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not capture the selfie preview.');
  }

  canvas.width = cropWidth;
  canvas.height = cropHeight;
  context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.96);
}

export function CaptureView({
  selectedDocument,
  selectedPreset,
  captureMode,
  draftPhoto,
  draftPhotoAdjustments,
  onDraftChange,
  onDraftPhotoAdjustmentsChange,
  onCaptureModeChange,
  onContinue,
  onBack,
}) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const streamRef = useRef(null);
  const touchStateRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [draftImageMetrics, setDraftImageMetrics] = useState(null);
  const nativePhoneCamera = shouldUseNativePhoneCamera();
  const targetAspectRatio = selectedPreset.outputWidth / selectedPreset.outputHeight;
  const reviewAdjustments = normalizeReviewAdjustments(draftPhotoAdjustments);
  const reviewLayout = draftImageMetrics
    ? getReviewFrameLayout(
      draftImageMetrics.width,
      draftImageMetrics.height,
      targetAspectRatio,
      reviewAdjustments,
    )
    : null;

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

  const openUploadPicker = () => {
    fileInputRef.current?.click();
  };

  const openNativeCamera = () => {
    cameraInputRef.current?.click();
  };

  const setMode = (mode) => {
    setCameraError('');
    onCaptureModeChange(mode);
  };

  useEffect(() => {
    if (captureMode !== CAPTURE_MODES.camera || draftPhoto) {
      return undefined;
    }

    if (nativePhoneCamera) {
      stopCamera();
      return undefined;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        const cameraApi = getCameraApi();
        if (!cameraApi) {
          setCameraError('Camera preview is not available here. Upload a portrait photo instead.');
          return;
        }

        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setCameraError('Camera preview needs HTTPS or localhost. Upload a portrait photo instead.');
          return;
        }

        const mediaStream = await cameraApi.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            aspectRatio: { ideal: targetAspectRatio },
          },
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setCameraError('');
      } catch {
        setCameraError('Camera access was blocked. Upload a portrait photo instead.');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [captureMode, draftPhoto, nativePhoneCamera, targetAspectRatio]);

  useEffect(() => {
    if (!stream || !videoRef.current) {
      return undefined;
    }

    const video = videoRef.current;
    const handleLoaded = () => {
      video.play().catch(() => {});
      setCameraReady(true);
    };

    video.srcObject = stream;
    video.addEventListener('loadedmetadata', handleLoaded);

    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [stream]);

  useEffect(() => {
    let cancelled = false;

    if (!draftPhoto) {
      setDraftImageMetrics(null);
      return undefined;
    }

    loadImageMetrics(draftPhoto)
      .then((metrics) => {
        if (!cancelled) {
          setDraftImageMetrics(metrics);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftImageMetrics(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftPhoto]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const nextPhoto = await normalizePortraitUpload(file);
      onDraftChange(nextPhoto);
      setCameraError('');
      stopCamera();
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Use a vertical selfie or portrait photo.');
      onDraftChange(null);
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !cameraReady) {
      return;
    }

    try {
      const photo = capturePortraitFromVideo(videoRef.current, targetAspectRatio);
      onDraftChange(photo);
      stopCamera();
      setCameraError('');
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Could not capture the selfie.');
    }
  };

  const handleRetake = () => {
    onDraftChange(null);
    setCameraError('');
  };

  const updateReviewAdjustments = (nextAdjustments) => {
    onDraftPhotoAdjustmentsChange(normalizeReviewAdjustments(nextAdjustments));
  };

  const updatePosition = (axis, rawValue) => {
    updateReviewAdjustments({
      ...reviewAdjustments,
      [axis]: Number(rawValue),
    });
  };

  const updateScale = (rawValue) => {
    updateReviewAdjustments({
      ...reviewAdjustments,
      scale: Number(rawValue),
    });
  };

  const resetAdjustments = () => {
    updateReviewAdjustments(DEFAULT_REVIEW_ADJUSTMENTS);
  };

  const getTouchDistance = (touches) => {
    if (touches.length < 2) {
      return 0;
    }

    const [firstTouch, secondTouch] = touches;
    return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
  };

  const getTouchCenter = (touches) => {
    if (touches.length < 2) {
      return null;
    }

    const [firstTouch, secondTouch] = touches;
    return {
      x: (firstTouch.clientX + secondTouch.clientX) / 2,
      y: (firstTouch.clientY + secondTouch.clientY) / 2,
    };
  };

  const handleDraftTouchStart = (event) => {
    if (!reviewLayout) {
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchStateRef.current = {
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        startPositionX: reviewAdjustments.positionX,
        startPositionY: reviewAdjustments.positionY,
      };
      return;
    }

    if (event.touches.length >= 2) {
      const center = getTouchCenter(event.touches);
      touchStateRef.current = {
        mode: 'pinch',
        startDistance: getTouchDistance(event.touches),
        startScale: reviewAdjustments.scale,
        startPositionX: reviewAdjustments.positionX,
        startPositionY: reviewAdjustments.positionY,
        startCenterX: center?.x || 0,
        startCenterY: center?.y || 0,
      };
    }
  };

  const handleDraftTouchMove = (event) => {
    if (!touchStateRef.current || !reviewLayout) {
      return;
    }

    if (touchStateRef.current.mode === 'pan' && event.touches.length === 1) {
      const touch = event.touches[0];
      const nextPositionX =
        touchStateRef.current.startPositionX +
        ((touch.clientX - touchStateRef.current.startX) / 220);
      const nextPositionY =
        touchStateRef.current.startPositionY +
        ((touch.clientY - touchStateRef.current.startY) / 220);

      updateReviewAdjustments({
        ...reviewAdjustments,
        positionX: nextPositionX,
        positionY: nextPositionY,
      });
      event.preventDefault();
      return;
    }

    if (event.touches.length >= 2) {
      const center = getTouchCenter(event.touches);
      const distance = getTouchDistance(event.touches);
      const nextScale =
        touchStateRef.current.startScale *
        (distance / Math.max(touchStateRef.current.startDistance || distance || 1, 1));
      const nextPositionX =
        touchStateRef.current.startPositionX +
        (((center?.x || 0) - (touchStateRef.current.startCenterX || 0)) / 220);
      const nextPositionY =
        touchStateRef.current.startPositionY +
        (((center?.y || 0) - (touchStateRef.current.startCenterY || 0)) / 220);

      updateReviewAdjustments({
        scale: nextScale,
        positionX: nextPositionX,
        positionY: nextPositionY,
      });
      event.preventDefault();
    }
  };

  const handleDraftTouchEnd = () => {
    touchStateRef.current = null;
  };

  const renderGuideFrame = () => <HeadGuideOverlay />;

  const renderPreview = () => {
    if (draftPhoto) {
      const drawStyle = reviewLayout
        ? {
          width: `${reviewLayout.scaledWidthRatio * 100}%`,
          height: `${reviewLayout.scaledHeightRatio * 100}%`,
          left: `${reviewLayout.exportLeftRatio * 100}%`,
          top: `${reviewLayout.exportTopRatio * 100}%`,
        }
        : {
          inset: 0,
        };

      return (
        <div
          className="animate-scale-in relative h-full w-full touch-none"
          onTouchStart={nativePhoneCamera ? handleDraftTouchStart : undefined}
          onTouchMove={nativePhoneCamera ? handleDraftTouchMove : undefined}
          onTouchEnd={nativePhoneCamera ? handleDraftTouchEnd : undefined}
          onTouchCancel={nativePhoneCamera ? handleDraftTouchEnd : undefined}
        >
          <img
            src={draftPhoto}
            alt="Selected selfie preview"
            className="absolute max-w-none select-none object-cover"
            style={drawStyle}
            draggable="false"
          />
          {renderGuideFrame()}
        </div>
      );
    }

    if (captureMode === CAPTURE_MODES.camera) {
      if (nativePhoneCamera) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <Camera className="h-12 w-12 text-sky-200" />
            <div className="text-xl font-semibold">Open your phone camera</div>
            <p className="max-w-xs text-sm leading-6 text-slate-200">
              Use your phone camera for a fresh selfie instead of the browser preview.
            </p>
            <button type="button" onClick={openNativeCamera} className="primary-button w-full max-w-[260px] justify-center sm:w-auto">
              <Camera className="h-4 w-4" />
              Take Selfie
            </button>
          </div>
        );
      }

      if (stream) {
        return (
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {renderGuideFrame()}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent px-4 pb-6 pt-16">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!cameraReady}
                aria-label="Capture photo"
                className="tap-manipulation pointer-events-auto relative inline-flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white shadow-[0_24px_40px_-18px_rgba(15,23,42,0.7)] transition duration-150 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="h-[54px] w-[54px] rounded-full border border-slate-200 bg-white" />
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="relative h-full w-full">
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <Camera className="h-12 w-12 text-sky-200" />
            <div className="text-xl font-semibold">Getting your camera ready</div>
            <p className="max-w-xs text-sm leading-6 text-slate-200">
              Allow camera access when your browser asks.
            </p>
          </div>
          {renderGuideFrame()}
        </div>
      );
    }

    return (
      <div className="relative h-full w-full">
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <Upload className="h-12 w-12 text-sky-200" />
          <div className="text-xl font-semibold">Upload a photo</div>
          <p className="max-w-xs text-sm leading-6 text-slate-200">
            Use one clear face in the frame and we'll handle the rest.
          </p>
          <button type="button" onClick={openUploadPicker} className="primary-button w-full max-w-[260px] justify-center sm:w-auto">
            <Upload className="h-4 w-4" />
            Upload Image
          </button>
        </div>
      </div>
    );
  };

  return (
    <FlowShell
      currentView={VIEWS.capture}
      title="Take a selfie"
      description="Use a straight-on photo with one face in frame. We'll handle the rest."
      onBack={onBack}
      backLabel="Back to document"
      chip="Step 2 of 4"
      compactHeader
      summaryItems={[
        { label: 'Document', value: selectedDocument.countryLabel },
        { label: 'Format', value: selectedPreset.officialSize || selectedPreset.label },
      ]}
    >
      <div className="workspace-grid">
        <section className="workspace-main">
          <div className="workspace-panel">
            {cameraError ? (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            ) : null}

            <div className="mb-4 lg:hidden">
              {draftPhoto ? (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={handleRetake} className="secondary-button min-h-[52px] w-full justify-center px-3">
                    <RefreshCcw className="h-4 w-4" />
                    Retake
                  </button>
                  <button type="button" onClick={onContinue} className="primary-button min-h-[52px] w-full justify-center px-3">
                    <span>Use Photo</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(CAPTURE_MODES.camera);
                      if (nativePhoneCamera) {
                        openNativeCamera();
                      }
                    }}
                    className={captureMode === CAPTURE_MODES.camera ? 'primary-button min-h-[52px] w-full justify-center px-3' : 'secondary-button min-h-[52px] w-full justify-center px-3'}
                  >
                    <Camera className="h-4 w-4" />
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(CAPTURE_MODES.upload);
                      openUploadPicker();
                    }}
                    className={captureMode === CAPTURE_MODES.upload ? 'primary-button min-h-[52px] w-full justify-center px-3' : 'secondary-button min-h-[52px] w-full justify-center px-3'}
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </button>
                </div>
              )}
            </div>

            <div className={draftPhoto && !nativePhoneCamera ? 'lg:grid lg:grid-cols-[minmax(0,430px)_minmax(260px,1fr)] lg:items-start lg:gap-4' : ''}>
              <div className="rounded-[28px] bg-slate-950 p-4">
                <div
                  className="relative mx-auto w-full max-w-[430px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-900"
                  style={{ aspectRatio: `${selectedPreset.outputWidth} / ${selectedPreset.outputHeight}` }}
                >
                  {renderPreview()}
                </div>
              </div>

              {draftPhoto && !nativePhoneCamera ? (
                <div className="hidden rounded-[24px] border border-slate-200 bg-white p-4 lg:block">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Adjust photo</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        On PC, use the sliders to zoom and move the photo left, right, up, or down before you click Use Photo.
                      </p>
                    </div>
                    <button type="button" onClick={resetAdjustments} className="secondary-button shrink-0 justify-center px-4 py-2 text-sm">
                      Reset
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span className="font-medium">Left / Right</span>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={reviewAdjustments.positionX}
                        onChange={(event) => updatePosition('positionX', event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span className="font-medium">Up / Down</span>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={reviewAdjustments.positionY}
                        onChange={(event) => updatePosition('positionY', event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span className="font-medium">Zoom</span>
                      <input
                        type="range"
                        min="1"
                        max={String(MAX_REVIEW_SCALE)}
                        step="0.01"
                        value={reviewAdjustments.scale}
                        onChange={(event) => updateScale(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </div>

            {draftPhoto && nativePhoneCamera ? (
              <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Adjust photo</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      On mobile, slide with one finger to position the photo and pinch with two fingers to zoom before you tap Use Photo.
                    </p>
                  </div>
                  <button type="button" onClick={resetAdjustments} className="secondary-button shrink-0 justify-center px-4 py-2 text-sm">
                    Reset
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="workspace-side">
          <div className="workspace-panel">
            <div className="hidden rounded-[24px] bg-slate-50 p-4 lg:block">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Choose how to start</div>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode(CAPTURE_MODES.camera);
                    if (nativePhoneCamera) {
                      openNativeCamera();
                    }
                  }}
                  className={captureMode === CAPTURE_MODES.camera ? 'primary-button w-full justify-center' : 'secondary-button w-full justify-center'}
                >
                  <Camera className="h-4 w-4" />
                  Use camera mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(CAPTURE_MODES.upload);
                    openUploadPicker();
                  }}
                  className={captureMode === CAPTURE_MODES.upload ? 'primary-button w-full justify-center' : 'secondary-button w-full justify-center'}
                >
                  <Upload className="h-4 w-4" />
                  Upload image mode
                </button>
              </div>
            </div>

            {draftPhoto ? (
              <div className="hidden workspace-footer lg:flex">
                <button type="button" onClick={handleRetake} className="secondary-button w-full justify-center sm:w-auto sm:mr-auto">
                  <RefreshCcw className="h-4 w-4" />
                  Retake Photo
                </button>
                <button type="button" onClick={onContinue} className="primary-button hidden w-full justify-center sm:inline-flex sm:w-auto">
                  <span>Use This Photo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick tip</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Keep your phone upright, look straight at the camera, and leave a little space above your head.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </FlowShell>
  );
}

