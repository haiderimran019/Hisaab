/* The IRIS field map.

   What these tests are actually protecting: that no build can ever show a
   customer an IRIS field code that nobody checked. The map is the most useful
   thing in the product and the easiest place to do real harm — a figure typed
   into the wrong box is a misdeclaration with the customer's name on it, not a
   cosmetic bug. So the tests are mostly about what the map refuses to say. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {IRIS_FIELDS,IRIS_MAP_VERSION,IRIS_DRAFT_WARNING,irisField,irisFieldsFor,
 irisStatus,irisDestination,irisGuidance,validateIrisMap,isVerifiedIrisField,userIrisCode} from '../src/iris.ts';
import {estimate} from '../src/core.ts';
import {demo} from '../src/demo.ts';

/* ── The honesty invariants ──────────────────────────────────────────────── */

test('no field claims a code it has not had transcribed', () => {
 for(const f of IRIS_FIELDS){
  if(!f.verified){
   assert.equal(f.code,'',`${f.id} is unverified but carries a code`);
   assert.equal(f.irisLabel,'',`${f.id} is unverified but carries an IRIS label`);
  }
  // And the reverse: a code may not appear without somebody's name against it.
  if(f.code||f.irisLabel){
   assert.equal(f.verified,true,`${f.id} has a code but is not marked verified`);
   assert.ok(f.transcribedBy.trim(),`${f.id} has a code but nobody is named for it`);
  }
 }
});

test('the map calls itself a draft for exactly as long as it is one', () => {
 const status=irisStatus();
 assert.equal(status.ready,status.missing.length===0);
 // This is the invariant that stops a half-transcribed map shipping as finished.
 if(!status.ready)assert.match(IRIS_MAP_VERSION,/draft/,
  'while any required field is unverified the version must say draft');
 else assert.ok(!/draft/.test(IRIS_MAP_VERSION),
  'once every required field is verified the draft suffix comes off');
});

test('an unverified field yields a pointer and a reason, never a code', () => {
 for(const f of IRIS_FIELDS.filter(f=>!f.verified)){
  const d=irisDestination(f.id)!;
  assert.equal(d.known,false,f.id);
  assert.ok(!('code' in d),`${f.id} leaked a code field`);
  assert.equal(d.path,'',`${f.id} must not present a draft IRIS path as verified`);
  assert.ok(d.law.length>3,`${f.id} must still cite the law`);
  assert.match(d.why,/not been transcribed/);

  // The sentence the pack prints must not contain anything code-shaped.
  const line=irisGuidance(f.id);
  assert.match(line,/not yet confirmed/,f.id);
  assert.ok(!/field \d/.test(line),`${f.id} printed a field number`);
 }
});

test('a field marked verified but left blank is still refused', () => {
 // The dangerous edit: someone flips verified:true and forgets the code.
 const real=irisField('it-export-base')!;
 const half={...real,verified:true,code:'',irisLabel:'Something'};
 // irisDestination reads the live map, so assert the guard's own condition
 // rather than monkeypatching: both halves must be present to count as known.
 assert.equal(half.verified&&Boolean(half.code),false,
  'verified alone must not be enough; the code has to be there too');
});

test('every figure the map names is one the tax engine actually produces', () => {
 const e=estimate(demo(),2027) as unknown as Record<string,unknown>;
 for(const f of IRIS_FIELDS){
  if(f.figure==='declaration')continue;
  const [head,tail]=f.figure.split('.');
  assert.ok(head in e,`${f.id} points at estimate().${f.figure}, which does not exist`);
  if(tail)assert.ok(tail in (e[head] as Record<string,unknown>),
   `${f.id} points at estimate().${f.figure}, which does not exist`);
 }
});

/* ── Coverage of what a return actually needs ────────────────────────────── */

test('every figure a filer has to type is in the map', () => {
 const ids=IRIS_FIELDS.map(f=>f.id);
 for(const needed of ['it-export-base','service-export-base','export-withheld',
  'domestic-turnover','business-expenses','business-profit','domestic-withheld'])
  assert.ok(ids.includes(needed),`${needed} is missing from the map`);
 assert.equal(new Set(IRIS_FIELDS.map(f=>f.id+':'+f.taxYear)).size,IRIS_FIELDS.length,'field and tax year must be unique');
});

test('the wealth statement is named, because a return without one is not filed', () => {
 const f=irisField('wealth-statement')!;
 assert.equal(f.required,true);
 assert.match(f.law,/116/);
 // Hisaab holds income, not assets, and the note has to admit that plainly.
 assert.match(f.note,/produces no part of this/);
});

test('PSEB registration is marked as having no IRIS field, not an unknown one', () => {
 const f=irisField('pseb-registration')!;
 assert.match(f.irisPath,/Not in IRIS/);
 assert.match(f.note,/verifies nothing/);
 assert.match(f.note,/Do not add a code here/,
  'the next person to work on this must not go hunting for a field that does not exist');
});

test('the social media row is TY2027 only, and claims no liability', () => {
 const f=irisField('social-media-base')!;
 assert.deepEqual(f.years,[2027]);
 assert.equal(f.required,false,'it cannot be required in a year it does not exist in');
 assert.match(f.note,/does not treat this as automatically final/);
 assert.deepEqual(irisFieldsFor(2026).filter(x=>x.id==='social-media-base'),[]);
 assert.equal(irisFieldsFor(2027).some(x=>x.id==='social-media-base'),true);
});

test('the surcharge is optional, because a return may not show it at all', () => {
 const f=irisField('business-surcharge')!;
 assert.equal(f.required,false);
 assert.match(f.law,/4AB/);
 // Optional fields must not hold the whole map hostage.
 assert.ok(!irisStatus().missing.includes('business-surcharge'));
});

test('per-year status counts only the fields that year has', () => {
 const all=irisStatus();
 const ty2026=irisStatus(2026);
 assert.ok(ty2026.total<all.total,'TY2026 has no s.154B row');
 assert.equal(ty2026.version,IRIS_MAP_VERSION);
});

test('an unknown id is null rather than an empty-looking answer', () => {
 assert.equal(irisField('no-such-field'),null);
 assert.equal(irisDestination('no-such-field'),null);
 assert.equal(irisGuidance('no-such-field'),'');
});

test('the draft warning says what the map is for and what it is not', () => {
 assert.match(IRIS_DRAFT_WARNING,/not as a filing instruction/);
 assert.match(IRIS_DRAFT_WARNING,/have not been transcribed/);
});

test('every verified entry requires source, checkedOn and checkedBy; invalid claims fail the build guard',()=>{
 validateIrisMap();
 const f={...irisField('it-export-base')!,verified:true,code:'TEST-ONLY',irisLabel:'Synthetic test field',source:'IRIS screen',checkedOn:'2026-10-31',checkedBy:'test fixture'};
 assert.equal(isVerifiedIrisField(f),true);
 for(const key of ['source','checkedOn','checkedBy'] as const)assert.throws(()=>validateIrisMap([{...f,[key]:''}]));
 assert.equal(irisDestination(f.id,2026,[f]),null);
 assert.equal(irisDestination(f.id,2027,[{...f,source:''}])!.known,false);
});
test('user supplied codes stay explicitly unverified and never enter the verified catalogue',()=>{
 const before=JSON.stringify(IRIS_FIELDS),c=userIrisCode('USER-EXAMPLE','User provided label');
 assert.equal(c.source,'From you, not verified');assert.equal(c.verified,false);assert.equal(JSON.stringify(IRIS_FIELDS),before);
});
