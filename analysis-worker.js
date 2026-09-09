// Pinned Transformers.js browser module. Inference stays on this device.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let classifier;
const labels = [
 ['overflow', 'a clothing donation bin overflowing with clothes sticking out of its opening'],
 ['dumping', 'bags of garbage and discarded items dumped on the ground beside a clothing collection bin'],
 ['damage', 'a broken damaged rusty clothing donation container with a broken door'],
 ['normal', 'a clean closed clothing donation container on a tidy sidewalk'],
 ['uncertain', 'a photograph without a clothing donation bin'],
];
self.onmessage = async ({data}) => {
 try {
  self.postMessage({type:'loading',text:'사진 분류 모델을 준비하고 있어요'});
  classifier ??= await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{
   device:'wasm',dtype:'q8',progress_callback:p=>{
    if(p.status==='progress')self.postMessage({type:'progress',progress:p.progress,text:'분류 모델 다운로드 중 · '+(p.file?.split('/').pop()||'')});
   }
  });
  self.postMessage({type:'analyzing',text:'사진 속 수거함 상태를 비교하고 있어요'});
  const results=await classifier(data.image,labels.map(x=>x[1]));
  self.postMessage({type:'result',results:results.map(r=>({category:labels.find(x=>x[1]===r.label)?.[0]||'uncertain',score:r.score}))});
 }catch(e){self.postMessage({type:'error',message:String(e?.message||e)});classifier=undefined;}
};
