(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let api=null,items=[];

async function backend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  api=window.BWABackend.api;
  return api;
}

function message(text,error=false){
  const el=$('#advertisementMessage');
  if(!el)return;
  el.textContent=text||'';
  el.style.color=error?'#b42318':'#667085';
}

function installStyle(){
  if($('#bwaAdvertisementStyle'))return;
  const style=document.createElement('style');
  style.id='bwaAdvertisementStyle';
  style.textContent=`
    .admin-ad-preview{width:112px;height:62px;object-fit:cover;border-radius:10px;border:1px solid #e4e7ec;background:#f8fafc;display:block}
    .admin-ad-name small{display:block;margin-top:4px;color:#667085;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .admin-ad-placement{font-size:12px;color:#667085}
    #advertisementDialog .admin-ad-image-preview{width:100%;max-height:220px;object-fit:contain;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc;margin-top:8px;display:none}
    @media(max-width:780px){.admin-ad-preview{width:86px;height:52px}}
  `;
  document.head.appendChild(style);
}

function ensureUi(){
  installStyle();
  const tabs=$('#adminTabs'),main=$('.admin-main');
  if(!tabs||!main)return;

  if(!tabs.querySelector('[data-tab="advertisements"]')){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.tab='advertisements';
    button.innerHTML='<span>▤</span> Advertisements';
    const settings=tabs.querySelector('[data-tab="settings"]');
    if(settings)tabs.insertBefore(button,settings);else tabs.appendChild(button);
    button.addEventListener('click',()=>activatePanel());
  }

  if(!$('[data-panel="advertisements"]')){
    const section=document.createElement('section');
    section.className='admin-section';
    section.dataset.panel='advertisements';
    section.innerHTML=`
      <div class="admin-heading">
        <div><p class="eyebrow">MONETIZATION</p><h1>Advertisements</h1><p>Create and manage advertisement creatives now. Website placements will be assigned later.</p></div>
        <button id="addAdvertisementBtn" class="admin-primary" type="button">+ Add advertisement</button>
      </div>
      <div class="admin-card" style="margin-bottom:18px">
        <strong>Placement status</strong>
        <p style="margin:6px 0 0;color:#667085">Ads saved here are not shown publicly yet. When placement locations are finalized, these same ads will be connected to those slots.</p>
      </div>
      <div class="admin-toolbar"><input id="advertisementSearch" type="search" placeholder="Search advertisements…"><select id="advertisementStatusFilter"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <div class="admin-card admin-table-wrap">
        <table class="admin-table admin-table-wide"><thead><tr><th>Preview</th><th>Advertisement</th><th>Destination</th><th>Placement</th><th>Status</th><th>Actions</th></tr></thead><tbody id="advertisementsBody"></tbody></table>
        <div id="advertisementsEmpty" class="admin-empty" hidden>No advertisements created yet.</div>
      </div>
      <p id="advertisementMessage" class="admin-muted" style="margin-top:12px"></p>`;
    main.appendChild(section);
  }

  if(!$('#advertisementDialog')){
    const dialog=document.createElement('dialog');
    dialog.id='advertisementDialog';
    dialog.className='admin-dialog';
    dialog.innerHTML=`
      <form id="advertisementForm">
        <div class="dialog-head"><div><p class="eyebrow">ADVERTISEMENT</p><h2 id="advertisementDialogTitle">Add advertisement</h2></div><button type="button" id="closeAdvertisementDialog" aria-label="Close">×</button></div>
        <input type="hidden" name="id">
        <label>Ad name<input name="name" required maxlength="160" placeholder="Summer sale banner"></label>
        <label>Advertisement image URL<input name="image_url" required maxlength="2048" inputmode="url" placeholder="https://example.com/banner.jpg"></label>
        <img id="advertisementImagePreview" class="admin-ad-image-preview" alt="Advertisement preview">
        <label>Click / destination URL <small>Optional until the destination is ready.</small><input name="target_url" maxlength="2048" inputmode="url" placeholder="https://advertiser.example.com/"></label>
        <label>Image alt text<input name="alt_text" maxlength="255" placeholder="Short description of the advertisement"></label>
        <label class="admin-check"><input name="active" type="checkbox" checked> <span><b>Active advertisement</b><small>Active means ready to use once a placement is assigned.</small></span></label>
        <div class="dialog-actions"><button type="button" class="admin-outline" id="cancelAdvertisementDialog">Cancel</button><button type="submit" class="admin-primary">Save advertisement</button></div>
      </form>`;
    document.body.appendChild(dialog);
  }
}

function activatePanel(){
  const button=$('#adminTabs [data-tab="advertisements"]'),panel=$('[data-panel="advertisements"]');
  if(!button||!panel)return;
  document.querySelectorAll('#adminTabs button').forEach(x=>x.classList.toggle('active',x===button));
  document.querySelectorAll('.admin-section').forEach(x=>x.classList.toggle('active',x===panel));
  history.replaceState(null,'','#advertisements');
  load();
}

