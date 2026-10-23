import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';import {launchBrowser} from './browser-runtime.mjs';
const c=JSON.parse(fs.readFileSync('course.json')),base=process.env.SITE_URL||'http://127.0.0.1:4177/',out=process.env.COMPOSITION_OUTPUT||'output/composition-review';fs.mkdirSync(out,{recursive:true});
const report={views:0,issues:[],gaps:[]},b=await launchBrowser();
function inspect(){const frame=[...document.querySelectorAll('.active-slide .slide-frame')].find(el=>el.getBoundingClientRect().width>0),issues=[];if(!frame)return {issues,gap:null};const visual=frame.querySelector('.slide-visual'),child=visual?.firstElementChild,previous=visual?.previousElementSibling;let gap=null;
 if(!frame.matches('.kind-title,.kind-section')&&child&&previous){const f=frame.getBoundingClientRect(),r=child.getBoundingClientRect(),p=previous.getBoundingClientRect();if(r.height&&p.height){gap=(r.top-p.bottom)/f.width*100;if(gap>3.5)issues.push({kind:'detached-content',gapCqw:+gap.toFixed(2)});}}
 for(const pair of frame.querySelectorAll('.visual-pair')){const tops=[...pair.querySelectorAll(':scope>section')].map(s=>s.querySelector(':scope>:not(h3)')?.getBoundingClientRect().top).filter(Number.isFinite);if(tops.length>1&&innerWidth>820&&Math.max(...tops)-Math.min(...tops)>2)issues.push({kind:'column-starts',difference:Math.round(Math.max(...tops)-Math.min(...tops))});}
 return {issues,gap};}
try{const p=await b.newPage({viewport:{width:1280,height:800}});for(const l of c.lectures){
 for(const offline of [false,true])for(const s of l.slides){await p.goto(offline?pathToFileURL(path.resolve(`materials/webinar-${l.number}.html`)).href+'#slide='+s.number:`${base}?webinar=${l.number}&slide=${s.number}&mode=deck`);await p.locator('.active-slide .slide-frame:visible').waitFor();await p.evaluate(()=>document.fonts.ready);
 const data=await p.evaluate(inspect);report.views++;if(data.gap!==null)report.gaps.push({lecture:l.number,id:s.id,offline,gapCqw:+data.gap.toFixed(2)});report.issues.push(...data.issues.map(issue=>({lecture:l.number,id:s.id,offline,...issue})));}
 console.log('Composition lecture',l.number,report.views);
}
if(!process.env.COMPOSITION_BASELINE)assert.deepEqual(report.issues,[]);console.log({views:report.views,issues:report.issues.length,maxGap:Math.max(...report.gaps.map(x=>x.gapCqw))});
}finally{await b.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
