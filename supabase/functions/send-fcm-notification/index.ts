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

// ── FCM OAuth2 token via service account JWT ─────────────────────
async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );

  const signingInput = `${header}.${claim}`;
  const encoder = new TextEncoder();

  // Import PEM private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

// ── Send FCM message to a single token ──────────────────────────
async function sendToToken(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data,
          android: {
            priority: 'high',
            notification: {
              channel_id: 'alugasul_default',
              icon: 'ic_stat_notification',
              color: '#1f5ed6',
            },
          },
        },
      }),
    },
  );

  if (res.ok) return { success: true };

  const err = await res.json() as any;
  const code = err?.error?.status ?? '';
  return { success: false, error: code };
}

// ── Main handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const fcmProjectId = Deno.env.get('FCM_PROJECT_ID') ?? '';
  const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '';

  if (!fcmProjectId || !fcmServiceAccountJson) {
    return jsonResponse(500, { error: 'FCM not configured. Set FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_JSON secrets.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, any>;
  try {
    body = await req.json() as Record<string, any>;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { targetUserId, title, bodyText, data } = body as {
    targetUserId: string;
    title: string;
    bodyText?: string;
    body?: string;
    data?: Record<string, string>;
  };

  const messageBody: string = (body.body as string) ?? bodyText ?? '';

  // ── Scheduled reminders (called by cron) ──────────────────────
  if (body.trigger === 'scheduled_reminders') {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const { data: checkingIn } = await supabase
      .from('bookings')
      .select('id, renter_id, property_title')
      .eq('check_in_date', tomorrow)
      .in('status', ['pre_checking', 'confirmed']);

    for (const bk of checkingIn ?? []) {
      await sendNotificationToUser(supabase, fcmProjectId, fcmServiceAccountJson, bk.renter_id as string, {
        title: 'Check-in amanha!',
        body: `Lembre-se: seu check-in em ${bk.property_title as string} e amanha.`,
        data: { type: 'checkin', bookingId: bk.id as string },
      });
    }

    const { data: checkingOut } = await supabase
      .from('bookings')
      .select('id, renter_id, owner_id, property_title')
      .eq('check_out_date', today)
      .eq('status', 'checked_in');

    for (const bk of checkingOut ?? []) {
      await sendNotificationToUser(supabase, fcmProjectId, fcmServiceAccountJson, bk.renter_id as string, {
        title: 'Checkout hoje',
        body: `Seu checkout em ${bk.property_title as string} e hoje. Boa viagem!`,
        data: { type: 'checkout', bookingId: bk.id as string },
      });
      await sendNotificationToUser(supabase, fcmProjectId, fcmServiceAccountJson, bk.owner_id as string, {
        title: 'Checkout do hospede hoje',
        body: `O hospede de ${bk.property_title as string} faz checkout hoje.`,
        data: { type: 'checkout', bookingId: bk.id as string },
      });
    }

    return jsonResponse(200, { ok: true, trigger: 'scheduled_reminders' });
  }

  // ── Direct notification ────────────────────────────────────────
  if (!targetUserId || !title || !messageBody) {
    return jsonResponse(400, { error: 'targetUserId, title, body are required' });
  }

  const result = await sendNotificationToUser(supabase, fcmProjectId, fcmServiceAccountJson, targetUserId, {
    title,
    body: messageBody,
    data: (data as Record<string, string>) ?? {},
  });

  return jsonResponse(200, { ok: true, ...result });
});

// ── Helper: send to all tokens of a user ────────────────────────
async function sendNotificationToUser(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  serviceAccountJson: string,
  userId: string,
  message: { title: string; body: string; data?: Record<string, string> },
) {
  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('fcm_token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return { sent: 0, skipped: 'no_tokens' };

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(serviceAccountJson);
  } catch (err) {
    console.error('[FCM] Token error:', err);
    return { sent: 0, error: 'token_error' };
  }

  let sent = 0;
  const staleTokens: string[] = [];

  for (const { fcm_token } of tokens) {
    const result = await sendToToken(
      accessToken,
      projectId,
      fcm_token as string,
      message.title,
      message.body,
      message.data ?? {},
    );

    if (result.success) {
      sent++;
    } else if (result.error === 'NOT_FOUND' || result.error === 'UNREGISTERED') {
      staleTokens.push(fcm_token as string);
    }
  }

  // Clean up expired tokens
  if (staleTokens.length > 0) {
    await supabase.from('user_push_tokens').delete().in('fcm_token', staleTokens);
  }

  return { sent, stale_removed: staleTokens.length };
}
