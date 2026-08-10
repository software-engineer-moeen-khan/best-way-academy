(()=>{
'use strict';

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

function openPopunder(url){
  const popup=window.open(url,'_blank');
  if(!popup)return false;
  try{popup.blur()}catch{}
  try{window.focus()}catch{}
  return true;
}

function clickedInsideGoogleAi(event){
  const target=event.target;
  if(!(target instanceof Element))return false;
  return !!target.closest('.google-ai');
}

async function init(){
  if(!(location.pathname==='/'||document.body?.dataset?.page==='home'))return;
  const section=document.querySelector('.google-ai');
  if(!section)return;

  section.style.cursor='pointer';
  section.setAttribute('data-popunder-clickable','true');

  let advertisement=null;
  let fired=false;

  const trigger=()=>{
    if(fired||!advertisement||!advertisement.active)return;
    const type=advertisement.ad_type==='embed'?'embed':'image';
    if(type==='embed'){
      const code=String(advertisement.embed_code||'').trim();
      if(!code)return;
      fired=true;
      executeEmbed(code);
      return;
    }
    const url=String(advertisement.target_url||'').trim();
    if(!url)return;
    if(openPopunder(url))fired=true;
  };

  document.addEventListener('click',event=>{
    if(clickedInsideGoogleAi(event))trigger();
  },{capture:true});

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    if(clickedInsideGoogleAi(event))trigger();
  },{capture:true});

  try{
    const response=await fetch('/api/advertisements/homepage-google-ai-popunder',{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},
    });
    if(!response.ok)return;
    const data=await response.json();
    advertisement=data?.advertisement||null;
  }catch{return}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