function matches(item){
  const q=String($('#advertisementSearch')?.value||'').trim().toLowerCase();
  const status=$('#advertisementStatusFilter')?.value||'';
  const text=`${item.name||''} ${item.target_url||''} ${item.alt_text||''}`.toLowerCase();
  return(!q||text.includes(q))&&(!status||(status==='active'?item.active:!item.active));
}

function render(){
  const body=$('#advertisementsBody'),empty=$('#advertisementsEmpty');
  if(!body||!empty)return;
  const list=items.filter(matches);
  body.innerHTML=list.map(item=>`<tr>
    <td><img class="admin-ad-preview" src="${esc(item.image_url)}" alt="${esc(item.alt_text||item.name)}"></td>
    <td class="admin-ad-name"><strong>${esc(item.name)}</strong><small>${esc(item.image_url)}</small></td>
    <td>${item.target_url?`<a class="admin-link" href="${esc(item.target_url)}" target="_blank" rel="noopener noreferrer">Open destination ↗</a>`:'<span class="admin-muted">Not set</span>'}</td>
    <td><span class="admin-ad-placement">${item.placement_key?esc(item.placement_key):'Unassigned'}</span></td>
    <td><span class="status-pill ${item.active?'status-active':'status-hidden'}">${item.active?'active':'inactive'}</span></td>
    <td><div class="admin-actions"><button class="admin-small primary" type="button" data-ad-edit="${item.id}">Edit</button><button class="admin-small danger" type="button" data-ad-delete="${item.id}">Delete</button></div></td>
  </tr>`).join('');
  empty.hidden=list.length>0;
}

async function load(){
  try{
    if(!api)await backend();
    const out=await api('/api/admin/manage/advertisements');
    items=out.advertisements||[];
    render();
    message(`${items.length} advertisement${items.length===1?'':'s'} saved. Placements are not assigned yet.`);
  }catch(err){message(err?.message||'Could not load advertisements.',true)}
}

function openDialog(item=null){
  const dialog=$('#advertisementDialog'),form=$('#advertisementForm');
  if(!dialog||!form)return;
  form.reset();
  form.elements.id.value=item?.id||'';
  form.elements.name.value=item?.name||'';
  form.elements.image_url.value=item?.image_url||'';
  form.elements.target_url.value=item?.target_url||'';
  form.elements.alt_text.value=item?.alt_text||'';
  form.elements.active.checked=item?!!item.active:true;
  $('#advertisementDialogTitle').textContent=item?'Edit advertisement':'Add advertisement';
  paintPreview();
  if(!dialog.open)dialog.showModal();
}

function closeDialog(){const dialog=$('#advertisementDialog');if(dialog?.open)dialog.close()}
function paintPreview(){
  const form=$('#advertisementForm'),img=$('#advertisementImagePreview');if(!form||!img)return;
  const value=String(form.elements.image_url.value||'').trim();
  if(!value){img.style.display='none';img.removeAttribute('src');return}
  img.src=value;img.style.display='block';
}

async function save(e){
  e.preventDefault();
  const form=e.currentTarget,id=Number(form.elements.id.value||0);
  const payload={
    name:form.elements.name.value.trim(),
    image_url:form.elements.image_url.value.trim(),
    target_url:form.elements.target_url.value.trim()||null,
    alt_text:form.elements.alt_text.value.trim()||null,
    active:form.elements.active.checked,
  };
  try{
    if(!api)await backend();
    await api(id?`/api/admin/manage/advertisements/${id}`:'/api/admin/manage/advertisements',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
    closeDialog();
    await load();
    message(id?'Advertisement updated successfully.':'Advertisement created successfully.');
  }catch(err){message(err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save advertisement.'),true)}
}

async function remove(id){
  const item=items.find(x=>Number(x.id)===Number(id));
  if(!item||!confirm(`Delete advertisement "${item.name}"?`))return;
  try{
    if(!api)await backend();
    await api(`/api/admin/manage/advertisements/${id}`,{method:'DELETE'});
    await load();
    message('Advertisement deleted.');
  }catch(err){message(err?.message||'Could not delete advertisement.',true)}
}

function init(){
  ensureUi();
  $('#addAdvertisementBtn')?.addEventListener('click',()=>openDialog());
  $('#closeAdvertisementDialog')?.addEventListener('click',closeDialog);
  $('#cancelAdvertisementDialog')?.addEventListener('click',closeDialog);
  $('#advertisementForm')?.addEventListener('submit',save);
  $('#advertisementForm [name="image_url"]')?.addEventListener('input',paintPreview);
  $('#advertisementSearch')?.addEventListener('input',render);
  $('#advertisementStatusFilter')?.addEventListener('change',render);
  document.addEventListener('click',e=>{
    if(!(e.target instanceof Element))return;
    const edit=e.target.closest('[data-ad-edit]');if(edit){openDialog(items.find(x=>Number(x.id)===Number(edit.dataset.adEdit)));return}
    const del=e.target.closest('[data-ad-delete]');if(del)remove(Number(del.dataset.adDelete));
  });
  if(location.hash==='#advertisements')activatePanel();
  load();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
