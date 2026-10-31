"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {calculateLap,compare}=require("../minisectors.js");
function samplesFor(times,endDistance=5000){
 const prefix=[0];for(const t of times)prefix.push(prefix[prefix.length-1]+t);
 const out=[];for(let distance=0;distance<=endDistance;distance+=25){
  if(distance===5000){out.push({distance,timeMs:prefix[4]});continue}
  const sector=Math.min(3,Math.floor(distance/1250)),inside=distance-sector*1250;
  out.push({distance,timeMs:prefix[sector]+times[sector]*inside/1250});
 }
 return out
}
const reference={trackLength:5000,timeMs:100000,samples:samplesFor([25000,30000,35000,10000]),completedTimeMs:100000};
const current={trackLength:5000,completedTimeMs:null,samples:samplesFor([20000,26000,32000,10000],3750)};
test("calculates only measured mini-sector durations",()=>{
 const x=calculateLap(reference.samples,reference.trackLength,4,reference.timeMs);
 assert.equal(x.segments.length,4);
 assert.deepEqual(x.segments.map(s=>Math.round(s.timeMs)),[25000,30000,35000,10000]);
});
test("accepts an endpoint sample that matches the measured lap completion time",()=>{
 const x=calculateLap(reference.samples,reference.trackLength,4,reference.timeMs);
 assert.equal(x.segments[3].timeMs,10000);
});
test("reports real gains as negative delta and losses as positive delta",()=>{
 const x=compare(current,reference,4);
 assert.equal(x.valid,true);
 assert.deepEqual(x.segments.map(s=>s.deltaMs==null?null:Math.round(s.deltaMs)),[-5000,-4000,-3000,null]);
});
test("does not interpolate through a large missing sample gap",()=>{
 const x=calculateLap([{distance:0,timeMs:0},{distance:800,timeMs:80000},{distance:1000,timeMs:100000}],1000,4,100000);
 assert.equal(x.segments[1].timeMs,null);
});
test("rejects invalid track length and excessive sector count",()=>{
 assert.equal(calculateLap(reference.samples,0,4,100000).valid,false);
 assert.equal(calculateLap(reference.samples,1000,65,100000).valid,false);
});
