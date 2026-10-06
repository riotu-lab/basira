import {test,expect} from '@playwright/test';
for(const lang of ['ar','en'])test(`${lang}: text-only conversation stays bounded without avatar requests`,async({page})=>{
 const ar=lang==='ar';let avatars=0;
 await page.route('**/api/config',r=>r.fulfill({json:{ai:{configured:true},voice:{configured:true,languages:['ar','en']},avatar:{configured:true},videoCall:{configured:true},languages:['ar','en'],audit:{enabled:false}}}));
 await page.route('**/api/avatar/**',r=>{avatars++;return r.abort();});
 await page.route('**/api/conversation',r=>r.fulfill({json:{text:(ar?'نستمع إلى السؤال باهتمام، ونحاول فهم المقصود قبل الإجابة. ':'Listen carefully and understand the question before answering. ').repeat(14),latencyMs:1}}));
 await page.goto(`/?app=training&lang=${lang}`);await page.getByRole('button',{name:ar?'نص':'Text',exact:true}).click();await page.getByRole('button',{name:ar?'ابدأ المناقشة':'Begin practice',exact:true}).click();
 await expect(page.locator('.turn')).toHaveCount(1);const height=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(let i=0;i<6;i++){await page.locator('.composer input').fill(ar?'أود فهم وجهة نظرك.':'I would like to understand your perspective.');await page.locator('.composer button').click();await expect(page.locator('.turn')).toHaveCount(3+i*2);}
 expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(height+2);expect(avatars).toBe(0);expect(await page.locator('.transcript').evaluate(e=>e.scrollHeight>e.clientHeight)).toBeTruthy();
 await page.screenshot({path:`artifacts/screenshots/studio-text-${lang}-${test.info().project.name}.png`,fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
