// Explicit JSON schemas are essential for DigitalAPI's imported API tester.
// The backend uses Zod for authoritative runtime validation.
const credentialSchema={type:'object',required:['email','password'],additionalProperties:false,properties:{email:{type:'string',format:'email',example:'demo@example.com'},password:{type:'string',example:'StrongPassword123!'}}};
const quizProperties={title:{type:'string',minLength:3,maxLength:150},description:{type:'string',maxLength:2000},stake:{type:'integer',minimum:1},reward:{type:'integer',minimum:1},pass_percentage:{type:'integer',minimum:1,maximum:100},published:{type:'boolean'}};
const quizSchema={type:'object',required:['title','stake','reward'],properties:quizProperties};
const questionProperties={prompt:{type:'string',minLength:3},options:{type:'array',minItems:2,maxItems:6,items:{type:'string'}},correct_index:{type:'integer',minimum:0,maximum:5}};
const questionSchema={type:'object',required:['prompt','options','correct_index'],properties:questionProperties};
const answersSchema={type:'object',required:['answers'],properties:{answers:{type:'object',additionalProperties:{type:'integer',minimum:0},example:{'00000000-0000-4000-8000-000000000001':1}}}};
const paymentSchema={type:'object',required:['amount','idempotency_key'],properties:{amount:{type:'integer',minimum:1,maximum:10000,example:100},idempotency_key:{type:'string',format:'uuid',example:'b4c39d7f-531a-4f52-b1bf-cd8772ac5490'}}};
const partial=(props:Record<string,unknown>)=>({type:'object',minProperties:1,properties:props});
const paths:Record<string,Record<string,unknown>>={};
function add(method:string,path:string,summary:string,config:{auth?:boolean;schema?:unknown;success?:number}={}){
 const {auth=true,schema,success=200}=config;
 paths[path]??={};
 paths[path][method.toLowerCase()]={
  summary,tags:[path.startsWith('/api/v1/admin')?'Admin':path.includes('/auth/')?'Authentication':path.includes('/wallet/')?'Wallet':'Quiz API'],
  ...(auth?{security:[{bearerAuth:[]}]}:{}),
  ...(schema?{requestBody:{required:true,content:{'application/json':{schema}}}}:{}),
  parameters:[...path.matchAll(/\\{([^}]+)\\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:{type:'string',format:'uuid'}})),
  responses:{[success]:{description:'Success',content:{'application/json':{schema:{type:'object',required:['data'],properties:{data:{}}}}}},'400':{description:'Invalid request / validation error'},'401':{description:'Missing or invalid bearer token / credentials'},'403':{description:'Admin role required'},'404':{description:'Resource not found'},'409':{description:'Conflict'},'500':{description:'Internal server error'}}
 };
}
add('get','/api/v1/health','Health check',{auth:false});
add('post','/api/v1/auth/register','Register (500 initial credits)',{auth:false,schema:credentialSchema,success:201});
add('post','/api/v1/auth/login','Log in and receive bearer access token',{auth:false,schema:credentialSchema});
add('get','/api/v1/quizzes','List published quizzes');
add('get','/api/v1/quizzes/{id}','Get quiz questions (correct answers hidden)');
add('post','/api/v1/quizzes/{id}/enter','Stake credits to enter quiz',{success:201});
add('get','/api/v1/attempts','List the authenticated user’s quiz attempts');
add('post','/api/v1/attempts/{id}/submit','Submit answers and settle reward',{schema:answersSchema});
add('get','/api/v1/attempts/{id}/review','Review a submitted attempt with selected and correct answers');
add('get','/api/v1/wallet/balance','Current credit balance');
add('get','/api/v1/wallet/transactions','Credit transaction history');
add('post','/api/v1/payments/mock','Mock credit purchase',{schema:paymentSchema,success:201});
add('get','/api/v1/admin/quizzes','List all quizzes');
add('post','/api/v1/admin/quizzes','Create quiz',{schema:quizSchema,success:201});
add('patch','/api/v1/admin/quizzes/{id}','Update quiz',{schema:partial(quizProperties)});
add('delete','/api/v1/admin/quizzes/{id}','Delete quiz');
add('post','/api/v1/admin/quizzes/{id}/questions','Add question',{schema:questionSchema,success:201});
add('patch','/api/v1/admin/questions/{id}','Update question',{schema:partial(questionProperties)});
add('delete','/api/v1/admin/questions/{id}','Delete question');
export async function GET(){return Response.json({openapi:'3.1.0',info:{title:'DigitalAPI Quiz API',version:'0.2.0',description:'JSON requests use Content-Type: application/json. Protected routes require a Supabase access token.'},servers:[{url:process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'}],components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}}},paths});}
