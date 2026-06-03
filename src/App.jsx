import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AdminView } from './components/admin/AdminView';
import { AboutView } from './components/about/AboutView';
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
import {
  computeCheckoutTotals,
  DEFAULT_PRINT_COPIES,
  getPhotoPackageLabel,
  normalizeCheckoutOptions,
  PHOTO_PACKAGE_TYPES,
} from './lib/checkout/pricing';
import { requestOrderDeliveryEmail } from './lib/orders/orderDeliveryClient.js';
import { recordOrderForAdmin } from './lib/orders/orderRecordClient.js';
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

function getDefaultCartOptions() {
  return {
    photoPackage: PHOTO_PACKAGE_TYPES.digital,
    printCopies: DEFAULT_PRINT_COPIES,
    complianceCheck: false,
    photoRetouching: false,
    premiumRetouch: false,
  };
}

function getResolvedCheckoutOptions(cartOptions, premiumRetouchRequired) {
  return normalizeCheckoutOptions(cartOptions, premiumRetouchRequired);
}

function buildServiceSummary(items, checkoutOptions = getDefaultCartOptions()) {
  if (!items.length) return 'Passport photo order';
  const base =
    items.length === 1
      ? items[0].documentName
      : `${items[0].documentName} + ${items.length - 1} more`;
  const extras = [
    getPhotoPackageLabel(checkoutOptions.photoPackage, checkoutOptions.printCopies),
    checkoutOptions.complianceCheck ? 'Compliance check' : null,
    checkoutOptions.photoRetouching ? 'Photo retouching' : null,
    checkoutOptions.premiumRetouch ? 'Background cleanup' : null,
  ].filter(Boolean);
  return `${base} · ${extras.join(' · ')}`;
}

function buildOrderStatus(options) {
  if (options.photoRetouching || options.complianceCheck || options.premiumRetouch) {
    return 'Paid - fulfillment pending';
  }

  if (options.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints) {
    return 'Paid - print delivery pending';
  }

  return 'Paid';
}

function buildCompletedOrder({ verification, cartItems, checkoutOptions }) {
  const customerName = verification.customer?.name || 'Customer';
  const customerFirstName = verification.customer?.firstName || '';
  const customerLastName = verification.customer?.lastName || '';
  const customerEmail = verification.customer?.email || '';
  const customerPhone = verification.customer?.phone || '';
  const shippingAddress = verification.shippingAddress || null;
  const downloadOwnerName = customerName;
  const orderItems = cartItems.map((item) => ({
    ...item,
    premiumRetouch: checkoutOptions.premiumRetouch,
    photoPackage: checkoutOptions.photoPackage,
    printCopies: checkoutOptions.printCopies,
    complianceCheck: checkoutOptions.complianceCheck,
    photoRetouching: checkoutOptions.photoRetouching,
    customerName,
    customerFirstName,
    customerLastName,
    customerEmail,
    customerPhone,
    receiptEmail: customerEmail,
    deliveryEmail: verification.deliveryEmail || verification.customer?.email || '',
    shippingAddress,
    manualFulfillmentRequired: Boolean(
      verification.complianceCheck || verification.photoRetouching || verification.premiumRetouch,
    ),
    downloadOwnerName,
  }));

  return {
    id: verification.orderReference || verification.paymentReference,
    date: verification.paidAt || new Date().toISOString(),
    status: buildOrderStatus(checkoutOptions),
    subtotal: Number(verification.subtotal || 0),
    photoPackage: verification.photoPackage || checkoutOptions.photoPackage,
    printCopies: Number(verification.printCopies || checkoutOptions.printCopies || DEFAULT_PRINT_COPIES),
    printPackageFee: Number(verification.printPackageFee || 0),
    complianceCheck: Boolean(verification.complianceCheck ?? checkoutOptions.complianceCheck),
    complianceCheckFee: Number(verification.complianceCheckFee || 0),
    photoRetouching: Boolean(verification.photoRetouching ?? checkoutOptions.photoRetouching),
    photoRetouchingFee: Number(verification.photoRetouchingFee || 0),
    premiumRetouch: Boolean(verification.premiumRetouch ?? checkoutOptions.premiumRetouch),
    premiumFee: Number(verification.premiumFee || 0),
    total: Number(verification.total || verification.amount || 0),
    paymentCurrency: verification.currency,
    paymentChannel: verification.channel,
    paymentGatewayResponse: verification.gatewayResponse,
    paymentReference: verification.paymentReference,
    paymentVerifiedAt: new Date().toISOString(),
    guestCheckout: !verification.savedToDashboard,
    emailDeliveryStatus: 'pending',
    emailDeliveryMessage: '',
    items: orderItems,
    serviceSummary: buildServiceSummary(orderItems, checkoutOptions),
  };
}

