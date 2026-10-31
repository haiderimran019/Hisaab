import type {Workspace} from './core';
export function rememberedIris(w:Workspace,year:number){return w.conversation.irisMemory.filter(m=>m.taxYear===year).map(m=>({code:m.code,label:m.label,path:m.path,source:'From you, not verified' as const,givenOn:m.givenOn}));}
