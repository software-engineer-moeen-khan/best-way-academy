(()=>{
'use strict';
const $=s=>document.querySelector(s);

function ensureCourseLinkField(){
  const form=$('#courseForm');
  if(!form)return null;
  let input=form.elements.course_link;
  if(!input){
    const label=document.createElement('label');
    label.className='span-2 admin-course-link-field';
    label.innerHTML='Course access link <small>Required. Paste the Udemy course URL or any external course link. Students see it only after enrollment/payment access is granted.</small><input name="course_link" type="text" inputmode="url" required maxlength="2048" placeholder="https://www.udemy.com/course/..." autocomplete="off">';
    const image=form.elements.image?.closest('label');
    if(image)image.insertAdjacentElement('afterend',label);
    else form.querySelector('.admin-form-grid')?.appendChild(label);
    input=form.elements.course_link;
  }
  return input;
}

function syncFreeCourseUi(){
  const form=$('#courseForm');
  if(!form)return;
  const free=form.elements.is_free,price=form.elements.price;
  if(!free||!price)return;
  if(free.checked){
    if(!price.dataset.paidPrice&&Number(price.value)>0)price.dataset.paidPrice=price.value;
    price.value='0';
    price.disabled=true;
    price.required=false;
  }else{
    price.disabled=false;
    price.required=true;
    if(Number(price.value)===0&&price.dataset.paidPrice)price.value=price.dataset.paidPrice;
  }
}

function ensureFreeCourseField(){
  const form=$('#courseForm');
  if(!form)return null;
  let input=form.elements.is_free;
  if(!input){
    const label=document.createElement('label');
    label.className='admin-check admin-free-course-field';
    label.innerHTML='<input name="is_free" type="checkbox"> <span><b>Free course</b><small>Students enroll instantly. Coupon and EasyPaisa checkout are skipped.</small></span>';
    const price=form.elements.price?.closest('label');
    if(price)price.insertAdjacentElement('afterend',label);
    else form.querySelector('.admin-form-grid')?.appendChild(label);
    input=form.elements.is_free;
    input?.addEventListener('change',syncFreeCourseUi);
  }
  return input;
}

function updateCourseImagePreview(){
  const form=$('#courseForm');
  const input=form?.elements?.image;
  const preview=$('#bwaCourseImagePreview');
  const previewImg=preview?.querySelector('img');
  if(!input||!preview||!previewImg)return;
  let value=String(input.value||'').trim();
  if(!value){preview.hidden=true;previewImg.removeAttribute('src');return}
  if(!/^[a-z][a-z0-9+.-]*:/i.test(value)&&/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(value))value='https://'+value;
  preview.hidden=false;
  try{
    const url=new URL(value,location.origin);
    previewImg.src=url.origin===location.origin?url.href:`/api/image-proxy?url=${encodeURIComponent(url.href)}`;
  }catch{
    previewImg.removeAttribute('src');
  }
}

function resetCourseImageUploadUi(){
  const status=$('#bwaCourseImageUploadStatus');
  const file=$('#bwaCourseImageFile');
  if(status){status.textContent='';status.classList.remove('success','error')}
  if(file)file.value='';
  setTimeout(updateCourseImagePreview,30);
}

function ensureCourseImageUi(){
  const form=$('#courseForm');
  const input=form?.elements?.image;
  if(!form||!input)return null;
  input.type='text';
  input.setAttribute('inputmode','url');
  input.setAttribute('autocomplete','off');
  input.dataset.bwaImageEnhanced='1';
  if(input.dataset.bwaAdminUploadEnhanced==='1')return input;
  input.dataset.bwaAdminUploadEnhanced='1';

  const label=input.closest('label');
  if(!label)return input;
  label.classList.add('bwa-course-image-url-field');
  if(!label.querySelector('.bwa-course-image-help')){
    const help=document.createElement('small');
    help.className='bwa-course-image-help';
    help.innerHTML='<b>Option 1:</b> paste an image URL here. <b>Option 2:</b> upload an image from your device below. Recommended: 1280 × 720 px (16:9).';
    label.appendChild(help);
  }

  if(!$('#bwaCourseImageUploadBox')){
    const box=document.createElement('div');
    box.id='bwaCourseImageUploadBox';
    box.className='span-2 bwa-course-image-upload';
    box.innerHTML=`
      <div class="bwa-course-image-or"><span>OR</span></div>
      <div class="bwa-course-image-upload-row">
        <label class="bwa-course-image-file-button" for="bwaCourseImageFile">Upload image</label>
        <input id="bwaCourseImageFile" type="file" accept="image/*,.heic,.heif,.tif,.tiff,.avif,.svg,.ico" hidden>
        <div class="bwa-course-image-upload-copy">
          <b>Choose image from computer / phone</b>
          <small>Maximum 12 MB. Uploaded image is stored on this website and used as the course thumbnail.</small>
        </div>
      </div>
      <p id="bwaCourseImageUploadStatus" class="bwa-course-image-upload-status" aria-live="polite"></p>
    `;
    label.insertAdjacentElement('afterend',box);

    const preview=document.createElement('div');
    preview.id='bwaCourseImagePreview';
    preview.className='span-2 bwa-course-image-preview';
    preview.hidden=true;
    preview.innerHTML='<img alt="Course image preview"><small>Course image preview</small>';
    box.insertAdjacentElement('afterend',preview);

    const file=box.querySelector('#bwaCourseImageFile');
    const status=box.querySelector('#bwaCourseImageUploadStatus');
    const previewImg=preview.querySelector('img');
    previewImg.addEventListener('error',()=>{
      if(status&&!status.classList.contains('success')){
        status.textContent='Preview could not be loaded. For URL images, Save Course will try to import the image to this website.';
      }
    });

    file.addEventListener('change',async()=>{
      const selected=file.files?.[0];
      if(!selected)return;
      status.classList.remove('success','error');
      if(selected.size>12*1024*1024){
        status.textContent='Image is larger than 12 MB. Please choose a smaller image.';
        status.classList.add('error');
        file.value='';
        return;
      }
      status.textContent=`Uploading ${selected.name}…`;
      const saveButton=form.querySelector('button[type="submit"]');
      if(saveButton)saveButton.disabled=true;
      try{
        const bridge=await backend();
        const body=new FormData();
        body.append('image',selected,selected.name);
        const out=await bridge.api('/api/admin/manage/course-images',{method:'POST',body});
        const url=String(out?.url||'').trim();
        if(!url)throw new Error('Image upload completed but no image URL was returned.');
        input.value=url;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        status.textContent='✓ Image uploaded successfully. Save the course to use it.';
        status.classList.add('success');
        updateCourseImagePreview();
      }catch(err){
        status.textContent=imageErrorText(err);
        status.classList.add('error');
      }finally{
        if(saveButton)saveButton.disabled=false;
        file.value='';
      }
    });
  }

  if(input.dataset.bwaPreviewBound!=='1'){
    input.dataset.bwaPreviewBound='1';
    input.addEventListener('input',updateCourseImagePreview);
    input.addEventListener('change',updateCourseImagePreview);
  }
  updateCourseImagePreview();
  return input;
}

function installExternalCourseUi(){
  ensureCourseLinkField();
  ensureCourseImageUi();
  ensureFreeCourseField();
  syncFreeCourseUi();
  if(!$('#bwaExternalCourseAdminStyle')){
    const style=document.createElement('style');
    style.id='bwaExternalCourseAdminStyle';
    style.textContent=`
      [data-panel="courses"] .admin-table th:nth-child(4),[data-panel="courses"] .admin-table td:nth-child(4),[data-course-curriculum]{display:none!important}
      .admin-free-course-field{align-self:end;min-height:54px}.admin-free-course-field small{display:block;margin-top:3px;color:#667085}
      .bwa-course-image-help{display:block;margin-top:7px;color:#667085;line-height:1.45;font-weight:500}.bwa-course-image-help b{color:#344054}
      .bwa-course-image-upload{min-width:0}.bwa-course-image-or{display:flex;align-items:center;gap:12px;margin:0 0 11px;color:#98a2b3;font-size:11px;font-weight:800;letter-spacing:.1em}
      .bwa-course-image-or:before,.bwa-course-image-or:after{content:'';height:1px;background:#e4e7ec;flex:1}
      .bwa-course-image-upload-row{display:flex;align-items:center;gap:14px;padding:14px;border:1px dashed #98a2b3;border-radius:8px;background:#f9fafb}
      .bwa-course-image-file-button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border-radius:6px;background:#6d28d9;color:#fff;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
      .bwa-course-image-file-button:hover{background:#4c1d95}.bwa-course-image-upload-copy{display:grid;gap:3px}.bwa-course-image-upload-copy b{font-size:13px;color:#344054}.bwa-course-image-upload-copy small{font-size:11px;color:#667085;line-height:1.4}
      .bwa-course-image-upload-status{min-height:18px;margin:7px 0 0;font-size:12px;color:#667085}.bwa-course-image-upload-status.success{color:#067647}.bwa-course-image-upload-status.error{color:#b42318}
      .bwa-course-image-preview{width:min(520px,100%);border:1px solid #d1d7dc;border-radius:8px;overflow:hidden;background:#f7f9fa}.bwa-course-image-preview[hidden]{display:none!important}.bwa-course-image-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#202230}.bwa-course-image-preview small{display:block;padding:7px 10px;background:#fff;color:#667085}
      @media(max-width:640px){.bwa-course-image-upload-row{align-items:flex-start;flex-direction:column}.bwa-course-image-file-button{width:100%}}
    `;
    document.head.appendChild(style);
  }
  const description=document.querySelector('[data-panel="courses"] .admin-heading p:not(.eyebrow)');
  if(description)description.textContent='Create, publish, price and connect each course to its Udemy or external learning link.';
}

function toast(text,error=false){
  const el=$('#adminToast');
  if(!el){if(error)alert(text);return}
  el.textContent=text;
  el.classList.toggle('error',error);
  el.classList.add('show');
  clearTimeout(window.__bwaAdminCourseToast);
  window.__bwaAdminCourseToast=setTimeout(()=>el.classList.remove('show'),4200);
}

async function backend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  return window.BWABackend;
}

function courseRequest(url,options){
  const path=typeof url==='string'?url:(url?.url||'');
  const method=String(options?.method||'GET').toUpperCase();
  return /^\/api\/admin\/manage\/courses(?:\/\d+)?(?:\?.*)?$/.test(path)&&['POST','PUT'].includes(method);
}

function imageErrorText(err){
  if(err?.data?.errors)return Object.values(err.data.errors).flat().join(' ');
  return err?.data?.message||err?.message||'Image URL could not be imported.';
}

function isStoredCourseImage(value){
  if(!value)return false;
  try{
    const url=new URL(value,location.origin);
    return url.origin===location.origin&&url.pathname.startsWith('/api/course-images/');
  }catch{return false}
}

async function localiseCourseImage(value){
  let image=String(value||'').trim();
  if(!image||isStoredCourseImage(image))return image;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(image)&&/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(image))image='https://'+image;
  if(!/^https?:\/\//i.test(image))return image;

  const bridge=await backend();
  const out=await bridge.api('/api/admin/manage/course-images/import',{
    method:'POST',body:JSON.stringify({url:image}),
  });
  const stored=String(out?.url||'').trim();
  if(!stored)throw new Error('Image was downloaded but no stored image URL was returned.');
  return stored;
}

const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,options={}){
  const isCourseSave=courseRequest(input,options);
  let freeCourse=false;
  let shouldSyncFree=false;

  if(isCourseSave){
    const dialog=$('#courseDialog');
    const inputEl=ensureCourseLinkField();
    const freeEl=ensureFreeCourseField();
    const link=String(inputEl?.value||'').trim();
    if(dialog?.open){
      if(!link){
        toast('Course access link is required.',true);
        inputEl?.focus();
        return new Response(JSON.stringify({message:'Course Link is required.',errors:{course_link:['Course Link is required.']}}),{
          status:422,headers:{'Content-Type':'application/json'}
        });
      }
      freeCourse=!!freeEl?.checked;
      shouldSyncFree=true;
      try{
        const body=typeof options.body==='string'?JSON.parse(options.body):{};
        body.course_link=link;
        body.price=freeCourse?0:Number(body.price||0);

        if(body.image){
          try{
            const storedImage=await localiseCourseImage(body.image);
            body.image=storedImage;
            const imageInput=$('#courseForm')?.elements?.image;
            if(imageInput&&storedImage){
              imageInput.value=storedImage;
              imageInput.dispatchEvent(new Event('input',{bubbles:true}));
            }
          }catch(err){
            const message=imageErrorText(err);
            toast(message,true);
            return new Response(JSON.stringify({message,errors:{image:[message]}}),{
              status:422,headers:{'Content-Type':'application/json'}
            });
          }
        }

        options={...options,body:JSON.stringify(body)};
      }catch(err){
        if(err instanceof SyntaxError){
          toast('Course form data could not be prepared.',true);
        }
      }
    }
  }

  const response=await nativeFetch(input,options);

  if(isCourseSave&&shouldSyncFree&&response.ok){
    try{
      const payload=await response.clone().json();
      const courseId=Number(payload?.course?.id||0);
      if(!courseId)throw new Error('Course ID was not returned after saving.');
      const bridge=await backend();
      await bridge.api(`/api/admin/manage/courses/${courseId}/free-status`,{
        method:'PUT',body:JSON.stringify({is_free:freeCourse}),
      });
      const verified=await bridge.api('/api/admin/manage/free-course-statuses');
      if(!!verified?.courses?.[String(courseId)]?.is_free!==freeCourse){
        throw new Error('Free course status database verification failed.');
      }
    }catch(err){
      toast(err?.message||'Course saved, but Free course status could not be verified.',true);
      throw err;
    }
  }

  return response;
};

