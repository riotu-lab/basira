import {test,expect} from '@playwright/test';
// Opt-in: makes real model requests, with synthetic answers and no avatar/voice calls.
test.skip(process.env.BASIRA_LIVE_CHECK!=='1','Set BASIRA_LIVE_CHECK=1 to use the configured model.');
for(const language of ['ar','en'] as const)test(`${language}: real model sourced dialogue and review`,async({page})=>{
 test.setTimeout(120000);const ar=language==='ar';
 await page.goto(`/?app=training&lang=${language}`);
 await page.getByRole('button',{name:ar?'تدريب بأسئلة من المراجع':'Practise questions from sources',exact:true}).click();
 await page.getByLabel(ar?'سياق الحوار':'Dialogue context').selectOption(ar?'atheism':'judaism');
 const originalQuestionId=await page.getByLabel(ar?'اختر سؤالًا':'Choose a question').inputValue();
 const answer=page.getByRole('textbox',{name:ar?'إجابتك':'Your answer',exact:true});
 await answer.fill(ar?'أريد أن أبين حجة المؤلف بدقة، لكنني أحتاج إلى توضيح العلاقة بين مقدماته والنتيجة.':'I want to explain the author’s argument carefully, but I need to clarify how its premises support the conclusion.');
 await page.getByRole('button',{name:ar?'تابع المناقشة':'Continue discussion',exact:true}).click();
 // The grounding gate may safely reject a candidate and automatically advance instead.
 await expect.poll(async()=>await page.evaluate((id)=>{const rows=JSON.parse(localStorage.getItem('basira.reference-practice.v1')||'[]');const r=rows.find((r:any)=>r.question.id===id);return !!r&&(r.attempts.length>0||r.turns?.length===3);},originalQuestionId),{timeout:60000}).toBeTruthy();
 let original=await page.evaluate(id=>JSON.parse(localStorage.getItem('basira.reference-practice.v1')!).find((r:any)=>r.question.id===id),originalQuestionId);
 if(original.attempts.length){
  await page.getByRole('button',{name:original.question.question[language],exact:true}).click();
 }else{
  await answer.fill(ar?'لا أملك تفسيرًا كافيًا بعد، ولا أريد أن أنسب إلى المرجع ما لا يقوله.':'I do not have a sufficient explanation yet, and I do not want to attribute a claim to the source that it does not make.');
  await page.getByRole('button',{name:ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference',exact:true}).click();
 }
 await expect(page.locator('.reference-assessment')).toBeVisible({timeout:60000});
 const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('basira.reference-practice.v1')!).filter((r:any)=>r.question.id===id),originalQuestionId);
 expect([2,4]).toContain(saved[0].attempts[0].turns.length);
 expect(saved[0].attempts[0].assessment.points.length).toBe(saved[0].question.points.length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:ar?'تدرّب على هذه النقطة':'Practise this point',exact:true}).click();
 // Synthetic retry uses the stored answer to test the complete review loop, not human improvement.
 await answer.fill(saved[0].question.answer[language]);
 await page.getByRole('button',{name:ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference',exact:true}).click();
 await expect(page.locator('.reference-comparison')).toBeVisible({timeout:60000});
 const updated=await page.evaluate(id=>JSON.parse(localStorage.getItem('basira.reference-practice.v1')!).filter((r:any)=>r.question.id===id),originalQuestionId);
 expect(updated[0].attempts[0]).toEqual(saved[0].attempts[0]);
 expect(updated[0].attempts[1].focusPointId).toBeTruthy();
 expect(updated[0].attempts[1].assessment.points.map((p:any)=>p.id).sort()).toEqual(saved[0].attempts[0].assessment.points.map((p:any)=>p.id).sort());
 await page.locator('.reference-review-transcript summary').click();
 await page.screenshot({path:`artifacts/screenshots/reference-live-${language}.png`,fullPage:true,animations:'disabled'});
});
