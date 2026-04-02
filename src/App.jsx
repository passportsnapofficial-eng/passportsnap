import { useEffect, useRef, useState } from 'react';
import { AdminView } from './components/admin/AdminView';
import { CartView } from './components/checkout/CartView';
import { CheckoutView } from './components/checkout/CheckoutView';
import { SuccessView } from './components/checkout/SuccessView';
import { CaptureView } from './components/capture/CaptureView';
import { DashboardView } from './components/dashboard/DashboardView';
import { DocumentSelectionView } from './components/flow/DocumentSelectionView';
import { HomeView } from './components/home/HomeView';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { ProcessingView } from './components/processing/ProcessingView';
import { ResultView } from './components/result/ResultView';
import { ACTIVE_DOCUMENT } from './data/documentTypes';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePassportFlow } from './hooks/usePassportFlow';
import { computeCheckoutTotals } from './lib/checkout/pricing';
import { buildPaystackCallbackUrl, initializePaystackPayment, verifyPaystackPayment } from './lib/payments/paystackClient';
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  VIEWS,
} from './lib/utils/constants';
import { formatDownloadFilename } from './lib/utils/formatters';

function buildCartItem(result, documentType) {
  return {
    id: `cart-${result.id}`,
    resultId: result.id,
    documentId: documentType.id,
    documentName: result.documentName || documentType.name,
    countryLabel: result.countryLabel,
    sizeLabel: result.sizeLabel,
    outputLabel: result.outputLabel,
    flagPath: result.flagPath || documentType.flagPath,
    backgroundLabel: result.backgroundLabel,
    basePrice: documentType.price,
    photo: result.exportDataUrl,
    outputWidth: result.outputWidth,
    outputHeight: result.outputHeight,
    statusLabel: result.status === 'passed' ? 'Initial check passed' : 'Needs retake',
    addedAt: new Date().toISOString(),
  };
}

function buildServiceSummary(items) {
  if (!items.length) return 'Passport photo order';
  if (items.length === 1) return items[0].documentName;
  return `${items[0].documentName} + ${items.length - 1} more`;
}

function buildOrderStatus(premiumRetouch) {
  return premiumRetouch ? 'Paid - premium review requested' : 'Paid';
}

function extractPaystackReturn() {
  const url = new URL(window.location.href);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
  const state = url.searchParams.get('paystack');

  if (!reference && state !== 'cancelled') {
    return null;
  }

  return {
    reference,
    state,
  };
}

function clearPaystackReturnFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  url.searchParams.delete('paystack');
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

