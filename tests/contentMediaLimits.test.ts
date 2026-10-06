import {it,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {processMedia} from '../server/contentMedia';
const run=promisify(execFile),ffmpeg=createRequire(import.meta.url)('ffmpeg-static');
it('processes all 300 seconds without truncation and rejects 301 seconds',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'basira-limits-'));
 try{for(const seconds of [300,301]){
  const path=join(dir,seconds+'.wav');await run(ffmpeg,['-v','error','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t',String(seconds),'-y',path]);
  let received=0;const model={transcribeContent:async(_lang:string,data:Buffer)=>{received=data.length;return [{id:'audio-0',kind:'audio',text:'boundary test',originalText:'boundary test',start:299,end:300}];}};
  const result=processMedia(await readFile(path),'audio/wav','en','audio',model as any,new AbortController().signal);
  if(seconds===301)await expect(result).rejects.toThrow('media_duration_limit');else{expect((await result).duration).toBe(300);expect(received).toBeGreaterThanOrEqual(300*32000);}
 }}finally{await rm(dir,{recursive:true,force:true});}
},20000);
it('decodes supported audio/video containers with real FFmpeg and rejects corrupted media',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'basira-formats-'));
 const model={transcribeContent:async()=>[{id:'audio-0',kind:'audio',text:'Fixture transcript',originalText:'Fixture transcript',start:0,end:1}]};
 try{
  for(const [ext,mime] of [['mp3','audio/mpeg'],['m4a','audio/mp4'],['wav','audio/wav'],['ogg','audio/ogg'],['webm','audio/webm'],['mp4','video/mp4'],['mov','video/quicktime']]){
   const path=join(dir,'sample.'+ext);await run(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1','-y',path]);
   expect((await processMedia(await readFile(path),mime,'en','audio',model as any,new AbortController().signal)).units).toHaveLength(1);
  }
  await expect(processMedia(Buffer.from('corrupt bytes'),'video/mp4','en','audio',model as any,new AbortController().signal)).rejects.toThrow('media_processing_failed');
 }finally{await rm(dir,{recursive:true,force:true});}
},30000);
