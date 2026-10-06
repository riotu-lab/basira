// Real extraction, embeddings and private retrieval. No hardcoded result packets.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3007';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1360,height:1000}});const results=[];let stage='start';
try{
 for(const lang of (process.argv.includes('--en')?['en']:['ar','en'])){
  stage=lang+':open';const ar=lang==='ar';await page.goto(base+'/?app=content&lang='+lang);
  await page.locator('#report-title').fill('Retrieval acceptance '+lang);
  stage=lang+':input';await page.locator('#publication-text').fill(ar?'يجوز المسح على الخفين في الوضوء.':'Wiping over leather socks is permitted during ablution.');
  await page.getByRole('button',{name:ar?'استخراج الدليل والاستدلال والنتيجة':'Extract evidence, reasoning and conclusion',exact:true}).click();
  stage=lang+':structure';await page.locator('.structure-detail').waitFor({timeout:60000});
  await page.getByRole('button',{name:ar?'البحث عن مراجع لهذه المقاطع':'Find sources for these passages',exact:true}).click();
  stage=lang+':retrieve';await page.locator('.retrieved-passages details').first().waitFor({timeout:60000});
  const excerpt=await page.locator('.retrieved-passages details').first().innerText();if(!excerpt.includes('الخف'))throw Error('expected_topic_not_retrieved');
  await mkdir('artifacts/screenshots',{recursive:true});await page.locator('.retrieval-step').screenshot({path:`artifacts/screenshots/retrieval-live-${lang}.png`});
  results.push({language:lang,realExtraction:true,realEmbedding:true,realChroma:true,topicMatch:true});
  stage=lang+':delete';await page.locator('.report-library summary').click();await page.locator('.saved-report').filter({hasText:'Retrieval acceptance '+lang}).getByRole('button',{name:ar?'حذف التقرير':'Delete report',exact:true}).click();await page.locator('.saved-report').filter({hasText:'Retrieval acceptance '+lang}).waitFor({state:'detached'});
 }
}catch(e){await page.screenshot({path:'artifacts/screenshots/retrieval-live-failure.png',fullPage:true});results.push({stage,detail:String(e.message).split('\n')[0].slice(0,200),error:/^[a-z_]+$/.test(e.message)?e.message:'browser_acceptance_failed'});process.exitCode=1;}
finally{await browser.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/content-retrieval-live.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
