import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,findHeader,suggestMapping,parseAmount,parseDate,buildImport,transferCandidates,fingerprint} from '../src/statements.ts';
import {blankWorkspace,reconcile,readiness,workspaceSchema,accountSchema,type Workspace,type Account} from '../src/core.ts';

const account=(over:Partial<Account>={}):Account=>accountSchema.parse({
 id:crypto.randomUUID(),label:'Meezan current',kind:'Bank',currency:'PKR',institution:'Meezan',reference:'4821',
 opening:'10000.00',closing:'10000.00',periodStart:'2026-07-01',periodEnd:'2026-06-30'.replace('2026','2027'),
 balancesConfirmed:true,...over});

const run=(csv:string,acc=account(),existing:Workspace['lines']=[],mapOver={})=>{
 const rows=parseCsv(csv);const headerIndex=findHeader(rows);
 assert.ok(headerIndex>=0,'header row should be found');
 return buildImport({account:acc,existing,rows,headerIndex,
  mapping:{...suggestMapping(rows[headerIndex]),...mapOver},batchId:crypto.randomUUID()});
};

test('quoted fields, embedded commas and CRLF survive parsing', () => {
 const rows=parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n');
 assert.deepEqual(rows,[['a','b'],['x, y','he said "hi"']]);
});

test('a title block above the table does not break header detection', () => {
 const csv=['ACME BANK LIMITED','Account 1234-5678','Statement for July 2026','',
  'Value Date,Particulars,Debit,Credit,Balance',
  '05/07/2026,SALARY PAYONEER,,278500.00,288500.00'].join('\n');
 const rows=parseCsv(csv);
 assert.equal(findHeader(rows),4);
 const out=run(csv);
 assert.equal(out.lines.length,1);
 assert.equal(out.lines[0].amount,'278500.00');
 assert.equal(out.lines[0].date,'2026-07-05');
 assert.equal(out.lines[0].row,6,'row number should match the spreadsheet row the user sees');
});

test('debit and credit columns produce the right signs', () => {
 const csv=['Date,Description,Withdrawal,Deposit',
  '2026-07-02,Client payment,,100000',
  '2026-07-03,Internet bill,4500,'].join('\n');
 const out=run(csv);
 assert.deepEqual(out.lines.map(l=>l.amount),['100000.00','-4500.00']);
});

test('a single amount column with a Dr/Cr marker is read correctly', () => {
 const csv=['Txn Date,Details,Amount,Dr/Cr',
  '01-08-2026,Consulting fee,"50,000.00",CR',
  '02-08-2026,Bank charges,750.00,DR'].join('\n');
 const out=run(csv);
 assert.deepEqual(out.lines.map(l=>l.amount),['50000.00','-750.00']);
});

test('money formats seen in Pakistani exports', () => {
 assert.equal(parseAmount('1,234.56')?.toFixed(2),'1234.56');
 assert.equal(parseAmount('(1,234.56)')?.toFixed(2),'-1234.56');
 assert.equal(parseAmount('PKR 2,00,000')?.toFixed(2),'200000.00');
 assert.equal(parseAmount('750.00 Dr')?.toFixed(2),'-750.00');
 assert.equal(parseAmount('1.234,56')?.toFixed(2),'1234.56');
 assert.equal(parseAmount('-'),null,'a dash means the column is empty, not zero');
 assert.equal(parseAmount(''),null);
 assert.equal(parseAmount('abc'),null,'unreadable text must not become a number');
});

test('dates are never guessed when they cannot be read', () => {
 assert.equal(parseDate('05/04/2026',true),'2026-04-05');
 assert.equal(parseDate('05/04/2026',false),'2026-05-04');
 assert.equal(parseDate('13/04/2026',false),'2026-04-13','an impossible month falls back to the only reading that works');
 assert.equal(parseDate('12 Aug 2026'),'2026-08-12');
 assert.equal(parseDate('2026-02-30'),null,'a date that does not exist is rejected');
 assert.equal(parseDate('not a date'),null);
});

test('unreadable rows are reported with their row number, never dropped quietly', () => {
 const csv=['Date,Description,Amount',
  '2026-07-01,Good row,1000',
  'TOTAL,,999999',
  '2026-07-03,No amount here,',
  '2026-07-04,Zero movement,0'].join('\n');
 const out=run(csv);
 assert.equal(out.lines.length,1);
 assert.equal(out.issues.length,3);
 assert.deepEqual(out.issues.map(i=>i.row),[3,4,5]);
 assert.ok(out.issues[0].reason.includes('date'));
 assert.ok(out.issues.some(i=>i.reason.includes('zero')));
});

test('a row with both a debit and a credit is flagged rather than netted', () => {
 const csv=['Date,Description,Debit,Credit','2026-07-01,Odd row,500,500'].join('\n');
 const out=run(csv);
 assert.equal(out.lines.length,0);
 assert.match(out.issues[0].reason,/debit and a credit/);
});

