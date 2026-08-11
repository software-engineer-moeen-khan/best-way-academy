(()=>{
'use strict';
function cleanBanner(){
  document.querySelectorAll('.suite-banner').forEach(banner=>{
    const walker=document.createTreeWalker(banner,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const next=node.nodeValue
        .replace(/\s+in this demo\.?/gi,'')
        .replace(/\s+this demo\.?/gi,'');
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  });
}
function ensureFooterLegalLinks(){
  const footer=document.querySelector('footer');
  if(!footer)return;
  let row=footer.querySelector('.legal-links');
  if(!row){
    row=document.createElement('div');
    row.className='legal-links shell';
    footer.appendChild(row);
  }

  const required=[
    {href:'/about',label:'About'},
    {href:'/contact',label:'Contact'},
    {href:'/faq',label:'FAQ'},
    {href:'/privacy',label:'Privacy Policy'},
    {href:'/terms',label:'Terms of Use'},
    {href:'/contact',label:'Support',matchLabel:true},
  ];

  required.forEach(item=>{
    const exists=[...row.querySelectorAll('a')].some(a=>{
      const text=a.textContent.trim().toLowerCase();
      if(item.matchLabel)return text===item.label.toLowerCase();
      try{return new URL(a.href,location.origin).pathname===item.href}catch{return false}
    });
    if(exists)return;
    const a=document.createElement('a');
    a.href=item.href;
    a.textContent=item.label;
    row.appendChild(a);
  });

  // Remove old non-link placeholder text from the legal row without touching links.
  [...row.childNodes].forEach(node=>{
    if(node.nodeType===Node.TEXT_NODE&&node.nodeValue.trim())node.remove();
  });
  row.querySelectorAll('span').forEach(span=>{
    const t=span.textContent.trim().toLowerCase();
    if(t.includes('academy platform')||t.includes('frontend')||t.includes('demo'))span.remove();
  });
}
function loadCommerceState(){
  if(document.querySelector('script[data-bwa-commerce-state]'))return;
  const script=document.createElement('script');
  script.src='/assets/commerce-state.js?rev=20260810-commerce-counts-v2';
  script.defer=true;
  script.dataset.bwaCommerceState='1';
  document.head.appendChild(script);
}
function loadCourseFreeLabels(){
  if(document.querySelector('script[data-bwa-course-free-labels]'))return;
  const script=document.createElement('script');
  script.src='/assets/course-free-labels.js?rev=20260812-free-labels-v1';
  script.defer=true;
  script.dataset.bwaCourseFreeLabels='1';
  document.head.appendChild(script);
}
function run(){cleanBanner();ensureFooterLegalLinks()}
run();
loadCommerceState();
loadCourseFreeLabels();
const observer=new MutationObserver(run);
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',run,{once:true});
setTimeout(run,250);
setTimeout(run,1000);
setTimeout(run,2500);
})();
