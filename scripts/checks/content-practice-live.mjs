// Real providers and browser; text practice only, no avatar credits consumed.
import {chromium,expect} from '@playwright/test';import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3007',browser=await chromium.launch(),results=[];
try{for(const lang of ['ar','en']){
 const ar=lang==='ar',context=await browser.newContext({viewport:ar?{width:1360,height:1000}:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(45000);let token;let stage='open';
 page.on('response',async r=>{if(r.url().endsWith('/api/content/practice')&&r.ok())token=(await r.json()).token;});
 try{
 await page.goto(base+'/?app=content&lang='+lang);await page.locator('#content-language').selectOption(lang);await page.locator('#publication-text').fill(ar?'قال الله تعالى في سورة الإخلاص، الآية الأولى: «قل هو الله واحد».':'Quran 112:1 says: «قل هو الله واحد».');
 stage='report';console.log(JSON.stringify({lang,stage}));await page.getByRole('button',{name:ar?'راجع المحتوى':'Review content',exact:true}).click();await expect(page.locator('.assessment-loading')).toHaveCount(0,{timeout:160000});await page.locator('.assessment-item').first().waitFor({timeout:160000});
 const item=page.locator('.assessment-item').filter({hasText:'قل هو الله واحد'}).first();await item.getByRole('button',{name:ar?'قبول المراجعة':'Accept review',exact:true}).click();
 await item.getByRole('button',{name:ar?'تدرّب على هذه النقطة':'Practice this point',exact:true}).click();
 stage='practice';console.log(JSON.stringify({lang,stage}));await expect(page.locator('#training-context')).toHaveCount(0);await page.getByRole('button',{name:ar?'تفضّل الحوار بالكتابة؟':'Prefer a text conversation?',exact:true}).click();await page.getByRole('button',{name:ar?'ابدأ الحوار':'Begin conversation',exact:true}).click();
 const answer=ar?'أقترح أن نراجع الاقتباس مع سورة الإخلاص الآية الأولى في تنزيل. النص هو قل هو الله أحد، وليس واحد. هذه مقارنة لألفاظ الاقتباس فقط وليست حكمًا على تفسير الآية أو على الكاتب.':'Could we check this quotation against Quran 112:1 in Tanzil? The original Arabic reads قل هو الله أحد, rather than واحد. This is a wording comparison, not a ruling about the interpretation or the author.';
 await page.getByRole('textbox',{name:ar?'اكتب إجابتك':'Type your answer',exact:true}).fill(answer);await page.getByRole('button',{name:ar?'إرسال الإجابة وإنهاء التدريب ومراجعته':'Submit answer, end training & review',exact:true}).click();
 stage='assessment';await page.locator('.reference-assessment').waitFor({timeout:150000});await expect(page.locator('.reference-assessment')).toContainText(answer);
 await page.getByRole('button',{name:ar?'أعد الإجابة عن السؤال نفسه':'Retry the same question',exact:true}).click();await page.getByRole('textbox',{name:ar?'اكتب إجابتك':'Type your answer',exact:true}).fill(answer);await page.getByRole('button',{name:ar?'إرسال الإجابة وإنهاء التدريب ومراجعته':'Submit answer, end training & review',exact:true}).click();
 await page.locator('.reference-comparison').waitFor({timeout:150000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await mkdir('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/content-practice-${lang}.png`,fullPage:true,animations:'disabled'});
 results.push({lang,realModel:true,realRetrieval:true,signedPractice:true,originalPreserved:true,retryComparison:true,mobile:!ar});
 }catch(e){results.push({lang,stage,error:String(e.message).slice(0,300)});await page.screenshot({path:`artifacts/screenshots/content-practice-failed-${lang}.png`,fullPage:true,animations:'disabled'});process.exitCode=1;}
 finally{if(token)await context.request.post(base+'/api/training/session/delete',{data:{token}});await context.close();}
}}
finally{await browser.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/content-practice-live.json',JSON.stringify({base,results},null,2));console.log(JSON.stringify(results));}
