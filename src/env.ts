const read = (key: string, fallback = ''): string => {
  const value = (import.meta.env[key] as string | undefined) ?? fallback;
  return value.trim();
};

export const env = {
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
  supabaseBucket: read('VITE_SUPABASE_BUCKET', 'property-images'),
};

export const envIssue = (() => {
  if (!env.supabaseUrl || env.supabaseUrl === '...') {
    return 'Defina VITE_SUPABASE_URL no .env local.';
  }
  if (!env.supabaseAnonKey || env.supabaseAnonKey === '...') {
    return 'Defina VITE_SUPABASE_ANON_KEY no .env local.';
  }
  return '';
})();

