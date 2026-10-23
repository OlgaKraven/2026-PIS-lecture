import fs from 'node:fs';
import {launchBrowser} from './browser-runtime.mjs';
const course=JSON.parse(fs.readFileSync('course.json')),base=process.env.SITE_URL||'http://127.0.0.1:4177/';
const out=process.env.REVIEW_OUTPUT||'output/full-review';fs.mkdirSync(out,{recursive:true});
const report={sourceVersion:course.version,slides:0,views:0,issues:[],errors:[],requests:[],screenshots:[],buttons:[],readability:[]};
const browser=await launchBrowser();
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(10000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.requests.push([r.status(),r.url()]);});
 function inspect(){
  const frame=document.querySelector('.slide-frame'),content=frame.querySelector('.slide-content'),footer=frame.querySelector('.slide-footer'),b=frame.getBoundingClientRect(),f=footer.getBoundingClientRect(),c=content.getBoundingClientRect(),issues=[];
  const inside=(el,r)=>{let p=el.parentElement;while(p&&p!==frame){const st=getComputedStyle(p),z=p.getBoundingClientRect();if(['auto','scroll'].includes(st.overflowX)&&p.scrollWidth>p.clientWidth+2&&r.left>=z.left-2&&r.top>=z.top-2&&r.bottom<=z.bottom+2)return true;p=p.parentElement;}return false;};
  const elements=[...frame.querySelectorAll('h2,h3,p,th,td,pre,li,.write-note,.title-profile,.reading-entry,.materials-resource,.practice-passport,.quiz,.answer-option,.quiz-solution,.slide-header-actions')];
  for(const el of elements){const st=getComputedStyle(el),r=el.getBoundingClientRect();if(!r.width||!r.height||st.visibility==='hidden'||st.display==='none')continue;
   const label=(el.className||el.tagName)+': '+el.textContent.trim().slice(0,65);
   if(r.left<b.left-2||r.right>b.right+2){if(!inside(el,r))issues.push({kind:'horizontal',label,left:Math.round(r.left-b.left),right:Math.round(r.right-b.right)});}
   if(r.top<b.top-2||r.bottom>b.bottom+2)issues.push({kind:'outside-frame',label,top:Math.round(r.top-b.top),bottom:Math.round(r.bottom-b.top),limit:Math.round(b.height)});
   if(content.contains(el)&&r.bottom>f.top+2)issues.push({kind:'footer-overlap',label,bottom:Math.round(r.bottom-b.top),limit:Math.round(f.top-b.top)});
   if(content.contains(el)&&r.top<c.top-2)issues.push({kind:'above-content',label});
   if(['hidden','clip'].includes(st.overflowY)&&el.scrollHeight>el.clientHeight+2)issues.push({kind:'internal-crop',label,scroll:el.scrollHeight,client:el.clientHeight});
  }
  const buttons=[...document.querySelectorAll('.deck-toolbar button,.deck-controls button,.slide-frame button,.slide-frame a')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>({name:el.getAttribute('aria-label')||el.textContent.trim(),disabled:el.disabled||false}));
  if(document.documentElement.scrollWidth>innerWidth+2)issues.push({kind:'page-horizontal',scroll:document.documentElement.scrollWidth,viewport:innerWidth});
  const fonts=[...content.querySelectorAll('h2,.slide-body,.visual-table td,.bibliography p,.quiz-prompt,.answer-option,.process-item p,svg text')].filter(el=>el.getBoundingClientRect().height).map(el=>({type:el.tagName,px:Math.round(parseFloat(getComputedStyle(el).fontSize)*10)/10,text:el.textContent.slice(0,45)}));
  return {issues,buttons,fonts,minFont:fonts.length?Math.min(...fonts.map(x=>x.px)):0};
 }
 for(const viewport of [{name:'desktop',width:1280,height:800,themes:['light','dark']},{name:'low',width:1024,height:600,themes:['light']},{name:'mobile',width:390,height:844,themes:['light']},{name:'narrow',width:320,height:844,themes:['light']}].filter(v=>!process.env.REVIEW_VIEWS||process.env.REVIEW_VIEWS.split(',').includes(v.name))){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  for(const theme of viewport.themes){
   await page.goto(base);await page.locator('.ok-page').waitFor();await page.evaluate(t=>localStorage.setItem('pis-theme',t),theme);
   for(const l of course.lectures){
    for(const s of l.slides){if(process.env.REVIEW_SLIDES&&!process.env.REVIEW_SLIDES.split(',').includes(s.id))continue;if(process.env.REVIEW_PAIRS==='1'&&s.visual.type!=='pair')continue;
     await page.goto(`${base}?webinar=${l.number}&slide=${s.number}&mode=deck`);await page.locator('.slide-frame').waitFor();await page.evaluate(()=>document.fonts.ready);
     const result=await page.evaluate(inspect);report.views++;for(const issue of result.issues)report.issues.push({lecture:l.number,slide:s.number,id:s.id,view:viewport.name,theme,...issue});
     if(viewport.name==='desktop'){
      report.readability.push({lecture:l.number,slide:s.number,theme,minFont:result.minFont,small:result.fonts.filter(x=>x.px<14)});
      const file=`${out}/${theme}-${l.number}-${String(s.number).padStart(2,'0')}.png`;await page.locator('.slide-frame').screenshot({path:file,animations:'disabled'});report.screenshots.push(file);
      if(theme==='light'){report.slides++;report.buttons.push({lecture:l.number,slide:s.number,buttons:result.buttons});}
     }
     if(s.quiz){await page.locator('.quiz input').nth(s.quiz.answer).check();await page.locator('[data-check-answer]').click();await page.locator('[data-reveal-answer]').click();const expanded=await page.evaluate(inspect);for(const issue of expanded.issues)report.issues.push({lecture:l.number,slide:s.number,id:s.id,view:viewport.name,theme,state:'answer-shown',...issue});}
     if(result.issues.length)await page.screenshot({path:`${out}/issue-${viewport.name}-${theme}-${l.number}-${s.number}.png`,fullPage:true});
    }
    console.log(`${viewport.name}/${theme}: lecture ${l.number}, ${l.slides.length} slides inspected`);
   }
  }
 }
 console.log(JSON.stringify({slides:report.slides,views:report.views,issues:report.issues.length,errors:report.errors,requests:report.requests}));
if(report.issues.length||report.errors?.length||report.requests?.length)process.exitCode=1;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
