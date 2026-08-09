(()=>{
'use strict';
let linkMap={};
const $=s=>document.querySelector(s);
const lines=v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean);

function toast(text,error=false){
  const el=$('#adminToast');
  if(!el){if(error)alert(text);return}
  el.textContent=text;el.classList.toggle('error',error);el.classList.add('show');
  clearTimeout(window.__bwaCourseLinkToast);
  window.__bwaCourseLinkToast=setTimeout(()=>el.classList.remove('show'),3600);
}

function errorText(err){
  if(err?.data?.errors)return Object.values(err.data.errors).flat().join(' ');
  return err?.data?.message||err?.message||'Request failed.';
}

function installField(){
  const form=$('#courseForm');
  if(!form||form.elements.course_link)return;
  const label=document.createElement('label');
  label.className='span-2 admin-course-link-field';
  label.innerHTML='Course link <small>Required. Web, internal and app/deep links are supported. Students receive it only after payment/access is approved.</small><input name="course_link" type="text" inputmode="url" required maxlength="2048" placeholder="https://... · www... · /path · whatsapp://..." autocomplete="off">';
  const image=form.elements.image?.closest('label');
  if(image)image.insertAdjacentElement('afterend',label);else form.querySelector('.admin-form-grid')?.appendChild(label);
}

async function bridge(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

async function loadLinks(){
  try{
    const b=await bridge();
    const out=await b.api('/api/admin/manage/course-links');
    linkMap=out.links||{};
  }catch(e){console.warn('[BWA course links]',e.message)}
}

function setFormLink(id=''){
  installField();
  const input=$('#courseForm [name=course_link]');if(!input)return;
  input.value=id?(linkMap[String(id)]||''):'';
}

function payloadFromForm(form){
  return {
    title:String(form.elements.title?.value||'').trim(),
    slug:String(form.elements.slug?.value||'').trim()||null,
    category:String(form.elements.category?.value||''),
    subtitle:String(form.elements.subtitle?.value||'').trim()||null,
    description:String(form.elements.description?.value||'').trim()||null,
    price:Number(form.elements.price?.value||0),
    status:String(form.elements.status?.value||'draft'),
    image:String(form.elements.image?.value||'').trim()||null,
    badge:String(form.elements.badge?.value||'').trim()||null,
    instructor_id:form.elements.instructor_id?.value?Number(form.elements.instructor_id.value):null,
    learn:lines(form.elements.learn?.value),
    modules:lines(form.elements.modules?.value),
  };
}

async function saveCourseWithLink(form){
  const id=Number(form.elements.id?.value||0);
  const link=String(form.elements.course_link?.value||'').trim();
  if(!link){toast('Course Link is required.',true);form.elements.course_link?.focus();return}

  const submit=form.querySelector('button[type="submit"]');
  const original=submit?.textContent||'Save course';
  if(submit){submit.disabled=true;submit.textContent='Saving course & link…'}

  try{
    const b=await bridge();
    const out=await b.api(id?`/api/admin/manage/courses/${id}`:'/api/admin/manage/courses',{
      method:id?'PUT':'POST',
      body:JSON.stringify(payloadFromForm(form)),
    });
    const courseId=Number(out?.course?.id||id||0);
    if(!courseId)throw new Error('Course was saved but its ID was not returned.');

    const saved=await b.api(`/api/admin/manage/course-links/${courseId}`,{
      method:'PUT',
      body:JSON.stringify({course_link:link}),
    });
    if(!saved?.ok||!saved?.course_link)throw new Error('Course Link could not be verified after saving.');

    linkMap[String(courseId)]=saved.course_link;
    form.elements.course_link.value=saved.course_link;
    form.closest('dialog')?.close();
    toast(id?'Course and link updated successfully.':'Course and link created successfully.');
    setTimeout(()=>$('#adminRefresh')?.click(),80);
  }catch(err){
    toast(errorText(err),true);
  }finally{
    if(submit){submit.disabled=false;submit.textContent=original}
  }
}

// This capture handler owns Add/Edit Course saving so the course and access link are both
// confirmed before the dialog closes. It intentionally runs before the legacy admin.js handler.
document.addEventListener('submit',e=>{
  if(!(e.target instanceof HTMLFormElement)||e.target.id!=='courseForm')return;
  e.preventDefault();
  e.stopImmediatePropagation();
  saveCourseWithLink(e.target);
},true);

document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-course-edit]');
  if(edit){
    const id=edit.dataset.courseEdit;
    setTimeout(async()=>{
      if(!Object.prototype.hasOwnProperty.call(linkMap,String(id)))await loadLinks();
      setFormLink(id);
    },0);
    return;
  }
  if(e.target.closest?.('#addCourseBtn'))setTimeout(()=>setFormLink(''),0);
},true);

async function init(){installField();await loadLinks()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
