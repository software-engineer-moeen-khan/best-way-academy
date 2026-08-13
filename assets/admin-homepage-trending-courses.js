(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const COURSE_CONTENT_AD_KEY='course_detail_before_learn_ad';

function removeCourseContentControls(){
  if(!$('#bwaRemoveCourseContentAdminStyle')){
    const style=document.createElement('style');
    style.id='bwaRemoveCourseContentAdminStyle';
    style.textContent=`
      [data-panel="courses"] .admin-table th:nth-child(4),
      [data-panel="courses"] .admin-table td:nth-child(4),
      [data-course-curriculum],
      #curriculumDialog{display:none!important}
    `;
    document.head.appendChild(style);
  }

  const form=$('#courseForm');
  const modules=form?.elements?.modules;
  if(modules&&modules.type!=='hidden'){
    const hidden=document.createElement('input');
    hidden.type='hidden';
    hidden.name='modules';
    hidden.value=modules.value||'';
    const label=modules.closest('label');
    if(label)label.replaceWith(hidden);else modules.replaceWith(hidden);
  }

  const dialog=$('#curriculumDialog');
  if(dialog){dialog.hidden=true;dialog.setAttribute('aria-hidden','true')}
}

function loadActionAdControls(){
  if(document.querySelector('script[src*="action-ad-gates.js"]'))return;
  const script=document.createElement('script');
  script.src='/assets/action-ad-gates.js?rev=20260812-v2';
  script.defer=true;
  document.body.appendChild(script);
}

function loadAdvertisementControls(){
  if(document.querySelector('script[src*="admin-advertisements.js"]'))return;
  const script=document.createElement('script');
  script.src='/assets/admin-advertisements.js?rev=20260812-advertisements-v5';
  script.defer=true;
  script.dataset.bwaAdvertisements='1';
  document.body.appendChild(script);
}

function loadTrendingBannerAdControls(){
  if(document.querySelector('script[src*="admin-homepage-trending-banner-ad.js"]'))return;
  const script=document.createElement('script');
  script.src='/assets/admin-homepage-trending-banner-ad.js?rev=20260812-v1';
  script.defer=true;
  script.dataset.bwaTrendingBannerAd='1';
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

function adPlacements(item){return Array.isArray(item?.placements)?item.placements:(item?.placement_key?[item.placement_key]:[])}
function adUsable(item){return !!item?.active&&(item.ad_type==='embed'?!!String(item.embed_code||'').trim():!!String(item.image_url||'').trim())}

async function refreshCourseContentAdPlacement(){
  const select=$('#courseContentAdvertisement'),message=$('#courseContentAdPlacementMessage');
  if(!select)return;
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/advertisements');
    const items=Array.isArray(out?.advertisements)?out.advertisements:[];
    const selected=items.find(item=>adPlacements(item).includes(COURSE_CONTENT_AD_KEY));
    select.innerHTML='<option value="">None / hidden</option>'+items.map(item=>{
      const ok=adUsable(item),type=item.ad_type==='embed'?'Embed':'Image';
      const why=!item.active?' — inactive':(!ok?' — missing required content':'');
      return `<option value="${Number(item.id)}" ${ok?'':'disabled'}>${esc(item.name)} (${type})${esc(why)}</option>`;
    }).join('');
    select.value=selected?String(selected.id):'';
    if(message)message.textContent=selected?`Currently selected: ${selected.name}. It appears above “What you'll learn”.`:'No advertisement is currently assigned above “What you\'ll learn”.';
  }catch(err){if(message)message.textContent=err?.message||'Could not load this advertisement placement.'}
}

async function saveCourseContentAdPlacement(e){
  e.preventDefault();
  const select=$('#courseContentAdvertisement'),message=$('#courseContentAdPlacementMessage');
  const id=Number(select?.value||0)||null;
  try{
    const b=await backend();
    await b.api('/api/admin/manage/advertisement-placements/course-detail-hero-ad?placement=content',{
      method:'PUT',body:JSON.stringify({advertisement_id:id}),
    });
    await refreshCourseContentAdPlacement();
    if(message)message.textContent=id?'Course content advertisement placement saved successfully.':'Course content advertisement placement disabled.';
  }catch(err){if(message)message.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save this advertisement placement.')}
}

async function ensureCourseContentAdPlacement(){
  for(let i=0;i<160;i++){
    const panel=$('[data-panel="advertisements"]');
    if(panel){
      let card=$('#courseContentAdPlacementCard');
      if(!card){
        card=document.createElement('div');
        card.id='courseContentAdPlacementCard';
        card.className='admin-card admin-placement-card';
        card.innerHTML=`
          <strong>Course Details — Banner above What you'll learn</strong>
          <p style="margin:6px 0 0;color:#667085">Shown between the Course Details hero and the “What you'll learn” section. Supports Image ads and Embed code ads.</p>
          <form id="courseContentAdPlacementForm" class="admin-placement-grid">
            <label>Selected advertisement<select id="courseContentAdvertisement"><option value="">None / hidden</option></select></label>
            <button class="admin-primary" type="submit">Save placement</button>
          </form>
          <p id="courseContentAdPlacementMessage" class="admin-muted" style="margin:10px 0 0"></p>`;
        const heroCard=$('#courseHeroPlacementForm')?.closest('.admin-placement-card');
        const toolbar=panel.querySelector('.admin-toolbar');
        if(heroCard)heroCard.insertAdjacentElement('afterend',card);else if(toolbar)panel.insertBefore(card,toolbar);else panel.appendChild(card);
        $('#courseContentAdPlacementForm')?.addEventListener('submit',saveCourseContentAdPlacement);
      }
      await refreshCourseContentAdPlacement();
      return card;
    }
    await new Promise(r=>setTimeout(r,50));
  }
  return null;
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
  removeCourseContentControls();
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
  removeCourseContentControls();
  loadActionAdControls();
  loadAdvertisementControls();
  loadTrendingBannerAdControls();
  ensureUi();
  ensureCourseContentAdPlacement();
  $('#homepageTrendingCoursesForm')?.addEventListener('submit',save);
  window.addEventListener('hashchange',()=>{if(location.hash==='#advertisements')setTimeout(ensureCourseContentAdPlacement,100)});
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
