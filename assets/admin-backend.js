(()=>{
  if(location.pathname!=='/admin')return;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let latest=null;

  async function refresh(){
    try{
      await window.BWABackend?.ready;
      if(!window.BWABackend?.available||window.BWABackend?.user?.role!=='admin')return;
      const data=await window.BWABackend.api('/api/admin/overview');latest=data;
      const m=data.metrics||{};
      if($('#adminCourseCount'))$('#adminCourseCount').textContent=Number(m.courses||0).toLocaleString();
      if($('#adminStudentCount'))$('#adminStudentCount').textContent=Number(m.students||0).toLocaleString();
      if($('#adminEnrollmentCount'))$('#adminEnrollmentCount').textContent=Number(m.enrollments||0).toLocaleString();
      if($('#adminRevenue'))$('#adminRevenue').textContent=money(m.revenue||0);

      const top=$('#adminTopCourses');
      if(top)top.innerHTML=(data.courses||[]).slice(0,8).map(c=>`<div class="admin-list-row"><div><strong>${esc(c.title)}</strong><small>${esc(c.category)} · ${esc(c.status)}</small></div><div><small>${Number(c.enrollment_count||0).toLocaleString()} enrollments</small><div class="admin-progress"><i style="width:${Math.min(100,Number(c.enrollment_count||0)*5)}%"></i></div></div></div>`).join('')||'<div class="admin-empty">No courses yet.</div>';

      const activity=$('#adminActivity'),orders=data.orders||[],students=data.students||[];
      if(activity){const rows=[];orders.slice(0,4).forEach(o=>rows.push(`<div class="admin-list-row"><div><strong>${esc(o.number)}</strong><small>${new Date(o.created_at).toLocaleString()} · ${esc(o.customer_name)}</small></div><b>${money(o.total)}</b></div>`));students.slice(0,3).forEach(u=>rows.push(`<div class="admin-list-row"><div><strong>${esc(u.name)}</strong><small>Student · ${Number(u.enrollment_count||0)} enrollment(s)</small></div><small>${esc(u.email)}</small></div>`));activity.innerHTML=rows.join('')||'<div class="admin-empty">No activity yet.</div>'}

      const studentBody=$('#adminStudentsBody'),studentEmpty=$('#adminStudentsEmpty');
      if(studentBody)studentBody.innerHTML=students.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${Number(u.enrollment_count||0)>0?'Active learner':'Registered'}</td></tr>`).join('');
      if(studentEmpty)studentEmpty.hidden=students.length>0;

      const orderBody=$('#adminOrdersBody'),orderEmpty=$('#adminOrdersEmpty');
      if(orderBody)orderBody.innerHTML=orders.map(o=>`<tr><td><strong>${esc(o.number)}</strong><small style="display:block;color:#667085">${esc(o.customer_name)} · ${esc(o.customer_email)}</small></td><td>${new Date(o.created_at).toLocaleString()}</td><td>${Number(o.item_count||0)}</td><td>${money(o.total)}</td></tr>`).join('');
      if(orderEmpty)orderEmpty.hidden=orders.length>0;

      const badge=$('.admin-demo-badge');if(badge)badge.textContent=`Admin Console · ${Number(m.open_support||0)} support open`;
    }catch(err){console.warn('[BWA admin overview]',err.message)}
  }

  document.addEventListener('click',e=>{
    const el=e.target instanceof Element?e.target:null;
    if(el?.closest('#clearLearningData')){
      e.preventDefault();e.stopImmediatePropagation();alert('Production learning records are stored in MySQL and are not cleared from this browser.');return;
    }
    if(el?.closest('#resetCourseOverrides,#resetCourseOverrides2')){
      e.preventDefault();e.stopImmediatePropagation();alert('Production course data is stored in MySQL. Edit the course you want to change instead of resetting the catalog.');return;
    }
    if(el?.closest('#exportAdminData')&&latest){
      e.preventDefault();e.stopImmediatePropagation();const blob=new Blob([JSON.stringify({...latest,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='best-way-academy-admin-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return;
    }
  },true);

  document.addEventListener('submit',e=>{if(e.target instanceof HTMLFormElement&&e.target.id==='courseEditForm')setTimeout(refresh,900)},true);
  window.addEventListener('focus',()=>setTimeout(refresh,150));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,250));else setTimeout(refresh,250);
})();
