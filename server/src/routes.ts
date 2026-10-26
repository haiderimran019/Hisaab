/* The route table.

   index.ts used to be a chain of `if(path===...)`, which worked for four
   endpoints and would not for twenty. A route is now a value: a method, a path,
   whether it needs a session or an admin token, its own rate-limit bucket, and a
   handler that receives one context object.

   Adding an endpoint means adding one entry. That matters more than it sounds,
   because the guarantee this service makes — that it cannot accept financial
   data — depends on every route going through the same checks. Making the
   checks part of the table rather than part of each handler is what stops the
   twentieth route being the one that forgot. */
import type {Env} from './env';
import type {Store,Session} from './store';

export type Ctx={
 request:Request;
 env:Env;
 store:Store;
 url:URL;
 origin:string;
 /** Hashed before use; never stored. See rateKey in validate.ts. */
 ip:string;
 /** UTC date, YYYY-MM-DD. */
 day:string;
 /** Full ISO timestamp for rows that record when something happened. */
 now:string;
 /** Cloudflare's view of where the caller is, for the extraction region gate. */
 country:string;
 /** Present only on routes declared `auth:'session'`. */
 session?:Session;
};

export type Auth='public'|'session'|'admin';

export type Route={
 method:'GET'|'POST';
 path:string;
 auth:Auth;
 /** Short bucket suffix for the per-IP daily limit, and the cap. Omit for none. */
 limit?:{bucket:string;perDay:number};
 /** Extraction carries a base64 document and needs a larger body ceiling. */
 largeBody?:boolean;
 handle(ctx:Ctx):Promise<Response>;
};

export const routeKey=(method:string,path:string)=>`${method} ${path}`;

export function buildTable(routes:Route[]){
 const table=new Map<string,Route>();
 for(const route of routes){
  const key=routeKey(route.method,route.path);
  if(table.has(key))throw new Error(`duplicate route ${key}`);
  table.set(key,route);
 }
 return table;
}

/** Which methods a path accepts, so a wrong method answers 405 rather than 404. */
export function methodsFor(table:Map<string,Route>,path:string){
 return [...table.values()].filter(r=>r.path===path).map(r=>r.method);
}
