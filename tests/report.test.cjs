const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize,position}=require('../dist/report.js');
const sales=[{sqm:4000},{sqm:6000},{sqm:8000},{sqm:10000}];
test('exclusions change median and quartiles; empty and small samples never emit misleading ranges',()=>{
  assert.deepEqual(summarize(sales,100),{count:4,sqm:7000,center:700000,low:550000,high:850000});
  assert.equal(summarize(sales.slice(0,3),100).center,600000);
  assert.equal(summarize(sales.slice(0,2),100).low,null);
  assert.deepEqual(summarize([],100),{count:0,sqm:null,center:null,low:null,high:null});
});
test('position compares price per m² and calculates seller fees independently of DVF estimate',()=>{
  const p=position(sales,100,750000,4);
  assert.equal(p.cheaper,50);assert.equal(p.fee,30000);assert.equal(p.net,720000);
  assert.equal(summarize(sales,100).center,700000);
  assert.equal(position([],100,750000,4).gap,null);
});
test('invalid simulation inputs have no numeric result',()=>{
  for(const [price,fees] of [[0,4],[-1,4],[NaN,4],[Infinity,4],[100,-1],[100,101],[100,NaN]])assert.equal(position(sales,100,price,fees),null);
});
