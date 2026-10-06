import 'dotenv/config';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import express from 'express';
import path from 'node:path';
import { createApp } from './app.js';
import {runtimeIdentity,connectivity} from './connectivity.js';

const {app,dispose}=createApp();
const server=createHttpServer(app);
let vite:Awaited<ReturnType<typeof createViteServer>>|undefined;
let closing=false;
async function shutdown(){
  if(closing)return;closing=true;
  await dispose();await vite?.close();server.close();
}
server.on('error',async(error:NodeJS.ErrnoException)=>{
  console.error(`Basira failed to listen (${error.code||'UNKNOWN'}). ${error.code==='EADDRINUSE'?'The configured HTTP port is occupied. No process was terminated.':error.code==='EPERM'?'The environment denied local networking. Start in a permitted terminal or change the managed permission policy.':'Check HOST and PORT.'}`);
  process.exitCode=1;await shutdown();
});
process.once('SIGINT',()=>void shutdown());
process.once('SIGTERM',()=>void shutdown());
if(process.env.NODE_ENV==='production')app.use(express.static(path.resolve('dist')));
else {
  // One server for HTTP and HMR; no separate 24678/24691 listener.
  vite=await createViteServer({server:{middlewareMode:true,hmr:{server}},appType:'spa'});
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535');
server.listen(port,process.env.HOST||'127.0.0.1',()=>{
  console.log(`Basira listening at http://localhost:${port}`);
  console.log('Basira runtime:',JSON.stringify({...runtimeIdentity(),bind:server.address()}));
  void connectivity().then(result=>console.log('Basira outbound connectivity:',JSON.stringify(result)));
  void fetch(`http://127.0.0.1:${port}/api/health`).then(async response=>{
    if(response.ok&&(await response.json()).service==='basira'){
      console.log('Basira HTTP health check: passed');
      const page=await fetch(`http://127.0.0.1:${port}/`);
      console.log(`Basira application HTML check: ${page.ok&&(await page.text()).includes('id="root"')?'passed':'failed'}`);
    }else console.error('Basira HTTP health check: failed');
  }).catch(()=>console.error('Basira HTTP health check: unreachable from this environment'));
});
