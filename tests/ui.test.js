"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const pageButtons=[...html.matchAll(/class="page-button[^"]*" data-page="([^"]+)"/g)].map(m=>m[1]);
test("only MAIN and ENGINEER are primary navigation pages",()=>{
 assert.deepEqual(pageButtons,["home","engineer"]);
 assert.match(app,/PAGES=\["home","engineer"\]/);
});
test("MAIN markup permanently contains essential driving and ERS readings",()=>{
 const main=html.slice(html.indexOf('id="homePage"'),html.indexOf('id="detailPage"'));
 for(const id of ["gearValue","speedValue","rpmLeds","throttleValue","brakeValue","steerValue","steerBar","fuelValue","fuelRange","ersPercent","ersFill","energyStore","energyDeploy","energyHarvest","lapValue","lapTime","lastLapValue","bestLapValue","deltaValue","s1Value","s2Value","s3Value","positionValue","safetyValue","flagValue","trackMapHost","tyreFL","tyreFR","tyreRL","tyreRR","tyreCondition","tyreCompound","tyreWearAverage"])
  assert.match(main,new RegExp('id="'+id+'"'),id);
 assert.doesNotMatch(main,/miniStrip|mini-cell/);
});
test("ENGINEER is lap analysis only and MAIN stays a no-scroll screen",()=>{
 assert.ok(app.includes('if(page==="engineer"){'));
 assert.doesNotMatch(app,/if\(page==="(?:ers|tyres|race)"\)/);
 assert.match(app,/LAP AND MINI-SECTOR ANALYSIS/);
 assert.match(app,/DRIVER IMPROVEMENT/);
 assert.match(css,/\.screen\{[^}]*overflow:hidden/);
 assert.match(css,/\.detail-screen\{[^}]*overflow-y:auto/);
 assert.ok(html.includes('<script src="trackmap.js"></script>'));
 assert.ok(app.includes("Track.prepare")&&app.includes("trackPointValid"));
});
test("application source contains no random telemetry generator",()=>{
 assert.doesNotMatch(app,/Math\.random\s*\(/);
});
