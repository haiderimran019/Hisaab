export function safePushEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='fcm.googleapis.com'||u.hostname==='web.push.apple.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com')||u.hostname.endsWith('.wns.windows.com'));}catch{return false;}}
export function reminderFor(today:string,taxYear:number,monthly:boolean,filing:boolean){
 if(monthly&&today.endsWith('-01'))return {title:'Hisaab · Monthly check-in',body:'Your monthly money check-in is ready. Import your statement and review it at your own pace.'};
 // Statutory date reminders only, not a claim about current FBR extensions.
 if(filing&&[`${taxYear}-09-23`,`${taxYear}-09-29`].includes(today))return {title:'Hisaab · Filing check-in',body:'Take a moment to review your Filing Pack. Check FBR’s current deadline and any extensions before filing.'};
 return null;
}
