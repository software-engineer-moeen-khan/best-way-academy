(()=>{
'use strict';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let categories=new Map();
let loading=false;

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

async function loadCategories(){
  if(loading)return;
  loading=true;
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/workspace');
    categories=new Map((out?.categories||[]).map(c=>[Number(c.id),c]));
    decorateRows();
  }catch(err){
    console.warn('[BWA category visibility]',err?.message||err);
  }finally{
    loading=false;
  }
}

function decorateRows(){
  const body=$('#adminCategoriesBody');
  if(!body)return;
  body.querySelectorAll('tr').forEach(row=>{
    const edit=row.querySelector('[data-category-edit]');
    const actions=edit?.closest('.admin-actions');
    if(!edit||!actions)return;
    const id=Number(edit.getAttribute('data-category-edit'));
    const category=categories.get(id);
    if(!category)return;

    let button=actions.querySelector('[data-category-visibility]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='admin-small';
      button.setAttribute('data-category-visibility',String(id));
      const deleteButton=actions.querySelector('[data-category-delete]');
      if(deleteButton)actions.insertBefore(button,deleteButton);else actions.appendChild(button);
    }
    button.textContent=category.active?'Hide':'Show';
    button.title=category.active?'Hide this category from public category listings':'Show this category publicly again';
    button.classList.toggle('primary',!category.active);
  });
}

async function toggleCategory(id,button){
  const category=categories.get(Number(id));
  if(!category)return loadCategories();
  const nextActive=!category.active;
  const action=nextActive?'show':'hide';
  const detail=nextActive
    ? `Show category “${category.name}” on the public website again?`
    : `Hide category “${category.name}” from public category listings?\n\nCourses inside it will not be deleted.`;
  if(!confirm(detail))return;

  const old=button.textContent;
  button.disabled=true;
  button.textContent=nextActive?'Showing…':'Hiding…';
  try{
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
    category.active=nextActive;
    categories.set(Number(id),category);
    toast(`Category ${action==='hide'?'hidden':'shown'} successfully.`);
    const refresh=$('#adminRefresh');
    if(refresh)refresh.click();
    setTimeout(loadCategories,350);
  }catch(err){
    const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||`Could not ${action} category.`);
    toast(text,true);
    button.textContent=old;
  }finally{
    button.disabled=false;
  }
}

function install(){
  if(!$('#adminCategoriesBody'))return;
  loadCategories();
  const body=$('#adminCategoriesBody');
  if(!body.dataset.bwaCategoryVisibilityObserver){
    body.dataset.bwaCategoryVisibilityObserver='1';
    new MutationObserver(()=>{decorateRows();if(!categories.size)loadCategories();}).observe(body,{childList:true,subtree:true});
  }

  document.addEventListener('click',e=>{
    if(!(e.target instanceof Element))return;
    const button=e.target.closest('[data-category-visibility]');
    if(!button)return;
    e.preventDefault();
    e.stopPropagation();
    toggleCategory(Number(button.getAttribute('data-category-visibility')),button);
  },true);

  $('#adminRefresh')?.addEventListener('click',()=>setTimeout(loadCategories,300));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100),{once:true});else setTimeout(install,100);
})();
