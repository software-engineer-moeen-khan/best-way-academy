(()=>{
'use strict';

const PUBLIC_URL='/api/advertisements/action-gates';
const ENROLL_ADMIN_URL='/api/admin/manage/advertisement-placements/course-enroll-now-ad';
const COUPON_ADMIN_URL='/api/admin/manage/advertisement-placements/checkout-coupon-apply-ad';
const ENROLL_PLACEMENT='course_enroll_now_ad';
const COUPON_PLACEMENT='checkout_coupon_apply_ad';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bypass=new WeakSet();

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'
    ? !!String(item.embed_code||'').trim()
    : !!String(item.target_url||'').trim();
}

async function loadPlacements(){
  try{
    const response=await fetch(PUBLIC_URL,{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},
    });
    if(!response.ok)return {};
    return await response.json();
  }catch{return {}}
}

/*
 * Popunder/embed networks normally need their JavaScript loaded BEFORE the
 * user's click. Loading an external script after the click loses browser user
 * activation and the popup is commonly blocked. We therefore arm the selected
 * embed once when the page loads, inside an off-screen host. document.write is
 * temporarily redirected into that host so older ad snippets cannot overwrite
 * the academy page while they initialise.
 */
function armEmbed(code,key){
  code=String(code||'').trim();
  if(!code)return Promise.resolve(false);
  if(document.querySelector(`[data-bwa-action-ad-arm="${key}"]`))return Promise.resolve(true);

  return new Promise(resolve=>{
    const host=document.createElement('div');
    host.dataset.bwaActionAdArm=key;
    host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;z-index:-1;';
    document.body.appendChild(host);

    const originalWrite=document.write.bind(document);
    const originalWriteln=document.writeln.bind(document);
    let restored=false;
    const restore=()=>{
      if(restored)return;
      restored=true;
      try{document.write=originalWrite;document.writeln=originalWriteln}catch{}
    };
    const writeIntoHost=(...parts)=>{
      try{host.insertAdjacentHTML('beforeend',parts.join(''))}catch{}
    };

    try{
      document.write=writeIntoHost;
      document.writeln=(...parts)=>writeIntoHost(...parts,'\n');
    }catch{}

    host.innerHTML=code;
    const oldScripts=[...host.querySelectorAll('script')];
    let pending=0,finished=false;
    const finish=()=>{
      if(finished)return;
      finished=true;
      restore();
      resolve(true);
    };
    const settled=()=>{pending=Math.max(0,pending-1);if(pending===0)setTimeout(finish,80)};

    for(const oldScript of oldScripts){
      const script=document.createElement('script');
      [...oldScript.attributes].forEach(attr=>script.setAttribute(attr.name,attr.value));
      if(!script.hasAttribute('async'))script.async=false;
      script.textContent=oldScript.textContent||'';
      if(script.src){
        pending++;
        script.addEventListener('load',settled,{once:true});
        script.addEventListener('error',settled,{once:true});
      }
      oldScript.replaceWith(script);
    }

    if(pending===0)setTimeout(finish,120);
    setTimeout(finish,5000);
  });
}

function replayOriginal(target){
  if(!target||!document.documentElement.contains(target))return;
  bypass.add(target);
  try{
    if(target.id==='enrollNow'){
      const href=target.getAttribute('href')||target.href;
      if(href){window.location.href=href;return}
    }
    target.click();
  }finally{
    setTimeout(()=>bypass.delete(target),0);
  }
}

function makeOverlay(target,ad,key){
  if(!target||!usable(ad))return null;
  const overlay=document.createElement('div');
  overlay.dataset.bwaActionAdGate=key;
  overlay.setAttribute('aria-label',target.textContent?.trim()||'Continue');
  overlay.style.cssText='position:fixed;background:transparent;cursor:pointer;z-index:2147483000;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
  document.body.appendChild(overlay);

  let disposed=false,raf=0;
  const place=()=>{
    raf=0;
    if(disposed||!document.documentElement.contains(target)){dispose();return}
    const rect=target.getBoundingClientRect();
    const disabled=target.matches(':disabled')||rect.width<2||rect.height<2||rect.bottom<0||rect.top>window.innerHeight;
    overlay.style.pointerEvents=disabled?'none':'auto';
    overlay.style.left=`${Math.max(0,rect.left)}px`;
    overlay.style.top=`${Math.max(0,rect.top)}px`;
    overlay.style.width=`${Math.max(0,Math.min(rect.right,window.innerWidth)-Math.max(0,rect.left))}px`;
    overlay.style.height=`${Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(0,rect.top))}px`;
  };
  const requestPlace=()=>{if(!raf)raf=requestAnimationFrame(place)};
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    overlay.remove();
    window.removeEventListener('resize',requestPlace);
    window.removeEventListener('scroll',requestPlace,true);
    if(raf)cancelAnimationFrame(raf);
  };

  window.addEventListener('resize',requestPlace,{passive:true});
  window.addEventListener('scroll',requestPlace,{passive:true,capture:true});
  requestPlace();

  overlay.addEventListener('click',event=>{
    if(disposed)return;
    event.preventDefault();
    // Do NOT stop propagation. For embed/popunder networks this genuine user
    // click must reach their document/window click listener.
    dispose();

    if(ad.ad_type!=='embed'){
      const url=String(ad.target_url||'').trim();
      if(url){
        try{
          const popup=window.open(url,'_blank');
          if(popup){try{popup.blur();window.focus()}catch{}}
        }catch{}
      }
    }

    // Give the ad listener/open call a short head start, then perform exactly
    // what the learner originally clicked. This avoids trapping the learner
    // behind an ad window and works with providers that manage their own tab.
    const delay=ad.ad_type==='embed'?900:450;
    setTimeout(()=>replayOriginal(target),delay);
  },false);

  return {dispose,requestPlace};
}

async function setupPublic(){
  const path=location.pathname;
  const isCourse=path==='/course'||document.body?.dataset?.page==='course';
  const isCheckout=path==='/checkout'||document.body?.classList.contains('checkout-page');
  if(!isCourse&&!isCheckout)return;

  const placements=await loadPlacements();
  const ad=isCourse?placements.enroll_now:placements.coupon_apply;
  if(!usable(ad))return;

  if(ad.ad_type==='embed'){
    await armEmbed(ad.embed_code,isCourse?ENROLL_PLACEMENT:COUPON_PLACEMENT);
  }

  const selector=isCourse?'#enrollNow':'#checkoutApplyCoupon';
  let gate=null,lastTarget=null;
  const install=()=>{
    const target=$(selector);
    if(!target||bypass.has(target))return;
    if(target===lastTarget&&gate)return;
    gate?.dispose?.();
    lastTarget=target;
    gate=makeOverlay(target,ad,isCourse?ENROLL_PLACEMENT:COUPON_PLACEMENT);
  };

  install();
  const observer=new MutationObserver(install);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','href','style','class']});
  setInterval(()=>{install();gate?.requestPlace?.()},1000);
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
      <p style="margin:6px 0 14px;color:#667085">These ads are armed before the learner clicks, so external embed/popunder scripts keep the real user-click needed by browser popup rules. The original Enroll/Apply action continues automatically after the ad is triggered.</p>
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
        message.textContent=`Enroll now: ${enrollSelected?.name||'disabled'} · Coupon Apply: ${couponSelected?.name||'disabled'}`;
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
