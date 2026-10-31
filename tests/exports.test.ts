import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {demo} from '../src/demo.ts';
import {receiptMath,expenseMath,sum,reconcile,estimate} from '../src/core.ts';
import {reportTable,reportXlsx,reportCsv,exportKinds} from '../src/exports.ts';
test('income and expense exports retain report totals and DD/MM/YYYY dates',()=>{
 const w=demo(),income=reportTable(w,2027,'income'),expenses=reportTable(w,2027,'expenses');
 assert.equal(sum(income.rows.map(r=>Number(r[8]))),sum(w.receipts.map(r=>receiptMath(r).net)));
 assert.equal(sum(expenses.rows.map(r=>Number(r[7]))),sum(w.expenses.map(expenseMath)));
 assert.equal(income.rows[0][0],'08/07/2026');
 const tax=reportTable(w,2027,'tax-worksheet');assert.equal(tax.rows.find(r=>r[0]==='Modeled reserve')![1],estimate(w,2027).reserve);assert.equal(tax.rows.find(r=>r[0]==='Final liability')![1],null);
});
test('statement exports retain currency and duplicate states without mixing account totals',()=>{
 const w=demo(),table=reportTable(w,2027,'statements');for(const a of w.accounts){const rows=table.rows.filter(r=>r[1]===a.label&&r[5]!=='duplicate');assert.equal(sum(rows.map(r=>Number(r[4]))),reconcile(w,a.id).movement);}
 assert.ok(table.rows.some(r=>r[5]==='duplicate'));
});
test('every XLSX is a real ZIP workbook with metadata and no executable cell formula',async()=>{
 const w=demo();w.receipts[0].client='=HYPERLINK("https://example.invalid","unsafe")';
 for(const kind of exportKinds){const table=reportTable(w,2027,kind),blob=await reportXlsx(table),files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(files['xl/workbook.xml']);const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);assert.ok(!/<f[ >]/.test(sheet));if(kind==='income')assert.ok(sheet.includes(`<v>${receiptMath(w.receipts[0]).net}</v>`));
  const text=Object.values(files).map(bytes=>strFromU8(bytes)).join('\n');assert.ok(text.includes(table.ruleVersion));assert.ok(text.includes('Not reviewed / not a filed return'));assert.ok(text.includes('2027'));
 }
 assert.ok(reportCsv(reportTable(w,2027,'income')).includes("'=HYPERLINK"));
});

test('chat exports keep a stable snapshot and generate real spreadsheet bytes',async()=>{
 const {fileRequest,generateChatFile}=await import('../src/chat-files.ts');const w=demo(),request=fileRequest('export my expenses Excel',w,2027,'2026-10')!;
 assert.equal(request.format,'xlsx');assert.equal(JSON.parse(request.snapshot).table.title,'Expenses');const original=request.snapshot;w.expenses=[];assert.equal(request.snapshot,original);
 const file=await generateChatFile(request);assert.equal(file.name,request.name);assert.deepEqual([...new Uint8Array(await file.arrayBuffer()).slice(0,2)],[80,75]);
});
