/* Classic worker: MediaPipe's WASM loader uses importScripts.
 * All inference runs locally. Network requests download code/models only.
 * Do not log the image or OCR text. Do not persist original images.
 */
const VISION='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const OCR='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist';
let active=false;
self.onmessage=async ({data})=>{
  if(active || data.type!=='mask' || !(data.photo instanceof Blob))return;
  active=true;
  let detector,ocr,bitmap;
  const progress=(text,value)=>self.postMessage({type:'progress',text,progress:value});
  try {
    if(typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')throw new Error('unsupported');
    progress('얼굴 탐지 모델을 준비하고 있어요',5);
    const [{FaceDetector,FilesetResolver},geometry]=await Promise.all([
      import(VISION+'/vision_bundle.mjs'),import('./privacy-geometry.js')
    ]);
    const files=await FilesetResolver.forVisionTasks(VISION+'/wasm');
    detector=await FaceDetector.createFromOptions(files,{
      baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',delegate:'CPU'},
      canvas:new OffscreenCanvas(1,1),runningMode:'IMAGE',minDetectionConfidence:.35
    });
    bitmap=await createImageBitmap(data.photo);
    const {width,height}=bitmap;
    const faces=[];
    function collect(image,dx=0,dy=0){
      for(const d of detector.detect(image).detections){
        const b=d.boundingBox;if(!b)continue;
        const box=geometry.paddedBox({x:b.originX+dx,y:b.originY+dy,w:b.width,h:b.height},width,height,'face');
        if(box)faces.push(box);
      }
    }
    progress('사진 속 얼굴을 찾고 있어요',20);
    collect(bitmap);
    // Whole-image + overlapping tiles improve coverage for smaller pedestrians.
    const tiles=geometry.scanTiles(width,height);
    if(tiles.length>1)for(let i=0;i<tiles.length;i++){
      const t=tiles[i],crop=new OffscreenCanvas(t.w,t.h),ctx=crop.getContext('2d');
      if(!ctx)throw new Error('canvas');
      ctx.drawImage(bitmap,t.x,t.y,t.w,t.h,0,0,t.w,t.h);collect(crop,t.x,t.y);
      progress('작게 보이는 얼굴도 살펴보고 있어요',20+Math.round(15*(i+1)/tiles.length));
    }
    detector.close();detector=null;
    progress('한글·영문 문자 인식 모델을 준비하고 있어요',40);
    importScripts(OCR+'/tesseract.min.js');
    ocr=await Tesseract.createWorker('kor+eng',1,{
      workerPath:OCR+'/worker.min.js',
      corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
      langPath:'https://tessdata.projectnaptha.com/4.0.0',
      logger:m=>progress(m.status==='recognizing text'?'번호판·문패 등에 있는 글자를 찾고 있어요':'문자 인식 모델을 준비하고 있어요',m.status==='recognizing text'?55+Math.round(35*m.progress):45),
      errorHandler:()=>self.postMessage({type:'error'})
    });
    await ocr.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,user_defined_dpi:'150'});
    const result=await ocr.recognize(new Uint8Array(await data.photo.arrayBuffer()),{}, {text:false,blocks:true});
    // v6 omits layout output unless blocks:true is explicitly requested.
    if(!Object.hasOwn(result.data,'blocks') || (result.data.blocks!==null&&!Array.isArray(result.data.blocks)))throw new Error('layout');
    const texts=geometry.textBoxes(result.data.blocks,width,height),uniqueFaces=geometry.distinctFaces(faces);
    progress('찾은 영역을 가린 사진으로 바꾸고 있어요',95);
    const output=new OffscreenCanvas(width,height),ctx=output.getContext('2d');
    if(!ctx)throw new Error('canvas');
    ctx.drawImage(bitmap,0,0);
    geometry.paintMasks(ctx,[...uniqueFaces,...texts]);
    const photo=await output.convertToBlob({type:'image/jpeg',quality:.9});
    self.postMessage({type:'result',photo,faces:uniqueFaces.length,texts:texts.length});
  }catch{
    self.postMessage({type:'error'});
  }finally{
    detector?.close();await ocr?.terminate();bitmap?.close();active=false;
  }
};