async function fillEditCourseExtras(courseId){
  courseId=String(courseId||'');
  if(!courseId)return;
  try{
    const b=await backend();
    const [links,freeStatuses]=await Promise.all([
      b.api('/api/admin/manage/course-links'),
      b.api('/api/admin/manage/free-course-statuses'),
    ]);
    const saved=String(links?.links?.[courseId]||'');
    const freeInfo=freeStatuses?.courses?.[courseId]||{};
    const isFree=!!freeInfo.is_free;
    for(const delay of [20,100,260])setTimeout(()=>{
      const form=$('#courseForm'),dialog=$('#courseDialog'),input=ensureCourseLinkField(),free=ensureFreeCourseField();
      ensureCourseImageUi();
      if(!form||!dialog?.open||!input||!free)return;
      if(String(form.elements.id?.value||'')!==courseId)return;
      input.value=saved;
      free.checked=isFree;
      if(!isFree&&freeInfo.price!==undefined)form.elements.price.value=String(freeInfo.price);
      syncFreeCourseUi();
      updateCourseImagePreview();
    },delay);
  }catch(err){
    console.warn('[BWA course edit extras]',err?.message||err);
    toast('Could not load the saved Course Link / Free course status. Refresh and try again.',true);
  }
}

installExternalCourseUi();

