(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const COURSE_CONTENT_AD_KEY='course_detail_before_learn_ad';
const STUDENTS_VIEWED_AD_KEY='course_detail_before_students_viewed_ad';

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

async function loadAdOptions(selectId,messageId,key,positionText){
  const select=$(selectId),message=$(messageId);
  if(!select)return;
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/advertisements');
    const items=Array.isArray(out?.advertisements)?out.advertisements:[];
    const selected=items.find(item=>adPlacements(item).includes(key));
    select.innerHTML='<option value="">None / hidden</option>'+items.map(item=>{
      const ok=adUsable(item),type=item.ad_type==='embed'?'Embed':'Image';
      const why=!item.active?' — inactive':(!ok?' — missing required content':'');
      return `<option value="${Number(item.id)}" ${ok?'':'disabled'}>${esc(item.name)} (${type})${esc(why)}</option>`;
    }).join('');
    select.value=selected?String(selected.id):'';
    if(message)message.textContent=selected?`Currently selected: ${selected.name}. It appears ${positionText}.`:`No advertisement is currently assigned ${positionText}.`;
  }catch(err){if(message)message.textContent=err?.message||'Could not load this advertisement placement.'}
}

async function saveAdPlacement(e,selectId,messageId,placementQuery,successText){
  e.preventDefault();
  const select=$(selectId),message=$(messageId);
  const id=Number(select?.value||0)||null;
  try{
    const b=await backend();
    await b.api(`/api/admin/manage/advertisement-placements/course-detail-hero-ad?placement=${placementQuery}`,{
      method:'PUT',body:JSON.stringify({advertisement_id:id}),
    });
    if(message)message.textContent=id?successText:'Advertisement placement disabled.';
    return true;
  }catch(err){
    if(message)message.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save this advertisement placement.');
    return false;
  }
}

function placementCardHtml(title,description,formId,selectId,messageId){
  return `
    <strong>${title}</strong>
    <p style="margin:6px 0 0;color:#667085">${description}</p>
    <form id="${formId}" class="admin-placement-grid">
      <label>Selected advertisement<select id="${selectId}"><option value="">None / hidden</option></select></label>
      <button class="admin-primary" type="submit">Save placement</button>
    </form>
    <p id="${messageId}" class="admin-muted" style="margin:10px 0 0"></p>`;
}

async function ensureCourseAdPlacements(){
  for(let i=0;i<160;i++){
    const panel=$('[data-panel="advertisements"]');
    if(panel){
      let contentCard=$('#courseContentAdPlacementCard');
      if(!contentCard){
        contentCard=document.createElement('div');
        contentCard.id='courseContentAdPlacementCard';
        contentCard.className='admin-card admin-placement-card';
        contentCard.innerHTML=placementCardHtml(
          'Course Details — Banner above What you\'ll learn',
          'Shown between the Course Details hero and the “What you\'ll learn” section. Supports Image ads and Embed code ads.',
          'courseContentAdPlacementForm','courseContentAdvertisement','courseContentAdPlacementMessage'
        );
        const heroCard=$('#courseHeroPlacementForm')?.closest('.admin-placement-card');
        const toolbar=panel.querySelector('.admin-toolbar');
        if(heroCard)heroCard.insertAdjacentElement('afterend',contentCard);else if(toolbar)panel.insertBefore(contentCard,toolbar);else panel.appendChild(contentCard);
        $('#courseContentAdPlacementForm')?.addEventListener('submit',async e=>{
          if(await saveAdPlacement(e,'#courseContentAdvertisement','#courseContentAdPlacementMessage','content','Course content advertisement placement saved successfully.'))
            await loadAdOptions('#courseContentAdvertisement','#courseContentAdPlacementMessage',COURSE_CONTENT_AD_KEY,'above “What you\'ll learn”');
        });
      }

      let studentsCard=$('#studentsViewedAdPlacementCard');
      if(!studentsCard){
        studentsCard=document.createElement('div');
        studentsCard.id='studentsViewedAdPlacementCard';
        studentsCard.className='admin-card admin-placement-card';
        studentsCard.innerHTML=placementCardHtml(
          'Course Details — Banner above Students also viewed',
          'Shown immediately before the “Students also viewed” section on Course Details pages. Supports Image ads and Embed code ads.',
          'studentsViewedAdPlacementForm','studentsViewedAdvertisement','studentsViewedAdPlacementMessage'
        );
        contentCard.insertAdjacentElement('afterend',studentsCard);
        $('#studentsViewedAdPlacementForm')?.addEventListener('submit',async e=>{
          if(await saveAdPlacement(e,'#studentsViewedAdvertisement','#studentsViewedAdPlacementMessage','students-viewed','Students also viewed advertisement placement saved successfully.'))
            await loadAdOptions('#studentsViewedAdvertisement','#studentsViewedAdPlacementMessage',STUDENTS_VIEWED_AD_KEY,'above “Students also viewed”');
        });
      }

      await Promise.all([
        loadAdOptions('#courseContentAdvertisement','#courseContentAdPlacementMessage',COURSE_CONTENT_AD_KEY,'above “What you\'ll learn”'),
        loadAdOptions('#studentsViewedAdvertisement','#studentsViewedAdPlacementMessage',STUDENTS_VIEWED_AD_KEY,'above “Students also viewed”'),
      ]);
      return;
    }
    await new Promise(r=>setTimeout(r,50));
  }
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
  ensureCourseAdPlacements();
  $('#homepageTrendingCoursesForm')?.addEventListener('submit',save);
  window.addEventListener('hashchange',()=>{if(location.hash==='#advertisements')setTimeout(ensureCourseAdPlacements,100)});
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
