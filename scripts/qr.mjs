import fs from 'node:fs';
import {createRequire} from 'node:module';
import {bibliography} from '../authoring/structure.mjs';
const require=createRequire(process.env.QRCODE_MODULE_PATH||import.meta.url);
const QRCode=require('qrcode');
for(const book of [...bibliography.main,...bibliography.additional]){
 const id=book.url.match(/\/(\d+)\.html$/)[1];
 const svg=await QRCode.toString(book.url,{type:'svg',errorCorrectionLevel:'M',margin:4,width:200,color:{dark:'#000000',light:'#ffffff'}});
 fs.writeFileSync(`assets/book-${id}.svg`,svg);
}

fs.writeFileSync('assets/materials-qr.svg',await QRCode.toString('https://disk.yandex.ru/d/P40mjNJWYJAW9g',{type:'svg',errorCorrectionLevel:'M',margin:4,width:200}));
