import { createBrowserClient } from '@supabase/ssr';

function normalizeUrl(rawUrl?: string): string {
  const value = (rawUrl || '').trim();
  if (!value) return 'https://placeholder.supabase.co';
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export function createClient() {
  const supabaseUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
