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
    .homepage-trending-banner-ad{box-sizing:border-box;margin-top:24px;margin-bottom:18px;min-height:132px;padding:12px 0;display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden}
    .homepage-trending-banner-ad:empty::before{content:'Advertisement';font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;opacity:.45}
    .homepage-trending-banner-ad[data-type="image"]>a,.homepage-trending-banner-ad[data-type="image"]>div{display:flex;width:100%;min-height:108px;align-items:center;justify-content:center}
    .homepage-trending-banner-ad[data-type="image"] img{display:block;width:auto;height:auto;max-width:100%;max-height:220px;object-fit:contain;margin:0 auto;border-radius:14px}
    .homepage-trending-banner-ad[data-type="embed"]{display:flex;overflow:visible;min-height:132px}
    .homepage-trending-banner-ad[data-type="embed"]>*{max-width:100%!important;margin-left:auto!important;margin-right:auto!important}
    .homepage-trending-banner-ad iframe,.homepage-trending-banner-ad img,.homepage-trending-banner-ad video{max-width:100%!important}
    @media(max-width:780px){.homepage-trending-banner-ad{margin-top:16px;margin-bottom:12px;min-height:100px;padding:8px 0}.homepage-trending-banner-ad[data-type="image"]>a,.homepage-trending-banner-ad[data-type="image"]>div{min-height:84px}.homepage-trending-banner-ad[data-type="image"] img{border-radius:10px;max-height:150px}.homepage-trending-banner-ad[data-type="embed"]{min-height:100px}}
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
  slot.dataset.adPlacement='homepage_before_trending_banner';
  courses.insertAdjacentElement('beforebegin',slot);
  return slot;
}

function renderImage(slot,item){
  slot.replaceChildren();
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
  slot.replaceChildren();
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
  const slot=ensureSlot();
  if(!slot)return;
  try{
    const response=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(!response.ok)return;
    const data=await response.json();
    const item=data?.advertisement;
    if(!usable(item))return;
    if(item.ad_type==='embed')await renderEmbed(slot,item.embed_code);else renderImage(slot,item);
  }catch(err){console.warn('[BWA homepage trending banner ad]',err?.message||err)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
