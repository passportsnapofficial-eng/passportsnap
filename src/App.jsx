import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminView } from './components/admin/AdminView';
import { AuthDialog } from './components/auth/AuthDialog';
import { CartView } from './components/checkout/CartView';
import { CheckoutView } from './components/checkout/CheckoutView';
import { SuccessView } from './components/checkout/SuccessView';
import { CaptureView } from './components/capture/CaptureView';
import { DashboardView } from './components/dashboard/DashboardView';
import { DocumentSelectionView } from './components/flow/DocumentSelectionView';
import { HomeView } from './components/home/HomeView';
import { LegalPageView } from './components/legal/LegalPageView';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { ProcessingView } from './components/processing/ProcessingView';
import { ReviewView } from './components/review/ReviewView';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePassportFlow } from './hooks/usePassportFlow';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { computeCheckoutTotals } from './lib/checkout/pricing';
import { buildStripeReturnUrl, initializeStripePayment, verifyStripePayment } from './lib/payments/stripeClient';
import { fetchPublicSiteSettings } from './lib/settings/settingsClient.js';
import { buildActiveDocumentCatalog, getSiteDocumentSetting, normalizeSiteSettings } from './lib/settings/siteSettings.js';
import { listOrdersForUser, upsertOrderForUser } from './lib/supabase/orders.js';
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  VIEWS,
} from './lib/utils/constants';
import { formatDownloadFilename } from './lib/utils/formatters';

const PRIVACY_SECTIONS = [
  {
    title: 'What this app stores',
    body: 'Passportsnap stores account details, order history, and generated photo assets needed to deliver downloads and keep the dashboard available across devices.',
  },
  {
    title: 'How uploads are used',
    body: 'Uploaded or captured photos are used to create the reviewed export, run the automated checks, and attach the finished file to the completed order.',
  },
  {
    title: 'Payments',
    body: 'Payments are processed through a secure checkout. The app stores the transaction details required to verify successful payment and unlock downloads.',
  },
];

const TERMS_SECTIONS = [
  {
    title: 'Service scope',
    body: 'Passportsnap helps prepare passport-style photos through a guided workflow. The automated checks are a product aid and do not replace official government acceptance decisions.',
  },
  {
    title: 'Account responsibility',
    body: 'Users are responsible for providing accurate account, payment, and photo information before placing an order.',
  },
  {
    title: 'Downloads and delivery',
    body: 'Downloads are released after payment verification succeeds. Completed orders remain available through the dashboard tied to the authenticated account.',
  },
];

function cartRequiresPremiumRetouch(items = []) {
  return items.some((item) => item.requiresPremiumRetouch);
}

function buildServiceSummary(items) {
  if (!items.length) return 'Passport photo order';
  if (items.length === 1) return items[0].documentName;
  return `${items[0].documentName} + ${items.length - 1} more`;
}

function buildOrderStatus(premiumRetouch) {
  return premiumRetouch ? 'Paid - premium review requested' : 'Paid';
}

function buildCompletedOrder({ verification, cartItems, premiumRetouch }) {
  const downloadOwnerName = verification.customer?.name || 'Customer';
  const orderItems = cartItems.map((item) => ({
    ...item,
    premiumRetouch,
    downloadOwnerName,
  }));

  return {
    id: verification.orderReference || verification.paymentReference,
    date: verification.paidAt || new Date().toISOString(),
    status: buildOrderStatus(premiumRetouch),
    subtotal: Number(verification.subtotal || 0),
    premiumRetouch,
    premiumFee: Number(verification.premiumFee || 0),
    total: Number(verification.total || verification.amount || 0),
    paymentCurrency: verification.currency,
    paymentChannel: verification.channel,
    paymentGatewayResponse: verification.gatewayResponse,
    paymentReference: verification.paymentReference,
    paymentVerifiedAt: new Date().toISOString(),
    items: orderItems,
    serviceSummary: buildServiceSummary(orderItems),
  };
}

