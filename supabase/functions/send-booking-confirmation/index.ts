// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (raw: string): string => {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const renderHtml = (payload: {
  guestName: string;
  bookingId: string;
  propertyTitle: string;
  addressText: string;
  checkInDate: string;
  checkOutDate: string;
  units: number;
  totalPaid: number;
  paymentMethod: string;
}) => {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f7f8fa;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b1220;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8fa;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;background:linear-gradient(135deg,#0b5fff,#296dfa);color:#ffffff;">
                <h1 style="margin:0;font-size:24px;line-height:1.2;">Aluga Aluga</h1>
                <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Confirmacao da sua reserva</p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:16px;">Ola, <strong>${payload.guestName}</strong>!</p>
                <p style="margin:0 0 18px;font-size:14px;color:#4b5563;">
                  Seu pagamento foi aprovado e a reserva foi confirmada com sucesso.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:14px;background:#fafbff;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Codigo da reserva</p>
                      <p style="margin:0 0 12px;font-size:15px;font-weight:700;">${payload.bookingId}</p>

                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Imovel</p>
                      <p style="margin:0 0 12px;font-size:15px;font-weight:700;">${payload.propertyTitle}</p>

                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Endereco</p>
                      <p style="margin:0 0 12px;font-size:14px;">${payload.addressText}</p>

                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Periodo</p>
                      <p style="margin:0 0 12px;font-size:14px;">${formatDate(payload.checkInDate)} ate ${formatDate(payload.checkOutDate)}</p>

                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Unidades cobradas</p>
                      <p style="margin:0 0 12px;font-size:14px;">${payload.units}</p>

                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Forma de pagamento</p>
                      <p style="margin:0 0 12px;font-size:14px;">${payload.paymentMethod === 'pix' ? 'PIX' : 'Cartao'}</p>

                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Total pago</p>
                      <p style="margin:0;font-size:20px;font-weight:800;color:#0b5fff;">${formatMoney(payload.totalPaid)}</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">
                  Proximo passo: abra o app e converse com o anfitriao para alinhar check-in e entrega de chaves.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#fcfdff;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">Aluga Aluga • Balneario Cassino / Rio Grande - RS</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? '';

    if (!resendApiKey || !resendFrom) {
      return new Response(
        JSON.stringify({
          error: 'Missing RESEND_API_KEY or RESEND_FROM_EMAIL secret',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body = (await req.json()) as Record<string, any>;
    const toEmail = String(body.toEmail ?? '').trim().toLowerCase();

    if (!toEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid toEmail' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      guestName: String(body.guestName ?? 'Hospede'),
      bookingId: String(body.bookingId ?? ''),
      propertyTitle: String(body.propertyTitle ?? 'Imovel'),
      addressText: String(body.addressText ?? 'Balneario Cassino'),
      checkInDate: String(body.checkInDate ?? ''),
      checkOutDate: String(body.checkOutDate ?? ''),
      units: Number(body.units ?? 0),
      totalPaid: Number(body.totalPaid ?? 0),
      paymentMethod: String(body.paymentMethod ?? 'card'),
    };

    if (!payload.bookingId) {
      return new Response(JSON.stringify({ error: 'Missing bookingId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subject = `Reserva confirmada #${payload.bookingId} - Aluga Aluga`;
    const html = renderHtml(payload);

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!sendRes.ok) {
      const text = await sendRes.text();
      return new Response(JSON.stringify({ error: 'Failed to send email', details: text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await sendRes.json();
    return new Response(JSON.stringify({ ok: true, id: json.id ?? null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
