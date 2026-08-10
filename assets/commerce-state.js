(()=>{
'use strict';
if(window.__bwaCommerceState)return;window.__bwaCommerceState=true;

const KEYS=new Set(['bwa_cart','bwa_wishlist']);
let validSlugs=null,refreshQueued=false,domObserver=null;

const readRaw=(key)=>{
  try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}
};
const slugOf=(raw)=>{
  if(typeof raw==='string'||typeof raw==='number')return String(raw).trim();
  if(raw&&typeof raw==='object')return String(raw.slug??raw.id??raw.course_slug??raw.course??'').trim();
  return'';
};
const cleanArray=(items)=>{
  const seen=new Set(),out=[];
  for(const raw of items){
    const id=slugOf(raw);
    if(!id||seen.has(id))continue;
    if(validSlugs&&!validSlugs.has(id))continue;
    seen.add(id);out.push(id);
  }
  return out;
};
function normalized(key){
  const before=readRaw(key),after=cleanArray(before);
  if(JSON.stringify(before)!==JSON.stringify(after))localStorage.setItem(key,JSON.stringify(after));
  return after;
}
function setText(selector,value){
  document.querySelectorAll(selector).forEach(el=>{if(el.textContent!==String(value))el.textContent=String(value)});
}
function renderedCount(type,fallback){
  const list=document.querySelector(type==='cart'?'#cartList':'#wishlistList');
  if(!list)return fallback;
  const rows=[...list.children].filter(el=>el instanceof HTMLElement&&!el.hidden&&(
    el.matches('.mini-course,.learning-card,.course-card,[data-course],[data-course-id]')||el.querySelector?.('.mini-info,.mini-img')
  ));
  if(rows.length)return rows.length;
  // Once the corresponding empty state is visibly active, the rendered count is definitely zero.
  const empty=document.querySelector(type==='cart'?'#cartEmpty':'#wishlistEmpty');
  if(empty&&!empty.hidden)return 0;
  return fallback;
}
function pageCount(type,count){
  if(document.body?.dataset?.page!==type)return;
  const hero=document.querySelector('.page-hero .shell');if(!hero)return;
  let el=hero.querySelector('[data-commerce-page-count]');
  if(!el){el=document.createElement('p');el.dataset.commercePageCount='1';el.className='commerce-page-count';hero.appendChild(el)}
  el.textContent=`${count} ${count===1?'course':'courses'}`;
}
function paintBadges(cartCount,wishCount){
  setText('.icon-link[href*="wishlist"] > span,.header-actions a[href="/wishlist"] > span,.header-actions a[href="wishlist.html"] > span',wishCount);
  setText('.icon-link[href*="cart"] > span,.header-actions a[href="/cart"] > span,.header-actions a[href="cart.html"] > span',cartCount);

  document.querySelectorAll('.header-actions a[href*="wishlist"],.icon-link[href*="wishlist"]').forEach(a=>a.setAttribute('aria-label',`Wishlist (${wishCount})`));
  document.querySelectorAll('.header-actions a[href*="cart"],.icon-link[href*="cart"]').forEach(a=>a.setAttribute('aria-label',`Cart (${cartCount})`));
}
function render(){
  const cart=normalized('bwa_cart'),wish=normalized('bwa_wishlist');
  let c=cart.length,w=wish.length;

  // On the Cart/Wishlist pages the visible rendered rows are authoritative.
  if(document.body?.dataset?.page==='cart')c=renderedCount('cart',c);
  if(document.body?.dataset?.page==='wishlist')w=renderedCount('wishlist',w);

  paintBadges(c,w);

  const qw=document.querySelector('#quickWishlist');if(qw)qw.textContent=`${w} saved ${w===1?'course':'courses'}`;
  const qc=document.querySelector('#quickCart');if(qc)qc.textContent=`${c} ${c===1?'course':'courses'}`;
  const sw=document.querySelector('#statWishlist');if(sw)sw.textContent=String(w);

  pageCount('cart',c);pageCount('wishlist',w);
  window.dispatchEvent(new CustomEvent('bwa:commerce-counts',{detail:{cart:c,wishlist:w}}));
}
function schedule(){
  if(refreshQueued)return;refreshQueued=true;
  queueMicrotask(()=>{refreshQueued=false;render()});
}

// Catch same-tab writes from every legacy/new commerce script.
const previousSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  previousSet.call(this,key,value);
  if(this===localStorage&&KEYS.has(String(key)))schedule();
};
const previousRemove=Storage.prototype.removeItem;
Storage.prototype.removeItem=function(key){
  previousRemove.call(this,key);
  if(this===localStorage&&KEYS.has(String(key)))schedule();
};
window.addEventListener('storage',e=>{if(KEYS.has(String(e.key)))schedule()});
window.addEventListener('bwa:cart-changed',schedule);
window.addEventListener('bwa:wishlist-changed',schedule);

async function loadCatalog(){
  try{
    const r=await fetch('/api/courses',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
    if(!r.ok)throw new Error('catalog unavailable');
    const rows=await r.json();
    validSlugs=new Set((Array.isArray(rows)?rows:[]).map(c=>String(c?.slug||'').trim()).filter(Boolean));
  }catch{validSlugs=null}
  render();
}
function watchDom(){
  if(domObserver||!document.body)return;
  domObserver=new MutationObserver(records=>{
    if(records.some(r=>{
      const t=r.target instanceof Element?r.target:r.target?.parentElement;
      return t?.closest?.('#cartList,#wishlistList,.header-actions,.site-header')||[...r.addedNodes].some(n=>n instanceof Element&&n.matches?.('#cartList,#wishlistList,.header-actions,.site-header,.mini-course'));
    }))schedule();
  });
  domObserver.observe(document.body,{childList:true,subtree:true,characterData:true});
}
function init(){
  render();watchDom();loadCatalog();
  // Reconcile after legacy header and dynamic catalog renderers finish.
  [80,200,500,900,1500,2500].forEach(ms=>setTimeout(render,ms));
}
window.BWACommerceState={sync:render,counts:()=>({cart:normalized('bwa_cart').length,wishlist:normalized('bwa_wishlist').length})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
