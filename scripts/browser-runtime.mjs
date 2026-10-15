import {createRequire} from 'node:module';
import path from 'node:path';
let playwright;
try{playwright=await import('playwright');}
catch{
  const runtime=process.env.PLAYWRIGHT_MODULE_PATH||path.join(process.env.USERPROFILE||'','\.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
  playwright=createRequire(runtime)('playwright');
}
export async function launchBrowser(){
  try{return await playwright.chromium.launch({headless:true});}
  catch{return playwright.chromium.launch({headless:true,channel:'msedge'});}
}