document.addEventListener('click',e=>{
  if(!(e.target instanceof Element))return;
  const edit=e.target.closest('[data-course-edit]');
  if(edit){setTimeout(()=>{ensureCourseImageUi();resetCourseImageUploadUi();fillEditCourseExtras(edit.getAttribute('data-course-edit'))},0);return}
  if(e.target.closest('#addCourseBtn'))setTimeout(()=>{
    const input=ensureCourseLinkField(),free=ensureFreeCourseField(),price=$('#courseForm')?.elements.price;
    ensureCourseImageUi();
    if(input)input.value='';
    if(free)free.checked=false;
    if(price){price.disabled=false;price.required=true;delete price.dataset.paidPrice}
    resetCourseImageUploadUi();
  },20);
},true);

document.write('<script src="/assets/admin.js?rev=20260810-admin-management-v6"><\/script>');
document.write('<script src="/assets/admin-overview-reports.js?rev=20260812-admin-overview-reports-v1"><\/script>');
document.write('<script src="/assets/admin-messages.js?rev=20260810-admin-messages-v2"><\/script>');
document.write('<script src="/assets/admin-extras.js?rev=20260808-admin-management-v3"><\/script>');
document.write('<script src="/assets/admin-mobile.js?rev=20260808-admin-mobile-v1"><\/script>');
document.write('<script src="/assets/admin-payment-tools.js?rev=20260810-payment-v2"><\/script>');
})();
