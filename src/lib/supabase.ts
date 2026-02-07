import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';
import { env } from '../env';

export const supabase = createClient(
  env.supabaseUrl || 'https://invalid.supabase.co',
  env.supabaseAnonKey || 'invalid-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const uploadImageAndGetPublicUrl = async (
  file: File,
  storagePath: string,
): Promise<string> => {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.85,
  });

  const { error: uploadError } = await supabase.storage
    .from(env.supabaseBucket)
    .upload(storagePath, compressed, {
      contentType: compressed.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(env.supabaseBucket).getPublicUrl(storagePath);
  return data.publicUrl;
};

export const extractBucketPathFromPublicUrl = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${env.supabaseBucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  return url.slice(idx + marker.length);
};

