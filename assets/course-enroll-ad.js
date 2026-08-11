(()=>{
'use strict';

const API='/api/advertisements/action-gates';
const PLACEMENT='course_enroll_now_ad';
let ad=null;
let armed=false;
let continuing=false;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'
    ? !!String(item.embed_code||'').trim()
    : !!String(item.target_url||'').trim();
}

async function loadAd(){
  try{
    const response=await fetch(API,{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},
    });
    if(!response.ok)return null;
    const data=await response.json();
    return usable(data?.enroll_now)?data.enroll_now:null;
  }catch{return null}
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
  if(raw)return raw;
  const slug=new URLSearchParams(location.search).get('course')||'python';
  return `/checkout?course=${encodeURIComponent(slug)}`;
}

async function prepare(){
  ad=await loadAd();
  if(!usable(ad))return;
  if(ad.ad_type==='embed')await armEmbed(ad.embed_code);
  else armed=true;
}

function installClickGate(){
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('#enrollNow');
    if(!anchor||continuing||!usable(ad))return;

    // Stop the anchor's normal navigation for a moment, but allow this SAME
    // genuine user click to continue bubbling to any pre-armed ad-network
    // document/window listeners.
    event.preventDefault();

    if(ad.ad_type!=='embed')openImageAd(ad);

    continuing=true;
    anchor.setAttribute('aria-busy','true');
    const href=checkoutHref(anchor);

    // Keep the delay short: the ad gets the real click first, then the learner
    // proceeds to exactly the checkout URL Enroll now was already pointing to.
    setTimeout(()=>{
      anchor.removeAttribute('aria-busy');
      window.location.assign(href);
    },ad.ad_type==='embed'?(armed?850:1200):450);
  },true);
}

async function init(){
  if(location.pathname!=='/course'&&document.body?.dataset?.page!=='course')return;
  installClickGate();
  await prepare();

  // Dynamic catalog scripts may update the Enroll href after page load; the
  // delegated handler above intentionally reads the final href at click time.
  if(ad?.ad_type==='embed'&&!armed)await sleep(100);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
