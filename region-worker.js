import {prepareRegions,lookupPrepared} from './region-core.js';
let preparedPromise=null;
const CACHE='bin-traffic-admin-20260701-v1';
const REMOTE='https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson';
async function request(url,timeout=55000) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const text=await response.text();
    if(text.length>60*1024*1024)throw Error('지역자료 크기를 확인해 주세요.');
    return {response,text};
  } finally {clearTimeout(timer);}
}
async function load(baseURL) {
  const local=new URL('data/regions.geojson',baseURL).href;
  const configURL=new URL('data/region-config.json',baseURL).href;
  let cfg={version:'2026-07-01',sources:[local,REMOTE]};
  try {
    const {text}=await request(configURL,8000), candidate=JSON.parse(text);
    if(Array.isArray(candidate.sources)&&candidate.sources.length) cfg=candidate;
  } catch {}
  let cache=null;
  try {cache=await caches.open(CACHE);} catch {}
  for(const entry of cfg.sources) {
    const url=new URL(entry,baseURL).href;
    if(!/^https?:\/\//.test(url))continue;
    try {
      const cached=await cache?.match(url);
      if(cached) {
        const data=await cached.json();
        return {items:prepareRegions(data),version:cfg.version||'2026-07-01'};
      }
    } catch {try{await cache?.delete(url);}catch{}}
    try {
      const {text}=await request(url,url===local?8000:55000),data=JSON.parse(text);
      const items=prepareRegions(data);
      // Only public boundary data is cached. No photos, queried coordinates, addresses or EXIF.
      if(cache)try{await cache.put(url,new Response(text,{headers:{'Content-Type':'application/geo+json'}}));}catch{}
      return {items,version:cfg.version||'2026-07-01'};
    } catch {}
  }
  throw Error('지역자료를 불러오지 못했어요. 좌표는 유지했으니 지역을 직접 입력하거나 다시 시도해 주세요.');
}
self.onmessage=async({data})=>{
  const {id,point,baseURL}=data;
  try {
    if(!preparedPromise)preparedPromise=load(baseURL).catch(e=>{preparedPromise=null;throw e;});
    const {items,version}=await preparedPromise;
    self.postMessage({id,result:{...lookupPrepared(items,point),version}});
  } catch(e) {self.postMessage({id,error:e.message||'지역 자동 확인에 실패했어요.'});}
};
