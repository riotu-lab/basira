import {test,expect} from '@playwright/test';
for(const lang of ['ar','en'] as const)test(`${lang}: image text correction, structured items and saved report (mocked models)`,async({page})=>{
 const ar=lang==='ar',text=ar?'قال الله تعالى: «قل هو الله أحد». تدعونا الآية إلى التأمل في وحدانية الله.':'The post cites Quran 112:1: «قل هو الله أحد». The author invites reflection on the oneness of God.';let retrieval=0;
 await page.route('**/api/content/review',r=>{retrieval++;return r.abort();});
 await page.route('**/api/content/image',r=>r.fulfill({json:{units:[{id:'image-1',kind:'frame',frameId:'image-1',start:0,end:0,text,originalText:text,confirmed:false}]}}));
 await page.route('**/api/content/structure',r=>{const u=r.request().postDataJSON().units[0];return r.fulfill({json:{morePossible:false,items:[{id:'item-1',unitId:u.id,passage:u.text,start:0,end:u.text.length,evidence:ar?'قال الله تعالى: «قل هو الله أحد».':'The post cites Quran 112:1: «قل هو الله أحد».',reasoning:'',conclusion:ar?'تدعونا الآية إلى التأمل في وحدانية الله.':'The author invites reflection on the oneness of God.',class:'quran'}]}});});
 await page.goto(`/?app=content&lang=${lang}`);await page.getByRole('button',{name:ar?'صورة':'Image',exact:true}).click();
 const fixture=await page.evaluate(async(ar)=>{await document.fonts.ready;const c=document.createElement('canvas');c.width=800;c.height=680;const ctx=c.getContext('2d')!;ctx.fillStyle='#f6f4ec';ctx.fillRect(0,0,800,680);ctx.textAlign='center';ctx.fillStyle='#355743';ctx.font='26px Tajawal';ctx.fillText(ar?'وقفة مع سورة الإخلاص':'A moment with Surah Al-Ikhlas',400,140);ctx.font='48px Tajawal';ctx.fillText('«قل هو الله أحد»',400,315);ctx.font='24px Tajawal';ctx.fillText(ar?'تدعونا الآية إلى التأمل في وحدانية الله.':'An invitation to reflect on the oneness of God.',400,440);return c.toDataURL().split(',')[1];},ar);
 await page.locator('input[type=file]').setInputFiles({name:ar?'سورة-الإخلاص.png':'surah-al-ikhlas.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
 const name=ar?'استخراج الدليل والاستدلال والنتيجة':'Extract evidence, reasoning and conclusion';
 const panel=page.getByRole('region',{name});await expect(panel).toBeVisible();
 await expect(page.locator('.extracted-text-disclosure')).not.toHaveAttribute('open','');
 await page.locator('.extracted-text-disclosure>summary').click();
 const editor=page.getByRole('textbox',{name:ar?'راجع التفريغ image-1':'Check the transcript image-1'});await expect(editor).toHaveValue(text);await editor.fill(text+(ar?' توضيح.':' Clarification.'));
 await page.getByRole('button',{name,exact:true}).click();await expect(panel).toBeVisible();await expect(panel).toContainText(ar?'غير مذكور صراحة':'Not explicitly stated');expect(retrieval).toBe(0);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.locator('.image-review-workspace').screenshot({animations:'disabled',path:`artifacts/screenshots/structure-${lang}-${test.info().project.name}.png`});
 await expect(page.getByText(ar?'محفوظ على هذا الجهاز':'Saved on this device',{exact:true})).toBeVisible();await page.reload();await page.locator('.report-library summary').click();await page.getByRole('button',{name:ar?'فتح':'Open',exact:true}).click();await expect(panel).toBeVisible();await page.locator('.extracted-text-disclosure>summary').click();await expect(page.getByRole('textbox',{name:ar?'راجع التفريغ image-1':'Check the transcript image-1'})).toContainText(ar?'توضيح.':'Clarification.');
 await page.getByRole('textbox',{name:ar?'راجع التفريغ image-1':'Check the transcript image-1'}).fill(text);await expect(panel).toHaveCount(0);await page.getByRole('button',{name:ar?'حذف التقرير':'Delete report',exact:true}).click();await expect(page.locator('.saved-report')).toHaveCount(0);
});

test('image processing cancellation and retry preserve the original (mocked models)',async({page})=>{
 let reads=0;let release:()=>void=()=>{};
 const gate=new Promise<void>(r=>{release=r;});
 const text='قال الله تعالى: «قل هو الله أحد».';
 await page.route('**/api/content/image',async r=>{reads++;if(reads===1)await gate;await r.fulfill({json:{units:[{id:'image-1',kind:'frame',text,originalText:text,confirmed:false}]}}).catch(()=>{});});
 let structures=0;
 await page.route('**/api/content/structure',r=>{structures++;return r.fulfill({json:{items:[],morePossible:false}});});
 await page.goto('/?app=content&lang=en');await page.getByRole('button',{name:'Image',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'cancel.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=','base64')});
 await expect(page.getByText('Reading visible text…',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel processing'}).click();release();
 await expect(page.getByRole('alert')).toContainText('Processing cancelled');expect(structures).toBe(0);
 await expect(page.getByRole('img',{name:'Original content',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Read image text',exact:true}).click();
 await expect(page.getByText('No qualifying quotations or claims were extracted. This is not approval of the content.')).toBeVisible();
 expect(structures).toBe(1);
});

test('failed structuring retries extracted text without rereading the image (mocked models)',async({page})=>{
 let reads=0,attempts=0;
 const text='An unsupported claim.';
 await page.route('**/api/content/image',r=>{reads++;return r.fulfill({json:{units:[{id:'image-1',kind:'frame',text,originalText:text,confirmed:false}]}});});
 await page.route('**/api/content/structure',r=>{attempts++;return r.fulfill(attempts===1?{status:502,json:{error:'invalid_content_evidence'}}:{json:{items:[{id:'1',unitId:'image-1',passage:text,start:0,end:text.length,evidence:'',reasoning:'',conclusion:text,class:'other'}],morePossible:false}});});
 await page.goto('/?app=content&lang=en');await page.getByRole('button',{name:'Image',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'retry.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=','base64')});
 await expect(page.getByRole('alert')).toBeVisible();
 await page.getByRole('button',{name:'Extract evidence, reasoning and conclusion',exact:true}).click();
 await expect(page.locator('.structure-detail')).toContainText(text);expect(reads).toBe(1);expect(attempts).toBe(2);
 await expect(page.locator('.structure-detail dl>div').first()).toContainText('Not explicitly stated');
});
