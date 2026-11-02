/* Run: node --test tests/game.test.cjs. No packages, browser, or build required. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.match(/<script id="landfall-code">([\s\S]*?)<\/script>/)[1];
const sandbox={module:{exports:{}},Float32Array,Math};
vm.runInNewContext(code,sandbox,{filename:'index.html'});
const {Game,MODES,DT,voiceSamples,mathSamples,rng}=sandbox.module.exports;
function run(g,seconds,controller=()=>({})){g.begin();for(let i=0;i<Math.round(seconds/DT)&&g.status==='play';i++){g.update(DT,controller(g,i));g.events=[];}return g;}
test('the distributable has no remote assets, imports, runtime fetches or dependencies',()=>{
 assert.ok(Buffer.byteLength(html)<85*1024);
 assert.doesNotMatch(html,/<(?:script|img|link|audio|video)[^>]+(?:src|href)\s*=/i);
 assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|WebSocket|importScripts|speechSynthesis)\s*\(/);
 assert.equal((html.match(/<script\b/g)||[]).length,1);
});
test('same seed and input replay exactly in all four missions and both modes',()=>{
 for(const mode of ['easy','hard'])for(let stage=0;stage<4;stage++){
  const a=new Game(mode,stage),b=new Game(mode,stage);
  const control=(_,i)=>({dx:Math.sin(i/180),dy:Math.cos(i/140),fire:true,special:i%1000===0,jump:i%500<8,duck:i%700>500});
  run(a,12,control);run(b,12,control);
  assert.equal(JSON.stringify(a),JSON.stringify(b),mode+' stage '+stage);
 }
});
test('difficulty changes armour, projectile speed, rescue threshold, tries and boss health',()=>{
 assert.ok(MODES.easy.hp>MODES.hard.hp);assert.ok(MODES.easy.speed<MODES.hard.speed);
 assert.ok(MODES.easy.required<MODES.hard.required);assert.ok(MODES.easy.lives>MODES.hard.lives);assert.ok(MODES.easy.boss<MODES.hard.boss);
});
test('damage grace prevents many projectiles taking all armour in one frame',()=>{
 const g=new Game();g.begin();g.invulnerable=0;for(let i=0;i<20;i++)g.damage();assert.equal(g.hp,7);assert.equal(g.status,'play');
});
test('sandbags block motion and both teams of bullets',()=>{
 const g=new Game();g.begin();g.player={x:240,y:188};run(g,.4,()=>({dy:-1}));assert.ok(g.player.y>185);
 g.shots=[{x:240,y:190,vx:0,vy:-200,gravity:0,life:2,team:'player'}];run(g,.2);assert.equal(g.shots.length,0);
});
test('all three sentries must fall before bunker damage and gate exit',()=>{
 const g=new Game();g.begin();const b=g.enemies[3],hp=b.hp;g.player={x:240,y:45};g.shoot(240,50,240,34,'player',200);run(g,.03);assert.equal(b.hp,hp);
 for(const e of g.enemies)g.kill(e);run(g,.02);assert.equal(g.status,'clear');
});
test('checkpoint retry restores score, crew, elapsed time and seeded stage state',()=>{
 const g=new Game('easy',1);g.begin();g.score=12345;g.rescued=2;g.elapsed=99;g.fail('test');assert.equal(g.lives,4);assert.ok(g.retry());assert.equal(g.stage,1);assert.equal(g.status,'brief');assert.equal(g.score,0);assert.equal(g.rescued,8);assert.equal(g.elapsed,0);assert.equal(g.hp,8);
});
test('Easy continues restore tries; Hard stops after its three tries',()=>{
 const easy=new Game();for(let i=0;i<7;i++){easy.begin();easy.fail('test');assert.ok(easy.retry());}assert.ok(easy.lives>0);
 const hard=new Game('hard');for(let i=0;i<3;i++){hard.begin();hard.fail('test');if(i<2)assert.ok(hard.retry());}assert.equal(hard.lives,0);assert.equal(hard.retry(),false);
});
test('friendly shots never damage evacuees',()=>{
 const g=new Game('easy',1);g.begin();g.civilians=[{x:240,y:190,hp:2,safe:0,id:0}];g.nextCivilian=100;g.nextHazard=100;
 for(let i=0;i<5;i++)g.shoot(240,230,240,190,'player',390);run(g,.16);assert.equal(g.civilians[0].hp,2);assert.equal(g.lost,0);
});
test('rescue requires enough survivors, not just exhausting the wave',()=>{
 const win=new Game('easy',1);win.saved=4;win.lost=4;win.spawned=8;run(win,.02);assert.equal(win.status,'clear');assert.equal(win.rescued,4);
 const lose=new Game('hard',1);lose.saved=5;lose.lost=5;lose.spawned=10;run(lose,.02);assert.equal(lose.status,'failed');
});
test('hover collection needs position and speed; extraction needs both pads',()=>{
 const g=new Game('easy',2);g.enemies=[];g.player={x:702,y:120,vx:0,vy:0};run(g,1.2);assert.equal(g.cargo,0);
 g.player.y=195;run(g,1.2);assert.equal(g.cargo,4);assert.ok(g.pads[0].done);
 g.player={x:1920,y:120,vx:0,vy:0};run(g,.03);assert.equal(g.status,'play');
 g.player={x:1280,y:195,vx:0,vy:0};run(g,1.2);assert.equal(g.cargo,8);
 g.player={x:1920,y:120,vx:0,vy:0};run(g,.03);assert.equal(g.status,'clear');
});
test('rock spires cause damage and reject crossing',()=>{
 const g=new Game('easy',2);g.begin();g.invulnerable=0;g.player={x:461,y:178,vx:105,vy:0};run(g,.3,()=>({dx:1}));assert.ok(g.hp<8);assert.ok(g.player.x<478);
});
test('duel high throws can be ducked and low throws can be jumped',()=>{
 function projectile(g,y){g.begin();g.invulnerable=0;g.shots=[{x:g.player.x+8,y,vx:-120,vy:0,gravity:0,team:'enemy',life:2}];}
 const standing=new Game('easy',3);projectile(standing,182);run(standing,.05);assert.equal(standing.hp,7);
 const duck=new Game('easy',3);projectile(duck,182);run(duck,.05,()=>({duck:true}));assert.equal(duck.hp,8);
 const jump=new Game('easy',3);run(jump,.2,()=>({jump:true}));projectile(jump,196);run(jump,.05,()=>({jump:true}));assert.equal(jump.hp,8);
});
test('commander guard blocks darts but recovery allows hits',()=>{
 const g=new Game('easy',3);g.begin();const hp=g.boss.hp;
 function hit(){g.shots=[{x:375,y:189,vx:220,vy:0,gravity:0,team:'player',life:2}];g.projectiles(.03);}
 hit();assert.equal(g.boss.hp,hp);g.boss.phase='recover';hit();assert.equal(g.boss.hp,hp-1);
});
test('a complete campaign transitions through all four stages; practice stops at its stage',()=>{
 const g=new Game();for(let i=0;i<4;i++){assert.equal(g.stage,i);g.begin();g.finish();g.advance();}assert.equal(g.status,'won');
 const p=new Game('hard',2,true);p.begin();p.finish();p.advance();assert.equal(p.stage,2);assert.equal(p.status,'won');
});
test('pausing stops physics, timers and scoring',()=>{
 const g=new Game();g.begin();g.status='paused';const before=JSON.stringify(g);g.update(100,{fire:true,dx:1,special:true});assert.equal(JSON.stringify(g),before);
});
test('voice and mathematical audio are reproducible, finite, bounded and non-silent',()=>{
 for(const team of ['ally','enemy','boss']){const a=voiceSamples(team),b=voiceSamples(team);assert.deepEqual(a,b);assert.ok(a.some(n=>n!==0));assert.ok(a.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));}
 const a=mathSamples(),b=mathSamples();assert.deepEqual(a,b);assert.ok(a.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));assert.ok(a.some(n=>Math.abs(n)>.1));assert.equal(a[0],0);
});
test('a normal input controller can beat each Easy mission without engine state changes',()=>{
 const results=[];
 const shore=new Game('easy',0);let phase=0;
 run(shore,110,g=>{
  const p=g.player,targets=g.enemies.filter(e=>!e.dead&&(e.type!=='bunker'||g.enemies.slice(0,3).every(t=>t.dead))),target=targets[0]||{x:240,y:34};
  // Walk through the right-hand gaps, use grenades on emplacements, then enter the gate.
  let waypoint=phase===0?{x:298,y:237}:phase===1?{x:298,y:141}:phase===2?{x:240,y:141}:phase===3?{x:240,y:61}:phase===4?{x:target.x,y:61}:{x:240,y:36};
  if(Math.abs(p.x-waypoint.x)<3&&Math.abs(p.y-waypoint.y)<3&&phase<4)phase++;
  if(phase===4&&targets.length===0)phase=5;
  const d=dist2(p,waypoint);return {dx:d>3?waypoint.x-p.x:0,dy:d>3?waypoint.y-p.y:0,fire:true,special:true,aim:target};
 });results.push(['shore',shore.status,shore.hp,shore.time]);
 const rescue=new Game('easy',1);
 run(rescue,65,g=>{const h=g.hazards.find(h=>h.hp>0),e=g.enemies.find(e=>!e.dead);return {fire:true,special:true,aim:h||e||{x:240,y:70}};});results.push(['rescue',rescue.status,rescue.saved,rescue.time]);
 const flight=new Game('easy',2);
 run(flight,80,g=>{const p=g.player,pad=g.pads.find(p=>!p.done);let waypoint;if(pad&&Math.abs(p.x-pad.x)<26){waypoint={x:pad.x,y:195};}else if(pad&&p.y>95){waypoint={x:p.x,y:83};}else waypoint={x:pad?pad.x:1920,y:83};const dx=waypoint.x-p.x,dy=waypoint.y-p.y;return {dx:Math.abs(dx)>3?clamp2(dx/10):0,dy:Math.abs(dy)>3?clamp2(dy/10):0,fire:true,special:true};});results.push(['flight',flight.status,flight.cargo,flight.time]);
 const duel=new Game('easy',3);
 run(duel,60,g=>({fire:true,special:true,duck:g.boss.phase==='recover'&&g.boss.attack%2===0&&g.shots.some(s=>s.team==='enemy'&&s.x<190),jump:g.shots.some(s=>s.team==='enemy'&&s.x<200&&s.y>185)}));results.push(['duel',duel.status,duel.hp,duel.time]);
 for(const [stage,status,...details] of results)assert.equal(status,'clear',stage+': '+JSON.stringify(details));
});
function dist2(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function clamp2(v){return Math.max(-1,Math.min(1,v));}
