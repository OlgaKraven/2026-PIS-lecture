import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchBrowser} from './browser-runtime.mjs';
const course=JSON.parse(fs.readFileSync('course.json')),base=process.env.SITE_URL||'http://127.0.0.1:4177/';
const report={errors:[],quizzes:0,activities:0,offline:0};fs.mkdirSync('output/practice-review',{recursive:true});
const browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));
 for(const l of course.lectures){
  for(const s of l.slides.filter(s=>s.quiz)){
   const q=s.quiz;await page.goto(`${base}?webinar=${l.number}&slide=${s.number}&mode=deck`);await page.locator('.quiz').waitFor();
   assert.equal(await page.locator('.quiz-solution').isVisible(),false);
   await page.locator('.quiz input').nth((q.answer+1)%q.options.length).check();await page.locator('[data-check-answer]').click();assert.match(await page.locator('.quiz-feedback').innerText(),/Пока неверно/);
   await page.locator('.quiz input').nth(q.answer).check();await page.locator('[data-check-answer]').click();assert.match(await page.locator('.quiz-feedback').innerText(),/Верно/);
   await page.reload();await page.locator('.quiz-feedback').waitFor();assert.equal(await page.locator('.quiz input').nth(q.answer).isChecked(),true);assert.match(await page.locator('.quiz-feedback').innerText(),/Верно/);assert.equal(await page.locator('.quiz-solution').isVisible(),false);
   await page.locator('[data-reveal-answer]').click();assert.ok((await page.locator('.quiz-solution').innerText()).includes(q.explanation));report.quizzes++;
  }
  for(const s of l.slides.filter(s=>s.activity)){
   const a=s.activity;await page.evaluate(a=>localStorage.setItem(`pis-activity-${a.id}-r1`,JSON.stringify({prediction:'Старый черновик'})),a);await page.goto(`${base}?webinar=${l.number}&slide=${s.number}&mode=deck`);await page.locator('[data-activity]').waitFor();const popup=page.waitForEvent('popup');await page.locator('[data-activity]').click();const activity=await popup;activity.on('pageerror',e=>report.errors.push(e.message));await activity.locator('.activity-page').waitFor();
   assert.equal(await activity.locator('input[type=radio]').count(),0);assert.equal(await activity.locator('[data-prediction]').inputValue(),'');await activity.locator('[data-check-step]').click();assert.match(await activity.locator('[data-step-feedback]').innerText(),/Сначала запишите/);assert.equal(await activity.locator('[data-step-key]').isVisible(),false);
   assert.equal(await activity.locator('[data-step-go="1"]').isDisabled(),true);
   assert.equal(await activity.locator('[data-step-key]').isVisible(),false);
   await activity.locator('[data-team]').fill('Команда 1');await activity.locator('[data-prediction]').fill('Сопоставим правило с результатами каждого шага.');
   for(let i=0;i<a.steps.length;i++){
    const step=a.steps[i];assert.match(await activity.locator('.team-step-label').innerText(),new RegExp('Шаг '+(i+1)));
    await activity.locator('[data-check-step]').click();assert.equal(await activity.locator('[data-team-next]').isDisabled(),true);
    for(let j=0;j<step.fields.length;j++)await activity.locator(`[data-team-field="${j}"]`).fill('ошибочный результат');
    await activity.locator('[data-step-reason]').fill('Обосновываем по условию и проверяем контрпример.');await activity.locator('[data-check-step]').click();assert.match(await activity.locator('[data-step-feedback]').innerText(),/Проверено 0/);assert.equal(await activity.locator('[data-team-next]').isDisabled(),true);
    await activity.locator('[data-step-key]').click();for(const f of step.fields)assert.ok((await activity.locator('[data-step-solution]').innerText()).includes(f.answers[0]));await activity.locator('[data-step-key]').click();
    for(let j=0;j<step.fields.length;j++){
     const f=step.fields[j];await activity.locator(`[data-team-field="${j}"]`).fill(f.answers[0]);await activity.locator('[data-check-step]').click();
     assert.match(await activity.locator('[data-step-feedback]').innerText(),new RegExp('Проверено '+(j+1)+' из '+step.fields.length));
     if(j<step.fields.length-1)assert.equal(await activity.locator('[data-team-next]').isDisabled(),true);
    }
    assert.equal(await activity.locator('[data-team-next]').isDisabled(),false);await activity.locator('[data-team-next]').click();report.steps=(report.steps||0)+1;
   }
   assert.equal(await activity.locator('[data-team-complete]').isVisible(),true);await activity.locator('[data-activity-solution]').click();assert.ok((await activity.locator('[data-solution]').innerText()).includes(a.explanation));
   await activity.locator('[data-conclusion]').fill('Проверили все результаты и уточнили исходный прогноз.');await activity.reload();await activity.locator('[data-team-complete]').waitFor({state:'visible'});assert.equal(await activity.locator('[data-team]').inputValue(),'Команда 1');assert.equal(await activity.locator('[data-conclusion]').inputValue(),'Проверили все результаты и уточнили исходный прогноз.');assert.equal(await activity.locator('[data-solution]').isVisible(),false);
   // Changing an early result invalidates all later checks, preserving their drafts.
   await activity.locator('[data-step-go="0"]').click();await activity.locator('[data-team-field="0"]').fill('изменение');assert.equal(await activity.locator('[data-step-go="1"]').isDisabled(),true);assert.equal(await activity.locator('[data-team-complete]').isVisible(),false);await activity.reload();assert.equal(await activity.locator('[data-team-field="0"]').inputValue(),'изменение');
   assert.equal(await activity.evaluate(a=>JSON.parse(localStorage.getItem(`pis-activity-${a.id}-r1`)).prediction,a),'Старый черновик');await activity.close();report.activities++;
  }
 }
 // Aggregate reports use actual checked answers and persist by task/revision.
 await page.goto(`${base}?webinar=1&slide=10&mode=deck`);await page.locator('[data-tools]').click();await page.locator('[data-assessment]').click();assert.match(await page.locator('.assessment-progress').innerText(),/8 из 8 баллов/);await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 // Audience never restores a checked/revealed answer from teacher local storage.
 await page.goto(`${base}?webinar=1&slide=10&mode=presenter`);await page.locator('.quiz').waitFor();const popup=page.waitForEvent('popup');await page.locator('[data-audience]').click();const audience=await popup;await audience.locator('.quiz').waitFor();assert.equal(await audience.locator('.quiz-solution').isVisible(),false);assert.equal(await audience.locator('.quiz-feedback').innerText(),'');await page.locator('[data-reveal-answer]').click();await audience.locator('.quiz-solution').waitFor({state:'visible'});await page.locator('[data-reveal-answer]').click();await audience.locator('.quiz-solution').waitFor({state:'hidden'});await audience.close();
 for(const theme of ['light','dark']){
  await page.evaluate(t=>localStorage.setItem('pis-theme',t),theme);
  for(const [name,n] of [['literature',2],['passport',9],['quiz',10],['external',23]]){await page.goto(`${base}?webinar=1&slide=${n}&mode=deck`);await page.locator('.slide-frame').waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`output/practice-review/${name}-${theme}.png`});}
  await page.goto(`${base}?webinar=1&slide=9&mode=activity`);await page.locator('.activity-page').waitFor();await page.screenshot({path:`output/practice-review/activity-${theme}.png`,fullPage:true});
 }
 for(const width of [320,390,1024]){
  await page.setViewportSize({width,height:844});for(const mode of ['deck','activity']){await page.goto(`${base}?webinar=1&slide=${mode==='deck'?10:9}&mode=${mode}`);await page.locator(mode==='deck'?'.quiz':'.activity-page').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`overflow ${width} ${mode}`);await page.screenshot({path:`output/practice-review/${mode}-${width}.png`,fullPage:true});}
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`${base}?webinar=3&slide=${course.lectures[2].slides.find(s=>s.learning?.id==='request').number}&mode=deck`);await page.locator('[data-diagram]').click();await page.locator('[data-play]').click();assert.match(await page.locator('.learning-toolbar').innerText(),/Шаг 1/);await page.waitForTimeout(2100);assert.match(await page.locator('.learning-toolbar').innerText(),/Шаг 1/);
 // Offline questions and new-tab independent activities run without HTTP access.
 await page.route('http**/*',r=>r.abort());
 for(const l of course.lectures){
  const url=pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href;
  for(const s of l.slides.filter(s=>s.activity)){
   await page.goto(url+'#activity='+encodeURIComponent(s.id));await page.locator('.activity-page').waitFor();await page.locator('[data-step-go="0"]').click();await page.locator('[data-prediction]').fill('Прогноз команды без доступа к сети.');
   for(const step of s.activity.steps){for(let j=0;j<step.fields.length;j++)await page.locator(`[data-team-field="${j}"]`).fill(step.fields[j].answers[0]);await page.locator('[data-step-reason]').fill('Проверяем правило и результат по условию.');await page.locator('[data-check-step]').click();assert.equal(await page.locator('[data-team-next]').isDisabled(),false);await page.locator('[data-team-next]').click();}
   assert.equal(await page.locator('[data-team-complete]').isVisible(),true);report.offline++;
  }
 }

 assert.deepEqual(report.errors,[]);console.log(report);
}finally{fs.writeFileSync('output/practice-review/report.json',JSON.stringify(report,null,2));await browser.close();}
