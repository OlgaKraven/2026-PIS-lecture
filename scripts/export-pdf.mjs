import fs from 'node:fs';
import {launchBrowser} from './browser-runtime.mjs';
const browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const base=process.env.SITE_URL||'http://127.0.0.1:4176/';
 for(let n=1;n<=4;n++){
  await page.goto(`${base}?webinar=${n}&mode=print`);
  await page.waitForSelector('.print-slide:last-of-type');
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  await page.emulateMedia({media:'print'});
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(100);
  await page.pdf({path:`materials/webinar-${n}.pdf`,printBackground:true,preferCSSPageSize:true});
  fs.mkdirSync('output/pdf',{recursive:true});
  fs.copyFileSync(`materials/webinar-${n}.pdf`,`output/pdf/webinar-${n}.pdf`);
  console.log(`PDF вебинара ${n} сформирован.`);
 }
}finally{await browser.close();}