export default function App() {
  const flow = usePassportFlow();
  const [user, setUser] = useLocalStorage(STORAGE_KEYS.user, null, LEGACY_STORAGE_KEYS.user);
  const [cart, setCart] = useLocalStorage(STORAGE_KEYS.cart, [], LEGACY_STORAGE_KEYS.cart);
  const [orders, setOrders] = useLocalStorage(STORAGE_KEYS.orders, [], LEGACY_STORAGE_KEYS.orders);
  const [cartOptions, setCartOptions] = useLocalStorage(STORAGE_KEYS.cartOptions, {
    premiumRetouch: false,
  });
  const [pendingPayment, setPendingPayment] = useLocalStorage(STORAGE_KEYS.pendingPayment, null);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentState, setPaymentState] = useState({ status: 'idle', message: '' });
  const handledPaystackReturnRef = useRef(false);
  const dashboardUser = user || {
    name: 'Demo Account',
    role: 'user',
    email: 'demo@example.com',
  };

  const totals = computeCheckoutTotals(cart, cartOptions.premiumRetouch);

  const recentOrder = orders.find((order) => order.id === lastOrderId) || orders[0];

  useEffect(() => {
    if (!cart.length && cartOptions.premiumRetouch) {
      setCartOptions({ premiumRetouch: false });
    }
  }, [cart.length, cartOptions.premiumRetouch, setCartOptions]);

  useEffect(() => {
    if (handledPaystackReturnRef.current) return;

    const paymentReturn = extractPaystackReturn();
    if (!paymentReturn) return;

    handledPaystackReturnRef.current = true;

    if (paymentReturn.state === 'cancelled' && !paymentReturn.reference) {
      clearPaystackReturnFromUrl();
      setPendingPayment(null);
      setCheckoutLoading(false);
      setPaymentState({
        status: 'error',
        message: 'The Paystack checkout was cancelled before payment completed.',
      });
      flow.navigate(VIEWS.checkout);
      return;
    }

    let cancelled = false;

    const finalizeVerifiedPayment = async () => {
      if (!paymentReturn.reference) {
        clearPaystackReturnFromUrl();
        setCheckoutLoading(false);
        setPaymentState({
          status: 'error',
          message: 'No payment reference was returned from Paystack.',
        });
        flow.navigate(VIEWS.checkout);
        return;
      }

      setCheckoutLoading(false);
      setPaymentState({
        status: 'verifying',
        message: 'Verifying your Paystack payment before releasing the order.',
      });
      flow.navigate(VIEWS.checkout);

      try {
        const verification = await verifyPaystackPayment(paymentReturn.reference);
        if (cancelled) return;

        const existingOrder = orders.find(
          (order) =>
            order.paymentReference === verification.reference || order.id === verification.reference,
        );

        if (existingOrder) {
          setLastOrderId(existingOrder.id);
          setPendingPayment(null);
          setPaymentState({ status: 'success', message: 'Payment verified successfully.' });
          clearPaystackReturnFromUrl();
          flow.navigate(VIEWS.success);
          return;
        }

        const paidCart = pendingPayment?.cartSnapshot?.length ? pendingPayment.cartSnapshot : cart;
        const premiumRetouch = pendingPayment?.premiumRetouch ?? cartOptions.premiumRetouch;
        const paidTotals = computeCheckoutTotals(paidCart, premiumRetouch);

        if (pendingPayment?.reference && pendingPayment.reference !== verification.reference) {
          throw new Error('The returned payment reference did not match the initialized checkout.');
        }

        if (!paidCart.length) {
          throw new Error('Payment was verified, but there are no cart items available to fulfill.');
        }

        const orderItems = paidCart.map((item) => ({
          ...item,
          premiumRetouch,
        }));
        const nextOrder = {
          id: verification.reference,
          date: verification.paidAt || new Date().toISOString(),
          status: buildOrderStatus(premiumRetouch),
          subtotal: paidTotals.subtotal,
          premiumRetouch,
          premiumFee: paidTotals.premiumFee,
          total: verification.amount,
          paymentCurrency: verification.currency,
          paymentChannel: verification.channel,
          paymentGatewayResponse: verification.gatewayResponse,
          paymentReference: verification.reference,
          paymentVerifiedAt: new Date().toISOString(),
          items: orderItems,
          serviceSummary: buildServiceSummary(orderItems),
        };

        setOrders((current) => [nextOrder, ...current]);
        setLastOrderId(nextOrder.id);
        setCart([]);
        setCartOptions({ premiumRetouch: false });
        setPendingPayment(null);
        setPaymentState({ status: 'success', message: 'Payment verified successfully.' });
        clearPaystackReturnFromUrl();
        flow.navigate(VIEWS.success);
      } catch (error) {
        if (cancelled) return;

        clearPaystackReturnFromUrl();
        setPendingPayment(null);
        setCheckoutLoading(false);
        setPaymentState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Paystack verification failed. No files were released.',
        });
        flow.navigate(VIEWS.checkout);
      }
    };

    finalizeVerifiedPayment();

    return () => {
      cancelled = true;
    };
  }, [
    cart,
    cartOptions.premiumRetouch,
    flow,
    orders,
    pendingPayment,
    setCart,
    setCartOptions,
    setOrders,
    setPendingPayment,
  ]);

  useEffect(() => {
    const titles = {
      [VIEWS.home]: 'Passport Photo Flow',
      [VIEWS.document]: 'Choose Document',
      [VIEWS.capture]: 'Capture Photo',
      [VIEWS.processing]: 'Processing Photo',
      [VIEWS.result]: 'Review Result',
      [VIEWS.cart]: 'Cart',
      [VIEWS.checkout]: 'Checkout',
      [VIEWS.success]: 'Order Confirmed',
      [VIEWS.dashboard]: 'Orders Dashboard',
      [VIEWS.admin]: 'Admin Demo',
    };

    document.title = titles[flow.view] || 'Passport Photo Flow';
  }, [flow.view]);

  const ensureDemoUser = () => {
    const demoUser =
      user ||
      {
        name: 'Demo Account',
        role: 'user',
        email: 'demo@example.com',
      };
    if (!user) {
      setUser(demoUser);
    }
    return demoUser;
  };

  const openDashboard = () => {
    const account = ensureDemoUser();
    flow.navigate(account.role === 'admin' ? VIEWS.admin : VIEWS.dashboard);
  };

  const openAdminDemo = () => {
    setUser({
      name: 'Admin Review',
      role: 'admin',
      email: 'admin@example.com',
    });
    flow.navigate(VIEWS.admin);
  };

  const logout = () => {
    setUser(null);
    setPendingPayment(null);
    flow.navigate(VIEWS.home);
  };

  const handleStartFlow = (mode = 'camera', documentType = ACTIVE_DOCUMENT) => {
    flow.startFlow(mode, documentType.id);
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
    setCartOptions((current) => ({ premiumRetouch: !current.premiumRetouch }));
  };

  const handleRemoveCartItem = (index) => {
    const nextCart = cart.filter((_, itemIndex) => itemIndex !== index);
    setCart(nextCart);
    if (!nextCart.length) {
      setCartOptions({ premiumRetouch: false });
    }
  };

  const ensureCurrentResultInCart = () => {
    if (!flow.result || flow.result.status !== 'passed') return;

    setCart((current) => {
      if (current.some((item) => item.resultId === flow.result.id)) {
        return current;
      }

      return [...current, buildCartItem(flow.result, flow.selectedDocument)];
    });
  };

  const goToCheckoutFromResult = () => {
    ensureCurrentResultInCart();
    flow.navigate(VIEWS.checkout);
  };

  const goToCartFromResult = () => {
    ensureCurrentResultInCart();
    flow.navigate(VIEWS.cart);
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!cart.length) return;

    setCheckoutLoading(true);
    setPaymentState({ status: 'idle', message: '' });

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();

    if (email) {
      setUser((currentUser) => ({
        name:
          [firstName, lastName].filter(Boolean).join(' ') ||
          currentUser?.name ||
          'Customer',
        role: currentUser?.role || 'user',
        email,
      }));
    }

    try {
      const initializedPayment = await initializePaystackPayment({
        email,
        firstName,
        lastName,
        phone,
        cartItems: cart,
        premiumRetouch: cartOptions.premiumRetouch,
        callbackUrl: buildPaystackCallbackUrl(),
      });

      setPendingPayment({
        reference: initializedPayment.reference,
        cartSnapshot: cart,
        premiumRetouch: cartOptions.premiumRetouch,
        email,
        firstName,
        lastName,
        phone,
        total: initializedPayment.amount,
        amountMinor: initializedPayment.amountMinor,
        currency: initializedPayment.currency,
        createdAt: new Date().toISOString(),
      });

      window.location.assign(initializedPayment.authorizationUrl);
    } catch (error) {
      setCheckoutLoading(false);
      setPaymentState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to start the secure Paystack checkout.',
      });
    }
  };

  const handleDownload = (item, orderId = '') => {
    if (!item?.photo) return;
    downloadImage(item.photo, formatDownloadFilename(item, orderId));
  };

  const renderCurrentView = () => {
    switch (flow.view) {
      case VIEWS.document:
        return (
          <DocumentSelectionView
            documents={flow.documents}
            selectedDocument={flow.selectedDocument}
            preferredCaptureMode={flow.preferredCaptureMode}
            onChangeMode={flow.setCaptureMode}
            onSelectDocument={flow.selectDocument}
            onContinue={flow.continueToCapture}
            onBackHome={() => flow.navigate(VIEWS.home)}
          />
        );
      case VIEWS.capture:
        return (
          <CaptureView
            selectedDocument={flow.selectedDocument}
            selectedPreset={flow.selectedPreset}
            captureMode={flow.captureMode}
            onCaptureModeChange={flow.setCaptureMode}
            onPhotoReady={flow.submitPhoto}
            onBack={() => flow.navigate(VIEWS.document)}
          />
        );
      case VIEWS.processing:
        return (
          <ProcessingView
            selectedDocument={flow.selectedDocument}
            selectedCountry={flow.selectedCountryLabel}
            selectedPreset={flow.selectedPreset}
            sourcePhoto={flow.sourcePhoto}
            processingState={flow.processingState}
            onBack={flow.retakePhoto}
          />
        );
      case VIEWS.result:
        return flow.result ? (
          <ResultView
            result={flow.result}
            onProceedToCheckout={goToCheckoutFromResult}
            onReviewCart={goToCartFromResult}
            onRetake={flow.retakePhoto}
          />
        ) : (
          <HomeView onStartFlow={handleStartFlow} />
        );
      case VIEWS.cart:
        return (
          <CartView
            cart={cart}
            totals={totals}
            premiumRetouch={cartOptions.premiumRetouch}
            onTogglePremium={handleTogglePremium}
            onRemoveItem={handleRemoveCartItem}
            onContinueShopping={() => handleStartFlow('camera')}
            onProceedToCheckout={() => flow.navigate(VIEWS.checkout)}
          />
        );
      case VIEWS.checkout:
        return (
          <CheckoutView
            cart={cart}
            user={user}
            totals={totals}
            premiumRetouch={cartOptions.premiumRetouch}
            onTogglePremium={handleTogglePremium}
            paymentState={paymentState}
            onBack={() => {
              const checkoutMatchesCurrentResult =
                flow.result && cart.length === 1 && cart[0]?.resultId === flow.result.id;

              if (checkoutMatchesCurrentResult) {
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
        return <DashboardView user={dashboardUser} orders={orders} onDownload={handleDownload} />;
      case VIEWS.admin:
        return <AdminView />;
      case VIEWS.home:
      default:
        return <HomeView onStartFlow={handleStartFlow} />;
    }
  };

  const shouldShowNavbar = [VIEWS.home, VIEWS.cart, VIEWS.dashboard].includes(flow.view);
  const shouldShowFooter = [VIEWS.home, VIEWS.cart, VIEWS.dashboard].includes(flow.view);

  return (
    <div className="min-h-screen">
      {shouldShowNavbar ? (
        <Navbar
          user={user}
          cartCount={cart.length}
          currentView={flow.view}
          onNavigateHome={() => flow.navigate(VIEWS.home)}
          onScrollToSection={scrollToSection}
          onOpenCart={() => flow.navigate(VIEWS.cart)}
          onOpenDashboard={openDashboard}
          onLogin={openDashboard}
          onLogout={logout}
          onStartFlow={handleStartFlow}
        />
      ) : null}

      <main>{renderCurrentView()}</main>

      {shouldShowFooter ? (
        <Footer
          onScrollToSection={scrollToSection}
          onStartFlow={(mode) => handleStartFlow(mode)}
          onOpenDashboard={openDashboard}
          onOpenAdmin={openAdminDemo}
        />
      ) : null}
    </div>
  );
}
