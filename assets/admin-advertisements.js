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
    .admin-ad-code-preview{width:112px;height:62px;border-radius:10px;border:1px solid #e4e7ec;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#6941c6;text-align:center;padding:8px}
    .admin-ad-name small{display:block;margin-top:4px;color:#667085;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .admin-ad-placement{font-size:12px;color:#667085}
    .admin-ad-type{display:inline-flex;padding:4px 8px;border-radius:999px;background:#f2f4f7;color:#344054;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-left:6px}
    #advertisementDialog .admin-ad-image-preview{width:100%;max-height:220px;object-fit:contain;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc;margin-top:8px;display:none}
    #advertisementEmbedPreview{white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc;padding:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#344054;margin-top:8px;display:none}
    [data-ad-mode][hidden]{display:none!important}
    @media(max-width:780px){.admin-ad-preview,.admin-ad-code-preview{width:86px;height:52px}}
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
        <div><p class="eyebrow">MONETIZATION</p><h1>Advertisements</h1><p>Create image ads or embed-code ads now. Website placements will be assigned later.</p></div>
        <button id="addAdvertisementBtn" class="admin-primary" type="button">+ Add advertisement</button>
      </div>
      <div class="admin-card" style="margin-bottom:18px">
        <strong>Placement status</strong>
        <p style="margin:6px 0 0;color:#667085">Ads saved here are not shown publicly yet. Image creatives and third-party embed codes can both be stored now; placements will be connected later.</p>
      </div>
      <div class="admin-toolbar"><input id="advertisementSearch" type="search" placeholder="Search advertisements…"><select id="advertisementTypeFilter"><option value="">All types</option><option value="image">Image ads</option><option value="embed">Embed code ads</option></select><select id="advertisementStatusFilter"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
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
        <label>Advertisement type<select name="ad_type" required><option value="image">Image ad</option><option value="embed">Embed code</option></select></label>

        <div data-ad-mode="image">
          <label>Advertisement image URL<input name="image_url" maxlength="2048" inputmode="url" placeholder="https://example.com/banner.jpg"></label>
          <img id="advertisementImagePreview" class="admin-ad-image-preview" alt="Advertisement preview">
          <label>Click / destination URL <small>Optional until the destination is ready.</small><input name="target_url" maxlength="2048" inputmode="url" placeholder="https://advertiser.example.com/"></label>
          <label>Image alt text<input name="alt_text" maxlength="255" placeholder="Short description of the advertisement"></label>
        </div>

        <div data-ad-mode="embed" hidden>
          <label>Advertisement embed code <small>Paste the complete HTML / iframe / script snippet supplied by the ad provider.</small><textarea name="embed_code" rows="10" maxlength="200000" spellcheck="false" placeholder="<script>...</script> or <iframe ...></iframe>"></textarea></label>
          <pre id="advertisementEmbedPreview" aria-label="Embed code preview"></pre>
          <p class="admin-muted" style="margin:8px 0 0">For safety, embed code is stored as text and is not executed inside the Admin Panel.</p>
        </div>

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
  const type=$('#advertisementTypeFilter')?.value||'';
  const status=$('#advertisementStatusFilter')?.value||'';
  const text=`${item.name||''} ${item.ad_type||''} ${item.target_url||''} ${item.alt_text||''} ${item.embed_code||''}`.toLowerCase();
  return(!q||text.includes(q))&&(!type||item.ad_type===type)&&(!status||(status==='active'?item.active:!item.active));
}

function shortCode(value){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>90?text.slice(0,87)+'…':text;
}

function render(){
  const body=$('#advertisementsBody'),empty=$('#advertisementsEmpty');
  if(!body||!empty)return;
  const list=items.filter(matches);
  body.innerHTML=list.map(item=>{
    const type=item.ad_type==='embed'?'embed':'image';
    const preview=type==='embed'
      ?'<div class="admin-ad-code-preview">&lt;/&gt;<br>Embed</div>'
      :`<img class="admin-ad-preview" src="${esc(item.image_url||'')}" alt="${esc(item.alt_text||item.name)}">`;
    const detail=type==='embed'?shortCode(item.embed_code):String(item.image_url||'');
    const destination=type==='embed'
      ?'<span class="admin-muted">Inside embed code</span>'
      :(item.target_url?`<a class="admin-link" href="${esc(item.target_url)}" target="_blank" rel="noopener noreferrer">Open destination ↗</a>`:'<span class="admin-muted">Not set</span>');
    return `<tr>
      <td>${preview}</td>
      <td class="admin-ad-name"><strong>${esc(item.name)}</strong><span class="admin-ad-type">${type==='embed'?'Embed code':'Image'}</span><small>${esc(detail)}</small></td>
      <td>${destination}</td>
      <td><span class="admin-ad-placement">${item.placement_key?esc(item.placement_key):'Unassigned'}</span></td>
      <td><span class="status-pill ${item.active?'status-active':'status-hidden'}">${item.active?'active':'inactive'}</span></td>
      <td><div class="admin-actions"><button class="admin-small primary" type="button" data-ad-edit="${item.id}">Edit</button><button class="admin-small danger" type="button" data-ad-delete="${item.id}">Delete</button></div></td>
    </tr>`;
  }).join('');
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

function syncMode(){
  const form=$('#advertisementForm');if(!form)return;
  const type=form.elements.ad_type.value==='embed'?'embed':'image';
  document.querySelectorAll('#advertisementDialog [data-ad-mode]').forEach(group=>group.hidden=group.dataset.adMode!==type);
  form.elements.image_url.required=type==='image';
  form.elements.embed_code.required=type==='embed';
  paintPreview();
  paintEmbedPreview();
}

function openDialog(item=null){
  const dialog=$('#advertisementDialog'),form=$('#advertisementForm');
  if(!dialog||!form)return;
  form.reset();
  form.elements.id.value=item?.id||'';
  form.elements.name.value=item?.name||'';
  form.elements.ad_type.value=item?.ad_type==='embed'?'embed':'image';
  form.elements.image_url.value=item?.image_url||'';
  form.elements.embed_code.value=item?.embed_code||'';
  form.elements.target_url.value=item?.target_url||'';
  form.elements.alt_text.value=item?.alt_text||'';
  form.elements.active.checked=item?!!item.active:true;
  $('#advertisementDialogTitle').textContent=item?'Edit advertisement':'Add advertisement';
  syncMode();
  if(!dialog.open)dialog.showModal();
}

function closeDialog(){const dialog=$('#advertisementDialog');if(dialog?.open)dialog.close()}
function paintPreview(){
  const form=$('#advertisementForm'),img=$('#advertisementImagePreview');if(!form||!img)return;
  const value=String(form.elements.image_url.value||'').trim();
  if(!value){img.style.display='none';img.removeAttribute('src');return}
  img.src=value;img.style.display='block';
}
function paintEmbedPreview(){
  const form=$('#advertisementForm'),pre=$('#advertisementEmbedPreview');if(!form||!pre)return;
  const value=String(form.elements.embed_code.value||'').trim();
  pre.textContent=value;
  pre.style.display=value?'block':'none';
}

async function save(e){
  e.preventDefault();
  const form=e.currentTarget,id=Number(form.elements.id.value||0),type=form.elements.ad_type.value==='embed'?'embed':'image';
  const payload={
    name:form.elements.name.value.trim(),
    ad_type:type,
    image_url:type==='image'?(form.elements.image_url.value.trim()||null):null,
    embed_code:type==='embed'?(form.elements.embed_code.value.trim()||null):null,
    target_url:type==='image'?(form.elements.target_url.value.trim()||null):null,
    alt_text:type==='image'?(form.elements.alt_text.value.trim()||null):null,
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
  $('#advertisementForm [name="ad_type"]')?.addEventListener('change',syncMode);
  $('#advertisementForm [name="image_url"]')?.addEventListener('input',paintPreview);
  $('#advertisementForm [name="embed_code"]')?.addEventListener('input',paintEmbedPreview);
  $('#advertisementSearch')?.addEventListener('input',render);
  $('#advertisementTypeFilter')?.addEventListener('change',render);
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
