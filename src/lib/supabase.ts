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

const compressImage = async (
  file: File,
  options: Parameters<typeof imageCompression>[1],
): Promise<File | Blob> => {
  try {
    return await imageCompression(file, options);
  } catch {
    return file;
  }
};

export const uploadImageAndGetPublicUrl = async (
  file: File,
  storagePath: string,
): Promise<string> => {
  const compressed = await compressImage(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.85,
  });

  const { error: uploadError } = await supabase.storage
    .from(env.supabaseBucket)
    .upload(storagePath, compressed, {
      contentType: compressed.type || file.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(env.supabaseBucket).getPublicUrl(storagePath);
  return data.publicUrl;
};

const STORAGE_REF_SEPARATOR = '::';

interface StorageObjectRef {
  bucket: string;
  path: string;
}

const getStorageErrorStatus = (error: unknown): string => {
  if (!error || typeof error !== 'object') return '';
  const value = error as { statusCode?: string; status?: number };
  if (typeof value.statusCode === 'string') return value.statusCode;
  if (typeof value.status === 'number') return String(value.status);
  return '';
};

const isMissingBucketError = (error: unknown): boolean => {
  const status = getStorageErrorStatus(error);
  if (status === '404') return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('bucket') && (message.includes('not found') || message.includes('does not exist'));
};

export const encodeStorageObjectRef = (bucket: string, path: string): string => {
  return `${bucket}${STORAGE_REF_SEPARATOR}${path}`;
};

export const decodeStorageObjectRef = (
  value: string,
  fallbackBucket = env.hostDocumentsBucket,
): StorageObjectRef => {
  const ref = String(value || '').trim();
  const separatorIndex = ref.indexOf(STORAGE_REF_SEPARATOR);
  if (separatorIndex <= 0) {
    return { bucket: fallbackBucket, path: ref };
  }

  const bucket = ref.slice(0, separatorIndex).trim();
  const path = ref.slice(separatorIndex + STORAGE_REF_SEPARATOR.length).trim();

  if (!bucket || !path) {
    return { bucket: fallbackBucket, path: ref };
  }

  return { bucket, path };
};

export const uploadPrivateDocumentAndGetPath = async (
  file: File,
  storagePath: string,
  bucket = env.hostDocumentsBucket,
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Arquivo invalido para documento. Envie uma imagem.');
  }

  const compressed = await compressImage(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    initialQuality: 0.9,
  });

  const candidateBuckets = Array.from(
    new Set([bucket, env.hostDocumentsBucket, env.supabaseBucket].filter(Boolean)),
  );
  let lastError: unknown = null;

  for (const targetBucket of candidateBuckets) {
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(storagePath, compressed, {
        contentType: compressed.type || file.type || 'image/jpeg',
        upsert: true,
      });

    if (!uploadError) {
      return encodeStorageObjectRef(targetBucket, storagePath);
    }

    lastError = uploadError;
    if (!isMissingBucketError(uploadError)) {
      const status = getStorageErrorStatus(uploadError);
      const suffix = status ? ` [status ${status}]` : '';
      throw new Error(`Falha no upload do documento${suffix}: ${uploadError.message}`);
    }
  }

  const status = getStorageErrorStatus(lastError);
  const suffix = status ? ` [status ${status}]` : '';
  const message = lastError instanceof Error ? lastError.message : 'bucket nao encontrado';
  throw new Error(`Falha no upload do documento${suffix}: ${message}`);
};

export const removePrivateDocumentByRef = async (storedRef: string): Promise<void> => {
  if (!storedRef) return;
  const { bucket, path } = decodeStorageObjectRef(storedRef);
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]).catch(() => null);
};

export const createSignedDocumentUrlByRef = async (
  storedRef: string,
  expiresInSeconds = 60 * 60,
): Promise<string> => {
  if (!storedRef) return '';

  const { bucket, path } = decodeStorageObjectRef(storedRef);
  if (!path) return '';

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  if (bucket === env.supabaseBucket) {
    const publicResult = supabase.storage.from(bucket).getPublicUrl(path);
    return publicResult.data.publicUrl || '';
  }

  return '';
};

export const extractBucketPathFromPublicUrl = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${env.supabaseBucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  return url.slice(idx + marker.length);
};

