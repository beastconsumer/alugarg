import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const cwd = process.cwd();
const envPath = resolve(cwd, '.env');
const storePath = resolve(cwd, 'local-api', '.pix-store.json');
const port = Number(process.env.LOCAL_API_PORT || 8787);

const readEnvFile = () => {
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

readEnvFile();

const mercadoPagoToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const mercadoPagoApiBase = process.env.MERCADOPAGO_API_BASE || 'https://api.mercadopago.com';
const mercadoPagoWebhookUrl = process.env.MERCADOPAGO_WEBHOOK_URL || '';

const ensureDir = (filePath) => {
  const folder = dirname(filePath);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }
};

const loadStore = () => {
  if (!existsSync(storePath)) {
    return { byBookingId: {} };
  }

  try {
    const raw = readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.byBookingId) {
      return { byBookingId: {} };
    }
    return parsed;
  } catch {
    return { byBookingId: {} };
  }
};

let store = loadStore();

const saveStore = () => {
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
};

const json = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-request-id, x-signature',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) =>
  new Promise((resolveBody, rejectBody) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error('JSON invalido no body'));
      }
    });
    req.on('error', rejectBody);
  });

const normalizeStatus = (value) => String(value || '').toLowerCase();

const extractPixData = (payment) => {
  const pointOfInteraction = payment?.point_of_interaction || {};
  const transactionData = pointOfInteraction?.transaction_data || {};
  return {
    qrCode: String(transactionData?.qr_code || ''),
    qrCodeBase64: String(transactionData?.qr_code_base64 || ''),
    ticketUrl: String(transactionData?.ticket_url || ''),
  };
};

const callMercadoPago = async (path, options = {}) => {
  if (!mercadoPagoToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN nao configurado no .env');
  }

  const headers = {
    Authorization: `Bearer ${mercadoPagoToken}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${mercadoPagoApiBase}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(`Mercado Pago ${response.status}: ${text || 'sem detalhes'}`);
  }
  return parsed;
};

const toPixResponse = (bookingId, payment) => {
  const status = normalizeStatus(payment?.status);
  const pixData = extractPixData(payment);
  return {
    ok: true,
    bookingId,
    paymentId: String(payment?.id || ''),
    status,
    statusDetail: String(payment?.status_detail || ''),
    approved: status === 'approved',
    qrCode: pixData.qrCode,
    qrCodeBase64: pixData.qrCodeBase64,
    ticketUrl: pixData.ticketUrl,
  };
};

const createPix = async (payload) => {
  const bookingId = String(payload?.bookingId || '').trim();
  const amount = Number(payload?.amount || 0);
  const payerEmail = String(payload?.payerEmail || '').trim().toLowerCase();
  const payerCpf = String(payload?.payerCpf || '').replace(/\D/g, '');
  const description = String(payload?.description || `Reserva ${bookingId}`);

  if (!bookingId) throw new Error('bookingId obrigatorio');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount invalido');
  if (!payerEmail.includes('@')) throw new Error('payerEmail invalido');

  const previous = store.byBookingId[bookingId];
  if (previous?.paymentId) {
    const existingPayment = await callMercadoPago(`/v1/payments/${previous.paymentId}`);
    const pixResponse = toPixResponse(bookingId, existingPayment);
    store.byBookingId[bookingId] = {
      ...previous,
      ...pixResponse,
      updatedAt: new Date().toISOString(),
    };
    saveStore();
    return pixResponse;
  }

  const requestPayload = {
    transaction_amount: amount,
    description,
    payment_method_id: 'pix',
    external_reference: bookingId,
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
      booking_id: bookingId,
      source: 'local-api',
    },
    ...(mercadoPagoWebhookUrl ? { notification_url: mercadoPagoWebhookUrl } : {}),
  };

  const created = await callMercadoPago('/v1/payments', {
    method: 'POST',
    body: requestPayload,
    idempotencyKey: randomUUID(),
  });

  const pixResponse = toPixResponse(bookingId, created);
  store.byBookingId[bookingId] = {
    ...pixResponse,
    payerEmail,
    amount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveStore();

  return pixResponse;
};

const checkPix = async (payload) => {
  const bookingId = String(payload?.bookingId || '').trim();
  const directPaymentId = String(payload?.paymentId || '').trim();
  const fromStore = bookingId ? store.byBookingId[bookingId] : null;
  const paymentId = directPaymentId || String(fromStore?.paymentId || '');

  if (!bookingId) throw new Error('bookingId obrigatorio');
  if (!paymentId) throw new Error('Nenhum paymentId encontrado para este bookingId');

  const payment = await callMercadoPago(`/v1/payments/${paymentId}`);
  const pixResponse = toPixResponse(bookingId, payment);

  store.byBookingId[bookingId] = {
    ...(fromStore || {}),
    ...pixResponse,
    updatedAt: new Date().toISOString(),
  };
  saveStore();

  return pixResponse;
};

const syncByPaymentId = async (paymentId) => {
  if (!paymentId) return null;
  const payment = await callMercadoPago(`/v1/payments/${paymentId}`);
  const bookingId = String(payment?.external_reference || '').trim();
  if (!bookingId) return null;

  const pixResponse = toPixResponse(bookingId, payment);
  store.byBookingId[bookingId] = {
    ...(store.byBookingId[bookingId] || {}),
    ...pixResponse,
    updatedAt: new Date().toISOString(),
  };
  saveStore();
  return pixResponse;
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    json(res, 400, { error: 'URL invalida' });
    return;
  }

  if (req.method === 'OPTIONS') {
    json(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${port}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        service: 'local-api',
        mercadoPagoConfigured: Boolean(mercadoPagoToken),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/pix/create') {
      const body = await readJsonBody(req);
      const response = await createPix(body);
      json(res, 200, response);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/pix/check') {
      const body = await readJsonBody(req);
      const response = await checkPix(body);
      json(res, 200, response);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/notifications/booking-confirmation') {
      const body = await readJsonBody(req);
      json(res, 200, { ok: true, local: true, received: body });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/webhook') {
      const body = await readJsonBody(req);
      const paymentId =
        String(body?.data?.id || body?.id || '')
          .trim();
      const synced = await syncByPaymentId(paymentId);
      json(res, 200, { ok: true, synced });
      return;
    }

    json(res, 404, { error: 'Route not found' });
  } catch (error) {
    json(res, 500, {
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[local-api] running at http://127.0.0.1:${port}`);
});
