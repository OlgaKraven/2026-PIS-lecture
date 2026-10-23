import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source=fs.readFileSync('course.json'),course=JSON.parse(source);
assert.equal(course.discipline,'Проектирование информационных ресурсов');assert.equal(course.moduleCode,'МДК 01.01');assert.equal(course.lectures.length,4);
const ids=new Set();let models=0,scenarios=0;
for(const l of course.lectures){
 assert.equal(l.slides.length,80);assert.equal(l.totalSeconds,7200);
 assert.equal(l.slides[3].kind,'resources');assert.equal(l.slides[3].title,'Материалы к занятиям');assert.equal(l.slides[3].body,'');assert.equal(l.slides.at(-1).title,'Вопросы от аудитории');assert.equal(l.slides.at(-1).body,'');
 assert.ok(!l.slides.some(s=>s.kind==='outcomes'||s.title==='Цель и результаты занятия'));assert.equal(l.slides[4].kind,'agenda');assert.equal(l.slides[5].kind,'section');assert.equal(l.slides[5].question,1);
 assert.equal(l.slides[0].number,1);assert.equal(l.slides.at(-1).kind,'questions');
 assert.equal(l.slides.filter(s=>s.kind==='section').length,8);
 assert.deepEqual(l.slides.filter(s=>s.kind==='literature').map(s=>s.title),['Основная литература','Дополнительная литература']);
 assert.equal(l.slides.find(s=>s.kind==='resources').visual.url,'https://disk.yandex.ru/d/P40mjNJWYJAW9g');
 let elapsed=0;
 for(const [i,s] of l.slides.entries()){
  assert.ok(!ids.has(s.id),s.id);ids.add(s.id);assert.equal(s.number,i+1);assert.ok(s.title&&s.script&&s.hint&&s.visualDescription);
  if(i>0&&!['literature','resources','questions','practice','quiz','agenda','summary'].includes(s.kind))assert.ok(s.body,s.id);
  assert.equal(s.startSeconds,elapsed);elapsed+=s.plannedSeconds;if(s.supplemental){assert.equal(s.plannedSeconds,0);}else{assert.ok(s.plannedSeconds>s.pauseSeconds,s.id);assert.ok(s.requiredWpm>=65&&s.requiredWpm<=150,`${s.id}: ${s.requiredWpm}`);}
  for(const url of s.sources)assert.equal(new URL(url).protocol,'https:');
  if(s.visual.type==='bibliography')for(const book of s.visual.books){assert.ok(fs.existsSync(book.qr));assert.equal(s.body,'');}
  if(s.learning){models++;assert.ok(s.learning.catalog);for(const variant of s.learning.scenarios){scenarios++;assert.ok(variant.input);if(s.learning.kind!=='visual')assert.ok(variant.frames[0].caption);assert.ok(variant.frames.at(-1).result);}}
 }
 // Original 240 IDs remain addressable after insertion of structural slides.
 for(let n=1;n<=60;n++)assert.ok(ids.has(`З${l.number}-С${String(n).padStart(2,'0')}`));
 assert.equal(elapsed,7200);
 const pdf=fs.readFileSync(`materials/webinar-${l.number}.pdf`);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const offline=fs.readFileSync(`materials/webinar-${l.number}.html`,'utf8');assert.ok(!/src="assets\//.test(offline));assert.ok(!/url\(assets\//.test(offline));
 const presenter=fs.readFileSync(`materials/webinar-${l.number}-script.md`,'utf8'),teacher=fs.readFileSync(`materials/webinar-${l.number}-teacher.md`,'utf8');
 const map=JSON.parse(fs.readFileSync(`materials/webinar-${l.number}-alignment.json`));assert.equal(map.sourceSha256,crypto.createHash('sha256').update(source).digest('hex'));assert.deepEqual(map.slides.map(s=>s.slideId),l.slides.map(s=>s.id));
 for(const s of l.slides){assert.ok(presenter.includes(`<a id="${s.id}"></a>`));assert.ok(teacher.includes(`<a id="${s.id}"></a>`));assert.equal(map.slides[s.number-1].displayNumber,s.number);}
 console.log(`Лекция ${l.number}: 80 слайдов; план 120 мин; расчёт ${(l.estimatedSeconds/60).toFixed(1)} мин; сценарий и текст привязаны ко всем ID.`);
}
assert.ok(models>15);assert.ok(scenarios>25);
for(const l of course.lectures){assert.equal(l.slides.filter(s=>s.quiz).length,8);assert.equal(l.slides.filter(s=>s.activity).length,8);for(const s of l.slides.filter(s=>s.quiz)){assert.ok(s.quiz.answer>=0&&s.quiz.answer<s.quiz.options.length);assert.equal(l.slides[s.number-2].kind,'practice');}}
for(const l of course.lectures)for(const s of l.slides.filter(s=>s.activity)){
 const a=s.activity;assert.equal(a.revision,2);assert.equal(a.options,undefined);assert.equal(a.answer,undefined);assert.equal(a.steps.length,3);
 for(const step of a.steps){assert.ok(step.title&&step.instruction);assert.equal(step.fields.length,2);assert.ok(s.script.includes(step.instruction));for(const field of step.fields){assert.ok(field.label&&field.feedback);assert.ok(field.answers.length);assert.ok(['text','number','set','sequence'].includes(field.mode));assert.ok(field.answers.every(x=>typeof x==='string'&&x.trim()));}}
 assert.ok(s.teacherAnswer.includes(a.steps[0].fields[0].answers[0]));
}
console.log('Проверены структура, стабильные ID, литература, QR-ресурсы, схемы и привязка преподавательских текстов.');
