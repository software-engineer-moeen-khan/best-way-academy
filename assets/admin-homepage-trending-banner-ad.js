(()=>{
'use strict';
if(window.__bwaTrendingBannerAdAdmin)return;window.__bwaTrendingBannerAdAdmin=true;
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const KEY='homepage_before_trending_banner';

async function backend(){
  for(let i=0;i<180&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

function placements(item){return Array.isArray(item?.placements)?item.placements:(item?.placement_key?[item.placement_key]:[])}
function usable(item){return !!item?.active&&(item.ad_type==='embed'?!!String(item.embed_code||'').trim():!!String(item.image_url||'').trim())}

async function ensureCard(){
  for(let i=0;i<160;i++){
    const panel=$('[data-panel="advertisements"]');
    if(panel){
      if($('#trendingBannerPlacementCard'))return $('#trendingBannerPlacementCard');
      const card=document.createElement('div');
      card.id='trendingBannerPlacementCard';
      card.className='admin-card admin-placement-card';
      card.innerHTML=`
        <strong>Homepage — Banner before Trending Courses</strong>
        <p style="margin:6px 0 0;color:#667085">Shown as a full-width banner immediately before the “Trending Courses” section on the homepage. Supports Image ads and Embed code ads.</p>
        <form id="trendingBannerPlacementForm" class="admin-placement-grid">
          <label>Selected advertisement<select id="trendingBannerAdvertisement"><option value="">None / hidden</option></select></label>
          <button class="admin-primary" type="submit">Save placement</button>
        </form>
        <p id="trendingBannerPlacementMessage" class="admin-muted" style="margin:10px 0 0"></p>`;
      const firstPlacement=panel.querySelector('.admin-placement-card');
      if(firstPlacement)panel.insertBefore(card,firstPlacement);else panel.querySelector('.admin-heading')?.insertAdjacentElement('afterend',card);
      $('#trendingBannerPlacementForm')?.addEventListener('submit',save);
      return card;
    }
    await new Promise(r=>setTimeout(r,50));
  }
  return null;
}

async function load(){
  const card=await ensureCard();if(!card)return;
  const select=$('#trendingBannerAdvertisement'),msg=$('#trendingBannerPlacementMessage');
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/advertisements');
    const items=Array.isArray(out?.advertisements)?out.advertisements:[];
    const selected=items.find(item=>placements(item).includes(KEY));
    select.innerHTML='<option value="">None / hidden</option>'+items.map(item=>{
      const ok=usable(item),type=item.ad_type==='embed'?'Embed':'Image';
      const why=!item.active?' — inactive':(!ok?' — missing required content':'');
      return `<option value="${Number(item.id)}" ${ok?'':'disabled'}>${esc(item.name)} (${type})${esc(why)}</option>`;
    }).join('');
    select.value=selected?String(selected.id):'';
    if(msg)msg.textContent=selected?`Currently selected: ${selected.name}. It appears immediately before Trending Courses.`:'No banner advertisement is currently assigned before Trending Courses.';
  }catch(err){if(msg)msg.textContent=err?.message||'Could not load the Trending Courses banner placement.'}
}

async function save(e){
  e.preventDefault();
  const select=$('#trendingBannerAdvertisement'),msg=$('#trendingBannerPlacementMessage');
  const id=Number(select?.value||0)||null;
  try{
    const b=await backend();
    await b.api('/api/admin/manage/advertisement-placements/homepage-before-trending-banner',{
      method:'PUT',body:JSON.stringify({advertisement_id:id}),
    });
    await load();
    if(msg)msg.textContent=id?'Homepage Trending Courses banner placement saved successfully.':'Homepage Trending Courses banner placement disabled.';
  }catch(err){if(msg)msg.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save the banner placement.')}
}

async function init(){await load();window.addEventListener('hashchange',()=>{if(location.hash==='#advertisements')setTimeout(load,100)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
