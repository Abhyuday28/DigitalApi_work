import { createClient } from '@supabase/supabase-js';

// Server-only. NEVER import this module in a client component.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(request: Request) {
  const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new ApiError(401, 'Missing bearer token');
  const client = db();
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid or expired token');
  return { client, user };
}

export async function requireAdmin(request: Request) {
  const ctx = await requireUser(request);
  const { data, error } = await ctx.client.from('profiles').select('role').eq('id', ctx.user.id).single();
  if (error || data?.role !== 'admin') throw new ApiError(403, 'Admin role required');
  return ctx;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
