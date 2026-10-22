import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchBrowser} from './browser-runtime.mjs';
const browser=await launchBrowser(),out='output/profile-review';fs.mkdirSync(out,{recursive:true});
const name='Александра Константиновна Преображенская',position='Преподаватель профессиональных дисциплин',department='Кафедра информационных технологий и программирования';
const errors=[];
try{
 for(let n=1;n<=4;n++){
  const context=await browser.newContext({acceptDownloads:true}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.resolve(`materials/webinar-${n}.html`)).href);
  await p.locator('#tools').click();await p.locator('[name=fullName]').fill(name);await p.locator('[name=position]').fill(position);await p.locator('[name=department]').fill(department);await p.getByRole('button',{name:'Готово',exact:true}).click();
  assert.equal(await p.locator('.title-profile strong').textContent(),name);await p.reload();assert.equal(await p.locator('.title-profile strong').textContent(),name);
  await p.locator('#tools').click();await p.locator('[name=fullName]').fill('Отменённое изменение');await p.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await p.locator('.title-profile strong').textContent(),name);
  await p.locator('#tools').click();const download=p.waitForEvent('download');await p.getByRole('button',{name:'Скачать копию с моими данными'}).click();const file=path.resolve(out,`lecture-${n}.html`);await(await download).saveAs(file);
  const fresh=await browser.newContext();const copy=await fresh.newPage();copy.on('pageerror',e=>errors.push(e.message));await copy.goto(pathToFileURL(file).href);assert.equal(await copy.locator('.title-profile strong').textContent(),name);assert.equal(await copy.locator('.title-profile span').first().textContent(),position);
  await copy.emulateMedia({media:'print'});assert.equal(await copy.locator('.title-profile strong').isVisible(),true);
  await copy.emulateMedia({media:'screen'});await copy.setViewportSize({width:390,height:844});await copy.locator('#tools').click();assert.ok(await copy.locator('dialog').evaluate(d=>d.getBoundingClientRect().right<=innerWidth));await copy.keyboard.press('Escape');
  await fresh.close();await context.close();
 }
 const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};});const local=await blocked.newPage();await local.goto(pathToFileURL(path.resolve('materials/webinar-1.html')).href);await local.locator('#tools').click();await local.locator('[name=fullName]').fill(name);await local.getByRole('button',{name:'Готово',exact:true}).click();assert.match(await local.locator('dialog [role=status]').textContent(),/Скачайте копию/);assert.equal(await local.locator('.title-profile strong').textContent(),name);await blocked.close();
 const context=await browser.newContext();await context.addInitScript(()=>window.print=()=>{window.printCalls=(window.printCalls||0)+1;});const p=await context.newPage();await p.goto('http://127.0.0.1:4177/');await p.locator('.ok-teacher summary').click();await p.locator('[name=fullName]').fill(name);
 for(const a of await p.locator('[data-pdf-lecture]').all()){assert.match(await a.getAttribute('href'),/mode=print/);assert.equal(await a.getAttribute('download'),null);}
 const popup=p.waitForEvent('popup');await p.locator('.ok-export-actions a').first().click();const print=await popup;await print.locator('.title-profile strong').waitFor();assert.equal(await print.locator('.title-profile strong').textContent(),name);await print.close();
 await p.locator('[name=fullName]').fill('');for(const a of await p.locator('[data-pdf-lecture]').all()){assert.match(await a.getAttribute('href'),/export=pdf/);assert.equal(await a.getAttribute('download'),null);}
 await context.close();assert.deepEqual(errors,[]);console.log('All 4 offline decks: edit, cancel, reload, portable personalized copy, print, mobile dialog. Catalog PDF links follow the presenter profile. No browser errors.');
}finally{await browser.close();}
