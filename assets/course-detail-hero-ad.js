(()=>{
'use strict';

const HERO_AD_API='/api/advertisements/course-detail-hero-ad';
const CONTENT_AD_API='/api/advertisements/course-detail-hero-ad?placement=content';

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'
    ? !!String(item.embed_code||'').trim()
    : !!String(item.image_url||'').trim();
}

async function loadAdvertisement(url){
  try{
    const response=await fetch(url,{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},
    });
    if(!response.ok)return null;
    const data=await response.json();
    return usable(data?.advertisement)?data.advertisement:null;
  }catch{return null}
}

function ensureHeroSlot(){
  const meta=document.querySelector('.course-detail-hero .detail-meta');
  if(!meta)return null;
  let slot=document.querySelector('#courseHeroAdvertisement');
  if(slot)return slot;
  slot=document.createElement('div');
  slot.id='courseHeroAdvertisement';
  slot.className='course-hero-ad-slot';
  slot.setAttribute('aria-label','Advertisement');
  meta.insertAdjacentElement('afterend',slot);
  return slot;
}

function contentSlot(){
  return document.querySelector('#courseDetailContentAd');
}

function renderImage(slot,item){
  slot.replaceChildren();
  slot.dataset.type='image';
  const destination=String(item.target_url||'').trim();
  const wrapper=document.createElement(destination?'a':'div');
  if(destination){
    wrapper.href=destination;
    wrapper.target='_blank';
    wrapper.rel='noopener noreferrer sponsored';
  }
  const image=document.createElement('img');
  image.src=String(item.image_url||'').trim();
  image.alt=String(item.alt_text||item.name||'Advertisement');
  image.loading='lazy';
  image.decoding='async';
  image.addEventListener('load',()=>{slot.hidden=false},{once:true});
  image.addEventListener('error',()=>{if(slot.id==='courseDetailContentAd')slot.hidden=true},{once:true});
  wrapper.appendChild(image);
  slot.appendChild(wrapper);
}

function renderEmbed(slot,code){
  code=String(code||'').trim();
  if(!code)return Promise.resolve();
  slot.replaceChildren();
  slot.dataset.type='embed';
  slot.hidden=false;

  return new Promise(resolve=>{
    const nativeWrite=document.write.bind(document);
    const nativeWriteln=document.writeln.bind(document);
    let restored=false;
    let finished=false;
    const restore=()=>{
      if(restored)return;
      restored=true;
      try{document.write=nativeWrite;document.writeln=nativeWriteln}catch{}
    };
    const finish=()=>{
      if(finished)return;
      finished=true;
      restore();
      resolve();
    };
    const writeToSlot=(...parts)=>{
      try{slot.insertAdjacentHTML('beforeend',parts.join(''))}catch{}
    };

    try{
      document.write=writeToSlot;
      document.writeln=(...parts)=>writeToSlot(...parts,'\n');
    }catch{}

    slot.innerHTML=code;
    const scripts=[...slot.querySelectorAll('script')];
    let pending=0;

    const settled=()=>{
      pending=Math.max(0,pending-1);
      if(pending===0)setTimeout(finish,100);
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

    if(pending===0)setTimeout(finish,150);
    setTimeout(finish,6000);
  });
}

async function render(slot,item){
  if(!slot||!usable(item))return;
  if(item.ad_type==='embed')await renderEmbed(slot,item.embed_code);
  else renderImage(slot,item);
}

async function init(){
  if(document.body?.dataset?.page!=='course')return;
  const [heroItem,contentItem]=await Promise.all([
    loadAdvertisement(HERO_AD_API),
    loadAdvertisement(CONTENT_AD_API),
  ]);
  if(heroItem)await render(ensureHeroSlot(),heroItem);
  if(contentItem)await render(contentSlot(),contentItem);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
