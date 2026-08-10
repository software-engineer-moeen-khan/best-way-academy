(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=n=>`Rs. ${Number(n||0).toLocaleString('en-PK')}`;

function rebrand(){
  if(document.title)document.title=document.title.replaceAll('Best Way Academy','AWK Paid Courses');
  document.documentElement.style.setProperty('--brand-accent','#a8ff27');

  if(!document.body.classList.contains('awk-home')){
    $$('.brand').forEach(brand=>{
      if(brand.closest('.awk-home'))return;
      const mark=brand.querySelector('.brand-mark');
      if(mark)mark.textContent='AWK';
      const text=[...brand.children].find(x=>!x.classList.contains('brand-mark'));
      if(text)text.innerHTML='AWK <b>PAID COURSES</b>';
    });
    const promo=$('.promo');
    if(promo)promo.innerHTML='AZADI SALE <strong>— SAVE RS. 3,000 ON SELECTED PAID COURSES</strong>';
    $$('footer').forEach(f=>{
      f.innerHTML=f.innerHTML.replaceAll('Best Way Academy','AWK Paid Courses');
    });
  }

  if(document.body.classList.contains('admin-body')){
    const heading=$('.admin-section[data-panel="overview"] .admin-heading h1');
    if(heading)heading.textContent='AWK paid courses overview';
    const p=$('.admin-section[data-panel="overview"] .admin-heading p:not(.eyebrow)');
    if(p)p.textContent='Live students, enrollments, orders, coupons and revenue from MySQL.';
    const marketing=$('#adminTabs button[data-tab="marketing"]');
    if(marketing)marketing.innerHTML='<span>✦</span> Coupons & Marketing';
    const settings=$('.admin-section[data-panel="settings"] .admin-heading h1');
    if(settings)settings.textContent='AWK settings & payments';
  }
}

function courseBullets(course){
  const raw=Array.isArray(course.learn)?course.learn.filter(Boolean):[];
  const fallback=[
    'Step-by-step structured learning',
    'Practical examples and exercises',
    'Lifetime course access',
    'Learner support and updates'
  ];
  return (raw.length?raw:fallback).slice(0,5);
}

async function loadHomeCourses(){
  const grid=$('#awkCourseGrid');
  if(!grid)return;
  const err=$('#awkCourseError');
  try{
    const res=await fetch('/api/courses?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    if(!res.ok)throw new Error('Course request failed');
    const courses=await res.json();
    if(!Array.isArray(courses)||!courses.length)throw new Error('No courses');
    grid.innerHTML=courses.slice(0,8).map((c,i)=>{
      const bullets=courseBullets(c).map(x=>`<li>${esc(x)}</li>`).join('');
      return `<article class="awk-course-card">
        <div class="awk-course-no"><span>${String(i+1).padStart(2,'0')}</span><span class="awk-course-badge">${esc(c.badge||'Paid course')}</span></div>
        <h3>${esc(c.title)}</h3>
        <p class="awk-category">${esc(c.category||'Professional learning')} · ★ ${Number(c.rating||0).toFixed(1)}</p>
        <ul class="awk-course-learn">${bullets}</ul>
        <div class="awk-course-price"><div><small>AZADI SALE · SAVE RS. 3,000</small><strong>${money(c.price)}</strong></div><a class="awk-enroll" href="/checkout?course=${encodeURIComponent(c.slug||c.id)}">ENROLL NOW →</a></div>
      </article>`;
    }).join('');
  }catch(e){
    grid.innerHTML='';if(err)err.hidden=false;
  }
}

async function csrfToken(){
  try{
    const r=await fetch('/api/session?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    const j=await r.json();return j.csrf_token||'';
  }catch{return ''}
}

async function submitSupport(e){
  e.preventDefault();
  const form=e.currentTarget,status=$('#awkSupportStatus'),btn=form.querySelector('button[type="submit"]');
  const fd=new FormData(form);
  const payload={name:String(fd.get('name')||'').trim(),email:String(fd.get('email')||'').trim(),subject:String(fd.get('subject')||'').trim(),message:String(fd.get('message')||'').trim()};
  if(status){status.textContent='Sending your request…';status.className='awk-form-status'}
  if(btn){btn.disabled=true;btn.style.opacity='.65'}
  try{
    const token=await csrfToken();
    const r=await fetch('/api/contact',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-Requested-With':'XMLHttpRequest',...(token?{'X-CSRF-TOKEN':token}:{})},body:JSON.stringify(payload)});
    const out=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(out.message||Object.values(out.errors||{}).flat().join(' ')||'Support request could not be sent.');
    form.reset();
    if(status){status.textContent=out.request_id?`Request sent successfully. Reference: ${out.request_id}`:'Request sent successfully. The support team will review it.';status.className='awk-form-status success'}
  }catch(err){if(status){status.textContent=err.message||'Support request could not be sent.';status.className='awk-form-status error'}}
  finally{if(btn){btn.disabled=false;btn.style.opacity=''}}
}

function init(){
  rebrand();
  loadHomeCourses();
  $('#awkSupportForm')?.addEventListener('submit',submitSupport);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
