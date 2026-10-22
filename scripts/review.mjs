import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {launchBrowser} from './browser-runtime.mjs';
const course=JSON.parse(fs.readFileSync('course.json','utf8')),base=process.env.SITE_URL||'http://127.0.0.1:4177/';
const report={errors:[],requests:[],overflow:[],checks:[],models:0,scenarios:0};
fs.mkdirSync('output/review',{recursive:true});
const browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.requests.push([r.status(),r.url()]);});
 for(const l of course.lectures){
  await page.goto(`${base}?webinar=${l.number}&mode=print`);await page.locator('.print-slide').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({media:'print'});await page.waitForTimeout(100);
  const issues=await page.evaluate(()=>[...document.querySelectorAll('.slide-frame')].flatMap(frame=>{
   const b=frame.getBoundingClientRect(),footer=frame.querySelector('.slide-footer').getBoundingClientRect();
   return [...frame.querySelectorAll('h2,.slide-body,.visual-table,.visual-code pre,.process-item,.mockup,.question-list,.agenda-list,.title-profile,.bibliography,.learning-scene,.learning-static-steps,.learning-result,.learning-note')].flatMap(el=>{
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return [];
    return r.top<b.top-2||r.bottom>footer.top+3||r.left<b.left-2||r.right>b.right+2?[{id:frame.dataset.slideId,element:el.className||el.tagName,top:Math.round(r.top-b.top),bottom:Math.round(r.bottom-b.top),limit:Math.round(footer.top-b.top),right:Math.round(r.right-b.right)}]:[];
   });
  }));report.overflow.push(...issues);
 }
 await page.emulateMedia({media:'screen'});
 // Test every actual branch, reversal and scenario reset rather than merely counting buttons.
 for(const l of course.lectures)for(const s of l.slides.filter(s=>s.learning)){
  await page.goto(`${base}?webinar=${l.number}&slide=${s.number}&mode=deck`);await page.getByRole('button',{name:'Развернуть схему'}).click();const d=page.locator('.diagram-dialog');
  report.models++;
  for(let sc=0;sc<s.learning.scenarios.length;sc++){
   if(s.learning.scenarios.length>1)await d.locator('select').selectOption(String(sc));
   assert.match(await d.locator('.learning-toolbar>span').innerText(),/^Шаг 0/);
   const frames=s.learning.scenarios[sc].frames;
   for(let i=1;i<frames.length;i++)await d.getByRole('button',{name:'Далее',exact:true}).click();
   assert.ok((await d.locator('.learning-caption').innerText()).includes(frames.at(-1).result));
   if(frames.length>1){await d.getByRole('button',{name:'Назад',exact:true}).click();assert.ok((await d.locator('.learning-caption').innerText()).includes(frames.at(-2).caption));}
   await d.getByRole('button',{name:'К обзору',exact:true}).click();report.scenarios++;
  }
  if(s.learning.id==='request'){
   const play=d.getByRole('button',{name:'Показать',exact:true});await play.click();await page.waitForTimeout(450);await d.getByRole('button',{name:'Пауза',exact:true}).click();await page.waitForTimeout(1900);assert.match(await d.locator('.learning-toolbar>span').innerText(),/^Шаг 0/);await d.getByRole('button',{name:'Показать',exact:true}).click();await page.waitForTimeout(1500);assert.match(await d.locator('.learning-toolbar>span').innerText(),/^Шаг 1/);await d.getByRole('button',{name:'Пауза',exact:true}).click();
  }
  await d.getByRole('button',{name:'К слайду',exact:true}).click();
 }
 // Actual data computations are independent of captions.
 const computations=await page.evaluate(()=>{const m=window.PISDiagrams;return {join:m.joinData({data:{applications:[[104,12,17,'pending'],[105,13,17,'pending'],[106,12,18,'accepted']],projects:[[17,'Клуб'],[18,'Архив']]}},0),empty:m.joinData({data:{applications:[[104,12,17,'pending']],projects:[[17,'Клуб']]}},1)};});
 assert.deepEqual(computations.join.result,[[104,'Клуб','pending'],[106,'Архив','accepted']]);assert.deepEqual(computations.empty.result,[]);
 report.checks.push('Все модели и сценарии, назад/далее, смена условий, пауза и продолжение, вычисление JOIN');
 // Persisted theme, presenter, audience privacy, slide and diagram synchronization.
 await page.goto(`${base}?webinar=1&slide=38&mode=presenter`);await page.locator('.presenter').waitFor();
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Открыть окно аудитории'}).click();const audience=await popup;await audience.locator('.slide-frame').waitFor();
 assert.equal(await audience.locator('.presenter-notes').count(),0);
 await page.getByRole('button',{name:'Ещё',exact:true}).click();await page.locator('[data-theme-choice]').selectOption('dark');await page.getByRole('button',{name:'Закрыть',exact:true}).click();await audience.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.getByRole('button',{name:'Развернуть схему'}).click();await audience.locator('.diagram-dialog').waitFor();await page.locator('.diagram-dialog').getByRole('button',{name:'Далее',exact:true}).click();await audience.waitForFunction(()=>document.querySelector('.learning-caption')?.textContent.includes('Пользователь и принадлежность'));
 await page.locator('.diagram-dialog').getByRole('button',{name:'К слайду',exact:true}).click();await audience.locator('.diagram-dialog').waitFor({state:'detached'});
 await page.getByRole('button',{name:'Следующий слайд'}).click();await audience.waitForURL('**slide=39**');
 await page.getByRole('button',{name:'Завершить показ'}).click();await audience.getByText('Показ завершён').waitFor();await page.getByRole('button',{name:'Следующий слайд'}).click();await page.waitForTimeout(100);assert.equal(await audience.locator('.slide-frame').count(),0);await audience.close();
 report.checks.push('Два окна: тема, слайд и шаг схемы синхронны; сценарий скрыт; завершение убирает слайд');
 await page.goto(`${base}?webinar=1&slide=4&mode=deck`);await page.locator('.bibliography').waitFor();
 assert.equal(await page.locator('.presentation-topic').innerText(),'Литература');assert.equal(await page.locator('.slide-body').count(),0);assert.equal(await page.getByRole('link',{name:'Открыть источник ↗'}).count(),2);assert.equal(await page.locator('[data-tools]').innerText(),'');
 await page.evaluate(()=>Promise.all([...document.querySelectorAll('.source-qr')].map(i=>i.decode())));
 if(process.env.JSQR_PATH){await page.addScriptTag({path:process.env.JSQR_PATH});
 const qrURLs=await page.evaluate(()=>[...document.querySelectorAll('.source-qr')].map(img=>{const c=document.createElement('canvas');c.width=c.height=400;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,400,400);const pixels=ctx.getImageData(0,0,400,400);return window.jsQR(pixels.data,400,400)?.data;}));
 assert.deepEqual(qrURLs,['https://www.iprbookshop.ru/133166.html','https://www.iprbookshop.ru/139755.html']);
 }
 report.checks.push('Литература: раздел, карточки, ссылки «Открыть источник», меню — три точки'+(process.env.JSQR_PATH?'; QR декодированы':''));
 // Both themes, narrow/low viewports, long profile fields, downloadable assets.
 for(const theme of ['light','dark']){
  await page.evaluate(t=>localStorage.setItem('pis-theme',t),theme);
  for(const [name,slide] of [['title',1],['literature',4],['question',6],['states',38],['dense',62]]){
   await page.goto(`${base}?webinar=1&slide=${slide}&mode=deck`);await page.locator('.slide-frame').waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`output/review/${name}-${theme}.png`});
  }
 }
 for(const width of [320,390,1024]){
  await page.setViewportSize({width,height:width===1024?600:844});
  for(const slide of [1,4,38]){
   await page.goto(`${base}?webinar=1&slide=${slide}&mode=deck`);await page.locator('.slide-frame').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Горизонтальная прокрутка ${width}, ${slide}`);
  }
  await page.screenshot({path:`output/review/mobile-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1280,height:800});await page.goto(base);await page.locator('.topic-card').first().waitFor();assert.equal(await page.locator('.topic-card').count(),4);assert.equal(await page.locator('.materials-link').getAttribute('href'),'https://disk.yandex.ru/d/P40mjNJWYJAW9g');
 for(const a of await page.locator('.topic-card a[download]').all()){const href=await a.getAttribute('href');assert.equal((await page.request.get(new URL(href,base).href)).status(),200);}
 await page.getByRole('button',{name:'Настройка перед занятием',exact:true}).click();await page.getByLabel('ФИО преподавателя').fill('Александра Константиновна Константинопольская');await page.getByLabel('Должность',{exact:true}).fill('Старший преподаватель информационных технологий');await page.getByLabel('Кафедра или лаборатория').fill('Кафедра проектирования информационных систем и ресурсов');await page.getByRole('button',{name:'Готово',exact:true}).click();await page.goto(`${base}?webinar=1&mode=deck`);await page.locator('.title-profile').waitFor();await page.screenshot({path:'output/review/long-profile.png'});
 report.checks.push('Светлая/тёмная темы; ширины 320,390,1024; длинные данные преподавателя; скачивания и новая ссылка');
 // Offline: all four files work with the network blocked.
 await page.route('http**/*',r=>r.abort());
 for(const l of course.lectures){
  await page.goto(pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href);await page.locator('.offline-slide:not([hidden])').waitFor();
  await page.keyboard.press('End');assert.equal(await page.locator('#counter').innerText(),`65 / 65`);
  const s=l.slides.find(s=>s.learning);await page.goto(pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href+'#slide='+s.number);await page.locator('.offline-slide:not([hidden]) [data-diagram]').click();await page.locator('.diagram-dialog [data-next]').click();await page.getByRole('button',{name:'К слайду',exact:true}).click();
 }
 report.checks.push('Четыре автономных HTML: слайды, литература и интерактивы без сети');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);assert.deepEqual(report.overflow,[]);
 console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync('output/review/browser.json',JSON.stringify(report,null,2));await browser.close();}
