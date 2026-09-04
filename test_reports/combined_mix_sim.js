// Combined-pipeline simulation: paid (non-exclusive @0.5) + house/INTIES rotation.
// Mirrors the fixed logic in /app/frontend/src/ads/sponsorCampaigns.js exactly.
function hash(n){let a=(n|0)>>>0;a=(a^61)^(a>>>16);a=(a+(a<<3))>>>0;a=a^(a>>>4);a=(a*0x27d4eb2d)>>>0;a=a^(a>>>15);return a>>>0;}

const AD_MIX = { nonExclusivePaidShare: 0.5 };
const INTIES = { enabled: true, targetRate: 0.6, minGapHouseAds: 4 };
const HOUSE = ['flap','chips','pigeoned','yourad'];
const CREATIVES = ['inties-1','inties-2','inties-3'];

const CAMPAIGNS = [
  { id:'breadcrumb', exclusive:false, weight:2, maps:['day','dusk','easy'] },
  { id:'pigeonpost', exclusive:false, weight:1, maps:['day','night'] },
];

function activeCampaigns(mapId){ return CAMPAIGNS.filter(c=>c.maps.includes(mapId)); }
function pickWeighted(camps, seed){
  const total = camps.reduce((s,c)=>s+(c.weight||1),0);
  let r = ((hash(seed)%1000)/1000)*total;
  for (const c of camps){ r -= c.weight||1; if(r<=0) return {kind:'campaign', id:c.id}; }
  return {kind:'campaign', id:camps[0].id};
}

let houseSince = INTIES.minGapHouseAds;
let last = null;
function pickIntiesOrHouse(seed){
  if (INTIES.enabled && seed !== last){
    last = seed; houseSince += 1;
    if (houseSince > INTIES.minGapHouseAds){
      const roll = (hash(seed*97+1013)%1000)/1000;
      if (roll < INTIES.targetRate){
        houseSince = 0;
        return { kind:'inties', id: CREATIVES[hash(seed+555)%3] };
      }
    }
  }
  return { kind:'house', id: HOUSE[hash(seed*2654435761+7)%4] };
}

function pickBillboardAd({mapId, seed, removeAds}){
  if (!removeAds){
    const camps = activeCampaigns(mapId);
    const excl = camps.filter(c=>c.exclusive);
    if (excl.length) return pickWeighted(excl, seed);
    const shared = camps.filter(c=>!c.exclusive);
    if (shared.length){
      const roll = (hash(seed*13+31)%1000)/1000;
      if (roll < AD_MIX.nonExclusivePaidShare) return pickWeighted(shared, seed);
    }
  }
  return pickIntiesOrHouse(seed);
}

function run(mapId){
  houseSince = INTIES.minGapHouseAds; last = null;
  const N = 40000; const counts = {campaign:0, house:0, inties:0}; const brand={};
  let lastInties = -1; let minGapI = Infinity; let consecutive = 0;
  const seq = [];
  for (let k=0;k<N;k++){
    const seed = k*101+17;
    const r = pickBillboardAd({mapId, seed, removeAds:false});
    counts[r.kind]++;
    brand[r.id] = (brand[r.id]||0)+1;
    seq.push(r.kind);
    if (r.kind==='inties'){
      if (lastInties>=0){ const g = k-lastInties-1; if (g<minGapI) minGapI=g; if (g===0) consecutive++; }
      lastInties = k;
    }
  }
  const nonPaid = counts.house + counts.inties;
  console.log(`\n=== MAP: ${mapId} (N=${N}) ===`);
  console.log(`  campaign: ${counts.campaign} (${(counts.campaign/N*100).toFixed(2)}%)`);
  console.log(`  house:    ${counts.house} (${(counts.house/N*100).toFixed(2)}%)`);
  console.log(`  inties:   ${counts.inties} (${(counts.inties/N*100).toFixed(2)}% of all, ${(counts.inties/nonPaid*100).toFixed(2)}% of non-paid)`);
  console.log(`  min gap between INTIES: ${minGapI}, consecutive INTIES: ${consecutive}`);
  console.log(`  brand breakdown:`, brand);
  console.log(`  first 40 slots: ${seq.slice(0,40).map(x=>x==='inties'?'I':x==='campaign'?'P':'.').join('')}`);
}

run('day');
run('night');
run('dusk');
// map with NO active campaign (pure house/INTIES fallback)
run('easy'); // has breadcrumb only
run('nowhere'); // no campaign
