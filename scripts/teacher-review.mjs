import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {launchBrowser} from './browser-runtime.mjs';
const courseFile=fs.readFileSync('course.json'),course=JSON.parse(courseFile),digest=crypto.createHash('sha256').update(courseFile).digest('hex'),out='output/teacher-review';fs.mkdirSync(out,{recursive:true});
const report={sourceSha256:digest,sourceVersion:course.version,slides:0,presenter:0,offline:0,models:0,keys:0,errors:[],timing:[]};
const baseline=process.env.BASELINE_COURSE?JSON.parse(fs.readFileSync(process.env.BASELINE_COURSE)):null;
for(const [li,l] of course.lectures.entries()){
 const map=JSON.parse(fs.readFileSync(`materials/webinar-${l.number}-alignment.json`)),teacher=fs.readFileSync(`materials/webinar-${l.number}-teacher.md`,'utf8'),presenter=fs.readFileSync(`materials/webinar-${l.number}-script.md`,'utf8');
 assert.equal(map.sourceSha256,digest);assert.equal(map.sourceVersion,course.version);assert.deepEqual(map.slides.map(s=>s.slideId),l.slides.map(s=>s.id));
 for(const [i,s] of l.slides.entries()){
  if(baseline)for(const k of ['id','number','title','body','visual','learning','quiz','activity','notebook','kind','question'])assert.deepEqual(s[k],baseline.lectures[li].slides[i][k],`${s.id}: visible field ${k} changed`);
  assert.ok(teacher.includes(`<a id="${s.id}"></a>`));assert.ok(presenter.includes(`<a id="${s.id}"></a>`));assert.ok(teacher.includes(s.teacherText));assert.ok(presenter.includes(s.script));assert.equal(s.teacherText,s.script);
  assert.ok(!/Сопоставим записи в таблице\. В строке|Прочитаем последовательность на схеме|блок обозначен|согласованный промпт|На (первом|втором|третьем|четвёртом) лекции/.test(s.script),s.id);
  if(s.learning&&s.learning.kind!=='visual'){report.models++;assert.ok(s.script.split(/\s+/).length>=100,s.id+' lacks explanation');}
  if(s.quiz||s.activity){report.keys++;assert.ok(s.teacherAnswer);assert.ok(!s.script.includes('Правильный вариант:'));assert.ok(!s.script.includes('Обоснованный вывод:'));assert.ok(teacher.includes(s.teacherAnswer));assert.ok(presenter.includes(s.teacherAnswer));}
  report.slides++;
 }
 report.timing.push({lecture:l.number,narrationAndDemonstrationMinutes:Math.round(l.estimatedSeconds/60),discussionReserveMinutes:Math.round(l.discussionSeconds/60)});
}
assert.match(course.lectures[0].slides.find(s=>s.id==='З1-С25').script,/95/);assert.match(course.lectures[3].slides.find(s=>s.id==='З4-С38').script,/25/);assert.ok(!course.lectures[3].slides.find(s=>s.id==='З4-С38').script.includes('двадцать процентов'));
const b=await launchBrowser();try{
 const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>report.errors.push(e.message));const base=process.env.SITE_URL||'http://127.0.0.1:4177/';
 for(const l of course.lectures){
  for(const s of l.slides){if(process.env.TEACHER_SLIDES&&!process.env.TEACHER_SLIDES.split(',').includes(s.id))continue;await p.goto(`${base}?webinar=${l.number}&slide=${s.number}&mode=presenter`);await p.locator('.presenter-notes .script p').first().waitFor();assert.deepEqual(await p.locator('.presenter-notes .script p').allTextContents(),s.script.split('\n\n'));assert.equal(await p.locator('.presenter-notes h1').textContent(),s.title);
   if(s.teacherAnswer){assert.equal(await p.locator('.teacher-answer').getAttribute('open'),null);await p.locator('.teacher-answer summary').click();assert.deepEqual(await p.locator('.teacher-answer p').allTextContents(),s.teacherAnswer.split('\n\n'));}
   if(s.learning?.kind!=='visual'&&s.learning){await p.locator('.presenter-notes').screenshot({path:`${out}/${s.id}.png`});}
   report.presenter++;
  }console.log(`Presenter lecture ${l.number}: selected slide-aligned scripts verified`);
  await p.goto(pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href);await p.locator('#notes').click();
  for(const s of l.slides){if(process.env.TEACHER_SLIDES&&!process.env.TEACHER_SLIDES.split(',').includes(s.id))continue;await p.goto(pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href+'#slide='+s.number);const notes=p.locator('.offline-slide:not([hidden]) .offline-notes');await notes.waitFor();const paragraphs=await notes.locator(':scope > p').allTextContents();assert.deepEqual(paragraphs.slice(0,-1),s.script.split('\n\n'),s.id+' offline paragraphs');if(s.teacherAnswer)assert.equal(await notes.locator('.teacher-answer').count(),1);report.offline++;}
  console.log(`Offline lecture ${l.number}: selected scripts and paragraph breaks verified`);
 }
 const s=course.lectures[0].slides.find(s=>s.quiz);await p.goto(`${base}?webinar=1&slide=${s.number}&mode=audience`);await p.locator('.slide-frame').waitFor();assert.equal(await p.locator('.teacher-answer,.presenter-notes').count(),0);assert.equal(await p.locator('.quiz-solution').innerText(),'');
 assert.deepEqual(report.errors,[]);
}finally{await b.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
