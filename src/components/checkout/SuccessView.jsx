import { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Download,
  Eye,
  Image as ImageIcon,
  LayoutDashboard,
  MailWarning,
  MapPinned,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getPhotoPackageLabel } from '../../lib/checkout/pricing';
import { formatCurrency, formatDate } from '../../lib/utils/formatters';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';

function SuccessIcon() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-[0_28px_60px_-34px_rgba(22,163,74,0.45)]">
      <div className="absolute inset-2 rounded-full bg-emerald-500" />
      <BadgeCheck className="relative z-10 h-10 w-10 text-white" />
      <div className="absolute -right-7 top-3 h-2.5 w-2.5 rounded-full bg-blue-200" />
      <div className="absolute -right-3 -top-2 h-3.5 w-3.5 rounded-full bg-emerald-200" />
      <div className="absolute left-[105%] top-10 h-2 w-2 rounded-full bg-sky-200" />
      <div className="absolute -right-12 top-8 h-px w-5 rotate-[22deg] bg-blue-200" />
    </div>
  );
}

function StatItem({ icon, label, value, valueClassName = '' }) {
  return (
    <div className="min-w-0 rounded-[22px] border border-slate-100 bg-white/80 px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </div>
          <div className={`mt-1 min-w-0 text-sm font-semibold text-slate-950 sm:text-[0.96rem] ${valueClassName}`.trim()}>
            {value || 'Not available'}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTile({
  icon,
  label,
  value,
  className = '',
  valueClassName = '',
  truncate = false,
  title = '',
}) {
  return (
    <div className={`min-w-0 rounded-[18px] border border-slate-200/80 bg-white/88 p-4 ${className}`.trim()}>
      <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div
        title={title || (typeof value === 'string' ? value : undefined)}
        className={[
          'mt-2 min-w-0 text-sm font-bold text-slate-950',
          truncate
            ? 'overflow-hidden text-ellipsis whitespace-nowrap'
            : '[overflow-wrap:anywhere] break-words',
          valueClassName,
        ].join(' ')}
      >
        {value || 'Not available'}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value, valueClassName = '' }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div className="text-sm font-medium text-slate-600">{label}</div>
      </div>
      <div className={`min-w-0 text-sm font-semibold text-slate-950 sm:max-w-[58%] sm:text-right ${valueClassName}`.trim()}>
        {value || 'Not available'}
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-medium leading-6 text-slate-900">{value || 'Not available'}</div>
      </div>
    </div>
  );
}

function StatusPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      {children}
    </span>
  );
}

function SafetyBadges() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        'Payment confirmed',
        'Image info protected',
        'Money-back guarantee',
      ].map((badge) => (
        <div key={badge} className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{badge}</span>
        </div>
      ))}
    </div>
  );
}

