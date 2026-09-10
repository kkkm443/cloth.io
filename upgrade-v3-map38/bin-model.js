import {riskScore, distanceMeters} from './keeper-features.js';
export const levels={unknown:{label:'상태 미확인',color:'#7b8795',emoji:'⚪'},observe:{label:'관찰',color:'#078269',emoji:'🟢'},recommend:{label:'정비 권고',color:'#d79a12',emoji:'🟡'},urgent:{label:'정비 시급',color:'#dc554c',emoji:'🔴'}};
export const levelOf=score=>score==null?'unknown':score<=30?'observe':score<=60?'recommend':'urgent';
export function observationScore(r){return r?.status==='resolved'?0:r?riskScore(r):null;}
export const INSTALLATION_PRIORITY_BONUS={listed:0,candidate:0,unknown:0,unmatched:20};
export function installationPriorityBonus(value){const key=typeof value==='string'?value:installationCheck(value).key;return INSTALLATION_PRIORITY_BONUS[key]??0;}
export function priorityScore(conditionScore,value){const bonus=installationPriorityBonus(value);if(conditionScore==null)return bonus>0?bonus:null;return Math.min(100,Math.max(0,conditionScore)+bonus);}
export function hasCoordinates(b){return Number.isFinite(b.latitude)&&Number.isFinite(b.longitude)&&Math.abs(b.latitude)<=90&&Math.abs(b.longitude)<=180;}
export const compareObservations=(a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id);
export function binTitle(b){const dong=(b.landAddress||b.address||'').match(/(?:^|\s)([가-힣0-9·]+(?:동|읍|면))(?:\s|\d|$)/)?.[1];return `${dong||b.name||b.district||b.address||'우리 동네'} 의류수거함`;}
export function buildCatalog(publicBins=[],reports=[],registry={},citizenBins={}){
 const map=new Map();
 for(const b of publicBins)map.set(b.id,{...b,title:binTitle(b),origin:'public',history:[]});
 for(const [id,b] of Object.entries(registry||{}))if(!map.has(id))map.set(id,{...b,id,title:binTitle(b),name:'',province:'',district:'',origin:'registry',history:[]});
 for(const [id,b] of Object.entries(citizenBins||{}))if(!map.has(id))map.set(id,{...b,id,title:binTitle(b),name:'',province:'',district:'',origin:'citizen',history:[]});
 for(const r of reports){if(r.sample)continue;const id=r.bin_id||r.id;let b=map.get(id);if(!b){b={id,address:r.address,title:binTitle(r),name:'',province:'',district:'',latitude:r.latitude,longitude:r.longitude,origin:'citizen',history:[]};map.set(id,b);}b.history.push(r);}
 for(const b of map.values()){
  b.history.sort(compareObservations);b.latest=b.history[0]||null;b.conditionScore=observationScore(b.latest);b.installationBonus=installationPriorityBonus(b);b.score=priorityScore(b.conditionScore,b);b.level=levelOf(b.score);
  b.maintenance=b.history.filter(r=>r.kind==='maintenance'||r.status==='resolved').sort((a,c)=>maintenanceTime(c)-maintenanceTime(a));
  b.lastMaintenance=b.maintenance[0]||null;
  b.recentCount=b.history.filter(r=>r.kind!=='maintenance'&&r.created_at>=Date.now()-30*86400000).length;
  b.reportCount=b.history.filter(r=>r.kind!=='maintenance').length;
  // A positionless public record may acquire a citizen-confirmed coordinate; never fabricate it.
  if(!hasCoordinates(b)){const known=b.history.find(hasCoordinates);if(known){b.latitude=known.latitude;b.longitude=known.longitude;b.coordinateStatus='citizen';}}
 }
 return [...map.values()];
}
export const maintenanceTime=r=>r?.kind==='maintenance'?r.created_at:r?.updated_at||r?.created_at||0;
export function relativeTime(t,now=Date.now()){if(!t)return '기록 없음';const delta=Math.max(0,now-t);return delta<60000?'방금 전':delta<3600000?`${Math.floor(delta/60000)}분 전`:delta<86400000?`${Math.floor(delta/3600000)}시간 전`:`${Math.floor(delta/86400000)}일 전`;}
export function displayTime(t){return t?new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'기록 없음';}
export function filterBins(bins,{q='',province='',district='',risk='all',origin='all',coordinates='all'}={}){const key=q.trim().toLowerCase();return bins.filter(b=>(!key||`${b.address} ${b.landAddress||''} ${b.name||''} ${b.title} ${b.managementNumber||''}`.toLowerCase().includes(key))&&(!province||b.province===province)&&(!district||b.district===district)&&(risk==='all'||b.level===risk)&&(origin==='all'||(origin==='public'?b.origin!=='citizen':b.origin==='citizen'))&&(coordinates==='all'||(coordinates==='missing'?!hasCoordinates(b):hasCoordinates(b))));}
export function nearbyBins(bins,point,maxDistance=50){if(!point)return [];return bins.filter(hasCoordinates).map(b=>({...b,distance:distanceMeters(point,[b.latitude,b.longitude])})).filter(b=>b.distance<=maxDistance).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));}
export function defaultComparison(history){const sorted=[...history].sort(compareObservations);const after=sorted.find(r=>r.kind==='maintenance')||sorted[0];const older=after?sorted.filter(r=>r.id!==after.id&&r.created_at<=after.created_at):[];const before=older.find(r=>observationScore(r)>0)||older[0];return {before:before?.id||'',after:after?.id||''};}
export const originLabel=b=>b.origin==='public'?'공공데이터 수록':b.origin==='registry'?'운영자 연결 공공자료':'시민 발견 · 공공자료 미매칭';
export function installationCheck(b){
 if(!b)return {key:'unknown',label:'설치 확인 보류',detail:'수거함 위치와 자료 연결을 확인해야 합니다.'};
 if(b.origin==='public'||b.origin==='registry')return {key:'listed',label:'공공자료 수록',detail:'공공자료에 위치가 수록되어 있습니다. 다만 수록 사실만으로 설치 승인·적법성을 확정하지 않습니다.'};
 return {key:'unmatched',label:'공공자료 미매칭 · 행정 확인 필요',detail:'시민이 발견했으나 공공자료와 연결되지 않은 수거함입니다. 자료 누락·갱신 차이·사유지 여부가 있을 수 있어 불법으로 단정하지 않습니다.'};
}