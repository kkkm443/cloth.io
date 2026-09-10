// Person-only masking. No OCR or background/text heuristics.
export const PERSON_THRESHOLD = .65;
export const FACE_THRESHOLD = .75;
export function paddedBox(box, width, height, kind = 'person') {
  if (!box || !['person','face','manual'].includes(kind)) return null;
  const {x,y,w,h} = box;
  if (![x,y,w,h,width,height].every(Number.isFinite) || w<=0 || h<=0 || width<=0 || height<=0) return null;
  const px=kind==='manual'?0:Math.max(2,w*(kind==='face'?.12:.025));
  const py=kind==='manual'?0:Math.max(2,h*(kind==='face'?.18:.025));
  const left=Math.max(0,Math.floor(x-px)), top=Math.max(0,Math.floor(y-py));
  const right=Math.min(width,Math.ceil(x+w+px)), bottom=Math.min(height,Math.ceil(y+h+py));
  return right>left&&bottom>top?{x:left,y:top,w:right-left,h:bottom-top,kind}:null;
}
export function scanTiles(width,height,size=800) {
  if (![width,height,size].every(Number.isFinite) || width<=0 || height<=0 || size<32) return [];
  const positions=n=>{if(n<=size)return [0];const out=[];for(let p=0;p<n-size;p+=Math.floor(size*.8))out.push(p);out.push(n-size);return [...new Set(out)];};
  return positions(height).flatMap(y=>positions(width).map(x=>({x,y,w:Math.min(size,width-x),h:Math.min(size,height-y)})));
}
function overlap(a,b) {return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));}
export function detectionBoxes(detections,width,height,kind,dx=0,dy=0) {
  const out=[];
  for(const d of detections||[]) {
    const category=d.categories?.find(c=>kind==='person'?c.categoryName==='person':true);
    if(!category||!Number.isFinite(category.score)||category.score<(kind==='person'?PERSON_THRESHOLD:FACE_THRESHOLD))continue;
    const b=d.boundingBox;if(!b)continue;
    const box=paddedBox({x:b.originX+dx,y:b.originY+dy,w:b.width,h:b.height},width,height,kind);
    if(box)out.push({...box,score:category.score});
  }
  return out;
}
// Suppress duplicate detections instead of repeatedly expanding their union.
// Adjacent people remain independent boxes that can be removed separately.
export function distinctBoxes(boxes) {
  const out=[];
  for(const b of [...boxes].sort((a,b)=>(b.score||0)-(a.score||0))) {
    if(!out.some(a=>a.kind===b.kind&&overlap(a,b)/(a.w*a.h+b.w*b.h-overlap(a,b))>.5))out.push(b);
  }
  return out;
}
export function maskRegions(people,faces) {
  const p=distinctBoxes(people), f=distinctBoxes(faces);
  return [...p,...f.filter(b=>!p.some(a=>overlap(a,b)/(b.w*b.h)>.95))].map(({score,...b})=>b);
}
export function paintMasks(context,boxes) {
  context.save();context.globalAlpha=1;context.globalCompositeOperation='source-over';context.fillStyle='#273b36';
  for(const b of boxes)if(['person','face','manual'].includes(b.kind))context.fillRect(b.x,b.y,b.w,b.h);
  context.restore();
}
