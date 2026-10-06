import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {McpClient,MCP_ENDPOINTS,retrievalError,type RetrievalProvider} from '../../server/mcpClient.js';
// No model request, private content, or credential output. Saves discovered schemas locally.
await mkdir('.local/source-mcp',{recursive:true});
for(const provider of Object.keys(MCP_ENDPOINTS) as RetrievalProvider[]){
 const client=new McpClient(provider,process.env[provider==='turath'?'TURATH_MCP_TOKEN':'ISLAMIC_CONTENT_MCP_TOKEN']||'');
 try{
  const discovered=await client.connect(AbortSignal.timeout(25000));
  await writeFile(`.local/source-mcp/${provider}.json`,JSON.stringify({checkedAt:new Date().toISOString(),endpoint:MCP_ENDPOINTS[provider],...discovered},null,2)+'\n');
  console.log(JSON.stringify({provider,status:'connected',tools:discovered.tools.map(t=>t.name)}));
 }catch(e){console.log(JSON.stringify({provider,status:'failed',category:retrievalError(e)}));process.exitCode=1;}
 finally{await client.close();}
}
