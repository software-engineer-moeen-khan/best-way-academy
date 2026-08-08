(()=>{
'use strict';
const slug=new URLSearchParams(location.search).get('course')||'python';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
async function hydrate(){
  try{
    const r=await fetch(`/api/courses/${encodeURIComponent(slug)}`,{credentials:'same-origin',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(!r.ok)return;
    const c=await r.json(),all=read('bwa_admin_courses',{})||{};
    all[slug]={...(all[slug]||{}),title:c.title,category:c.category,subtitle:c.subtitle,description:c.description,price:c.price,status:c.status,image:c.image,badge:c.badge,modules:c.modules||[],learn:c.learn||[]};
    write('bwa_admin_courses',all);
    const sections=(c.sections||[]).map(s=>({title:s.title||'Course section',lectures:(s.lessons||[]).map(l=>l.title).filter(Boolean)}));
    if(sections.length)write(`bwa_curriculum_${slug}`,sections);
  }catch(e){console.warn('[BWA player loader]',e.message)}
}
async function load(){
  await hydrate();
  const s=document.createElement('script');s.src='/assets/player.js?rev=20260808-player-db-v1';
  s.onload=()=>{
    const page=document.body.dataset.playerPage;
    if(document.readyState!=='loading'){
      if(page==='learn'&&document.querySelector('#lessonList')?.children.length===0&&typeof initLearn==='function')initLearn();
      if(page==='certificate'&&!document.querySelector('#certificateName')?.textContent&&typeof initCertificate==='function')initCertificate();
    }
  };
  document.body.appendChild(s);
}
load();
})();
