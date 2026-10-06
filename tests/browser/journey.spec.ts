import {test,expect} from '@playwright/test';
for(const language of ['ar','en']){
 test(`${language}: live-only setup retains text and avatar options`,async({page})=>{
  await page.route('**/api/config',route=>route.fulfill({json:{ai:{configured:true,missing:[]},voice:{configured:true,languages:['ar','en']},avatar:{configured:false,missing:[]},languages:['ar','en']}}));
  await page.goto(`/?app=training&lang=${language}`);
  await expect(page.getByRole('button',{name:language==='ar'?'معاينة مكتوبة':'Scripted preview',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:language==='ar'?'نص':'Text',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 });
}
test('configured AI error is explicit (mocked API, real browser)',async({page})=>{
  await page.route('**/api/config',route=>route.fulfill({json:{ai:{configured:true,missing:[]},voice:{configured:true,languages:['ar','en']},avatar:{configured:false,missing:[]},languages:['ar','en']}}));
  await page.route('**/api/conversation',route=>route.fulfill({status:502,json:{error:'model_connection_failed'}}));
  await page.goto('/?app=training');await page.getByRole('button',{name:'نص',exact:true}).click();await page.getByRole('button',{name:'ابدأ المناقشة',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.turn')).toHaveCount(0);
});

// Ready for a permitted browser environment. Model extraction is mocked here;
// actual provider evidence is recorded separately by test:content-live.
for(const language of ['ar','en'])test(`${language}: publication review layout and human decision`,async({page})=>{
 const passage='Quran 112:1: قل هو الله واحد';
 await page.route('**/api/content/review',route=>route.fulfill({json:{coverage:'Arabic Quran only; no religious approval.',incomplete:false,findings:[{id:'f1',unitId:'text-1',start:0,end:passage.length,passage,quote:'قل هو الله واحد',category:'textual_mismatch',explanation:'Compare this quotation with the cited source.',reference:{id:'quran-112-1',title:'Quran 112:1',url:'https://tanzil.net/#112:1',excerpt:'قُلْ هُوَ اللَّهُ أَحَدٌ',provider:'Tanzil'},correction:'قُلْ هُوَ اللَّهُ أَحَدٌ',uncertain:false,decision:'pending',reviewerNote:'',editedCorrection:'',practiceEligible:true}]}}));
 await page.goto('/?app=training');if(language==='en')await page.getByRole('button',{name:'لغة الواجهة'}).click();
 await page.getByRole('button',{name:language==='ar'?'مراجعة المحتوى':'Review Content',exact:true}).click();
 await page.locator('#publication-text').fill(passage);
 await page.getByRole('button',{name:language==='ar'?'راجع هذا المحتوى':'Review this content'}).click();
 await expect(page.locator('.content-finding')).toHaveCount(1);
 await page.getByRole('button',{name:language==='ar'?'قبول الملاحظة':'Accept finding'}).click();
 await expect(page.getByRole('button',{name:language==='ar'?'تدرّب على هذه النقطة':'Practice this point'})).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`artifacts/screenshots/${language}-${test.info().project.name}-content-review.png`,fullPage:true,animations:'disabled'});
});

for(const language of ['ar','en'])test(`${language}: focused avatar setup and explicit text fallback (mocked API)`,async({page})=>{
 // Browser-rendered synthetic camera; no physical camera or avatar credits.
 await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(constraints:MediaStreamConstraints)=>{
   if(constraints.audio!==false)throw Error('Preview must not capture microphone');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
   const ctx=canvas.getContext('2d')!;ctx.fillStyle='#577965';ctx.fillRect(0,0,320,240);ctx.fillStyle='#f5f5e9';ctx.fillRect(125,60,70,110);
   const stream=canvas.captureStream(1);(window as any).__cameraStream=stream;return stream;
  }});
 });
 let avatarCalls=0;page.on('request',r=>{if(r.url().includes('/api/avatar/'))avatarCalls++;});
 await page.route('**/api/config',r=>r.fulfill({json:{ai:{configured:true,missing:[]},voice:{configured:true,languages:['ar','en']},avatar:{configured:false,missing:[]},languages:['ar','en']}}));
 await page.route('**/api/conversation',r=>r.fulfill({json:{text:language==='ar'?'ماذا يعني لك الإيمان؟':'What does faith mean to you?',latencyMs:10}}));
 await page.goto('/?app=training');if(language==='en')await page.getByRole('button',{name:'لغة الواجهة'}).click();
 await expect(page.locator('.interaction-modes button')).toHaveCount(0);
 await expect(page.getByRole('button',{name:language==='ar'?'نص':'Text',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:language==='ar'?'ابدأ المناقشة':'Begin practice',exact:true})).toBeDisabled();
 await page.screenshot({path:`artifacts/screenshots/${language}-${test.info().project.name}-focused-setup.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:language==='ar'?'نص':'Text',exact:true}).click();
 await page.getByRole('button',{name:language==='ar'?'ابدأ المناقشة':'Begin practice',exact:true}).click();
 await expect(page.locator('.turn')).toHaveCount(1);
 await expect(page.getByRole('textbox')).toBeVisible();
 // Text mode has no camera control in the restored deployed interface.
 await expect(page.getByRole('button',{name:language==='ar'?'تشغيل الكاميرا':'Turn camera on'})).toHaveCount(0);
 expect(avatarCalls).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
for(const language of ['ar','en'])test(`${language}: credit limit warning and expiry preserve text (mocked avatar clock)`,async({page})=>{
 await page.route('**/api/config',r=>r.fulfill({json:{ai:{configured:true,missing:[]},voice:{configured:true,languages:['ar','en']},avatar:{provider:'tavus',configured:true,missing:[]},languages:['ar','en']}}));
 await page.route('**/api/conversation',r=>r.fulfill({json:{text:language==='ar'?'ماذا يعني لك الإيمان؟':'What does faith mean to you?',latencyMs:1}}));
 await page.route('**/api/speech',r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.alloc(20)}));
 await page.route('**/src/avatarConnection.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export async function createAvatarConnection(provider,lost,expired,remaining){let a,b;return {async start(){remaining(55);a=setTimeout(()=>remaining(15),1000);b=setTimeout(()=>{remaining(0);expired()},3000)},async speak(pcm,start){start();return true},listening(){},async interrupt(){},async stop(){clearTimeout(a);clearTimeout(b)}}}`}));
 await page.goto('/?app=training');if(language==='en')await page.getByRole('button',{name:'لغة الواجهة'}).click();
 await expect(page.locator('.session-limit-note')).toContainText(language==='ar'?'رصيد الخدمة':'service credits');
 await page.getByRole('button',{name:language==='ar'?'ابدأ المناقشة':'Begin practice',exact:true}).click();
 await page.locator('.composer input').fill('Preserve my unfinished draft');
 await expect(page.locator('.session-time-warning')).toBeVisible();
 await page.screenshot({path:`artifacts/screenshots/${language}-${test.info().project.name}-time-warning.png`,fullPage:true});
 await expect(page.locator('.session-time-ended')).toBeVisible();
 await expect(page.locator('.connection-error')).toHaveCount(0);
 await page.screenshot({path:`artifacts/screenshots/${language}-${test.info().project.name}-time-ended.png`,fullPage:true});
 await page.getByRole('button',{name:language==='ar'?'المتابعة بالكتابة':'Continue typing',exact:true}).click();
 await expect(page.locator('.composer input')).toHaveValue('Preserve my unfinished draft');
 await expect(page.locator('.turn.assistant')).toHaveCount(1);
 await expect(page.locator('.session-time-warning')).toHaveCount(0);
});
