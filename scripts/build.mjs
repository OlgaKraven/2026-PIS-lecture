import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});
for(const item of ['index.html','app.js','diagrams.js','practice.js','materials-qr-runtime.js','style.css','catalog.css','course.json','assets','materials'])fs.cpSync(item,`dist/${item}`,{recursive:true});
fs.writeFileSync('dist/.nojekyll','');
console.log('Статическая версия: dist/');
