/* Exercise the real browser event handlers in a small, dependency-free DOM fixture. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script id="landfall-code">([\s\S]*?)<\/script>/)[1];
function fixture(){
 let clock=1000;const elements=new Map(),docListeners=new Map(),winListeners=new Map();
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
 const cards=[0,1,2,3].map(n=>{const e=element('card'+n);e.dataset.stage=String(n);return e;});
 const touch=['KeyW','KeyA','KeyS','KeyD','Space','KeyE'].map(k=>{const e=element('touch'+k);e.dataset.key=k;return e;});
 doc.getElementById=id=>elements.get(id);doc.querySelector=()=>modes.find(e=>e.checked);
 doc.querySelectorAll=q=>q==='.mission-card'?cards:q==='[data-key]'?touch:modes;
 const store=new Map();const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const win={matchMedia:()=>({matches:false}),addEventListener:(k,f)=>winListeners.set(k,f)};
 const sandbox={document:doc,window:win,localStorage:storage,performance:{now:()=>clock},requestAnimationFrame(){},Float32Array,Math};
 const code=source.replace('showMenu();requestAnimationFrame(frame);','showMenu();requestAnimationFrame(frame);globalThis.testApi={get game(){return game;},input,syncStatus,mouse};');
 vm.runInNewContext(code,sandbox,{filename:'index.html browser handlers'});
 const api=sandbox.testApi;
 const click=(id,detail=1)=>{const el=elements.get(id);el.focus();return el.emit('click',{detail});};
 function start(stage=0,mode='easy'){elements.get('stageSelect').value=String(stage);modes[0].checked=mode==='easy';modes[1].checked=mode==='hard';click('deployButton');clock+=500;click('overlayPrimary');}
 const key=(code,target=doc.activeElement)=>{const e={code,target,repeat:false,preventDefault(){this.defaultPrevented=true;}};docListeners.get('keydown')(e);return e;};
 return {api,doc,elements,canvas,click,start,key,tick:(ms=500)=>{clock+=ms;}};
}
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