function upsertOrderInCollection(collection, order) {
  return [order, ...collection.filter((entry) => entry.id !== order.id)];
}

function extractStripeReturn() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get('session_id');
  const state = url.searchParams.get('stripe');

  if (!sessionId && state !== 'cancelled') {
    return null;
  }

  return {
    sessionId,
    state,
  };
}

function clearStripeReturnFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('session_id');
  url.searchParams.delete('stripe');
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function downloadImage(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function normalizeErrorMessage(error, fallbackMessage) {
  const sanitizeMessage = (message) => {
    if (!message) return fallbackMessage;

    const trimmedMessage = String(message).trim();
    const normalizedMessage = trimmedMessage.toLowerCase();

    if (normalizedMessage.includes('email_not_confirmed') || normalizedMessage.includes('email not confirmed')) {
      return 'Check your email and confirm your account before signing in.';
    }

    if (normalizedMessage.includes('invalid login credentials')) {
      return 'The email or password is incorrect.';
    }

    if (normalizedMessage.includes('user already registered') || normalizedMessage.includes('already been registered')) {
      return 'An account already exists for this email. Try signing in instead.';
    }

    if (
      normalizedMessage.includes('failed to fetch') ||
      normalizedMessage.includes('network request failed') ||
      normalizedMessage === 'network error'
    ) {
      return 'Connection issue. Please try again.';
    }

    if (
      normalizedMessage.includes('supabase') ||
      normalizedMessage.includes('stripe') ||
      normalizedMessage.includes('vercel') ||
      normalizedMessage.includes('jwt') ||
      normalizedMessage.includes('service role') ||
      normalizedMessage.includes('row-level security') ||
      normalizedMessage.includes('rls') ||
      /vite_[a-z0-9_]+/i.test(trimmedMessage)
    ) {
      return fallbackMessage;
    }

    return trimmedMessage;
  };

  if (error instanceof Error && error.message) {
    return sanitizeMessage(error.message);
  }

  if (typeof error === 'string' && error) {
    return sanitizeMessage(error);
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return sanitizeMessage(error.message);
  }

  return fallbackMessage;
}

function syncCartPricesWithSettings(items = [], siteSettings) {
  let didChange = false;

  const nextItems = items.map((item) => {
    const latestDocument = getSiteDocumentSetting(item.documentId, siteSettings);
    const nextPrice = Number(latestDocument?.price ?? item.basePrice ?? 0);

    if (Number(item.basePrice || 0) === nextPrice) {
      return item;
    }

    didChange = true;
    return {
      ...item,
      basePrice: nextPrice,
    };
  });

  return didChange ? nextItems : items;
}

export default function App() {
  const [siteSettings, setSiteSettings] = useState(() => normalizeSiteSettings({}));
  const documentCatalog = buildActiveDocumentCatalog(siteSettings);
  const flow = usePassportFlow(documentCatalog);
  const auth = useSupabaseAuth();
  const [cart, setCart] = useLocalStorage(STORAGE_KEYS.cart, [], LEGACY_STORAGE_KEYS.cart);
  const [localOrders, setLocalOrders] = useLocalStorage(STORAGE_KEYS.orders, [], LEGACY_STORAGE_KEYS.orders);
  const [cartOptions, setCartOptions] = useLocalStorage(STORAGE_KEYS.cartOptions, {
    premiumRetouch: false,
  });
  const [pendingPayment, setPendingPayment] = useLocalStorage(STORAGE_KEYS.pendingPayment, null);
  const [orders, setOrders] = useState(localOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dashboardState, setDashboardState] = useState({ status: 'idle', message: '' });
  const [profileState, setProfileState] = useState({ status: 'idle', message: '' });
  const [authDialogState, setAuthDialogState] = useState({
    open: false,
    mode: 'signin',
    targetView: null,
  });
  const [authFeedback, setAuthFeedback] = useState({ status: 'idle', message: '' });
  const [lastOrderId, setLastOrderId] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentState, setPaymentState] = useState({ status: 'idle', message: '' });
  const [checkoutOrigin, setCheckoutOrigin] = useState(VIEWS.cart);
  const handledStripeReturnRef = useRef(false);
  const localOrdersRef = useRef(localOrders);
  const authUserId = auth.user?.id || null;
  const premiumRetouchRequired = cartRequiresPremiumRetouch(cart);
  const premiumRetouchEnabled = cartOptions.premiumRetouch || premiumRetouchRequired;
  const totals = computeCheckoutTotals(cart, premiumRetouchEnabled, siteSettings);
  const recentOrder =
    orders.find((order) => order.id === lastOrderId) ||
    localOrders.find((order) => order.id === lastOrderId) ||
    orders[0] ||
    localOrders[0] ||
    null;

  useEffect(() => {
    let cancelled = false;

    const loadSiteSettings = async () => {
      try {
        const nextSettings = await fetchPublicSiteSettings();
        if (cancelled) return;

        setSiteSettings(nextSettings);
      } catch {
        if (cancelled) return;
      }
    };

    loadSiteSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCart((current) => syncCartPricesWithSettings(current, siteSettings));
  }, [setCart, siteSettings]);

  useEffect(() => {
    if (!cart.length && cartOptions.premiumRetouch) {
      setCartOptions({ premiumRetouch: false });
    }
  }, [cart.length, cartOptions.premiumRetouch, setCartOptions]);

  useEffect(() => {
    if (!auth.user) {
      setOrders(localOrders);
    }
  }, [auth.user, localOrders]);

  useEffect(() => {
    localOrdersRef.current = localOrders;
  }, [localOrders]);

  const finalizeVerifiedPayment = useCallback(
    async (sessionId) => {
      if (!sessionId) {
        setCheckoutLoading(false);
        setPaymentState({
          status: 'error',
          message: 'We could not confirm this payment. Please try again.',
        });
        flow.navigate(VIEWS.checkout);
        return;
      }

      if (!auth.user) {
        setCheckoutLoading(false);
        setPaymentState({
          status: 'error',
          message: 'Sign in to finish confirming this payment and save the order.',
        });
        setAuthDialogState({ open: true, mode: 'signin', targetView: VIEWS.checkout });
        flow.navigate(VIEWS.checkout);
        return;
      }

      setCheckoutLoading(false);
      setPaymentState({
        status: 'verifying',
        message: 'Verifying your payment before saving the order to your dashboard.',
      });
      flow.navigate(VIEWS.checkout);

      try {
        const verification = await verifyStripePayment(sessionId);

        const existingOrder =
          orders.find(
            (order) =>
              order.paymentReference === verification.paymentReference ||
              order.id === verification.orderReference,
          ) ||
          localOrders.find(
            (order) =>
              order.paymentReference === verification.paymentReference ||
              order.id === verification.orderReference,
          );

        if (existingOrder) {
          setLastOrderId(existingOrder.id);
          setPendingPayment(null);
          setPaymentState({ status: 'success', message: 'Payment verified successfully.' });
          flow.navigate(VIEWS.success);
          return;
        }

        if (pendingPayment?.userId && pendingPayment.userId !== auth.user.id) {
          throw new Error('This payment was started under a different account.');
        }

        const paidCart = pendingPayment?.cartSnapshot?.length ? pendingPayment.cartSnapshot : cart;
        const premiumRetouch = pendingPayment?.premiumRetouch ?? premiumRetouchEnabled;

        if (pendingPayment?.sessionId && pendingPayment.sessionId !== verification.paymentReference) {
          throw new Error('The returned payment session did not match the initialized checkout.');
        }

        if (pendingPayment?.orderReference && pendingPayment.orderReference !== verification.orderReference) {
          throw new Error('The returned order reference did not match the initialized checkout.');
        }

        if (!paidCart.length) {
          throw new Error('Payment was verified, but there are no cart items available to fulfill.');
        }

        const nextOrder = buildCompletedOrder({
          verification,
          cartItems: paidCart,
          premiumRetouch,
        });

        let syncedOrder = nextOrder;

        try {
          if (auth.configured) {
            syncedOrder = await upsertOrderForUser(nextOrder, auth.user.id);
            setDashboardState({ status: 'success', message: 'Payment verified and order saved to your account.' });
          }
        } catch (syncError) {
          setDashboardState({
            status: 'error',
            message: normalizeErrorMessage(
              syncError,
              'Payment cleared, but the dashboard sync did not finish. The download is still available in this browser session.',
            ),
          });
        }

        setLocalOrders((current) => upsertOrderInCollection(current, syncedOrder));
        setOrders((current) => upsertOrderInCollection(current, syncedOrder));
        setLastOrderId(syncedOrder.id);
        setCart([]);
        setCartOptions({ premiumRetouch: false });
        setPendingPayment(null);
        setPaymentState({ status: 'success', message: 'Payment verified successfully.' });
        flow.navigate(VIEWS.success);
      } catch (error) {
        setCheckoutLoading(false);
        setPaymentState({
          status: 'error',
          message: normalizeErrorMessage(
            error,
            'We could not confirm the payment right now. Please check again.',
          ),
        });
        flow.navigate(VIEWS.checkout);
      }
    },
    [
      auth.configured,
      auth.user,
      cart,
      flow,
      localOrders,
      orders,
      pendingPayment,
      premiumRetouchEnabled,
      setCart,
      setCartOptions,
      setLocalOrders,
      setPendingPayment,
    ],
  );

  useEffect(() => {
    if (!auth.configured || !authUserId) {
      setOrdersLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadOrders = async () => {
      setOrdersLoading(true);
      setDashboardState({ status: 'loading', message: 'Loading your saved orders.' });

      try {
        const remoteOrders = await listOrdersForUser(authUserId);
        if (cancelled) return;

        setOrders(remoteOrders);
        setLocalOrders(remoteOrders);
        setDashboardState({ status: 'success', message: 'Your order history is up to date.' });
      } catch (error) {
        if (cancelled) return;

        setOrders(localOrdersRef.current);
        setDashboardState({
          status: 'error',
          message: normalizeErrorMessage(error, 'Unable to load your orders right now.'),
        });
      } finally {
        if (!cancelled) {
          setOrdersLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, [auth.configured, authUserId, setLocalOrders]);

  useEffect(() => {
    if (auth.loading || handledStripeReturnRef.current) return;

    const paymentReturn = extractStripeReturn();
    if (!paymentReturn) return;

    handledStripeReturnRef.current = true;

    if (paymentReturn.state === 'cancelled' && !paymentReturn.sessionId) {
      clearStripeReturnFromUrl();
      setPendingPayment(null);
      setCheckoutLoading(false);
      setPaymentState({
        status: 'error',
        message: 'Checkout was cancelled before payment completed.',
      });
      flow.navigate(VIEWS.checkout);
      return;
    }

    let cancelled = false;

    const handlePaymentReturn = async () => {
      clearStripeReturnFromUrl();
      if (cancelled) return;
      await finalizeVerifiedPayment(paymentReturn.sessionId);
    };

    handlePaymentReturn();

    return () => {
      cancelled = true;
    };
  }, [
    auth.loading,
    finalizeVerifiedPayment,
    flow,
    setPendingPayment,
  ]);

  const retryPaymentVerification = async () => {
    if (!pendingPayment?.sessionId) return;
    await finalizeVerifiedPayment(pendingPayment.sessionId);
  };

  useEffect(() => {
    const titles = {
      [VIEWS.home]: 'PassportSnap',
      [VIEWS.document]: 'Choose Your Document',
      [VIEWS.capture]: 'Take a Selfie',
      [VIEWS.review]: 'Download Your Photo',
      [VIEWS.processing]: 'Getting Your Photo Ready',
      [VIEWS.result]: 'Download Your Photo',
      [VIEWS.cart]: 'Cart',
      [VIEWS.checkout]: 'Checkout',
      [VIEWS.success]: 'Order Confirmed',
      [VIEWS.dashboard]: 'Orders Dashboard',
      [VIEWS.admin]: 'Admin Dashboard',
      [VIEWS.privacy]: 'Privacy Policy',
      [VIEWS.terms]: 'Terms of Use',
    };

    document.title = titles[flow.view] || 'Passport Photo Flow';
  }, [flow.view]);

  const openAuthDialog = (mode = 'signin', targetView = null) => {
    setAuthFeedback({ status: 'idle', message: '' });
    setAuthDialogState({ open: true, mode, targetView });
  };

  const closeAuthDialog = () => {
    if (auth.busy) return;
    setAuthDialogState((current) => ({ ...current, open: false }));
  };

  const openDashboard = () => {
    if (!auth.configured) {
      flow.navigate(VIEWS.dashboard);
      return;
    }

    if (!auth.user) {
      openAuthDialog('signin', VIEWS.dashboard);
      return;
    }

    flow.navigate(VIEWS.dashboard);
  };

  const openPrivacyPage = () => {
    flow.navigate(VIEWS.privacy);
  };

  const openTermsPage = () => {
    flow.navigate(VIEWS.terms);
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setPendingPayment(null);
      setProfileState({ status: 'idle', message: '' });
      flow.navigate(VIEWS.home);
    } catch (error) {
      setDashboardState({
        status: 'error',
        message: normalizeErrorMessage(error, 'Unable to sign out right now.'),
      });
    }
  };

  const handleAuthSubmit = async (mode, payload, forcedErrorMessage = '') => {
    if (forcedErrorMessage) {
      setAuthFeedback({ status: 'error', message: forcedErrorMessage });
      return;
    }

    if (!payload) return;

    setAuthFeedback({ status: 'idle', message: '' });

    try {
      if (mode === 'signup') {
        const result = await auth.signUp(payload);

        if (result.requiresEmailVerification) {
          setAuthFeedback({
            status: 'success',
            message: `Account created for ${payload.email}. Confirm the email before signing in.`,
          });
          setAuthDialogState((current) => ({ ...current, mode: 'signin' }));
          return;
        }
      } else {
        await auth.signIn(payload);
      }

      setAuthFeedback({ status: 'success', message: 'Signed in successfully.' });
      const targetView = authDialogState.targetView;
      closeAuthDialog();

      if (targetView) {
        flow.navigate(targetView);
      }
    } catch (error) {
      setAuthFeedback({
        status: 'error',
        message: normalizeErrorMessage(error, 'Unable to complete authentication right now.'),
      });
    }
  };

  const handleStartFlow = (mode = flow.preferredCaptureMode || 'camera', documentType = flow.documents[0] || flow.selectedDocument) => {
    flow.startFlow(mode, documentType?.id || flow.selectedDocumentId);
  };

  const scrollToSection = (sectionId) => {
    const scroll = () => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    if (flow.view !== VIEWS.home) {
      flow.navigate(VIEWS.home);
      window.setTimeout(scroll, 120);
      return;
    }

    scroll();
  };

  const handleTogglePremium = () => {
    if (premiumRetouchRequired) return;
    setCartOptions((current) => ({ premiumRetouch: !current.premiumRetouch }));
  };

  const handleRemoveCartItem = (index) => {
    const nextCart = cart.filter((_, itemIndex) => itemIndex !== index);
    setCart(nextCart);
    if (!nextCart.length) {
      setCartOptions({ premiumRetouch: false });
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    if (!auth.user) {
      openAuthDialog('signin', VIEWS.dashboard);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();

    setProfileState({ status: 'saving', message: '' });

    try {
      await auth.saveProfile({ fullName, phone });
      setProfileState({ status: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setProfileState({
        status: 'error',
        message: normalizeErrorMessage(error, 'Unable to update the saved profile.'),
      });
    }
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!cart.length) return;

    if (!auth.configured) {
      setPaymentState({
        status: 'error',
        message: 'Account checkout is unavailable right now. Please try again later.',
      });
      return;
    }

    if (auth.loading || !auth.user) {
      setPaymentState({
        status: 'error',
        message: 'Create an account or sign in before payment so the order can be saved to your dashboard.',
      });
      openAuthDialog('signin', VIEWS.checkout);
      return;
    }

    setCheckoutLoading(true);
    setPaymentState({ status: 'idle', message: '' });

    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || auth.user.name || 'Customer';
    const email = auth.user.email;

    try {
      await auth.saveProfile({ fullName, phone });

      const initializedPayment = await initializeStripePayment({
        email,
        firstName,
        lastName,
        phone,
        cartItems: cart,
        premiumRetouch: premiumRetouchEnabled,
        returnUrl: buildStripeReturnUrl(),
      });

      setPendingPayment({
        sessionId: initializedPayment.sessionId,
        orderReference: initializedPayment.orderReference,
        userId: auth.user.id,
        cartSnapshot: cart,
        premiumRetouch: premiumRetouchEnabled,
        email,
        firstName,
        lastName,
        phone,
        subtotal: initializedPayment.subtotal,
        premiumFee: initializedPayment.premiumFee,
        total: initializedPayment.total,
        amountMinor: initializedPayment.amountMinor,
        currency: initializedPayment.currency,
        createdAt: new Date().toISOString(),
      });

      window.location.assign(initializedPayment.checkoutUrl);
    } catch (error) {
      setCheckoutLoading(false);
      setPaymentState({
        status: 'error',
        message: normalizeErrorMessage(
          error,
          'Unable to start secure checkout right now.',
        ),
      });
    }
  };

  const handleDownload = (item, orderId = '') => {
    if (!item?.photo) return;
    const ownerName = auth.user?.name || item.downloadOwnerName || orderId || 'customer';
    downloadImage(item.photo, formatDownloadFilename(item, ownerName));
  };

  const buildCheckoutItemFromFlowResult = () => {
    if (!flow.result?.processedPhoto || !flow.selectedDocument) {
      return null;
    }

    return {
      id: `${flow.result.id}-${flow.selectedDocument.id}`,
      resultId: flow.result.id,
      documentId: flow.selectedDocument.id,
      documentName: flow.result.documentName || flow.selectedDocument.name,
      countryLabel: flow.result.countryLabel || flow.selectedDocument.countryLabel,
      sizeLabel: flow.result.sizeLabel || flow.selectedDocument.officialSizeLabel,
      outputLabel: flow.result.outputLabel,
      flagPath: flow.result.flagPath || flow.selectedDocument.flagPath,
      backgroundLabel: flow.result.backgroundLabel || flow.selectedDocument.backgroundLabel,
      basePrice: getSiteDocumentSetting(flow.selectedDocument.id, siteSettings)?.price || flow.selectedDocument.price || 0,
      photo: flow.result.processedPhoto,
      outputWidth: flow.result.outputWidth,
      outputHeight: flow.result.outputHeight,
      statusLabel: flow.result.headline || flow.result.status,
      backgroundRemovalApplied: Boolean(flow.result.backgroundRemovalApplied),
      requiresPremiumRetouch: Boolean(flow.result.requiresPremiumRetouch),
      addedAt: new Date().toISOString(),
    };
  };

  const handleFlowDownload = () => {
    if (!flow.result?.processedPhoto || flow.result.canProceedToCheckout === false) {
      return;
    }

    const checkoutItem = buildCheckoutItemFromFlowResult();
    if (!checkoutItem) {
      return;
    }

    setCart((current) => {
      const nextCart = current.filter((item) => item.resultId !== checkoutItem.resultId);
      return [checkoutItem, ...nextCart];
    });
    setCheckoutOrigin(VIEWS.result);
    setPaymentState({ status: 'idle', message: '' });

    if (!auth.configured) {
      setPaymentState({
        status: 'error',
        message: 'Secure checkout is unavailable right now. Please try again later.',
      });
      flow.navigate(VIEWS.checkout);
      return;
    }

    if (!auth.loading && !auth.user) {
      openAuthDialog('signin', VIEWS.checkout);
      return;
    }

    flow.navigate(VIEWS.checkout);
  };

  const renderCurrentView = () => {
    switch (flow.view) {
      case VIEWS.document:
        return (
          <DocumentSelectionView
            documents={flow.documents}
            selectedDocument={flow.selectedDocument}
            onSelectDocument={flow.selectDocument}
            onStartCapture={(documentId, mode) => {
              flow.selectDocument(documentId);
              flow.continueToCapture(mode);
            }}
            onBackHome={() => flow.navigate(VIEWS.home)}
          />
        );
      case VIEWS.capture:
        return (
          <CaptureView
            selectedDocument={flow.selectedDocument}
            selectedPreset={flow.selectedPreset}
            captureMode={flow.captureMode}
            draftPhoto={flow.draftPhoto}
            onDraftChange={flow.setDraftPhoto}
            onCaptureModeChange={flow.setCaptureMode}
            onContinue={flow.startAutomaticProcessing}
            onBack={() => flow.navigate(VIEWS.document)}
          />
        );
      case VIEWS.review:
        return flow.result ? (
          <ReviewView
            result={flow.result}
            captureMode={flow.captureMode}
            onDownload={handleFlowDownload}
            onRetake={flow.retakePhoto}
            onBack={() => flow.navigate(VIEWS.capture)}
          />
        ) : (
          <CaptureView
            selectedDocument={flow.selectedDocument}
            selectedPreset={flow.selectedPreset}
            captureMode={flow.captureMode}
            draftPhoto={flow.draftPhoto}
            onDraftChange={flow.setDraftPhoto}
            onCaptureModeChange={flow.setCaptureMode}
            onContinue={flow.startAutomaticProcessing}
            onBack={() => flow.navigate(VIEWS.document)}
          />
        );
      case VIEWS.processing:
        return (
          <ProcessingView
            selectedDocument={flow.selectedDocument}
            selectedCountry={flow.selectedCountryLabel}
            selectedPreset={flow.selectedPreset}
            captureMode={flow.captureMode}
            sourcePhoto={flow.sourcePhoto}
            processingState={flow.processingState}
            onBack={flow.backToCapture}
          />
        );
      case VIEWS.result:
        return flow.result ? (
          <ReviewView
            result={flow.result}
            captureMode={flow.captureMode}
            onDownload={handleFlowDownload}
            onRetake={flow.retakePhoto}
            onBack={() => flow.navigate(VIEWS.capture)}
          />
        ) : <HomeView onStartFlow={handleStartFlow} />;
      case VIEWS.cart:
        return (
          <CartView
            cart={cart}
            totals={totals}
            premiumRetouch={premiumRetouchEnabled}
            premiumRetouchFee={siteSettings.premiumRetouchFee}
            premiumRetouchRequired={premiumRetouchRequired}
            onTogglePremium={handleTogglePremium}
            onRemoveItem={handleRemoveCartItem}
            onContinueShopping={() => handleStartFlow()}
            onProceedToCheckout={() => {
              setCheckoutOrigin(VIEWS.cart);
              flow.navigate(VIEWS.checkout);
            }}
          />
        );
      case VIEWS.checkout:
        return (
          <CheckoutView
            cart={cart}
            user={auth.user}
            authConfigured={auth.configured}
            authLoading={auth.loading}
            totals={totals}
            premiumRetouch={premiumRetouchEnabled}
            premiumRetouchFee={siteSettings.premiumRetouchFee}
            premiumRetouchRequired={premiumRetouchRequired}
            onTogglePremium={handleTogglePremium}
            paymentState={paymentState}
            canRetryVerification={Boolean(pendingPayment?.sessionId) && Boolean(auth.user)}
            onRetryVerification={retryPaymentVerification}
            onOpenAuth={() => openAuthDialog('signin', VIEWS.checkout)}
            backLabel={checkoutOrigin === VIEWS.result ? 'Back to result' : 'Back to cart'}
            onBack={() => {
              if (checkoutOrigin === VIEWS.result && flow.result) {
                flow.navigate(VIEWS.result);
                return;
              }

              flow.navigate(VIEWS.cart);
            }}
            onSubmit={handleCheckoutSubmit}
            loading={checkoutLoading}
          />
        );
      case VIEWS.success:
        return (
          <SuccessView
            order={recentOrder}
            onDownload={handleDownload}
            onBackHome={() => flow.navigate(VIEWS.home)}
            onOpenDashboard={openDashboard}
          />
        );
      case VIEWS.dashboard:
        return (
          <DashboardView
            authConfigured={auth.configured}
            authLoading={auth.loading}
            user={auth.user}
            orders={auth.user ? orders : []}
            ordersLoading={ordersLoading}
            dashboardState={dashboardState}
            profileState={profileState}
            onDownload={handleDownload}
            onOpenAuth={() => openAuthDialog('signin', VIEWS.dashboard)}
            onProfileSave={handleProfileSave}
          />
        );
      case VIEWS.admin:
        return <AdminView onSiteSettingsChange={setSiteSettings} />;
      case VIEWS.privacy:
        return (
          <LegalPageView
            eyebrow="Privacy"
            title="Privacy Policy"
            description="This page explains what Passportsnap stores and how customer data is used to complete orders and power the dashboard."
            sections={PRIVACY_SECTIONS}
            onBackHome={() => flow.navigate(VIEWS.home)}
          />
        );
      case VIEWS.terms:
        return (
          <LegalPageView
            eyebrow="Terms"
            title="Terms of Use"
            description="These terms describe the product scope, the user responsibilities in the workflow, and how completed orders are delivered."
            sections={TERMS_SECTIONS}
            onBackHome={() => flow.navigate(VIEWS.home)}
          />
        );
      case VIEWS.home:
      default:
        return <HomeView onStartFlow={handleStartFlow} />;
    }
  };

  const shouldShowNavbar = flow.view !== VIEWS.admin;
  const shouldShowFooter = [VIEWS.home, VIEWS.cart, VIEWS.dashboard, VIEWS.privacy, VIEWS.terms].includes(flow.view);
  const mainClassName = shouldShowNavbar && flow.view !== VIEWS.home ? 'pt-[var(--app-nav-height)]' : '';

  return (
    <div className="min-h-screen">
      {shouldShowNavbar ? (
        <Navbar
          isHome={flow.view === VIEWS.home}
          user={auth.user}
          cartCount={cart.length}
          onNavigateHome={() => flow.navigate(VIEWS.home)}
          onStartFlow={() => handleStartFlow()}
          onScrollToSection={scrollToSection}
          onOpenCart={() => flow.navigate(VIEWS.cart)}
          onOpenDashboard={openDashboard}
          onLogin={() => openAuthDialog('signin', VIEWS.dashboard)}
          onLogout={logout}
        />
      ) : null}

      <main className={mainClassName}>
        {renderCurrentView()}
      </main>

      {shouldShowFooter ? (
        <Footer
          onScrollToSection={scrollToSection}
          onOpenDashboard={openDashboard}
          onOpenPrivacy={openPrivacyPage}
          onOpenTerms={openTermsPage}
        />
      ) : null}

      <AuthDialog
        open={authDialogState.open}
        mode={authDialogState.mode}
        onModeChange={(mode) => setAuthDialogState((current) => ({ ...current, mode }))}
        loading={auth.busy}
        configured={auth.configured}
        errorMessage={authFeedback.status === 'error' ? authFeedback.message : ''}
        statusMessage={authFeedback.status === 'success' ? authFeedback.message : ''}
        onClose={closeAuthDialog}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
}
