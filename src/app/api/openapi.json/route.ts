const paths:Record<string,Record<string,unknown>>={};
function add(method:string,path:string,summary:string,auth=true,requestBody=false){
 paths[path]??={};paths[path][method.toLowerCase()]={summary,tags:[path.startsWith('/api/v1/admin')?'Admin':'Quiz API'],...(auth?{security:[{bearerAuth:[]}]}:{}),...(requestBody?{requestBody:{required:true,content:{'application/json':{schema:{type:'object'}}}}}:{}),parameters:[...path.matchAll(/\{([^}]+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:{type:'string',format:'uuid'}})),responses:{'200':{description:'Success'},'400':{description:'Invalid request'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'},'500':{description:'Internal error'}}};
}
add('get','/api/v1/health','Health check',false);
add('post','/api/v1/auth/register','Register',false,true);
add('post','/api/v1/auth/login','Login',false,true);
add('get','/api/v1/quizzes','Published quizzes');
add('get','/api/v1/quizzes/{id}','Quiz details (answers hidden)');
add('post','/api/v1/quizzes/{id}/enter','Stake credits');
add('post','/api/v1/attempts/{id}/submit','Score quiz and settle reward',true,true);
add('get','/api/v1/wallet/balance','Wallet balance');
add('get','/api/v1/wallet/transactions','Transactions');
add('post','/api/v1/payments/mock','Mock purchase',true,true);
add('get','/api/v1/admin/quizzes','Admin list');
add('post','/api/v1/admin/quizzes','Create quiz',true,true);
add('patch','/api/v1/admin/quizzes/{id}','Update quiz',true,true);
add('delete','/api/v1/admin/quizzes/{id}','Delete quiz');
add('post','/api/v1/admin/quizzes/{id}/questions','Create question',true,true);
add('patch','/api/v1/admin/questions/{id}','Update question',true,true);
add('delete','/api/v1/admin/questions/{id}','Delete question');
export async function GET(){return Response.json({openapi:'3.1.0',info:{title:'DigitalAPI Quiz API',version:'0.1.0'},servers:[{url:process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'}],components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}}},paths});}
