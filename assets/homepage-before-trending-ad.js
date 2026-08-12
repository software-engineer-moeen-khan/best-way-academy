(()=>{
'use strict';
const API='/api/advertisements/homepage-before-trending-banner';
const SLOT_ID='homepageBeforeTrendingAd';

function installStyle(){
  if(document.getElementById('bwaBeforeTrendingAdStyle'))return;
  const style=document.createElement('style');
  style.id='bwaBeforeTrendingAdStyle';
  style.textContent=`
    .homepage-before-trending-ad{box-sizing:border-box;width:min(100% - 32px,1672px);margin:24px auto 6px;padding:16px 0;min-height:132px;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center}
    .homepage-before-trending-ad[hidden]{display:none!important}
    .homepage-before-trending-ad__inner{width:100%;min-height:100px;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .homepage-before-trending-ad__link{display:flex;align-items:center;justify-content:center;width:auto;max-width:100%;margin:0 auto;text-decoration:none}
    .homepage-before-trending-ad__image{display:block;width:auto;height:auto;max-width:100%;max-height:180px;object-fit:contain;border:0;border-radius:12px;margin:0 auto}
    .homepage-before-trending-ad__frame{display:block;width:100%;min-height:110px;border:0;background:transparent;overflow:hidden}
    @media(max-width:780px){.homepage-before-trending-ad{width:min(100% - 24px,1672px);margin:14px auto 2px;padding:10px 0;min-height:100px}.homepage-before-trending-ad__inner{min-height:80px}.homepage-before-trending-ad__image{max-height:130px;border-radius:9px}.homepage-before-trending-ad__frame{min-height:90px}}
  `;
  document.head.appendChild(style);
}

function ensureSlot(){
  let slot=document.getElementById(SLOT_ID);
  if(slot)return slot;
  const trending=document.getElementById('courses');
  if(!trending)return null;
  slot=document.createElement('section');
  slot.id=SLOT_ID;
  slot.className='homepage-before-trending-ad shell';
  slot.hidden=true;
  slot.setAttribute('aria-label','Advertisement');
  trending.parentNode.insertBefore(slot,trending);
  return slot;
}

function imageCreative(slot,ad){
  const inner=document.createElement('div');
  inner.className='homepage-before-trending-ad__inner';
  const img=document.createElement('img');
  img.className='homepage-before-trending-ad__image';
  img.src=String(ad.image_url||'').trim();
  img.alt=String(ad.alt_text||ad.name||'Advertisement');
  img.loading='lazy';
  if(ad.target_url){
    const a=document.createElement('a');
    a.className='homepage-before-trending-ad__link';
    a.href=String(ad.target_url);
    a.target='_blank';
    a.rel='noopener noreferrer sponsored';
    a.appendChild(img);
    inner.appendChild(a);
  }else inner.appendChild(img);
  slot.replaceChildren(inner);
}

function embedCreative(slot,ad){
  const inner=document.createElement('div');
  inner.className='homepage-before-trending-ad__inner';
  const frame=document.createElement('iframe');
  frame.className='homepage-before-trending-ad__frame';
  frame.title=String(ad.name||'Advertisement');
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms');
  frame.setAttribute('scrolling','no');
  const code=String(ad.embed_code||'');
  frame.srcdoc=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{min-height:90px;display:flex;align-items:center;justify-content:center;text-align:center}img,iframe,video,canvas,svg{max-width:100%;height:auto}body>*{max-width:100%;margin-left:auto!important;margin-right:auto!important}</style></head><body>${code}</body></html>`;
  inner.appendChild(frame);
  slot.replaceChildren(inner);
}

async function load(){
  installStyle();
  const slot=ensureSlot();
  if(!slot)return;
  try{
    const response=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(!response.ok)throw new Error(`Advertisement request failed (${response.status})`);
    const out=await response.json();
    const ad=out?.advertisement;
    if(!ad||ad.active===false){slot.hidden=true;slot.replaceChildren();return}
    const type=ad.ad_type==='embed'?'embed':'image';
    if(type==='embed'){
      if(!String(ad.embed_code||'').trim()){slot.hidden=true;return}
      embedCreative(slot,ad);
    }else{
      if(!String(ad.image_url||'').trim()){slot.hidden=true;return}
      imageCreative(slot,ad);
    }
    slot.hidden=false;
  }catch(err){
    console.warn('[BWA before Trending ad]',err?.message||err);
    slot.hidden=true;
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
