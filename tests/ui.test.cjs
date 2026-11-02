/* Exercise the real browser event handlers in a small, dependency-free DOM fixture. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script id="landfall-code">([\s\S]*?)<\/script>/)[1];
function fixture(options={}){
 let clock=1000,pendingFrame;const elements=new Map(),docListeners=new Map(),winListeners=new Map();
 const doc={activeElement:null,hidden:false,fullscreenElement:null,addEventListener:(k,f)=>docListeners.set(k,f)};
 function element(id,tag='BUTTON'){
  const callbacks=new Map(),classes=new Set();
  const e={id,tagName:tag,value:'',checked:true,hidden:false,disabled:false,dataset:{},style:{},textContent:'',
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
   addEventListener:(k,f)=>{const old=callbacks.get(k)||[];old.push(f);callbacks.set(k,old);},setAttribute(){},
   focus:()=>{doc.activeElement=e;},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:480,height:270}),
   emit:(type,extra={})=>{const ev={type,target:e,button:0,detail:1,preventDefault(){this.defaultPrevented=true;},...extra};for(const f of callbacks.get(type)||[])f(ev);return ev;}
  };elements.set(id,e);return e;
 }
 for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g))element(match[2],match[1].toUpperCase());
 doc.body=element('body','BODY');doc.documentElement=element('root','HTML');
 const gradient={addColorStop(){}};const context=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas=elements.get('game');canvas.getContext=()=>context;elements.get('stageSelect').value='-1';
 const modes=[element('easy','INPUT'),element('hard','INPUT')];modes[0].value='easy';modes[1].value='hard';modes[1].checked=false;
 const cards=[0,1,2,3,4,5].map(n=>{const e=element('card'+n);e.dataset.stage=String(n);return e;});
 const touch=['KeyW','KeyA','KeyS','KeyD','Space','KeyE'].map(k=>{const e=element('touch'+k);e.dataset.key=k;return e;});
 doc.getElementById=id=>elements.get(id);doc.querySelector=()=>modes.find(e=>e.checked);
 doc.querySelectorAll=q=>q==='.mission-card'?cards:q==='[data-key]'?touch:modes;
 const store=new Map();const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const win={matchMedia:q=>({matches:!!options.reducedMotion&&q.includes('reduced-motion')}),addEventListener:(k,f)=>winListeners.set(k,f),AudioContext:options.AudioContext};
 const sandbox={document:doc,window:win,localStorage:storage,performance:{now:()=>clock},requestAnimationFrame:f=>{pendingFrame=f;},Float32Array,Math};
 const code=source.replace('showMenu();requestAnimationFrame(frame);','showMenu();requestAnimationFrame(frame);globalThis.testApi={get game(){return game;},input,syncStatus,mouse,sound};');
 vm.runInNewContext(code,sandbox,{filename:'index.html browser handlers'});
 const api=sandbox.testApi;
 const click=(id,detail=1)=>{const el=elements.get(id);el.focus();return el.emit('click',{detail});};
 function start(stage=0,mode='easy'){elements.get('stageSelect').value=String(stage);modes[0].checked=mode==='easy';modes[1].checked=mode==='hard';click('deployButton');clock+=500;click('overlayPrimary');}
 const key=(code,target=doc.activeElement)=>{const e={code,target,repeat:false,preventDefault(){this.defaultPrevented=true;}};docListeners.get('keydown')(e);return e;};
 return {api,doc,elements,canvas,click,start,key,release:code=>docListeners.get('keyup')({code}),blur:()=>winListeners.get('blur')(),render:()=>pendingFrame(clock),tick:(ms=500)=>{clock+=ms;}};
}
test('a complete mouse click between simulation ticks fires once at its retained aim',()=>{
 const f=fixture();f.start(1);f.render();const point={pointerId:1,pointerType:'mouse',clientX:140,clientY:95};
 f.canvas.emit('pointerdown',point);f.canvas.emit('pointerup',point);f.canvas.emit('pointerleave');
 f.tick(17);f.render();assert.equal(f.api.game.shots.length,1);assert.ok(f.api.game.shots[0].vx<0);assert.equal(f.api.input().fire,false);
});
test('a quick touch aim and release retains the last drag position for one shot',()=>{
 const f=fixture();f.start(1);const point={pointerId:2,pointerType:'touch',clientX:140,clientY:95};
 f.canvas.emit('pointerdown',point);f.canvas.emit('pointermove',{...point,clientX:390,clientY:100});f.canvas.emit('pointerup',point);f.canvas.emit('lostpointercapture',point);
 const tap=f.api.input();assert.equal(tap.fire,true);assert.equal(tap.aim.x,390);assert.equal(tap.aim.y,100);assert.equal(f.api.input().fire,false);assert.equal(f.api.input().aim,null);
});
test('short keyboard and touch button taps reach the next simulation step',()=>{
 const f=fixture();f.start(3);for(const code of ['Space','KeyE','KeyW']){f.key(code);f.release(code);}
 const tap=f.api.input();assert.ok(tap.fire&&tap.special&&tap.jump);const next=f.api.input();assert.ok(!next.fire&&!next.special&&!next.jump);
 const fire=f.elements.get('touchSpace');fire.emit('pointerdown',{pointerId:6});fire.emit('pointerup',{pointerId:6});fire.emit('lostpointercapture',{pointerId:6});assert.equal(f.api.input().fire,true);assert.equal(f.api.input().fire,false);
});
test('cancelled pointers and losing focus discard pending taps and held input',()=>{
 for(const type of ['pointercancel','lostpointercapture']){
  const f=fixture();f.start(1);const point={pointerId:5,pointerType:'touch',clientX:140,clientY:95};f.canvas.emit('pointerdown',point);f.canvas.emit(type,point);assert.equal(f.api.input().fire,false);
  const fire=f.elements.get('touchSpace');fire.emit('pointerdown',{pointerId:6});fire.emit(type,{pointerId:6});assert.equal(f.api.input().fire,false);
 }
 const f=fixture();f.start();f.key('Space');f.key('KeyE');f.blur();assert.equal(f.api.game.status,'paused');f.click('pauseButton');assert.equal(f.api.input().fire,false);assert.equal(f.api.input().special,false);
});
test('rescue touch aiming follows the captured finger and clears on release',()=>{
 const f=fixture();f.start(1);const event={pointerId:7,pointerType:'touch',clientX:100,clientY:90};
 f.canvas.emit('pointerdown',event);assert.equal(f.api.input().aim.x,100);assert.ok(f.api.input().fire);
 f.canvas.emit('pointermove',{...event,clientX:350,clientY:170});assert.equal(f.api.input().aim.x,350);assert.equal(f.api.input().aim.y,170);
 f.canvas.emit('pointermove',{...event,pointerId:8,clientX:20});assert.equal(f.api.input().aim.x,350);
 f.canvas.emit('pointerup',event);assert.equal(f.api.input().aim,null);assert.equal(f.api.input().fire,false);
});
test('resuming with the toolbar returns keyboard controls to the canvas',()=>{
 const f=fixture();f.start();f.click('pauseButton');assert.equal(f.api.game.status,'paused');f.click('pauseButton');assert.equal(f.api.game.status,'play');assert.equal(f.doc.activeElement,f.canvas);
 f.key('KeyD');assert.equal(f.api.input().dx,1);f.key('Space');assert.equal(f.api.input().fire,true);
 f.click('soundButton');assert.equal(f.doc.activeElement,f.canvas);f.key('KeyE');assert.ok(f.api.input().special);
});
test('Enter on a secondary button retains native activation and does not resume',()=>{
 const f=fixture();f.start();f.click('returnButton');assert.equal(f.api.game.status,'paused');
 const secondary=f.elements.get('overlaySecondary');secondary.focus();const event=f.key('Enter');assert.equal(event.defaultPrevented,undefined);assert.equal(f.api.game.status,'paused');
 f.click('overlaySecondary');assert.equal(f.api.game,null);
});
test('a primary double click cannot skip the following briefing or final debrief',()=>{
 const f=fixture();f.start(-1);f.api.game.finish();f.api.syncStatus();f.tick();f.click('overlayPrimary',1);assert.equal(f.api.game.stage,1);assert.equal(f.api.game.status,'brief');
 f.click('overlayPrimary',2);assert.equal(f.api.game.status,'brief');
 f.tick();f.click('overlayPrimary');assert.equal(f.api.game.status,'play');
 const p=fixture();p.start(3);p.api.game.finish();p.api.syncStatus();p.tick();p.click('overlayPrimary');assert.equal(p.api.game.status,'won');p.click('overlayPrimary',2);assert.equal(p.api.game.status,'won');
});
test('exhausted Hard practice offers an accurately labelled practice restart',()=>{
 const f=fixture();f.start(2,'hard');f.api.game.lives=1;f.api.game.fail('test');f.api.syncStatus();assert.equal(f.elements.get('overlayPrimary').textContent,'RESTART PRACTICE →');
 f.tick();f.click('overlayPrimary');assert.equal(f.api.game.stage,2);assert.ok(f.api.game.practice);assert.equal(f.api.game.lives,3);assert.equal(f.api.game.status,'brief');
});
test('bonus menu cards deploy the selected game and expose naval elevation only when needed',()=>{
 const f=fixture();f.click('card4');assert.equal(f.elements.get('stageSelect').value,'4');assert.equal(f.elements.get('deployButton').textContent,'LAUNCH BONUS →');f.click('deployButton');assert.equal(f.api.game.stage,4);assert.ok(f.elements.get('navalControls').hidden);
 const n=fixture();n.start(5);assert.equal(n.elements.get('navalControls').hidden,false);const dial=n.elements.get('elevationDial');dial.value='31.5';dial.emit('input');assert.equal(n.api.game.elevation,31.5);dial.emit('pointerup');assert.equal(n.doc.activeElement,n.canvas);
});
test('Skyshield touch aim follows a drag and keyboard aim can take over',()=>{
 const f=fixture();f.start(4);const touch={pointerId:3,pointerType:'touch',clientX:90,clientY:80};f.canvas.emit('pointerdown',touch);f.canvas.emit('pointermove',{...touch,clientX:180});assert.equal(f.api.input().aim.x,180);f.canvas.emit('pointerup',touch);f.key('KeyD');assert.equal(f.api.input().aim,null);assert.equal(f.api.input().dx,1);
});
test('campaign completion offers the bonus menu without appending bonus stages',()=>{
 const f=fixture();f.start(-1);for(let i=0;i<4;i++){f.api.game.finish();f.api.game.advance();f.api.game.begin();}f.api.syncStatus();assert.equal(f.api.game.status,'won');assert.equal(f.elements.get('overlaySecondary').textContent,'BONUS OPERATIONS →');f.click('overlaySecondary');assert.equal(f.api.game,null);assert.equal(f.elements.get('stageSelect').value,'4');
});
test('all six views render with normal and reduced motion; naval keyboard aim can take over',()=>{
 for(const reducedMotion of [false,true])for(let stage=0;stage<6;stage++){const f=fixture({reducedMotion});f.start(stage);f.render();f.key('Space');f.tick(16);f.render();}
 const f=fixture();f.start(5);f.canvas.emit('pointermove',{pointerType:'mouse',clientX:120,clientY:90});assert.equal(f.api.input().aim.x,120);f.key('KeyD');assert.equal(f.api.input().aim,null);assert.equal(f.api.input().dx,1);
});
test('mouse aiming at visible naval hulls damages and sinks every ship in either mode',()=>{
 for(const mode of ['easy','hard']){
  const f=fixture();f.start(5,mode);f.key('KeyE');const g=f.api.game;
  for(const target of g.enemies){
   const pointer={pointerId:9,pointerType:'mouse',clientX:target.x,clientY:target.y+2};
   f.canvas.emit('pointermove',pointer);f.canvas.emit('pointerdown',pointer);
   for(let i=0;i<Math.ceil(8/(1/120))&&!target.dead&&g.status==='play';i++)g.update(1/120,f.api.input());
   f.canvas.emit('pointerup',pointer);assert.ok(target.dead,`${mode}: aim and click must sink the visible ship at ${target.x}; hp=${target.hp}, report=${g.feedback}`);
  }
  assert.equal(g.status,'clear');assert.equal(g.shipsDown,g.enemies.length);
 }
});
test('naval mouse aiming accepts the mast and hull edge and keeps keyboard elevation corrections',()=>{
 const f=fixture();f.start(5);const g=f.api.game,target=g.enemies[0],scale=.65+(9000-target.range)/15000;
 f.canvas.emit('pointermove',{pointerType:'mouse',clientX:target.x+26*scale,clientY:target.y+2});assert.equal(g.bearing,target.x);assert.equal(g.elevation,target.range/200);
 f.canvas.emit('pointermove',{pointerType:'mouse',clientX:target.x,clientY:target.y-20*scale});assert.equal(g.elevation,target.range/200);
 const elevation=g.elevation;f.key('KeyW');g.update(.05,f.api.input());assert.ok(g.elevation>elevation);
});
test('mouse and touch naval salvos retain their fired solution when the pointer moves',()=>{
 for(const pointerType of ['mouse','touch']){
  const f=fixture();f.start(5);const g=f.api.game,[first,second]=g.enemies;
  const point={pointerId:17,pointerType,clientX:first.x,clientY:first.y+2};f.canvas.emit('pointerdown',point);g.update(1/120,f.api.input());
  f.canvas.emit('pointermove',{...point,clientX:second.x,clientY:second.y+2});f.canvas.emit('pointerup',point);
  for(let i=0;i<130;i++)g.update(1/120,f.api.input());
  assert.equal(first.hp,1);assert.equal(second.hp,2);assert.equal(g.elevation,second.range/200);
 }
});
function audioFixture(){
 const sources=[],contexts=[];
 const parameter=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(){}});
 class Context{
  constructor(){this.currentTime=0;this.state='running';this.destination={};contexts.push(this);}
  createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
  createBuffer(_,length,rate){return {length,duration:length/rate,sampleRate:rate,data:new Float32Array(length),copyToChannel(data){this.data.set(data);}};}
  createBufferSource(){const source={loop:false,ended:false,connect(){},disconnect(){},start(){this.started=true;},end(){if(!this.ended){this.ended=true;this.onended?.();}},stop(){this.stopped=true;this.end();}};sources.push(source);return source;}
 }
 const f=fixture({AudioContext:Context});f.api.sound.unlock();
 return {...f,sources,context:contexts[0],voiceSources:()=>sources.filter(s=>s.started&&!s.loop),endVoice(){const s=f.api.sound.activeVoice?.source;if(s){contexts[0].currentTime+=s.buffer.duration+.2;s.end();}}};
}
test('enemy hit playback cycles both new phrases and the old cry without stacking voices',()=>{
 const f=audioFixture(),sound=f.api.sound;
 for(const line of ['allons-y','ow','ahh']){
  sound.event({type:'hitEnemy'});assert.equal(sound.activeVoice.line,line);assert.equal(sound.nodes,1);const count=f.voiceSources().length;
  sound.event({type:'voice',team:'enemy'});assert.equal(f.voiceSources().length,count);assert.equal(sound.nodes,1);f.endVoice();assert.equal(sound.nodes,0);
 }
 assert.equal(sound.cache.size,3);
});
test('both menu previews are playable, use separate cached buffers and do not consume the hit cycle',()=>{
 const f=audioFixture(),sound=f.api.sound;f.click('previewAllons');const first=sound.activeVoice.source;assert.equal(sound.activeVoice.line,'allons-y');
 f.click('previewOw');assert.ok(first.stopped);assert.equal(sound.activeVoice.line,'ow');assert.notEqual(first.buffer,sound.activeVoice.source.buffer);assert.equal(sound.enemyVoiceIndex,0);assert.equal(sound.nodes,1);
 f.click('previewAllons');assert.equal(sound.activeVoice.source.buffer,first.buffer);
});
test('mute, voice disable and pause stop speech; ally death can interrupt an enemy line',()=>{
 const f=audioFixture(),sound=f.api.sound;f.click('previewOw');const enemy=sound.activeVoice.source;sound.event({type:'voice',team:'ally'});assert.ok(enemy.stopped);assert.equal(sound.activeVoice.team,'ally');assert.equal(sound.activeVoice.line,'ahh');
 f.elements.get('voiceToggle').checked=false;f.elements.get('voiceToggle').emit('change');assert.equal(sound.activeVoice,null);assert.ok(f.elements.get('previewAllons').disabled);const count=f.voiceSources().length;sound.event({type:'hitEnemy'});assert.equal(f.voiceSources().length,count);
 f.elements.get('voiceToggle').checked=true;f.elements.get('voiceToggle').emit('change');f.click('previewAllons');f.click('soundButton');assert.equal(sound.activeVoice,null);assert.ok(f.elements.get('previewOw').disabled);
 f.click('soundButton');f.click('previewOw');sound.paused=true;sound.sync();assert.equal(sound.activeVoice,null);assert.equal(sound.nodes,0);
});
