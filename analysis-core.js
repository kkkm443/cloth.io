export const targetLabels = [
  {group:'bin', key:'bin-street', text:'a freestanding outdoor used clothing collection bin beside a street or sidewalk'},
  {group:'bin', key:'bin-donation', text:'a metal clothing donation collection box with a small opening for used clothes'},
  {group:'bin', key:'bin-recycling', text:'a textile recycling drop container specifically designed to collect clothing'},
  {group:'bin', key:'bin-korea', text:'a Korean street-side used clothes collection box or clothing recycling bin'},
  {group:'other', reason:'electronics', text:'a computer monitor, television screen, laptop display, or desktop computer setup'},
  {group:'other', reason:'indoor', text:'an indoor office desk, room interior, electronic appliance, or computer workstation'},
  {group:'other', reason:'person', text:'a person standing outdoors or a portrait of a person'},
  {group:'other', reason:'utility_pole', text:'a utility pole, street pole, lamp post, traffic light, or road sign'},
  {group:'other', reason:'garbage', text:'a pile of garbage bags, litter, boxes, or dumped waste without a clothing collection bin'},
  {group:'other', reason:'trash_bin', text:'a regular household garbage bin, dumpster, or general recycling container for mixed waste'},
  {group:'other', reason:'utility_box', text:'an electrical cabinet, utility control box, transformer cabinet, or street equipment cabinet'},
  {group:'other', reason:'locker', text:'a parcel locker, mailbox, storage cabinet, refrigerator, or vending machine'},
  {group:'other', reason:'street', text:'an empty street, building facade, parked car, or unrelated outdoor scene without a clothing collection bin'},
];

export const challengeLabels = [
  {group:'bin', key:'challenge-street', text:'an outdoor metal clothing donation bin made for people to drop off used clothes'},
  {group:'bin', key:'challenge-textile', text:'a used-clothes textile recycling collection container on a sidewalk'},
  {group:'bin', key:'challenge-korea', text:'a Korean clothing collection box with a clothing drop opening'},
  {group:'other', reason:'electronics', text:'a computer monitor or television with a large rectangular screen'},
  {group:'other', reason:'electronics', text:'a desktop computer monitor on a desk in a room'},
  {group:'other', reason:'utility_box', text:'an electrical cabinet or metal utility equipment box'},
  {group:'other', reason:'trash_bin', text:'a household trash dumpster or ordinary garbage container'},
  {group:'other', reason:'locker', text:'a parcel locker, storage cabinet, mailbox, refrigerator, or vending machine'},
  {group:'other', reason:'garbage', text:'garbage bags and discarded waste lying on the ground without a clothing bin'},
  {group:'other', reason:'street', text:'an unrelated indoor or outdoor scene without a clothing collection bin'},
];

const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const round=n=>Number((Number(n)||0).toFixed(4));

