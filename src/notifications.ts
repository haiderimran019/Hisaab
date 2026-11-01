import {CLOUD_URL} from './cloud-config';
import {cloudClient,accountUser,activeCompany,cloudFetch,assertCloudNetwork} from './cloud';
let vapidKey='';
export function pushSupported(){return typeof Notification!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window;}
export async function pushAvailability(){if(!pushSupported())return false;const r=await cloudFetch(CLOUD_URL+'/functions/v1/send-reminders',{credentials:'omit',signal:AbortSignal.timeout(10000)});if(!r.ok)return false;const data=await r.json();vapidKey=typeof data.publicKey==='string'?data.publicKey:'';return data.available===true&&!!vapidKey;}
const decodeKey=(value:string)=>{const text=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(text,c=>c.charCodeAt(0));};
export async function enableReminders(year:number,filing:boolean){
 if(!pushSupported()||!vapidKey)throw Error('Push notifications are not available on this browser yet. Calendar reminders remain available.');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted')throw Error('Notification permission was not granted. You can still use calendar reminders.');
 const company=activeCompany();const c=await cloudClient(),user=await accountUser();if(!user)throw Error('Sign in before enabling reminders.');if(!activeCompany())throw Error('Choose a company first.');
 await navigator.serviceWorker.register(new URL('offline-sw.js',document.baseURI),{scope:new URL('.',document.baseURI).pathname});const registration=await navigator.serviceWorker.ready;assertCloudNetwork();if(company!==activeCompany())throw Error('Company changed. Try again.');
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(vapidKey)});const json=subscription.toJSON();assertCloudNetwork();if(company!==activeCompany())throw Error('Company changed. Try again.');
 const {error}=await c.from('push_subscriptions').upsert({company_id:company,user_id:user.id,endpoint:subscription.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,monthly_statement:true,filing_reminders:filing,tax_year:year},{onConflict:'company_id,user_id,endpoint'});if(error){await subscription.unsubscribe();throw Error('Could not save your reminder preference. Nothing was subscribed on the server.');}
 return true;
}
export async function disableReminders(){if(!('serviceWorker' in navigator))return;const registration=await navigator.serviceWorker.getRegistration(new URL('.',document.baseURI).href);const sub=await registration?.pushManager.getSubscription();if(!sub)return;const c=await cloudClient(),user=await accountUser();if(user){const {error}=await c.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',sub.endpoint);if(error)throw Error('Could not turn off server reminders. Try again before signing out.');}await sub.unsubscribe();}
export async function remindersActive(){if(!('serviceWorker' in navigator))return false;const registration=await navigator.serviceWorker.getRegistration(new URL('.',document.baseURI).href);return !!(await registration?.pushManager.getSubscription());}
