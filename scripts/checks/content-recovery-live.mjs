// Real browser + real providers for format/recovery cases. Inputs are synthetic.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import ffmpeg from 'ffmpeg-static';
const base=process.env.BASIRA_TEST_URL||'https://basiraapp.vercel.app',dir='artifacts/acceptance-media',run=promisify(execFile),results=[];
await mkdir(dir,{recursive:true});
for(const ext of ['jpg','webp'])await run(ffmpeg,['-v','error','-i',dir+'/quotation.png','-frames:v','1','-y',dir+'/quotation.'+ext]);
await run(ffmpeg,['-v','error','-i',dir+'/quotation.mp4','-an','-c:v','copy','-y',dir+'/silent.mp4']);
await writeFile(dir+'/corrupt.wav','This is not an audio file.');
const browser=await chromium.launch();
try{for(const [kind,file,expectError] of [['Image','quotation.jpg',false],['Image','quotation.webp',false],['Video','silent.mp4',false],['Audio','corrupt.wav',true]]){
 const page=await browser.newPage({viewport:{width:390,height:844}}),steps=[],r={kind,file,realProviders:true,syntheticInput:true};
 page.on('response',async response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/content/'))steps.push({path,status:response.status()});});
 try{
  console.log(JSON.stringify({stage:'start',file}));await page.goto(base+'/?app=content&lang=en');await page.getByRole('button',{name:kind,exact:true}).click();await page.locator('input[type=file]').setInputFiles(dir+'/'+file);
  if(kind==='Image')await page.locator('.content-structure').waitFor({timeout:120000});
  await page.getByRole('button',{name:'Review content',exact:true}).click();
  if(expectError){await expect(page.getByRole('alert')).toBeVisible({timeout:60000});await expect(page.getByRole('button',{name:'Resume review'})).toBeEnabled();await expect(page.getByRole('button',{name:'Export readable report'})).toBeDisabled();r.recoveryShown=true;}
  else{await expect(page.locator('.review-summary')).toBeVisible({timeout:240000});await expect(page.locator('.assessment-loading')).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);r.items=await page.locator('.assessment-item').count();if(!r.items)throw Error('missing_assessment');if(steps.some(s=>s.path==='/api/content/review'))throw Error('removed_quotation_stage_called');r.summary=true;}
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Delete report',exact:true}).click();r.deleted=true;
 }catch(e){r.failure=String(e.message).slice(0,350);process.exitCode=1;}finally{r.steps=steps;results.push(r);console.log(JSON.stringify(r));await page.close();}
}}finally{await browser.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/content-recovery-live.json',JSON.stringify({base,results},null,2));}
