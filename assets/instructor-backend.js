(()=>{
  if(location.pathname!=='/instructor')return;
  const $=(s,r=document)=>r.querySelector(s);
  const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function refresh(){
    try{
      await window.BWABackend?.ready;
      if(!window.BWABackend?.available||!['admin','instructor'].includes(window.BWABackend?.user?.role))return;
      const data=await window.BWABackend.api('/api/instructor/overview'),m=data.metrics||{},courses=data.courses||[],students=data.students||[];
      if($('#statCourses'))$('#statCourses').textContent=Number(m.courses||0).toLocaleString();
      if($('#statStudents'))$('#statStudents').textContent=Number(m.students||0).toLocaleString();
      if($('#statEnrollments'))$('#statEnrollments').textContent=Number(m.enrollments||0).toLocaleString();
      if($('#statRevenue'))$('#statRevenue').textContent=money(m.revenue||0);

      const overview=$('#overviewPerformance');
      if(overview)overview.innerHTML=courses.map(c=>`<div class="perf-row"><span>${esc(c.title)}</span><div class="perf-bar"><i style="width:${Math.min(100,Number(c.enrollment_count||0)*5)}%"></i></div><b>${Number(c.enrollment_count||0)}</b></div>`).join('')||'<p>No course activity yet.</p>';
      const performance=$('#coursePerformance');
      if(performance)performance.innerHTML=courses.map(c=>`<div class="perf-row"><span>${esc(c.title)}</span><div class="perf-bar"><i style="width:${Math.min(100,Number(c.enrollment_count||0)*5)}%"></i></div><b>${Number(c.enrollment_count||0)} learners</b></div>`).join('')||'<p>No course activity yet.</p>';
      const report=$('#revenueReport');
      if(report)report.innerHTML=`<div class="inst-stats"><div class="inst-stat"><span>Total revenue</span><b>${money(m.revenue||0)}</b></div><div class="inst-stat"><span>Enrollments</span><b>${Number(m.enrollments||0).toLocaleString()}</b></div><div class="inst-stat"><span>Average rating</span><b>${Number(m.average_rating||0).toFixed(1)}</b></div><div class="inst-stat"><span>Open questions</span><b>${Number(m.open_questions||0).toLocaleString()}</b></div></div>`;
      const rows=$('#studentRows');
      if(rows)rows.innerHTML=students.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${Number(u.enrollment_count||0)}</td><td><span class="inst-status">Active</span></td></tr>`).join('')||'<tr><td colspan="4">No enrolled learners yet.</td></tr>';
    }catch(err){console.warn('[BWA instructor overview]',err.message)}
  }

  window.addEventListener('focus',()=>setTimeout(refresh,150));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,250));else setTimeout(refresh,250);
})();
