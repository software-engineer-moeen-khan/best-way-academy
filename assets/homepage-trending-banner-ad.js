(()=>{
'use strict';
if(window.__bwaHomepageTrendingBannerAd)return;window.__bwaHomepageTrendingBannerAd=true;
const API='/api/advertisements/homepage-before-trending-banner';

function usable(item){
  if(!item?.active)return false;
  return item.ad_type==='embed'?!!String(item.embed_code||'').trim():!!String(item.image_url||'').trim();
}

function installStyle(){
  if(document.querySelector('#bwaTrendingBannerAdStyle'))return;
  const style=document.createElement('style');
  style.id='bwaTrendingBannerAdStyle';
  style.textContent=`
    .homepage-trending-banner-ad{margin-top:34px;margin-bottom:6px;display:flex;justify-content:center;align-items:center;min-height:0;text-align:center}
    .homepage-trending-banner-ad[data-type="image"]>a,.homepage-trending-banner-ad[data-type="image"]>div{display:block;width:100%}
    .homepage-trending-banner-ad[data-type="image"] img{display:block;width:100%;height:auto;max-height:260px;object-fit:contain;margin:0 auto;border-radius:14px}
    .homepage-trending-banner-ad[data-type="embed"]{display:block;overflow:visible}
    .homepage-trending-banner-ad[data-type="embed"]>*{max-width:100%!important;margin-left:auto!important;margin-right:auto!important}
    .homepage-trending-banner-ad iframe,.homepage-trending-banner-ad img,.homepage-trending-banner-ad video{max-width:100%!important}
    @media(max-width:780px){.homepage-trending-banner-ad{margin-top:22px;margin-bottom:0}.homepage-trending-banner-ad[data-type="image"] img{border-radius:10px;max-height:210px}}
  `;
  document.head.appendChild(style);
}

function ensureSlot(){
  const courses=document.querySelector('#courses');
  if(!courses)return null;
  let slot=document.querySelector('#homepageTrendingBannerAd');
  if(slot)return slot;
  slot=document.createElement('section');
  slot.id='homepageTrendingBannerAd';
  slot.className='homepage-trending-banner-ad shell';
  slot.setAttribute('aria-label','Advertisement');
  courses.insertAdjacentElement('beforebegin',slot);
  return slot;
}

function renderImage(slot,item){
  slot.dataset.type='image';
  const destination=String(item.target_url||'').trim();
  const wrapper=document.createElement(destination?'a':'div');
  if(destination){wrapper.href=destination;wrapper.target='_blank';wrapper.rel='noopener noreferrer sponsored'}
  const img=document.createElement('img');
  img.src=String(item.image_url||'').trim();
  img.alt=String(item.alt_text||item.name||'Advertisement');
  img.loading='eager';
  img.decoding='async';
  wrapper.appendChild(img);
  slot.appendChild(wrapper);
}

function renderEmbed(slot,code){
  code=String(code||'').trim();if(!code)return Promise.resolve();
  slot.dataset.type='embed';
  return new Promise(resolve=>{
    const nativeWrite=document.write.bind(document),nativeWriteln=document.writeln.bind(document);
    let restored=false,finished=false;
    const restore=()=>{if(restored)return;restored=true;try{document.write=nativeWrite;document.writeln=nativeWriteln}catch{}};
    const finish=()=>{if(finished)return;finished=true;restore();resolve()};
    const writeToSlot=(...parts)=>{try{slot.insertAdjacentHTML('beforeend',parts.join(''))}catch{}};
    try{document.write=writeToSlot;document.writeln=(...parts)=>writeToSlot(...parts,'\n')}catch{}
    slot.innerHTML=code;
    const scripts=[...slot.querySelectorAll('script')];let pending=0;
    const settled=()=>{pending=Math.max(0,pending-1);if(pending===0)setTimeout(finish,100)};
    scripts.forEach(oldScript=>{
      const script=document.createElement('script');
      [...oldScript.attributes].forEach(attr=>script.setAttribute(attr.name,attr.value));
      if(!script.hasAttribute('async'))script.async=false;
      script.textContent=oldScript.textContent||'';
      if(script.src){pending++;script.addEventListener('load',settled,{once:true});script.addEventListener('error',settled,{once:true})}
      oldScript.replaceWith(script);
    });
    if(pending===0)setTimeout(finish,150);
    setTimeout(finish,6000);
  });
}

async function init(){
  if(!(location.pathname==='/'||document.body?.dataset?.page==='home'))return;
  installStyle();
  try{
    const response=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(!response.ok)return;
    const data=await response.json();
    const item=data?.advertisement;
    if(!usable(item))return;
    const slot=ensureSlot();if(!slot)return;
    if(item.ad_type==='embed')await renderEmbed(slot,item.embed_code);else renderImage(slot,item);
  }catch(err){console.warn('[BWA homepage trending banner ad]',err?.message||err)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
