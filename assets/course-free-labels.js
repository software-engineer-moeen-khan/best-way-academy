(()=>{
'use strict';

const exactZero=/^(?:Rs|PKR)\s*0(?:[.,]00)?$/i;
const inlineZero=/([·•|]\s*)(?:Rs|PKR)\s*0(?:[.,]00)?\b/i;

function isCoursePriceElement(el){
  if(!(el instanceof Element))return false;
  if(el.matches('#detailPrice,.course-card .price,.mini-course .mini-info>strong,.related-card span'))return true;
  if(el.closest('.course-card,.mini-course,.related-card,.enroll-card'))return el.matches('.price,strong,span,h2');
  if(el.closest('[data-panel="courses"]')&&el.matches('td:nth-child(5)'))return true;
  return false;
}

function normalize(el){
  if(!(el instanceof Element)||!isCoursePriceElement(el))return;
  const text=(el.textContent||'').trim();
  if(exactZero.test(text)){
    el.textContent='Free';
    el.dataset.bwaFreePrice='1';
    return;
  }
  if(el.matches('.related-card span')&&inlineZero.test(text)){
    el.textContent=text.replace(inlineZero,'$1Free');
    el.dataset.bwaFreePrice='1';
  }
}

function sweep(root=document){
  const selectors=[
    '#detailPrice',
    '.course-card .price',
    '.mini-course .mini-info>strong',
    '.related-card span',
    '[data-panel="courses"] .admin-table tbody tr td:nth-child(5)'
  ];
  selectors.forEach(selector=>{
    if(root instanceof Element&&root.matches(selector))normalize(root);
    root.querySelectorAll?.(selector).forEach(normalize);
  });
}

function init(){
  sweep();
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData'){
        const el=mutation.target.parentElement;
        if(el)normalize(el);
        continue;
      }
      mutation.addedNodes.forEach(node=>{
        if(node.nodeType===Node.ELEMENT_NODE)sweep(node);
        else if(node.nodeType===Node.TEXT_NODE&&node.parentElement)normalize(node.parentElement);
      });
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
