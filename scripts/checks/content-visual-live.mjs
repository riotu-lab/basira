// Real vision model checks against synthetic publication artwork, not human accuracy acceptance.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {chromium} from '@playwright/test';import ffmpeg from 'ffmpeg-static';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3007',results=[],browser=await chromium.launch();
await mkdir('artifacts/reports',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:800,height:600}});await p.setContent('<body style="margin:0;background:#f4efd9;color:#244b39;font:32px Arial;text-align:center;padding:50px"><div style="font-size:100px">☘</div><h1>Community garden</h1><p>Saturday · Everyone welcome</p></body>');const png=await p.screenshot();await writeFile('artifacts/reports/visual-poster.png',png);
 await promisify(execFile)(ffmpeg,['-v','error','-loop','1','-i','artifacts/reports/visual-poster.png','-t','3','-r','10','-pix_fmt','yuv420p','-y','artifacts/reports/visual-poster.mp4']);
 for(const [language,kind] of [['ar','image'],['en','image'],['ar','video']]){
 const body=kind==='image'?png:await readFile('artifacts/reports/visual-poster.mp4');const r=await fetch(base+`/api/content/visual/${kind}?language=${language}&audience=General%20public&purpose=Community%20event%20announcement`,{method:'POST',headers:{'Content-Type':kind==='image'?'image/png':'video/mp4'},body,signal:AbortSignal.timeout(150000)});const v=await r.json();if(!r.ok)throw Error(`${kind}:${r.status}:${v.error}`);
 if(!v.descriptions.length||v.findings.some(f=>f.frameIds.some(id=>!v.frames.some(g=>g.id===id))))throw Error('evidence_link_failure');
 if(kind==='video'&&(v.frames.length>6||v.frames.length<3||v.frames.at(-1).at<=0))throw Error('distributed_sampling_failed');
 results.push({language,kind,realVision:true,syntheticMedia:true,frames:v.frames.length,findings:v.findings.length,evidenceLinksValid:true});await writeFile(`artifacts/reports/visual-${language}-${kind}.json`,JSON.stringify(v));
 }
}catch(e){results.push({error:e.message});process.exitCode=1;}finally{await browser.close();await writeFile('artifacts/reports/content-visual-live.json',JSON.stringify({base,results},null,2));console.log(JSON.stringify(results));}
