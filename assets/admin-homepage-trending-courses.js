(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function loadActionAdControls(){
  if(document.querySelector('script[src*="action-ad-gates.js"]'))return;
  const script=document.createElement('script');
  script.src='/assets/action-ad-gates.js?rev=20260812-v2';
  script.defer=true;
  document.body.appendChild(script);
}

async function backend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

function ensureUi(){
  const panel=$('[data-panel="courses"]');
  if(!panel)return null;
  let card=$('#homepageTrendingCoursesCard');
  if(card)return card;

  card=document.createElement('section');
  card.id='homepageTrendingCoursesCard';
  card.className='admin-card';
  card.style.marginBottom='22px';
  card.innerHTML=`
    <div class="admin-card-head">
      <div>
        <h2>Homepage Trending Courses</h2>
        <p style="margin:6px 0 0;color:#667085">Pin up to 4 published courses for the homepage “Trending Courses” section. Course title, image, badge and price always come live from MySQL.</p>
      </div>
      <a class="admin-small admin-link" href="/#courses" target="_blank" rel="noopener">View homepage</a>
    </div>
    <form id="homepageTrendingCoursesForm">
      <div class="admin-form-grid" id="homepageTrendingCourseSlots"></div>
      <p id="homepageTrendingCoursesMessage" class="admin-muted" style="margin:12px 0 0"></p>
      <div class="admin-form-actions"><button class="admin-primary" type="submit">Save trending courses</button></div>
    </form>`;

  const heading=panel.querySelector('.admin-heading');
  if(heading)heading.insertAdjacentElement('afterend',card);else panel.prepend(card);
  return card;
}

function renderSlots(courses,selected){
  const wrap=$('#homepageTrendingCourseSlots');
  if(!wrap)return;
  const options=courses.map(c=>`<option value="${Number(c.id)}">${esc(c.title)} — Rs ${Number(c.price||0).toLocaleString('en-PK')}</option>`).join('');
  wrap.innerHTML=[0,1,2,3].map(i=>`
    <label>Course ${i+1}
      <select name="course_${i+1}">
        <option value="">${i===0?'Choose course':'Use latest published course'}</option>
        ${options}
      </select>
    </label>`).join('');
  [0,1,2,3].forEach(i=>{const select=wrap.querySelector(`[name="course_${i+1}"]`);if(select)select.value=selected[i]?String(selected[i]):''});
}

async function load(){
  ensureUi();
  const message=$('#homepageTrendingCoursesMessage');
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/homepage-trending-courses');
    renderSlots(out.courses||[],out.selected_ids||[]);
    if(message)message.textContent='Newest published courses appear first in the dropdown. Empty slots are automatically filled with the latest published courses.';
  }catch(err){if(message)message.textContent=err?.message||'Could not load homepage trending courses.'}
}

async function save(e){
  e.preventDefault();
  const form=e.currentTarget,message=$('#homepageTrendingCoursesMessage');
  const ids=[1,2,3,4].map(i=>Number(form.elements[`course_${i}`]?.value||0)).filter(Boolean);
  if(!ids.length){if(message)message.textContent='Choose at least one published course.';return}
  if(new Set(ids).size!==ids.length){if(message)message.textContent='Choose each course only once.';return}
  try{
    const b=await backend();
    await b.api('/api/admin/manage/homepage-trending-courses',{method:'PUT',body:JSON.stringify({course_ids:ids})});
    await load();
    if(message)message.textContent='Homepage trending courses saved successfully.';
  }catch(err){if(message)message.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save homepage trending courses.')}
}

function init(){
  loadActionAdControls();
  ensureUi();
  $('#homepageTrendingCoursesForm')?.addEventListener('submit',save);
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
