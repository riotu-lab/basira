import 'dotenv/config';
import {tsImport} from 'tsx/esm/api';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const {auditStore}=await tsImport('../../server/aiAudit.ts',import.meta.url);
const store=auditStore(process.env);
try{
 const remove=process.argv.find(v=>v.startsWith('--delete='))?.slice(9);
 const destination=process.argv.find(v=>v.startsWith('--export='))?.slice(9);
 if(remove){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(remove))throw Error('Invalid record ID');await store.remove(remove);console.log(JSON.stringify({deleted:remove}));}
 else{
  const records=await store.list(Number(process.argv.find(v=>v.startsWith('--limit='))?.slice(8)||50));
  if(destination){await mkdir(dirname(destination),{recursive:true,mode:0o700});await writeFile(destination,JSON.stringify(records,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({exported:records.length,path:destination}));}
  else console.log(JSON.stringify(records.map(({id,operation,status,createdAt,reviewStatus,durationMs})=>({id,operation,status,createdAt,reviewStatus,durationMs})),null,2));
 }
}finally{store.close?.();}
