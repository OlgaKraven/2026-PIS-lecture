/* Shared deterministic rendering for the site, offline HTML and printed diagrams. */
window.PISDiagrams=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const table=(cols,rows,cls='',active=[])=>`<table class="learning-table ${cls}"><thead><tr>${cols.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${active.includes(i)?'is-focus':''}">${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const wrap=(s,n=25)=>{const out=[];for(const word of String(s).split(' ')){if(!out.length||out.at(-1).length+word.length+1>n)out.push(word);else out[out.length-1]+=' '+word;}return out;};
 const text=(s,x,y,n=24,lineHeight=22)=>`<text x="${x}" y="${y}" text-anchor="middle">${wrap(s,n).map((line,i)=>`<tspan x="${x}" dy="${i?lineHeight:0}">${esc(line)}</tspan>`).join('')}</text>`;
 let serial=0;
 function graph(v,focus=[],compact=false){
  const uid='edge-'+(++serial),nodes=v.nodes,edges=v.edges.map(([a,b,l])=>[typeof a==='number'?a:nodes.indexOf(a),typeof b==='number'?b:nodes.indexOf(b),l]);
  // Each relation gets a complete connected row, avoiding ambiguous crossings.
  const row=compact?120:88,nodeHeight=compact?90:64,mid=compact?45:32;
  const h=Math.max(145,edges.length*row+22);
  const nodeLabel=(label,x,y)=>{const columns=compact?18:26,lineHeight=compact?32:22;const baseline=y+nodeHeight/2+(compact?10:6)-(wrap(label,columns).length-1)*lineHeight/2;return text(label,x,baseline,columns,lineHeight);};
  return `<div class="relation-graph"><svg viewBox="0 0 1000 ${h}" role="img" aria-label="${esc(v.caption||'Направленные подписанные связи')}"><defs><marker id="${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>${edges.map(([a,b,label],i)=>{const y=20+i*row,active=focus.includes('e'+i);return `<g class="${active?'is-focus':''}"><rect x="10" y="${y}" width="275" height="${nodeHeight}" rx="4" class="${focus.includes('n'+a)?'is-focus':''}"/>${nodeLabel(nodes[a],147,y)}<path d="M285 ${y+mid}H715" marker-end="url(#${uid})"/>${text(label,500,y+(compact?5:11),compact?28:36,compact?32:22)}<rect x="715" y="${y}" width="275" height="${nodeHeight}" rx="4" class="${focus.includes('n'+b)?'is-focus':''}"/>${nodeLabel(nodes[b],852,y)}</g>`;}).join('')}</svg>${v.caption?`<p class="learning-note">${esc(v.caption)}</p>`:''}</div>`;
 }
 function states(m,focus){const id='state-'+(++serial);return `<svg class="state-graph" viewBox="0 0 1000 300" role="img" aria-label="Состояния заявки: из pending в accepted или rejected"><defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>${m.data.edges.map(([a,b,l],i)=>`<g class="${focus.includes('e'+i)?'is-focus':''}"><path d="M310 150H450V${i?240:60}H680" marker-end="url(#${id})"/>${text(l,490,i?222:40,35)}</g>`).join('')}${m.data.nodes.map((n,i)=>{const x=i?680:20,y=i===1?25:i===2?205:115;return `<g class="${focus.includes('n'+i)?'is-focus':''}"><rect x="${x}" y="${y}" width="290" height="70" rx="12"/>${text(n,x+145,y+41,30)}</g>`;}).join('')}</svg>`;}
 function sequenceMessages(m,scenario){
 const winner=scenario.label.endsWith('Б')?'Б':'А',loser=winner==='А'?'Б':'А';
 const sets={
 race:[['А','База','Проверка А: пары нет','both'],['Б','База','Проверка Б: пары нет','both'],[winner,'База','INSERT пары (12,17)','insert'],['База',winner,'COMMIT; заявка 104','commit'],['База',loser,'UNIQUE → 409','conflict']],
 transaction:scenario.label==='Сначала подача'?[['Подача','База','SELECT ... FOR UPDATE','lock'],['Подача','База','is_open=true → INSERT','insert'],['База','Закрытие','COMMIT подачи; затем закрытие','commit']]:[['Закрытие','База','is_open=false; COMMIT','close'],['Подача','База','Блокировка; is_open=false','lock'],['База','Подача','409 PROJECT_CLOSED','reject']],
 request:[['Браузер','Сервер','POST: проект 17, мотивация','post'],['Сервер','Сервер','Пользователь 12; проверки','validate'],['Сервер','База','INSERT; COMMIT заявки 104','save'],['Сервер','Браузер','201: id=104, pending','response'],['Браузер','Сервер','GET: мои заявки → 104','read']],
 'lost-response':scenario.label==='Обрыв после COMMIT'?[['Браузер','Сервер','POST /api/applications','post'],['Сервер','База','INSERT; COMMIT 104','save'],['Сервер','Браузер','Ответ потерян ×','lost'],['Браузер','Сервер','GET → заявка 104','read']]:[['Браузер','Сервер','POST не доставлен ×','lost'],['Браузер','Сервер','Позднее: GET → []','read']],
 notification:scenario.label==='Канал подтвердил'?[['Приложение','База','INSERT; COMMIT 104','save'],['Приложение','Внешний канал','Уведомление: событие 104','send'],['Внешний канал','Приложение','Оговорённое подтверждение','ack']]:[['Приложение','База','INSERT; COMMIT 104','save'],['Приложение','Внешний канал','Отправка → таймаут','timeout'],['Приложение','Внешний канал','Уточнить исход; управляемый повтор','retry']]
 };return sets[m.id]||[];
 }
 function sequence(m,s,focus){
 const msgs=sequenceMessages(m,s),actors=m.data.actors,id='msg-'+(++serial),h=110+msgs.length*65;
 const actorIndex=name=>{if(name==='А'||name==='Б')return name==='А'?0:1;if(name==='А, Б')return 0;return Math.max(0,actors.indexOf(name));};
 return `<svg class="sequence-graph" viewBox="0 0 1000 ${h}" role="img" aria-label="${esc(m.title)}"><defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>${actors.map((a,i)=>{const x=130+i*370;return `<rect x="${x-115}" y="10" width="230" height="45"/>${text(a,x,39,26)}<path class="lifeline" d="M${x} 55V${h-5}"/>`;}).join('')}${msgs.map(([a,b,label,key],i)=>{const x=130+370*actorIndex(a),z=130+370*actorIndex(b),y=98+i*65,active=focus.includes(key),p=x===z?`M${x} ${y}h65v22h-65`:`M${x} ${y}H${z}`;return `<g class="${active?'is-focus':''}">${text(`${i+1}. ${label}`,x===z?x+125:(x+z)/2,y-10,48)}<path d="${p}" marker-end="url(#${id})" ${/Ответ|201|409|подтверждение|COMMIT;/.test(label)?'stroke-dasharray="6 4"':''}/></g>`;}).join('')}</svg>`;
 }
 function joinData(m,sc){const student=sc===1?99:12;const joined=m.data.applications.flatMap(a=>m.data.projects.filter(p=>p[0]===a[2]).map(p=>[a[0],a[1],p[1],a[3]]));return {joined,result:joined.filter(r=>r[1]===student).sort((a,b)=>a[0]-b[0]).map(r=>[r[0],r[2],r[3]])};}
 function ranking(m,sc){const tags=sc===1?['робототехника']:['интерфейсы','клуб'];return m.data.projects.map(p=>({...p,score:p.tags.filter(t=>tags.includes(t)).length})).sort((a,b)=>b.score-a.score||a.id-b.id);}
 function scene(m,sc=0,index=0,complete=false){
 const s=m.scenarios[sc],f=s.frames[index],focus=complete?s.frames.flatMap(x=>x.focus):f.focus;
 if(m.kind==='visual')return window.PISVisual(m.data.visual,focus);
 if(m.kind==='graph')return graph(m.data,focus);
 if(m.kind==='states')return states(m,focus);
 if(m.kind==='sequence')return sequence(m,s,focus);
 if(m.kind==='cards')return `<ol class="learning-cards">${m.data.items.map((x,i)=>`<li class="${focus.includes(String(i))?'is-focus':''}"><span>${i+1}</span><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></li>`).join('')}</ol>`;
 if(m.kind==='er')return `<div class="entity-grid">${m.data.entities.map(x=>`<section><h3>${esc(x.name)}</h3>${x.fields.map(f=>`<p class="${f.startsWith('UNIQUE')&&focus.includes('unique')?'is-focus':''}">${esc(f)}</p>`).join('')}</section>`).join('')}</div><div class="er-relations">${m.data.relations.map(([a,b,one,many,label],i)=>`<p class="${focus.includes('r'+i)?'is-focus':''}"><b>${esc(a)}</b> <span class="er-line">${one} ───── ${many}</span> <b>${esc(b)}</b><small>${esc(label)}</small></p>`).join('')}</div>`;
 if(m.kind==='join'){const data=joinData(m,sc),show=complete||index>0;return `<pre>${esc(m.data.sql.replace('$1',sc===1?'99':'12'))}</pre><div class="learning-tables">${table(['a.id','student_id','project_id','status'],m.data.applications)}${table(['p.id','title'],m.data.projects)}</div>${show?table(index===1?['a.id','student_id','p.title','status']:['id','title','status'],index===1?data.joined:data.result,'is-result is-focus'):'<p class="learning-pending">Результат ещё не вычислен.</p>'}`;}
 if(m.kind==='validation')return table(['n после trim','n ≥ 50','n ≤ 1000','Результат правила'],m.data.lengths.map(n=>[n,n>=50?'да':'нет',n<=1000?'да':'нет',complete||index>0?(n>=50&&n<=1000?'допустимо':'отказ'):'—']),'',focus.includes('low')?[0,1,2]:focus.includes('high')?[3,4,5]:[]);
 if(m.kind==='funnel')return `<div class="learning-funnel">${m.data.items.map(([name,n],i)=>`<div class="${focus.includes(String(i))?'is-focus':''}"><b>${esc(name)}</b><span class="funnel-track"><span style="width:${n}%"></span></span><strong>${n} чел.</strong><small>${i?`${n}/${m.data.items[i-1][1]} = ${(n/m.data.items[i-1][1]*100).toFixed(1).replace('.',',')} % предыдущего этапа`:'База: 100 человек'}</small></div>`).join('')}</div><p>Весь путь: 25/100 = <strong>25 %</strong>.</p>`;
 if(m.kind==='ranking'){const rows=ranking(m,sc);return table(['Проект','Теги каталога',index||complete?'Совпадения':'Оценка'],rows.map(p=>[`${p.id} · ${p.title}`,p.tags.join(', '),index||complete?p.score:'—']),'',focus.length?rows.map((_,i)=>i):[])+(index>=3||complete?`<p class="learning-result">Выдача: ${rows.filter(p=>p.score>0).map(p=>p.id+' · '+esc(p.title)).join('; ')||'нет положительных совпадений'}</p>`:'');}
 return '';
 }
 function render(m,{scenario=0,index=0,staticMode=false,overview=false}={}){
 const s=m.scenarios[scenario],f=s.frames[index];
 return `<section class="learning" data-learning="${esc(m.id)}" aria-label="${esc(m.title)}">${!overview?`<p class="learning-input">${esc(s.input)}</p>`:''}<div class="learning-scene">${scene(m,scenario,index,staticMode)}</div>${staticMode?`<div class="learning-static-steps">${s.frames.slice(1).filter(x=>x.caption).map(x=>`<p>${esc(x.caption)}</p>`).join('')}</div><p class="learning-result">${esc(s.frames.at(-1).result)}</p>`:overview||!f.caption&&!f.result?'':`<p class="learning-caption" role="status" aria-live="polite">${esc(f.caption)}${f.result?`<strong>${esc(f.result)}</strong>`:''}</p>`}${m.data.note?`<p class="learning-note">${esc(m.data.note)}</p>`:''}</section>`;
 }
 function bind(container,m,change){
 let sc=0,index=0,running=false,timer=null,deadline=0,remaining=1800,disposed=false;
 const clear=()=>{clearTimeout(timer);timer=null;};
 const notify=()=>change?.({id:m.id,scenario:sc,index});
 const draw=()=>{
  const active=document.activeElement,focusKey=container.contains(active)?Object.keys(active.dataset).find(x=>['back','next','reset','play','scenario'].includes(x)):null;
  const s=m.scenarios[sc];container.innerHTML=`<div class="learning-toolbar">${m.scenarios.length>1?`<label>Сценарий<select data-scenario>${m.scenarios.map((s,i)=>`<option value="${i}" ${i===sc?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label>`:''}<span>Шаг ${index} / ${s.frames.length-1}</span></div>${render(m,{scenario:sc,index})}<nav class="learning-controls" aria-label="Управление схемой"><button class="button" data-back ${index===0?'disabled':''}>Назад</button><button class="button primary" data-next ${index===s.frames.length-1?'disabled':''}>Далее</button>${m.structural?'':`<button class="button" data-play>${running?'Пауза':index===s.frames.length-1?'Повторить':'Показать'}</button>`}<button class="button" data-reset>К обзору</button></nav>`;
  container.querySelector('[data-back]').onclick=()=>jump(index-1);
  container.querySelector('[data-next]').onclick=()=>jump(index+1);
  container.querySelector('[data-reset]').onclick=()=>jump(0);
  container.querySelector('[data-play]')?.addEventListener('click',()=>{if(running){pause();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){jump(index===s.frames.length-1?0:index+1);return;}if(index===s.frames.length-1){index=0;remaining=1800;}running=true;draw();schedule();notify();});
  if(focusKey){const target=container.querySelector('[data-'+focusKey+']');if(target&&!target.disabled)target.focus({preventScroll:true});}
  container.querySelector('[data-scenario]')?.addEventListener('change',ev=>{pause(false);sc=Number(ev.target.value);index=0;remaining=1800;draw();notify();});
 };
 const schedule=()=>{clear();deadline=performance.now()+remaining;timer=setTimeout(()=>{if(disposed||!running)return;index=Math.min(index+1,m.scenarios[sc].frames.length-1);remaining=1800;if(index===m.scenarios[sc].frames.length-1)running=false;draw();notify();if(running)schedule();},remaining);};
 const pause=(redraw=true)=>{if(running)remaining=Math.max(0,deadline-performance.now());running=false;clear();if(redraw)draw();};
 const jump=n=>{pause(false);index=Math.max(0,Math.min(n,m.scenarios[sc].frames.length-1));remaining=1800;draw();notify();};
 const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
 draw();return {dispose(){disposed=true;clear();document.removeEventListener('visibilitychange',visibility);},set(s){if(s.id!==m.id)return;pause(false);sc=Math.max(0,Math.min(s.scenario,m.scenarios.length-1));index=Math.max(0,Math.min(s.index,m.scenarios[sc].frames.length-1));draw();},snapshot:()=>({id:m.id,scenario:sc,index})};
 }
 return {graph,render,scene,bind,joinData,ranking,sequenceMessages};
})();
