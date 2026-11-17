#!/usr/bin/env node
// Non-destructive API smoke test. Node.js 20+. Does not register users or mutate credits.
import fs from 'node:fs';

const base = (process.env.API_BASE_URL || 'https://digitalapi-quiz-qfysxyx6qa-el.a.run.app').replace(/\/$/, '');
const gateway = (process.env.GATEWAY_BASE_URL || '').replace(/\/$/, '');
const token = process.env.TEST_ACCESS_TOKEN || '';
const results = [];

async function check(label, url, expected, headers = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, {headers, signal: AbortSignal.timeout(12000)});
    const body = await res.text();
    const pass = expected.includes(res.status);
    results.push({label, url, status:res.status, pass, ms:Date.now()-start, response:body.slice(0,300)});
    console.log(`${pass?'PASS':'FAIL'} ${label}: HTTP ${res.status} (${Date.now()-start}ms)`);
    return {res,body};
  } catch (err) {
    results.push({label,url,pass:false,error:String(err)});
    console.log(`FAIL ${label}: ${err.message}`);
  }
}

await check('Cloud Run health', `${base}/api/v1/health`, [200]);
const spec=await check('Cloud Run OpenAPI', `${base}/api/openapi.json`, [200]);
if(spec?.res.ok) {
  try {
    const json=JSON.parse(spec.body);
    const hasPaths = json.openapi?.startsWith('3.') && Object.keys(json.paths||{}).length >= 10;
    results.push({label:'OpenAPI structure (>=10 paths)',pass:!!hasPaths,pathCount:Object.keys(json.paths||{}).length,servers:json.servers});
    console.log(`${hasPaths?'PASS':'FAIL'} OpenAPI structure`);
  } catch(e) {results.push({label:'OpenAPI JSON parsing',pass:false,error:String(e)});}
}
await check('Wallet without bearer token should be protected', `${base}/api/v1/wallet/balance`, [401]);
if(token) {
 await check('Authenticated wallet balance', `${base}/api/v1/wallet/balance`, [200], {Authorization:`Bearer ${token}`});
 await check('Authenticated transaction history', `${base}/api/v1/wallet/transactions`, [200], {Authorization:`Bearer ${token}`});
 await check('Authenticated quizzes', `${base}/api/v1/quizzes`, [200], {Authorization:`Bearer ${token}`});
} else console.log('SKIP authenticated checks: TEST_ACCESS_TOKEN not supplied');
if(gateway) {
 await check('DigitalAPI gateway health', `${gateway}/api/v1/health`, [200]);
 await check('DigitalAPI gateway wallet without token', `${gateway}/api/v1/wallet/balance`, [401]);
 if(token) await check('DigitalAPI gateway wallet with token', `${gateway}/api/v1/wallet/balance`, [200], {Authorization:`Bearer ${token}`});
} else console.log('SKIP gateway checks: GATEWAY_BASE_URL not supplied');
const report = {generatedAt:new Date().toISOString(),base,gateway:gateway||null,results,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length};
const path = process.env.REPORT_PATH || 'smoke-results.json';
fs.writeFileSync(path,JSON.stringify(report,null,2));
console.log(`Report: ${path} | ${report.passed} passed, ${report.failed} failed`);
if(report.failed) process.exitCode=1;
