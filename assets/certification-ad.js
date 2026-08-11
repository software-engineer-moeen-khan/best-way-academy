(()=>{
'use strict';
const PLACEMENT='homepage_certifications_cta_ad';
const PUBLIC_URL='/api/advertisements/homepage-certifications-cta-ad';
const ADMIN_URL='/api/admin/manage/advertisement-placements/homepage-certifications-cta-ad';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function executeEmbed(code){
  const host=document.createElement('div');
  host.setAttribute('aria-hidden','true');
  host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
  document.body.appendChild(host);
  host.innerHTML=String(code||'');
  [...host.querySelectorAll('script')].forEach(oldScript=>{
    const script=document.createElement('script');
    [...oldScript.attributes].forEach(attr=>script.setAttribute(attr.name,attr.value));
    if(!script.hasAttribute('async'))script.async=false;
    script.textContent=oldScript.textContent||'';
    oldScript.replaceWith(script);
  });
}

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'
    ? !!String(item.embed_code||'').trim()
    : !!String(item.target_url||'').trim();
}

async function waitBackend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)return null;
  await window.BWABackend.ready;
  return window.BWABackend.available?window.BWABackend:null;
}

async function setupAdmin(){
  if(document.body?.dataset?.page==='home'||location.pathname!=='/admin')return;
  const backend=await waitBackend();
  if(!backend||backend.user?.role!=='admin')return;
  const api=backend.api;

  const install=async()=>{
    const panel=$('[data-panel="advertisements"]');
    if(!panel||$('#certificationCtaPlacementForm'))return false;

    const card=document.createElement('div');
    card.className='admin-card admin-placement-card';
    card.innerHTML=`
      <strong>Homepage — Certifications CTA Ad</strong>
      <p style="margin:6px 0 0;color:#667085">Choose the ad that should trigger when a visitor clicks “Explore certifications and courses →”.</p>
      <form id="certificationCtaPlacementForm" class="admin-placement-grid">
        <label>Selected advertisement<select id="certificationCtaAdvertisement"><option value="">None / disabled</option></select></label>
        <button class="admin-primary" type="submit">Save placement</button>
      </form>
      <p id="certificationCtaPlacementMessage" class="admin-muted" style="margin:10px 0 0"></p>`;

    const anchor=$('#longbarPlacementForm',panel)?.closest('.admin-placement-card');
    if(anchor)anchor.insertAdjacentElement('afterend',card);
    else panel.querySelector('.admin-heading')?.insertAdjacentElement('afterend',card);

    const select=$('#certificationCtaAdvertisement');
    const msg=$('#certificationCtaPlacementMessage');

    const refresh=async()=>{
      try{
        const out=await api('/api/admin/manage/advertisements');
        const items=Array.isArray(out?.advertisements)?out.advertisements:[];
        const selected=items.find(item=>Array.isArray(item.placements)&&item.placements.includes(PLACEMENT));
        select.innerHTML='<option value="">None / disabled</option>'+items.map(item=>{
          const ok=usable(item);
          const type=item.ad_type==='embed'?'Embed':'Image';
          const why=!item.active?' — inactive':(!ok?' — missing destination/embed code':'');
          return `<option value="${item.id}" ${ok?'':'disabled'}>${esc(item.name)} (${type})${esc(why)}</option>`;
        }).join('');
        select.value=selected?String(selected.id):'';
        msg.textContent=selected?`Currently selected: ${selected.name}.`:'No advertisement is currently assigned to this CTA.';
      }catch(err){msg.textContent=err?.message||'Could not load certification CTA placement.'}
    };

    card.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();
      const id=Number(select.value||0)||null;
      try{
        await api(ADMIN_URL,{method:'PUT',body:JSON.stringify({advertisement_id:id})});
        await refresh();
        msg.textContent=id?'Certification CTA placement saved successfully.':'Certification CTA placement disabled.';
      }catch(err){msg.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save certification CTA placement.')}
    });

    await refresh();
    return true;
  };

  if(await install())return;
  const observer=new MutationObserver(async()=>{if(await install())observer.disconnect()});
  observer.observe(document.body,{childList:true,subtree:true});
}

async function setupHomepage(){
  if(!(location.pathname==='/'||document.body?.dataset?.page==='home'))return;
  const cta=[...document.querySelectorAll('.cert a')].find(a=>/explore certifications and courses/i.test(a.textContent||''));
  if(!cta)return;

  let advertisement=null;
  let fired=false;
  try{
    const response=await fetch(PUBLIC_URL,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(response.ok)advertisement=(await response.json())?.advertisement||null;
  }catch{}

  cta.addEventListener('click',event=>{
    if(fired||!advertisement?.active)return;
    const href=cta.href;
    const type=advertisement.ad_type==='embed'?'embed':'image';

    if(type==='embed'){
      const code=String(advertisement.embed_code||'').trim();
      if(!code)return;
      event.preventDefault();
      fired=true;
      executeEmbed(code);
      window.setTimeout(()=>{window.location.href=href},650);
      return;
    }

    const url=String(advertisement.target_url||'').trim();
    if(!url)return;
    const popup=window.open(url,'_blank');
    if(popup){
      fired=true;
      try{popup.blur()}catch{}
      try{window.focus()}catch{}
      return;
    }

    event.preventDefault();
    fired=true;
    window.location.assign(url);
  },true);
}

function init(){setupHomepage();setupAdmin()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
