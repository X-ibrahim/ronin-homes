import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist/server',{recursive:true});
await fs.mkdir('dist/client/__pages',{recursive:true});
await fs.mkdir('dist/.openai',{recursive:true});
await fs.cp('public/ronin-assets','dist/client/ronin-assets',{recursive:true});
await fs.mkdir('dist/client/_next/static/media',{recursive:true});
for(const font of ['Pacaembu_Regular-s.p.3db81f82.woff2','Pacaembu_Black-s.p.05c658e4.woff2','Aberta-s.p.4d4e157e.woff2']) await fs.copyFile('public/_next/static/media/'+font,'dist/client/_next/static/media/'+font);
try { await fs.cp('snapshot','dist/client/__pages',{recursive:true}); } catch {}
await fs.cp('store/index.html','dist/client/index.html');
const routes={};
if(await fs.stat('snapshot').catch(()=>false)){for(const file of await walk('snapshot')){if(!file.endsWith('index.html'))continue;const rel=path.relative('snapshot',file).replaceAll('\\','/');const route='/'+rel.replace(/index.html$/,'');routes[route]='/__pages/'+rel;}}
const worker=await fs.readFile('scripts/worker.mjs','utf8');
await fs.writeFile('dist/server/index.js','const routes='+JSON.stringify(routes)+';\n'+worker);
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await fs.writeFile('dist/server/wrangler.json',JSON.stringify({name:'amazonia-replica',main:'index.js',compatibility_date:'2026-09-01',assets:{directory:'../client',binding:'ASSETS',run_worker_first:true}},null,2));
console.log(`Built ${Object.keys(routes).length} page snapshots with original hydrated interactions.`);
