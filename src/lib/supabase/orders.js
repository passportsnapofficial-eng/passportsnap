import { supabase } from './client.js';

function normalizeItems(items = []) {
  return items.map((item) => ({
    id: item.id,
    resultId: item.resultId,
    documentId: item.documentId,
    documentName: item.documentName,
    countryLabel: item.countryLabel,
    sizeLabel: item.sizeLabel,
    outputLabel: item.outputLabel,
    flagPath: item.flagPath,
    backgroundLabel: item.backgroundLabel,
    basePrice: item.basePrice,
    photo: item.photo,
    outputWidth: item.outputWidth,
    outputHeight: item.outputHeight,
    statusLabel: item.statusLabel,
    backgroundRemovalApplied: Boolean(item.backgroundRemovalApplied),
    premiumRetouch: Boolean(item.premiumRetouch),
    downloadOwnerName: item.downloadOwnerName,
    addedAt: item.addedAt,
  }));
}

export function serializeOrderForDatabase(order, userId) {
  return {
    id: order.id,
    user_id: userId,
    order_date: order.date,
    status: order.status,
    subtotal: order.subtotal,
    premium_retouch: Boolean(order.premiumRetouch),
    premium_fee: order.premiumFee,
    total: order.total,
    payment_currency: order.paymentCurrency,
    payment_channel: order.paymentChannel,
    payment_gateway_response: order.paymentGatewayResponse,
    payment_reference: order.paymentReference,
    payment_verified_at: order.paymentVerifiedAt,
    service_summary: order.serviceSummary,
    items: normalizeItems(order.items),
  };
}

export function hydrateOrder(row) {
  return {
    id: row.id,
    date: row.order_date,
    status: row.status,
    subtotal: Number(row.subtotal || 0),
    premiumRetouch: Boolean(row.premium_retouch),
    premiumFee: Number(row.premium_fee || 0),
    total: Number(row.total || 0),
    paymentCurrency: row.payment_currency,
    paymentChannel: row.payment_channel,
    paymentGatewayResponse: row.payment_gateway_response,
    paymentReference: row.payment_reference,
    paymentVerifiedAt: row.payment_verified_at,
    serviceSummary: row.service_summary,
    items: normalizeItems(Array.isArray(row.items) ? row.items : []),
  };
}

export async function listOrdersForUser(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_date,
      status,
      subtotal,
      premium_retouch,
      premium_fee,
      total,
      payment_currency,
      payment_channel,
      payment_gateway_response,
      payment_reference,
      payment_verified_at,
      service_summary,
      items
    `)
    .eq('user_id', userId)
    .order('order_date', { ascending: false });

  if (error) throw error;
  return data.map(hydrateOrder);
}

export async function upsertOrderForUser(order, userId) {
  const payload = serializeOrderForDatabase(order, userId);

  const { data, error } = await supabase
    .from('orders')
    .upsert(payload, { onConflict: 'id' })
    .select(`
      id,
      order_date,
      status,
      subtotal,
      premium_retouch,
      premium_fee,
      total,
      payment_currency,
      payment_channel,
      payment_gateway_response,
      payment_reference,
      payment_verified_at,
      service_summary,
      items
    `)
    .single();

  if (error) throw error;
  return hydrateOrder(data);
}
