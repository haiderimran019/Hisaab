import test from 'node:test';
import assert from 'node:assert/strict';
import {demo} from '../src/demo.ts';
import {filingPack} from '../src/pack.ts';
import {packText} from '../src/pack-pdf.ts';
import {estimate,receiptMath,sum} from '../src/core.ts';
import {fmt} from '../src/format.ts';
test('local PDF text carries existing report totals, rule version and full source data',()=>{
 const w=demo(),data=filingPack(w,2027,'Demo').data,text=packText(data,'User note').join('\n');
 assert.ok(text.includes(fmt(estimate(w,2027).reserve)));assert.ok(text.includes(data.ruleVersion));assert.ok(text.includes('Not reviewed'));assert.ok(text.includes('not a filed return'));assert.ok(text.includes('User note'));
 assert.equal(sum(data.receipts.map(r=>r.netPkr)),sum(w.receipts.map(r=>receiptMath(r).net)));
 for(const r of w.receipts)assert.ok(text.includes(r.id));for(const l of data.unresolvedLines)assert.ok(text.includes(l.description));
});

test('a canceled PDF task stops before loading the library or accessing the document',async()=>{
 const {makePackPDF}=await import('../src/pack-pdf.ts'),controller=new AbortController();controller.abort();
 await assert.rejects(()=>makePackPDF(filingPack(demo(),2027,'Demo').data,'',controller.signal),{name:'AbortError'});
});
