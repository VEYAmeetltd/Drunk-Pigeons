import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPintEffect } from '../pintEffect.js';
import { CONFIG, pigeonSizeFor } from '../../config.js';
import { pigeonSpeechPresentation, advanceScriptedSpeech, SCRIPTED_SPEECH_MS, PIGEON_SPEECH_WIDTH, PIGEON_SPEECH_HEIGHT } from '../pigeonSpeech.js';
import { wrapHecklerInsult } from '../hecklerPresentation.js';
import { createFixedStepScheduler, SIM_STEP } from '../frameScheduler.js';

const events = [];
const beer = createPintEffect(active => events.push(active));
assert.equal(beer.flapScale, 1);
beer.collect();
assert.equal(beer.flapScale, 0.8);
beer.step(0.375); assert.equal(beer.rollDegrees, 180);
beer.collect(); assert.equal(beer.rollDegrees, 180, 'Another beer must not rewind an unfinished roll');
beer.step(1.125); assert.equal(beer.rollDegrees, 720, 'Two beers cause two complete turns');
assert.deepEqual(events, [true], 'No React transition on every frame or repeated pickup');
beer.step(3.374); assert.equal(beer.active, true);
beer.step(0.001); assert.equal(beer.active, false);
assert.equal(beer.flapScale, 1);
assert.deepEqual(events, [true, false]);
beer.collect(); beer.step(0.2); beer.sober();
assert.equal(beer.flapScale, 1);
beer.step(0.55); assert.equal(beer.rollDegrees, 360, 'Syringe clears the penalty but finishes the pickup roll');
beer.reset(); assert.equal(beer.rollDegrees, 0);

// Real engine collection/collision paths, with test-only access to arrange pickups.
const url = new URL('../engine.js', import.meta.url);
let source = readFileSync(url, 'utf8');
source = source.replace('    consumeHeckler,', `    __test: { pigeon, pint, jab, obstacles, setFat(n) { fatChips=n; chipCount=72; }, immune(on) { invincibleUntil=on?Infinity:0; } },\n    consumeHeckler,`);
source = source.replace(/from '([^']+)'/g, (_, spec) => `from '${new URL(spec.endsWith('.js') ? spec : spec+'.js', url).href}'`);
const { createEngine } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let pints=0, jabs=0;
const changes=[];
const engine=createEngine({onPint(){pints++;},onSkinnyJab(){jabs++;},onPintEffectChange(active){changes.push(active);}});
engine.reset(400,800); engine.start();
const t=engine.__test; t.immune(true);
for(const o of t.obstacles)o.active=false;
Object.assign(t.pint,{active:true,x:t.pigeon.x,y:t.pigeon.y});
engine.step(SIM_STEP,100);
assert.equal(pints,1); assert.equal(engine.getSnapshot(100).boost,1);
engine.flap(); assert.equal(t.pigeon.vy,CONFIG.FLAP_VELOCITY*0.8,'Weaker lift is applied immediately by the real flap handler');
const paused=engine.getSnapshot(100);
assert.equal(engine.getSnapshot(30000).beerRemainingMs,paused.beerRemainingMs,'Wall time cannot sober a paused game');
t.setFat(30);
Object.assign(t.jab,{active:true,x:t.pigeon.x,y:t.pigeon.y});
engine.step(SIM_STEP,30001);
assert.equal(jabs,1); assert.equal(engine.getSnapshot(30001).boost,0); assert.equal(engine.getSnapshot(30001).fat,0);
engine.flap(); assert.equal(t.pigeon.vy,CONFIG.FLAP_VELOCITY);
assert.equal(engine.chipCount,72,'The power-up does not erase collected chips');
assert.deepEqual(changes,[true,false]);
Object.assign(t.pint,{active:true,x:t.pigeon.x,y:t.pigeon.y});
engine.step(SIM_STEP,30002); assert.equal(engine.getSnapshot(30002).boost,1);
t.immune(false); t.pigeon.y=900; engine.step(SIM_STEP,30003);
assert.equal(engine.dead,true); assert.equal(engine.getSnapshot(30003).boost,0);
engine.revive(30004); assert.equal(engine.getSnapshot(30004).beerRoll,0); engine.flap(); assert.equal(t.pigeon.vy,CONFIG.FLAP_VELOCITY);
engine.reset(400,800); assert.equal(engine.getSnapshot(40000).boost,0);

// Same penalty/roll duration on 60/90/120Hz displays, through the actual scheduler.
for(const hz of [60,90,120]) {
  const scheduler=createFixedStepScheduler(); scheduler.reset(0);
  const effect=createPintEffect(); effect.collect(); let elapsed=0, endedAt=0;
  for(let frame=1;frame<=hz*5;frame++) {
    const n=scheduler.consume(frame*1000/hz);
    for(let i=0;i<n;i++){elapsed+=SIM_STEP;effect.step(SIM_STEP); if(!effect.active && !endedAt)endedAt=elapsed;}
  }
  assert.ok(Math.abs(endedAt-4.5)<0.000001, `${hz}Hz penalty duration`);
  assert.equal(effect.rollDegrees,360);
}

for(const [width,height,top,bottom] of [[320,568,98,24],[412,884,98,24],[430,932,133,34]]) {
  for(const fat of [0,3,6]) for(const py of [12,130,height/2,height-100]) {
    const w={px:width*0.28,py,dead:0};
    const p=pigeonSpeechPresentation(w,true,width,height,top,bottom,pigeonSizeFor(fat));
    assert.equal(p.opacity,1);
    assert.ok(p.x>=8 && p.x+PIGEON_SPEECH_WIDTH<=width-8);
    assert.ok(p.y>=top && p.y+PIGEON_SPEECH_HEIGHT<=height-bottom);
    assert.ok(p.tailX>p.x && p.tailX<p.x+PIGEON_SPEECH_WIDTH);
    assert.equal(pigeonSpeechPresentation({...w,dead:1},true,width,height,top,bottom,66).opacity,0);
    assert.equal(pigeonSpeechPresentation(w,false,width,height,top,bottom,66).opacity,0);
  }
  const a=pigeonSpeechPresentation({px:width*.28,py:height*.5},true,width,height,top,bottom,66);
  const b=pigeonSpeechPresentation({px:width*.28,py:height*.5+20},true,width,height,top,bottom,66);
  assert.equal(b.y-a.y,20,'Bubble moves with the character instead of staying at the HUD');
}
for(const text of ['Wargwarn?','I said wargwarn fam?',"A'ight say less, deekhed"]) {
  const lines=wrapHecklerInsult(text);assert.equal(lines.filter(Boolean).join(' '),text);assert.ok(lines.every(s=>s.length<=20));
}
const timer={current:SCRIPTED_SPEECH_MS};let expired=0;
advanceScriptedSpeech(timer,1,()=>expired++); assert.equal(timer.current,1200);
assert.equal(expired,0); // no simulation steps while paused
advanceScriptedSpeech(timer,1.2,()=>expired++); advanceScriptedSpeech(timer,1,()=>expired++);assert.equal(expired,1);
console.log('PASS: beer penalty/roll/repeated pickup, real syringe recovery, death/revive/reset, 60/90/120Hz duration and attached Roadman speech bounds/lifetime');
