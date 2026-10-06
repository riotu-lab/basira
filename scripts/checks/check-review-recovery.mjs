import '../lib/output-dirs.mjs';
import {writeFile} from 'node:fs/promises';
const base='https://basira-ruby.vercel.app';
const checks=[];
for(const language of ['ar','en']){
 const turns=[{id:'q1',role:'assistant',text:'ماذا يعني لك الإيمان في حياتك اليومية؟',at:1,delivery:'uncertain',interrupted:true},{id:'a1',role:'user',text:'الإيمان يقضي معنى الحياة',at:2},{id:'q2',role:'assistant',text:'كيف يظهر ذلك في تصرفاتك؟',at:3,delivery:'uncertain',interrupted:true},{id:'a2',role:'user',text:'الإيمان يعطي معنا للحياة.',at:4}];
 const r=await fetch(base+'/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,turns}),signal:AbortSignal.timeout(30000)});
 const result=await r.json();if(!r.ok||result.status!=='insufficient_delivery'||result.findings?.length!==0)throw Error(`Unexpected review state: HTTP ${r.status}`);
 checks.push({language,httpStatus:r.status,result});console.log(language+': interrupted conversation returns normal review guidance, no fabricated findings');
}
await writeFile('artifacts/reports/review-recovery-deployed.json',JSON.stringify({date:new Date().toISOString(),url:base,kind:'Real deployed HTTP checks with synthetic transcript; deterministic delivery guard, no model call; browser not tested',checks},null,2));
