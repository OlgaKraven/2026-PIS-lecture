import fs from 'node:fs';
import crypto from 'node:crypto';
import {plan,discipline,specialty} from '../authoring/plan.mjs';
import {finishSlides} from '../authoring/finishing.mjs';
import {addPractice} from '../authoring/practice.mjs';
import {addStructure} from '../authoring/structure.mjs';
import {enhanceSlides} from '../authoring/enhancements.mjs';
import {writeOffline} from './offline.mjs';
const loaded=[];
for(let n=1;n<=4;n++){
 try { const {default:slides}=await import(`../authoring/webinar-${n}.mjs`); loaded.push(slides); }
 catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')loaded.push([]);else throw e;}
}
export const words=t=>(t.match(/[\p{L}\p{N}]+(?:[-–][\p{L}\p{N}]+)*/gu)||[]).length;
const ord=['Первый','Второй','Третий','Четвёртый','Пятый','Шестой'];
function describe(v){
 if(v.type==='agenda')return 'Маршрут занятия. '+v.items.map(x=>`Вопрос ${x.number}. ${x.title}. Начало: слайд ${x.start}.`).join(' ');
 if(v.type==='section')return `Разделитель. Вопрос ${v.number}: ${v.title}. Справа большая серая стрелка, направленная влево.`;
 if(v.type==='questions')return v.items.map(x=>`${x.question} Ответ: ${x.answer}`).join('\n\n');
 if(v.type==='pair')return v.items.map(x=>x.title+'. '+describe(x.visual)).join('\n\n');
 if(v.type==='process')return 'Последовательность подписанных блоков. '+v.items.map((x,i)=>`${i+1}. ${x.title}: ${x.text}.`).join(' ');
 if(v.type==='table')return `Таблица. Столбцы: ${v.columns.join('; ')}. `+v.rows.map((row,i)=>`Строка ${i+1}: ${row.join('; ')}.`).join(' ');
 if(v.type==='diagram')return `Схема. Блоки: ${v.nodes.join('; ')}. Связи: `+v.edges.map(([a,b,l])=>`${a} — ${b}: ${l}`).join('; ')+'.';
 if(v.type==='code')return `Фрагмент ${v.language}. ${v.caption}\n${v.code}`;
 if(v.type==='bars')return `Горизонтальные полосы. Ось значений: ${v.unit}. `+v.items.map(([l,n])=>`${l}: ${n}`).join('; ')+`. ${v.caption}`;
 return `Подготовленный макет экрана «${v.screen}», состояние «${v.state}». ${v.caption||''} ${v.description||''}`;
}
function visualSpeech(v){
 if(v.type==='agenda'||v.type==='section'||v.type==='questions')return '';
 if(v.type==='pair')return v.items.map(x=>visualSpeech(x.visual)).join('\n\n');
 if(v.type==='process')return 'Прочитаем последовательность на схеме. '+v.items.map((x,i)=>`${ord[i]||'Следующий'} блок обозначен «${x.title}». ${x.text}.`).join(' ');
 if(v.type==='table')return 'Сопоставим записи в таблице. '+v.rows.map((row,i)=>`В строке ${i+1} ${row.map((x,j)=>`${v.columns[j].toLowerCase()}: ${x}`).join('. ')}.`).join(' ');
 if(v.type==='diagram')return 'Рассмотрим подписанные связи схемы. '+v.edges.map(([a,b,l])=>`Связь между блоками «${a}» и «${b}» обозначает следующее: ${l.toLowerCase()}.`).join(' ');
 if(v.type==='bars')return 'Прочитаем условные значения на графике. '+v.items.map(([l,n])=>`Для строки «${l}» показано ${n} ${v.unit}.`).join(' ')+` ${v.caption}`;
 if(v.type==='code')return v.spoken||`Перед нами подготовленный фрагмент ${v.language}. ${v.caption} Читаем его как пример согласованного обмена или обработки. Ни один фрагмент на этом слайде не требуется вводить или запускать в прямом эфире.`;
 return v.spoken||`На макете показан экран «${v.screen}». ${v.description||v.caption||''} Это заранее подготовленное изображение состояния интерфейса. Данные на нём относятся к учебному сценарию. Последовательность таких экранов позволяет увидеть результат действия без запуска работающего приложения.`;
}
function normalizeTerms(value){
 if(typeof value==='string')return value.replace(/[Вв]ебинар(ах|ами|ов|ам|ом|а|е|ы|у)?/g,(all,ending)=>{const endings={'ах':'лекциях','ами':'лекциями','ов':'лекций','ам':'лекциям','ом':'лекцией','а':'лекции','е':'лекции','ы':'лекции','у':'лекцию'};const word=endings[ending]||'лекция';return all[0]==='В'?word[0].toUpperCase()+word.slice(1):word;});
 if(Array.isArray(value))return value.map(normalizeTerms);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeTerms(v)]));
 return value;
}
const course={version:'pis-2026.10.23-v4',discipline,specialty,moduleCode:'МДК 01.01',caseName:'Проектный навигатор',wordsPerMinute:110,lectures:[]};
for(let k=0;k<4;k++){
 const meta=plan[k],slides=normalizeTerms(enhanceSlides(finishSlides(loaded[k],meta,k+1),k+1));
 let elapsed=0;
 let output=slides.map((s,i)=>{
   for(const key of ['speech','explanation','hint','transition'])if(s[key])s[key]=s[key].replace(/вебинаре/g,'занятии').replace(/вебинарах/g,'занятиях').replace(/вебинаров/g,'занятий').replace(/вебинара/g,'занятия').replace(/вебинар/g,'занятие');
   if(s.kind==='section')s.speech=s.speech.replace(/Этот раздел занимает в плане \d+ минут\./g,'').trim();
   const b=meta.blocks.find(([a,z])=>i+1>=a&&i+1<=z);
   const [a,z,mins,blockTitle]=b;
   let sec=Math.floor(mins*60/(z-a+1));
   if(i+1===z)sec=mins*60-sec*(z-a);
   if(a===1&&i===0)sec=45;
   if(a===1&&i===1)sec+=Math.floor(mins*60/(z-a+1))-45;
   const next=slides[i+1];
   const transition=s.transition||(next?(next.kind==='section'?`Следующий вопрос — ${next.title.toLowerCase()}. ${next.body}.`:''):k<3?'На следующем занятии продолжим работу с тем же учебным сервисом.':'На этом завершается полный путь проектирования учебного информационного ресурса.');
   const diagramSpeech=s.learning&&s.learning.kind!=='visual'?('На схеме разберём исходные данные: '+s.learning.scenarios[0].input+' '+s.learning.scenarios[0].frames.map(f=>f.caption+' '+f.result).join(' ')+(s.learning.scenarios.length>1?' Изменим условие. '+s.learning.scenarios.slice(1).map(x=>x.input+' '+x.frames.at(-1).result).join(' '):'')):visualSpeech(s.visual);
   const script=[s.speech,diagramSpeech,s.explanation,transition].join('\n\n');
   const pauseFor=v=>v.type==='pair'?v.items.reduce((a,x)=>a+pauseFor(x.visual),0):v.type==='diagram'?14:v.type==='code'?12:v.type==='screen'?10:v.type==='questions'?18:8;
   const pauseSeconds=i===0?0:pauseFor(s.visual);
   const count=words(script);
   const question=meta.blocks.findIndex(([a,z])=>i+1>=a&&i+1<=z)+1;
   const result={...s,question:i>1&&s.kind!=='questions'?question:null,id:`З${k+1}-С${String(i+1).padStart(2,'0')}`,number:i+1,blockTitle,blockIndex:meta.blocks.indexOf(b),plannedSeconds:sec,startSeconds:elapsed,transition,script,visualDescription:describe(s.visual),wordCount:count,pauseSeconds,estimatedSeconds:Math.round(count/110*60+pauseSeconds),requiredWpm:Math.round(count/((sec-pauseSeconds)/60)),links:`${meta.id}, ${blockTitle}; учебные правила проекта`};
   elapsed+=sec;return result;
 });
 output=addPractice(addStructure(output,k+1,meta),k+1);
 for(const s of output.filter(s=>s.visual.type==='agenda'))for(const item of s.visual.items)item.start=output.find(x=>x.kind==='section'&&x.question===item.number).number;
 // Keep the 120-minute lecture budget after adding introductions and literature.
 // Allocate from actual narration, preserving pauses; do not compress the opening block.
 elapsed=0;let allocated=0;const totalWeight=output.filter(s=>!s.supplemental).reduce((sum,s)=>sum+s.estimatedSeconds,0);
 for(let j=0;j<output.length;j++){
   const s=output[j];if(s.supplemental){s.plannedSeconds=0;s.startSeconds=elapsed;s.requiredWpm=0;continue;}s.plannedSeconds=j===output.length-1?7200-allocated:Math.round(7200*s.estimatedSeconds/totalWeight);
   s.startSeconds=elapsed;s.requiredWpm=Math.round(s.wordCount/((s.plannedSeconds-s.pauseSeconds)/60));allocated+=s.plannedSeconds;elapsed+=s.plannedSeconds;
 }
 const updatedBlocks=meta.blocks.map((b,i)=>{const group=output.filter(s=>s.blockIndex===i);return [group[0].number,group.at(-1).number,group.reduce((sum,s)=>sum+s.plannedSeconds,0)/60,b[3]];});
 course.lectures.push({...meta,semester:3,number:k+1,blocks:updatedBlocks,slides:output,totalSeconds:elapsed,totalWords:output.reduce((a,s)=>a+s.wordCount,0),estimatedSeconds:output.filter(s=>!s.supplemental).reduce((a,s)=>a+s.estimatedSeconds,0),supplementEstimatedSeconds:output.filter(s=>s.supplemental).reduce((a,s)=>a+s.estimatedSeconds,0)});
}
fs.mkdirSync('materials',{recursive:true});
fs.writeFileSync('course.json',JSON.stringify(course,null,2));
const sourceSha256=crypto.createHash('sha256').update(fs.readFileSync('course.json')).digest('hex');
for(const l of course.lectures){
 const text=`# ${discipline}\n\n${specialty}\n\nМДК 01.01 · Лекция ${l.number}. ${l.title}\n\nПлан: 120 минут. Учебный проект: «Проектный навигатор».\n\n`+l.slides.map(s=>`<a id="${s.id}"></a>

## Слайд ${s.number}. ${s.title} (${s.id})\n\n${s.supplemental?'Самостоятельное дополнение вне основного 120-минутного плана.':'Плановое время: '+s.plannedSeconds+' с.'} Блок: ${s.blockTitle}.\n\n### Текст на экране\n\n${s.body}\n\n### Визуальный материал\n\n${s.visualDescription}${s.learning?'\n\nИнтерактивная схема: '+s.learning.title+'. Исходные условия и сценарии: ' +s.learning.scenarios.map(x=>x.label+': '+x.input).join(' '): ''}\n\n### Текст выступления\n\n${s.script}\n\n### Указания ведущему\n\n${s.hint||'Сначала назовите элементы, затем прочитайте подписанные связи или строки в указанном порядке.'} Предусмотрено ${s.pauseSeconds} с на показ подписанных элементов.\n\n### Связи\n\n${s.links}\n\n### Источники\n\n${s.sources.length?s.sources.map(u=>`- ${u}`).join('\n'):'Авторский разбор согласованного учебного примера.'}\n\n`).join('');
 fs.writeFileSync(`materials/webinar-${l.number}-script.md`,text);
 const intro=`# ${discipline}\n\nМДК 01.01 · Лекция ${l.number}. ${l.title}\n\n`;
 const teacher=intro+l.slides.map(s=>`<a id="${s.id}"></a>\n\n## Слайд ${s.number}. ${s.title}\n\n${s.script}\n\n${s.visual.type==='bibliography'?s.visual.books.map(b=>`${b.citation} [Открыть источник](${b.url}).`).join('\n\n'):''}${s.visual.type==='resources'?`[Материалы занятия](${s.visual.url}).\n\n`:''}`).join('');
 fs.writeFileSync(`materials/webinar-${l.number}-teacher.md`,teacher.trimEnd()+'\n');
 fs.writeFileSync(`materials/webinar-${l.number}-alignment.json`,JSON.stringify({schemaVersion:1,sourceKind:'local',sourceFile:'../course.json',sourceSha256,sourceVersion:course.version,lectureId:l.id,moduleCode:course.moduleCode,documents:{presenter:`webinar-${l.number}-script.md`,teacher:`webinar-${l.number}-teacher.md`},slides:l.slides.map(s=>({slideId:s.id,title:s.title,displayNumber:s.number,anchor:s.id}))},null,2));

}
writeOffline(course);
console.log(course.lectures.map(l=>({webinar:l.number,slides:l.slides.length,words:l.totalWords,plannedMinutes:l.totalSeconds/60,estimatedMinutes:Math.round(l.estimatedSeconds/60)})));
