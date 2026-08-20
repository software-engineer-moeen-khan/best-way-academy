(()=>{
'use strict';

const $=s=>document.querySelector(s);

function toast(message,error=false){
  const el=$('#adminToast');
  if(el){
    el.textContent=message;
    el.classList.toggle('error',error);
    el.classList.add('show');
    clearTimeout(window.__bwaCategoryVisibilityToast);
    window.__bwaCategoryVisibilityToast=setTimeout(()=>el.classList.remove('show'),4200);
    return;
  }
  if(error)alert(message);
}

async function backend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available||window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

function rowIsActive(row){
  const statusCell=row?.cells?.[3];
  const text=String(statusCell?.textContent||'').trim().toLowerCase();
  return text!=='hidden';
}

function syncButton(button,active){
  const desired=active?'Hide':'Show';
  if(button.textContent!==desired)button.textContent=desired;
  button.dataset.categoryActive=active?'1':'0';
  button.title=active
    ?'Hide this category from the public website'
    :'Show this category on the public website';
  button.classList.toggle('primary',!active);
}

function decorateRows(){
  const body=$('#adminCategoriesBody');
  if(!body)return;

  body.querySelectorAll('tr').forEach(row=>{
    const edit=row.querySelector('[data-category-edit]');
    const actions=edit?.closest('.admin-actions');
    if(!edit||!actions)return;

    let button=actions.querySelector('[data-category-visibility]');
    if(button)return;

    const id=Number(edit.getAttribute('data-category-edit'));
    if(!Number.isInteger(id)||id<1)return;

    button=document.createElement('button');
    button.type='button';
    button.className='admin-small';
    button.setAttribute('data-category-visibility',String(id));
    syncButton(button,rowIsActive(row));

    const deleteButton=actions.querySelector('[data-category-delete]');
    if(deleteButton)actions.insertBefore(button,deleteButton);else actions.appendChild(button);
  });
}

async function getCategory(id){
  const b=await backend();
  const out=await b.api('/api/admin/manage/workspace');
  return (out?.categories||[]).find(category=>Number(category.id)===Number(id))||null;
}

async function toggleCategory(id,button){
  const active=button.dataset.categoryActive!=='0';
  const nextActive=!active;
  const row=button.closest('tr');
  const fallbackName=row?.cells?.[0]?.querySelector('strong')?.textContent?.trim()||'this category';

  const detail=nextActive
    ? `Show “${fallbackName}” on the public website again?`
    : `Hide “${fallbackName}” from the public website?\n\nCourses inside it will not be deleted.`;
  if(!confirm(detail))return;

  const oldText=button.textContent;
  button.disabled=true;
  button.textContent=nextActive?'Showing…':'Hiding…';

  try{
    const category=await getCategory(id);
    if(!category)throw new Error('Category could not be found.');

    const b=await backend();
    await b.api(`/api/admin/manage/categories/${id}`,{
      method:'PUT',
      body:JSON.stringify({
        name:category.name,
        slug:category.slug||null,
        description:category.description||null,
        icon:category.icon||null,
        position:Number(category.position||0),
        active:nextActive
      })
    });

    const statusCell=row?.cells?.[3];
    if(statusCell){
      statusCell.innerHTML=`<span class="status-pill status-${nextActive?'active':'hidden'}">${nextActive?'active':'hidden'}</span>`;
    }
    syncButton(button,nextActive);
    toast(`Category ${nextActive?'shown':'hidden'} successfully.`);
  }catch(err){
    button.textContent=oldText;
    const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not update category visibility.');
    toast(text,true);
  }finally{
    button.disabled=false;
  }
}

function install(){
  const body=$('#adminCategoriesBody');
  if(!body)return;

  decorateRows();

  if(!body.dataset.bwaCategoryVisibilityObserver){
    body.dataset.bwaCategoryVisibilityObserver='1';
    new MutationObserver(decorateRows).observe(body,{childList:true});
  }

  if(document.documentElement.dataset.bwaCategoryVisibilityClick!=='1'){
    document.documentElement.dataset.bwaCategoryVisibilityClick='1';
    document.addEventListener('click',e=>{
      if(!(e.target instanceof Element))return;
      const button=e.target.closest('[data-category-visibility]');
      if(!button)return;
      e.preventDefault();
      e.stopPropagation();
      toggleCategory(Number(button.getAttribute('data-category-visibility')),button);
    },true);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();
