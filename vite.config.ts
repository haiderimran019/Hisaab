import { defineConfig } from 'vite';
export default defineConfig(({mode})=>({base:'./',define:{__HISAAB_LOCAL_AI__:JSON.stringify(mode==='development')},server:{proxy:{'/hisaab-ai':{target:'http://127.0.0.1:11435',changeOrigin:true,rewrite:path=>path.replace(/^\/hisaab-ai/,'')}}},worker:{format:'es'},build:{target:'es2022'}}));
