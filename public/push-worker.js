// No financial values or client names belong in lock-screen notifications.
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{let data={};try{data=event.data?.json()||{};}catch{}
 const title=typeof data.title==='string'&&data.title.startsWith('Hisaab')?data.title.slice(0,80):'Hisaab · A gentle reminder';
 const body=typeof data.body==='string'?data.body.slice(0,220):'Your money check-in is ready when you are.';
 await self.registration.showNotification(title,{body,icon:new URL('hisaab-192.png',self.registration.scope).href,badge:new URL('hisaab-192.png',self.registration.scope).href,tag:'hisaab-check-in',data:{url:self.registration.scope},renotify:false});})());
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients)if(client.url.startsWith(self.registration.scope)){await client.focus();return;}await self.clients.openWindow(self.registration.scope);})());});
