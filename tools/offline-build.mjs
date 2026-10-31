/* Saves only the app shell. Model weights and the large model runtime stay
   out of this cache, keeping the explicit offline download small. */
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const html=readFileSync('dist/index.html','utf8');
const assets=readdirSync('dist/assets').filter(name=>/\.(?:js|css|woff2)$/.test(name)&&statSync('dist/assets/'+name).size<500000).map(name=>'./assets/'+name);
const version=createHash('sha256').update(html).digest('hex').slice(0,12);
writeFileSync('dist/offline-sw.js',`const CACHE='hisaab-shell-${version}';const ASSETS=${JSON.stringify(['./','./index.html',...assets])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hisaab-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;event.respondWith(caches.open(CACHE).then(async cache=>{const found=await cache.match(event.request);if(found)return found;try{const response=await fetch(event.request);if(response.ok&&(/\\.(?:js|css|woff2)$/.test(url.pathname)))await cache.put(event.request,response.clone());return response;}catch(error){if(event.request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell;}throw error;}}));});`);
console.log('Offline shell prepared:',assets.length,'initial assets; model runtime excluded.');
