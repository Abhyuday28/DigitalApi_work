import { db, requireUser, requireAdmin, ApiError } from '@/lib/supabase';
import { body, failure, ok, queryError } from '@/lib/response';
import { credentials, quiz, question, submission, payment } from '@/lib/schemas';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = {params:Promise<{path:string[]}>};
type Method = 'GET'|'POST'|'PATCH'|'DELETE';
async function endpoint(method:Method, req:Request,ctx:Ctx) {
 try {
 const [a,b,c,d]=(await ctx.params).path;
 if(a==='health'&&!b&&method==='GET') return ok({status:'ok'});
 if(a==='auth'&&!c&&method==='POST'&&(b==='register'||b==='login')){
 const input=credentials.parse(await body(req));const client=db();
 if(b==='register'){const {data,error}=await client.auth.signUp(input);if(error)throw new ApiError(400,error.message);return ok({user_id:data.user?.id,confirmation_required:!data.session},201);}
 const {data,error}=await client.auth.signInWithPassword(input);if(error||!data.session)throw new ApiError(401,'Invalid credentials');return ok({access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});
 }
 if(a==='quizzes'&&!b&&method==='GET'){const {client}=await requireUser(req);const {data,error}=await client.from('quizzes').select('id,title,description,stake,reward,pass_percentage,created_at').eq('published',true).order('created_at',{ascending:false});queryError(error);return ok(data);}
 if(a==='quizzes'&&b&&!c&&method==='GET'){const {client}=await requireUser(req);const {data:q,error:e}=await client.from('quizzes').select('id,title,description,stake,reward,pass_percentage').eq('id',b).eq('published',true).maybeSingle();queryError(e);if(!q)throw new ApiError(404,'Quiz not found');const {data:questions,error}=await client.from('questions').select('id,prompt,options').eq('quiz_id',b).order('created_at');queryError(error);return ok({...q,questions});}
 if(a==='quizzes'&&b&&c==='enter'&&!d&&method==='POST'){const {client,user}=await requireUser(req);const {data,error}=await client.rpc('enter_quiz',{p_user:user.id,p_quiz:b});queryError(error);return ok(data,201);}
 if(a==='attempts'&&b&&c==='submit'&&!d&&method==='POST'){const input=submission.parse(await body(req));const {client,user}=await requireUser(req);const {data,error}=await client.rpc('submit_quiz',{p_user:user.id,p_attempt:b,p_answers:input.answers});queryError(error);return ok(data);}
 if(a==='wallet'&&b==='balance'&&!c&&method==='GET'){const {client,user}=await requireUser(req);const {data,error}=await client.from('wallets').select('balance').eq('user_id',user.id).single();queryError(error);return ok(data);}
 if(a==='wallet'&&b==='transactions'&&!c&&method==='GET'){const {client,user}=await requireUser(req);const {data,error}=await client.from('credit_transactions').select('id,amount,kind,balance_after,created_at,reference_id').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);queryError(error);return ok(data);}
 if(a==='payments'&&b==='mock'&&!c&&method==='POST'){const input=payment.parse(await body(req));const {client,user}=await requireUser(req);const {data,error}=await client.rpc('mock_purchase',{p_user:user.id,p_amount:input.amount,p_key:input.idempotency_key});queryError(error);return ok(data,201);}
 if(a==='admin'){const {client}=await requireAdmin(req);
 if(b==='quizzes'&&!c&&method==='GET'){const {data,error}=await client.from('quizzes').select('*').order('created_at',{ascending:false});queryError(error);return ok(data);}
 if(b==='quizzes'&&!c&&method==='POST'){const input=quiz.parse(await body(req));const {data,error}=await client.from('quizzes').insert(input).select().single();queryError(error);return ok(data,201);}
 if(b==='quizzes'&&c&&!d&&method==='PATCH'){const input=quiz.partial().parse(await body(req));const {data,error}=await client.from('quizzes').update(input).eq('id',c).select().maybeSingle();queryError(error);if(!data)throw new ApiError(404,'Quiz not found');return ok(data);}
 if(b==='quizzes'&&c&&!d&&method==='DELETE'){const {data,error}=await client.from('quizzes').delete().eq('id',c).select('id').maybeSingle();queryError(error);if(!data)throw new ApiError(404,'Quiz not found');return ok({deleted:true});}
 if(b==='quizzes'&&c&&d==='questions'&&method==='POST'){const input=question.parse(await body(req));const {data,error}=await client.from('questions').insert({...input,quiz_id:c}).select().single();queryError(error);return ok(data,201);}
 if(b==='questions'&&c&&!d&&method==='PATCH'){const input=question.partial().parse(await body(req));const {data,error}=await client.from('questions').update(input).eq('id',c).select().maybeSingle();queryError(error);if(!data)throw new ApiError(404,'Question not found');return ok(data);}
 if(b==='questions'&&c&&!d&&method==='DELETE'){const {data,error}=await client.from('questions').delete().eq('id',c).select('id').maybeSingle();queryError(error);if(!data)throw new ApiError(404,'Question not found');return ok({deleted:true});}
 }
 throw new ApiError(404,'Endpoint not found');
 } catch(e){return failure(e);}
}
export async function GET(r:Request,c:Ctx){return endpoint('GET',r,c)}
export async function POST(r:Request,c:Ctx){return endpoint('POST',r,c)}
export async function PATCH(r:Request,c:Ctx){return endpoint('PATCH',r,c)}
export async function DELETE(r:Request,c:Ctx){return endpoint('DELETE',r,c)}
