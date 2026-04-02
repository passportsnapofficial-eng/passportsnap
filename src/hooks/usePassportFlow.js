import { useRef, useState } from 'react';
import {
  ACTIVE_DOCUMENT,
  DEFAULT_DOCUMENT_ID,
  DOCUMENT_TYPES,
  getDocumentById,
} from '../data/documentTypes';
import { getSizePresetById } from '../data/sizePresets';
import { processPassportPhoto } from '../lib/processing/mockPassportProcessor';
import { CAPTURE_MODES, PROCESSING_STEPS, VIEWS } from '../lib/utils/constants';

function createIdleProcessingState() {
  return {
    status: 'idle',
    activeStepKey: null,
    completedKeys: [],
    progress: 0,
    steps: PROCESSING_STEPS,
  };
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function usePassportFlow() {
  const [view, setView] = useState(VIEWS.home);
  const [selectedDocumentId, setSelectedDocumentId] = useState(DEFAULT_DOCUMENT_ID);
  const [preferredCaptureMode, setPreferredCaptureMode] = useState(CAPTURE_MODES.camera);
  const [captureMode, setCaptureMode] = useState(CAPTURE_MODES.camera);
  const [sourcePhoto, setSourcePhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [processingState, setProcessingState] = useState(createIdleProcessingState);
  const runIdRef = useRef(0);

  const selectedDocument = getDocumentById(selectedDocumentId) || ACTIVE_DOCUMENT;
  const selectedPreset = getSizePresetById(selectedDocument.presetId);
  const selectedCountryLabel = selectedDocument.countryLabel;

  const navigate = (nextView) => {
    window.scrollTo(0, 0);
    setView(nextView);
  };

  const resetSession = () => {
    runIdRef.current += 1;
    setSourcePhoto(null);
    setResult(null);
    setProcessingState(createIdleProcessingState());
  };

  const startFlow = (mode = CAPTURE_MODES.camera, documentId = DEFAULT_DOCUMENT_ID) => {
    resetSession();
    setPreferredCaptureMode(mode);
    setCaptureMode(mode);
    setSelectedDocumentId(documentId);
    navigate(VIEWS.document);
  };

  const selectDocument = (documentId) => {
    setSelectedDocumentId(documentId);
  };

  const continueToCapture = () => {
    setCaptureMode(preferredCaptureMode);
    navigate(VIEWS.capture);
  };

  const setFlowCaptureMode = (mode) => {
    setPreferredCaptureMode(mode);
    setCaptureMode(mode);
  };

  const submitPhoto = async (photoDataUrl) => {
    const documentType = getDocumentById(selectedDocumentId) || ACTIVE_DOCUMENT;
    const preset = getSizePresetById(documentType.presetId);
    if (!photoDataUrl) return;

    const runId = ++runIdRef.current;
    setSourcePhoto(photoDataUrl);
    setResult(null);
    setProcessingState({
      status: 'running',
      activeStepKey: PROCESSING_STEPS[0].key,
      completedKeys: [],
      progress: 8,
      steps: PROCESSING_STEPS,
    });
    navigate(VIEWS.processing);

    let processedResult = null;

    for (let index = 0; index < PROCESSING_STEPS.length; index += 1) {
      if (runId !== runIdRef.current) return;

      const step = PROCESSING_STEPS[index];
      const completedKeys = PROCESSING_STEPS.slice(0, index).map((item) => item.key);
      setProcessingState({
        status: 'running',
        activeStepKey: step.key,
        completedKeys,
        progress: Math.round((index / PROCESSING_STEPS.length) * 84) + 12,
        steps: PROCESSING_STEPS,
      });

      if (index === 4) {
        processedResult = await processPassportPhoto(photoDataUrl, {
          documentType,
          preset,
          countryLabel: selectedCountryLabel,
        });
      }

      await delay(step.durationMs);
    }

    if (runId !== runIdRef.current) return;

    if (!processedResult) {
      processedResult = await processPassportPhoto(photoDataUrl, {
        documentType,
        preset,
        countryLabel: selectedCountryLabel,
      });
    }

    setProcessingState({
      status: 'complete',
      activeStepKey: PROCESSING_STEPS[PROCESSING_STEPS.length - 1].key,
      completedKeys: PROCESSING_STEPS.map((item) => item.key),
      progress: 100,
      steps: PROCESSING_STEPS,
    });
    setResult(processedResult);

    await delay(360);
    if (runId !== runIdRef.current) return;

    navigate(VIEWS.result);
  };

  const retakePhoto = () => {
    runIdRef.current += 1;
    setSourcePhoto(null);
    setResult(null);
    setProcessingState(createIdleProcessingState());
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
    sourcePhoto,
    result,
    processingState,
    documents: DOCUMENT_TYPES,
    navigate,
    startFlow,
    selectDocument,
    continueToCapture,
    setCaptureMode: setFlowCaptureMode,
    submitPhoto,
    retakePhoto,
    resetSession,
  };
}
