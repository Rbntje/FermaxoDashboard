(() => {
"use strict";
const $=id=>document.getElementById(id);
const state={socket:null,page:"home",status:"waiting",data:null,source:"none",packets:0,lastPacket:0,retry:null,recording:false,frames:[],replay:null};
const pages=["home","ers","timing","tyres","telemetry","race","engineer"];
const sessions={1:"PRACTICE 1",2:"PRACTICE 2",3:"PRACTICE 3",4:"SHORT PRACTICE",5:"QUALIFYING 1",6:"QUALIFYING 2",7:"QUALIFYING 3",8:"SHORT QUALIFYING",9:"ONE SHOT QUALIFYING",10:"RACE",11:"SPRINT",12:"TIME TRIAL"};
const driverStates={0:"GARAGE",1:"FLYING LAP",2:"IN LAP",3:"OUT LAP",4:"ON TRACK"};
const statusLabels={waiting:"WAITING FOR F1 TELEMETRY",connecting:"CONNECTING TO BRIDGE",connected:"BRIDGE CONNECTED · WAITING FOR CAR DATA",live:"F1 TELEMETRY LIVE",stale:"TELEMETRY LOST · RETRY",disconnected:"BRIDGE OFFLINE · RETRY",unsupported:"INCOMPATIBLE F1 PACKET"};
let renderedDetail="",lastDetail=0;
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function num(v,d=0,suffix=""){const n=Number(v);return v==null||!Number.isFinite(n)?"--":n.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})+suffix}
function msTime(v){const n=Number(v);if(v==null||!Number.isFinite(n)||n<=0)return "--:--.---";return Math.floor(n/60000)+":"+String(Math.floor(n%60000/1000)).padStart(2,"0")+"."+String(Math.floor(n%1000).toString().padStart(3,"0"))}
function signedMs(v){const n=Number(v);return v==null||!Number.isFinite(n)?"--":(n>0?"+":"")+(n/1000).toFixed(3)+"s"}
function signedSeconds(v){const n=Number(v);return v==null||!Number.isFinite(n)?"--":(n>0?"+":"")+n.toFixed(3)+"s"}
function category(d){if(!d||!d.sessionType)return "standby";const n=Number(d.sessionType);return n>=10&&n<=11?"race":n>=5&&n<=9?"qualifying":n>=1&&n<=4?"practice":n===12?"timeTrial":"standby"}
function inSession(d){return !!(d&&category(d)!=="standby"&&d.driverStatus!=null&&Number(d.driverStatus)!==0&&state.status==="live")}
function setText(id,v){const e=$(id);if(e)e.textContent=v}
function width(id,v){const e=$(id),n=Number(v);if(e)e.style.height=Number.isFinite(n)?Math.max(0,Math.min(100,n))+"%":"0%"}
function setStatus(s){state.status=s;setText("statusText",statusLabels[s]||s);$("statusLed").className=s;setText("connectButton",s==="live"||s==="connected"?"RETRY":s==="connecting"?"LINKING":"CONNECT")}
function modeName(v){return ({0:"OFF",1:"MEDIUM",2:"HOTLAP",3:"OVERTAKE"})[Number(v)]||"--"}
function aeroName(d){if(!d||d.activeAeroMode==null||!d.regulations2026Applicable)return "--";if(!d.activeAeroAvailable)return "UNAVAILABLE";return Number(d.activeAeroMode)===1?"STRAIGHT LINE":"CORNERING"}
function flagInfo(d){
 if(!d||!d.flag)return null;
 const raw=String(d.flag).toLowerCase(),map={yellow:["yellow","YELLOW FLAG"],doubleyellow:["double-yellow","DOUBLE YELLOW"],"double yellow":["double-yellow","DOUBLE YELLOW"],red:["red","RED FLAG"],blue:["blue","BLUE FLAG"],green:["green","GREEN FLAG"],chequered:["green","CHEQUERED FLAG"]};
 const v=map[raw];return v?{tone:v[0],title:v[1]}:{tone:"yellow",title:raw.toUpperCase()}
}
function eventFor(d){
 const f=flagInfo(d);if(f)return {tone:f.tone,title:f.title,detail:"RACE CONTROL · LIVE GAME DATA"};
 if(d.safetyCar==="VSC")return {tone:"vsc",title:"VIRTUAL SAFETY CAR",detail:"GAME DELTA "+signedSeconds(d.scDelta)+" · FOLLOW IN-GAME TARGET"};
 if(d.safetyCar==="SAFETY CAR")return {tone:"safety",title:"SAFETY CAR",detail:"GAME DELTA "+signedSeconds(d.scDelta)+" · LIVE POSITION "+num(d.position)};
 if(d.safetyCar==="FORMATION LAP")return {tone:"yellow",title:"FORMATION LAP",detail:"RACE CONTROL"};
 return null
}
function render(){
 const d=inSession(state.data)?state.data:null,kind=d?category(d):"standby";
 document.body.dataset.session=kind;
 document.body.dataset.raceControl=d&&d.safetyCar==="VSC"?"vsc":d&&d.safetyCar==="SAFETY CAR"?"safety":"";
 document.body.dataset.flag=d&&d.flag?String(d.flag).toLowerCase():"";
 setText("sessionLabel",d?(sessions[d.sessionType]||"SESSION"):"STANDBY");
 setText("topLap",d?num(d.lap):"--");setText("topPosition",d?num(d.position):"--");
 setText("standbyLine",d?"":state.status==="stale"||state.status==="disconnected"||state.status==="unsupported"?"TELEMETRY UNAVAILABLE · CHECK LINK":"STANDBY · WAITING FOR SESSION");
 $("standbyLine").classList.toggle("hidden",!!d);
 setText("sessionTypeValue",d?(sessions[d.sessionType]||"SESSION"):"--");
 setText("lapValue",d?num(d.lap):"--");setText("positionValue",d?num(d.position):"--");
 setText("speedValue",d?num(d.speed):"--");
 setText("gearValue",d?Number(d.gear)===0?"N":Number(d.gear)<0?"R":num(d.gear):"N");
 setText("lapTime",d?msTime(d.currentLapMs):"--:--.---");
 setText("deltaValue",d?signedMs(d.deltaMs):"--");setText("deltaLabel",kind==="qualifying"?"DELTA TO SESSION BEST":"DELTA");
 setText("lastLapValue",d?msTime(d.lastLapMs):"--:--.---");setText("bestLapValue",d?msTime(d.bestLapMs):"--:--.---");
 setText("s1Value",d?msTime(d.s1Ms):"--:--.---");setText("s2Value",d?msTime(d.s2Ms):"--:--.---");setText("s3Value",d?msTime(d.s3Ms):"--:--.---");
 setText("ersPercent",d?num(d.ersPercent,0,"%"):"--");setText("energyStore",d?num(d.energyKj,0):"--");setText("energyDeploy",d?num(d.energyUsedLapKj,0):"--");setText("energyHarvest",d?num(d.energyHarvestedLapKj,0):"--");width("ersFill",d?d.ersPercent:null);
 setText("ersMode",d?modeName(d.ersMode):"--");setText("overtakeValue",d&&d.overtakeActive!=null?(d.overtakeActive?"ACTIVE":d.overtakeAvailable?"AVAILABLE":"OFF"):"--");
 setText("aeroLabel",d&&d.regulations2026Applicable?"ACTIVE AERO":"ACTIVE AERO");setText("aeroValue",aeroName(d));setText("drsValue",d&&d.drs? "OPEN":d&&d.drsAllowed?"CLOSED":d&&d.regulations2026Applicable?"NOT USED":"--");
 setText("throttleValue",d?num(d.throttle*100,0,"%"):"--");setText("brakeValue",d?num(d.brake*100,0,"%"):"--");
 const tb=$("throttleBar"),bb=$("brakeBar");if(tb)tb.style.width=d?Math.max(0,Math.min(100,Number(d.throttle)*100))+"%":"0%";if(bb)bb.style.width=d?Math.max(0,Math.min(100,Number(d.brake)*100))+"%":"0%";
 setText("safetyValue",d?(d.safetyCar||"CLEAR"):"--");setText("flagValue",d&&d.flag?String(d.flag).toUpperCase():"--");
 setText("penaltyValue",d&&d.penalties!=null?num(d.penalties,d.penalties?0:0,d.penalties?"s":""):"--");setText("driverStatusValue",d&&driverStates[d.driverStatus]||"--");
 const leds=$("rpmLeds");leds.replaceChildren();if(d&&d.revLightsBits!=null){for(let i=0;i<15;i++){const led=document.createElement("i");const on=(Number(d.revLightsBits)&(1<<i))!==0;led.className=(on?"on ":"")+(i<9?"cyan":i<12?"amber":"red");leds.append(led)}}else if(d&&d.revLightsPercent!=null){for(let i=0;i<15;i++){const led=document.createElement("i"),on=i<Math.round(d.revLightsPercent/100*15);led.className=(on?"on ":"")+(i<9?"cyan":i<12?"amber":"red");leds.append(led)}}
 const ev=d&&eventFor(d),banner=$("eventBanner");banner.className="event-banner"+(ev?" "+ev.tone:" hidden");setText("eventTitle",ev?ev.title:"");setText("eventDetail",ev?ev.detail:"");
 setText("packetInfo",state.packets+" PACKETS");setText("sourceInfo",state.source==="replay"?"RECORDED TELEMETRY":state.source==="live"?"F1 UDP · 2026":"F1 UDP · 2026");setText("ageInfo",state.lastPacket?((Date.now()-state.lastPacket)/1000).toFixed(1)+"s":"--");
 document.querySelectorAll(".page-button").forEach(b=>b.classList.toggle("selected",b.dataset.page===state.page));
 $("homePage").classList.toggle("active",state.page==="home");$("detailPage").classList.toggle("active",state.page!=="home");
 if(state.page!=="home"&&(renderedDetail!==state.page||Date.now()-lastDetail>700)){renderDetail(state.page,d);renderedDetail=state.page;lastDetail=Date.now()}
}
function value(v,suffix=""){return v==null||v===""?"--":esc(v)+suffix}
function row(label,v,unit=""){return '<div class="detail-row"><span>'+esc(label)+'</span><b>'+value(v,unit)+'</b></div>'}
function renderDetail(page,d){
 const root=$("detailPage"),head={ers:"ERS SYSTEM",timing:"LAP TIMING",tyres:"TYRE ENGINEERING",telemetry:"LIVE TELEMETRY",race:"RACE CONTROL",engineer:"ENGINEER"}[page]||"DETAIL";
 let h='<header class="detail-heading"><span>FERMAXO RACING / TELEMETRY</span><b>'+head+'</b></header>';
 if(page==="ers"){
   h+='<div class="detail-grid">'+row("BATTERY",d?num(d.ersPercent,1,"%"):"--")+row("ENERGY STORE",d?num(d.energyKj,1," kJ"):"--")+row("DEPLOYED THIS LAP",d?num(d.energyUsedLapKj,1," kJ"):"--")+row("HARVESTED THIS LAP",d?num(d.energyHarvestedLapKj,1," kJ"):"--")+row("DEPLOYMENT MODE",d?modeName(d.ersMode):"--")+row("OVERTAKE MODE",d&&d.overtakeActive!=null?(d.overtakeActive?"ACTIVE":d.overtakeAvailable?"AVAILABLE":"OFF"):"--")+row("ACTIVE AERO",d?aeroName(d):"--")+'</div>';
 }
 if(page==="timing"){
   const history=d&&Array.isArray(d.lapHistory)?d.lapHistory:[];
   h+='<div class="detail-tools"><button id="recordButton">'+(state.recording?"STOP REC":"REC")+'</button><button id="saveButton">SAVE</button><button id="loadButton">LOAD</button><span>'+state.frames.length+' RECORDED SAMPLES</span></div>';
   h+='<div class="detail-grid timing-summary">'+row("CURRENT LAP",d?msTime(d.currentLapMs):"--")+row("LAST LAP",d?msTime(d.lastLapMs):"--")+row("SESSION BEST",d?msTime(d.bestLapMs):"--")+row("DELTA TO BEST",d?signedMs(d.deltaMs):"--")+row("S1",d?msTime(d.s1Ms):"--")+row("S2",d?msTime(d.s2Ms):"--")+row("S3",d?msTime(d.s3Ms):"--")+'</div>';
   h+='<div class="lap-table"><div class="table-head"><span>LAP</span><span>TIME</span><span>S1</span><span>S2</span><span>S3</span></div>'+history.slice(-8).reverse().map(x=>'<div class="table-row"><span>'+value(x.lap)+'</span><span>'+msTime(x.time)+'</span><span>'+msTime(x.s1)+'</span><span>'+msTime(x.s2)+'</span><span>'+msTime(x.s3)+'</span></div>').join("")+'</div><p class="detail-note">'+(history.length?"GAME SESSION HISTORY · VALID LAP RECORDS":"SESSION LAP HISTORY UNAVAILABLE")+'</p><p class="detail-note">MINI-SECTOR COMPARISON: UNAVAILABLE IN CURRENT DECODED DATA</p>';
 }
 if(page==="tyres"){
   const order=[2,3,0,1],names=["FL","FR","RL","RR"],wear=d&&d.tyreWear||[],surface=d&&d.tyreSurfaceTempC||[],inner=d&&d.tyreInnerTempC||[],pressure=d&&d.tyrePressurePsi||[];
   const actual=d&&d.actualTyreCompound,visual=d&&d.visualTyreCompound,compound=actual!=null?({16:"C5",17:"C4",18:"C3",19:"C2",20:"C1",21:"C0",22:"C6",7:"INTER",8:"WET"})[actual]||"COMPOUND "+actual:"--";
   h+='<div class="detail-grid tyre-summary">'+row("ACTUAL COMPOUND",compound)+row("VISUAL COMPOUND",visual!=null?({16:"SOFT",17:"MEDIUM",18:"HARD",7:"INTER",8:"WET"})[visual]||"COMPOUND "+visual:"--")+row("TYRE SET AGE",d?num(d.tyreAgeLaps,0," laps"):"--")+'</div>';
   h+='<div class="tyre-grid">'+order.map((idx,i)=>'<section class="tyre-cell"><b>'+names[i]+'</b><span>WEAR <strong>'+value(wear[idx],"%")+'</strong></span><span>SURFACE <strong>'+value(surface[idx]," °C")+'</strong></span><span>INNER <strong>'+value(inner[idx]," °C")+'</strong></span><span>PRESSURE <strong>'+value(pressure[idx]," psi")+'</strong></span></section>').join("")+'</div>';
 }
 if(page==="telemetry"){
   h+='<div class="detail-grid">'+row("SPEED",d?num(d.speed,0," km/h"):"--")+row("ENGINE RPM",d?num(d.rpm):"--")+row("GEAR",d?num(d.gear):"--")+row("THROTTLE",d?num(d.throttle*100,0,"%"):"--")+row("BRAKE",d?num(d.brake*100,0,"%"):"--")+row("STEERING",d?num(d.steer*100,0,"%"):"--")+row("BRAKE TEMPS",d&&d.brakeTempC?d.brakeTempC.map(x=>num(x)+"°").join(" / "):"--")+row("ENGINE TEMP",d?num(d.engineTempC,0," °C"):"--")+row("AERO MODE",d?aeroName(d):"--")+row("DRS",d&&d.drs!=null?(d.drs?"OPEN":"CLOSED"):"--")+'</div><p class="detail-note">LIVE VALUES COME FROM THE GAME UDP PACKET · RECORDED SAMPLES: '+state.frames.length+'</p>';
 }
 if(page==="race"){
   h+='<div class="detail-grid">'+row("SESSION",d?sessions[d.sessionType]||"SESSION":"--")+row("POSITION",d?num(d.position):"--")+row("LAP",d?num(d.lap)+" / "+num(d.totalLaps):"--")+row("GAP AHEAD",d?signedMs(d.gapToCarAheadMs):"--")+row("GAP TO LEADER",d?signedMs(d.gapToLeaderMs):"--")+row("SAFETY CAR DELTA",d?signedSeconds(d.scDelta):"--")+row("RACE CONTROL",d?d.safetyCar||"CLEAR":"--")+row("PIT STATUS",d?({0:"NOT IN PIT",1:"PITTING",2:"PIT LANE"})[d.pitStatus]||"--":"--")+row("PIT STOPS",d?num(d.numPitStops):"--")+row("PENALTY TIME",d?num(d.penalties,0," s"):"--")+row("WARNINGS",d?num(d.totalWarnings):"--")+row("FUEL",d?num(d.fuelKg,1," kg"):"--")+row("FUEL REMAINING",d?num(d.fuelRemainingLaps,1," laps"):"--")+'</div>';
 }
 if(page==="engineer"){
   h+='<div class="detail-grid">'+row("DRIVER STATUS",d?driverStates[d.driverStatus]||"--":"--")+row("LAP INVALID",d&&d.currentLapInvalid!=null?(d.currentLapInvalid?"YES":"NO"):"--")+row("CORNER CUT WARNINGS",d?num(d.cornerCuttingWarnings):"--")+row("ERS MODE",d?modeName(d.ersMode):"--")+row("AERO MODE",d?aeroName(d):"--")+row("OVERTAKE",d&&d.overtakeActive!=null?(d.overtakeActive?"ACTIVE":d.overtakeAvailable?"AVAILABLE":"OFF"):"--")+'</div><p class="engineer-note">DRIVER ADVICE UNAVAILABLE · THIS BUILD HAS NO VALIDATED CORNER REFERENCE OR TELEMETRY COMPARISON FOR COACHING.</p>';
 }
 root.innerHTML=h;
 const rec=$("recordButton");if(rec)rec.onclick=()=>{state.recording=!state.recording;renderedDetail="";render()};
 const save=$("saveButton");if(save)save.onclick=saveRecording;
 const load=$("loadButton");if(load)load.onclick=()=>$("loadFile").click();
}
function go(page){if(!pages.includes(page))return;state.page=page;renderedDetail="";render()}
function connect(){
 clearTimeout(state.retry);clearInterval(state.replay);state.replay=null;
 const input=$("bridgeUrl"),address=input.value.trim();if(!address)return;
 if(state.socket){state.socket.onclose=null;state.socket.close();state.socket=null}
 state.source="live";state.data=null;state.lastPacket=0;setStatus("connecting");render();
 try{
  const ws=new WebSocket(address);state.socket=ws;
  ws.onopen=()=>{if(state.socket===ws){setStatus("connected");try{localStorage.setItem("fermaxoBridgeUrl",address)}catch{}render()}};
  ws.onmessage=e=>{try{const m=JSON.parse(e.data),d=m.data||m;if(d.format!==2026||d.packetVersion!==1||d.packetId!==6||d.speed==null||d.rpm==null){setStatus("unsupported");render();return}
   state.data=d;state.lastPacket=Date.now();state.packets++;state.status="live";if(state.recording)state.frames.push({at:state.lastPacket,data:d});setStatus("live");render()
  }catch{setText("statusText","INVALID BRIDGE MESSAGE")}};
  ws.onerror=()=>{if(state.socket===ws){setStatus("disconnected");setText("statusText","BRIDGE ERROR · CHECK PC / PORT 20778");render()}};
  ws.onclose=()=>{if(state.socket===ws){state.socket=null;if(state.source==="live"){state.data=null;setStatus("disconnected");render();state.retry=setTimeout(connect,5000)}}};
 }catch{state.data=null;setStatus("disconnected");setText("statusText","INVALID BRIDGE ADDRESS");render()}
}
function saveRecording(){const payload={format:"fermaxo-telemetry-v1",createdAt:new Date().toISOString(),frames:state.frames};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));a.download="fermaxo-telemetry.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function loadReplay(file){const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result),frames=Array.isArray(p)?p:p.frames;if(!Array.isArray(frames))throw Error("invalid");if(state.socket){state.socket.onclose=null;state.socket.close();state.socket=null}clearInterval(state.replay);state.source="replay";state.packets=0;let i=0;state.replay=setInterval(()=>{if(i>=frames.length){clearInterval(state.replay);return}const f=frames[i++];state.data=f.data||f;state.lastPacket=Date.now();state.packets++;state.status="live";render()},100);render()}catch{setText("statusText","INVALID REPLAY FILE")}};reader.readAsText(file)}
document.querySelectorAll(".page-button").forEach(b=>b.onclick=()=>go(b.dataset.page));
$("connectButton").onclick=connect;
$("settingsButton").onclick=()=>{$("settingsPanel").classList.toggle("hidden")};
$("saveSettingsButton").onclick=()=>{connect();$("settingsPanel").classList.add("hidden")};
$("bridgeUrl").addEventListener("keydown",e=>{if(e.key==="Enter"){$("saveSettingsButton").click()}});
$("fullscreenButton").onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()};
$("loadFile").onchange=e=>{if(e.target.files[0])loadReplay(e.target.files[0]);e.target.value=""};
setInterval(()=>{if(state.source==="live"&&state.lastPacket&&Date.now()-state.lastPacket>2500&&state.status==="live"){state.data=null;setStatus("stale");render()}},500);
try{const saved=localStorage.getItem("fermaxoBridgeUrl");if(saved)$("bridgeUrl").value=saved;else if(location.hostname&&location.protocol!=="file:")$("bridgeUrl").value="ws://"+location.hostname+":20778"}catch{}
render();state.retry=setTimeout(connect,250);
})();