async function sendFinishedOrderEmail(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const hasDeliverableImage = items.some((item) => {
    if (item?.fulfilledPhoto) {
      return true;
    }

    return !item?.manualFulfillmentRequired && Boolean(item?.photo);
  });

  if (!order || !hasDeliverableImage) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_finished_images',
      status: 'pending_manual_fulfillment',
      message: 'The final photo will be emailed after fulfillment is completed.',
    };
  }

  try {
    const result = await requestOrderDeliveryEmail({
      orderId: order.id,
      paymentReference: order.paymentReference,
      total: order.total,
      currency: order.paymentCurrency,
      customerName: items[0]?.customerName || '',
      customerEmail: items[0]?.customerEmail || '',
      receiptEmail: items[0]?.receiptEmail || '',
      deliveryEmail: items[0]?.deliveryEmail || '',
      items,
    });
    return {
      ...result,
      status: result?.ok ? 'sent' : 'not_sent',
      message: result?.ok
        ? `Finished photo emailed to ${result.recipientEmail}.`
        : 'The finished photo email could not be confirmed.',
    };
  } catch {
    return {
      ok: false,
      skipped: true,
      reason: 'delivery_failed',
      status: 'failed',
      message: 'The photo is ready, but the email delivery did not complete.',
    };
  }
}

function upsertOrderInCollection(collection, order) {
  return [order, ...collection.filter((entry) => entry.id !== order.id)];
}

function normalizeEmailAddress(value = '') {
  return String(value || '').trim().toLowerCase();
}

function orderMatchesUserEmail(order, userEmail = '') {
  const normalizedUserEmail = normalizeEmailAddress(userEmail);
  if (!normalizedUserEmail) {
    return false;
  }

  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const orderEmails = orderItems.flatMap((item) => ([
    item?.customerEmail,
    item?.receiptEmail,
    item?.deliveryEmail,
  ].map(normalizeEmailAddress))).filter(Boolean);

  return orderEmails.includes(normalizedUserEmail);
}