test('repeat imports are marked duplicate instead of doubling income', () => {
 const acc=account();
 const csv=['Date,Description,Amount','2026-07-01,Client payment,100000'].join('\n');
 const first=run(csv,acc);
 assert.equal(first.lines[0].status,'pending');
 const second=run(csv,acc,first.lines);
 assert.equal(second.lines[0].status,'duplicate');
 assert.equal(second.duplicates,1);
});

test('the same row twice inside one file is caught too', () => {
 const csv=['Date,Description,Amount','2026-07-01,Client payment,100000','2026-07-01,Client payment,100000'].join('\n');
 const out=run(csv);
 assert.equal(out.lines.filter(l=>l.status==='duplicate').length,1);
});

test('a fingerprint ignores spacing and case but not the amount', () => {
 const a=fingerprint('acc','2026-07-01','  CLIENT   Payment ','100.00');
 const b=fingerprint('acc','2026-07-01','client payment','100.00');
 const c=fingerprint('acc','2026-07-01','client payment','100.01');
 assert.equal(a,b);
 assert.notEqual(a,c);
});

test('a missing date column stops the import with an explanation', () => {
 const rows=parseCsv('Thing,Amount\nfoo,100');
 assert.throws(()=>buildImport({account:account(),existing:[],rows,headerIndex:0,mapping:{amount:1},batchId:crypto.randomUUID()}),/transaction date/);
});

test('no amount mapping at all is refused', () => {
 const rows=parseCsv('Date,Description\n2026-07-01,foo');
 assert.throws(()=>buildImport({account:account(),existing:[],rows,headerIndex:0,mapping:{date:0},batchId:crypto.randomUUID()}),/signed amount column/);
});

test('equal and opposite movements days apart are offered as an own transfer', () => {
 const w=blankWorkspace();
 const payoneer=account({label:'Payoneer',currency:'USD'}),bank=account({label:'HBL'});
 w.accounts.push(payoneer,bank);
 const out=run(['Date,Description,Amount','2026-07-10,Withdrawal to bank,-50000'].join('\n'),payoneer);
 const into=run(['Date,Description,Amount','2026-07-12,IBFT credit from Payoneer,50000'].join('\n'),bank);
 w.lines.push(...out.lines,...into.lines);
 const pairs=transferCandidates(w);
 assert.equal(pairs.length,1);
 assert.equal(pairs[0].days,2);
 assert.equal(pairs[0].sameAccount,false);
 workspaceSchema.parse(w);
});

test('a transfer pair is not offered when the gap is too wide', () => {
 const w=blankWorkspace();
 const a=account({label:'A'}),b=account({label:'B'});
 w.accounts.push(a,b);
 w.lines.push(...run(['Date,Description,Amount','2026-07-01,out,-500'].join('\n'),a).lines);
 w.lines.push(...run(['Date,Description,Amount','2026-07-20,in,500'].join('\n'),b).lines);
 assert.equal(transferCandidates(w).length,0);
});

test('reconciliation reports the unexplained difference and never hides it', () => {
 const w=blankWorkspace();
 const acc=account({opening:'10000.00',closing:'115000.00'});
 w.accounts.push(acc);
 w.lines.push(...run(['Date,Description,Amount','2026-07-01,Client payment,100000'].join('\n'),acc).lines);
 const r=reconcile(w,acc.id);
 assert.equal(r.computedClosing,110000);
 assert.equal(r.difference,5000);
 assert.equal(r.balanced,false);
 const blocked=readiness(w,2027);
 assert.equal(blocked.ready,false);
 assert.ok(blocked.blockers.some(b=>b.includes('does not reconcile')));
 assert.ok(blocked.blockers.some(b=>b.includes('not been classified')));
});

test('a reconciled account with every line decided is ready', () => {
 const w=blankWorkspace();
 const acc=account({opening:'10000.00',closing:'110000.00'});
 w.accounts.push(acc);
 const out=run(['Date,Description,Amount','2026-07-01,Client payment,100000'].join('\n'),acc);
 out.lines[0].status='income';
 w.lines.push(...out.lines);
 const r=reconcile(w,acc.id);
 assert.equal(r.balanced,true);
 assert.equal(readiness(w,2027).ready,true);
});

test('duplicate lines are excluded from the reconciliation arithmetic', () => {
 const w=blankWorkspace();
 const acc=account({opening:'0.00',closing:'100000.00'});
 w.accounts.push(acc);
 const csv=['Date,Description,Amount','2026-07-01,Client payment,100000'].join('\n');
 const first=run(csv,acc);first.lines[0].status='income';
 const second=run(csv,acc,first.lines);
 w.lines.push(...first.lines,...second.lines);
 assert.equal(reconcile(w,acc.id).balanced,true,'a duplicate must not move the balance');
 assert.equal(reconcile(w,acc.id).duplicates,1);
});

test('a statement line cannot reference an account that is not in the workspace', () => {
 const w=blankWorkspace();
 const acc=account();
 w.lines.push(...run(['Date,Description,Amount','2026-07-01,x,100'].join('\n'),acc).lines);
 assert.throws(()=>workspaceSchema.parse(w),/missing account/);
});
