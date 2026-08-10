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
    row.innerHTML='<a href="/about">About</a><a href="/contact">Contact</a><a href="/faq">FAQ</a>';
    footer.appendChild(row);
  }
  const wanted=[
    {href:'/privacy',label:'Privacy Policy'},
    {href:'/terms',label:'Terms of Use'},
    {href:'/contact',label:'Support',key:'support'},
  ];
  wanted.forEach(item=>{
    const exists=[...row.querySelectorAll('a')].some(a=>{
      const text=a.textContent.trim().toLowerCase();
      if(item.key==='support')return text==='support';
      try{return new URL(a.href,location.origin).pathname===item.href}catch{return false}
    });
    if(!exists){
      const a=document.createElement('a');
      a.href=item.href;
      a.textContent=item.label;
      row.appendChild(a);
    }
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
function run(){cleanBanner();ensureFooterLegalLinks()}
run();
loadCommerceState();
const observer=new MutationObserver(run);
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>observer.disconnect(),5000);
})();
