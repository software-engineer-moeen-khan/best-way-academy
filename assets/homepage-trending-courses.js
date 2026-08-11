(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fallback='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80';

function card(course,currency){
  const slug=encodeURIComponent(course.slug||'');
  const title=esc(course.title||'Course');
  const category=esc(course.category||'');
  const subtitle=esc(course.subtitle||'');
  const image=esc(course.image||fallback);
  const rating=Number(course.rating||0).toFixed(1);
  const students=esc(course.students||'0');
  const price=`${esc(currency||'Rs')} ${Number(course.price||0).toLocaleString('en-PK')}`;
  const badge=String(course.badge||'').trim();
  return `<a class="course-card" href="/course?course=${slug}" data-search="${esc(`${course.title||''} ${course.category||''} ${course.subtitle||''}`.toLowerCase())}">
    <img src="${image}" alt="${title}" loading="lazy">
    <div class="course-body">
      <h3>${title}</h3>
      <p class="teacher">Best Way Academy</p>
      <div class="rating"><b>${rating}</b> ★★★★★ <span>(${students})</span></div>
      <p class="price">${price}</p>
      ${badge?`<span class="badge">${esc(badge)}</span>`:''}
    </div>
  </a>`;
}

function bindSearch(grid){
  const search=document.querySelector('#courseSearch');
  const no=document.querySelector('#noResults');
  if(!search)return;
  const apply=()=>{
    const q=search.value.toLowerCase().trim();
    let visible=0;
    [...grid.querySelectorAll('.course-card')].forEach(item=>{
      const show=!q||`${item.dataset.search||''} ${item.textContent||''}`.toLowerCase().includes(q);
      item.style.display=show?'':'none';
      if(show)visible++;
    });
    if(no)no.hidden=visible!==0;
  };
  search.addEventListener('input',apply);
}

async function init(){
  if(!(location.pathname==='/'||document.body?.dataset?.page==='home'))return;
  const grid=document.querySelector('#courseGrid');
  if(!grid)return;
  try{
    const response=await fetch('/api/homepage-trending-courses',{
      credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},
    });
    if(!response.ok)return;
    const out=await response.json();
    const courses=Array.isArray(out?.courses)?out.courses:[];
    if(!courses.length)return;
    grid.innerHTML=courses.map(course=>card(course,out.currency_symbol||'Rs')).join('');
    bindSearch(grid);
  }catch(err){console.warn('[BWA trending courses]',err?.message||err)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
