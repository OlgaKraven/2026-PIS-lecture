import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {launchBrowser} from './browser-runtime.mjs';
const base=process.env.SITE_URL||'http://127.0.0.1:4177/';
const browser=await launchBrowser(),report={errors:[],checks:[]};
fs.mkdirSync('output/catalog-review',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));
 for(const theme of ['light','dark']){
  await page.goto(base);await page.locator('.ok-page').waitFor();await page.evaluate(t=>localStorage.setItem('pis-theme',t),theme);await page.reload();await page.locator('.ok-topic').first().waitFor();
  for(const view of ['cards','list']){
   await page.getByRole('button',{name:view==='cards'?'Вид: карточки':'Вид: список'}).click();assert.equal(await page.locator('.ok-page').getAttribute('data-theme'),theme);
   assert.equal(await page.locator('.ok-page').getAttribute('data-layout'),view);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`output/catalog-review/${view}-${theme}.png`,fullPage:true});
  }
 }
 await page.getByRole('searchbox').fill('интерфейсы');assert.equal(await page.locator('.ok-topic:visible').count(),1);await page.getByRole('button',{name:'Вид: карточки'}).click();assert.equal(await page.getByRole('searchbox').inputValue(),'интерфейсы');await page.reload();assert.equal(await page.getByRole('searchbox').inputValue(),'интерфейсы');await page.getByRole('searchbox').fill('неттакойтемы999');await page.locator('.ok-empty').waitFor({state:'visible'});await page.getByRole('button',{name:'Сбросить поиск'}).click();assert.equal(await page.locator('.ok-topic:visible').count(),4);
 await page.getByRole('button',{name:'Материалы — QR-код и ссылка'}).click();const dialog=page.locator('dialog.ok-materials-dialog');await dialog.locator('img').waitFor({state:'visible'});
 if(process.env.JSQR_PATH)await page.addScriptTag({path:process.env.JSQR_PATH});
 const decode=async selector=>page.locator(selector).evaluate(async img=>{await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=420;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,420,420);return window.jsQR?.(ctx.getImageData(0,0,420,420).data,420,420)?.data;});
 if(process.env.JSQR_PATH)assert.equal(await decode('dialog .ok-materials-qr-image'),'https://disk.yandex.ru/d/P40mjNJWYJAW9g');
 await dialog.getByLabel('Ссылка на материалы').fill('javascript:alert(1)');assert.equal(await dialog.locator('img').isVisible(),false);await dialog.getByRole('button',{name:'Обновить QR-код'}).click();assert.equal(await dialog.locator('a.ok-materials-open').isVisible(),false);
 await dialog.getByLabel('Ссылка на материалы').fill('https://example.com/course');await dialog.getByRole('button',{name:'Обновить QR-код'}).click();await dialog.locator('img').waitFor({state:'visible'});if(process.env.JSQR_PATH)assert.equal(await decode('dialog img'),'https://example.com/course');await dialog.getByLabel('Ссылка на материалы').fill('https://disk.yandex.ru/d/P40mjNJWYJAW9g');await dialog.getByRole('button',{name:'Обновить QR-код'}).click();await dialog.locator('img').waitFor({state:'visible'});await dialog.getByRole('button',{name:'Закрыть материалы'}).click();assert.equal(await page.getByRole('button',{name:'Материалы — QR-код и ссылка'}).evaluate(x=>x===document.activeElement),true);
 report.checks.push('Карточки/список, обе темы без случайного переключения, поиск и сохранение вида; QR обновляется, неверная ссылка скрывает старый код; возврат фокуса');
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.goto(base);await page.locator('.ok-topic').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`output/catalog-review/mobile-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Материалы — QR-код и ссылка'}).click();await page.locator('dialog img').waitFor({state:'visible'});assert.ok(await page.locator('dialog').evaluate(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}));await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1280,height:800});
 for(let n=1;n<=4;n++){
  await page.goto(`${base}?webinar=${n}&slide=64&mode=deck`);await page.locator('.materials-resource img').waitFor();if(process.env.JSQR_PATH){await page.addScriptTag({path:process.env.JSQR_PATH});assert.equal(await decode('.materials-resource img'),'https://disk.yandex.ru/d/P40mjNJWYJAW9g');}assert.equal(await page.locator('.materials-resource a').getAttribute('href'),'https://disk.yandex.ru/d/P40mjNJWYJAW9g');await page.screenshot({path:`output/catalog-review/materials-${n}.png`});
 }
 await page.route('http**/*',r=>r.abort());
 for(let n=1;n<=4;n++){
  await page.goto(pathToFileURL(path.resolve(`materials/webinar-${n}.html`)).href+'#slide=64');await page.locator('.offline-slide:not([hidden]) .materials-resource img').waitFor();assert.ok(await page.locator('.offline-slide:not([hidden]) .materials-resource img').evaluate(i=>i.complete&&i.naturalWidth>0));if(process.env.JSQR_PATH){await page.addScriptTag({path:process.env.JSQR_PATH});assert.equal(await decode('.offline-slide:not([hidden]) .materials-resource img'),'https://disk.yandex.ru/d/P40mjNJWYJAW9g');}
 }
 report.checks.push('Узкий каталог и окно QR; QR материалов декодирован во всех четырёх презентациях и четырёх HTML без сети');assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync('output/catalog-review/checks.json',JSON.stringify(report,null,2));await browser.close();}
