export const VIEWS = {
  home: 'home',
  document: 'document',
  capture: 'capture',
  review: 'review',
  processing: 'processing',
  result: 'result',
  cart: 'cart',
  checkout: 'checkout',
  success: 'success',
  dashboard: 'dashboard',
  admin: 'admin',
  about: 'about',
  privacy: 'privacy',
  terms: 'terms',
};

export const VIEW_PATHS = {
  [VIEWS.home]: '/',
  [VIEWS.document]: '/document',
  [VIEWS.capture]: '/capture',
  [VIEWS.review]: '/review',
  [VIEWS.processing]: '/processing',
  [VIEWS.result]: '/result',
  [VIEWS.cart]: '/cart',
  [VIEWS.checkout]: '/checkout',
  [VIEWS.success]: '/success',
  [VIEWS.dashboard]: '/dashboard',
  [VIEWS.admin]: '/admin',
  [VIEWS.about]: '/about',
  [VIEWS.privacy]: '/privacy',
  [VIEWS.terms]: '/terms',
};

export function getPathForView(view) {
  return VIEW_PATHS[view] || VIEW_PATHS[VIEWS.home];
}

export function getViewForPath(pathname = '/') {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const match = Object.entries(VIEW_PATHS).find(([, path]) => path === normalizedPath);
  return match ? match[0] : VIEWS.home;
}

export const CAPTURE_MODES = {
  camera: 'camera',
  upload: 'upload',
};

export const RESULT_STATUSES = {
  passed: 'passed',
  needsRetouch: 'needs_retouch',
  needsRetake: 'needs_retake',
};

export const CHECK_STATUSES = {
  passed: 'passed',
  failed: 'failed',
  info: 'info',
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
  { view: VIEWS.document, label: 'Document', shortLabel: 'Document' },
  { view: VIEWS.capture, label: 'Take Photo', shortLabel: 'Photo' },
  { view: VIEWS.processing, label: 'Getting Ready', shortLabel: 'Ready' },
  { view: VIEWS.review, label: 'Review', shortLabel: 'Review' },
];

export const PROCESSING_STEPS = [
  {
    key: 'load-source',
    title: 'Opening your photo',
    description: 'Getting your photo ready.',
    durationMs: 180,
  },
  {
    key: 'detect-face',
    title: 'Finding your face',
    description: 'Lining everything up.',
    durationMs: 260,
  },
  {
    key: 'segment-background',
    title: 'Analyzing the background',
    description: 'Checking the backdrop before export.',
    durationMs: 220,
  },
  {
    key: 'remove-background',
    title: 'Cleaning the background',
    description: 'Brightening the backdrop.',
    durationMs: 260,
  },
  {
    key: 'validate-face',
    title: 'Checking your pose',
    description: 'Looking for a straight, clear selfie.',
    durationMs: 240,
  },
  {
    key: 'analyze-lighting',
    title: 'Checking the light',
    description: 'Making sure your face is easy to see.',
    durationMs: 220,
  },
  {
    key: 'detect-blur',
    title: 'Checking the photo',
    description: 'Making sure it stays clear.',
    durationMs: 220,
  },
  {
    key: 'build-canvas',
    title: 'Finishing your photo',
    description: 'Putting it all together.',
    durationMs: 260,
  },
  {
    key: 'check-output',
    title: 'Final check',
    description: 'Giving it one last look.',
    durationMs: 180,
  },
  {
    key: 'enhance-photo',
    title: 'Enhancing the final photo',
    description: 'Polishing the finished preview.',
    durationMs: 260,
  },
  {
    key: 'finalize-result',
    title: 'Wrapping up',
    description: 'Your photo is almost ready.',
    durationMs: 160,
  },
];
