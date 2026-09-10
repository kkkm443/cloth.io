// Pure WGS84 polygon lookup. [latitude, longitude] input; GeoJSON uses [longitude, latitude].
// Never infer an administrative region from a nearby bin or a polygon centroid.
export function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
    && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;
}
function bounds(rings) {
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for(const ring of rings) for(const p of ring) {
    if(!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) throw Error('Invalid boundary vertex');
    x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]);
  }
  return [x0,y0,x1,y1];
}
export function prepareRegions(data) {
  if(data?.type!=='FeatureCollection' || !Array.isArray(data.features)) throw Error('지역 경계자료 형식이 올바르지 않아요.');
  const items=[];
  for(const f of data.features) {
    const p=f.properties||{}, name=String(p.adm_nm||p.name||'').trim().replace(/\s+/g,' ');
    if(!name) continue;
    const parts=name.split(' '), province=String(p.sido_nm||parts[0]||'');
    const dong=parts.at(-1), district=String(p.sgg_nm||parts.slice(1,-1).join(' '));
    const polys=f.geometry?.type==='Polygon'?[f.geometry.coordinates]:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[];
    const region={name,province,district,dong,code:String(p.adm_cd2||p.adm_cd||'')};
    for(const rings of polys) {
      if(!Array.isArray(rings)||!rings.length||rings[0].length<4) continue;
      items.push({region,rings,bounds:bounds(rings)});
    }
  }
  if(!items.length) throw Error('사용 가능한 지역 경계가 없어요.');
  return items;
}
// Return 0 outside, 1 inside, 2 on edge. Avoid selecting one of two border-sharing districts silently.
function ringRelation(x,y,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    const dx=xj-xi,dy=yj-yi,length2=dx*dx+dy*dy;
    const cross=(x-xi)*dy-(y-yi)*dx;
    if(length2>0 && Math.abs(cross)<=1e-10*Math.sqrt(length2) &&
       x>=Math.min(xi,xj)-1e-10 && x<=Math.max(xi,xj)+1e-10 &&
       y>=Math.min(yi,yj)-1e-10 && y<=Math.max(yi,yj)+1e-10) return 2;
    if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside?1:0;
}
export function lookupPrepared(items,point) {
  if(!validPoint(point)) throw Error('위도와 경도를 확인해 주세요.');
  const [y,x]=point, found=new Map();
  let edge=false;
  for(const item of items) {
    const [x0,y0,x1,y1]=item.bounds;
    if(x<x0-1e-10||x>x1+1e-10||y<y0-1e-10||y>y1+1e-10) continue;
    let relation=ringRelation(x,y,item.rings[0]);
    if(!relation) continue;
    for(const hole of item.rings.slice(1)) {
      const r=ringRelation(x,y,hole);
      if(r===1){relation=0;break;}
      if(r===2)relation=2;
    }
    if(relation) {
      found.set(item.region.code||item.region.name,item.region);
      if(relation===2)edge=true;
    }
  }
  const matches=[...found.values()];
  if(matches.length===1&&!edge)return {status:'done',region:matches[0]};
  if(matches.length)return {status:'ambiguous',candidates:matches};
  return {status:'outside',candidates:[]};
}
