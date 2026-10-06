import {test,expect} from '@playwright/test';
test.use({reducedMotion:'reduce'});
import {questionBank} from '../../server/referencePractice';
for(const lang of ['ar','en'] as const)test(`${lang}: compact navigation, question list and retention details`,async({page})=>{
 const ar=lang==='ar',qs=questionBank().filter(q=>q.tradition==='hinduism').slice(0,2);
 const session={id:'nav-session',language:lang,tradition:'hinduism',revision:1,createdAt:Date.now(),currentId:'r0',ended:true,records:qs.map((question,i)=>({id:'r'+i,sessionId:'nav-session',language:lang,question,completed:true,turns:[],attempts:[{id:'a'+i,at:Date.now(),answer:'An answer.',assessment:{verdict:'partial',spokenFeedback:'Review this point.',points:question.points.map(p=>({id:p.id,status:'missing',answerQuote:'',explanation:'Not mentioned.'}))}}]}))};
 await page.addInitScript(()=>localStorage.setItem('basira.training-meetings.v1:legacy',JSON.stringify([{token:'a'.repeat(64),id:'nav-session',language:'ar',tradition:'hinduism',at:Date.now()}])));
 await page.route('**/api/config',r=>r.fulfill({json:{training:{configured:true,avatarConfigured:false},ai:{configured:true},voice:{configured:false,languages:['ar','en']},avatar:{configured:false},languages:['ar','en'],audit:{enabled:true,retentionDays:7}}}));
 await page.route('**/api/training/session/read',r=>r.fulfill({json:session}));
 await page.goto(`/?app=training&lang=${lang}`);await page.evaluate(()=>document.fonts.ready);const before=await page.locator('.workflow-nav button').first().boundingBox();
 await page.locator('.saved-sessions>summary').click();await page.getByRole('button',{name:ar?'فتح':'Open',exact:true}).click();
 await page.locator('.review-question-picker>summary').click();await expect(page.locator('.review-question-list button')).toHaveCount(2);await page.locator('.review-question-list button').nth(1).click();await expect(page.locator('.review-question-picker>summary')).toContainText(qs[1].question[lang]);await expect(page.locator('.review-question-picker')).not.toHaveAttribute('open','');
 await expect(page.locator('.review-count')).toHaveCount(2);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`artifacts/screenshots/review-menu-${lang}-${test.info().project.name}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:ar?'مراجعة المحتوى':'Review Content',exact:true}).click();const after=await page.locator('.workflow-nav button').first().boundingBox();expect(after!.height).toBeCloseTo(before!.height,0);expect(after!.width).toBeCloseTo(before!.width,0);
 const notice=page.getByRole('dialog');await expect(notice).not.toBeVisible();await page.getByRole('button',{name:ar?'الخصوصية والبيانات':'Privacy & data',exact:true}).click();await expect(notice).toContainText(ar?'7 أيام':'7 days');await notice.screenshot({path:`artifacts/screenshots/privacy-${lang}-${test.info().project.name}.png`});await page.keyboard.press('Escape');await expect(notice).not.toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
