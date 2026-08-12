(()=>{
'use strict';
if(window.__bwaAuthoritativeCourseLinkSave)return;window.__bwaAuthoritativeCourseLinkSave=true;
const $=s=>document.querySelector(s);
const lines=v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean);
let api=null,linkMap={},freeMap={};

function toast(text,error=false){
  const el=$('#adminToast');
  if(!el){if(error)alert(text);return}
  el.textContent=text;el.classList.toggle('error',error);el.classList.add('show');
  clearTimeout(window.__bwaCourseLinkToast);
  window.__bwaCourseLinkToast=setTimeout(()=>el.classList.remove('show'),3800);
}
function errorText(err){
  if(err?.data?.errors)return Object.values(err.data.errors).flat().join(' ');
  return err?.data?.message||err?.message||'Request failed.';
}
function ensureField(){
  const form=$('#courseForm');if(!form)return null;
  let input=form.elements.course_link;
  if(!input){
    const label=document.createElement('label');
    label.className='span-2 admin-course-link-field';
    label.innerHTML='Course access link <small>Required. Paste the Udemy course URL or any external course link. Students see it only after payment/enrollment access is granted.</small><input name="course_link" type="text" inputmode="url" required maxlength="2048" placeholder="https://www.udemy.com/course/..." autocomplete="off">';
    const image=form.elements.image?.closest('label');
    if(image)image.insertAdjacentElement('afterend',label);else form.querySelector('.admin-form-grid')?.appendChild(label);
    input=form.elements.course_link;
  }
  return input;
}
function syncFreeUi(){
  const form=$('#courseForm');if(!form)return;
  const checkbox=form.elements.is_free,price=form.elements.price;
  if(!checkbox||!price)return;
  const free=!!checkbox.checked;
  if(free){
    if(!price.dataset.paidPrice&&Number(price.value)>0)price.dataset.paidPrice=price.value;
    price.value='0';price.disabled=true;price.required=false;
  }else{
    price.disabled=false;price.required=true;
    if(Number(price.value)===0&&price.dataset.paidPrice)price.value=price.dataset.paidPrice;
  }
}
function ensureFreeField(){
  const form=$('#courseForm');if(!form)return null;
  let input=form.elements.is_free;
  if(!input){
    const label=document.createElement('label');
    label.className='admin-check admin-free-course-field';
    label.innerHTML='<input name="is_free" type="checkbox"> <span><b>Free course</b><small>Students enroll instantly. No coupon or EasyPaisa checkout is required.</small></span>';
    const price=form.elements.price?.closest('label');
    if(price)price.insertAdjacentElement('afterend',label);else form.querySelector('.admin-form-grid')?.appendChild(label);
    input=form.elements.is_free;
    input?.addEventListener('change',syncFreeUi);
  }
  return input;
}
function installExternalUi(){
  ensureField();ensureFreeField();syncFreeUi();
  if(!document.querySelector('#bwaExternalCourseAdminStyle')){
    const style=document.createElement('style');style.id='bwaExternalCourseAdminStyle';
    style.textContent='[data-panel="courses"] .admin-table th:nth-child(4),[data-panel="courses"] .admin-table td:nth-child(4),[data-course-curriculum]{display:none!important}.admin-free-course-field{align-self:end;min-height:54px}.admin-free-course-field small{display:block;color:#667085;margin-top:3px}';
    document.head.appendChild(style);
  }
  const p=document.querySelector('[data-panel="courses"] .admin-heading p:not(.eyebrow)');
  if(p)p.textContent='Create, publish, price and connect each course to its Udemy or external learning link.';
}
async function ready(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  api=window.BWABackend.api;return api;
}
async function reloadLinks(){
  if(!api)await ready();
  const out=await api('/api/admin/manage/course-links');
  linkMap=out?.links||{};return linkMap;
}
async function reloadFreeStatuses(){
  if(!api)await ready();
  const out=await api('/api/admin/manage/free-course-statuses');
  freeMap=out?.courses||{};return freeMap;
}
async function fillEdit(id){
  id=String(id||'');if(!id)return;
  try{
    await Promise.all([reloadLinks(),reloadFreeStatuses()]);
    const value=String(linkMap[id]||'');
    const free=!!freeMap[id]?.is_free;
    for(const delay of [30,120,260])setTimeout(()=>{
      const form=$('#courseForm'),dialog=$('#courseDialog'),input=ensureField(),freeInput=ensureFreeField();
      if(!form||!dialog?.open||!input||!freeInput)return;
      if(String(form.elements.id?.value||'')!==id)return;
      input.value=value;
      freeInput.checked=free;
      if(!free&&freeMap[id]?.price!==undefined)form.elements.price.value=String(freeMap[id].price);
      syncFreeUi();
    },delay);
  }catch(err){console.warn('[BWA course edit extras]',err.message)}
}
function payload(form){
  const isFree=!!ensureFreeField()?.checked;
  return {
    title:String(form.elements.title?.value||'').trim(),
    slug:String(form.elements.slug?.value||'').trim()||null,
    category:String(form.elements.category?.value||''),
    subtitle:String(form.elements.subtitle?.value||'').trim()||null,
    description:String(form.elements.description?.value||'').trim()||null,
    price:isFree?0:Number(form.elements.price?.value||0),
    status:String(form.elements.status?.value||'draft'),
    image:String(form.elements.image?.value||'').trim()||null,
    badge:String(form.elements.badge?.value||'').trim()||null,
    instructor_id:form.elements.instructor_id?.value?Number(form.elements.instructor_id.value):null,
    course_link:String(ensureField()?.value||'').trim(),
    learn:lines(form.elements.learn?.value),
    modules:lines(form.elements.modules?.value),
  };
}
function isStoredCourseImage(value){
  if(!value)return false;
  try{
    const url=new URL(value,location.origin);
    return url.origin===location.origin&&url.pathname.startsWith('/api/course-images/');
  }catch{return false}
}
async function localiseImage(form,body,button){
  const raw=String(body.image||'').trim();
  if(!raw||isStoredCourseImage(raw))return;

  let external=raw;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(external)&&/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(external))external='https://'+external;
  if(!/^https?:\/\//i.test(external))return;

  if(button)button.textContent='Preparing image…';
  const out=await api('/api/admin/manage/course-images/import',{
    method:'POST',body:JSON.stringify({url:external}),
  });
  const stored=String(out?.url||'').trim();
  if(!stored)throw new Error('The image was downloaded but no stored image URL was returned.');
  body.image=stored;
  if(form.elements.image){
    form.elements.image.value=stored;
    form.elements.image.dispatchEvent(new Event('input',{bubbles:true}));
  }
}
async function authoritativeSave(form){
  const id=Number(form.elements.id?.value||0),body=payload(form),input=ensureField(),isFree=!!ensureFreeField()?.checked;
  if(!body.course_link){toast('Course access link is required.',true);input?.focus();return}
  const button=form.querySelector('button[type="submit"]'),original=button?.textContent||'Save course';
  if(button){button.disabled=true;button.textContent='Saving course…'}
  try{
    if(!api)await ready();
    await localiseImage(form,body,button);
    if(button)button.textContent='Saving course…';
    const out=await api(id?`/api/admin/manage/courses/${id}`:'/api/admin/manage/courses',{
      method:id?'PUT':'POST',body:JSON.stringify(body),
    });
    const courseId=Number(out?.course?.id||id||0),saved=String(out?.course?.course_link||'').trim();
    if(!courseId)throw new Error('Course ID was not returned after saving.');
    if(!saved)throw new Error('Course saved, but Course Link was not persisted.');

    await api(`/api/admin/manage/courses/${courseId}/free-status`,{
      method:'PUT',body:JSON.stringify({is_free:isFree}),
    });

    await Promise.all([reloadLinks(),reloadFreeStatuses()]);
    const verified=String(linkMap[String(courseId)]||'').trim();
    if(!verified)throw new Error('Course Link database verification failed.');
    if(!!freeMap[String(courseId)]?.is_free!==isFree)throw new Error('Free course status database verification failed.');

    if(input)input.value=verified;
    form.closest('dialog')?.close();
    toast(isFree?(id?'Free course updated successfully.':'Free course created successfully.'):(id?'Course updated successfully.':'Course created successfully.'));
    setTimeout(()=>$('#adminRefresh')?.click(),100);
  }catch(err){toast(errorText(err),true)}finally{
    if(button){button.disabled=false;button.textContent=original}
  }
}

document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='courseForm')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  authoritativeSave(form);
},true);

document.addEventListener('click',e=>{
  const edit=e.target instanceof Element?e.target.closest('[data-course-edit]'):null;
  if(edit){setTimeout(()=>fillEdit(edit.getAttribute('data-course-edit')),0);return}
  if(e.target instanceof Element&&e.target.closest('#addCourseBtn'))setTimeout(()=>{
    const input=ensureField(),freeInput=ensureFreeField(),price=$('#courseForm')?.elements.price;
    if(input)input.value='';
    if(freeInput)freeInput.checked=false;
    if(price){price.disabled=false;price.required=true;delete price.dataset.paidPrice}
  },30);
},true);

async function init(){installExternalUi();try{await ready();await Promise.all([reloadLinks(),reloadFreeStatuses()])}catch(err){console.warn('[BWA course extras]',err.message)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
