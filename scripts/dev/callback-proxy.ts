import {createServer,request as httpRequest} from 'node:http';
import {trainingGatewayAuth} from '../../server/trainingGateway.js';
// The tunnel exposes only authenticated callbacks, never Vite, source files or app APIs.
export function createCallbackProxy(port:number,env:NodeJS.ProcessEnv){
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local application port.');
  return createServer((req,res)=>{
    if(req.method!=='POST'||!['/api/training-llm/health','/api/training-llm/chat/completions'].includes(req.url||'')){res.writeHead(404);res.end();return;}
    try{trainingGatewayAuth(req.headers.authorization,env);}catch{res.writeHead(401);res.end();return;}
    const upstream=httpRequest({hostname:'127.0.0.1',port,path:req.url,method:'POST',headers:{authorization:req.headers.authorization!,'content-type':req.headers['content-type']||'application/json',...(req.headers['content-length']?{'content-length':req.headers['content-length']}:{})}},response=>{
      res.writeHead(response.statusCode||502,{'content-type':response.headers['content-type']||'application/json','cache-control':'no-store','x-accel-buffering':'no'});
      response.pipe(res);
    });
    upstream.setTimeout(150000,()=>upstream.destroy());
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
    req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
  });
}
