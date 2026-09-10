/* Classic worker: MediaPipe WASM uses importScripts internally.
 * Code/models are downloaded, but photo pixels are processed only on this device.
 * No OCR, number-plate/text/sign detector, logging, or original-photo upload.
 */
const VISION='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const PERSON_MODEL='https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite';
const FACE_MODEL='https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
let active=false;
self.onmessage=async ({data})=>{
  if(active||data?.type!=='mask'||!(data.photo instanceof Blob))return;
  active=true;let detector,bitmap;
  const progress=(text,value)=>self.postMessage({type:'progress',text,progress:value});
  try {
    if(typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')throw Error('unsupported');
    progress('\uc0ac\ub78c \ud0d0\uc9c0 \ubaa8\ub378\uc744 \uc900\ube44\ud558\uace0 \uc788\uc5b4\uc694',5);
    const [{ObjectDetector,FaceDetector,FilesetResolver},geometry]=await Promise.all([
      import(VISION+'/vision_bundle.mjs'),import('./privacy-people-geometry.js')
    ]);
    bitmap=await createImageBitmap(data.photo);
    const {width,height}=bitmap;
    if(width<1||height<1||width*height>2560000)throw Error('image-size');
    const files=await FilesetResolver.forVisionTasks(VISION+'/wasm');
    const people=[],faces=[],tiles=geometry.scanTiles(width,height);
    const collect=(image,kind,dx=0,dy=0)=>{
      const boxes=geometry.detectionBoxes(detector.detect(image).detections,width,height,kind,dx,dy);
      (kind==='person'?people:faces).push(...boxes);
    };
    detector=await ObjectDetector.createFromOptions(files,{
      baseOptions:{modelAssetPath:PERSON_MODEL,delegate:'CPU'},canvas:new OffscreenCanvas(1,1),
      runningMode:'IMAGE',scoreThreshold:geometry.PERSON_THRESHOLD,categoryAllowlist:['person']
    });
    progress('\uc0ac\uc9c4 \uc18d \uc0ac\ub78c\ub9cc \ucc3e\uace0 \uc788\uc5b4\uc694',25);
    collect(bitmap,'person');
    if(tiles.length>1)for(let i=0;i<tiles.length;i++){
      const t=tiles[i],crop=new OffscreenCanvas(t.w,t.h),ctx=crop.getContext('2d');
      if(!ctx)throw Error('canvas');ctx.drawImage(bitmap,t.x,t.y,t.w,t.h,0,0,t.w,t.h);collect(crop,'person',t.x,t.y);
      progress('\uc791\uac8c \ubcf4\uc774\ub294 \uc0ac\ub78c\ub3c4 \uc0b4\ud3b4\ubcf4\uace0 \uc788\uc5b4\uc694',25+Math.round(25*(i+1)/tiles.length));
    }
    detector.close();detector=null;
    detector=await FaceDetector.createFromOptions(files,{
      baseOptions:{modelAssetPath:FACE_MODEL,delegate:'CPU'},canvas:new OffscreenCanvas(1,1),
      runningMode:'IMAGE',minDetectionConfidence:geometry.FACE_THRESHOLD
    });
    progress('\uc5bc\uad74\ub9cc \ubcf4\uc774\ub294 \uc0ac\ub78c\ub3c4 \ud655\uc778\ud558\uace0 \uc788\uc5b4\uc694',65);
    collect(bitmap,'face');
    if(tiles.length>1)for(const t of tiles){
      const crop=new OffscreenCanvas(t.w,t.h),ctx=crop.getContext('2d');
      if(!ctx)throw Error('canvas');ctx.drawImage(bitmap,t.x,t.y,t.w,t.h,0,0,t.w,t.h);collect(crop,'face',t.x,t.y);
    }
    detector.close();detector=null;
    const regions=geometry.maskRegions(people,faces);
    progress('\ucc3e\uc740 \uc0ac\ub78c \uc601\uc5ed\ub9cc \uac00\ub9ac\uace0 \uc788\uc5b4\uc694',95);
    const output=new OffscreenCanvas(width,height),ctx=output.getContext('2d');if(!ctx)throw Error('canvas');
    ctx.drawImage(bitmap,0,0);geometry.paintMasks(ctx,regions);
    const photo=await output.convertToBlob({type:'image/jpeg',quality:.9});
    self.postMessage({type:'result',policy:'people-only-v1',photo,width,height,regions,
      persons:regions.filter(b=>b.kind==='person').length,faces:regions.filter(b=>b.kind==='face').length,texts:0});
  }catch{self.postMessage({type:'error'});}
  finally{try{detector?.close();}catch{}bitmap?.close();active=false;}
};
