import { ZodError } from 'zod';
import { ApiError } from './supabase';
export const ok = (data: unknown, status = 200) => Response.json({ data }, { status, headers: { 'Cache-Control': 'no-store' } });
export function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: 'VALIDATION_ERROR', details: error.issues }, { status: 400 });
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error('API failure:', error);
  return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
}
export async function body(request: Request) {
  try { return await request.json(); } catch { throw new ApiError(400, 'Invalid JSON'); }
}
export function queryError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === 'P0001') throw new ApiError(400, error.message);
  if (error.code === '23505') throw new ApiError(409, 'Resource already exists');
  throw new Error(error.message);
}
