import { startTransition, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DOCUMENT_ID,
  DOCUMENT_TYPES,
} from '../data/documentTypes';
import { getSizePresetById } from '../data/sizePresets';
import { processPassportPhoto } from '../lib/processing/mockPassportProcessor';
import { buildReviewedSourcePhoto } from '../lib/processing/reviewTransform';
import {
  CAPTURE_MODES,
  PROCESSING_STEPS,
  VIEWS,
  getPathForView,
  getViewForPath,
} from '../lib/utils/constants';

function createProcessingState(overrides = {}) {
  return {
    message: '',
    rejectionReasons: [],
    status: 'idle',
    activeStepKey: null,
    completedKeys: [],
    progress: 0,
    steps: PROCESSING_STEPS,
    ...overrides,
  };
}

function createIdleProcessingState() {
  return createProcessingState();
}

function getStepProgress(stepIndex) {
  if (stepIndex < 0) {
    return 0;
  }

  return Math.round(((stepIndex + 1) / PROCESSING_STEPS.length) * 92) + 4;
}

function getInitialView() {
  if (typeof window === 'undefined') {
    return VIEWS.home;
  }

  return getViewForPath(window.location.pathname);
}

export function usePassportFlow(documentCatalog = DOCUMENT_TYPES) {
  const resolvedDocuments = documentCatalog?.length ? documentCatalog : DOCUMENT_TYPES;
  const fallbackDocumentId =
    resolvedDocuments.find((document) => document.isActive !== false)?.id ||
    resolvedDocuments[0]?.id ||
    DEFAULT_DOCUMENT_ID;
  const [view, setView] = useState(getInitialView);
  const [selectedDocumentId, setSelectedDocumentId] = useState(fallbackDocumentId);
  const [preferredCaptureMode, setPreferredCaptureMode] = useState(CAPTURE_MODES.camera);
  const [captureMode, setCaptureMode] = useState(CAPTURE_MODES.camera);
  const [draftPhoto, setDraftPhoto] = useState(null);
  const [sourcePhoto, setSourcePhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [processingState, setProcessingState] = useState(createIdleProcessingState);
  const runIdRef = useRef(0);
  const viewRef = useRef(view);

  const selectedDocument =
    resolvedDocuments.find((document) => document.id === selectedDocumentId) ||
    resolvedDocuments[0] ||
    DOCUMENT_TYPES.find((document) => document.id === DEFAULT_DOCUMENT_ID) ||
    DOCUMENT_TYPES[0];
  const selectedPreset = getSizePresetById(selectedDocument.presetId);
  const selectedCountryLabel = selectedDocument.countryLabel;

  useEffect(() => {
    if (!resolvedDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(fallbackDocumentId);
    }
  }, [fallbackDocumentId, resolvedDocuments, selectedDocumentId]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      const nextView = getViewForPath(window.location.pathname);

      if (viewRef.current === VIEWS.processing && nextView !== VIEWS.processing) {
        runIdRef.current += 1;
        setProcessingState(createIdleProcessingState());
      }

      window.scrollTo(0, 0);
      setView(nextView === VIEWS.result ? VIEWS.review : nextView);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(nextView, options = {}) {
    const { replace = false } = options;
    const resolvedView = nextView === VIEWS.result ? VIEWS.review : nextView;

    // URL + scroll must happen synchronously before any state update.
    if (typeof window !== 'undefined') {
      const nextPath = getPathForView(resolvedView);
      const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextUrl !== currentUrl) {
        window.history[replace ? 'replaceState' : 'pushState']({}, document.title, nextUrl);
      }

      window.scrollTo(0, 0);
    }

    // Mark the view switch as non-urgent so the browser can paint
    // button feedback before committing the full re-render.
    startTransition(() => {
      setView(resolvedView);
    });
  }

  useEffect(() => {
    let redirectView = null;

    if (view === VIEWS.processing && !sourcePhoto) {
      redirectView = draftPhoto ? VIEWS.capture : VIEWS.document;
    }

    if (!redirectView && view === VIEWS.review && !result) {
      redirectView = draftPhoto ? VIEWS.capture : VIEWS.home;
    }

    if (!redirectView) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      navigate(redirectView, { replace: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [draftPhoto, result, sourcePhoto, view]);

  const resetSession = () => {
    runIdRef.current += 1;
    setDraftPhoto(null);
    setSourcePhoto(null);
    setResult(null);
    setProcessingState(createIdleProcessingState());
  };

  const startFlow = (mode = preferredCaptureMode || CAPTURE_MODES.camera, documentId = selectedDocumentId || fallbackDocumentId) => {
    resetSession();
    setPreferredCaptureMode(mode);
    setCaptureMode(mode);
    setSelectedDocumentId(documentId || fallbackDocumentId);
    navigate(VIEWS.document);
  };

  const selectDocument = (documentId) => {
    setSelectedDocumentId(documentId);
  };

  const continueToCapture = (mode = captureMode) => {
    setPreferredCaptureMode(mode);
    setCaptureMode(mode);
    setDraftPhoto(null);
    setSourcePhoto(null);
    setResult(null);
    setProcessingState(createIdleProcessingState());
    navigate(VIEWS.capture);
  };

  const setFlowCaptureMode = (mode) => {
    setPreferredCaptureMode(mode);
    setCaptureMode(mode);
  };

  const setDraftSourcePhoto = (photoDataUrl) => {
    setDraftPhoto(photoDataUrl || null);
    if (!photoDataUrl) {
      setSourcePhoto(null);
      setResult(null);
    }
  };

  const clearProcessingState = () => {
    runIdRef.current += 1;
    setSourcePhoto(null);
    setResult(null);
    setProcessingState(createIdleProcessingState());
  };

  const startAutomaticProcessing = async () => {
    const documentType =
      resolvedDocuments.find((document) => document.id === selectedDocumentId) ||
      selectedDocument;
    const preset = getSizePresetById(documentType.presetId);
    let runId = runIdRef.current;

    if (!draftPhoto) {
      return;
    }

    try {
      const reviewedPhoto = await buildReviewedSourcePhoto(draftPhoto, preset);
      runId = ++runIdRef.current;
      setSourcePhoto(reviewedPhoto);
      setResult(null);
      setProcessingState(createProcessingState({
        status: 'running',
        activeStepKey: PROCESSING_STEPS[0].key,
        completedKeys: [],
        progress: 4,
      }));
      navigate(VIEWS.processing);

      const handleStageChange = (stepKey) => {
        if (runId !== runIdRef.current) {
          return;
        }

        const stepIndex = PROCESSING_STEPS.findIndex((step) => step.key === stepKey);
        if (stepIndex === -1) {
          return;
        }

        const completedKeys = PROCESSING_STEPS.slice(0, stepIndex).map((item) => item.key);
        setProcessingState(createProcessingState({
          status: 'running',
          activeStepKey: stepKey,
          completedKeys,
          progress: getStepProgress(stepIndex),
        }));
      };

      const processedResult = await processPassportPhoto(reviewedPhoto, {
        documentType,
        preset,
        countryLabel: selectedCountryLabel,
        onStageChange: handleStageChange,
        respectSourceFraming: true,
      });

      if (runId !== runIdRef.current) {
        return;
      }

      setResult(processedResult);
      setProcessingState(createProcessingState({
        status: 'complete',
        activeStepKey: null,
        completedKeys: PROCESSING_STEPS.map((item) => item.key),
        progress: 100,
      }));
      navigate(VIEWS.review);
    } catch (error) {
      if (runId && runId !== runIdRef.current) {
        return;
      }

      console.error('Passport photo processing failed.', error);
      setProcessingState((current) =>
        createProcessingState({
          ...current,
          status: 'error',
          activeStepKey: null,
          rejectionReasons:
            error && typeof error === 'object' && Array.isArray(error.rejectionReasons)
              ? error.rejectionReasons
              : [],
          message:
            error instanceof Error && error.message
              ? error.message
              : 'We could not finish this selfie. Please take another photo and try again.',
        }),
      );
    }
  };

  const retakePhoto = () => {
    clearProcessingState();
    setDraftPhoto(null);
    navigate(VIEWS.capture);
  };

  const backToCapture = () => {
    clearProcessingState();
    navigate(VIEWS.capture);
  };

  return {
    view,
    selectedDocument,
    selectedDocumentId,
    selectedPreset,
    selectedCountryLabel,
    preferredCaptureMode,
    captureMode,
    draftPhoto,
    sourcePhoto,
    result,
    processingState,
    documents: resolvedDocuments,
    navigate,
    startFlow,
    selectDocument,
    continueToCapture,
    setCaptureMode: setFlowCaptureMode,
    setDraftPhoto: setDraftSourcePhoto,
    startAutomaticProcessing,
    retakePhoto,
    backToCapture,
    resetSession,
  };
}
