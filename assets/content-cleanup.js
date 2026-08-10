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
cleanBanner();
const observer=new MutationObserver(cleanBanner);
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>observer.disconnect(),5000);
})();
