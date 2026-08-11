(()=>{
'use strict';

const AD_API='/api/advertisements/action-gates';
const slug=new URLSearchParams(location.search).get('course')||'python';
const FREE_STATUS_API=`/api/free-courses/${encodeURIComponent(slug)}`;
const FREE_ENROLL_API=`/api/free-courses/${encodeURIComponent(slug)}/enroll`;
let ad=null;
let freeInfo=null;
let armed=false;
let prepared=false;
let continuing=false;
let preparePromise=null;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'
    ? !!String(item.embed_code||'').trim()
    : !!String(item.target_url||'').trim();
}

async function getJson(path){
  try{
    const response=await fetch(path,{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},
    });
    if(!response.ok)return null;
    return await response.json();
  }catch{return null}
}

async function loadAd(){
  const data=await getJson(AD_API);
  return usable(data?.enroll_now)?data.enroll_now:null;
}

async function loadFreeInfo(){
  const data=await getJson(FREE_STATUS_API);
  return data&&typeof data.is_free==='boolean'?data:null;
}

function armEmbed(code){
  code=String(code||'').trim();
  if(!code||document.querySelector('[data-bwa-course-enroll-ad-arm]'))return Promise.resolve();

  return new Promise(resolve=>{
    const host=document.createElement('div');
    host.dataset.bwaCourseEnrollAdArm='1';
    host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(host);

    const nativeWrite=document.write.bind(document);
    const nativeWriteln=document.writeln.bind(document);
    let restored=false;
    const restore=()=>{
      if(restored)return;
      restored=true;
      try{document.write=nativeWrite;document.writeln=nativeWriteln}catch{}
    };
    const writeToHost=(...parts)=>{
      try{host.insertAdjacentHTML('beforeend',parts.join(''))}catch{}
    };

    try{
      document.write=writeToHost;
      document.writeln=(...parts)=>writeToHost(...parts,'\n');
    }catch{}

    host.innerHTML=code;
    const scripts=[...host.querySelectorAll('script')];
    let pending=0;
    let done=false;
    const finish=()=>{
      if(done)return;
      done=true;
      restore();
      armed=true;
      resolve();
    };
    const settled=()=>{
      pending=Math.max(0,pending-1);
      if(pending===0)setTimeout(finish,80);
    };

    scripts.forEach(oldScript=>{
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
    });

    if(pending===0)setTimeout(finish,120);
    setTimeout(finish,5000);
  });
}

function openImageAd(item){
  const url=String(item?.target_url||'').trim();
  if(!url)return;
  try{
    const popup=window.open(url,'_blank');
    if(popup){
      try{popup.blur();window.focus()}catch{}
    }
  }catch{}
}

function checkoutHref(anchor){
  const raw=anchor?.getAttribute('href')||anchor?.href||'';
  if(raw&&!raw.endsWith('#'))return raw;
  return `/checkout?course=${encodeURIComponent(slug)}`;
}

function paintFreeCourse(){
  if(!freeInfo?.is_free)return;
  const price=document.querySelector('#detailPrice');
  const enroll=document.querySelector('#enrollNow');
  if(price)price.textContent='Free';
  if(enroll){
    enroll.dataset.freeCourse='1';
    enroll.textContent=freeInfo.enrolled?'Open My Learning':'Enroll for free';
    enroll.setAttribute('href',freeInfo.enrolled?'/my-learning':'#');
  }
}

async function backend(){
  for(let i=0;i<120&&!window.BWABackend;i++)await sleep(40);
  if(!window.BWABackend)throw new Error('Enrollment service is still loading.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Enrollment service is unavailable.');
  return window.BWABackend;
}

async function enrollFree(anchor){
  const bridge=await backend();
  if(!bridge.user){
    const returnTo=`${location.pathname}${location.search}`;
    location.assign(`/login?redirect=${encodeURIComponent(returnTo)}`);
    return;
  }

  if(anchor){
    anchor.textContent='Enrolling…';
    anchor.setAttribute('aria-busy','true');
  }

  const out=await bridge.api(FREE_ENROLL_API,{method:'POST',body:JSON.stringify({})});
  freeInfo={...(freeInfo||{}),is_free:true,enrolled:true};
  paintFreeCourse();
  location.assign(out?.redirect||'/my-learning');
}

async function prepare(){
  // Resolve free/paid status first. Free courses deliberately skip loading or
  // arming the Enroll advertisement so their enrollment remains one direct click.
  freeInfo=await loadFreeInfo();
  if(freeInfo?.is_free){
    ad=null;
    prepared=true;
    for(const delay of [0,80,260,700])setTimeout(paintFreeCourse,delay);
    backend().catch(()=>{}); // warm the authenticated bridge before the click
    return;
  }

  ad=await loadAd();
  if(usable(ad)){
    if(ad.ad_type==='embed')await armEmbed(ad.embed_code);
    else armed=true;
  }
  prepared=true;
}

function release(anchor){
  anchor?.removeAttribute('aria-busy');
  continuing=false;
  if(freeInfo?.is_free)paintFreeCourse();
}

function installClickGate(){
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('#enrollNow');
    if(!anchor||continuing)return;

    const originalCheckout=checkoutHref(anchor);
    event.preventDefault();
    continuing=true;

    const continueAfterPrepare=async()=>{
      try{
        if(!prepared&&preparePromise)await preparePromise;

        // FREE COURSE: no checkout, coupon, EasyPaisa or Enroll advertisement.
        // The enrollment request is started immediately from this click.
        if(freeInfo?.is_free){
          if(freeInfo.enrolled){
            location.assign('/my-learning');
            return;
          }
          await enrollFree(anchor);
          return;
        }

        // PAID COURSE: preserve the existing advertisement -> checkout flow.
        anchor.setAttribute('aria-busy','true');
        if(usable(ad)&&ad.ad_type!=='embed')openImageAd(ad);
        const delay=usable(ad)
          ? (ad.ad_type==='embed'?(armed?850:1200):450)
          : 0;
        setTimeout(()=>location.assign(originalCheckout),delay);
      }catch(err){
        console.warn('[BWA enrollment]',err?.message||err);
        release(anchor);
      }
    };

    continueAfterPrepare();
  },true);
}

async function init(){
  if(location.pathname!=='/course'&&document.body?.dataset?.page!=='course')return;
  installClickGate();
  preparePromise=prepare();
  await preparePromise;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
