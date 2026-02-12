// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const parseSignatureHeader = (headerValue: string): { ts: string; v1: string } => {
  const parts = headerValue.split(',');
  let ts = '';
  let v1 = '';

  for (const part of parts) {
    const [rawKey, rawValue] = part.split('=');
    const key = (rawKey ?? '').trim().toLowerCase();
    const value = (rawValue ?? '').trim();
    if (key === 'ts') ts = value;
    if (key === 'v1') v1 = value.toLowerCase();
  }

  return { ts, v1 };
};

const buildManifest = (dataId: string, requestId: string, ts: string): string =>
  `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;

const signManifest = async (secret: string, manifest: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  return toHex(new Uint8Array(signature));
};

const normalizeStatus = (value: unknown): string => String(value ?? '').toLowerCase();

const extractPixData = (payment: Record<string, unknown>) => {
  const poi = (payment.point_of_interaction ?? {}) as Record<string, unknown>;
  const transaction = (poi.transaction_data ?? {}) as Record<string, unknown>;
  return {
    qrCode: String(transaction.qr_code ?? ''),
    qrCodeBase64: String(transaction.qr_code_base64 ?? ''),
    ticketUrl: String(transaction.ticket_url ?? ''),
  };
};

const callMercadoPago = async (accessToken: string, paymentId: string): Promise<Record<string, unknown>> => {
  const base = Deno.env.get('MERCADOPAGO_API_BASE') ?? 'https://api.mercadopago.com';
  const response = await fetch(`${base}/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(`Mercado Pago ${response.status}: ${text || 'sem detalhes'}`);
  }
  return parsed;
};

const extractPaymentIdFromRequest = async (req: Request): Promise<string> => {
  const url = new URL(req.url);
  const queryId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    url.searchParams.get('resource_id') ||
    '';

  if (queryId) return queryId;

  try {
    const body = (await req.json()) as Record<string, any>;
    if (body?.data?.id) return String(body.data.id);
    if (body?.id) return String(body.id);
    if (body?.resource?.includes('/v1/payments/')) {
      return String(body.resource).split('/').pop() || '';
    }
  } catch {
    // ignore empty/non-json payloads
  }

  return '';
};

const verifyWebhookSignature = async (
  req: Request,
  paymentId: string,
  webhookSecret: string,
): Promise<boolean> => {
  const xSignature = req.headers.get('x-signature') ?? '';
  const xRequestId = req.headers.get('x-request-id') ?? '';

  if (!xSignature || !xRequestId || !paymentId) return false;

  const { ts, v1 } = parseSignatureHeader(xSignature);
  if (!ts || !v1) return false;

  const manifest = buildManifest(paymentId, xRequestId, ts);
  const expected = await signManifest(webhookSecret, manifest);
  return expected === v1;
};

const updateBookingIfApproved = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
  status: string,
) => {
  if (status !== 'approved') return;

  const { data: bookingRaw, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    throw new Error(`Falha ao consultar reserva: ${bookingError.message}`);
  }
  if (!bookingRaw) return;

  const bookingStatus = String(bookingRaw.status ?? '');
  if (['pre_checking', 'checked_in', 'checked_out', 'cancelled'].includes(bookingStatus)) return;

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'pre_checking',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateError) {
    throw new Error(`Falha ao atualizar reserva: ${updateError.message}`);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const mercadoPagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '';
    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret' });
    }
    if (!mercadoPagoToken) {
      return jsonResponse(500, { error: 'Missing MERCADOPAGO_ACCESS_TOKEN secret' });
    }

    const paymentId = await extractPaymentIdFromRequest(req);
    if (!paymentId) {
      return jsonResponse(200, { ok: true, ignored: true, reason: 'payment_id_not_found' });
    }

    if (webhookSecret) {
      const valid = await verifyWebhookSignature(req, paymentId, webhookSecret);
      if (!valid) {
        return jsonResponse(401, { error: 'invalid_webhook_signature' });
      }
    }

    const payment = await callMercadoPago(mercadoPagoToken, paymentId);
    const paymentStatus = normalizeStatus(payment.status);
    const statusDetail = String(payment.status_detail ?? '');

    const externalReference = String(payment.external_reference ?? '');
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const bookingId = externalReference || String(metadata.booking_id ?? '');
    if (!bookingId) {
      return jsonResponse(200, { ok: true, ignored: true, reason: 'booking_id_not_found', paymentId });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const pix = extractPixData(payment);
    const payerEmail = String((payment.payer as Record<string, unknown> | undefined)?.email ?? '');

    const { error: txError } = await supabaseAdmin.from('payment_transactions').upsert(
      {
        booking_id: bookingId,
        provider: 'mercadopago',
        provider_payment_id: String(payment.id ?? paymentId),
        payment_method: String(payment.payment_method_id ?? 'pix'),
        amount: Math.round(Number(payment.transaction_amount ?? 0)),
        status: paymentStatus,
        status_detail: statusDetail,
        payer_email: payerEmail,
        qr_code: pix.qrCode,
        qr_code_base64: pix.qrCodeBase64,
        ticket_url: pix.ticketUrl,
        raw_response: payment,
        paid_at: paymentStatus === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider_payment_id' },
    );

    if (txError) {
      throw new Error(`Falha ao persistir pagamento: ${txError.message}`);
    }

    await updateBookingIfApproved(supabaseAdmin, bookingId, paymentStatus);

    return jsonResponse(200, {
      ok: true,
      bookingId,
      paymentId,
      status: paymentStatus,
      statusDetail,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
