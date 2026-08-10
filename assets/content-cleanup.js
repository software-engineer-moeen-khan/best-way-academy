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
function loadCommerceState(){
  if(document.querySelector('script[data-bwa-commerce-state]'))return;
  const script=document.createElement('script');
  script.src='/assets/commerce-state.js?rev=20260810-commerce-counts-v1';
  script.defer=true;
  script.dataset.bwaCommerceState='1';
  document.head.appendChild(script);
}
cleanBanner();
loadCommerceState();
const observer=new MutationObserver(cleanBanner);
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>observer.disconnect(),5000);
})();
