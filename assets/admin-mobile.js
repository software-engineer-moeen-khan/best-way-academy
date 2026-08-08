(()=>{
'use strict';
if(!document.body.classList.contains('admin-body'))return;

function labelTable(table){
  const heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  table.querySelectorAll('tbody tr').forEach(row=>{
    [...row.children].forEach((cell,i)=>{
      if(cell.tagName!=='TD')return;
      cell.dataset.label=heads[i]||'';
    });
  });
}

function labelTables(root=document){
  const tables=root.matches?.('.admin-table')?[root]:[...(root.querySelectorAll?.('.admin-table')||[])];
  tables.forEach(labelTable);
}

function keepActiveTabVisible(){
  if(innerWidth>780)return;
  const active=document.querySelector('#adminTabs [data-tab].active');
  if(active)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
}

function enhanceDialogs(root=document){
  const dialogs=root.matches?.('.admin-dialog')?[root]:[...(root.querySelectorAll?.('.admin-dialog')||[])];
  dialogs.forEach(dialog=>{
    if(dialog.dataset.mobileEnhanced)return;
    dialog.dataset.mobileEnhanced='1';
    dialog.addEventListener('close',()=>document.documentElement.classList.remove('admin-dialog-open'));
    const observer=new MutationObserver(()=>{
      if(dialog.open)document.documentElement.classList.add('admin-dialog-open');
    });
    observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  });
}

function enhance(){
  labelTables();
  enhanceDialogs();
  keepActiveTabVisible();
}

document.addEventListener('click',e=>{
  if(e.target.closest('#adminTabs [data-tab]'))setTimeout(keepActiveTabVisible,20);
});

const observer=new MutationObserver(records=>{
  let relabel=false;
  records.forEach(record=>record.addedNodes.forEach(node=>{
    if(node.nodeType!==1)return;
    if(node.matches?.('tr,td,.admin-table')||node.querySelector?.('.admin-table,tr'))relabel=true;
    enhanceDialogs(node);
  }));
  if(relabel)requestAnimationFrame(()=>labelTables());
});

function init(){
  enhance();
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',()=>requestAnimationFrame(keepActiveTabVisible),{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
