(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
let linkMap={},saveArmed=false,pendingLink='';
const $=s=>document.querySelector(s);

function toast(text,error=false){
  const el=$('#adminToast');
  if(!el){if(error)alert(text);return}
  el.textContent=text;el.classList.toggle('error',error);el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3600);
}

function installField(){
  const form=$('#courseForm');
  if(!form||form.elements.course_link)return;
  const label=document.createElement('label');
  label.className='span-2 admin-course-link-field';
  label.innerHTML='Course link <small>Students receive this link only after access is granted.</small><input name="course_link" type="url" inputmode="url" required maxlength="2048" placeholder="https://your-course-platform.com/course/..." autocomplete="off">';
  const image=form.elements.image?.closest('label');
  if(image)image.insertAdjacentElement('afterend',label);else form.querySelector('.admin-form-grid')?.appendChild(label);
}

async function bridge(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)return null;
  await window.BWABackend.ready;
  return window.BWABackend.available?window.BWABackend:null;
}

async function loadLinks(){
  try{
    const b=await bridge();if(!b||b.user?.role!=='admin')return;
    const out=await b.api('/api/admin/manage/course-links');
    linkMap=out.links||{};
  }catch(e){console.warn('[BWA course links]',e.message)}
}

function setFormLink(id=''){
  installField();
  const input=$('#courseForm [name=course_link]');if(!input)return;
  input.value=id?(linkMap[String(id)]||''):'';
}

document.addEventListener('submit',e=>{
  if(!(e.target instanceof HTMLFormElement)||e.target.id!=='courseForm')return;
  installField();
  saveArmed=true;
  pendingLink=String(e.target.elements.course_link?.value||'').trim();
},true);

// The legacy course controller rewrites metadata on create/edit/publish/hide. Restore the
// secure external access link immediately after every course mutation so it can never be lost.
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  const match=url.match(/\/api\/admin\/manage\/courses(?:\/(\d+))?(?:\?.*)?$/);
  const isCourseMutation=!!match&&['POST','PUT'].includes(method);
  let existingId=match?.[1]?Number(match[1]):0;
  let linkToKeep=null;

  if(isCourseMutation){
    if(saveArmed)linkToKeep=pendingLink;
    else if(existingId){
      if(!Object.prototype.hasOwnProperty.call(linkMap,String(existingId)))await loadLinks();
      linkToKeep=Object.prototype.hasOwnProperty.call(linkMap,String(existingId))?(linkMap[String(existingId)]||''):null;
    }
  }

  const response=await nativeFetch(input,init);
  if(!isCourseMutation)return response;

  const wasFormSave=saveArmed;
  saveArmed=false;
  if(!response.ok||linkToKeep===null)return response;

  try{
    const payload=await response.clone().json();
    const courseId=Number(payload?.course?.id||existingId||0);
    if(!courseId)throw new Error('Saved course ID was not returned.');
    const b=await bridge();
    if(!b)throw new Error('Backend bridge is unavailable.');
    await b.api(`/api/admin/manage/course-links/${courseId}`,{method:'PUT',body:JSON.stringify({course_link:linkToKeep})});
    linkMap[String(courseId)]=linkToKeep;
  }catch(e){
    console.error('[BWA course link save]',e);
    if(wasFormSave)setTimeout(()=>toast(`Course was saved, but its access link could not be saved: ${e.message}`,true),0);
  }
  return response;
};

document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-course-edit]');
  if(edit){
    const id=edit.dataset.courseEdit;
    setTimeout(async()=>{if(!Object.prototype.hasOwnProperty.call(linkMap,String(id)))await loadLinks();setFormLink(id)},0);
    return;
  }
  if(e.target.closest?.('#addCourseBtn'))setTimeout(()=>setFormLink(''),0);
},true);

async function init(){installField();await loadLinks()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
