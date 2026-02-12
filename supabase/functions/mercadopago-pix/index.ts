// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PixAction = 'create' | 'check';

type BookingRow = {
  id: string;
  renter_id: string;
  owner_id: string;
  property_title: string;
  total_paid_by_renter: number;
  status: string;
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const extractBearerToken = (req: Request): string => {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
};

const sanitizeDigits = (value: string): string => value.replace(/\D/g, '');

const normalizePaymentStatus = (value: unknown): string => String(value ?? '').toLowerCase();

const extractPaymentId = (payment: Record<string, unknown>): string => String(payment.id ?? '');

const extractPixData = (payment: Record<string, unknown>) => {
  const pointOfInteraction = (payment.point_of_interaction ?? {}) as Record<string, unknown>;
  const transactionData = (pointOfInteraction.transaction_data ?? {}) as Record<string, unknown>;

  return {
    qrCode: String(transactionData.qr_code ?? ''),
    qrCodeBase64: String(transactionData.qr_code_base64 ?? ''),
    ticketUrl: String(transactionData.ticket_url ?? ''),
  };
};

const upsertTransaction = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
  payerEmail: string,
  payment: Record<string, unknown>,
) => {
  const paymentId = extractPaymentId(payment);
  if (!paymentId) return;

  const status = normalizePaymentStatus(payment.status);
  const statusDetail = String(payment.status_detail ?? '');
  const method = String(payment.payment_method_id ?? 'pix');
  const amount = Math.round(Number(payment.transaction_amount ?? 0));
  const pixData = extractPixData(payment);

  const row = {
    booking_id: bookingId,
    provider: 'mercadopago',
    provider_payment_id: paymentId,
    payment_method: method,
    amount,
    status,
    status_detail: statusDetail,
    payer_email: payerEmail,
    qr_code: pixData.qrCode,
    qr_code_base64: pixData.qrCodeBase64,
    ticket_url: pixData.ticketUrl,
    raw_response: payment,
    paid_at: status === 'approved' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('payment_transactions').upsert(row, {
    onConflict: 'provider_payment_id',
  });

  if (error) {
    throw new Error(`Falha ao salvar transacao: ${error.message}`);
  }
};

const finalizeBookingIfApproved = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
  paymentStatus: string,
) => {
  if (paymentStatus !== 'approved') return;

  const { data: bookingRaw, error: bookingReadError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingReadError) {
    throw new Error(`Falha ao consultar reserva: ${bookingReadError.message}`);
  }
  if (!bookingRaw) return;

  const status = String(bookingRaw.status ?? '');
  if (['pre_checking', 'checked_in', 'checked_out', 'cancelled'].includes(status)) return;

  const { error: bookingUpdateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'pre_checking',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (bookingUpdateError) {
    throw new Error(`Falha ao atualizar reserva: ${bookingUpdateError.message}`);
  }
};

const callMercadoPago = async (
  token: string,
  path: string,
  options: {
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  },
): Promise<Record<string, unknown>> => {
  const base = Deno.env.get('MERCADOPAGO_API_BASE') ?? 'https://api.mercadopago.com';
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
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

const getBookingForRenter = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
  userId: string,
): Promise<BookingRow> => {
  const { data, error } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (error) throw new Error(`Falha ao buscar reserva: ${error.message}`);
  if (!data) throw new Error('Reserva nao encontrada.');

  const booking = data as BookingRow;
  if (String(booking.renter_id) !== userId) {
    throw new Error('Voce nao pode pagar esta reserva.');
  }

  return booking;
};

const getLatestBookingTransaction = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
): Promise<Record<string, any> | null> => {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao consultar transacao: ${error.message}`);
  }

  return data as Record<string, any> | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const mercadoPagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '';
    const webhookUrl = Deno.env.get('MERCADOPAGO_WEBHOOK_URL') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret' });
    }
    if (!mercadoPagoToken) {
      return jsonResponse(500, { error: 'Missing MERCADOPAGO_ACCESS_TOKEN secret' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const bearerToken = extractBearerToken(req);
    if (!bearerToken) {
      return jsonResponse(401, { error: 'Missing bearer token' });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearerToken);
    if (userError || !userData.user) {
      return jsonResponse(401, { error: 'Invalid auth token' });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? '') as PixAction;

    if (!['create', 'check'].includes(action)) {
      return jsonResponse(400, { error: 'Invalid action. Use create or check.' });
    }

    const bookingId = String(body.bookingId ?? '').trim();
    if (!bookingId) {
      return jsonResponse(400, { error: 'Missing bookingId' });
    }

    const booking = await getBookingForRenter(supabaseAdmin, bookingId, userId);

    if (['checked_in', 'checked_out', 'cancelled'].includes(String(booking.status))) {
      return jsonResponse(400, { error: `Reserva em status invalido para pagamento: ${booking.status}` });
    }

    if (action === 'create') {
      const payerEmail = String(body.payerEmail ?? '').trim().toLowerCase();
      const payerCpf = sanitizeDigits(String(body.payerCpf ?? ''));

      if (!payerEmail.includes('@')) {
        return jsonResponse(400, { error: 'payerEmail invalido' });
      }

      const lastTransaction = await getLatestBookingTransaction(supabaseAdmin, bookingId);
      if (lastTransaction?.provider_payment_id) {
        const existingPayment = await callMercadoPago(
          mercadoPagoToken,
          `/v1/payments/${String(lastTransaction.provider_payment_id)}`,
          { method: 'GET' },
        );

        const existingStatus = normalizePaymentStatus(existingPayment.status);
        await upsertTransaction(supabaseAdmin, bookingId, payerEmail, existingPayment);
        await finalizeBookingIfApproved(supabaseAdmin, bookingId, existingStatus);

        const existingPix = extractPixData(existingPayment);
        if (existingStatus === 'approved' || existingPix.qrCode || existingPix.qrCodeBase64) {
          return jsonResponse(200, {
            ok: true,
            bookingId,
            paymentId: extractPaymentId(existingPayment),
            status: existingStatus,
            statusDetail: String(existingPayment.status_detail ?? ''),
            approved: existingStatus === 'approved',
            qrCode: existingPix.qrCode,
            qrCodeBase64: existingPix.qrCodeBase64,
            ticketUrl: existingPix.ticketUrl,
          });
        }
      }

      const payload: Record<string, unknown> = {
        transaction_amount: Number(booking.total_paid_by_renter),
        description: `Reserva ${booking.property_title || booking.id}`,
        payment_method_id: 'pix',
        external_reference: booking.id,
        payer: {
          email: payerEmail,
          ...(payerCpf.length === 11
            ? {
                identification: {
                  type: 'CPF',
                  number: payerCpf,
                },
              }
            : {}),
        },
        metadata: {
          booking_id: booking.id,
          renter_id: booking.renter_id,
          owner_id: booking.owner_id,
          source: 'aluga-aluga',
        },
      };

      if (webhookUrl) {
        payload.notification_url = webhookUrl;
      }

      const payment = await callMercadoPago(mercadoPagoToken, '/v1/payments', {
        method: 'POST',
        body: payload,
        idempotencyKey: crypto.randomUUID(),
      });

      const status = normalizePaymentStatus(payment.status);
      await upsertTransaction(supabaseAdmin, bookingId, payerEmail, payment);
      await finalizeBookingIfApproved(supabaseAdmin, bookingId, status);

      const pix = extractPixData(payment);
      return jsonResponse(200, {
        ok: true,
        bookingId,
        paymentId: extractPaymentId(payment),
        status,
        statusDetail: String(payment.status_detail ?? ''),
        approved: status === 'approved',
        qrCode: pix.qrCode,
        qrCodeBase64: pix.qrCodeBase64,
        ticketUrl: pix.ticketUrl,
      });
    }

    const paymentIdFromBody = String(body.paymentId ?? '').trim();
    const paymentId =
      paymentIdFromBody ||
      String((await getLatestBookingTransaction(supabaseAdmin, bookingId))?.provider_payment_id ?? '').trim();

    if (!paymentId) {
      return jsonResponse(404, { error: 'Nenhum pagamento PIX encontrado para esta reserva.' });
    }

    const payment = await callMercadoPago(mercadoPagoToken, `/v1/payments/${paymentId}`, { method: 'GET' });
    const paymentStatus = normalizePaymentStatus(payment.status);
    const payerEmail = String((payment.payer as Record<string, unknown> | undefined)?.email ?? '').toLowerCase();

    await upsertTransaction(supabaseAdmin, bookingId, payerEmail, payment);
    await finalizeBookingIfApproved(supabaseAdmin, bookingId, paymentStatus);

    const pix = extractPixData(payment);
    return jsonResponse(200, {
      ok: true,
      bookingId,
      paymentId,
      status: paymentStatus,
      statusDetail: String(payment.status_detail ?? ''),
      approved: paymentStatus === 'approved',
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
