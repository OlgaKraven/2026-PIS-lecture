import fs from 'node:fs';

export function writeOffline(course) {
  const app=fs.readFileSync('app.js','utf8');
  const renderer=app.slice(app.indexOf('function process('),app.indexOf('function controls('));
  const escapeLine=app.split('\n').find(line=>line.startsWith('const e='));
  const mime={woff2:'font/woff2',webp:'image/webp',png:'image/png'};
  const embed=source=>source.replace(/assets\/[\w.-]+/g,file=>{
    const ext=file.split('.').at(-1);return `data:${mime[ext]};base64,${fs.readFileSync(file).toString('base64')}`;
  });
  const css=embed(fs.readFileSync('style.css','utf8'));
  for(const lecture of course.lectures){
    const data=JSON.stringify(lecture).replace(/</g,'\\u003c');
    const script=`${escapeLine}\nconst course={discipline:${JSON.stringify(course.discipline)}};const profile={};\n${embed(renderer)}\nconst l=${data};
const root=document.querySelector('#offline-slides');root.innerHTML=l.slides.map(s=>'<section class="offline-slide" hidden>'+slide(s,l)+'<div class="offline-notes"><h2>'+e(s.id)+'. '+e(s.title)+'</h2>'+s.script.split('\\n\\n').filter(Boolean).map(p=>'<p>'+e(p)+'</p>').join('')+'<h3>Указания ведущему</h3><p>'+e(s.hint)+'</p></div></section>').join('');
let current=0;const pages=[...root.children];function show(n){current=Math.min(59,Math.max(0,n));pages.forEach((p,i)=>p.hidden=i!==current);document.querySelector('#counter').textContent=(current+1)+' / 60';document.querySelector('#prev').disabled=!current;document.querySelector('#next').disabled=current===59;location.hash='slide='+String(current+1);}
document.querySelector('#prev').onclick=()=>show(current-1);document.querySelector('#next').onclick=()=>show(current+1);document.querySelector('#pdf').onclick=()=>window.print();document.querySelector('#notes').onclick=()=>{document.body.classList.toggle('with-notes');document.querySelector('#notes').textContent=document.body.classList.contains('with-notes')?'Скрыть сценарий':'Показать сценарий';};document.querySelector('#full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();document.addEventListener('keydown',ev=>{if(['ArrowRight','PageDown','ArrowLeft','PageUp','Home','End'].includes(ev.key)){ev.preventDefault();show(ev.key==='Home'?0:ev.key==='End'?59:current+(['ArrowRight','PageDown'].includes(ev.key)?1:-1));}});show(Number(new URLSearchParams(location.hash.slice(1)).get('slide')||1)-1);`;
    const title=lecture.title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    fs.writeFileSync(`materials/webinar-${lecture.number}.html`,`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
body{background:#f0f0f3}.offline-toolbar{padding:.8rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.offline-toolbar strong{flex:1}.offline-slide{padding:1rem}.offline-slide[hidden]{display:none}.offline-slide .active-slide{margin:auto}.offline-controls{display:flex;gap:1rem;justify-content:space-between;align-items:center;padding:1rem}.offline-notes{display:none;background:#fff;max-width:70ch;margin:2rem auto;padding:1.5rem;line-height:1.7}.with-notes .offline-notes{display:block}.with-notes .active-slide{width:min(100%,900px)}@media print{.offline-toolbar,.offline-controls{display:none!important}.offline-slide,.offline-slide[hidden]{display:block!important;padding:0;break-after:page}.offline-slide:last-child{break-after:auto}.offline-slide .active-slide{width:281mm;height:158.0625mm;aspect-ratio:16/9}.offline-notes{display:none!important}.with-notes .offline-notes{display:block!important;break-before:page}.offline-slide{break-inside:avoid}}
</style></head><body><header class="offline-toolbar"><strong>Вебинар ${lecture.number}</strong><button class="button" id="notes">Показать сценарий</button><button class="button" id="pdf">Сохранить PDF</button><button class="button" id="full">Полный экран</button></header><main id="offline-slides"></main><nav class="offline-controls" aria-label="Навигация"><button class="button" id="prev" aria-label="Предыдущий слайд">←</button><span id="counter" role="status"></span><button class="button primary" id="next" aria-label="Следующий слайд">→</button></nav><script>${script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
  }
}
