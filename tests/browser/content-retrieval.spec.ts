import {test,expect} from '@playwright/test';
for(const lang of ['ar','en'] as const)test(`${lang}: source retrieval, persistence and deletion (mocked retrieval)`,async({page})=>{
 const ar=lang==='ar',text=ar?'يجوز المسح على الخفين.':'Wiping over leather socks is permitted.';
 await page.route('**/api/content/structure',r=>r.fulfill({json:{morePossible:false,items:[{id:'item-1',unitId:'text-1',passage:text,start:0,end:text.length,evidence:'',reasoning:'',conclusion:text,class:'fiqh'}]}}));
 let requests=0;
 await page.route('**/api/content/retrieve',async r=>{requests++;if(requests===1)return r.fulfill({status:503,json:{error:'content_retrieval_not_configured'}});await new Promise(resolve=>setTimeout(resolve,250));return r.fulfill({json:{at:new Date().toISOString(),status:'candidates_only',items:[{itemId:'item-1',query:text,candidates:[{id:'fiqh-12',text:'صفة المسح على الخفين: يمسح ظاهر الخف.',source:'fiqh',locator:'ج 1 · ص 37',distance:.4,truncated:false,provenance:'unverified'}]}]}});});
 await page.goto(`/?app=content&lang=${lang}`);
 await page.locator('textarea').first().fill(text);
 await page.getByRole('button',{name:ar?'استخراج الدليل والاستدلال والنتيجة':'Extract evidence, reasoning and conclusion',exact:true}).click();
 const search=page.getByRole('button',{name:ar?'البحث عن مراجع لهذه المقاطع':'Find sources for these passages',exact:true});
 await search.click();await expect(page.getByRole('alert')).toContainText(ar?'غير مهيّأ':'not configured');
 await search.click();await expect(page.getByRole('region',{name:ar?'المراجع المرشحة':'Candidate references'})).toContainText('صفة المسح');
 await expect(page.locator('.retrieved-passages')).toContainText(ar?'وليست حكمًا':'not a verdict');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.retrieval-step').screenshot({path:`artifacts/screenshots/retrieval-${lang}-${test.info().project.name}.png`});
 await expect(page.getByText(ar?'محفوظ على هذا الجهاز':'Saved on this device',{exact:true})).toBeVisible();
 await page.reload();await page.locator('.report-library summary').click();await page.getByRole('button',{name:ar?'فتح':'Open',exact:true}).click();await expect(page.locator('.retrieved-passages')).toContainText('صفة المسح');
 await page.getByRole('button',{name:ar?'حذف التقرير':'Delete report',exact:true}).click();await expect(page.locator('.retrieved-passages')).toHaveCount(0);
});
