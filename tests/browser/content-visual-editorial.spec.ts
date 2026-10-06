import {test,expect} from '@playwright/test';
for(const lang of ['ar','en'])test(`${lang} visual-only image review, decisions and persistence (mocked model)`,async({page})=>{
 const ar=lang==='ar';let retrieval=0;
 await page.route('**/api/content/image',r=>r.fulfill({json:{units:[]}}));
 await page.route('**/api/content/retrieve',r=>{retrieval++;return r.abort();});
 await page.goto(`/?app=content&lang=${lang}`);
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d')!;g.fillStyle='#f5f0dd';g.fillRect(0,0,800,600);g.fillStyle='#365949';g.beginPath();g.arc(400,260,110,0,Math.PI*2);g.fill();return c.toDataURL();});
 await page.route('**/api/content/visual/image?*',r=>r.fulfill({json:{version:1,kind:'image',frames:[{id:'image-1',at:0,image,text:''}],summary:ar?'مساحة هادئة مع عنصر مركزي واضح.':'A calm layout with a clear central element.',descriptions:[{frameId:'image-1',description:ar?'دائرة خضراء فوق خلفية فاتحة.':'A green circle on a pale background.'}],findings:[{id:'visual-0',aspect:'context',status:'uncertain',observation:ar?'الغرض من المنشور غير محدد بصريًا.':'The intended message is not visually specified.',reasoning:ar?'لا يظهر عنوان أو شرح مرافق.':'There is no visible title or accompanying explanation.',suggestion:ar?'أضف تعليقًا يوضح المقصود للجمهور.':'Add a caption explaining the intended message.',frameIds:['image-1'],decision:'pending',reviewerNote:'',editedSuggestion:''}]}}));
 await page.getByRole('button',{name:ar?'صورة':'Image',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'poster.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
 await page.getByRole('button',{name:ar?'مراجعة الصورة والمشاهد فقط':'Review visuals only',exact:true}).click();
 const panel=page.locator('.visual-editorial');await expect(panel).toBeVisible();await expect(panel.locator('figure img')).toBeVisible();expect(retrieval).toBe(0);
 await panel.getByRole('button',{name:ar?'تعديل الملاحظة':'Edit finding',exact:true}).click();await panel.getByRole('textbox',{name:ar?'اقتراحك التحريري':'Your editorial suggestion'}).fill(ar?'إضافة عنوان واضح.':'Add a clear title.');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`artifacts/screenshots/visual-editorial-${lang}-${test.info().project.name}.png`,fullPage:true});
 await expect(page.getByText(ar?'محفوظ على هذا الجهاز':'Saved on this device',{exact:true})).toBeVisible();
 await page.reload();await page.locator('.report-library summary').click();await page.getByRole('button',{name:ar?'فتح':'Open',exact:true}).click();await expect(panel.getByRole('textbox',{name:ar?'اقتراحك التحريري':'Your editorial suggestion'})).toHaveValue(ar?'إضافة عنوان واضح.':'Add a clear title.');
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:ar?'تصدير تقرير مقروء':'Export readable report'}).click();expect((await dl).suggestedFilename()).toContain('basira-review');
 await page.getByRole('button',{name:ar?'حذف التقرير':'Delete report',exact:true}).click();await expect(panel).toHaveCount(0);
});

test('video full report combines independent layers and seeks to frame evidence (mocked models)',async({page})=>{
 const {execFileSync}=await import('node:child_process');const {default:ffmpeg}=await import('ffmpeg-static');const path=test.info().outputPath('sample.mp4');
 execFileSync(ffmpeg!,['-v','error','-f','lavfi','-i','color=c=green:s=320x240:d=3','-pix_fmt','yuv420p','-y',path]);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=';
 const frames=[0,1,2].map(at=>({id:`frame-${at}`,at,image,text:''}));
 await page.route('**/api/content/visual/video?*',r=>r.fulfill({json:{version:1,kind:'video',duration:3,frames,summary:'Solid green scene.',descriptions:frames.map(f=>({frameId:f.id,description:'Green background.'})),findings:[]}}));
 await page.route('**/api/content/media/audio?*',r=>r.fulfill({json:{duration:3,note:'Synthetic transcript.',units:[{id:'audio-0',kind:'audio',text:'Listen with care.',originalText:'Listen with care.',start:0,end:2,confirmed:false}]}}));
 await page.route('**/api/content/media/frames?*',r=>r.fulfill({json:{duration:3,frames,note:'Samples only.'}}));
 await page.route('**/api/content/structure',r=>r.fulfill({json:{items:[],morePossible:false}}));
 await page.route('**/api/content/review',r=>r.fulfill({json:{findings:[],coverage:'Fixture',incomplete:false}}));
 await page.goto('/?app=content&lang=en');await page.getByRole('button',{name:'Video',exact:true}).click();await page.locator('input[type=file]').setInputFiles(path);
 await page.getByRole('button',{name:'Review content',exact:true}).click();await expect(page.locator('.visual-editorial')).toBeVisible();await expect(page.locator('.assessment-loading')).toHaveCount(0);
 await expect(page.locator('.visual-editorial')).toContainText('Only 3 sampled frames');await page.getByRole('button',{name:'View frame 2.0',exact:true}).click();await page.getByRole('button',{name:'View this moment in the video'}).click();
 await expect(page.locator('.assessment-original')).toHaveAttribute('open','');await expect.poll(()=>page.locator('.assessment-original video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeCloseTo(2,1);
 await expect(page.locator('.assessment-original')).toContainText('Listen with care.');
});
