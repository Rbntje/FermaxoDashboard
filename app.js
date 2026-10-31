(() => {
"use strict";
const $=id=>document.getElementById(id),Mini=window.FermaxoMiniSectors;
const PAGES=["home","ers","timing","tyres","telemetry","race","engineer"];
const SESSIONS={1:"PRACTICE 1",2:"PRACTICE 2",3:"PRACTICE 3",4:"SHORT PRACTICE",5:"QUALIFYING 1",6:"QUALIFYING 2",7:"QUALIFYING 3",8:"SHORT QUALIFYING",9:"ONE SHOT QUALIFYING",10:"RACE",11:"SPRINT",12:"TIME TRIAL"};
const DRIVER={0:"GARAGE",1:"FLYING LAP",2:"IN LAP",3:"OUT LAP",4:"ON TRACK"};
const STATE={socket:null,page:"home",status:"waiting",data:null,source:"none",packets:0,lastPacket:0,retry:null,recording:false,frames:[],replayTimer:null,frameAt:0,laps:[],referenceId:"",miniCount:12,currentLap:null,currentLapSamples:[],currentLapIncomplete:false,captureUID:null,captureTrack:null,lastFrameAt:0,healthTimer:null};
function readStore(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}
function readString(key,fallback){try{return localStorage.getItem(key)||fallback}catch{return fallback}}
STATE.laps=readStore("fermaxoSavedLaps",[]);
STATE.referenceId=readString("fermaxoReferenceLap","");
STATE.miniCount=Number(readString("fermaxoMiniSectorCount","12"));
if(![8,12,16,24].includes(STATE.miniCount))STATE.miniCount=12;
let detailPage="",detailAt=0,miniCacheKey="",miniCache=null;
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function num(v,d=0,s=""){const n=Number(v);return v==null||!Number.isFinite(n)?"--":n.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})+s}
function lapTime(v){const n=Number(v);if(v==null||!Number.isFinite(n)||n<=0)return "--:--.---";return Math.floor(n/60000)+":"+String(Math.floor(n%60000/1000)).padStart(2,"0")+"."+String(Math.floor(n%1000).toString().padStart(3,"0"))}
function signedMs(v){const n=Number(v);return v==null||!Number.isFinite(n)?"--":(n>0?"+":"")+(n/1000).toFixed(3)+"s"}
function signedSeconds(v){const n=Number(v);return v==null||!Number.isFinite(n)?"--":(n>0?"+":"")+n.toFixed(3)+"s"}
function category(d){if(!d||!d.sessionType)return "standby";if(Number(d.resultStatus)===3||String(d.flag).toLowerCase()==="chequered")return "finished";const n=Number(d.sessionType);return n>=10&&n<=11?"race":n>=5&&n<=9?"qualifying":n>=1&&n<=4?"practice":n===12?"timeTrial":"standby"}
function liveData(d){return !!(d&&category(d)!=="standby"&&(category(d)==="finished"||[1,2,3,4].includes(Number(d.driverStatus)))&&STATE.status==="live")}
function val(v,s=""){return v==null||v===""?"--":esc(v)+s}
function setText(id,v){const e=$(id);if(e)e.textContent=v}
function setStatus(s,custom){STATE.status=s;setText("statusText",custom||({waiting:"WAITING FOR F1 TELEMETRY",connecting:"CONNECTING TO LOCAL BRIDGE",connected:"BRIDGE LINKED · WAITING FOR CAR DATA",live:"F1 2026 TELEMETRY LIVE",stale:"TELEMETRY LOST · RETRY",disconnected:"BRIDGE OFFLINE · RETRY",unsupported:"UNSUPPORTED TELEMETRY FORMAT"}[s]||s));setText("connectButton",s==="live"||s==="connected"?"RETRY":s==="connecting"?"LINKING":"CONNECT");$("statusLed").className=s}
function modeName(v){return ({0:"OFF",1:"MEDIUM",2:"HOTLAP",3:"OVERTAKE"})[Number(v)]||"--"}
function aeroName(d){if(!d||d.activeAeroMode==null||!d.regulations2026Applicable)return "--";if(!d.activeAeroAvailable)return "UNAVAILABLE";return Number(d.activeAeroMode)===1?"STRAIGHT LINE":"CORNERING"}
function flagInfo(d){if(!d||!d.flag)return null;const f=String(d.flag).toLowerCase(),m={yellow:["yellow","YELLOW FLAG"],doubleyellow:["double-yellow","DOUBLE YELLOW"],"double yellow":["double-yellow","DOUBLE YELLOW"],red:["red","RED FLAG"],blue:["blue","BLUE FLAG"],white:["white","WHITE FLAG"],green:["green","GREEN FLAG"],chequered:["green","CHEQUERED FLAG"]};return m[f]?{tone:m[f][0],title:m[f][1]}:{tone:"yellow",title:f.toUpperCase()}}
function eventFor(d){const f=flagInfo(d);if(f)return {tone:f.tone,title:f.title,detail:"RACE CONTROL · LIVE GAME DATA"};if(d.safetyCar==="VSC")return {tone:"vsc",title:"VIRTUAL SAFETY CAR",detail:"GAME DELTA "+signedSeconds(d.scDelta)+" · IN-GAME TARGET"};if(d.safetyCar==="SAFETY CAR")return {tone:"safety",title:"SAFETY CAR",detail:"GAME DELTA "+signedSeconds(d.scDelta)+" · GAP AHEAD "+signedMs(d.gapToCarAheadMs)};if(d.safetyCar==="FORMATION LAP")return {tone:"yellow",title:"FORMATION LAP",detail:"RACE CONTROL"};return null}
function currentTrack(d){return d&&d.trackId!=null?String(d.trackId):""}
function saveLaps(){try{localStorage.setItem("fermaxoSavedLaps",JSON.stringify(STATE.laps.slice(0,30)))}catch{setText("statusText","LAP STORAGE FULL · EXPORT LAPS")}}
function chooseDefaultReference(){const track=currentTrack(STATE.data),selected=STATE.laps.find(x=>x&&x.id===STATE.referenceId&&x.valid),compatible=STATE.laps.filter(x=>x&&x.valid&&x.trackLength>0&&(track===""||String(x.trackId)===track)).sort((a,b)=>a.timeMs-b.timeMs);if(!selected||(track!==""&&String(selected.trackId)!==track))STATE.referenceId=compatible[0]?compatible[0].id:"";try{localStorage.setItem("fermaxoReferenceLap",STATE.referenceId)}catch{}}
function referenceLap(){chooseDefaultReference();return STATE.laps.find(x=>x.id===STATE.referenceId&&x.valid)||null}
function personalBest(){const track=currentTrack(STATE.data);return STATE.laps.filter(x=>x&&x.valid&&x.timeMs>0&&(track===""||String(x.trackId)===track)).sort((a,b)=>a.timeMs-b.timeMs)[0]||null}
function captureLapSample(d,persist=true){
 const uid=d.sessionUID==null?"":String(d.sessionUID),track=currentTrack(d),lap=Number(d.lap);
 if(STATE.captureUID!==uid||STATE.captureTrack!==track){STATE.captureUID=uid;STATE.captureTrack=track;STATE.currentLap=lap;STATE.currentLapSamples=[];STATE.currentLapIncomplete=false}
 else if(STATE.currentLap!=null&&lap!==STATE.currentLap){
  const old=STATE.currentLapSamples,trackLength=Number(old[0]&&old[0].trackLength||d.trackLength),timeMs=Number(d.lastLapMs);
  const valid=!STATE.currentLapIncomplete&&old.length>=STATE.miniCount*2&&timeMs>0&&old.every(s=>!s.invalid)&&old.some(s=>s.driverStatus===1||s.driverStatus===4);
  if(persist&&valid&&trackLength>0){
   const sampleData=old.map(s=>({distance:s.distance,timeMs:s.timeMs}));
   const calc=Mini.calculateLap(sampleData,trackLength,STATE.miniCount,timeMs);
   if(calc.segments.length&&calc.segments.every(s=>s.timeMs!=null)){
    const saved={id:uid+":"+STATE.currentLap+":"+Date.now(),sessionUID:uid,trackId:old[0].trackId,trackLength,lapNumber:STATE.currentLap,timeMs,valid:true,samples:old.map(s=>({distance:s.distance,timeMs:s.timeMs,speed:s.speed,throttle:s.throttle,brake:s.brake,rpm:s.rpm,gear:s.gear,ersPercent:s.ersPercent})),miniCount:STATE.miniCount};
    STATE.laps.unshift(saved);STATE.laps=STATE.laps.slice(0,30);STATE.referenceId=saved.id;saveLaps();try{localStorage.setItem("fermaxoReferenceLap",STATE.referenceId)}catch{}
   }
  }
  STATE.currentLapSamples=[];STATE.currentLap=lap;STATE.currentLapIncomplete=false;
 }
 if(Number(d.miniSampleGap)>0){STATE.currentLapIncomplete=true;STATE.currentLapSamples=[]}
 const distance=Number(d.lapDistance),time=Number(d.currentLapMs),length=Number(d.trackLength);
 if(!Number.isFinite(distance)||distance<0||!Number.isFinite(time)||time<0||length<=0)return;
 const prev=STATE.currentLapSamples[STATE.currentLapSamples.length-1];
 if(prev&&distance<=prev.distance)return;
 STATE.currentLapSamples.push({distance,timeMs:time,trackLength:length,trackId:d.trackId,invalid:Number(d.currentLapInvalid)===1,speed:Number(d.speed),throttle:Number(d.throttle),brake:Number(d.brake),rpm:Number(d.rpm),gear:Number(d.gear),ersPercent:Number(d.ersPercent),driverStatus:Number(d.driverStatus)});
}
function referenceComparison(samples,completedTime){
 const ref=referenceLap(),d=STATE.data,count=STATE.miniCount;
 if(!Mini||!ref||!d||Number(ref.trackLength)!==Number(d.trackLength))return null;
 return Mini.compare({samples,trackLength:Number(d.trackLength),completedTimeMs:completedTime||null},ref,count)
}
function miniItems(){
 if(STATE.currentLapIncomplete)return null;
 const ref=referenceLap(),key=[STATE.captureUID,STATE.currentLap,STATE.currentLapSamples.length,STATE.miniCount,ref&&ref.id].join("|");
 if(key===miniCacheKey)return miniCache;
 const samples=STATE.currentLapSamples.map(s=>({distance:s.distance,timeMs:s.timeMs})),comparison=referenceComparison(samples,null);
 miniCacheKey=key;miniCache=comparison?comparison.segments:null;return miniCache
}
function renderMini(){
 const d=liveData(STATE.data)?STATE.data:null,ref=referenceLap(),kind=d?category(d):"standby",segments=d?miniItems():null,count=STATE.miniCount;
 setText("miniSectorTitle",kind==="qualifying"?"QUALIFYING · MINI DELTA":"MINI-SECTOR DELTA");
 setText("miniReferenceTitle",ref?"REF "+lapTime(ref.timeMs):"REFERENCE --");
 const host=$("miniStrip");if(!host)return;
 let html="";
 for(let i=0;i<count;i++){
  const s=segments&&segments[i],delta=s&&s.deltaMs;
  const cls=delta==null?"neutral":delta<0?"gain":delta>0?"loss":"neutral";
  const mark=delta==null?"--":(delta>0?"+":"")+Math.abs(delta/1000).toFixed(2);
  html+='<span class="mini-cell '+cls+'"><small>M'+String(i+1).padStart(2,"0")+'</small><b>'+mark+'</b></span>';
 }
 host.innerHTML=html;
}
function render(){
 const d=liveData(STATE.data)?STATE.data:null,kind=d?category(d):"standby";
 document.body.dataset.session=kind;
 document.body.dataset.raceControl=d&&d.safetyCar==="VSC"?"vsc":d&&d.safetyCar==="SAFETY CAR"?"safety":"";
 document.body.dataset.flag=d&&d.flag?String(d.flag).toLowerCase():"";
 setText("sessionLabel",d?(kind==="finished"?"FINISHED":SESSIONS[d.sessionType]||"SESSION"):"STANDBY");
 setText("topLap",d?num(d.lap):"--");setText("topPosition",d?num(d.position):"--");
 setText("sessionTypeValue",d?(SESSIONS[d.sessionType]||"SESSION"):"--");setText("lapValue",d?num(d.lap):"--");setText("positionValue",d?num(d.position):"--");
 setText("standbyLine",d?"":STATE.status==="stale"||STATE.status==="disconnected"||STATE.status==="unsupported"?"TELEMETRY UNAVAILABLE · CHECK LINK":"STANDBY · WAITING FOR SESSION");$("standbyLine").classList.toggle("hidden",!!d);
 setText("speedValue",d?num(d.speed):"--");setText("gearValue",d?Number(d.gear)===0?"N":Number(d.gear)<0?"R":num(d.gear):"N");
 setText("lapTime",d?lapTime(d.currentLapMs):"--:--.---");setText("deltaValue",d?signedMs(d.deltaMs):"--");setText("deltaLabel",kind==="qualifying"?"DELTA TO SESSION BEST":"DELTA");
 setText("lastLapValue",d?lapTime(d.lastLapMs):"--:--.---");const pb=personalBest(),bestLabel=document.querySelector(".lap-best span");setText("bestLapValue",pb?lapTime(pb.timeMs):d?lapTime(d.bestLapMs):"--:--.---");if(bestLabel)bestLabel.textContent=pb?"PERSONAL BEST":"SESSION BEST";
 setText("s1Value",d?lapTime(d.s1Ms):"--:--.---");setText("s2Value",d?lapTime(d.s2Ms):"--:--.---");setText("s3Value",d?lapTime(d.s3Ms):"--:--.---");
 setText("ersPercent",d?num(d.ersPercent,0,"%"):"--");setText("energyStore",d?num(d.energyKj,0):"--");setText("energyDeploy",d?num(d.energyUsedLapKj,0):"--");setText("energyHarvest",d?num(d.energyHarvestedLapKj,0):"--");
 const fill=$("ersFill");if(fill)fill.style.height=d&&Number.isFinite(Number(d.ersPercent))?Math.max(0,Math.min(100,Number(d.ersPercent)))+"%":"0%";
 setText("ersMode",d?modeName(d.ersMode):"--");setText("overtakeValue",d&&d.overtakeActive!=null?(d.overtakeActive?"ACTIVE":d.overtakeAvailable?"AVAILABLE":"OFF"):"--");
 setText("aeroValue",d?aeroName(d):"--");setText("drsValue",d&&d.drs?"OPEN":d&&d.drsAllowed?"CLOSED":d&&d.regulations2026Applicable?"NOT USED":"--");
 setText("throttleValue",d?num(d.throttle*100,0,"%"):"--");setText("brakeValue",d?num(d.brake*100,0,"%"):"--");
 const tb=$("throttleBar"),bb=$("brakeBar");if(tb)tb.style.width=d?Math.max(0,Math.min(100,Number(d.throttle)*100))+"%":"0%";if(bb)bb.style.width=d?Math.max(0,Math.min(100,Number(d.brake)*100))+"%":"0%";
 setText("safetyValue",d?(d.safetyCar||"CLEAR"):"--");setText("flagValue",d&&d.flag?String(d.flag).toUpperCase():"--");
 setText("penaltyValue",d&&d.penalties!=null?num(d.penalties,0,d.penalties?"s":""):"--");setText("driverStatusValue",d&&DRIVER[d.driverStatus]||"--");
 const leds=$("rpmLeds");leds.replaceChildren();if(d&&d.revLightsBits!=null){for(let i=0;i<15;i++){const e=document.createElement("i"),on=(Number(d.revLightsBits)&(1<<i))!==0;e.className=(on?"on ":"")+(i<9?"cyan":i<12?"amber":"red");leds.append(e)}}else if(d&&d.revLightsPercent!=null){for(let i=0;i<15;i++){const e=document.createElement("i"),on=i<Math.round(d.revLightsPercent/100*15);e.className=(on?"on ":"")+(i<9?"cyan":i<12?"amber":"red");leds.append(e)}}
 const ev=d&&eventFor(d),banner=$("eventBanner");banner.className="event-banner"+(ev?" "+ev.tone:" hidden");setText("eventTitle",ev?ev.title:"");setText("eventDetail",ev?ev.detail:"");
 setText("packetInfo",STATE.packets+" RX");setText("sourceInfo",STATE.source==="replay"?"RECORDED REPLAY":"F1 UDP · 2026");setText("ageInfo",STATE.lastPacket?((Date.now()-STATE.lastPacket)/1000).toFixed(1)+"s":"--");
 document.querySelectorAll(".page-button").forEach(b=>b.classList.toggle("selected",b.dataset.page===STATE.page));
 $("homePage").classList.toggle("active",STATE.page==="home");$("detailPage").classList.toggle("active",STATE.page!=="home");
 renderMini();
 if(STATE.page!=="home"&&(detailPage!==STATE.page||Date.now()-detailAt>700)){renderDetail(STATE.page,d);detailPage=STATE.page;detailAt=Date.now()}
}
function row(label,value,unit=""){return '<div class="detail-row"><span>'+esc(label)+'</span><b>'+val(value,unit)+'</b></div>'}
function miniTable(d){
 const ref=referenceLap(),current=STATE.currentLapSamples.map(s=>({distance:s.distance,timeMs:s.timeMs})),comparison=d&&ref?referenceComparison(current,null):null;
 if(!comparison)return '<p class="detail-note">MINI-SECTOR COMPARISON UNAVAILABLE · NEEDS A COMPLETE RECORDED REFERENCE LAP</p>';
 return '<div class="mini-history"><div class="mini-history-head"><span>MINI</span><span>LIVE / LAST</span><span>REFERENCE</span><span>DELTA</span></div>'+comparison.segments.map(s=>'<div class="mini-history-row"><span>M'+String(s.index).padStart(2,"0")+'</span><span>'+ (s.timeMs==null?"--":(s.timeMs/1000).toFixed(3)+"s")+'</span><span>'+(s.referenceMs==null?"--":(s.referenceMs/1000).toFixed(3)+"s")+'</span><b class="'+(s.deltaMs==null?"neutral":s.deltaMs<0?"gain":"loss")+'">'+(s.deltaMs==null?"--":signedMs(s.deltaMs))+'</b></div>').join("")+'</div>';
}
function refOptions(){
 chooseDefaultReference();return '<option value="">NO REFERENCE LAP</option>'+STATE.laps.filter(x=>x&&x.valid).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===STATE.referenceId?"selected":"")+'>'+esc("T"+x.trackId+" · LAP "+x.lapNumber+" · "+lapTime(x.timeMs))+'</option>').join("");
}
function recordedData(){return STATE.frames.slice(-48).map(f=>f.data).filter(Boolean)}
function graph(name,key,scale){
 const list=recordedData().slice(-48),values=list.map(d=>Number(d[key])).filter(Number.isFinite);
 if(!values.length)return '<div class="graph-row"><span>'+name+'</span><small>NO RECORDED SAMPLES</small></div>';
 const max=scale||Math.max(1,...values.map(Math.abs));
 return '<div class="graph-row"><span>'+name+'</span><div>'+values.map(v=>'<i style="height:'+Math.max(2,Math.min(100,Math.abs(v)/max*100))+'%"></i>').join("")+'</div><b>'+num(values[values.length-1],0)+'</b></div>';
}
function referenceSampleAt(distance,ref){
 if(!ref||!Array.isArray(ref.samples))return null;let best=null,diff=Infinity;
 for(const s of ref.samples){const n=Math.abs(Number(s.distance)-distance);if(n<diff){diff=n;best=s}}
 return best&&diff<=Math.max(40,ref.trackLength/STATE.miniCount)?best:null;
}
function renderDetail(page,d){
 const root=$("detailPage");let h='<header class="detail-heading"><span>FERMAXO RACING / LIVE ENGINEERING</span><b>'+({ers:"ERS SYSTEM",timing:"LAP & MINI-SECTOR TIMING",tyres:"TYRE ENGINEERING",telemetry:"TELEMETRY ANALYSIS",race:"RACE CONTROL",engineer:"RACE ENGINEER"}[page]||"DETAIL")+'</b></header>';
 if(page==="ers"){
  h+='<div class="detail-grid">'+row("BATTERY",d?num(d.ersPercent,1,"%"):"--")+row("ENERGY STORE",d?num(d.energyKj,1," kJ"):"--")+row("DEPLOYED THIS LAP",d?num(d.energyUsedLapKj,1," kJ"):"--")+row("HARVESTED THIS LAP",d?num(d.energyHarvestedLapKj,1," kJ"):"--")+row("DEPLOYMENT MODE",d?modeName(d.ersMode):"--")+row("OVERTAKE MODE",d&&d.overtakeActive!=null?(d.overtakeActive?"ACTIVE":d.overtakeAvailable?"AVAILABLE":"OFF"):"--")+row("ACTIVE AERO",d?aeroName(d):"--")+'</div>';
  const vals=recordedData().slice(-22).map(x=>Number(x.ersPercent)).filter(Number.isFinite);
  h+='<section class="energy-trace"><b>RECORDED BATTERY TRACE</b><div>'+vals.map(v=>'<i title="'+v.toFixed(1)+'%" style="height:'+Math.max(2,Math.min(100,v))+'%"></i>').join("")+'</div><small>'+(vals.length?vals.length+" CAPTURED SAMPLES":"NO RECORDED SAMPLES · START REC IN TIMING")+'</small></section>';
 }
 if(page==="timing"){
  h+='<div class="detail-tools"><button id="recordButton">'+(STATE.recording?"STOP REC":"START REC")+'</button><button id="saveSessionButton">SAVE JSON</button><button id="saveCsvButton">EXPORT CSV</button><button id="saveLapsButton">EXPORT LAPS</button><button id="loadLapsButton">LOAD FILE</button><span>'+STATE.frames.length+' SAMPLES</span></div>';
  h+='<label class="reference-control">REFERENCE LAP <select id="referenceSelect">'+refOptions()+'</select></label>';
  h+='<div class="detail-grid timing-summary">'+row("CURRENT",d?lapTime(d.currentLapMs):"--")+row("LAST",d?lapTime(d.lastLapMs):"--")+row("SESSION BEST",d?lapTime(d.bestLapMs):"--")+row("DELTA TO BEST",d?signedMs(d.deltaMs):"--")+row("S1",d?lapTime(d.s1Ms):"--")+row("S2",d?lapTime(d.s2Ms):"--")+row("S3",d?lapTime(d.s3Ms):"--")+'</div>';
  h+=miniTable(d);
  const history=d&&Array.isArray(d.lapHistory)?d.lapHistory:[];
  h+='<div class="lap-table"><div class="table-head"><span>LAP</span><span>TIME</span><span>S1</span><span>S2</span><span>S3</span></div>'+history.slice(-5).reverse().map(x=>'<div class="table-row"><span>'+val(x.lap)+'</span><span>'+lapTime(x.time)+'</span><span>'+lapTime(x.s1)+'</span><span>'+lapTime(x.s2)+'</span><span>'+lapTime(x.s3)+'</span></div>').join("")+'</div>';
  const ref=referenceLap(),savedRows=STATE.laps.slice(0,6).map(lap=>{const result=ref?Mini.compare(lap,ref,STATE.miniCount):null,valid=result&&result.segments.filter(s=>s.deltaMs!=null),largest=valid&&valid.length?valid.slice().sort((a,b)=>Math.abs(b.deltaMs)-Math.abs(a.deltaMs))[0]:null,overall=ref?lap.timeMs-ref.timeMs:null;return '<button class="saved-lap-button" data-ref-id="'+esc(lap.id)+'"><span>TRACK '+esc(lap.trackId)+' · LAP '+esc(lap.lapNumber)+'</span><b>'+lapTime(lap.timeMs)+'</b><small>'+(overall==null?"OVERALL --":'OVERALL '+signedMs(overall))+(largest?' · M'+String(largest.index).padStart(2,"0")+' '+signedMs(largest.deltaMs):'')+'</small></button>'}).join("");
  h+='<div class="saved-lap-history"><b>SAVED MINI-SECTOR HISTORY · TAP A LAP TO SET REFERENCE</b><div>'+ (savedRows||'<small>NO COMPLETE VALID LAPS SAVED</small>') +'</div></div>';
  h+='<p class="detail-note">MINI-SECTORS ARE CALCULATED FROM RECEIVED LAP-DISTANCE / LAP-TIME SAMPLES, NOT GAME-PROVIDED SECTORS.</p>';
 }
 if(page==="tyres"){
  const order=[2,3,0,1],names=["FL","FR","RL","RR"],wear=d&&d.tyreWear||[],surface=d&&d.tyreSurfaceTempC||[],inner=d&&d.tyreInnerTempC||[],pressure=d&&d.tyrePressurePsi||[],actual=d&&d.actualTyreCompound,visual=d&&d.visualTyreCompound;
  const compound=actual!=null?({16:"C5",17:"C4",18:"C3",19:"C2",20:"C1",21:"C0",22:"C6",7:"INTER",8:"WET"})[actual]||"COMPOUND "+actual:"--";
  h+='<div class="detail-grid tyre-summary">'+row("ACTUAL COMPOUND",compound)+row("VISUAL COMPOUND",visual!=null?({16:"SOFT",17:"MEDIUM",18:"HARD",7:"INTER",8:"WET"})[visual]||"COMPOUND "+visual:"--")+row("TYRE SET AGE",d?num(d.tyreAgeLaps,0," laps"):"--")+'</div>';
  h+='<div class="tyre-grid">'+order.map((idx,i)=>'<section class="tyre-cell"><b>'+names[i]+'</b><span>WEAR <strong>'+val(wear[idx],"%")+'</strong></span><span>SURFACE <strong>'+val(surface[idx]," °C")+'</strong></span><span>INNER <strong>'+val(inner[idx]," °C")+'</strong></span><span>PRESSURE <strong>'+val(pressure[idx]," psi")+'</strong></span></section>').join("")+'</div>';
 }
 if(page==="telemetry"){
  const ref=referenceLap(),sample=d&&ref&&d.lapDistance!=null?referenceSampleAt(Number(d.lapDistance),ref):null;
  h+='<div class="detail-tools"><button id="recordButton">'+(STATE.recording?"STOP REC":"START REC")+'</button><span>ONLY CAPTURED LIVE SAMPLES ARE PLOTTED</span></div>';
  h+='<div class="graph-stack">'+graph("SPEED km/h","speed",360)+graph("THROTTLE %","throttle",1)+graph("BRAKE %","brake",1)+graph("ENGINE RPM","rpm",15000)+graph("GEAR","gear",8)+'</div>';
  h+='<div class="detail-grid">'+row("CURRENT LAP",d?lapTime(d.currentLapMs):"--")+row("REFERENCE LAP",ref?lapTime(ref.timeMs):"--")+row("SPEED VS REF",d&&sample&&sample.speed!=null?num(Number(d.speed)-Number(sample.speed),0," km/h"):"--")+row("THROTTLE VS REF",d&&sample&&sample.throttle!=null?num((Number(d.throttle)-Number(sample.throttle))*100,0," %"):"--")+row("BRAKE VS REF",d&&sample&&sample.brake!=null?num((Number(d.brake)-Number(sample.brake))*100,0," %"):"--")+'</div>';
 }
 if(page==="race"){
  h+='<div class="detail-grid">'+row("SESSION",d?category(d)==="finished"?"FINISHED":SESSIONS[d.sessionType]||"SESSION":"--")+row("POSITION",d?num(d.position):"--")+row("LAP",d?num(d.lap)+" / "+num(d.totalLaps):"--")+row("GAP AHEAD",d?signedMs(d.gapToCarAheadMs):"--")+row("GAP TO LEADER",d?signedMs(d.gapToLeaderMs):"--")+row("GAME SC DELTA",d?signedSeconds(d.scDelta):"--")+row("RACE CONTROL",d?d.safetyCar||"CLEAR":"--")+row("PIT STATUS",d?({0:"NOT IN PIT",1:"PITTING",2:"PIT LANE"})[d.pitStatus]||"--":"--")+row("PIT STOPS",d?num(d.numPitStops):"--")+row("PIT-LANE TIME",d&&d.pitLaneTimerActive?num(d.pitLaneTimeMs/1000,1," s"):"--")+row("PENALTY TIME",d?num(d.penalties,0," s"):"--")+row("DRIVE-THROUGH LEFT",d?num(d.unservedDriveThrough):"--")+row("STOP-GO LEFT",d?num(d.unservedStopGo):"--")+row("WARNINGS",d?num(d.totalWarnings):"--")+row("FUEL",d?num(d.fuelKg,1," kg"):"--")+row("FUEL REMAINING",d?num(d.fuelRemainingLaps,1," laps"):"--")+'</div>';
 }
 if(page==="engineer"){
  const comp=miniItems(),loss=comp?comp.filter(s=>s.deltaMs!=null).sort((a,b)=>b.deltaMs-a.deltaMs)[0]:null,ref=referenceLap(),sample=d&&ref&&d.lapDistance!=null?referenceSampleAt(Number(d.lapDistance),ref):null;
  h+='<div class="detail-grid">'+row("CURRENT DELTA",d?signedMs(d.deltaMs):"--")+row("REFERENCE",ref?lapTime(ref.timeMs):"--")+row("CURRENT SPEED",d?num(d.speed,0," km/h"):"--")+row("REFERENCE SPEED",sample?num(sample.speed,0," km/h"):"--")+row("CURRENT THROTTLE",d?num(d.throttle*100,0,"%"):"--")+row("REFERENCE THROTTLE",sample&&sample.throttle!=null?num(sample.throttle*100,0,"%"):"--")+row("CURRENT BRAKE",d?num(d.brake*100,0,"%"):"--")+row("REFERENCE BRAKE",sample&&sample.brake!=null?num(sample.brake*100,0,"%"):"--")+'</div>';
  h+=loss&&loss.deltaMs>0?'<p class="engineer-note">CALCULATED TIME LOSS: MINI-SECTOR '+String(loss.index).padStart(2,"0")+' · '+signedMs(loss.deltaMs)+' VS SELECTED REFERENCE. REVIEW THE SAMPLED SPEED / BRAKE / THROTTLE TRACE IN THIS SECTION.</p>':'<p class="engineer-note">NO MEASURED MINI-SECTOR TIME LOSS AVAILABLE. ENGINEER ADVICE REQUIRES A VALID SAVED REFERENCE LAP; NO GENERAL SPEED OR TYRE THRESHOLD IS ASSUMED.</p>';
 }
 root.innerHTML=h;
 const rec=$("recordButton");if(rec)rec.onclick=toggleRecording;
 const save=$("saveSessionButton");if(save)save.onclick=exportSessionJson;
 const csv=$("saveCsvButton");if(csv)csv.onclick=exportCsv;
 const laps=$("saveLapsButton");if(laps)laps.onclick=exportLaps;
 const load=$("loadLapsButton");if(load)load.onclick=()=>$("loadFile").click();
 const refSel=$("referenceSelect");if(refSel)refSel.onchange=e=>{STATE.referenceId=e.target.value;try{localStorage.setItem("fermaxoReferenceLap",STATE.referenceId)}catch{}renderedDetail="";render()};
 root.querySelectorAll(".saved-lap-button").forEach(button=>button.onclick=()=>{STATE.referenceId=button.dataset.refId;try{localStorage.setItem("fermaxoReferenceLap",STATE.referenceId)}catch{}detailPage="";render()});
}
function toggleRecording(){STATE.recording=!STATE.recording;if(STATE.recording){STATE.recordingLimitReached=false;STATE.frames=[];STATE.lastFrameAt=0}renderedDetail="";render()}
function recordFrame(d){
 const now=Date.now(),pid=Number(d.sourcePacketId);
 if(!STATE.recording)return;
 if(pid===2||pid===6&&now-STATE.lastFrameAt>=100){STATE.frames.push({at:now,data:{...d}});STATE.lastFrameAt=now}
 if(STATE.frames.length>=60000){STATE.recording=false;STATE.recordingLimitReached=true}
}
function receive(d){
 if(d.format!==2026||d.packetVersion!==1||d.packetId!==6||d.speed==null||d.rpm==null){STATE.data=null;setStatus("unsupported");render();return}
 STATE.data=d;STATE.lastPacket=Date.now();STATE.packets++;STATE.status="live";
 if(Number(d.sourcePacketId)===2&&liveData({ ...d })){captureLapSample(d)}else if(Number(d.sourcePacketId)===2&&Number(d.driverStatus)===0){STATE.currentLapSamples=[];STATE.currentLapIncomplete=false;STATE.currentLap=Number(d.lap);STATE.captureUID=String(d.sessionUID||"");STATE.captureTrack=currentTrack(d)}
 recordFrame(d);setStatus("live",STATE.recordingLimitReached?"RECORDING LIMIT · EXPORT SESSION":null);render()
}
function startReplay(frames){
 if(STATE.socket){STATE.socket.onclose=null;STATE.socket.close();STATE.socket=null}
 clearTimeout(STATE.retry);clearTimeout(STATE.replayTimer);STATE.source="replay";STATE.recording=false;let i=0,lastAt=null;
 STATE.currentLapSamples=[];STATE.currentLapIncomplete=false;STATE.currentLap=null;STATE.captureUID=null;const step=()=>{if(i>=frames.length){setStatus("live","REPLAY COMPLETE · RECORDED DATA");return}
  const f=frames[i++],next=f.data||f;STATE.data=next;STATE.lastPacket=Date.now();STATE.packets++;STATE.status="live";if(Number(next.sourcePacketId)===2&&liveData({...next}))captureLapSample(next,false);render();
  const t=Number(f.at),delay=lastAt==null?80:Math.max(20,Math.min(500,t-lastAt));lastAt=Number.isFinite(t)?t:lastAt;STATE.replayTimer=setTimeout(step,delay)
 };
 step()
}
function connect(){
 clearTimeout(STATE.retry);clearTimeout(STATE.replayTimer);STATE.replayTimer=null;
 const address=$("bridgeUrl").value.trim();if(!address)return;
 if(STATE.socket){STATE.socket.onclose=null;STATE.socket.close();STATE.socket=null}
 STATE.source="live";STATE.data=null;STATE.lastPacket=0;STATE.captureUID=null;STATE.currentLap=null;STATE.currentLapSamples=[];STATE.currentLapIncomplete=false;setStatus("connecting");render();
 try{const ws=new WebSocket(address);STATE.socket=ws;
  ws.onopen=()=>{if(STATE.socket===ws){setStatus("connected");try{localStorage.setItem("fermaxoBridgeUrl",address)}catch{}render()}};
  ws.onmessage=e=>{try{const m=JSON.parse(e.data);receive(m.data||m)}catch{setStatus("disconnected","INVALID BRIDGE MESSAGE");render()}};
  ws.onerror=()=>{if(STATE.socket===ws){setStatus("disconnected","BRIDGE ERROR · CHECK ADDRESS / FIREWALL");render()}};
  ws.onclose=()=>{if(STATE.socket===ws){STATE.socket=null;if(STATE.source==="live"){STATE.data=null;setStatus("disconnected");render();STATE.retry=setTimeout(connect,5000)}}}
 }catch{STATE.data=null;setStatus("disconnected","INVALID BRIDGE ADDRESS");render()}
}
function download(name,content,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportSessionJson(){download("fermaxo-session.json",JSON.stringify({format:"fermaxo-session-v2",createdAt:new Date().toISOString(),frames:STATE.frames,laps:STATE.laps},null,2),"application/json")}
function exportLaps(){download("fermaxo-laps.json",JSON.stringify({format:"fermaxo-laps-v1",laps:STATE.laps},null,2),"application/json")}
function exportCsv(){
 const headers=["receivedAt","sessionType","lap","lapDistance","currentLapMs","speed","rpm","gear","throttle","brake","ersPercent","energyKj","energyUsedLapKj","energyHarvestedLapKj","activeAeroMode","overtakeActive","drs","scDelta","flag","safetyCar"];
 const lines=[headers.join(",")];for(const f of STATE.frames){const d=f.data||{};lines.push(headers.map(k=>{const v=k==="receivedAt"?f.at:d[k];return v==null?"":'"'+String(v).replace(/"/g,'""')+'"'}).join(","))}
 download("fermaxo-telemetry.csv",lines.join("\r\n"),"text/csv")
}
function importFile(file){
 const rd=new FileReader();rd.onload=()=>{try{const parsed=JSON.parse(rd.result);if(Array.isArray(parsed.laps)){const add=parsed.laps.filter(x=>x&&x.valid&&Array.isArray(x.samples));STATE.laps=[...add,...STATE.laps].slice(0,30);saveLaps();STATE.referenceId=STATE.laps[0]?STATE.laps[0].id:"";chooseDefaultReference();render()}
  const frames=Array.isArray(parsed)?parsed:parsed.frames;if(Array.isArray(frames)&&frames.length){STATE.frames=frames;startReplay(frames)}
 }catch{setText("statusText","INVALID JSON FILE")}};rd.readAsText(file)
}
async function pollHealth(){
 try{if(location.protocol!=="http:"&&location.protocol!=="https:")return;const response=await fetch("/health",{cache:"no-store"});if(!response.ok)throw Error("health");const h=await response.json();
  setText("udpListenInfo",String(h.udpHost||"--")+":"+String(h.udpPort||"--"));setText("formatInfo",h.format?"F1 "+h.format:"--");
  setText("bridgePacketInfo",num(h.validPackets));setText("invalidPacketInfo",num(h.invalidPackets));
  setText("udpState",h.udpError?"ERROR · "+h.udpError:!h.udpReady?"STARTING":h.lastPacketAge==null?"LISTENING · NO PACKETS":h.lastPacketAge>2.5?"NO RECENT PACKETS":"RECEIVING");
  const phone=h.phoneUrl||location.origin+"/";setText("phoneUrlValue",phone)
 }catch{setText("udpListenInfo","BRIDGE UNAVAILABLE");setText("udpState","BRIDGE OFFLINE");setText("formatInfo","--");setText("bridgePacketInfo","--");setText("invalidPacketInfo","--")}
}
function go(page){if(!PAGES.includes(page))return;STATE.page=page;detailPage="";render()}
document.querySelectorAll(".page-button").forEach(b=>b.onclick=()=>go(b.dataset.page));
$("connectButton").onclick=connect;
$("settingsButton").onclick=()=>{$("settingsPanel").classList.toggle("hidden");pollHealth()};
$("saveSettingsButton").onclick=()=>{connect();$("settingsPanel").classList.add("hidden")};
$("bridgeUrl").addEventListener("keydown",e=>{if(e.key==="Enter")$("saveSettingsButton").click()});
$("miniSectorCount").value=String(STATE.miniCount);$("miniSectorCount").onchange=e=>{STATE.miniCount=Number(e.target.value);try{localStorage.setItem("fermaxoMiniSectorCount",STATE.miniCount)}catch{}renderedDetail="";render()};
$("fullscreenButton").onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()};
$("copyPhoneUrl").onclick=async()=>{const text=$("phoneUrlValue").textContent;if(!text||text==="--")return;try{await navigator.clipboard.writeText(text);setText("settingsHelp","PHONE URL COPIED")}catch{setText("settingsHelp",text)}};
$("loadFile").onchange=e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value=""};
const stored=readString("fermaxoBridgeUrl","");if(stored)$("bridgeUrl").value=stored;else if(location.hostname&&location.protocol!=="file:")$("bridgeUrl").value="ws://"+location.hostname+":20778";
setInterval(()=>{if(STATE.source==="live"&&STATE.lastPacket&&Date.now()-STATE.lastPacket>2500&&STATE.status==="live"){STATE.data=null;setStatus("stale");render()}},500);
STATE.healthTimer=setInterval(pollHealth,2500);pollHealth();render();STATE.retry=setTimeout(connect,250);
})();