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

function installExternalCourseUi(){
  ensureCourseLinkField();
  ensureFreeCourseField();
  syncFreeCourseUi();
  if(!$('#bwaExternalCourseAdminStyle')){
    const style=document.createElement('style');
    style.id='bwaExternalCourseAdminStyle';
    style.textContent='[data-panel="courses"] .admin-table th:nth-child(4),[data-panel="courses"] .admin-table td:nth-child(4),[data-course-curriculum]{display:none!important}.admin-free-course-field{align-self:end;min-height:54px}.admin-free-course-field small{display:block;margin-top:3px;color:#667085}';
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
        options={...options,body:JSON.stringify(body)};
      }catch{}
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
      if(!form||!dialog?.open||!input||!free)return;
      if(String(form.elements.id?.value||'')!==courseId)return;
      input.value=saved;
      free.checked=isFree;
      if(!isFree&&freeInfo.price!==undefined)form.elements.price.value=String(freeInfo.price);
      syncFreeCourseUi();
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
  if(edit){setTimeout(()=>fillEditCourseExtras(edit.getAttribute('data-course-edit')),0);return}
  if(e.target.closest('#addCourseBtn'))setTimeout(()=>{
    const input=ensureCourseLinkField(),free=ensureFreeCourseField(),price=$('#courseForm')?.elements.price;
    if(input)input.value='';
    if(free)free.checked=false;
    if(price){price.disabled=false;price.required=true;delete price.dataset.paidPrice}
  },20);
},true);

document.write('<script src="/assets/admin.js?rev=20260810-admin-management-v6"><\/script>');
document.write('<script src="/assets/admin-overview-reports.js?rev=20260812-admin-overview-reports-v1"><\/script>');
document.write('<script src="/assets/admin-messages.js?rev=20260810-admin-messages-v2"><\/script>');
document.write('<script src="/assets/admin-extras.js?rev=20260808-admin-management-v3"><\/script>');
document.write('<script src="/assets/admin-mobile.js?rev=20260808-admin-mobile-v1"><\/script>');
document.write('<script src="/assets/admin-payment-tools.js?rev=20260810-payment-v2"><\/script>');
})();
