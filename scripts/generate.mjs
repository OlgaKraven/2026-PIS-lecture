import fs from 'node:fs';
import {plan,discipline,specialty} from '../authoring/plan.mjs';
import {finishSlides} from '../authoring/finishing.mjs';
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
 if(v.type==='section')return `Разделитель. Вопрос ${v.number}: ${v.title}. Справа чёрная фирменная стрелка.`;
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
const course={version:'pis-2026.10.15-v1',discipline,specialty,caseName:'Проектный навигатор',wordsPerMinute:110,lectures:[]};
for(let k=0;k<4;k++){
 const meta=plan[k],slides=finishSlides(loaded[k],meta,k+1);
 let elapsed=0;
 const output=slides.map((s,i)=>{
   const b=meta.blocks.find(([a,z])=>i+1>=a&&i+1<=z);
   const [a,z,mins,blockTitle]=b;
   let sec=Math.floor(mins*60/(z-a+1));
   if(i+1===z)sec=mins*60-sec*(z-a);
   if(a===1&&i===0)sec=45;
   if(a===1&&i===1)sec+=Math.floor(mins*60/(z-a+1))-45;
   const next=slides[i+1];
   const transition=s.transition||(next?`Далее рассмотрим тему «${next.title}» и свяжем её с показанным решением.`:k<3?'На следующем вебинаре продолжим работу с тем же учебным сервисом.':'На этом завершается полный путь проектирования учебного информационного ресурса.');
   const script=[s.speech,visualSpeech(s.visual),s.explanation,transition].join('\n\n');
   const pauseFor=v=>v.type==='pair'?v.items.reduce((a,x)=>a+pauseFor(x.visual),0):v.type==='diagram'?14:v.type==='code'?12:v.type==='screen'?10:v.type==='questions'?18:8;
   const pauseSeconds=i===0?0:pauseFor(s.visual);
   const count=words(script);
   const result={...s,id:`З${k+1}-С${String(i+1).padStart(2,'0')}`,number:i+1,blockTitle,plannedSeconds:sec,startSeconds:elapsed,transition,script,visualDescription:describe(s.visual),wordCount:count,pauseSeconds,estimatedSeconds:Math.round(count/110*60+pauseSeconds),requiredWpm:Math.round(count/((sec-pauseSeconds)/60)),links:`${meta.id}, ${blockTitle}; учебные правила проекта`};
   elapsed+=sec;return result;
 });
 // Allocate each block's fixed time to its actual speech, rather than giving a divider two minutes.
 elapsed=0;
 for(const [a,z,mins] of meta.blocks){
   const block=output.slice(a-1,z),weight=block.reduce((sum,s)=>sum+s.estimatedSeconds,0);
   let used=0;
   for(let j=0;j<block.length;j++){
     const s=block[j];s.plannedSeconds=j===block.length-1?mins*60-used:Math.round(mins*60*s.estimatedSeconds/weight);
     s.startSeconds=elapsed;s.requiredWpm=Math.round(s.wordCount/((s.plannedSeconds-s.pauseSeconds)/60));used+=s.plannedSeconds;elapsed+=s.plannedSeconds;
   }
 }
 course.lectures.push({...meta,number:k+1,slides:output,totalSeconds:elapsed,totalWords:output.reduce((a,s)=>a+s.wordCount,0),estimatedSeconds:output.reduce((a,s)=>a+s.estimatedSeconds,0)});
}
fs.mkdirSync('materials',{recursive:true});
fs.writeFileSync('course.json',JSON.stringify(course,null,2));
for(const l of course.lectures){
 const text=`# ${discipline}\n\n${specialty}\n\nВебинар ${l.number}. ${l.title}\n\nПлан: 120 минут. Учебный проект: «Проектный навигатор».\n\n`+l.slides.map(s=>`## ${s.id}. ${s.title}\n\nПлановое время: ${s.plannedSeconds} с. Блок: ${s.blockTitle}.\n\n### Текст на экране\n\n${s.body}\n\n### Визуальный материал\n\n${s.visualDescription}\n\n### Текст выступления\n\n${s.script}\n\n### Указания ведущему\n\n${s.hint||'Сначала назовите элементы, затем прочитайте подписанные связи или строки в указанном порядке.'} Предусмотрено ${s.pauseSeconds} с на показ подписанных элементов.\n\n### Связи\n\n${s.links}\n\n### Источники\n\n${s.sources.length?s.sources.map(u=>`- ${u}`).join('\n'):'Авторский разбор согласованного учебного примера.'}\n\n`).join('');
 fs.writeFileSync(`materials/webinar-${l.number}-script.md`,text);
}
writeOffline(course);
console.log(course.lectures.map(l=>({webinar:l.number,slides:l.slides.length,words:l.totalWords,plannedMinutes:l.totalSeconds/60,estimatedMinutes:Math.round(l.estimatedSeconds/60)})));