function PreviewModal({ item, open, onClose }) {
  if (!open || !item?.photo) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[36rem] rounded-[28px] border border-white/10 bg-white p-4 shadow-[0_40px_120px_-36px_rgba(15,23,42,0.68)] sm:p-5">
        <button
          type="button"
          onClick={onClose}
          className="secondary-button absolute right-3 top-3 min-h-10 px-4 py-2 text-xs"
        >
          Close
        </button>
        <div className="pr-20">
          <div className="text-lg font-semibold text-slate-950">Preview image</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This is the final version of your photo, processed and ready for use.
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3">
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <ProtectedPhotoPreview
              src={item.fulfilledPhoto || item.photo}
              alt={`${item.documentName || 'Passport photo'} preview`}
              watermarkEnabled={Boolean(item.backgroundRemovalApplied)}
              className="bg-white"
              aspectRatio={`${item.outputWidth || 600} / ${item.outputHeight || 600}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveHeroDescription(order, emailDelivered) {
  if (!order) return '';
  if (order.guestCheckout) {
    return emailDelivered
      ? 'Your payment went through. Your passport photo is ready to download and was emailed to you.'
      : 'Your payment went through. Your passport photo is ready to download.';
  }

  return emailDelivered
    ? 'Your payment went through. Your passport photo is ready to download and saved to your dashboard.'
    : 'Your payment went through. Your passport photo is ready to download and saved to your dashboard.';
}

function resolveResolutionLabel(item) {
  const width = Number(item?.outputWidth || 0);
  if (!width) return 'JPG export';
  return `${width} px JPG`;
}

function resolveDocumentLine(item) {
  if (!item) return 'Passport photo';
  const size = item.sizeLabel || '2 x 2 in';
  if (size.includes('51 x 51')) {
    return size;
  }

  return `${size} (51 x 51 mm)`;
}

export function SuccessView({ order, onDownload, onBackHome, onOpenDashboard }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!order) {
    return (
      <div className="page-shell">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="surface-card px-6 py-14 text-center">
            <div className="text-2xl font-semibold tracking-tight text-slate-950">Order not found</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              There is no completed order in memory right now.
            </p>
            <button type="button" onClick={onBackHome} className="primary-button mt-6">
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const primaryItem = order.items?.[0] || null;
  const deliveryEmail = primaryItem?.deliveryEmail || primaryItem?.customerEmail || '';
  const shippingAddress = primaryItem?.shippingAddress || null;
  const shippingAddressLabel = [
    shippingAddress?.addressLine1,
    shippingAddress?.addressLine2,
    shippingAddress?.city,
    shippingAddress?.stateProvince,
    shippingAddress?.postalCode,
    shippingAddress?.country,
  ].filter(Boolean).join(', ');
  const emailDeliveryStatus = order.emailDeliveryStatus || '';
  const emailDeliveryMessage = order.emailDeliveryMessage || '';
  const emailDelivered = emailDeliveryStatus === 'sent';
  const hasEmailWarning = Boolean(emailDeliveryMessage) && !emailDelivered;
  const hasManualFulfillment = Boolean(
    order.premiumRetouch || order.photoRetouching || order.complianceCheck,
  );
  const paymentMethod = order.paymentChannel || 'Online payment';
  const processedPhoto = primaryItem?.fulfilledPhoto || primaryItem?.photo || '';
  const paymentDate = formatDate(order.date) || 'Not available';
  const paymentStatus = 'Payment successful';

  return (
    <div className="page-shell">
      <div className="overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
          <div className="space-y-5 sm:space-y-6">
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1.05fr)] lg:gap-6">
              <section className="surface-card animate-fade-up p-5 sm:p-6 lg:p-7">
                <button
                  type="button"
                  onClick={onBackHome}
                  className="ghost-button -ml-3 min-h-10 px-3 py-2 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to home
                </button>

                <div className="mt-4 flex flex-col gap-5 sm:mt-5 sm:flex-row sm:items-start">
                  <SuccessIcon />
                  <div className="min-w-0">
                    <h1 className="text-[2.1rem] font-semibold tracking-tight text-slate-950 sm:text-[2.7rem]">
                      Payment successful
                    </h1>
                    <p className="mt-3 max-w-[36rem] text-base leading-7 text-slate-600 sm:text-[1.02rem]">
                      Your payment went through. Your passport photo is ready to download.
                    </p>

                    {hasEmailWarning ? (
                      <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-900">
                        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <span>{emailDeliveryMessage}</span>
                      </div>
                    ) : null}

                    {!hasEmailWarning && emailDelivered && deliveryEmail ? (
                      <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-6 text-emerald-900">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <span>{emailDeliveryMessage || `Your finished photo was emailed to ${deliveryEmail}.`}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="surface-card animate-slide-up p-5 sm:p-6">
                <div className="min-w-0">
                  <div className="text-[1.25rem] font-semibold tracking-tight text-slate-950">
                    Payment overview
                  </div>
                  <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
                    <OverviewTile
                      icon={<ReceiptText className="h-4 w-4" />}
                      label="Order ID"
                      value={order.id}
                      title={order.id}
                      truncate
                      className="md:col-span-2"
                    />
                    <OverviewTile
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Date"
                      value={paymentDate}
                    />
                    <OverviewTile
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Total paid"
                      value={formatCurrency(order.total || 0)}
                    />
                    <OverviewTile
                      icon={<BadgeCheck className="h-4 w-4" />}
                      label="Status"
                      value={paymentStatus}
                    />
                    <OverviewTile
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Payment method"
                      value={paymentMethod}
                      className="md:col-span-2"
                      valueClassName="[overflow-wrap:anywhere]"
                    />
                  </div>

                  {shippingAddressLabel ? (
                    <div className="mt-3 flex min-w-0 items-start gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                      <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{shippingAddressLabel}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="order-2 space-y-5 lg:order-1">
                <section className="surface-card p-5 sm:p-6">
                  <div className="text-[1.35rem] font-semibold tracking-tight text-slate-950">
                    Order summary
                  </div>

                  <div className="mt-4 divide-y divide-slate-100">
                    <SummaryRow
                      icon={<ReceiptText className="h-4 w-4" />}
                      label="Order ID"
                      value={order.id}
                      valueClassName="[overflow-wrap:anywhere]"
                    />
                    <SummaryRow
                      icon={<ShieldCheck className="h-4 w-4" />}
                      label="Transaction ID"
                      value={order.paymentReference || order.id}
                      valueClassName="break-all [overflow-wrap:anywhere]"
                    />
                    <SummaryRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Ordered on"
                      value={paymentDate}
                    />
                    <SummaryRow
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Total paid"
                      value={formatCurrency(order.total || 0)}
                    />
                    <SummaryRow
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Payment method"
                      value={paymentMethod}
                      valueClassName="[overflow-wrap:anywhere]"
                    />
                    <SummaryRow
                      icon={<BadgeCheck className="h-4 w-4" />}
                      label="Status"
                      value={<StatusPill>{paymentStatus}</StatusPill>}
                    />
                  </div>
                </section>

                <section className="surface-card border-blue-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.86),rgba(255,255,255,0.98))] p-5 sm:p-6">
                  <div className="text-[1.35rem] font-semibold tracking-tight text-slate-950">
                    Save your paid photo to your dashboard
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-[0.98rem]">
                    Create an account or sign in with the same email used at checkout and this paid photo will be saved automatically.
                  </p>
                  <div className="mt-5 flex flex-col gap-3">
                    <button type="button" onClick={onOpenDashboard} className="primary-button w-full justify-center">
                      <LayoutDashboard className="h-4 w-4" />
                      {order.guestCheckout ? 'Create account or sign in' : 'Open dashboard'}
                    </button>
                    <button type="button" onClick={onBackHome} className="secondary-button w-full justify-center">
                      <Sparkles className="h-4 w-4" />
                      Start another photo
                    </button>
                  </div>
                </section>
              </div>

              <div className="order-1 lg:order-2">
                <section className="surface-card p-5 sm:p-6">
                  <div className="text-[1.55rem] font-semibold tracking-tight text-slate-950">
                    Your photo export
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    {primaryItem?.flagPath ? (
                      <FlagMark src={primaryItem.flagPath} label={primaryItem.countryLabel} size="sm" />
                    ) : null}
                    <div className="text-lg font-semibold text-slate-950">
                      {primaryItem?.documentName || 'Passport photo'}
                    </div>
                  </div>

                  <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3 shadow-[0_24px_56px_-46px_rgba(15,23,42,0.45)]">
                        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                          <ProtectedPhotoPreview
                            src={processedPhoto}
                            alt={`${primaryItem?.documentName || 'Passport photo'} export`}
                            watermarkEnabled={Boolean(primaryItem?.backgroundRemovalApplied)}
                            className="bg-white"
                            aspectRatio={`${primaryItem?.outputWidth || 600} / ${primaryItem?.outputHeight || 600}`}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="secondary-button mt-3 w-full justify-center"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </button>
                    </div>

                    <div className="min-w-0 space-y-4">
                      <DetailItem
                        icon={<MapPinned className="h-4 w-4" />}
                        label="Country"
                        value={primaryItem?.countryLabel || 'United States'}
                      />
                      <DetailItem
                        icon={<ReceiptText className="h-4 w-4" />}
                        label="Photo size"
                        value={resolveDocumentLine(primaryItem)}
                      />
                      <DetailItem
                        icon={<ImageIcon className="h-4 w-4" />}
                        label="Export format"
                        value={resolveResolutionLabel(primaryItem)}
                      />
                      <DetailItem
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label="Package"
                        value={getPhotoPackageLabel(primaryItem?.photoPackage, primaryItem?.printCopies)}
                      />
                      <DetailItem
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label="Expert Check"
                        value={primaryItem?.complianceCheck ? 'Selected' : 'Not selected'}
                      />
                      <DetailItem
                        icon={<Sparkles className="h-4 w-4" />}
                        label="Photo Retouching"
                        value={primaryItem?.photoRetouching ? 'Selected' : 'Not selected'}
                      />
                      <DetailItem
                        icon={<Sparkles className="h-4 w-4" />}
                        label="Premium Cleanup"
                        value={primaryItem?.premiumRetouch ? 'Selected' : 'Not selected'}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDownload(primaryItem, order.id)}
                    className="primary-button mt-6 w-full justify-center"
                  >
                    <Download className="h-4 w-4" />
                    Download JPG
                  </button>

                  <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-500">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>Your download link is secure and available anytime.</span>
                  </div>
                </section>
              </div>
            </div>

            <SafetyBadges />

            <section className="surface-card overflow-hidden p-5 sm:p-6">
              <div className="grid items-start gap-6 lg:grid-cols-[0.58fr_1fr]">
                <div className="min-w-0">
                  <div className="text-[1.35rem] font-semibold tracking-tight text-slate-950">
                    Processed image
                  </div>
                  <p className="mt-3 max-w-[28rem] text-sm leading-7 text-slate-600 sm:text-[0.98rem]">
                    This is the final version of your photo, processed and ready for use.
                  </p>
                  {(shippingAddressLabel || deliveryEmail) && (hasManualFulfillment || shippingAddressLabel) ? (
                    <p className="mt-3 text-sm leading-7 text-slate-500">
                      {shippingAddressLabel
                        ? `Print delivery destination: ${shippingAddressLabel}`
                        : `Finished image delivery email: ${deliveryEmail}`}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="mx-auto flex max-w-[19rem] flex-col items-center">
                    <div className="w-full overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50 p-3 shadow-[0_24px_62px_-46px_rgba(15,23,42,0.38)]">
                      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                        <ProtectedPhotoPreview
                          src={processedPhoto}
                          alt={`${primaryItem?.documentName || 'Passport photo'} processed image`}
                          watermarkEnabled={Boolean(primaryItem?.backgroundRemovalApplied)}
                          className="bg-white"
                          aspectRatio={`${primaryItem?.outputWidth || 600} / ${primaryItem?.outputHeight || 600}`}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="secondary-button mt-4 justify-center"
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <PreviewModal
        item={primaryItem}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
