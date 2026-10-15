export const P = (...items) => ({type:'process',items:items.map(([title,text])=>({title,text}))});
export const T = (columns,rows,caption='') => ({type:'table',columns,rows,caption});
export const C = (language,code,caption='') => ({type:'code',language,code,caption});
export const U = (screen,state='default',extra={}) => ({type:'screen',screen,state,...extra});
export const B = (items,unit,caption) => ({type:'bars',items,unit,caption});
export const D = (nodes,edges,caption='') => ({type:'diagram',nodes,edges,caption});
export const S = (title,body,visual,speech,explanation,hint='',sources=[]) => ({title,body,visual,speech,explanation,hint,sources});
export const motivation='Хочу разработать каталог мероприятий и личный кабинет участника студенческого клуба.';
export const refs={
 forms:'https://www.w3.org/WAI/tutorials/forms/',
 contrast:'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
 keyboard:'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
 focus:'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
 http:'https://www.rfc-editor.org/rfc/rfc9110.html',
 json:'https://www.rfc-editor.org/rfc/rfc8259.html',
 patch:'https://www.rfc-editor.org/rfc/rfc5789.html',
 constraints:'https://www.postgresql.org/docs/current/ddl-constraints.html',
 transaction:'https://www.postgresql.org/docs/current/tutorial-transactions.html',
 sql:'https://www.postgresql.org/docs/current/tutorial-sql.html',
 index:'https://www.postgresql.org/docs/current/indexes-intro.html',
 explain:'https://www.postgresql.org/docs/current/using-explain.html',
 backup:'https://www.postgresql.org/docs/current/backup.html',
 telemetry:'https://opentelemetry.io/docs/concepts/observability-primer/',
 logs:'https://opentelemetry.io/docs/concepts/signals/logs/',
 metrics:'https://opentelemetry.io/docs/concepts/signals/metrics/',
 traces:'https://opentelemetry.io/docs/concepts/signals/traces/',
 tls:'https://www.rfc-editor.org/rfc/rfc8446.html',
 cache:'https://www.rfc-editor.org/rfc/rfc9111.html',
 testing:'https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/',
 ai:'https://airc.nist.gov/airmf-resources/airmf/'
};
