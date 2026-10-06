import {test,expect} from '@playwright/test';
test('audio review failure preserves transcription and permits text assessment',async({page,request})=>{
 const bank=await(await request.get('/api/training/questions')).json(),q=bank.questions[0];
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext();await c.resume();const o=c.createOscillator(),g=c.createGain(),d=c.createMediaStreamDestination();g.gain.value=.1;o.connect(g).connect(d);o.start();setTimeout(()=>void c.close(),12000);return d.stream;};});
 await page.route('**/api/config',r=>r.fulfill({json:{ai:{configured:true},voice:{configured:false,transcriptionConfigured:true,audioAssessmentConfigured:true},avatar:{configured:false},languages:['ar','en']}}));
 await page.route('**/api/transcribe?*',r=>r.fulfill({json:{text:'My preserved answer.'}}));
 await page.route('**/api/training/speech-review?*',async r=>{await new Promise(resolve=>setTimeout(resolve,800));await r.fulfill({status:502,json:{error:'model_unavailable'}});});
 await page.route('**/api/training/assess',r=>r.fulfill({json:{verdict:'partial',spokenFeedback:'Fixture.',points:q.points.map((p:any)=>({id:p.id,status:'missing',answerQuote:'',explanation:'Fixture.'}))}}));
 await page.goto('/?app=training&lang=en');await page.getByRole('button',{name:'Practise questions from sources',exact:true}).click();await page.getByRole('button',{name:'Record answer',exact:true}).click();await page.waitForTimeout(3500);await page.getByRole('button',{name:'Stop & check transcript',exact:true}).click();
 await expect(page.getByText('Listening to your recording and reviewing spoken delivery… Your transcript is saved.')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('My preserved answer.');await expect(page.getByText('Audio review was unavailable; continue with your saved transcript or record a new attempt.')).toBeVisible();
 await page.getByRole('button',{name:'Compare my answer with the reference',exact:true}).click();await expect(page.getByText('Audio review did not complete for this recording; no substitute findings were generated. Record again to retry.')).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)[0]);expect(saved.attempts[0].answer).toBe('My preserved answer.');expect(saved.attempts[0].turns.find((t:any)=>t.role==='user').spokenDelivery.assessmentError).toBe('model_unavailable');
});
