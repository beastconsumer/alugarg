import { supabase } from './supabase';

// NOTE: Push notifications are disabled until Firebase (google-services.json) is configured.
// To re-enable: npm install @capacitor/push-notifications and restore the Capacitor implementation.

export const isPushSupported = (): boolean => false;

export const registerForPushNotifications = async (_userId: string): Promise<void> => {
  // noop – requires Firebase setup
};

export const sendPushNotification = async (payload: {
  targetUserId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> => {
  try {
    await supabase.functions.invoke('send-fcm-notification', { body: payload });
  } catch (err) {
    console.warn('[Push] Invoke error:', err);
  }
};
