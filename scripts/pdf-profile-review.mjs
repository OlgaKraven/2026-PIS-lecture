import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {launchBrowser} from './browser-runtime.mjs';
const browser=await launchBrowser(),base=process.env.SITE_URL||'http://127.0.0.1:4177/',out='output/pdf-profile-review';fs.mkdirSync(out,{recursive:true});
const errors=[],name='Александра Константиновна Преображенская';
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(()=>{window.print=()=>window.printCalls=(window.printCalls||0)+1;});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('.ok-teacher summary').click();await p.locator('[name=fullName]').fill(name);await p.locator('[name=position]').fill('Преподаватель профессиональных дисциплин');await p.locator('[name=department]').fill('Кафедра информационных технологий и программирования');
 for(let i=0;i<4;i++){
  const popup=p.waitForEvent('popup');await p.locator('.ok-export-actions a').nth(i).click();const print=await popup;print.on('pageerror',e=>errors.push(e.message));await print.waitForFunction(()=>window.printCalls===1);assert.equal(await print.locator('.title-profile strong').textContent(),name);assert.equal(await print.locator('.print-slide:not(.diagram-continuation)').count(),80);assert.ok(!new URL(print.url()).searchParams.has('export'));
  await print.emulateMedia({media:'print'});const file=`${out}/lecture-${i+1}.pdf`;await print.pdf({path:file,printBackground:true,preferCSSPageSize:true});const text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});assert.ok(text.includes(name));assert.ok(text.includes('Кафедра информационных технологий'));assert.ok(text.includes('Материалы к занятиям'));console.log(`PDF ${i+1}: current profile and materials slide verified`);await print.close();
 }
 await p.locator('[name=fullName]').fill('');await p.locator('[name=position]').fill('');await p.locator('[name=department]').fill('');for(const a of await p.locator('[data-pdf-lecture]').all()){assert.match(await a.getAttribute('href'),/export=pdf/);assert.equal(await a.getAttribute('download'),null);}
 // Profile edits inside the settings dialog must be applied before clicking its PDF link.
 await p.goto(base+'?webinar=1&mode=deck');await p.locator('[data-tools]').click();await p.locator('[data-profile]').click();await p.locator('[name=fullName]').fill('Мария Александровна Иванова');const popup=p.waitForEvent('popup');await p.locator('[data-profile-pdf]').first().click();const print=await popup;await print.waitForFunction(()=>window.printCalls===1);assert.equal(await print.locator('.title-profile strong').textContent(),'Мария Александровна Иванова');
 // Export snapshot must survive browsers that block localStorage.
 const url=new URL(print.url());url.searchParams.set('export','pdf');await print.close();const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});window.print=()=>window.printCalls=(window.printCalls||0)+1;});const isolated=await blocked.newPage();await isolated.goto(url.href);await isolated.locator('.title-profile strong').waitFor();assert.equal(await isolated.locator('.title-profile strong').textContent(),'Мария Александровна Иванова');await blocked.close();await context.close();assert.deepEqual(errors,[]);console.log('All PDF buttons use fresh print output; settings and storage-blocked profile verified.');
}finally{await browser.close();}
