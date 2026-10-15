import assert from 'node:assert/strict';
import fs from 'node:fs';
const course=JSON.parse(fs.readFileSync('course.json','utf8'));
assert.equal(course.discipline,'Проектирование информационных ресурсов');
assert.equal(course.specialty,'09.02.09 «Веб-разработчик»');
assert.equal(course.lectures.length,4);
const ids=new Set();
for(const l of course.lectures){
  assert.equal(l.slides.length,60,`Вебинар ${l.number}: количество слайдов`);
  assert.equal(l.totalSeconds,7200);
  assert.equal(l.slides[1].kind,'agenda');
  assert.equal(l.slides.filter(s=>s.kind==='section').length,l.blocks.length);
  assert.equal(l.slides[59].kind,'questions');
  assert.equal(l.slides[59].visual.items.length,3);
  assert.ok(l.estimatedSeconds>=6900&&l.estimatedSeconds<=7500,`Вебинар ${l.number}: расчёт ${l.estimatedSeconds/60} минут`);
  let elapsed=0;
  for(const s of l.slides){
    assert.ok(!ids.has(s.id));ids.add(s.id);
    assert.ok(s.title&&s.body&&s.script&&s.hint&&s.visualDescription);
    assert.equal(s.startSeconds,elapsed);elapsed+=s.plannedSeconds;
    assert.ok(s.wordCount>=40,`${s.id}: недостаточно речи`);
    assert.ok(s.requiredWpm>=65&&s.requiredWpm<=150,`${s.id}: темп ${s.requiredWpm}`);
    for(const url of s.sources)assert.equal(new URL(url).protocol,'https:');
  }
  assert.ok(fs.existsSync(`materials/webinar-${l.number}.html`));
  assert.ok(fs.existsSync(`materials/webinar-${l.number}-script.md`));
  const pdf=fs.readFileSync(`materials/webinar-${l.number}.pdf`);
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.ok(pdf.length>10000);
  const offline=fs.readFileSync(`materials/webinar-${l.number}.html`,'utf8');
  assert.ok(!offline.includes('src="assets/'));
  assert.ok(!offline.includes('url(assets/'));
  console.log(`Вебинар ${l.number}: 60 слайдов, ${l.totalWords} слов, план 120 мин, расчёт ${(l.estimatedSeconds/60).toFixed(1)} мин`);
}
console.log('Структура, сценарии, хронометраж и скачиваемые HTML проверены.');
