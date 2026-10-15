import {createRequire} from 'node:module';
let playwright;
try{playwright=await import('playwright');}
catch(error){
  const runtime=process.env.PLAYWRIGHT_MODULE_PATH;
  if(!runtime)throw new Error('Для проверки браузера установите Playwright или задайте PLAYWRIGHT_MODULE_PATH — путь к его package.json.',{cause:error});
  playwright=createRequire(runtime)('playwright');
}
export async function launchBrowser(){
  try{return await playwright.chromium.launch({headless:true});}
  catch{for(const channel of ['chrome','msedge']){try{return await playwright.chromium.launch({headless:true,channel});}catch{}}throw new Error('Не найден Chromium, Chrome или Edge. Укажите доступную среду Playwright.');}
}
