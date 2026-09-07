import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hecklerPresentation, wrapHecklerInsult, HECKLER_BUBBLE_WIDTH, HECKLER_BUBBLE_HEIGHT } from '../hecklerPresentation.js';
import { pickInsult } from '../../data/insults.js';
import { FAMILIES } from '../obstacleGeometry.js';
import { CONFIG } from '../../config.js';

// Test-only accessors injected into an evaluated copy of the ACTUAL engine.
// Production exports remain unchanged; physics/collision remain real.
const url=new URL('../engine.js',import.meta.url);
let source=readFileSync(url,'utf8');
const apiMarker='    consumeHeckler,';
assert.equal(source.split(apiMarker).length-1,1);
source=source.replace(apiMarker,`    __test: { obstacles, heckler, trySpawnHeckler, setTimer(t) { hecklerTimer=t; }, getTimer() { return hecklerTimer; } },\n${apiMarker}`);
source=source.replace(/from '([^']+)'/g,(_,specifier)=>`from '${new URL(specifier.endsWith('.js')?specifier:specifier+'.js',url).href}'`);
const {createEngine}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const noop=()=>{};
const eng=createEngine({onScore:noop,onChip:noop,onCrash:noop,onSkinnyJab:noop,onPint:noop});
eng.reset(400,800,undefined,120);
const t=eng.__test;
for(const o of t.obstacles)o.active=false;
const building=t.obstacles[0];
Object.assign(building,{active:true,x:260,topH:280,gap:280,topFamily:FAMILIES.BUILDING,bottomFamily:null});
assert.equal(t.trySpawnHeckler(),true,'An eligible sunny-map building can host a person');
const event=eng.consumeHeckler();
const snap=eng.getSnapshot(0);
assert.equal(snap.heckler.id,event.id);
assert.ok(snap.heckler.y-18>=120,'Actor stays below the real HUD safe area');
assert.ok(snap.heckler.y+18<=building.topH-24,'Actor stays inside its building');
assert.equal(snap.heckler.x,building.x+CONFIG.OBSTACLE_WIDTH/2);
assert.equal(t.trySpawnHeckler(),false,'Only one live person is allowed');
assert.equal(eng.consumeHeckler(),null,'Each shout is consumed once');

for(const [width,height,safeTop] of [[320,568,98],[412,884,98],[430,932,133]]) {
  for(const x of [18,70,width/2,width-18])for(const y of [safeTop+18,safeTop+100,height-90]) {
    const world={dead:0,heckler:{id:7,active:1,life:1.5,x,y}};
    const p=hecklerPresentation(world,7,width,safeTop);
    assert.equal(p.opacity,1);assert.equal(p.windowX,x-18);
    assert.ok(p.bubbleX>=0 && p.bubbleX+HECKLER_BUBBLE_WIDTH<=width);
    assert.ok(p.bubbleY>=safeTop && p.bubbleY+HECKLER_BUBBLE_HEIGHT<height);
    assert.equal(hecklerPresentation(world,6,width,safeTop).opacity,0,'Old speech cannot attach to a new event');
    for(const change of [{active:0},{life:0},{x:-10},{x:width+10}]) {
      assert.equal(hecklerPresentation({...world,heckler:{...world.heckler,...change}},7,width,safeTop).opacity,0);
    }
    assert.equal(hecklerPresentation({...world,dead:1},7,width,safeTop).opacity,0,'Death clears actor and speech together');
    assert.deepEqual(hecklerPresentation(world,7,width,safeTop),p,'A paused simulation keeps actor and speech together');
  }
}
for(let i=0;i<30;i++) {
  const insult=pickInsult(i/30);const lines=wrapHecklerInsult(insult);
  assert.equal(lines.length,3);assert.equal(lines.filter(Boolean).join(' '),insult);
  assert.ok(lines.every(line=>line.length<=20),'Every shipped insult fits the fixed bubble');
}

// A missed opportunity on a non-building side must be retried as an eligible
// building arrives, rather than being lost for another several seconds.
eng.reset(400,800,undefined,120);eng.start();
for(const o of t.obstacles)o.active=false;
Object.assign(building,{active:true,x:300,topH:280,gap:280,topFamily:null,bottomFamily:null,topGeo:null,bottomGeo:null});
t.setTimer(0);eng.step(1/60,1000/60);
assert.equal(t.heckler.active,false);
assert.ok(t.getTimer()>0 && t.getTimer()<=0.25);
building.topFamily=FAMILIES.BUILDING;
for(let i=2;i<=18;i++)eng.step(1/60,i*1000/60);
assert.equal(eng.dead,false);
assert.equal(t.heckler.active,true,'Person appears when the missed window becomes eligible');
assert.ok(t.getTimer()>3,'A successful spawn retains the original several-second comedy cooldown');
console.log('PASS: actual building spawn/retry, HUD clearance, paired actor/speech lifetime, event identity, pause/death/offscreen behavior and all insult layouts');
