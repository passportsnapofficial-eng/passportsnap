export const VIEWS = {
  home: 'home',
  document: 'document',
  capture: 'capture',
  processing: 'processing',
  result: 'result',
  cart: 'cart',
  checkout: 'checkout',
  success: 'success',
  dashboard: 'dashboard',
  admin: 'admin',
};

export const CAPTURE_MODES = {
  camera: 'camera',
  upload: 'upload',
};

export const RESULT_STATUSES = {
  passed: 'passed',
  needsRetake: 'needs_retake',
};

export const CHECK_STATUSES = {
  passed: 'passed',
  failed: 'failed',
};

export const STORAGE_KEYS = {
  user: 'ps_user',
  cart: 'ps_cart',
  orders: 'ps_orders',
  cartOptions: 'ps_cart_options',
  pendingPayment: 'ps_pending_payment',
};

export const LEGACY_STORAGE_KEYS = {
  user: ['qp_user'],
  cart: ['qp_cart'],
  orders: ['qp_orders'],
};

export const PREMIUM_RETOUCH_FEE = 7.99;

export const FLOW_STEPS = [
  { view: VIEWS.document, label: 'Choose document', shortLabel: 'Document' },
  { view: VIEWS.capture, label: 'Capture or upload', shortLabel: 'Capture' },
  { view: VIEWS.processing, label: 'Automatic processing', shortLabel: 'Process' },
  { view: VIEWS.result, label: 'Review result', shortLabel: 'Result' },
  { view: VIEWS.checkout, label: 'Checkout', shortLabel: 'Checkout' },
  { view: VIEWS.success, label: 'Success', shortLabel: 'Done' },
];

export const PROCESSING_STEPS = [
  {
    key: 'detect-face',
    title: 'Detecting face',
    description: 'Locating one centered face inside the capture frame.',
    durationMs: 420,
  },
  {
    key: 'set-dimensions',
    title: 'Setting official dimensions',
    description: 'Applying the published canvas size for the selected format.',
    durationMs: 360,
  },
  {
    key: 'check-head-size',
    title: 'Checking head size and proportions',
    description: 'Measuring the subject against the published framing guidance.',
    durationMs: 420,
  },
  {
    key: 'clean-background',
    title: 'Adjusting background to white',
    description: 'Creating a clean white export surface around the portrait.',
    durationMs: 500,
  },
  {
    key: 'optimize-clarity',
    title: 'Optimizing brightness and clarity',
    description: 'Balancing the image for a cleaner review preview.',
    durationMs: 340,
  },
  {
    key: 'check-expression',
    title: 'Ensuring visibility and neutral expression',
    description: 'Running an initial check for face visibility and a steady forward pose.',
    durationMs: 380,
  },
  {
    key: 'prepare-output',
    title: 'Preparing final output',
    description: 'Packing the final JPG for checkout and dashboard delivery.',
    durationMs: 300,
  },
  {
    key: 'final-quality',
    title: 'Final quality and resolution check',
    description: 'Confirming minimum dimensions and export readiness before handoff.',
    durationMs: 340,
  },
];
