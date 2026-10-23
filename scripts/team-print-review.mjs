import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {launchBrowser} from './browser-runtime.mjs';
const c=JSON.parse(fs.readFileSync('course.json')),base=process.env.SITE_URL||'http://127.0.0.1:4177/';
const report={worksheets:0,offline:0,issues:[]};
const b=await launchBrowser();try{const p=await b.newPage({viewport:{width:1280,height:800}});await p.emulateMedia({media:'print'});
for(const l of c.lectures){
 for(const offline of [false,true]){
  await p.goto(offline?pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href:`${base}?webinar=${l.number}&mode=print`);await p.locator('.practice-worksheet').last().waitFor({state:'attached'});await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('.practice-worksheet').count(),8);
  const issues=await p.locator('.practice-worksheet').evaluateAll(sheets=>sheets.flatMap(sheet=>{const footer=sheet.querySelector('.slide-footer').getBoundingClientRect(),frame=sheet.querySelector('.slide-frame').getBoundingClientRect();return [...sheet.querySelectorAll('h2,h3,p')].flatMap(el=>{const r=el.getBoundingClientRect();return r.bottom>footer.top+1||r.left<frame.left||r.right>frame.right?[{id:sheet.querySelector('article').dataset.slideId,text:el.textContent.slice(0,60),bottom:r.bottom,limit:footer.top}]:[];});}));
  report.issues.push(...issues.map(x=>({...x,lecture:l.number,offline})));report[offline?'offline':'worksheets']+=8;
  if(!offline)await p.locator('.practice-worksheet').first().screenshot({path:`output/practice-review/worksheet-${l.number}.png`});
 }
}
assert.deepEqual(report.issues,[]);console.log(report);
}finally{await b.close();fs.writeFileSync('output/practice-review/print-report.json',JSON.stringify(report,null,2));}
