(()=>{
'use strict';

const selected=new Set();
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function toast(message,error=false){
  const el=$('#adminToast');
  if(el){
    el.textContent=message;
    el.classList.toggle('error',error);
    el.classList.add('show');
    clearTimeout(window.__bwaBulkFreeToast);
    window.__bwaBulkFreeToast=setTimeout(()=>el.classList.remove('show'),4200);
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

function visibleIds(){
  return $$('#adminCoursesBody tr [data-course-edit]').map(el=>Number(el.getAttribute('data-course-edit'))).filter(Number.isInteger);
}

function syncControls(){
  const count=$('#bwaCourseBulkCount');
  const button=$('#bwaMarkCoursesFree');
  const selectAll=$('#bwaSelectVisibleCourses');
  const ids=visibleIds();
  if(count)count.textContent=`${selected.size} selected`;
  if(button)button.disabled=selected.size===0;
  if(selectAll){
    const selectedVisible=ids.filter(id=>selected.has(id)).length;
    selectAll.checked=ids.length>0&&selectedVisible===ids.length;
    selectAll.indeterminate=selectedVisible>0&&selectedVisible<ids.length;
  }
}

function decorateRows(){
  const body=$('#adminCoursesBody');
  if(!body)return;
  body.querySelectorAll('tr').forEach(row=>{
    const edit=row.querySelector('[data-course-edit]');
    const cell=row.cells?.[0];
    if(!edit||!cell||cell.querySelector('[data-bwa-bulk-course]'))return;
    const id=Number(edit.getAttribute('data-course-edit'));
    if(!Number.isInteger(id)||id<1)return;
    cell.classList.add('bwa-course-select-cell');
    const label=document.createElement('label');
    label.className='bwa-bulk-course-select';
    label.title='Select this course';
    label.innerHTML=`<input type="checkbox" data-bwa-bulk-course="${id}" aria-label="Select course">`;
    const input=label.querySelector('input');
    input.checked=selected.has(id);
    input.addEventListener('change',()=>{
      if(input.checked)selected.add(id);else selected.delete(id);
      syncControls();
    });
    cell.insertBefore(label,cell.firstChild);
  });
  syncControls();
}

function installStyle(){
  if($('#bwaBulkFreeStyle'))return;
  const style=document.createElement('style');
  style.id='bwaBulkFreeStyle';
  style.textContent=`
    .bwa-course-select-cell{display:flex!important;align-items:flex-start;gap:10px;min-width:330px}
    .bwa-course-select-cell>.admin-course-cell{min-width:0;flex:1}
    .bwa-bulk-course-select{display:flex;align-items:center;justify-content:center;padding-top:11px;flex:0 0 auto;cursor:pointer}
    .bwa-bulk-course-select input,.bwa-course-bulk-actions input{width:17px;height:17px;accent-color:#6d28d9;cursor:pointer}
    .bwa-course-bulk-actions{display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap;padding-left:8px}
    .bwa-course-bulk-actions label{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#344054;white-space:nowrap;cursor:pointer}
    .bwa-course-bulk-count{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:12px;font-weight:800;white-space:nowrap}
    #bwaMarkCoursesFree{min-height:36px;padding:8px 13px;white-space:nowrap}
    #bwaMarkCoursesFree:disabled{opacity:.5;cursor:not-allowed}
    @media(max-width:760px){.bwa-course-bulk-actions{width:100%;margin-left:0;padding-left:0}.bwa-course-select-cell{min-width:280px}}
  `;
  document.head.appendChild(style);
}

function installToolbar(){
  const toolbar=document.querySelector('[data-panel="courses"] .admin-toolbar');
  if(!toolbar||$('#bwaCourseBulkActions'))return;
  const actions=document.createElement('div');
  actions.id='bwaCourseBulkActions';
  actions.className='bwa-course-bulk-actions';
  actions.innerHTML=`
    <label><input id="bwaSelectVisibleCourses" type="checkbox"> Select visible</label>
    <span id="bwaCourseBulkCount" class="bwa-course-bulk-count">0 selected</span>
    <button id="bwaMarkCoursesFree" type="button" class="admin-primary" disabled>Mark as Free</button>
  `;
  toolbar.appendChild(actions);

  $('#bwaSelectVisibleCourses').addEventListener('change',e=>{
    const ids=visibleIds();
    if(e.target.checked)ids.forEach(id=>selected.add(id));else ids.forEach(id=>selected.delete(id));
    $$('#adminCoursesBody [data-bwa-bulk-course]').forEach(input=>{input.checked=selected.has(Number(input.dataset.bwaBulkCourse));});
    syncControls();
  });

  $('#bwaMarkCoursesFree').addEventListener('click',markSelectedFree);
}

async function markSelectedFree(){
  const ids=[...selected].filter(Number.isInteger);
  if(!ids.length)return;
  const confirmed=confirm(`Mark ${ids.length} selected course${ids.length===1?'':'s'} as FREE?\n\nTheir price will be changed to 0 and learners will be able to enroll without checkout.`);
  if(!confirmed)return;

  const button=$('#bwaMarkCoursesFree');
  const old=button?.textContent||'Mark as Free';
  if(button){button.disabled=true;button.textContent='Marking as Free…';}
  try{
    const b=await backend();
    const out=await b.api(`/api/admin/manage/courses/${ids[0]}/free-status`,{
      method:'PUT',
      body:JSON.stringify({is_free:true,course_ids:ids})
    });
    const updated=Number(out?.updated_count??ids.length);
    selected.clear();
    toast(`${updated} course${updated===1?'':'s'} marked as Free.`);
    const refresh=$('#adminRefresh');
    if(refresh)refresh.click();
    else location.reload();
  }catch(err){
    const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not mark the selected courses as free.');
    toast(text,true);
  }finally{
    if(button){button.textContent=old;button.disabled=selected.size===0;}
    syncControls();
  }
}

function install(){
  if(!document.querySelector('[data-panel="courses"]'))return;
  installStyle();
  installToolbar();
  decorateRows();
  const body=$('#adminCoursesBody');
  if(body&&!body.dataset.bwaBulkObserver){
    body.dataset.bwaBulkObserver='1';
    new MutationObserver(()=>decorateRows()).observe(body,{childList:true,subtree:true});
  }
  ['courseSearch','courseStatusFilter','courseCategoryFilter'].forEach(id=>{
    const el=$(`#${id}`);
    if(el&&!el.dataset.bwaBulkBound){
      el.dataset.bwaBulkBound='1';
      el.addEventListener('input',()=>setTimeout(decorateRows,0));
      el.addEventListener('change',()=>setTimeout(decorateRows,0));
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();
