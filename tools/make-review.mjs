#!/usr/bin/env node
/* Practitioner review certificates.
 *
 *   node tools/make-review.mjs --add-reviewer --name "Nadeem Akhtar, ACA" \
 *        --registration "ICAP R-12345" --id nadeem-akhtar
 *       Creates a reviewing keypair, writes the private key to
 *       ../hisaab-reviewer-<id>.json and adds the public half to src/review.ts.
 *       The private key belongs to the REVIEWER. Hand it over on a device they
 *       control, or better, have them run this themselves and send you only the
 *       public JWK. A tick is only as meaningful as who holds that key.
 *
 *   node tools/make-review.mjs --sign --id nadeem-akhtar --pack pack.json \
 *        [--note "Reviewed; see covering letter"] [--on 2026-10-21]
 *       Signs the digest inside a Filing Pack JSON export and prints the
 *       certificate for the customer to paste into Settings.
 *
 * The certificate is bound to the pack's fingerprint. If the customer changes a
 * figure afterwards, their tick turns amber by itself.
 */
import {createSign,generateKeyPairSync,createPrivateKey,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const flag=(n,d)=>{const i=args.indexOf('--'+n);return i<0?d:(args[i+1]??true);};
const has=n=>args.includes('--'+n);
const die=m=>{console.error('\n  '+m+'\n');process.exit(1);};
const src=resolve(root,'src/review.ts');
const b64url=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const keyPathFor=id=>resolve(root,`../hisaab-reviewer-${id}.json`);
const BLOCK=/export const REVIEWERS:Reviewer\[\]=(\[[\s\S]*?\]);/m;

function readReviewers(){
 const match=readFileSync(src,'utf8').match(BLOCK);
 if(!match)die('Could not find the REVIEWERS array in src/review.ts.');
 return JSON.parse(match[1].replace(/(\w+):/g,'"$1":').replace(/'/g,'"'));
}
function writeReviewers(list){
 const text=readFileSync(src,'utf8');
 writeFileSync(src,text.replace(BLOCK,`export const REVIEWERS:Reviewer[]=${JSON.stringify(list,null,1)};`));
}

if(has('add-reviewer')){
 const id=String(flag('id','')),name=String(flag('name','')),registration=String(flag('registration',''));
 if(!id||!/^[a-z0-9-]{3,40}$/.test(id))die('Give a short url-safe --id, e.g. --id nadeem-akhtar');
 if(!name||name===true)die('Give the reviewer\'s full name with --name');
 if(!registration||registration===true)die('Give the reviewer\'s registration or membership number with --registration. A tick without one is not worth showing.');
 const list=readReviewers();
 if(list.some(r=>r.id===id))die(`A reviewer with id "${id}" is already published.`);
 if(existsSync(keyPathFor(id))&&!has('force'))die(`A key already exists at ${keyPathFor(id)}.`);
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const pub=publicKey.export({format:'jwk'});
 writeFileSync(keyPathFor(id),JSON.stringify({note:`Hisaab reviewing key for ${name}. Belongs to the reviewer. Keep private.`,
  created:new Date().toISOString(),id,name,registration,privateKey:privateKey.export({format:'jwk'})},null,2));
 try{chmodSync(keyPathFor(id),0o600);}catch{}
 list.push({id,name,registration,publicKey:{kty:pub.kty,crv:pub.crv,x:pub.x,y:pub.y,ext:true}});
 writeReviewers(list);
 console.log(`\n  Reviewing key written to ${keyPathFor(id)} (chmod 600).`);
 console.log('  Public half added to src/review.ts. Ship a release for the tick to work.');
 console.log('  Give the private key to the reviewer and delete your copy.\n');
 process.exit(0);
}

if(has('sign')){
 const id=String(flag('id','')),packPath=String(flag('pack',''));
 if(!id||id===true)die('Which reviewer? --id nadeem-akhtar');
 if(!packPath||packPath===true)die('Point at the customer\'s Filing Pack JSON: --pack pack.json');
 if(!existsSync(keyPathFor(id)))die(`No reviewing key at ${keyPathFor(id)}.`);
 const stored=JSON.parse(readFileSync(keyPathFor(id),'utf8'));
 const pack=JSON.parse(readFileSync(resolve(process.cwd(),packPath),'utf8'));
 if(pack.pack!=='hisaab-filing-pack')die('That file is not a Hisaab Filing Pack export.');
 if(!pack.digest||!/^[0-9a-f]{64}$/.test(pack.digest))
  die('That pack carries no fingerprint. It was exported by a build older than the review feature; ask the customer to export again.');
 const reviewedOn=flag('on')&&flag('on')!==true?String(flag('on')):new Date().toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn))die('--on must be YYYY-MM-DD');
 const payload={v:1,reviewer:id,name:stored.name,registration:stored.registration,
  taxYear:pack.taxYear,digest:pack.digest,reviewedOn,note:flag('note')&&flag('note')!==true?String(flag('note')).slice(0,400):''};
 const bytes=Buffer.from(JSON.stringify(payload),'utf8');
 const signature=createSign('SHA256').update(bytes).sign({key:createPrivateKey({key:stored.privateKey,format:'jwk'}),dsaEncoding:'ieee-p1363'});
 console.log(`\n  ${payload.name} · ${payload.registration} · pack for TY${payload.taxYear} · reviewed ${reviewedOn}`);
 console.log(`  Pack fingerprint ${payload.digest.slice(0,16)}…\n`);
 console.log(`${'HSBREV1'}.${b64url(bytes)}.${b64url(signature)}\n`);
 console.log('  If the customer edits any figure, their tick turns amber by itself.\n');
 process.exit(0);
}

console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^\/\*|^ \*ue?/gm,''));