function mapResults(results, labels){
  return (results||[]).map(r=>{
    const meta=labels.find(x=>x.text===r.label);
    return meta?{...meta,score:clamp01(r.score)}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
}

function stats(results, labels){
  const mapped=mapResults(results,labels);
  const positives=mapped.filter(x=>x.group==='bin').sort((a,b)=>b.score-a.score);
  const negatives=mapped.filter(x=>x.group==='other').sort((a,b)=>b.score-a.score);
  const positiveTotal=positives.reduce((sum,x)=>sum+x.score,0);
  const negativeTotal=negatives.reduce((sum,x)=>sum+x.score,0);
  const positiveMean=positiveTotal/Math.max(1,positives.length);
  const negativeMean=negativeTotal/Math.max(1,negatives.length);
  const bestPositive=positives[0]?.score||0;
  const bestNegative=negatives[0]?.score||0;
  const top=mapped[0]||null;
  const topFive=mapped.slice(0,5);
  const positiveTopFive=topFive.filter(x=>x.group==='bin').length;
  return {
    mapped, positives, negatives, top,
    positiveTotal,negativeTotal,positiveMean,negativeMean,
    bestPositive,bestNegative,margin:bestPositive-bestNegative,
    bestRatio:bestNegative>0?bestPositive/bestNegative:(bestPositive>0?99:0),
    meanRatio:negativeMean>0?positiveMean/negativeMean:(positiveMean>0?99:0),
    positiveTopFive,
  };
}

export function summarizeTargetResults(results=[]){
  const s=stats(results,targetLabels);
  let status='uncertain';
  // A valid image must actually beat every hard-negative concept. The previous
  // rule accepted images even when the best negative score was higher, which
  // caused monitors and equipment cabinets to slip through.
  if(
    s.top?.group==='bin' &&
    s.bestRatio>=1.18 &&
    s.meanRatio>=1.12 &&
    s.positiveTopFive>=2
  ) status='valid';
  else if(
    s.top?.group==='other' &&
    (s.bestRatio<=0.90 || ['electronics','indoor'].includes(s.top.reason))
  ) status='invalid';
  else if(
    s.bestPositive<=0 ||
    (s.positiveTopFive===0 && s.bestRatio<1)
  ) status='invalid';
  return {
    status,
    reason:status==='valid'?'bin':(s.negatives[0]?.reason||'other'),
    positiveTotal:round(s.positiveTotal),
    negativeTotal:round(s.negativeTotal),
    positiveMean:round(s.positiveMean),
    negativeMean:round(s.negativeMean),
    bestPositive:round(s.bestPositive),
    bestNegative:round(s.bestNegative),
    margin:round(s.margin),
    bestRatio:round(s.bestRatio),
    meanRatio:round(s.meanRatio),
    positiveTopFive:s.positiveTopFive,
    topGroup:s.top?.group||'none',
  };
}

export function summarizeChallengeResults(results=[]){
  const s=stats(results,challengeLabels);
  let status='uncertain';
  if(
    s.top?.group==='bin' &&
    s.bestRatio>=1.12 &&
    s.meanRatio>=1.08 &&
    s.positiveTopFive>=2
  ) status='valid';
  else if(s.top?.group==='other'){
    // Explicit electronics are a strong mismatch for this service. Other
    // lookalikes are rejected only with a clearer margin to avoid overblocking
    // real bins that resemble generic metal cabinets.
    if(['electronics','indoor'].includes(s.top.reason)) status=s.bestRatio<=0.98?'invalid':'uncertain';
    else if(s.bestRatio<=0.84) status='invalid';
  }
  return {
    status,
    reason:status==='valid'?'bin':(s.negatives[0]?.reason||'other'),
    positiveTotal:round(s.positiveTotal),
    negativeTotal:round(s.negativeTotal),
    positiveMean:round(s.positiveMean),
    negativeMean:round(s.negativeMean),
    bestPositive:round(s.bestPositive),
    bestNegative:round(s.bestNegative),
    margin:round(s.margin),
    bestRatio:round(s.bestRatio),
    meanRatio:round(s.meanRatio),
    positiveTopFive:s.positiveTopFive,
    topGroup:s.top?.group||'none',
  };
}

export function combineValidationResults(primary, challenge){
  if(primary?.status==='invalid') return {...primary,stage:'primary'};
  if(challenge?.status==='invalid') return {...challenge,stage:'lookalike'};
  if(primary?.status==='valid' && challenge?.status==='valid'){
    return {
      ...primary,status:'valid',reason:'bin',stage:'both',
      challengeBestPositive:challenge.bestPositive,
      challengeBestNegative:challenge.bestNegative,
      challengeBestRatio:challenge.bestRatio,
    };
  }
  const reason=challenge?.reason&&challenge.reason!=='bin'?challenge.reason:(primary?.reason||'other');
  return {
    ...(primary||{}),status:'uncertain',reason,stage:'combined',
    challengeBestPositive:challenge?.bestPositive||0,
    challengeBestNegative:challenge?.bestNegative||0,
    challengeBestRatio:challenge?.bestRatio||0,
  };
}
