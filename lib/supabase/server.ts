import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function normalizeSupabaseUrl(rawUrl?: string): string {
  const value = (rawUrl || '').trim();
  if (!value) return 'https://placeholder.supabase.co';
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
}

/**
 * Cliente privilegiado exclusivo del servidor (usa SUPABASE_SERVICE_ROLE_KEY si está configurada).
 * Si aún no se configura la clave de servicio, cae de forma segura al cliente estándar.
 */
export async function createAdminSupabaseClient() {
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (
    serviceRoleKey &&
    !serviceRoleKey.includes('tu-service-role-key') &&
    !supabaseUrl.includes('placeholder')
  ) {
    return createSupabaseJsClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return createServerSupabaseClient();
}
