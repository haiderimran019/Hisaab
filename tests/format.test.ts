import test from 'node:test';
import assert from 'node:assert/strict';
import {fmt,num,dateLabel} from '../src/format.ts';

test('PKR display uses Rs and lakh/crore grouping without dropping recorded decimals',()=>{
 assert.equal(fmt(150000),'Rs 1,50,000');
 assert.equal(fmt(10750.98),'Rs 10,750.98');
 assert.equal(fmt(20000000),'Rs 2,00,00,000');
 assert.equal(num(150000.25),'1,50,000.25');
});

test('display dates are day/month/year with UTC calendar boundaries preserved',()=>{
 assert.equal(dateLabel('2026-07-01'),'01/07/2026');
 assert.equal(dateLabel('2027-06-30'),'30/06/2027');
});
