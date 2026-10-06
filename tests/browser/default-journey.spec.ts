import {test,expect} from '@playwright/test';
for(const lang of ['ar','en']){
 test(`${lang}: recording review starts enabled and remembers an explicit opt-out`,async({page})=>{
  await page.route('**/api/config',r=>r.fulfill({json:{training:{configured:true,avatarConfigured:true},ai:{configured:true},voice:{configured:true,languages:['ar','en']},avatar:{configured:true},languages:['ar','en'],audit:{enabled:false}}}));
  await page.goto(`/?app=training&lang=${lang}`);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const settings=page.locator('summary').filter({hasText:lang==='ar'?'إعدادات الحوار':'Conversation settings'});
  await settings.click();
  await expect(page.getByRole('button',{name:lang==='ar'?'الكاميرا عند البدء: مفعّلة':'Start camera: on',exact:true})).toHaveAttribute('aria-pressed','true');
  const off=lang==='ar'?'إيقاف حفظ التسجيل للمراجعة':'Turn off review recording';
  const on=lang==='ar'?'تفعيل حفظ التسجيل للمراجعة':'Turn on review recording';
  await page.getByRole('button',{name:off,exact:true}).click();await page.reload();await settings.click();await expect(page.getByRole('button',{name:on,exact:true})).toBeVisible();
  await page.getByRole('button',{name:on,exact:true}).click();await page.reload();
  await expect(page.getByRole('button',{name:lang==='ar'?'ابدأ الحوار':'Begin conversation',exact:true})).toBeEnabled();
  await page.screenshot({path:`artifacts/screenshots/default-journey-${lang}-${test.info().project.name}.png`,fullPage:true});
 });
 test(`${lang}: audio full report transcribes automatically (mocked services)`,async({page})=>{
  let transcriptions=0,structures=0;await page.route('**/api/content/media/audio?*',r=>{transcriptions++;return r.fulfill({json:{duration:3,units:[{id:'audio-0',kind:'audio',text:'Listen carefully.',originalText:'Listen carefully.',start:0,end:3,confirmed:false}],note:'Approximate timestamps.'}});});
  await page.route('**/api/content/structure',r=>{structures++;expect(r.request().postDataJSON().units[0].text).toBe('Listen carefully.');return r.fulfill({json:{items:[],morePossible:false}});});
  await page.route('**/api/content/review',r=>r.fulfill({json:{findings:[],coverage:'Fixture scope.',incomplete:false}}));
  await page.goto(`/?app=content&lang=${lang}`);await page.getByRole('button',{name:lang==='ar'?'صوت':'Audio',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'speech.wav',mimeType:'audio/wav',buffer:Buffer.from('mock media endpoint fixture')});
  await page.getByRole('button',{name:lang==='ar'?'راجع المحتوى':'Review content',exact:true}).click();await expect(page.locator('.content-final-report')).toBeVisible();await expect(page.locator('.assessment-loading')).toHaveCount(0);expect(transcriptions).toBe(1);expect(structures).toBe(1);
 });
}
