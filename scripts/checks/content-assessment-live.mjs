// Real extraction, retrieval and AI judgment; consumes model credits.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:1000}}),results=[];
let stage='open';
page.setDefaultTimeout(30000);
try{for(const lang of ['ar','en']){
 stage=lang+':open';console.log(JSON.stringify({stage}));
 const ar=lang==='ar',title=`Assessment acceptance ${lang} ${Date.now()}`;
 await page.goto((process.env.BASIRA_TEST_URL||'http://127.0.0.1:3007')+'/?app=content&lang='+lang);
 await page.locator('#content-language').selectOption(lang);await page.locator('#report-title').fill(title);
 await page.locator('#publication-text').fill(ar?'يمسح ظاهر الخف في الوضوء.':'Wiping the upper surface of leather socks is permitted during ablution.');
 stage=lang+':generate';console.log(JSON.stringify({stage}));
 await page.getByRole('button',{name:ar?'راجع المحتوى':'Review content',exact:true}).click();
 await page.locator('.assessment-item').first().waitFor({timeout:180000});await expect(page.locator('.assessment-loading')).toHaveCount(0,{timeout:180000});
 stage=lang+':review';console.log(JSON.stringify({stage}));
 await expect(page.getByRole('alert')).toHaveCount(0);const count=await page.locator('.assessment-item').count();
 await page.getByRole('button',{name:ar?'تعديل المراجعة':'Edit review',exact:true}).first().click();await page.getByLabel(ar?'ملاحظة المراجع':'Reviewer note',{exact:true}).first().fill('Human acceptance check');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:ar?'تصدير تقرير مقروء':'Export readable report',exact:true}).click();await download;
 await expect(page.getByText(ar?'محفوظ على هذا الجهاز':'Saved on this device',{exact:true})).toBeVisible();
 stage=lang+':reopen';console.log(JSON.stringify({stage}));
 await page.reload();await page.locator('.report-library summary').click();await page.locator('.saved-report').filter({hasText:title}).getByRole('button',{name:ar?'فتح':'Open',exact:true}).click();await expect(page.getByLabel(ar?'ملاحظة المراجع':'Reviewer note',{exact:true}).first()).toHaveValue('Human acceptance check');
 await mkdir('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/assessment-live-${lang}.png`,fullPage:true,animations:'disabled'});
 results.push({language:lang,realModel:true,realRetrieval:true,assessedItems:count,export:true,persistence:true});
 await page.getByRole('button',{name:ar?'حذف التقرير':'Delete report',exact:true}).click();await expect(page.locator('.content-final-report')).toHaveCount(0);
}}catch(e){await page.screenshot({path:'artifacts/screenshots/assessment-live-failure.png',fullPage:true,animations:'disabled'}).catch(()=>{});results.push({stage,error:String(e.message).slice(0,400)});process.exitCode=1;}finally{await browser.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/content-assessment-live.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
