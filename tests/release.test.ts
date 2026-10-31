import test from 'node:test';
import assert from 'node:assert/strict';
import {FREE_PREVIEW,previewLimits} from '../src/release.ts';
import {LIMITS,limitsFor} from '../src/license.ts';
test('free preview permits existing exports and imports without a purchased key',()=>{
 const status={state:'none' as const,plan:'free' as const,reason:'No key'};
 assert.equal(FREE_PREVIEW,true);assert.equal(previewLimits(status).filingPack,true);assert.equal(previewLimits(status).rowsPerImport,8000);
 assert.equal(limitsFor(status).filingPack,false,'underlying licence verification is unchanged');
 assert.deepEqual(previewLimits(status),LIMITS.accountant);
});
