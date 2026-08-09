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

function installExternalCourseUi(){
  const form=$('#courseForm');
  if(form&&!form.elements.course_link){
    const label=document.createElement('label');
    label.className='span-2 admin-course-link-field';
    label.innerHTML='Course access link <small>Required. Paste the Udemy course URL or any external course link. Students see it only after enrollment/payment access is granted.</small><input name="course_link" type="text" inputmode="url" required maxlength="2048" placeholder="https://www.udemy.com/course/..." autocomplete="off">';
    const image=form.elements.image?.closest('label');
    if(image)image.insertAdjacentElement('afterend',label);else form.querySelector('.admin-form-grid')?.appendChild(label);
  }

  if(!document.querySelector('#bwaExternalCourseAdminStyle')){
    const style=document.createElement('style');
    style.id='bwaExternalCourseAdminStyle';
    style.textContent='[data-panel="courses"] .admin-table th:nth-child(4),[data-panel="courses"] .admin-table td:nth-child(4),[data-course-curriculum]{display:none!important}';
    document.head.appendChild(style);
  }

  const description=document.querySelector('[data-panel="courses"] .admin-heading p:not(.eyebrow)');
  if(description)description.textContent='Create, publish, price and connect each course to its Udemy or external learning link.';
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
  const b=await bridge();
  const out=await b.api('/api/admin/manage/course-links');
  linkMap=out.links||{};
  return linkMap;
}

function setFormLink(id='',valueOverride){
  installExternalCourseUi();
  const form=$('#courseForm'),input=form?.elements.course_link;if(!input)return;
  const value=valueOverride!==undefined?valueOverride:(id?(linkMap[String(id)]||''):'');
  input.value=value||'';
}

async function fillEditLink(id){
  id=String(id||'');
  if(!id)return;
  try{
    await loadLinks();
    const value=linkMap[id]||'';
    [0,60,180].forEach(delay=>setTimeout(()=>{
      const form=$('#courseForm'),dialog=$('#courseDialog');
      if(!form||!dialog?.open)return;
      if(String(form.elements.id?.value||'')!==id)return;
      setFormLink(id,value);
    },delay));
  }catch(e){console.warn('[BWA course link reload]',e.message)}
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
    course_link:String(form.elements.course_link?.value||'').trim(),
    learn:lines(form.elements.learn?.value),
    modules:lines(form.elements.modules?.value),
  };
}

async function saveCourseWithLink(form){
  const id=Number(form.elements.id?.value||0);
  const payload=payloadFromForm(form);
  if(!payload.course_link){toast('Course access link is required.',true);form.elements.course_link?.focus();return}

  const submit=form.querySelector('button[type="submit"]');
  const original=submit?.textContent||'Save course';
  if(submit){submit.disabled=true;submit.textContent='Saving course & access link…'}

  try{
    const b=await bridge();
    const out=await b.api(id?`/api/admin/manage/courses/${id}`:'/api/admin/manage/courses',{
      method:id?'PUT':'POST',
      body:JSON.stringify(payload),
    });
    const courseId=Number(out?.course?.id||id||0);
    const savedLink=String(out?.course?.course_link||'').trim();
    if(!courseId||!savedLink)throw new Error('Course was saved but its access link was not returned.');

    linkMap[String(courseId)]=savedLink;
    setFormLink(String(courseId),savedLink);

    await loadLinks();
    if(String(linkMap[String(courseId)]||'').trim()!==savedLink){
      throw new Error('Course access link was not found after database verification.');
    }

    form.closest('dialog')?.close();
    toast(id?'Course and access link updated successfully.':'Course and access link created successfully.');
    setTimeout(()=>$('#adminRefresh')?.click(),80);
  }catch(err){toast(errorText(err),true)}finally{
    if(submit){submit.disabled=false;submit.textContent=original}
  }
}

document.addEventListener('submit',e=>{
  if(!(e.target instanceof HTMLFormElement)||e.target.id!=='courseForm')return;
  e.preventDefault();e.stopImmediatePropagation();saveCourseWithLink(e.target);
},true);

document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-course-edit]');
  if(edit){setTimeout(()=>fillEditLink(edit.dataset.courseEdit),0);return}
  if(e.target.closest?.('#addCourseBtn'))setTimeout(()=>setFormLink('',''),0);
},true);

function watchDialog(){
  const dialog=$('#courseDialog'),form=$('#courseForm');if(!dialog||!form)return;
  const observer=new MutationObserver(()=>{
    if(!dialog.open)return;
    setTimeout(()=>{const id=String(form.elements.id?.value||'');if(id)fillEditLink(id);else setFormLink('','')},0);
  });
  observer.observe(dialog,{attributes:true,attributeFilter:['open']});
}

async function init(){
  installExternalCourseUi();watchDialog();
  try{await loadLinks()}catch(e){console.warn('[BWA course links]',e.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
