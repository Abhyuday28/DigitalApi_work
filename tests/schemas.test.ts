import { describe, expect, it } from 'vitest';
import { credentials, quiz, question, payment, submission } from '../src/lib/schemas';
describe('API validation',()=>{
  it('rejects invalid email and short password',()=>{expect(credentials.safeParse({email:'nope',password:'123'}).success).toBe(false)});
  it('accepts valid quiz',()=>{expect(quiz.parse({title:'Geography',stake:50,reward:100})).toMatchObject({pass_percentage:60,published:false})});
  it('rejects negative stakes',()=>{expect(quiz.safeParse({title:'Quiz',stake:-5,reward:100}).success).toBe(false)});
  it('rejects invalid correct answer index',()=>{expect(question.safeParse({prompt:'Capital?',options:['A','B'],correct_index:2}).success).toBe(false)});
  it('requires idempotency UUID for mock purchase',()=>{expect(payment.safeParse({amount:100,idempotency_key:'bad'}).success).toBe(false)});
  it('requires question UUID keys',()=>{expect(submission.safeParse({answers:{bad:1}}).success).toBe(false)});
});
