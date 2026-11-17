import { z } from 'zod';
export const credentials = z.object({ email: z.email(), password: z.string().min(8).max(72) });
// Signing in must not impose the registration password policy on existing users.
export const loginCredentials = z.object({ email: z.email(), password: z.string().min(1) });
export const quiz = z.object({ title: z.string().trim().min(3).max(150), description: z.string().max(2000).default(''), stake: z.number().int().min(1).max(100000), reward: z.number().int().min(1).max(1000000), pass_percentage: z.number().int().min(1).max(100).default(60), published: z.boolean().default(false) });
export const question = z.object({ prompt: z.string().trim().min(3), options: z.array(z.string().trim().min(1)).min(2).max(6), correct_index: z.number().int().min(0).max(5) }).refine(v=>v.correct_index<v.options.length,{message:'correct_index out of range'});
export const submission = z.object({ answers: z.record(z.string().uuid(), z.number().int().nonnegative()) });
export const payment = z.object({ amount: z.number().int().min(1).max(10000), idempotency_key: z.string().uuid() });
