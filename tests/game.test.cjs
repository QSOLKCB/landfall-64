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
const {Game,MODES,DT,voiceSamples,mathSamples,recordBest,rng}=sandbox.module.exports;
function run(g,seconds,controller=()=>({})){g.begin();for(let i=0;i<Math.round(seconds/DT)&&g.status==='play';i++){g.update(DT,controller(g,i));g.events=[];}return g;}
test('the distributable has no remote assets, imports, runtime fetches or dependencies',()=>{
 assert.ok(Buffer.byteLength(html)<85*1024);
 assert.doesNotMatch(html,/<(?:script|img|link|audio|video)[^>]+(?:src|href)\s*=/i);
 assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|WebSocket|importScripts|speechSynthesis)\s*\(/);
 assert.equal((html.match(/<script\b/g)||[]).length,1);
});
test('same seed and input replay exactly in all six games and both modes',()=>{
 for(const mode of ['easy','hard'])for(let stage=0;stage<6;stage++){
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
 const g=new Game();g.begin();g.player={x:240,y:188};run(g,.4,()=>({dy:-1}));assert.ok(g.player.y>=185);
 for(const team of ['player','enemy']){g.shots=[{x:240,y:190,vx:0,vy:-200,gravity:0,life:2,team}];run(g,.2);assert.equal(g.shots.length,0);}
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
test('rescue cannon hits the visible heads of small rooftop enemies in both modes',()=>{
 for(const mode of ['easy','hard'])for(const x of [80,240,400]){
  const g=new Game(mode,1),enemy={type:'roof',x,y:76,hp:2,max:2,timer:100};
  g.enemies=[enemy];g.nextCivilian=100;g.nextHazard=100;
  run(g,1.3,()=>({fire:true,aim:{x,y:62}}));
  assert.equal(enemy.hp,0,`${mode} rooftop head at x=${x}`);assert.ok(enemy.dead);
 }
});
test('rescue cannon hits upper vehicle sprites instead of passing through their turrets',()=>{
 for(const type of ['tank','buggy'])for(const x of [40,440]){
  const g=new Game('easy',1),enemy={type,x,y:184,hp:2,max:2,timer:100};
  g.enemies=[enemy];g.nextCivilian=100;g.nextHazard=100;
  run(g,1.3,()=>({fire:true,aim:{x,y:170}}));assert.equal(enemy.hp,0,`${type} top at x=${x}`);
 }
});
test('a rescue projectile crossing a small sprite between updates registers exactly one hit',()=>{
 const g=new Game('easy',1),enemy={type:'roof',x:200,y:76,hp:2,max:2,timer:100};g.enemies=[enemy];g.begin();
 g.shots=[{x:180,y:62,vx:4800,vy:0,gravity:0,team:'player',life:2}];g.projectiles(DT);
 assert.equal(enemy.hp,1);assert.equal(g.shots.length,0);
});
test('rescue shots stop on the first hazard or enemy along the actual flight path',()=>{
 for(const hazardFirst of [true,false]){
  const g=new Game('easy',1),enemy={type:'roof',x:240,y:hazardFirst?76:150,hp:2,max:2,timer:100},hazard={type:'stone',x:240,y:hazardFirst?150:76,hp:1};
  g.enemies=[enemy];g.hazards=[hazard];g.begin();g.shots=[{x:240,y:240,vx:0,vy:-24000,gravity:0,team:'player',life:2}];g.projectiles(DT);
  assert.equal(enemy.hp,hazardFirst?2:1);assert.equal(hazard.hp,hazardFirst?0:1);assert.equal(g.shots.length,0);
 }
});
test('a rescue shot outside a small enemy sprite remains a miss',()=>{
 const g=new Game('easy',1),enemy={type:'roof',x:80,y:76,hp:2,max:2,timer:100};g.enemies=[enemy];g.nextCivilian=100;g.nextHazard=100;
 run(g,1.3,()=>({fire:true,aim:{x:105,y:62}}));assert.equal(enemy.hp,2);assert.ok(!enemy.dead);
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
test('holding descent lands safely on either pickup pad and boards the crew',()=>{
 for(const mode of ['easy','hard']){
  const g=new Game(mode,2);g.enemies=[];g.begin();g.invulnerable=0;
  for(const pad of g.pads){
   g.player={x:pad.x,y:190,vx:0,vy:0};run(g,3,()=>({dy:1}));
   assert.equal(g.hp,g.cfg.hp,`${mode}: a pickup pad must not damage the helicopter`);assert.ok(pad.done);assert.equal(g.player.y,pad.y-9);
  }
  assert.equal(g.cargo,g.rescued);assert.equal(g.status,'play');
 }
});
test('the carrier supports a safe landing while crew remain ashore',()=>{
 const g=new Game('easy',2);g.enemies=[];g.begin();g.invulnerable=0;g.player={x:1920,y:185,vx:0,vy:0};run(g,3,()=>({dy:1}));
 assert.equal(g.hp,8);assert.equal(g.player.y,205);assert.equal(g.status,'play');assert.equal(g.cargo,0);
});
test('the full safe landing width also permits boarding',()=>{
 for(const offset of [-30,30]){const g=new Game('easy',2);g.enemies=[];const pad=g.pads[0];g.player={x:pad.x+offset,y:190,vx:0,vy:0};run(g,2,()=>({dy:1}));assert.ok(pad.done);assert.equal(g.cargo,pad.count);}
});
test('a fully loaded helicopter can complete extraction while landed on the carrier',()=>{
 const g=new Game('easy',2);g.enemies=[];g.pads.forEach(p=>p.done=true);g.cargo=g.rescued;g.player={x:1920,y:205,vx:0,vy:0};run(g,.03);
 assert.equal(g.status,'clear');
});
test('flight guidance points back to the nearest uncollected pad with the real distance',()=>{
 const g=new Game('easy',2);g.player={x:1920,y:120,vx:0,vy:0};
 let guide=g.flightGuide();assert.equal(guide.index,2);assert.equal(guide.direction,-1);assert.equal(guide.distance,640);
 g.pads[1].done=true;guide=g.flightGuide();assert.equal(guide.index,1);assert.equal(guide.direction,-1);assert.equal(guide.distance,1218);
 g.player.x=702;guide=g.flightGuide();assert.equal(guide.direction,0);assert.equal(guide.distance,0);
 g.pads[0].done=true;guide=g.flightGuide();assert.equal(guide.pad,null);assert.equal(guide.direction,1);assert.equal(guide.distance,1218);
});
test('landing protection applies only to actual pads and the carrier',()=>{
 const g=new Game('easy',2);g.enemies=[];g.begin();g.invulnerable=0;g.player={x:800,y:210,vx:0,vy:0};run(g,1.5,()=>({dy:1}));
 assert.ok(g.hp<g.cfg.hp);assert.equal(g.cargo,0);assert.ok(g.pads.every(p=>!p.done));
});
test('rock spires cause damage and reject crossing',()=>{
 const g=new Game('easy',2);g.begin();g.invulnerable=0;g.player={x:461,y:178,vx:105,vy:0};run(g,.3,()=>({dx:1}));assert.ok(g.hp<8);assert.ok(g.player.x<478);
});
test('descending onto a rock stops vertically without teleporting sideways, and allows escape',()=>{
 for(const mode of ['easy','hard']){
  const g=new Game(mode,2);g.enemies=[];g.invulnerable=0;g.player={x:496,y:135,vx:0,vy:105};
  run(g,.3,()=>({dy:1}));assert.equal(g.player.x,496);assert.ok(g.player.y<=142);assert.equal(g.player.vy,0);assert.equal(g.hp,g.cfg.hp-1);
  run(g,.2,()=>({dy:-1}));assert.ok(g.player.y<135);assert.equal(g.player.x,496);
 }
});
test('a helicopter slides up a rock face and can fly away from contact',()=>{
 const g=new Game('easy',2);g.enemies=[];g.player={x:466,y:178,vx:0,vy:0};
 run(g,.2,()=>({dx:1,dy:-1}));assert.equal(g.player.x,466);assert.ok(g.player.y<178);
 run(g,.2,()=>({dx:-1}));assert.ok(g.player.x<466);
});
test('sandbag contacts stop at the surface and permit sliding and backing away',()=>{
 const g=new Game();g.enemies.forEach(e=>e.timer=100);g.player={x:240,y:188,vx:0,vy:0};
 run(g,.4,()=>({dy:-1}));assert.equal(g.player.y,185);assert.equal(g.player.vy,0);
 run(g,.1,()=>({dx:1,dy:-1}));assert.ok(g.player.x>240);assert.equal(g.player.y,185);
 run(g,.1,()=>({dy:1}));assert.ok(g.player.y>185);
});
test('shots hit visible tank turrets in flight, while shots above the sprite miss',()=>{
 for(const y of [201,194]){
  const g=new Game('easy',2);g.begin();const enemy=g.enemies[0];g.shots=[{x:enemy.x-30,y,vx:350,vy:0,gravity:0,team:'player',life:2}];
  for(let i=0;i<25;i++)g.projectiles(DT);assert.equal(enemy.hp,y===201?3:4);
 }
});
test('swept shore shots resolve the first wall or target along the path',()=>{
 for(const wallFirst of [true,false]){
  const g=new Game();g.begin();const enemy={type:'turret',x:240,y:wallFirst?150:205,hp:3,max:3};g.enemies=[enemy];
  g.shots=[{x:240,y:230,vx:0,vy:-12000,gravity:0,team:'player',life:2}];g.projectiles(DT);
  assert.equal(enemy.hp,wallFirst?3:2);assert.equal(g.shots.length,0);
 }
});
test('fast enemy projectiles cannot cross the player between fixed updates',()=>{
 for(const stage of [0,2,3]){
  const g=new Game('easy',stage);g.begin();g.invulnerable=0;const p=g.player;
  g.shots=[{x:p.x-25,y:p.y-(stage===2?0:7),vx:6000,vy:0,gravity:0,team:'enemy',life:2}];g.projectiles(DT);
  assert.equal(g.hp,7,`stage ${stage}`);assert.equal(g.shots.length,0);
 }
});
test('ducking does not consume a ready throw or delay the next standing throw',()=>{
 const g=new Game('easy',3);g.begin();g.update(DT,{duck:true,fire:true});assert.equal(g.cooldown,0);assert.equal(g.shots.length,0);
 g.update(DT,{fire:true});assert.equal(g.shots.filter(s=>s.team==='player').length,1);assert.ok(g.cooldown>0);
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
test('a lethal volley finishes the duel once, without overkill score or return damage',()=>{
 const g=new Game('easy',3);g.begin();g.invulnerable=0;g.boss.hp=1;g.boss.phase='recover';
 g.shots=[0,1,2].map(()=>({x:375,y:189,vx:220,vy:0,gravity:0,team:'player',life:2}));
 g.shots.push({x:100,y:182,vx:0,vy:0,gravity:0,team:'enemy',life:2});g.projectiles(.03);
 assert.equal(g.boss.hp,0);assert.equal(g.status,'clear');assert.equal(g.hp,8);assert.equal(g.score,60+500+8*50);
});
test('saving a record merges newer same-mode and other-mode records from storage',()=>{
 let value=JSON.stringify({easy:12000,hard:9000});const storage={getItem:()=>value,setItem:(_,s)=>{value=s;}};
 const result=recordBest({easy:2000,hard:0},'easy',7000,storage);assert.equal(result.easy,12000);assert.equal(result.hard,9000);assert.equal(JSON.parse(value).hard,9000);
 const second=recordBest({easy:0,hard:2000},'hard',10000,storage);assert.equal(second.easy,12000);assert.equal(second.hard,10000);
 const broken={getItem:()=>{throw Error('blocked');}};assert.equal(recordBest({},'easy',500,broken).easy,500);
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
test('the new phoneme voices are deterministic, distinct, bounded and fade without a click',()=>{
 const all=voiceSamples('enemy',0,11025,'allons-y'),ow=voiceSamples('enemy',0,11025,'ow');
 assert.deepEqual(all,voiceSamples('enemy',0,11025,'allons-y'));assert.deepEqual(ow,voiceSamples('enemy',0,11025,'ow'));
 assert.ok(all.length>8000&&all.length<9500);assert.ok(ow.length>14500&&ow.length<16000);
 for(const line of [all,ow]){assert.ok(line.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));assert.ok(line.some(n=>Math.abs(n)>.2));assert.equal(Math.abs(line[0]),0);assert.equal(Math.abs(line[line.length-1]),0);}
 assert.notDeepEqual(all,voiceSamples('enemy',1,11025,'allons-y'));assert.notDeepEqual(ow,voiceSamples('enemy',1,11025,'ow'));
 // The ally and commander calls retain the original death cry path.
 assert.deepEqual(voiceSamples('ally'),voiceSamples('ally',0,11025,'ahh'));
});
test('confirmed nonlethal hits produce enemy voice cues in all six games',()=>{
 for(let stage=0;stage<6;stage++){
  const g=new Game('hard',stage);g.begin();let target;
  if(stage===1){target={type:'roof',x:80,y:76,hp:2,max:2,timer:100};g.enemies=[target];}
  else if(stage===3){target=g.boss;target.phase='recover';}
  else if(stage===4){target={type:'plane',x:200,y:100,r:10,hp:2,max:2};g.enemies=[target];}
  else target=g.enemies[0];
  const before=target.hp;
  if(stage===5){g.elevation=target.range/200;g.update(DT,{fire:true,aim:{x:target.x}});for(let i=0;i<125;i++)g.update(DT,{});}
  else{g.shoot(target.x,target.y+(stage===3?-6:14),target.x,target.y-12,'player',240);g.projectiles(.05);}
  assert.equal(target.hp,before-1,`stage ${stage}`);assert.equal(g.events.filter(e=>e.type==='hitEnemy').length,1,`stage ${stage} should cue one hit voice`);
 }
});
test('lethal hits emit one enemy voice and blocked shots or hazards do not emit hit voices',()=>{
 const g=new Game('easy',1);g.begin();const enemy={type:'roof',x:80,y:76,hp:1,max:1};g.enemies=[enemy];g.shoot(80,90,80,60,'player',240);g.projectiles(.04);
 assert.ok(enemy.dead);assert.equal(g.events.filter(e=>e.type==='hitEnemy').length,0);assert.equal(g.events.filter(e=>e.type==='voice'&&e.team==='enemy').length,1);
 const shield=new Game();shield.begin();shield.shoot(240,55,240,34,'player',240);shield.projectiles(.06);assert.equal(shield.enemies[3].hp,12);assert.equal(shield.events.filter(e=>e.type==='hitEnemy'||e.type==='voice').length,0);
 const hazard=new Game('easy',1);hazard.begin();hazard.hazards=[{type:'mine',x:240,y:195,hp:1}];hazard.shoot(240,220,240,180,'player',390);hazard.projectiles(.08);assert.equal(hazard.events.filter(e=>e.type==='hitEnemy'||e.type==='voice').length,0);
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
test('both bonuses are standalone and leave the four-stage campaign ending intact',()=>{
 for(const stage of [4,5]){const g=new Game('easy',stage);assert.ok(g.practice);g.begin();g.finish();g.advance();assert.equal(g.status,'won');assert.equal(g.stage,stage);}
 const campaign=new Game();for(let i=0;i<4;i++){campaign.begin();campaign.finish();campaign.advance();}assert.equal(campaign.stage,3);assert.equal(campaign.status,'won');
});
test('Skyshield has a replenishing loader and interceptable bombs',()=>{
 const g=new Game('easy',4);g.nextPlane=100;run(g,3,()=>({fire:true}));assert.ok(g.rounds>=0&&g.rounds<1);run(g,3);assert.equal(g.rounds,6);
 g.hazards=[{type:'bomb',x:240,y:130,vx:0,vy:0,hp:1}];g.shots=[{x:240,y:170,vx:0,vy:-10800,gravity:0,team:'player',life:2}];g.projectiles(DT);assert.equal(g.hazards[0].hp,0);assert.equal(g.shots.length,0);assert.equal(g.hp,8);
});
test('Skyshield waits for the last plane and bomb to resolve before clearing',()=>{
 const g=new Game('easy',4);g.begin();g.spawned=g.raidTotal;g.hazards=[{type:'bomb',x:240,y:150,vx:0,vy:0,hp:1}];g.update(DT,{});assert.equal(g.status,'play');g.hazards[0].hp=0;g.update(DT,{});assert.equal(g.status,'clear');
});
test('naval splash reports preserve fired elevation and distinguish LONG, SHORT and bearing misses',()=>{
 for(const [elevation,expected] of [[5,'SHORT'],[50,'LONG']]){
  const g=new Game('easy',5);g.begin();const target=g.enemies[0];g.elevation=elevation;g.update(DT,{fire:true,aim:{x:target.x}});g.elevation=target.range/200;run(g,1.05);assert.ok(g.feedback.startsWith(expected),g.feedback);assert.equal(target.hp,2);
 }
 const g=new Game('easy',5);g.begin();g.update(DT,{fire:true,aim:{x:240}});run(g,1.05);assert.ok(g.feedback.startsWith('BEARING OFF'));
});
test('holding naval fire keeps the last splash report readable through the next launch',()=>{
 const g=new Game('easy',5);g.begin();const target=g.enemies[0];g.elevation=5;run(g,1.3,()=>({fire:true,aim:{x:target.x}}));
 assert.ok(g.salvos.length>0);assert.ok(g.feedback.startsWith('SHORT'),g.feedback);assert.equal(g.report.kind,'range');
});
test('naval smoke intercepts incoming salvos, and landing a salvo damages only one ship',()=>{
 const g=new Game('easy',5);g.begin();g.invulnerable=0;g.hazards=[{type:'incoming',x:100,y:130,life:.01,total:1.6,hp:1}];g.update(DT,{special:true});run(g,.1);assert.equal(g.hp,8);assert.equal(g.hazards.length,0);
 const e=g.enemies[0];g.elevation=e.range/200;g.update(DT,{fire:true,aim:{x:e.x}});run(g,1.05);assert.equal(e.hp,1);assert.ok(g.enemies.slice(1).every(s=>s.hp===2));
});
test('normal controllers can finish both bonuses on Easy and Hard',()=>{
 for(const mode of ['easy','hard']){
  const sky=new Game(mode,4),previous=new WeakMap();
  run(sky,80,g=>{
   const targets=[...g.hazards.filter(h=>h.hp>0),...g.enemies.filter(e=>!e.dead)];let aim={x:240,y:100};
   for(const t of targets){const old=previous.get(t);t===targets[0]&&(aim={x:t.x,y:t.y});if(t===targets[0]&&old){const travel=Math.hypot(t.x-240,t.y-235)/360;aim={x:t.x+(t.x-old.x)/DT*travel,y:t.y+(t.y-old.y)/DT*travel};}previous.set(t,{x:t.x,y:t.y});}
   return {fire:true,aim,special:g.hazards.length>0};
  });assert.equal(sky.status,'clear',`${mode} Skyshield hp=${sky.hp}, down=${sky.planesDown}, time=${sky.time}`);
  const naval=new Game(mode,5);let current=null,desired=18,lastReport=null;
  run(naval,100,g=>{
   const target=g.enemies.find(e=>!e.dead);if(!target)return {};
   if(target!==current){current=target;desired=18;lastReport=null;}
   if(g.report&&g.report!==lastReport&&g.report.kind==='range'&&g.report.target===target.x){desired=Math.max(5,Math.min(50,g.elevation-g.report.delta/200));lastReport=g.report;}
   return {aim:{x:target.x},dy:clamp2((g.elevation-desired)/(7*DT)),fire:Math.abs(g.elevation-desired)<.02,special:g.hazards.some(h=>h.life<.35)};
  });assert.equal(naval.status,'clear',`${mode} Iron Horizon hp=${naval.hp}, sunk=${naval.shipsDown}, time=${naval.time}`);
 }
});
