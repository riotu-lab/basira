import '../lib/output-dirs.mjs';
// Identical application request through local Express and hosted Vercel.
// Prints only status/categories. Never prints credentials or session handles.
import {readFileSync,writeFileSync} from 'node:fs';import {parse} from 'dotenv';import {createApp} from '../../server/app';
const env=parse(readFileSync('.env'));const {app,dispose}=createApp(env);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
const addr=server.address() as {port:number};const results=[];
try{
 for(const [name,base] of [['local .env + existing Express app',`http://127.0.0.1:${addr.port}`],['Vercel production','https://basira-ruby.vercel.app']]){
  let id:string|undefined;
  const result:{environment:string;status?:number;error?:string;started?:boolean;cleanup?:string}={environment:name};
  try{const r=await fetch(base+'/api/avatar/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({maxSessionSeconds:60}),signal:AbortSignal.timeout(45000)});const data=await r.json();result.status=r.status;result.started=r.ok;if(r.ok)id=data.id;else result.error=data.error;}
  catch(e){result.error=(e as Error).name;}
  finally{if(id){try{const stopped=await fetch(base+'/api/avatar/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)});result.cleanup=stopped.ok?'confirmed':'unconfirmed';}catch{result.cleanup='unconfirmed';}}else result.cleanup='no session started';}
  results.push(result);console.log(JSON.stringify(result));
 }
}finally{await dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));writeFileSync('artifacts/reports/avatar-runtime-comparison.json',JSON.stringify({date:new Date().toISOString(),capSeconds:60,results},null,2));}
