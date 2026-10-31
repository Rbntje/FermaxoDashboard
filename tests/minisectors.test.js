"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {calculateLap,compare}=require("../minisectors.js");
const reference={trackLength:1000,timeMs:100000,samples:[
 {distance:0,timeMs:0},{distance:250,timeMs:25000},{distance:500,timeMs:55000},{distance:750,timeMs:90000},{distance:995,timeMs:99500}
],completedTimeMs:100000};
const current={trackLength:1000,completedTimeMs:null,samples:[
 {distance:0,timeMs:0},{distance:250,timeMs:20000},{distance:500,timeMs:46000},{distance:750,timeMs:78000},{distance:900,timeMs:93000}
]};
test("calculates only measured mini-sector durations",()=>{
 const x=calculateLap(reference.samples,reference.trackLength,4,reference.timeMs);
 assert.equal(x.segments.length,4);
 assert.deepEqual(x.segments.map(s=>Math.round(s.timeMs)),[25000,30000,35000,10000]);
});
test("reports real gains as negative delta and losses as positive delta",()=>{
 const x=compare(current,reference,4);
 assert.equal(x.valid,true);
 assert.deepEqual(x.segments.map(s=>Math.round(s.deltaMs)),[-5000,-4000,-3000,null]);
});
test("does not interpolate through a large missing sample gap",()=>{
 const x=calculateLap([{distance:0,timeMs:0},{distance:800,timeMs:80000},{distance:1000,timeMs:100000}],1000,4,100000);
 assert.equal(x.segments[1].timeMs,null);
});
test("rejects invalid track length and excessive sector count",()=>{
 assert.equal(calculateLap(reference.samples,0,4,100000).valid,false);
 assert.equal(calculateLap(reference.samples,1000,65,100000).valid,false);
});
