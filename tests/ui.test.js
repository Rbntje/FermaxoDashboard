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
 for(const id of ["gearValue","speedValue","rpmLeds","throttleValue","brakeValue","ersPercent","ersFill","energyStore","energyDeploy","energyHarvest","lapValue","lapTime","lastLapValue","bestLapValue","deltaValue","s1Value","s2Value","s3Value","positionValue","safetyValue","flagValue","miniStrip"])
  assert.match(main,new RegExp('id="'+id+'"'),id);
});
test("ENGINEER consolidates details and MAIN stays a no-scroll screen",()=>{
 for(const page of ["ers","timing","tyres","telemetry","race"])
  assert.ok(app.includes('page==="'+page+'"||page==="engineer"'),"ENGINEER missing "+page+" analysis");
 assert.match(css,/\.screen\{[^}]*overflow:hidden/);
 assert.match(css,/\.detail-screen\{[^}]*overflow-y:auto/);
});
test("application source contains no random telemetry generator",()=>{
 assert.doesNotMatch(app,/Math\.random\s*\(/);
});
