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

function adminErrorText(err){
  if(err?.data?.errors)return Object.values(err.data.errors).flat().join(' ');
  return err?.data?.message||err?.message||'Image upload failed.';
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
  help.innerHTML='<b>Option 1:</b> Paste an image URL here. <b>Option 2:</b> Upload an image from your device below.<br>Recommended size: 1280 × 720 px (16:9). Other dimensions are also accepted and will be fitted automatically.';
  label.appendChild(help);

  const uploadBox=document.createElement('div');
  uploadBox.className='span-2 bwa-course-image-upload';
  uploadBox.innerHTML=`
    <div class="bwa-image-or"><span>OR</span></div>
    <div class="bwa-image-upload-row">
      <label class="bwa-image-file-button">
        <input type="file" data-course-image-file accept="image/*,.heic,.heif,.tif,.tiff,.ico,.svg,.avif">
        <span>Upload image</span>
      </label>
      <div>
        <b>Upload from computer / phone</b>
        <small>Up to 12 MB. JPG, PNG, WebP, GIF, AVIF, SVG, BMP, ICO and other image formats supported by the server.</small>
      </div>
    </div>
    <p class="bwa-image-upload-status" aria-live="polite"></p>
  `;
  label.insertAdjacentElement('afterend',uploadBox);

  const preview=document.createElement('div');
  preview.className='bwa-admin-image-preview';
  preview.hidden=true;
  preview.innerHTML='<img alt="Course image preview"><span>Image preview</span>';
  uploadBox.insertAdjacentElement('afterend',preview);
  preview.classList.add('span-2');

  const previewImg=preview.querySelector('img');
  previewImg.setAttribute('data-course-image','1');
  const fileInput=uploadBox.querySelector('[data-course-image-file]');
  const status=uploadBox.querySelector('.bwa-image-upload-status');
  const saveButton=form.querySelector('button[type="submit"]');

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

  const upload=async file=>{
    if(!file)return;
    status.classList.remove('error','success');
    status.textContent=`Uploading ${file.name}…`;
    uploadBox.dataset.uploading='1';
    if(saveButton)saveButton.disabled=true;
    try{
      if(!window.BWABackend)throw new Error('Upload service is not ready yet. Please try again.');
      await window.BWABackend.ready;
      if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
      const body=new FormData();
      body.append('image',file,file.name);
      const out=await window.BWABackend.api('/api/admin/manage/course-images',{method:'POST',body});
      if(!out?.url)throw new Error('Image URL was not returned after upload.');
      input.value=out.url;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      status.textContent='✓ Image uploaded. This image will be used when you save the course.';
      status.classList.add('success');
      update();
    }catch(err){
      status.textContent=adminErrorText(err);
      status.classList.add('error');
    }finally{
      uploadBox.dataset.uploading='';
      if(saveButton)saveButton.disabled=false;
      fileInput.value='';
    }
  };

  input.addEventListener('input',()=>{
    status.classList.remove('error','success');
    if(status.textContent.startsWith('✓'))status.textContent='';
    update();
  });
  input.addEventListener('change',update);
  fileInput.addEventListener('change',()=>upload(fileInput.files?.[0]));

  document.addEventListener('click',e=>{
    if(e.target instanceof Element&&(e.target.closest('[data-course-edit]')||e.target.closest('#addCourseBtn')))setTimeout(()=>{
      status.textContent='';status.classList.remove('error','success');update();
    },120);
  },true);
  setTimeout(update,80);
}

function installStyle(){
  if(document.querySelector('#bwaImageSourceStyle'))return;
  const style=document.createElement('style');
  style.id='bwaImageSourceStyle';
  style.textContent=`
    .bwa-image-help{display:block;margin-top:7px;color:#667085;font-weight:500;line-height:1.5}
    .bwa-image-help b{color:#344054}
    .bwa-course-image-upload{min-width:0;margin-top:-2px}
    .bwa-image-or{display:flex;align-items:center;gap:12px;margin:3px 0 12px;color:#98a2b3;font-size:11px;font-weight:800;letter-spacing:.1em}
    .bwa-image-or:before,.bwa-image-or:after{content:'';height:1px;background:#e4e7ec;flex:1}
    .bwa-image-upload-row{display:flex;align-items:center;gap:14px;padding:14px;border:1px dashed #98a2b3;border-radius:8px;background:#f9fafb}
    .bwa-image-upload-row>div{display:grid;gap:3px;min-width:0}
    .bwa-image-upload-row b{font-size:13px;color:#344054}
    .bwa-image-upload-row small{color:#667085;line-height:1.4;font-size:11px}
    .bwa-image-file-button{position:relative;flex:0 0 auto}
    .bwa-image-file-button input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
    .bwa-image-file-button span{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border-radius:6px;background:#6d28d9;color:#fff;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
    .bwa-image-file-button span:hover{background:#4c1d95}
    .bwa-image-upload-status{min-height:18px;margin:7px 0 0;font-size:12px;color:#667085}
    .bwa-image-upload-status.success{color:#067647}
    .bwa-image-upload-status.error{color:#b42318}
    .bwa-admin-image-preview{margin-top:0;width:min(520px,100%);border:1px solid #d1d7dc;border-radius:8px;overflow:hidden;background:#f7f9fa}
    .bwa-admin-image-preview[hidden]{display:none!important}
    .bwa-admin-image-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#202230}
    .bwa-admin-image-preview span{display:block;padding:7px 10px;font-size:12px;color:#667085;background:#fff}
    @media(max-width:640px){.bwa-image-upload-row{align-items:flex-start;flex-direction:column}.bwa-image-file-button span{width:100%}}
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