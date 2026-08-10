(()=>{
'use strict';
const brandMarkup='<span class="brand-mark">A</span><span>AWK <b>Paid Courses</b></span>';
function applyBrand(){
  if(document.body?.classList.contains('awk-home'))return;
  document.querySelectorAll('.brand').forEach(el=>{el.innerHTML=brandMarkup;el.setAttribute('aria-label','AWK Paid Courses home')});
  document.title=document.title.replaceAll('Best Way Academy','AWK Paid Courses').replaceAll('Academy','AWK Paid Courses');
  const promo=document.querySelector('.promo');
  if(promo){promo.classList.add('awk-sale-strip');promo.innerHTML='AZADI SALE &nbsp;•&nbsp; <strong>SAVE RS. 3,000</strong> &nbsp;•&nbsp; LIMITED TIME OFFER'}
  document.querySelectorAll('footer .footer-brand').forEach(el=>el.innerHTML=brandMarkup);
}
function adminLabels(){
  if(!document.body?.classList.contains('admin-body'))return;
  const heading=document.querySelector('[data-panel="overview"] .admin-heading h1');if(heading)heading.textContent='AWK Paid Courses overview';
  const stats=[...document.querySelectorAll('[data-panel="overview"] .admin-stat-grid article')];
  stats.forEach(card=>{const span=card.querySelector('span');if(!span)return;if(span.textContent.trim()==='Revenue')span.textContent='Total Revenue';if(span.textContent.trim()==='Enrollments')span.textContent='Paid Enrollments'});
  const courseHeading=document.querySelector('[data-panel="courses"] .admin-heading p:not(.eyebrow)');if(courseHeading)courseHeading.textContent='Create, price, publish and manage AWK paid courses and access links.';
}
function addSaleBadge(){
  if(document.body?.classList.contains('awk-home')||document.body?.classList.contains('admin-body')||document.body?.classList.contains('checkout-page'))return;
  if(document.querySelector('.awk-global-sale'))return;
  const header=document.querySelector('.site-header');if(!header)return;
  const bar=document.createElement('div');bar.className='awk-sale-strip awk-global-sale';bar.innerHTML='AZADI SALE • <strong>SAVE RS. 3,000</strong>';header.insertAdjacentElement('afterend',bar);
}
function init(){applyBrand();adminLabels();addSaleBadge()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
