import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual selection code; storage/diagnostic imports are irrelevant
// to selection and are replaced with inert bindings, never a live backend.
const url=new URL('../sponsorCampaigns.js',import.meta.url);
let source=readFileSync(url,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
source+='\nthis.api={pickBillboardAd,resetIntiesRotation,SPONSOR_CAMPAIGNS};';
const ctx={AsyncStorage:{},logBillboardRotation(){},logStorageFlush(){},CONFIG:{PIXELS_PER_METRE:24}};
vm.runInNewContext(source,ctx);
const {pickBillboardAd,resetIntiesRotation,SPONSOR_CAMPAIGNS}=ctx.api;
for(const mapId of ['day','night','dusk','easy'])for(const removeAds of [true,false]) {
  for(const nowMs of [Date.parse('2026-09-06'),Date.parse('2027-01-01')]) {
    resetIntiesRotation();
    const ad=pickBillboardAd({mapId,removeAds,nowMs,seed:17,slotIndex:0});
    assert.equal(ad.id,'house-yourad'); assert.equal(ad.headline,'YOUR AD\nCOULD BE HERE');
  }
}
resetIntiesRotation();let sawInties=false;
for(let slotIndex=1;slotIndex<100;slotIndex++) {
  const ad=pickBillboardAd({mapId:'night',removeAds:true,nowMs:Date.parse('2026-09-06'),seed:slotIndex*101+17,slotIndex});
  if(ad.kind==='inties') {sawInties=true;assert.equal(ad.headline,'INTIES');assert.equal(ad.subline,'LTD.com');assert.equal(ad.logo,undefined);}
}
assert.ok(sawInties,'INTIES still appears in later eligible house slots');
SPONSOR_CAMPAIGNS.push({id:'exclusive-test',enabled:true,exclusive:true,start:'2026-01-01',end:'2026-12-31',maps:['night'],weight:1});
assert.equal(pickBillboardAd({mapId:'night',removeAds:false,nowMs:Date.parse('2026-09-06'),seed:118,slotIndex:1}).id,'exclusive-test','Later paid exclusive placements retain priority');
const renderer=readFileSync(new URL('../../components/SponsorBillboard.js',import.meta.url),'utf8');
assert.match(renderer,/slotIndex: k/,'The real billboard passes the actual slot index');
assert.match(renderer,/<IntiesBillboardArtwork/);
assert.doesNotMatch(renderer,/\{isInties \? \(/,'Both artworks must be mounted before play');
assert.match(renderer,/k === currentSlot/,'A recycled slot must not display the previous advert');
assert.doesNotMatch(renderer,/<Image\b|Image\.prefetch|inties-logo/,'INTIES wordmark has no cold image decode');
console.log('PASS: opening house board on every map/restart, later INTIES wordmarks and paid campaign priority');
