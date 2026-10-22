/* Light, dark, or whatever the device prefers.

   The choice lives in plain localStorage rather than the encrypted workspace, so
   it applies on the lock screen and in the demo, before anything is unlocked. It
   says nothing about a person's finances, so it does not belong in the vault. */
export type Theme='system'|'light'|'dark';
const KEY='hisaab.theme';

export function storedTheme():Theme{
 try{
  const value=localStorage.getItem(KEY);
  return value==='light'||value==='dark'?value:'system';
 }catch{return 'system';}
}
export function applyTheme(theme:Theme){
 const root=document.documentElement;
 if(theme==='system')root.removeAttribute('data-theme');
 else root.setAttribute('data-theme',theme);
 try{theme==='system'?localStorage.removeItem(KEY):localStorage.setItem(KEY,theme);}catch{/* storage blocked: this session only */}
}
/** Called once at start-up, before the first paint, to avoid a flash. */
export const initTheme=()=>applyTheme(storedTheme());
export const THEMES:[Theme,string][]=[['system','Match my device'],['light','Light'],['dark','Dark']];
