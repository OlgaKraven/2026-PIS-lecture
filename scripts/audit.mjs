import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {launchBrowser} from './browser-runtime.mjs';
const base=process.env.SITE_URL||'http://127.0.0.1:4176/';
const browser=await launchBrowser();
const report={overflow:[],errors:[],checks:[]};
fs.mkdirSync('output/playwright',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.getByRole('heading',{name:'Проектирование информационных ресурсов',exact:true}).waitFor();
 assert.equal(await page.locator('.topic-card').count(),4);
 for(const a of await page.locator('.topic-card a[download]').all()){
   const href=await a.getAttribute('href');const r=await page.request.get(new URL(href,base).href);assert.equal(r.status(),200,href);
 }
 const downloadPromise=page.waitForEvent('download');await page.locator('.topic-card').first().getByRole('link',{name:'Сохранить PDF'}).click();
 const download=await downloadPromise;assert.equal(download.suggestedFilename(),'webinar-1.pdf');assert.equal(await download.failure(),null);
 await page.getByRole('button',{name:'Настройка перед занятием',exact:true}).click();
 await page.getByLabel('ФИО преподавателя').fill('Проверка профиля');await page.getByLabel('Должность',{exact:true}).fill('Преподаватель');await page.getByRole('button',{name:'Сохранить настройки'}).click();
 assert.equal(await page.locator('.teacher-summary strong').textContent(),'Проверка профиля');
 await page.reload();await page.locator('.teacher-summary strong').waitFor();assert.equal(await page.locator('.teacher-summary strong').textContent(),'Проверка профиля');
 await page.getByRole('searchbox',{name:'Поиск по всему курсу'}).fill('транзакция');assert.ok(await page.locator('.topic-card:visible').count()>0);
 await page.getByRole('searchbox',{name:'Поиск по всему курсу'}).fill('несуществующийтекст123');assert.equal(await page.locator('.topic-card:visible').count(),0);
 await page.getByRole('searchbox',{name:'Поиск по всему курсу'}).fill('');
 await page.getByRole('button',{name:'2',exact:true}).click();assert.equal(await page.locator('.topic-card:visible').count(),1);
 report.checks.push('Каталог, все скачивания, готовый PDF, поиск, фильтры и сохранение профиля');
 await page.evaluate(()=>localStorage.clear());await page.goto(base);await page.locator('.hero-mascot img').waitFor();
 await page.screenshot({path:'output/playwright/catalog-final.png',fullPage:true});
 for(let n=1;n<=4;n++){
  await page.goto(`${base}?webinar=${n}&mode=print`);await page.waitForSelector('.print-slide:nth-of-type(60)');await page.evaluate(()=>document.fonts.ready);
  const issues=await page.evaluate(()=>[...document.querySelectorAll('.slide-frame')].flatMap((frame,i)=>{
   const bounds=frame.getBoundingClientRect();const content=frame.querySelector('.slide-content');
   const elements=[...frame.querySelectorAll('h2,.slide-body,.visual-table,.visual-code pre,.process-item,.mockup,.question-list,.agenda-list,.title-profile')];
   return elements.flatMap(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.bottom>bounds.bottom-5||r.top<bounds.top||r.right>bounds.right+1||r.left<bounds.left-1)?[{slide:i+1,element:el.className||el.tagName,text:el.textContent.slice(0,70)}]:[];});
  }));report.overflow.push(...issues.map(x=>({webinar:n,...x})));
  for(let s=0;s<60;s++)await page.locator('.slide-frame').nth(s).screenshot({path:`output/playwright/w${n}-${String(s+1).padStart(2,'0')}.png`});
 }
 await page.goto(`${base}?webinar=1&slide=3&mode=deck`);await page.locator('.kind-section').waitFor();await page.screenshot({path:'output/playwright/divider-final.png'});
 await page.keyboard.press('ArrowRight');await page.waitForURL('**slide=4**');
 await page.getByRole('button',{name:'Счётчик и содержание'}).click();await page.locator('[data-slide="59"]').click();await page.locator('.kind-questions').waitFor();
 await page.screenshot({path:'output/playwright/questions-final.png'});
 await page.getByRole('button',{name:'Инструменты',exact:true}).click();await page.getByRole('link',{name:'Показать сценарий',exact:true}).click();await page.locator('.presenter-notes').waitFor();
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Открыть окно аудитории'}).click();const audience=await popupPromise;await audience.locator('.kind-questions').waitFor();
 await page.keyboard.press('ArrowLeft');await audience.waitForURL('**slide=59**');
 assert.equal(await audience.locator('.presenter-notes').count(),0);
 await page.screenshot({path:'output/playwright/presenter-final.png'});await audience.close();
 report.checks.push('Клавиатура, содержание, сценарий и синхронизация с отдельным окном аудитории');
 await page.setViewportSize({width:390,height:844});await page.goto(base);await page.locator('.topic-grid').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/playwright/mobile-final.png',fullPage:true});
 await page.goto(`${base}?webinar=1&slide=2&mode=deck`);await page.locator('.agenda-list').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'output/playwright/mobile-deck.png'});
 await page.setViewportSize({width:1280,height:800});
 for(let n=1;n<=4;n++){
  await page.goto(pathToFileURL(path.resolve(`materials/webinar-${n}.html`)).href);await page.locator('.offline-slide:not([hidden]) .kind-title').waitFor();
  await page.getByRole('button',{name:'Следующий слайд'}).click();await page.locator('.offline-slide:not([hidden]) .agenda-list').waitFor();
  await page.getByRole('button',{name:'Показать сценарий',exact:true}).click();assert.ok(await page.locator('.offline-slide:not([hidden]) .offline-notes').isVisible());
  await page.keyboard.press('End');await page.locator('.offline-slide:not([hidden]) .kind-questions').waitFor();
 }
 report.checks.push('Мобильные страницы и все четыре HTML без сетевой загрузки');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.overflow,[]);
 console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync('output/playwright/audit.json',JSON.stringify(report,null,2));await browser.close();}
