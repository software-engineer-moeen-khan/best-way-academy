(()=>{
'use strict';
const $=s=>document.querySelector(s);
const lines=v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean);
let savingCourse=false;

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

function installExternalCourseUi(){
  ensureCourseLinkField();
  if(!$('#bwaExternalCourseAdminStyle')){
    const style=document.createElement('style');
    style.id='bwaExternalCourseAdminStyle';
    style.textContent='[data-panel="courses"] .admin-table th:nth-child(4),[data-panel="courses"] .admin-table td:nth-child(4),[data-course-curriculum]{display:none!important}';
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

function errorText(err){
  if(err?.data?.errors)return Object.values(err.data.errors).flat().join(' ');
  return err?.data?.message||err?.message||'Request failed.';
}

async function backend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

function coursePayload(form){
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
    course_link:String(ensureCourseLinkField()?.value||'').trim(),
    learn:lines(form.elements.learn?.value),
    modules:lines(form.elements.modules?.value),
  };
}

async function saveCourse(form){
  if(savingCourse)return;
  const id=Number(form.elements.id?.value||0);
  const payload=coursePayload(form);
  const input=ensureCourseLinkField();
  if(!payload.course_link){toast('Course access link is required.',true);input?.focus();return}

  const button=form.querySelector('button[type="submit"]');
  const oldText=button?.textContent||'Save course';
  savingCourse=true;
  if(button){button.disabled=true;button.textContent='Saving course & link…'}
  try{
    const b=await backend();
    const out=await b.api(id?`/api/admin/manage/courses/${id}`:'/api/admin/manage/courses',{
      method:id?'PUT':'POST',body:JSON.stringify(payload),
    });
    const courseId=Number(out?.course?.id||id||0);
    const returned=String(out?.course?.course_link||'').trim();
    if(!courseId||!returned)throw new Error('Course Link was not saved to the database.');

    const check=await b.api('/api/admin/manage/course-links');
    const verified=String(check?.links?.[String(courseId)]||'').trim();
    if(!verified)throw new Error('Course Link database verification failed.');

    if(input)input.value=verified;
    form.closest('dialog')?.close();
    toast(id?'Course and Course Link updated successfully.':'Course and Course Link created successfully.');
    setTimeout(()=>$('#adminRefresh')?.click(),100);
  }catch(err){
    toast(errorText(err),true);
  }finally{
    savingCourse=false;
    if(button){button.disabled=false;button.textContent=oldText}
  }
}

async function fillEditCourseLink(courseId){
  courseId=String(courseId||'');
  if(!courseId)return;
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/course-links');
    const saved=String(out?.links?.[courseId]||'');
    for(const delay of [40,140,320])setTimeout(()=>{
      const form=$('#courseForm'),dialog=$('#courseDialog'),input=ensureCourseLinkField();
      if(!form||!dialog?.open||!input)return;
      if(String(form.elements.id?.value||'')!==courseId)return;
      input.value=saved;
    },delay);
  }catch(err){
    console.warn('[BWA course link edit]',err.message);
    toast('Could not load the saved Course Link. Refresh and try again.',true);
  }
}

installExternalCourseUi();

// This listener is installed before admin.js and captures Course Save so the link can never be dropped.
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='courseForm')return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  saveCourse(form);
},true);

// admin.js opens the modal on the same click; load the saved link immediately after it has filled the form.
document.addEventListener('click',e=>{
  if(!(e.target instanceof Element))return;
  const edit=e.target.closest('[data-course-edit]');
  if(edit){setTimeout(()=>fillEditCourseLink(edit.getAttribute('data-course-edit')),0);return}
  if(e.target.closest('#addCourseBtn'))setTimeout(()=>{const input=ensureCourseLinkField();if(input)input.value=''},40);
},true);

document.write('<script src="/assets/admin.js?rev=20260810-admin-management-v5"><\/script>');
document.write('<script src="/assets/admin-extras.js?rev=20260808-admin-management-v3"><\/script>');
document.write('<script src="/assets/admin-mobile.js?rev=20260808-admin-mobile-v1"><\/script>');
document.write('<script src="/assets/admin-payment-tools.js?rev=20260810-payment-v2"><\/script>');
})();