function dedupeOrdersByIdentity(orders = []) {
  const seen = new Set();

  return orders.filter((order) => {
    const key = `${String(order?.id || '').trim()}::${String(order?.paymentReference || '').trim()}`;
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractStripeReturn() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get('session_id');
  const state = url.searchParams.get('stripe');
  const normalizedSessionId =
    sessionId && sessionId !== '{CHECKOUT_SESSION_ID}'
      ? sessionId
      : null;

  if (!normalizedSessionId && state !== 'cancelled' && sessionId !== '{CHECKOUT_SESSION_ID}') {
    return null;
  }

  return {
    sessionId: normalizedSessionId,
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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shouldRetryPaymentVerification(error) {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error?.message === 'string'
          ? error.message
          : '';

  const normalizedMessage = String(message).toLowerCase();
  const statusCode =
    typeof error?.statusCode === 'number'
      ? error.statusCode
      : typeof error?.payload?.statusCode === 'number'
        ? error.payload.statusCode
        : null;

  return (
    statusCode === 500 ||
    statusCode === 409 ||
    normalizedMessage.includes('unable to verify payment right now') ||
    normalizedMessage.includes('unable to confirm this payment right now') ||
    normalizedMessage.includes('payment is not confirmed yet') ||
    normalizedMessage.includes('payment verification is taking too long') ||
    normalizedMessage.includes('please check again')
  );
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

function buildCheckoutCartPayload(items = []) {
  return items.map((item) => ({
    documentId: String(item?.documentId || '').trim(),
    requiresPremiumRetouch: Boolean(item?.requiresPremiumRetouch),
  }));
}

export default function App() {
  const [siteSettings, setSiteSettings] = useState(() => normalizeSiteSettings({}));
  const documentCatalog = buildActiveDocumentCatalog(siteSettings);
  const flow = usePassportFlow(documentCatalog);
  const auth = useSupabaseAuth();
  const [isNavigating, startNavigation] = useTransition();
  const [cart, setCart] = useLocalStorage(STORAGE_KEYS.cart, [], LEGACY_STORAGE_KEYS.cart);
  const [localOrders, setLocalOrders] = useLocalStorage(STORAGE_KEYS.orders, [], LEGACY_STORAGE_KEYS.orders);
  const [cartOptions, setCartOptions] = useLocalStorage(STORAGE_KEYS.cartOptions, getDefaultCartOptions());
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
  const checkoutOptions = getResolvedCheckoutOptions(cartOptions, premiumRetouchRequired);
  const totals = computeCheckoutTotals(cart, checkoutOptions, siteSettings, premiumRetouchRequired);
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
    if (!cart.length) {
      setCartOptions(getDefaultCartOptions());
    }
  }, [cart.length, setCartOptions]);

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

      setCheckoutLoading(false);
      setPaymentState({
        status: 'verifying',
        message: auth.user
          ? 'Verifying your payment and saving the order.'
          : 'Verifying your payment and preparing the order.',
      });
      flow.navigate(VIEWS.checkout);

      try {
        let verification = null;
        let lastVerificationError = null;

        for (let attempt = 0; attempt < 12; attempt += 1) {
          try {
            verification = await verifyStripePayment(sessionId);
            lastVerificationError = null;
            break;
          } catch (error) {
            lastVerificationError = error;

            if (!shouldRetryPaymentVerification(error) || attempt === 5) {
              throw error;
            }

            setPaymentState({
              status: 'verifying',
              message: `Confirming payment with Stripe${attempt >= 2 ? ' still' : ''}. Please wait...`,
            });
            await wait(attempt >= 5 ? 3000 : 2000);
          }
        }

        if (!verification) {
          throw lastVerificationError || new Error('Unable to verify payment right now.');
        }

        const verifiedSessionId = String(
          verification.sessionId || verification.paymentReference || '',
        ).trim();

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

        if (pendingPayment?.userId && auth.user && pendingPayment.userId !== auth.user.id) {
          throw new Error('This payment was started under a different account.');
        }

        const paidCart = pendingPayment?.cartSnapshot?.length ? pendingPayment.cartSnapshot : cart;
        const paidCheckoutOptions = getResolvedCheckoutOptions(
          pendingPayment?.checkoutOptions || checkoutOptions,
          premiumRetouchRequired,
        );

        if (pendingPayment?.sessionId && pendingPayment.sessionId !== verifiedSessionId) {
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
          checkoutOptions: paidCheckoutOptions,
        });

        let syncedOrder = nextOrder;
        let savedToDashboard = false;

        try {
          if (auth.configured && auth.user) {
            syncedOrder = await upsertOrderForUser(nextOrder, auth.user.id);
            savedToDashboard = true;
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

        syncedOrder = {
          ...syncedOrder,
          guestCheckout: !savedToDashboard,
        };

        const emailDelivery = await sendFinishedOrderEmail(syncedOrder);

        syncedOrder = {
          ...syncedOrder,
          emailDeliveryStatus: emailDelivery?.status || 'failed',
          emailDeliveryMessage: emailDelivery?.message || '',
        };

        try {
          await recordOrderForAdmin(syncedOrder);
        } catch {
          setDashboardState((current) => (
            current.status === 'error'
              ? current
              : {
                  status: 'error',
                  message: 'Payment cleared, but the admin image archive did not finish syncing.',
                }
          ));
        }

        setLocalOrders((current) => upsertOrderInCollection(current, syncedOrder));
        setOrders((current) => upsertOrderInCollection(current, syncedOrder));
        setLastOrderId(syncedOrder.id);
        setCart([]);
        setCartOptions(getDefaultCartOptions());
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
      checkoutOptions,
      premiumRetouchRequired,
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

        const matchingGuestOrders = dedupeOrdersByIdentity(
          localOrdersRef.current.filter(
            (order) =>
              order?.guestCheckout &&
              orderMatchesUserEmail(order, auth.user?.email || ''),
          ),
        );

        let nextOrders = remoteOrders;

        if (matchingGuestOrders.length) {
          const syncedGuestOrders = [];

          for (const guestOrder of matchingGuestOrders) {
            const syncedGuestOrder = await upsertOrderForUser(
              {
                ...guestOrder,
                guestCheckout: false,
              },
              authUserId,
            );

            syncedGuestOrders.push({
              ...syncedGuestOrder,
              guestCheckout: false,
            });
          }

          nextOrders = dedupeOrdersByIdentity([
            ...syncedGuestOrders,
            ...remoteOrders,
          ]);

          if (!cancelled) {
            setDashboardState({
              status: 'success',
              message: 'Payment successful. Your paid photos were saved to your dashboard.',
            });
          }
        } else {
          setDashboardState({ status: 'success', message: 'Your order history is up to date.' });
        }

        setOrders(nextOrders);
        setLocalOrders(nextOrders);
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
  }, [auth.configured, auth.user?.email, authUserId, setLocalOrders]);

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
      await finalizeVerifiedPayment(paymentReturn.sessionId || pendingPayment?.sessionId || '');
    };

    handlePaymentReturn();

    return () => {
      cancelled = true;
    };
  }, [
    auth.loading,
    finalizeVerifiedPayment,
    flow,
    pendingPayment?.sessionId,
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
      [VIEWS.review]: 'Review Your Photo',
      [VIEWS.processing]: 'Getting Your Photo Ready',
      [VIEWS.result]: 'Review Your Photo',
      [VIEWS.cart]: 'Cart',
      [VIEWS.checkout]: 'Checkout',
      [VIEWS.success]: 'Order Confirmed',
      [VIEWS.dashboard]: 'Orders Dashboard',
      [VIEWS.admin]: 'Admin Dashboard',
      [VIEWS.about]: 'About PassportSnap',
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

  const openAboutPage = () => {
    flow.navigate(VIEWS.about);
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
    setCartOptions((current) => ({ ...current, premiumRetouch: !current.premiumRetouch }));
  };

  const handlePhotoPackageChange = (photoPackage) => {
    setCartOptions((current) => ({ ...current, photoPackage }));
  };

  const handlePrintCopiesChange = (printCopies) => {
    setCartOptions((current) => ({ ...current, printCopies }));
  };

  const handleComplianceCheckToggle = () => {
    setCartOptions((current) => ({ ...current, complianceCheck: !current.complianceCheck }));
  };

  const handlePhotoRetouchingToggle = () => {
    setCartOptions((current) => ({ ...current, photoRetouching: !current.photoRetouching }));
  };

  const handleRemoveCartItem = (index) => {
    const nextCart = cart.filter((_, itemIndex) => itemIndex !== index);
    setCart(nextCart);
    if (!nextCart.length) {
      setCartOptions(getDefaultCartOptions());
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

    if (auth.loading) {
      setPaymentState({
        status: 'error',
        message: 'Account status is still loading. Please try again in a moment.',
      });
      return;
    }

    setCheckoutLoading(true);
    setPaymentState({ status: 'idle', message: '' });

    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const deliveryEmail = String(formData.get('deliveryEmail') || '').trim();
    const addressLine1 = String(formData.get('addressLine1') || '').trim();
    const addressLine2 = String(formData.get('addressLine2') || '').trim();
    const city = String(formData.get('city') || '').trim();
    const stateProvince = String(formData.get('stateProvince') || '').trim();
    const postalCode = String(formData.get('postalCode') || '').trim();
    const country = String(formData.get('country') || '').trim();
    const requiresPhysicalDeliveryAddress = checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints;
    const shippingAddress = requiresPhysicalDeliveryAddress
      ? {
          addressLine1,
          addressLine2,
          city,
          stateProvince,
          postalCode,
          country,
        }
      : null;

    const manualFulfillmentRequired =
      checkoutOptions.complianceCheck || checkoutOptions.photoRetouching || checkoutOptions.premiumRetouch;
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    // Manual services (compliance/retouch/premium) deliver the corrected digital
    // image by email even for print orders, so always fall back to the customer's
    // email here. The server rejects manual-service orders with no delivery email.
    const resolvedDeliveryEmail = deliveryEmail || email;

    try {
      if (auth.user && (fullName || phone)) {
        await auth.saveProfile({ fullName, phone });
      }

      const initializedPayment = await initializeStripePayment({
        email,
        firstName,
        lastName,
        phone,
        deliveryEmail: manualFulfillmentRequired ? resolvedDeliveryEmail : '',
        shippingAddress,
        cartItems: buildCheckoutCartPayload(cart),
        checkoutOptions,
        returnUrl: buildStripeReturnUrl(),
      });

      setPendingPayment({
        sessionId: initializedPayment.sessionId,
        orderReference: initializedPayment.orderReference,
        userId: auth.user?.id || null,
        cartSnapshot: cart,
        checkoutOptions,
        email,
        firstName,
        lastName,
        phone,
        deliveryEmail: manualFulfillmentRequired ? resolvedDeliveryEmail : '',
        shippingAddress,
        subtotal: initializedPayment.subtotal,
        printCopies: initializedPayment.printCopies,
        printPackageFee: initializedPayment.printPackageFee,
        complianceCheckFee: initializedPayment.complianceCheckFee,
        photoRetouchingFee: initializedPayment.photoRetouchingFee,
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
    const imageUrl = item?.fulfilledPhoto || item?.photo;
    if (!imageUrl) return;
    const ownerName = auth.user?.name || item.downloadOwnerName || orderId || 'customer';
    downloadImage(imageUrl, formatDownloadFilename(item, ownerName));
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
      sourcePhoto: flow.result.sourcePhoto || '',
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

    // Auth dialog must open immediately (synchronous), not inside a transition.
    // Batch all cart mutations + the view switch together as a single
    // non-urgent transition so the button paints feedback instantly.
    startNavigation(() => {
      setCart((current) => {
        const nextCart = current.filter((item) => item.resultId !== checkoutItem.resultId);
        return [checkoutItem, ...nextCart];
      });
      setCheckoutOrigin(VIEWS.result);

      setPaymentState({ status: 'idle', message: '' });

      flow.navigate(VIEWS.checkout);
    });
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
            draftPhotoAdjustments={flow.draftPhotoAdjustments}
            onDraftChange={flow.setDraftPhoto}
            onDraftPhotoAdjustmentsChange={flow.setDraftPhotoAdjustments}
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
            isNavigating={isNavigating}
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
            draftPhotoAdjustments={flow.draftPhotoAdjustments}
            onDraftChange={flow.setDraftPhoto}
            onDraftPhotoAdjustmentsChange={flow.setDraftPhotoAdjustments}
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
            isNavigating={isNavigating}
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
            checkoutOptions={checkoutOptions}
            printCopyFees={siteSettings}
            complianceCheckFee={siteSettings.complianceCheckFee}
            photoRetouchingFee={siteSettings.photoRetouchingFee}
            premiumRetouchFee={siteSettings.premiumRetouchFee}
            premiumRetouchRequired={premiumRetouchRequired}
            onPhotoPackageChange={handlePhotoPackageChange}
            onPrintCopiesChange={handlePrintCopiesChange}
            onToggleComplianceCheck={handleComplianceCheckToggle}
            onTogglePhotoRetouching={handlePhotoRetouchingToggle}
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
            checkoutOptions={checkoutOptions}
            printCopyFees={siteSettings}
            complianceCheckFee={siteSettings.complianceCheckFee}
            photoRetouchingFee={siteSettings.photoRetouchingFee}
            premiumRetouchFee={siteSettings.premiumRetouchFee}
            premiumRetouchRequired={premiumRetouchRequired}
            onPhotoPackageChange={handlePhotoPackageChange}
            onPrintCopiesChange={handlePrintCopiesChange}
            onToggleComplianceCheck={handleComplianceCheckToggle}
            onTogglePhotoRetouching={handlePhotoRetouchingToggle}
            onTogglePremium={handleTogglePremium}
            onOpenPrivacy={openPrivacyPage}
            onOpenTerms={openTermsPage}
            paymentState={paymentState}
            canRetryVerification={Boolean(pendingPayment?.sessionId)}
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
      case VIEWS.about:
        return (
          <AboutView
            onBackHome={() => flow.navigate(VIEWS.home)}
            onStartFlow={handleStartFlow}
          />
        );
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
  const shouldShowFooter = [VIEWS.home, VIEWS.cart, VIEWS.dashboard, VIEWS.about, VIEWS.privacy, VIEWS.terms].includes(flow.view);
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
          onOpenAbout={openAboutPage}
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
          onOpenAbout={openAboutPage}
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
