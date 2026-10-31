(() => {
"use strict";
const $ = id => document.getElementById(id);
const state = {socket:null,page:"home",status:"waiting",data:null,source:"none",packets:0,lastPacket:0,retry:null,recording:false,frames:[],laps:[],replay:null};
const pages=["home","ers","laps","tyres","race","driver"];
let detailPageRendered="",lastDetailRender=0;
if(location.hostname && location.protocol!=="file:")$("bridgeUrl").value="ws://"+location.hostname+":20778";
const sessions={1:"PRACTICE 1",2:"PRACTICE 2",3:"PRACTICE 3",4:"SHORT PRACTICE",5:"QUALIFYING 1",6:"QUALIFYING 2",7:"QUALIFYING 3",8:"SHORT QUALIFYING",9:"ONE SHOT QUALIFYING",10:"RACE",11:"SPRINT",12:"TIME TRIAL"};
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function number(v, digits=0, suffix=""){const n=Number(v);return v==null||!Number.isFinite(n)?"--":n.toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits})+suffix}
function time(ms){const n=Number(ms);if(ms==null||!Number.isFinite(n)||n<=0)return "--:--.---";return Math.floor(n/60000)+":"+String(Math.floor(n%60000/1000)).padStart(2,"0")+"."+String(Math.floor(n%1000)).padStart(3,"0")}
function delta(ms){const n=Number(ms);return ms==null||!Number.isFinite(n)?"--":(n>0?"+":"")+ (n/1000).toFixed(3)+"s"}
function deltaSeconds(s){const n=Number(s);return s==null||!Number.isFinite(n)?"--":(n>0?"+":"")+n.toFixed(3)+"s"}
function setStatus(status,text){state.status=status;$("statusText").textContent=text;$("statusLed").className=status}
function sessionKind(d){if(!d||!d.sessionType)return "standby";const n=Number(d.sessionType);return n>=10&&n<=11?"race":n>=5&&n<=9?"qualifying":n>=1&&n<=4?"practice":n===12?"timeTrial":"standby"}
function active(){return state.data&&sessionKind(state.data)!=="standby"&&state.status==="connected"}
function setText(id,value){const el=$(id);if(el)el.textContent=value}
function setWidth(id,value){const n=Number(value);const el=$(id);if(el)el.style.width=Number.isFinite(n)?Math.max(0,Math.min(100,n*100))+"%":"0%"}
function render(){const d=active()?state.data:null;document.body.dataset.session=d?sessionKind(d):"standby";document.body.dataset.raceControl=d&&d.safetyCar==="VSC"?"vsc":d&&d.safetyCar==="SAFETY CAR"?"safety":"";
document.body.dataset.flag=d&&d.flag?String(d.flag).toLowerCase():"";
setText("sessionLabel",d?(sessions[d.sessionType]||"SESSION"):"STANDBY");
setText("standbyLine",d?"":state.source==="none"?"WAITING FOR F1 TELEMETRY":"STANDBY · NO ACTIVE SESSION");$("standbyLine").classList.toggle("hidden",!!d);
setText("speedValue",d?number(d.speed):"--");setText("gearValue",d?Number(d.gear)===0?"N":number(d.gear):"N");setText("gearState",d?"LIVE":"STANDBY");setText("rpmValue",d?number(d.rpm):"--");
setText("positionValue",d?number(d.position):"--");setText("lapValue",d?number(d.lap):"--");setText("lapTime",d?time(d.currentLapMs):"--:--.---");setText("lastLapValue",d?time(d.lastLapMs):"--:--.---");
setText("s1Value",d?time(d.s1Ms):"--:--.---");setText("s2Value",d?time(d.s2Ms):"--:--.---");setText("s3Value",d?time(d.s3Ms):"--:--.---");
setText("deltaValue",d?delta(d.deltaMs):"--");setText("deltaLabel",sessionKind(d)==="qualifying"?"Δ LAP PERFORMANCE":"Δ SESSION BEST");
setText("ersPercent",d?number(d.ersPercent,0,"%"):"--");setText("energyStore",d?number(d.energyKj,0," kJ"):"--");setText("energyDeploy",d?number(d.energyUsedLapKj,0," kJ"):"--");setText("energyHarvest",d?number(d.energyHarvestedLapKj,0," kJ"):"--");setWidth("ersFill",d&&d.ersPercent!=null?d.ersPercent/100:null);
setText("throttleValue",d?number(d.throttle*100,0,"%"):"--");setText("brakeValue",d?number(d.brake*100,0,"%"):"--");setWidth("throttleBar",d?d.throttle:null);setWidth("brakeBar",d?d.brake:null);
setText("aeroLabel",d&&d.activeAeroMode!=null&&d.regulations2026Applicable?"STRAIGHT MODE":"DRS");setText("aeroValue",d&&d.activeAeroMode!=null&&d.regulations2026Applicable?(d.activeAeroMode===1?"ACTIVE":"CORNER"):d&&d.drs!=null?(d.drs?"OPEN":"CLOSED"):"--");setText("boostValue",d&&d.boost!=null?(d.boost?"ON":"OFF"):"--");
setText("safetyValue",d?(d.safetyCar||"CLEAR"):"--");setText("flagValue",d&&d.flag?String(d.flag).toUpperCase():"--");setText("penaltyValue",d&&d.penalties!=null?number(d.penalties):"--");setText("engineerMessage",d&&d.engineerMessage?d.engineerMessage:"NO ACTIVE MESSAGE");
const leds=$("rpmLeds");leds.replaceChildren();if(d&&d.revLightsPercent!=null){const count=10,on=Math.round(Math.max(0,Math.min(100,d.revLightsPercent))/10);for(let i=0;i<count;i++){const led=document.createElement("i");led.className=(i<on?"on ":"")+(i<6?"cyan":i<8?"amber":"red");leds.append(led)}}
const banner=$("eventBanner");const event=d&&eventFor(d);banner.className="event-banner"+(event?" "+event.kind:" hidden");setText("eventTitle",event?event.title:"");setText("eventDetail",event?event.detail:"");
setText("packetInfo",state.packets+" PACKETS");setText("sourceInfo",state.source==="replay"?"JSON REPLAY":state.source==="live"?"F1 UDP 2026 · LIVE":"UDP 2026 · LOCAL BRIDGE");setText("ageInfo",state.lastPacket?((Date.now()-state.lastPacket)/1000).toFixed(1)+"s":"--");
document.querySelectorAll(".page-button").forEach(b=>b.classList.toggle("selected",b.dataset.page===state.page));
$("homePage").classList.toggle("active",state.page==="home");$("detailPage").classList.toggle("active",state.page!=="home");if(state.page!=="home"&&(detailPageRendered!==state.page||Date.now()-lastDetailRender>1000)){renderDetail(state.page,d);detailPageRendered=state.page;lastDetailRender=Date.now()}
}
function eventFor(d){if(d.flag){const f=String(d.flag).toLowerCase();const map={red:["red","RED FLAG"],yellow:["yellow","YELLOW FLAG"],doubleyellow:["yellow","DOUBLE YELLOW"],blue:["blue","BLUE FLAG"],green:["green","GREEN FLAG"],chequered:["green","CHEQUERED FLAG"]};const x=map[f]||["yellow",String(d.flag).toUpperCase()];return {kind:x[0],title:x[1],detail:"Race control · actual game telemetry"}}
if(d.safetyCar==="VSC")return {kind:"vsc",title:"VIRTUAL SAFETY CAR",detail:"GAME DELTA "+deltaSeconds(d.scDelta)+" · FOLLOW IN-GAME DELTA"};
if(d.safetyCar==="SAFETY CAR")return {kind:"safety",title:"SAFETY CAR",detail:"GAP "+(d.gapToSafetyCar!=null?number(d.gapToSafetyCar,1,"s"):"--")+" · FOLLOW IN-GAME INSTRUCTIONS"};
if(d.safetyCar==="FORMATION LAP")return {kind:"yellow",title:"FORMATION LAP",detail:"RACE CONTROL"};
return null}
function go(page){if(!pages.includes(page))return;state.page=page;detailPageRendered="";render()}
function renderDetail(page,d){const root=$("detailPage");const title={ers:"ERS ANALYSIS",laps:"LAP ANALYSIS",tyres:"TYRE INFORMATION",race:"RACE INFORMATION",driver:"DRIVER IMPROVEMENT"}[page];
let html='<div class="detail-heading"><span>FERMAXO RACING · ENGINEERING</span><b>'+title+'</b></div>';
const row=(label,value)=>'<div class="detail-row"><span>'+label+'</span><b>'+value+'</b></div>';
if(page==="ers")html+='<div class="detail-grid">'+row("BATTERY STATE",d?number(d.ersPercent,1,"%"):"--")+row("ENERGY STORE",d?number(d.energyKj,1," kJ"):"--")+row("DEPLOYED THIS LAP",d?number(d.energyUsedLapKj,1," kJ"):"--")+row("HARVESTED THIS LAP",d?number(d.energyHarvestedLapKj,1," kJ"):"--")+row("ERS MODE",d&&d.ersMode!=null?number(d.ersMode):"--")+row("BOOST",d&&d.boost!=null?(d.boost?"ACTIVE":"INACTIVE"):"--")+'</div>';
if(page==="laps"){const history=d&&Array.isArray(d.lapHistory)?d.lapHistory:[];html+='<div class="detail-tools"><button id="recordButton">'+(state.recording?"STOP REC":"REC")+'</button><button id="saveButton">SAVE</button><button id="loadButton">LOAD</button></div><div class="lap-table"><div class="table-head"><span>LAP</span><span>TIME</span><span>S1</span><span>S2</span><span>S3</span></div>'+history.slice(-10).reverse().map(x=>'<div class="table-row"><span>'+x.lap+'</span><span>'+time(x.time)+'</span><span>'+time(x.s1)+'</span><span>'+time(x.s2)+'</span><span>'+time(x.s3)+'</span></div>').join("")+'</div><p class="detail-note">'+(history.length?"SESSION HISTORY · GAME DATA":"LAP HISTORY UNAVAILABLE")+'</p>'}
if(page==="tyres"){const temps=d&&d.tyreSurfaceTempC||[],wear=d&&d.tyreWear||[],press=d&&d.tyrePressurePsi||[];html+='<div class="detail-grid">'+["FL","FR","RL","RR"].map((p,i)=>row(p+" · SURFACE",number(temps[i])+" °C")+row(p+" · WEAR",number(wear[i],1,"%"))+row(p+" · PRESSURE",number(press[i],1," psi"))).join("")+'</div><p class="detail-note">COMPOUND / CARCASS TEMPERATURE: UNAVAILABLE</p>'}
if(page==="race")html+='<div class="detail-grid">'+row("SESSION",d?(sessions[d.sessionType]||"SESSION"):"--")+row("POSITION",d?number(d.position):"--")+row("LAP",d?number(d.lap)+" / "+number(d.totalLaps):"--")+row("RACE CONTROL",d?(d.safetyCar||"CLEAR"):"--")+row("VSC DELTA",d?deltaSeconds(d.scDelta):"--")+row("FLAG",d&&d.flag?String(d.flag).toUpperCase():"--")+row("PENALTIES",d?number(d.penalties):"--")+row("FUEL",d?number(d.fuelKg,1," kg"):"--")+'</div>';
if(page==="driver")html+='<div class="detail-grid">'+row("LAP DELTA",d?delta(d.deltaMs):"--")+row("SECTOR 1",d?time(d.s1Ms):"--")+row("SECTOR 2",d?time(d.s2Ms):"--")+row("SECTOR 3",d?time(d.s3Ms):"--")+row("STEERING INPUT",d?number((d.steer||0)*100,0,"%"):"--")+row("BEST LAP",d?time(d.bestLapMs):"--")+'</div><p class="detail-note">DRIVER SUGGESTIONS: UNAVAILABLE · NO VERIFIED COMPARISON DATA</p>';
root.innerHTML=html;
const rec=$("recordButton");if(rec)rec.onclick=()=>{state.recording=!state.recording;rec.textContent=state.recording?"STOP REC":"REC";render()};
const saveBtn=$("saveButton");if(saveBtn)saveBtn.onclick=saveRecording;
const loadBtn=$("loadButton");if(loadBtn)loadBtn.onclick=()=>$("loadFile").click();

}
function connect(){clearTimeout(state.retry);const address=$("bridgeUrl").value.trim();if(!address)return;try{if(state.socket){state.socket.onclose=null;state.socket.close()}state.source="live";state.data=null;setStatus("connecting","CONNECTING");render();const ws=new WebSocket(address);state.socket=ws;
ws.onopen=()=>{if(state.socket===ws)setStatus("connected","BRIDGE LINKED · WAITING FOR GAME")};
ws.onmessage=e=>{try{const m=JSON.parse(e.data),d=m.data||m;if(d.format!==2026||d.packetVersion!==1||d.packetId!==6||d.speed==null||d.rpm==null){setStatus("unsupported","F1 25 / 2026 PACKET REQUIRED");return}state.data=d;state.lastPacket=Date.now();state.packets++;if(state.recording)state.frames.push({at:state.lastPacket,data:d});setStatus("connected","F1 TELEMETRY LIVE");render()}catch{setStatus("unsupported","INVALID TELEMETRY MESSAGE")}};
ws.onerror=()=>{if(state.socket===ws)setStatus("disconnected","LINK ERROR · CHECK BRIDGE ADDRESS")};
ws.onclose=()=>{if(state.socket===ws){state.socket=null;state.data=null;if(state.source==="live"){setStatus("disconnected","RETRYING BRIDGE LINK");render();state.retry=setTimeout(connect,3000)}}}
}catch{state.data=null;setStatus("disconnected","INVALID BRIDGE ADDRESS");render()}}
function saveRecording(){const payload={format:"fermaxo-telemetry-v1",createdAt:new Date().toISOString(),frames:state.frames};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));a.download="fermaxo-telemetry.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function loadReplay(file){const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result),frames=Array.isArray(p)?p:p.frames;if(!Array.isArray(frames))throw Error("bad file");if(state.socket){state.socket.onclose=null;state.socket.close();state.socket=null}state.source="replay";state.status="connected";let i=0;clearInterval(state.replay);state.replay=setInterval(()=>{if(i>=frames.length){clearInterval(state.replay);return}const f=frames[i++];state.data=f.data||f;state.lastPacket=Date.now();state.packets++;render()},100);render()}catch{setText("statusText","INVALID REPLAY FILE")}};reader.readAsText(file)}
document.querySelectorAll(".page-button").forEach(b=>b.onclick=()=>go(b.dataset.page));
$("loadFile").onchange=e=>{if(e.target.files[0])loadReplay(e.target.files[0]);e.target.value=""};
$("connectButton").onclick=connect;
$("bridgeUrl").addEventListener("keydown",e=>{if(e.key==="Enter")connect()});
$("fullscreenButton").onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()};
setInterval(()=>{if(state.source==="live"&&state.lastPacket&&Date.now()-state.lastPacket>2500){state.data=null;setStatus("stale","TELEMETRY STALE · CHECK F1 UDP");render()}},500);
render();state.retry=setTimeout(connect,300);
})();