"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Track=require("../trackmap.js");
function circuit(length=5000,rx=800,rz=420){
 return Array.from({length:241},(_,i)=>{
  const f=i/240,a=f*Math.PI*2;
  return {distance:length*f,worldX:rx*Math.cos(a),worldZ:rz*Math.sin(a),trackPointValid:true,sector:f<.34?0:f<.68?1:2};
 });
}
test("builds map geometry from recorded world positions for different track shapes",()=>{
 const a=Track.prepare(circuit(),5000,12),b=Track.prepare(circuit(6200,520,900),6200,16);
 assert.equal(a.valid,true);assert.equal(b.valid,true);
 assert.notDeepEqual(Track.project(a.points).points[30],Track.project(b.points).points[30]);
});
test("splits the measured circuit outline into selectable mini-sector paths",()=>{
 const data=Track.prepare(circuit(),5000,12),parts=Track.split(data.points,5000,12);
 assert.equal(parts.length,12);assert.ok(parts.every(x=>x.points.length>=2));
 assert.equal(parts[0].from,0);assert.equal(parts.at(-1).to,5000);
});
test("finds official sector transitions from captured sector values",()=>{
 const data=Track.prepare(circuit(),5000,12);
 const boundaries=Track.sectorBoundaries(data.points);
 assert.equal(boundaries.length,2);assert.deepEqual(boundaries.map(x=>x.sector),[1,2]);
});
test("rejects incomplete or non-closing tracks instead of showing a guessed map",()=>{
 assert.equal(Track.prepare(circuit().slice(30,180),5000,12).valid,false);
 const broken=circuit();broken[240].worldX+=600;
 assert.equal(Track.prepare(broken,5000,12).valid,false);
});
test("projects the live world position into the measured map bounds",()=>{
 const data=Track.prepare(circuit(),5000,12),view=Track.project(data.points,360,190,10);
 const p=Track.projectWorld(data.points[20].x,data.points[20].z,view.bounds);
 assert.ok(p.x>=0&&p.x<=360&&p.y>=0&&p.y<=190);
});
