import '../lib/output-dirs.mjs';
import {writeFile} from 'node:fs/promises';
const base='https://basira-ruby.vercel.app';let id;
const report={date:new Date().toISOString(),url:base,requestedCapSeconds:60};
try{const r=await fetch(base+'/api/avatar/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({maxSessionSeconds:60}),signal:AbortSignal.timeout(45000)});const body=await r.json();report.httpStatus=r.status;if(r.ok){id=body.id;report.sessionStarted=true;}else{report.sessionStarted=false;report.error=body.error;}}
finally{if(id){const r=await fetch(base+'/api/avatar/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)});report.cleanup=r.ok?'confirmed':'unconfirmed';}else report.cleanup='no live session started';await writeFile('artifacts/reports/hosted-avatar-access.json',JSON.stringify(report,null,2));console.log(report);}
