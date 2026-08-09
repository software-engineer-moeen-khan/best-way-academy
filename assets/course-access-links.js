(()=>{
'use strict';
if(window.__bwaCourseAccessLinks)return;window.__bwaCourseAccessLinks=true;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const safeDate=v=>{try{return v?new Date(v).toLocaleDateString('en-PK',{year:'numeric',month:'short',day:'numeric'}):'—'}catch{return'—'}};
const blockedScheme=/^(javascript|data|vbscript|file|about):/i;
const safeHref=value=>{
  const raw=String(value||'').trim();if(!raw||blockedScheme.test(raw))return null;
  try{
    const u=new URL(raw,location.origin);
    if(blockedScheme.test(u.protocol))return null;
    return u.href;
  }catch{return null}
};
const fallbackImage='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80';
let access=[],catalog=new Map(),rendering=false;

function injectCss(){
  if(document.querySelector('link[data-course-access-css]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/course-access-links.css?rev=20260810-course-link-v2';l.dataset.courseAccessCss='1';document.head.appendChild(l);
}

async function backendReady(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)return false;
  await window.BWABackend.ready;
  return !!window.BWABackend.available;
}

async function getJson(path){
  const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
  if(!r.ok)throw new Error(`Request failed (${r.status})`);
  return r.json();
}

function accessAction(item){
  const href=safeHref(item.course_link);
  return href
    ? `<a class="primary-btn course-access-button" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open course ↗</a>`
    : `<span class="primary-btn course-access-button disabled" aria-disabled="true">Course link not set</span>`;
}

function renderLearning(){
  const list=$('#learningList');if(!list)return;
  rendering=true;
  list.innerHTML=access.map(item=>{
    const c=catalog.get(item.slug)||{},href=safeHref(item.course_link),image=c.image||fallbackImage;
    const imageWrap=href
      ? `<a class="course-access-image" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><img src="${esc(image)}" alt="${esc(item.title)}"></a>`
      : `<a class="course-access-image" href="/course?course=${encodeURIComponent(item.slug)}"><img src="${esc(image)}" alt="${esc(item.title)}"></a>`;
    return `<article class="learning-card course-link-card">${imageWrap}<div class="learning-card-body"><p class="eyebrow">${esc(c.category||'ENROLLED COURSE')}</p><h3>${esc(item.title)}</h3><div class="course-access-status"><b>✓ Access granted</b><span>Enrolled ${esc(safeDate(item.enrolled_at))}</span></div>${accessAction(item)}</div></article>`;
  }).join('');
  const empty=$('#learningEmpty');if(empty)empty.hidden=access.length>0;
  rendering=false;
}

function renderDashboard(){
  const list=$('#dashLearningList');if(!list)return;
  const empty=$('#dashLearningEmpty');
  list.innerHTML=access.slice(0,6).map(item=>{
    const c=catalog.get(item.slug)||{},image=c.image||fallbackImage;
    return `<article class="dash-course course-link-dash"><img src="${esc(image)}" alt="${esc(item.title)}"><div><h3>${esc(item.title)}</h3><p>Enrolled ${esc(safeDate(item.enrolled_at))}</p><small class="course-access-granted">✓ Access granted</small></div>${accessAction(item)}</article>`;
  }).join('');
  if(empty)empty.hidden=access.length>0;
  const enrolled=$('#statEnrolled');if(enrolled)enrolled.textContent=String(access.length);
  const avg=$('#statProgress');if(avg)avg.textContent=access.length?`${Math.round(access.reduce((n,x)=>n+Number(x.progress||0),0)/access.length)}%`:'0%';
}

function renderCoursePage(){
  const button=$('#enrollNow');if(!button)return;
  const slug=new URLSearchParams(location.search).get('course')||'';
  const item=access.find(x=>String(x.slug)===String(slug));if(!item)return;
  const href=safeHref(item.course_link);
  const note=button.parentElement?.querySelector('p');
  if(href){
    button.href=href;button.target='_blank';button.rel='noopener noreferrer';button.textContent='Open course ↗';
    if(note)note.textContent='✓ Access granted · Opens your course on the learning platform';
  }else{
    button.removeAttribute('href');button.removeAttribute('target');button.textContent='Course link not set';button.setAttribute('aria-disabled','true');button.classList.add('disabled');
    if(note)note.textContent='Access is granted, but the course link has not been configured yet.';
  }
}

function orderStatusText(status){return ({pending:'Pending verification',completed:'Completed',refunded:'Refunded',cancelled:'Cancelled'})[status]||String(status||'Pending')}
function renderOrderLinks(){
  const root=$('#orderHistory');if(!root)return;
  const orders=[...(read('bwa_orders',[])||[])],last=read('bwa_last_order',null);
  if(last&&!orders.some(x=>x.number===last.number))orders.unshift(last);
  const bySlug=new Map(access.map(x=>[x.slug,x]));
  root.querySelectorAll('.order-card2').forEach(card=>{
    const number=card.querySelector('header b')?.textContent?.trim();
    const order=orders.find(x=>String(x.number||'')===String(number||''));if(!order)return;
    const orderStatus=String(order.status||'pending');
    const pill=card.querySelector('.status-pill');if(pill)pill.textContent=orderStatusText(orderStatus);
    card.querySelector('.order-course-access')?.remove();
    const ids=Array.isArray(order.ids)?order.ids:[];
    const rows=ids.map(slug=>{
      const item=bySlug.get(slug),c=catalog.get(slug)||{},title=item?.title||c.title||slug;
      const href=orderStatus==='completed'&&item?safeHref(item.course_link):null;
      if(href)return `<div><span>${esc(title)}</span><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open course ↗</a></div>`;
      const message=orderStatus==='pending'?'Available after payment verification':orderStatus==='completed'?'Course link not set':'Course access unavailable for this order status';
      return `<div><span>${esc(title)}</span><small>${esc(message)}</small></div>`;
    }).join('');
    if(!rows)return;
    const box=document.createElement('div');box.className='order-course-access';box.innerHTML=`<strong>Course access</strong>${rows}`;
    const actions=card.querySelector('.order-actions')||card.lastElementChild;actions?.insertAdjacentElement('beforebegin',box);
  });
}

async function init(){
  injectCss();
  if(!await backendReady())return;
  try{
    const [secured,courses]=await Promise.all([getJson('/api/course-access-links'),getJson('/api/courses').catch(()=>[])]);
    access=Array.isArray(secured.courses)?secured.courses:[];
    catalog=new Map((Array.isArray(courses)?courses:[]).map(c=>[c.slug,c]));
    const path=location.pathname;
    if(path==='/my-learning'){
      renderLearning();
      const list=$('#learningList');if(list){const observer=new MutationObserver(()=>{if(!rendering)renderLearning()});observer.observe(list,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),2500)}
    }
    if(path==='/dashboard')renderDashboard();
    if(path==='/course')renderCoursePage();
    if(path==='/orders'){
      const run=()=>renderOrderLinks();run();
      const root=$('#orderHistory');if(root){const observer=new MutationObserver(()=>{observer.disconnect();run();observer.observe(root,{childList:true,subtree:true})});observer.observe(root,{childList:true,subtree:true});setTimeout(run,250)}
    }
  }catch(e){console.warn('[BWA course access]',e.message)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
