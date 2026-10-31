(function(root){
"use strict";
function finite(v){return Number.isFinite(Number(v))}
function prepare(samples,trackLength,count=12){
 const length=Number(trackLength),n=Math.floor(Number(count));
 if(!Number.isFinite(length)||length<=0||n<2||n>64)return {valid:false,reason:"invalid track length or mini-sector count",points:[]};
 const points=[];
 for(const sample of Array.isArray(samples)?samples:[]){
  if(!sample||sample.trackPointValid!==true||sample.distance==null||sample.worldX==null||sample.worldZ==null||!finite(sample.distance)||!finite(sample.worldX)||!finite(sample.worldZ))continue;
  const distance=Number(sample.distance),x=Number(sample.worldX),z=Number(sample.worldZ);
  if(distance<0||distance>length||!Number.isFinite(x)||!Number.isFinite(z))continue;
  if(points.length&&distance<=points[points.length-1].distance)continue;
  points.push({distance,x,z,sector:finite(sample.sector)?Number(sample.sector):null});
 }
 const edgeTolerance=Math.max(45,length*.012),maxGap=Math.max(90,length/n*.24);
 if(points.length<Math.max(60,n*6))return {valid:false,reason:"not enough measured track points",points};
 if(points[0].distance>edgeTolerance||length-points[points.length-1].distance>edgeTolerance)return {valid:false,reason:"recorded lap does not cover the start/finish line",points};
 let perimeter=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dd=b.distance-a.distance,dx=b.x-a.x,dz=b.z-a.z,step=Math.hypot(dx,dz);
  if(dd>maxGap||step>Math.max(120,dd*4+25))return {valid:false,reason:"track point gap is too large",points};
  perimeter+=step;
 }
 const closure=Math.hypot(points[0].x-points.at(-1).x,points[0].z-points.at(-1).z);
 perimeter+=closure;
 if(closure>Math.max(65,length*.018))return {valid:false,reason:"recorded path does not close",points};
 if(perimeter<length*.58||perimeter>length*1.55)return {valid:false,reason:"measured path length is inconsistent",points};
 return {valid:true,reason:"",points,length,count:n,perimeter};
}
function project(points,width=360,height=190,padding=10){
 if(!Array.isArray(points)||!points.length)return {points:[],bounds:null};
 const xs=points.map(p=>Number(p.x)),zs=points.map(p=>Number(p.z));
 const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const spanX=Math.max(1,maxX-minX),spanZ=Math.max(1,maxZ-minZ),scale=Math.min((width-padding*2)/spanX,(height-padding*2)/spanZ);
 const dx=(width-spanX*scale)/2,dz=(height-spanZ*scale)/2;
 return {bounds:{minX,maxX,minZ,maxZ,width,height,padding,scale,dx,dz},
  points:points.map(p=>({x:dx+(Number(p.x)-minX)*scale,y:height-dz-(Number(p.z)-minZ)*scale,distance:Number(p.distance),sector:p.sector}))};
}
function projectWorld(x,z,b){
 if(!b||x==null||z==null||!finite(x)||!finite(z))return null;
 return {x:b.dx+(Number(x)-b.minX)*b.scale,y:b.height-b.dz-(Number(z)-b.minZ)*b.scale};
}
function pointAt(points,distance,length,maxGap){
 if(distance<=points[0].distance+1)return {x:points[0].x,z:points[0].z,distance};
 if(distance>=length-1){
  const p=points[0];return {x:p.x,z:p.z,distance:length};
 }
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(a.distance<=distance&&b.distance>=distance){
   if(b.distance-a.distance>maxGap)return null;
   const t=(distance-a.distance)/(b.distance-a.distance);
   return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,distance};
  }
 }
 return null;
}
function split(points,length,count){
 const maxGap=Math.max(90,length/count*.24),out=[];
 for(let i=0;i<count;i++){
  const start=i*length/count,end=(i+1)*length/count;
  const a=pointAt(points,start,length,maxGap),b=pointAt(points,end,length,maxGap);
  const middle=points.filter(p=>p.distance>start&&p.distance<end);
  out.push(a&&b?{index:i,from:start,to:end,points:[a,...middle,b]}:{index:i,from:start,to:end,points:[]});
 }
 return out;
}
function sectorBoundaries(points){
 const out=[];
 for(let i=1;i<points.length;i++){
  if(points[i].sector!=null&&points[i-1].sector!=null&&points[i].sector!==points[i-1].sector)
   out.push({distance:points[i].distance,sector:points[i].sector,x:points[i].x,z:points[i].z});
 }
 return out;
}
const api={prepare,project,projectWorld,split,sectorBoundaries};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.FermaxoTrackMap=api;
})(typeof globalThis!=="undefined"?globalThis:this);
