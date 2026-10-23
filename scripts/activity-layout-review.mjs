import fs from 'node:fs';
import {launchBrowser} from './browser-runtime.mjs';
const c=JSON.parse(fs.readFileSync('course.json')),base=process.env.SITE_URL||'http://127.0.0.1:4177/',report={views:0,issues:[]};
const b=await launchBrowser();fs.mkdirSync('output/full-review',{recursive:true});
try{const p=await b.newPage();
for(const width of [1280,390,320]){
 await p.setViewportSize({width,height:844});
 for(const theme of ['light','dark'])for(const l of c.lectures)for(const s of l.slides.filter(x=>x.activity)){
  await p.goto(`${base}?webinar=${l.number}&slide=${s.number}&mode=activity`);await p.locator('.activity-page').waitFor();await p.locator('[data-step-go="0"]').click();await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await p.locator('[data-team]').fill('Команда проверяющих');await p.locator('[data-prediction]').fill('Прогноз');
  for(let i=0;i<s.activity.steps.length;i++){
   for(let j=0;j<s.activity.steps[i].fields.length;j++)await p.locator(`[data-team-field="${j}"]`).fill(s.activity.steps[i].fields[j].answers[0]);
   await p.locator('[data-step-reason]').fill('Проверяем правило и контрпример');await p.locator('[data-check-step]').click();await p.locator('[data-step-key]').click();
   const issues=await p.evaluate(()=>{const out=[];for(const el of document.querySelectorAll('.activity-page h1,.activity-page h2,.activity-page p,.activity-page label,.activity-page button,.activity-page a,.activity-page input')){const r=el.getBoundingClientRect();if(r.width&&r.height&&(r.left<0||r.right>innerWidth+1))out.push({text:el.textContent.slice(0,70),left:r.left,right:r.right});}if(document.documentElement.scrollWidth>innerWidth+1)out.push({pageScroll:document.documentElement.scrollWidth});return out;});
   report.issues.push(...issues.map(issue=>({lecture:l.number,id:s.id,step:i+1,width,theme,...issue})));report.views++;
   if(l.number===4&&s.question===5&&i===1)await p.screenshot({path:`output/full-review/team-${width}-${theme}.png`,fullPage:true});
   await p.locator('[data-team-next]').click();
  }
  await p.locator('[data-activity-solution]').click();
 }
 console.log('Activity layouts',width,report.views);
}
if(report.issues.length)process.exitCode=1;console.log({views:report.views,issues:report.issues.length});
}finally{fs.writeFileSync('output/full-review/activities.json',JSON.stringify(report,null,2));await b.close();}
