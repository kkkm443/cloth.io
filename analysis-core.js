export const targetLabels = [
  {group:'bin', key:'bin-street', text:'an outdoor used clothing collection bin on a street or sidewalk'},
  {group:'bin', key:'bin-donation', text:'a clothing donation collection box for used clothes'},
  {group:'bin', key:'bin-recycling', text:'a textile recycling container with an opening for clothes'},
  {group:'bin', key:'bin-korea', text:'a Korean street-side used clothes collection box'},
  {group:'other', reason:'person', text:'a person standing outdoors or a portrait of a person'},
  {group:'other', reason:'utility_pole', text:'a utility pole, street pole, lamp post, or road sign'},
  {group:'other', reason:'garbage', text:'a pile of garbage bags, litter, boxes, or dumped waste on pavement'},
  {group:'other', reason:'trash_bin', text:'a regular household garbage bin, dumpster, or general recycling container'},
  {group:'other', reason:'utility_box', text:'an electrical cabinet, utility box, vending machine, or street equipment cabinet'},
  {group:'other', reason:'street', text:'an empty street, building facade, parked car, or unrelated outdoor scene'},
];

const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));

export function summarizeTargetResults(results=[]){
  const mapped=results.map(r=>{
    const meta=targetLabels.find(x=>x.text===r.label);
    return meta?{...meta,score:clamp01(r.score)}:null;
  }).filter(Boolean);
  const positives=mapped.filter(x=>x.group==='bin').sort((a,b)=>b.score-a.score);
  const negatives=mapped.filter(x=>x.group==='other').sort((a,b)=>b.score-a.score);
  const positiveTotal=positives.reduce((sum,x)=>sum+x.score,0);
  const negativeTotal=negatives.reduce((sum,x)=>sum+x.score,0);
  const bestPositive=positives[0]?.score||0;
  const bestNegative=negatives[0]?.score||0;
  const margin=bestPositive-bestNegative;
  let status='uncertain';
  if((positiveTotal>=0.52&&bestPositive>=bestNegative*0.82)||(positiveTotal>=0.44&&margin>=0.08))status='valid';
  else if(positiveTotal<=0.28||(negativeTotal>=0.65&&bestNegative-bestPositive>=0.08))status='invalid';
  return {
    status,
    reason:status==='valid'?'bin':(negatives[0]?.reason||'other'),
    positiveTotal:Number(positiveTotal.toFixed(4)),
    negativeTotal:Number(negativeTotal.toFixed(4)),
    bestPositive:Number(bestPositive.toFixed(4)),
    bestNegative:Number(bestNegative.toFixed(4)),
    margin:Number(margin.toFixed(4)),
  };
}
