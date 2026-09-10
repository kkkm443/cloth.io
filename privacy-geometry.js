// Shared by the browser worker and the geometry checks. Coordinates are pixels.
export function paddedBox(box, width, height, kind = 'text') {
  const {x, y, w, h} = box;
  if (![x,y,w,h,width,height].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const px = Math.max(8, w * (kind === 'face' ? .25 : .12));
  const py = Math.max(8, h * (kind === 'face' ? .35 : .3));
  const left = Math.max(0, Math.floor(x-px)), top = Math.max(0, Math.floor(y-py));
  const right = Math.min(width, Math.ceil(x+w+px)), bottom = Math.min(height, Math.ceil(y+h+py));
  return right > left && bottom > top ? {x:left, y:top, w:right-left, h:bottom-top, kind} : null;
}

export function textBoxes(blocks, width, height) {
  const boxes = [];
  // Mask whole detected lines, including low-confidence OCR and gaps between words.
  // No recognized text is returned to the UI or saved anywhere.
  for (const block of blocks || []) for (const paragraph of block.paragraphs || []) {
    for (const line of paragraph.lines || []) {
      const b = line.bbox;
      if (!b) continue;
      const box = paddedBox({x:b.x0,y:b.y0,w:b.x1-b.x0,h:b.y1-b.y0}, width, height);
      if (box) boxes.push(box);
    }
  }
  return boxes;
}

export function scanTiles(width, height, size=640) {
  function positions(length) {
    if (length <= size) return [0];
    const points = [];
    for (let p=0;p<length-size;p+=Math.floor(size*.75)) points.push(p);
    points.push(length-size);
    return [...new Set(points)];
  }
  return positions(height).flatMap(y=>positions(width).map(x=>({x,y,w:Math.min(size,width-x),h:Math.min(size,height-y)})));
}

export function distinctFaces(boxes) {
  const result = [];
  for (const b of boxes) {
    const overlap = result.findIndex(a=>{
      const area=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      return area/Math.min(a.w*a.h,b.w*b.h)>.65;
    });
    if(overlap<0)result.push(b);
    else {const a=result[overlap],x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);result[overlap]={...a,x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};}
  }
  return result;
}

export function paintMasks(context, boxes) {
  context.save();
  context.globalAlpha=1;
  context.globalCompositeOperation='source-over';
  context.fillStyle='#273b36';
  for(const b of boxes)context.fillRect(b.x,b.y,b.w,b.h);
  context.restore();
}
