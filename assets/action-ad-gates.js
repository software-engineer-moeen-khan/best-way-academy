(()=>{
'use strict';

const PUBLIC_URL='/api/advertisements/action-gates';
const ENROLL_ADMIN_URL='/api/admin/manage/advertisement-placements/course-enroll-now-ad';
const COUPON_ADMIN_URL='/api/admin/manage/advertisement-placements/checkout-coupon-apply-ad';
const ENROLL_PLACEMENT='course_enroll_now_ad';
const COUPON_PLACEMENT='checkout_coupon_apply_ad';
const bypass=new WeakSet();
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'
    ? !!String(item.embed_code||'').trim()
    : !!String(item.target_url||'').trim();
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function executeEmbedAndCapturePopups(code){
  const opened=[];
  const originalOpen=window.open;
  let restored=false;
  const restore=()=>{if(restored)return;restored=true;window.open=originalOpen};

  window.open=function(...args){
    const child=originalOpen.apply(window,args);
    if(child)opened.push(child);
    return child;
  };

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

  setTimeout(restore,1200);
  return {opened,restore};
}

async function waitForAdWindows(windows,maxMs=60000){
  if(!windows.length){await sleep(900);return}
  const started=Date.now();
  while(Date.now()-started<maxMs){
    let allClosed=true;
    for(const win of windows){
      try{if(win&&!win.closed){allClosed=false;break}}catch{}
    }
    if(allClosed)return;
    await sleep(250);
  }
}

async function triggerAd(ad){
  if(!usable(ad))return;

  if(ad.ad_type==='embed'){
    const {opened,restore}=executeEmbedAndCapturePopups(String(ad.embed_code||''));
    await sleep(1250);
    restore();
    await waitForAdWindows(opened);
    return;
  }

  const url=String(ad.target_url||'').trim();
  if(!url)return;
  let popup=null;
  try{popup=window.open(url,'_blank')}catch{}
  if(popup){
    try{popup.blur();window.focus()}catch{}
    await waitForAdWindows([popup]);
    return;
  }

  // Popup blockers should never strand the learner. Continue the original action.
  await sleep(250);
}

function replay(element){
  if(!element||!document.documentElement.contains(element))return;
  bypass.add(element);
  try{element.click()}finally{setTimeout(()=>bypass.delete(element),0)}
}

async function loadPlacements(){
  try{
    const response=await fetch(PUBLIC_URL,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(!response.ok)return {};
    return await response.json();
  }catch{return {}}
}

async function setupPublic(){
  if(!['/course','/checkout'].includes(location.pathname))return;
  const placements=await loadPlacements();
  let busy=false;

  document.addEventListener('click',async event=>{
    const target=event.target.closest?.('#enrollNow,#checkoutApplyCoupon');
    if(!target||bypass.has(target)||busy)return;
    if(target.matches(':disabled'))return;

    const isEnroll=target.id==='enrollNow';
    if(isEnroll&&location.pathname!=='/course')return;
    if(!isEnroll&&location.pathname!=='/checkout')return;

    const ad=isEnroll?placements.enroll_now:placements.coupon_apply;
    if(!usable(ad))return;

    event.preventDefault();
    event.stopImmediatePropagation();
    busy=true;
    target.setAttribute('aria-busy','true');

    try{
      await triggerAd(ad);
    }finally{
      target.removeAttribute('aria-busy');
      busy=false;
      replay(target);
    }
  },true);
}

async function waitBackend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await sleep(40);
  if(!window.BWABackend)return null;
  await window.BWABackend.ready;
  return window.BWABackend.available?window.BWABackend:null;
}

async function setupAdmin(){
  if(location.pathname!=='/admin')return;
  const backend=await waitBackend();
  if(!backend||backend.user?.role!=='admin')return;
  const api=backend.api;

  const install=async()=>{
    const panel=$('[data-panel="advertisements"]');
    if(!panel||$('#actionAdPlacementsCard'))return false;

    const card=document.createElement('div');
    card.id='actionAdPlacementsCard';
    card.className='admin-card admin-placement-card';
    card.innerHTML=`
      <strong>Course & Checkout Action Ads</strong>
      <p style="margin:6px 0 14px;color:#667085">Choose ads that run before the original learner action. After the ad closes/finishes, the original click continues automatically.</p>
      <form id="actionAdPlacementsForm" class="admin-placement-grid">
        <label>Any course — Enroll now
          <select id="enrollNowActionAd"><option value="">None / disabled</option></select>
        </label>
        <label>Checkout — Coupon Apply
          <select id="couponApplyActionAd"><option value="">None / disabled</option></select>
        </label>
        <button class="admin-primary" type="submit">Save action ads</button>
      </form>
      <p id="actionAdPlacementsMessage" class="admin-muted" style="margin:10px 0 0"></p>`;

    const heading=panel.querySelector('.admin-heading');
    if(heading)heading.insertAdjacentElement('afterend',card);else panel.prepend(card);

    const enrollSelect=$('#enrollNowActionAd');
    const couponSelect=$('#couponApplyActionAd');
    const message=$('#actionAdPlacementsMessage');

    const refresh=async()=>{
      try{
        const out=await api('/api/admin/manage/advertisements');
        const items=Array.isArray(out?.advertisements)?out.advertisements:[];
        const enrollSelected=items.find(item=>Array.isArray(item.placements)&&item.placements.includes(ENROLL_PLACEMENT));
        const couponSelected=items.find(item=>Array.isArray(item.placements)&&item.placements.includes(COUPON_PLACEMENT));
        const options='<option value="">None / disabled</option>'+items.map(item=>{
          const ok=usable(item);
          const type=item.ad_type==='embed'?'Embed':'Image';
          const why=!item.active?' — inactive':(!ok?' — missing destination/embed code':'');
          return `<option value="${Number(item.id)}" ${ok?'':'disabled'}>${esc(item.name)} (${type})${esc(why)}</option>`;
        }).join('');
        enrollSelect.innerHTML=options;
        couponSelect.innerHTML=options;
        enrollSelect.value=enrollSelected?String(enrollSelected.id):'';
        couponSelect.value=couponSelected?String(couponSelected.id):'';
        message.textContent='Enroll now and Coupon Apply can use different advertisements.';
      }catch(err){message.textContent=err?.message||'Could not load action ad placements.'}
    };

    card.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();
      const enrollId=Number(enrollSelect.value||0)||null;
      const couponId=Number(couponSelect.value||0)||null;
      try{
        await api(ENROLL_ADMIN_URL,{method:'PUT',body:JSON.stringify({advertisement_id:enrollId})});
        await api(COUPON_ADMIN_URL,{method:'PUT',body:JSON.stringify({advertisement_id:couponId})});
        await refresh();
        message.textContent='Course and checkout action advertisements saved successfully.';
      }catch(err){message.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save action ads.')}
    });

    await refresh();
    return true;
  };

  if(await install())return;
  const observer=new MutationObserver(async()=>{if(await install())observer.disconnect()});
  observer.observe(document.body,{childList:true,subtree:true});
}

function init(){setupPublic();setupAdmin()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
