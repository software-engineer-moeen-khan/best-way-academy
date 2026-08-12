(()=>{
'use strict';
if(window.__bwaImageSourceLoaded)return;window.__bwaImageSourceLoaded=true;

const FALLBACK='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#202230"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="640" cy="310" r="82" fill="rgba(255,255,255,.12)"/><path d="M598 328l42-52 42 52z" fill="#fff" opacity=".9"/><text x="640" y="450" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="700" text-anchor="middle">Best Way Academy</text><text x="640" y="505" fill="#ddd" font-family="Arial,Helvetica,sans-serif" font-size="26" text-anchor="middle">Course image unavailable</text></svg>`);

const COURSE_IMAGE_SELECTORS=[
  '.course-card img',
  '#detailImage',
  '.related-card img',
  '.mini-course img',
  '.checkout-item img',
  '.learning-card img',
  '[data-course-image]'
].join(',');

function normalise(raw){
  let value=String(raw||'').trim();
  if(!value)return'';
  if(value.startsWith('//'))value='https:'+value;
  else if(!/^[a-z][a-z0-9+.-]*:/i.test(value)&&/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(value))value='https://'+value;
  return value;
}

function proxyUrl(raw){
  const value=normalise(raw);
  if(!value)return FALLBACK;
  if(/^data:image\//i.test(value)||/^blob:/i.test(value))return value;
  try{
    const url=new URL(value,location.href);
    if(url.origin===location.origin)return url.href;
    if(!/^https?:$/i.test(url.protocol))return FALLBACK;
    return `/api/image-proxy?url=${encodeURIComponent(url.href)}`;
  }catch{return FALLBACK}
}

function isCourseImage(img){
  return img instanceof HTMLImageElement&&img.matches(COURSE_IMAGE_SELECTORS);
}

function assign(img,value,stage){
  img.dataset.bwaManagedSrc=value;
  img.dataset.bwaImageStage=stage;
  img.src=value;
}

function prepare(img,raw){
  if(!isCourseImage(img))return;
  const original=normalise(raw||img.dataset.bwaOriginalImage||img.getAttribute('src')||'');
  if(!original||original===FALLBACK)return;

  img.dataset.bwaOriginalImage=original;
  img.dataset.bwaImagePrepared='1';
  assign(img,proxyUrl(original),'proxy');
}

function handleError(event){
  const img=event.target;
  if(!isCourseImage(img))return;
  const original=normalise(img.dataset.bwaOriginalImage||'');
  const stage=img.dataset.bwaImageStage||'';

  if(stage==='proxy'&&original&&/^https?:\/\//i.test(original)){
    assign(img,original,'direct');
    return;
  }

  if(stage!=='fallback')assign(img,FALLBACK,'fallback');
}

document.addEventListener('error',handleError,true);

function scan(root=document){
  if(root instanceof HTMLImageElement&&isCourseImage(root))prepare(root);
  root.querySelectorAll?.(COURSE_IMAGE_SELECTORS).forEach(img=>{
    const current=img.getAttribute('src')||'';
    if(current===img.dataset.bwaManagedSrc)return;
    prepare(img,current);
  });
}

function handleSrcMutation(img){
  if(!isCourseImage(img))return;
  const current=img.getAttribute('src')||'';
  if(!current||current===img.dataset.bwaManagedSrc)return;
  if(current===FALLBACK)return;
  img.dataset.bwaImagePrepared='';
  prepare(img,current);
}

function enhanceAdminImageField(){
  const form=document.querySelector('#courseForm');
  const input=form?.elements?.image;
  if(!input||input.dataset.bwaImageEnhanced==='1')return;
  input.dataset.bwaImageEnhanced='1';

  const label=input.closest('label');
  if(!label)return;
  const help=document.createElement('small');
  help.className='bwa-image-help';
  help.textContent='Recommended: 1280 × 720 px (16:9). JPG, JPEG, PNG, WebP, GIF, AVIF, SVG, direct image URLs and image-page URLs such as Unsplash are supported.';

  const preview=document.createElement('div');
  preview.className='bwa-admin-image-preview';
  preview.hidden=true;
  preview.innerHTML='<img alt="Course image preview"><span>Image preview</span>';
  label.append(help,preview);

  const previewImg=preview.querySelector('img');
  previewImg.setAttribute('data-course-image','1');

  const update=()=>{
    const value=normalise(input.value);
    if(!value){
      preview.hidden=true;
      previewImg.removeAttribute('src');
      previewImg.dataset.bwaOriginalImage='';
      previewImg.dataset.bwaImagePrepared='';
      previewImg.dataset.bwaManagedSrc='';
      return;
    }
    preview.hidden=false;
    previewImg.dataset.bwaOriginalImage=value;
    previewImg.dataset.bwaImagePrepared='';
    prepare(previewImg,value);
  };

  input.addEventListener('input',update);
  input.addEventListener('change',update);
  document.addEventListener('click',e=>{
    if(e.target instanceof Element&&(e.target.closest('[data-course-edit]')||e.target.closest('#addCourseBtn')))setTimeout(update,120);
  },true);
  setTimeout(update,80);
}

function installStyle(){
  if(document.querySelector('#bwaImageSourceStyle'))return;
  const style=document.createElement('style');
  style.id='bwaImageSourceStyle';
  style.textContent=`
    .bwa-image-help{display:block;margin-top:7px;color:#667085;font-weight:500;line-height:1.45}
    .bwa-admin-image-preview{margin-top:10px;width:min(420px,100%);border:1px solid #d1d7dc;border-radius:8px;overflow:hidden;background:#f7f9fa}
    .bwa-admin-image-preview[hidden]{display:none!important}
    .bwa-admin-image-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#202230}
    .bwa-admin-image-preview span{display:block;padding:7px 10px;font-size:12px;color:#667085;background:#fff}
  `;
  document.head.appendChild(style);
}

window.BWAImage={src:proxyUrl,prepare,fallback:FALLBACK,normalise};

function boot(){installStyle();scan();enhanceAdminImageField()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

const observer=new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='attributes'){
      handleSrcMutation(record.target);
      continue;
    }
    record.addedNodes.forEach(node=>{if(node instanceof Element)scan(node)});
  }
  enhanceAdminImageField();
});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
})();