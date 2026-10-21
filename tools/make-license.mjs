#!/usr/bin/env node
/* Issue Hisaab licence keys.
 *
 *   node tools/make-license.mjs --init
 *       Creates a signing keypair. Writes the private key to the path given by
 *       --out (default ../hisaab-signing-key.json, outside the repository) and
 *       writes the matching public key into src/license.ts.
 *       Run this ONCE. If the private key is lost, every key issued from it can
 *       still be verified, but no new keys can be signed with it.
 *
 *   node tools/make-license.mjs --name "Ayesha Khan" --plan pro --years 1
 *       Prints a key to hand to that customer after their payment clears.
 *
 *   node tools/make-license.mjs --verify HSB1....
 *       Checks a key the way the app does.
 *
 * The private key never belongs in git, in the published bundle, or in a chat
 * message. Keep one encrypted backup of it.
 */
import {createSign,createVerify,generateKeyPairSync,createPublicKey,createPrivateKey,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:(args[i+1]??true);};
const has=name=>args.includes('--'+name);
const die=m=>{console.error('\n  '+m+'\n');process.exit(1);};
const keyPath=resolve(root,String(flag('out','../hisaab-signing-key.json')));
const licenseSrc=resolve(root,'src/license.ts');
const b64url=buf=>Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64');

function writePublicKeyInto(jwk){
 const src=readFileSync(licenseSrc,'utf8');
 const line=/^export const PUBLIC_KEY_JWK:JsonWebKey\|null=.*$/m;
 if(!line.test(src))die('Could not find the PUBLIC_KEY_JWK line in src/license.ts.');
 const next=src.replace(line,`export const PUBLIC_KEY_JWK:JsonWebKey|null=${JSON.stringify({kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,ext:true})};`);
 writeFileSync(licenseSrc,next);
}

if(has('init')){
 if(existsSync(keyPath)&&!has('force'))die(`A signing key already exists at ${keyPath}. Re-running would orphan every key you have issued. Pass --force only if you mean it.`);
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const priv=privateKey.export({format:'jwk'}),pub=publicKey.export({format:'jwk'});
 writeFileSync(keyPath,JSON.stringify({note:'Hisaab licence signing key. Keep private. Never commit.',created:new Date().toISOString(),privateKey:priv},null,2));
 try{chmodSync(keyPath,0o600);}catch{}
 writePublicKeyInto(pub);
 console.log(`\n  Signing key written to ${keyPath} (chmod 600).`);
 console.log('  Public key written into src/license.ts.');
 console.log('  Back the private key up somewhere encrypted, then commit src/license.ts.\n');
 process.exit(0);
}

if(has('verify')){
 const key=String(flag('verify','')).replace(/\s/g,'');
 const parts=key.split('.');
 if(parts.length!==3||parts[0]!=='HSB1')die('Not a Hisaab key.');
 const src=readFileSync(licenseSrc,'utf8');
 const match=src.match(/^export const PUBLIC_KEY_JWK:JsonWebKey\|null=(.*);$/m);
 if(!match||match[1]==='null')die('This checkout has no public key configured.');
 const pub=createPublicKey({key:JSON.parse(match[1]),format:'jwk'});
 const signed=unb64url(parts[1]);
 const ok=createVerify('SHA256').update(signed).verify({key:pub,dsaEncoding:'ieee-p1363'},unb64url(parts[2]));
 const payload=JSON.parse(signed.toString('utf8'));
 const left=Math.round((Date.parse(payload.expires+'T00:00:00Z')-Date.now())/86400000);
 console.log(`\n  Signature: ${ok?'valid':'INVALID'}`);
 console.log('  Payload:  ',JSON.stringify(payload));
 console.log(`  Expiry:    ${payload.expires} (${left} day${left===1?'':'s'} from today)\n`);
 process.exit(ok?0:1);
}

const name=flag('name'),plan=String(flag('plan','pro'));
if(!name||name===true)die('Give the customer name: --name "Ayesha Khan"');
if(!['pro','accountant'].includes(plan))die('--plan must be pro or accountant');
if(!existsSync(keyPath))die(`No signing key at ${keyPath}. Run: node tools/make-license.mjs --init`);
const years=Number(flag('years',1));
if(!Number.isInteger(years)||years<1||years>5)die('--years must be a whole number between 1 and 5');
const privateKey=createPrivateKey({key:JSON.parse(readFileSync(keyPath,'utf8')).privateKey,format:'jwk'});
const start=flag('from')&&flag('from')!==true?String(flag('from')):new Date().toISOString().slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(start))die('--from must be YYYY-MM-DD');
const end=new Date(Date.parse(start+'T00:00:00Z'));
end.setUTCFullYear(end.getUTCFullYear()+years);
const payload={v:1,id:randomUUID(),name:String(name).slice(0,120),plan,issued:start,expires:end.toISOString().slice(0,10)};
const seats=Number(flag('seats',0));
if(seats>0)payload.seats=seats;
const signedBytes=Buffer.from(JSON.stringify(payload),'utf8');
const signature=createSign('SHA256').update(signedBytes).sign({key:privateKey,dsaEncoding:'ieee-p1363'});
const key=`HSB1.${b64url(signedBytes)}.${b64url(signature)}`;
console.log(`\n  ${payload.name} · ${plan} · ${payload.issued} → ${payload.expires}`);
console.log(`  Licence id ${payload.id}\n`);
console.log(key+'\n');
console.log('  Record the id, name, plan, amount paid and expiry in your own sales ledger.\n');
