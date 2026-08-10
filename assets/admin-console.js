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

// Keep the core admin.js save flow. We only enrich its outgoing JSON payload with
// the Course Link currently visible in the Add/Edit Course modal.
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,options={}){
  if(courseRequest(input,options)){
    const dialog=$('#courseDialog');
    const inputEl=ensureCourseLinkField();
    const link=String(inputEl?.value||'').trim();
    // Only inject during an actual Add/Edit modal save. Publish/Hide uses the same
    // endpoint without opening the modal and must preserve the existing link.
    if(dialog?.open){
      if(!link){
        toast('Course access link is required.',true);
        inputEl?.focus();
        return new Response(JSON.stringify({message:'Course Link is required.',errors:{course_link:['Course Link is required.']}}),{
          status:422,headers:{'Content-Type':'application/json'}
        });
      }
      try{
        const body=typeof options.body==='string'?JSON.parse(options.body):{};
        body.course_link=link;
        options={...options,body:JSON.stringify(body)};
      }catch{}
    }
  }
  return nativeFetch(input,options);
};

async function fillEditCourseLink(courseId){
  courseId=String(courseId||'');
  if(!courseId)return;
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/course-links');
    const saved=String(out?.links?.[courseId]||'');
    for(const delay of [20,100,260])setTimeout(()=>{
      const form=$('#courseForm'),dialog=$('#courseDialog'),input=ensureCourseLinkField();
      if(!form||!dialog?.open||!input)return;
      if(String(form.elements.id?.value||'')!==courseId)return;
      input.value=saved;
    },delay);
  }catch(err){
    console.warn('[BWA course link edit]',err?.message||err);
    toast('Could not load the saved Course Link. Refresh and try again.',true);
  }
}

installExternalCourseUi();

document.addEventListener('click',e=>{
  if(!(e.target instanceof Element))return;
  const edit=e.target.closest('[data-course-edit]');
  if(edit){setTimeout(()=>fillEditCourseLink(edit.getAttribute('data-course-edit')),0);return}
  if(e.target.closest('#addCourseBtn'))setTimeout(()=>{const input=ensureCourseLinkField();if(input)input.value=''},20);
},true);

document.write('<script src="/assets/admin.js?rev=20260810-admin-management-v6"><\/script>');
document.write('<script src="/assets/admin-extras.js?rev=20260808-admin-management-v3"><\/script>');
document.write('<script src="/assets/admin-mobile.js?rev=20260808-admin-mobile-v1"><\/script>');
document.write('<script src="/assets/admin-payment-tools.js?rev=20260810-payment-v2"><\/script>');
})();
