// Independent reproduction of the INTIES rotation logic
function hash(n){let a=(n|0)>>>0;a=(a^61)^(a>>>16);a=(a+(a<<3))>>>0;a=a^(a>>>4);a=(a*0x27d4eb2d)>>>0;a=a^(a>>>15);return a>>>0;}
const targetRate = 0.6;
const minGap = 4;
let houseSince = minGap;
let last = null;
const HOUSE = ['flap','chips','pigeoned','yourad'];
const CREATIVES = ['inties-1','inties-2','inties-3'];

function pick(seed){
  if (seed !== last){
    last = seed;
    houseSince += 1;
    if (houseSince > minGap){
      const roll = (hash(seed*97+1013)%1000)/1000;
      if (roll < targetRate){
        houseSince = 0;
        return { kind:'inties', id: CREATIVES[hash(seed+555)%3] };
      }
    }
  }
  return { kind:'house', id: HOUSE[hash(seed*2654435761+7)%4] };
}

// Run 40000 slots — first slot seed=17 (k=0*101+17), then 118, 219, ...
const N = 40000;
let intiesCount = 0;
let seq = [];
for (let k=0;k<N;k++){
  const seed = k*101+17;
  const r = pick(seed);
  seq.push(r);
  if (r.kind==='inties') intiesCount++;
}
console.log('INTIES rate over',N,'slots:', (intiesCount/N*100).toFixed(2)+'%');

// Gap analysis
const gaps=[];
let last_i=-1;
seq.forEach((r,i)=>{if(r.kind==='inties'){if(last_i>=0)gaps.push(i-last_i-1);last_i=i;}});
const minG=Math.min(...gaps), maxG=Math.max(...gaps), avgG=gaps.reduce((a,b)=>a+b,0)/gaps.length;
console.log('Gaps (non-inties between): min=',minG,'max=',maxG,'avg=',avgG.toFixed(2));
console.log('Any consecutive INTIES?', gaps.includes(0));

// Creative distribution
const cCount={};
seq.forEach(r=>{if(r.kind==='inties')cCount[r.id]=(cCount[r.id]||0)+1;});
console.log('Creative distribution:', cCount);

// First 30 slots preview
console.log('First 30:', seq.slice(0,30).map(r=>r.kind==='inties'?'I':'.').join(''));

// What's the first slot outcome (seed=17)?
console.log('Slot 0 (seed=17):', seq[0]);
console.log('Slot 1 (seed=118):', seq[1]);
