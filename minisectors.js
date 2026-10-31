(function(root){
"use strict";
function cleanSamples(samples){
 return (Array.isArray(samples)?samples:[])
  .filter(s=>s&&Number.isFinite(Number(s.distance))&&Number.isFinite(Number(s.timeMs))&&Number(s.distance)>=0&&Number(s.timeMs)>=0)
  .map(s=>({distance:Number(s.distance),timeMs:Number(s.timeMs)}))
  .sort((a,b)=>a.distance-b.distance)
  .filter((s,i,a)=>i===0||s.distance>a[i-1].distance);
}
function boundaryTime(samples,distance,length,count,completedTime){
 if(distance===0){
  const first=samples[0];
  return first&&first.distance<=20&&first.timeMs<=1000?0:null;
 }
 if(distance>=length){
  const last=samples[samples.length-1],time=Number(completedTime);
  const maxDistance=Math.max(40,length/count*.12);
  return last&&Number.isFinite(time)&&time>last.timeMs&&time-last.timeMs<=2000&&length-last.distance<=maxDistance?time:null;
 }
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];
  if(a.distance<=distance&&b.distance>=distance&&b.distance>a.distance){
   const gapTime=b.timeMs-a.timeMs,gapDistance=b.distance-a.distance;
   const maxDistance=Math.max(100,length/count*2);
   if(gapTime<=0||gapTime>2000||gapDistance>maxDistance)return null;
   const ratio=(distance-a.distance)/gapDistance;
   return a.timeMs+gapTime*ratio;
  }
 }
 return null;
}
function calculateLap(samples,trackLength,count,completedTime){
 const length=Number(trackLength),n=Math.floor(Number(count)),points=cleanSamples(samples);
 if(!Number.isFinite(length)||length<=0||n<2||n>64)return {valid:false,count:n,samples:points,segments:[]};
 const times=[];
 for(let i=0;i<=n;i++)times.push(boundaryTime(points,length*i/n,length,n,completedTime));
 const segments=[];
 for(let i=0;i<n;i++){
  const a=times[i],b=times[i+1],duration=a==null||b==null||b<=a?null:b-a;
  segments.push({index:i+1,startTimeMs:a,endTimeMs:b,timeMs:duration});
 }
 return {valid:segments.some(s=>s.timeMs!=null),count:n,samples:points,segments};
}
function compare(current,reference,count){
 const n=Math.floor(Number(count)),a=calculateLap(current.samples,current.trackLength,n,current.completedTimeMs);
 const b=calculateLap(reference.samples,reference.trackLength,n,reference.timeMs);
 return {valid:a.valid&&b.valid,count:n,segments:a.segments.map((s,i)=>{
  const r=b.segments[i],ok=s.timeMs!=null&&r&&r.timeMs!=null;
  const delta=ok?s.timeMs-r.timeMs:null;
  return {index:i+1,timeMs:s.timeMs,referenceMs:r?r.timeMs:null,deltaMs:delta,gainMs:delta==null?null:-delta};
 })};
}
const api={cleanSamples,calculateLap,compare};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.FermaxoMiniSectors=api;
})(typeof globalThis!=="undefined"?globalThis:this);
