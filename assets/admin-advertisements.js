(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const GOOGLE_AI_PLACEMENT='homepage_google_ai_popunder';
const LONGBAR_PLACEMENT='homepage_popular_skills_longbar';
const COURSE_HERO_PLACEMENT='course_detail_hero_ad';
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
    .admin-placement-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin-top:14px}
    .admin-placement-grid label{margin:0}
    .admin-placement-card{margin-bottom:18px}
    #advertisementDialog .admin-ad-image-preview{width:100%;max-height:220px;object-fit:contain;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc;margin-top:8px;display:none}
    #advertisementEmbedPreview{white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc;padding:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#344054;margin-top:8px;display:none}
    [data-ad-mode][hidden]{display:none!important}
    @media(max-width:780px){.admin-ad-preview,.admin-ad-code-preview{width:86px;height:52px}.admin-placement-grid{grid-template-columns:1fr}.admin-placement-grid button{width:100%}}
  `;
  document.head.appendChild(style);
}

function ensureUi(){
  installStyle();
  const tabs=$('#adminTabs'),main=$('.admin-main');
  if(!tabs||!main)return;

  if(!tabs.querySelector('[data-tab="advertisements"]')){
    const button=document.createElement('button');
    button.type='button';button.dataset.tab='advertisements';button.innerHTML='<span>▤</span> Advertisements';
    const settings=tabs.querySelector('[data-tab="settings"]');
    if(settings)tabs.insertBefore(button,settings);else tabs.appendChild(button);
    button.addEventListener('click',activatePanel);
  }

  if(!$('[data-panel="advertisements"]')){
    const section=document.createElement('section');
    section.className='admin-section';section.dataset.panel='advertisements';
    section.innerHTML=`
      <div class="admin-heading">
        <div><p class="eyebrow">MONETIZATION</p><h1>Advertisements</h1><p>Create image ads or embed-code ads and assign them to website placements.</p></div>
        <button id="addAdvertisementBtn" class="admin-primary" type="button">+ Add advertisement</button>
      </div>
      <div class="admin-card admin-placement-card">
        <strong>Homepage — Learn AI with Google Popunder</strong>
        <p style="margin:6px 0 0;color:#667085">Choose the ad that should open when a visitor clicks anywhere in the “Learn AI with Google” section.</p>
        <form id="googleAiPopunderPlacementForm" class="admin-placement-grid">
          <label>Selected advertisement<select id="googleAiPopunderAdvertisement"><option value="">None / disabled</option></select></label>
          <button class="admin-primary" type="submit">Save placement</button>
        </form>
        <p id="googleAiPopunderPlacementMessage" class="admin-muted" style="margin:10px 0 0"></p>
      </div>
      <div class="admin-card admin-placement-card">
        <strong>Homepage — Popular Skills LongBar Ad</strong>
        <p style="margin:6px 0 0;color:#667085">This replaces the complete “Popular Skills” section on the homepage with the selected full-width advertisement.</p>
        <form id="longbarPlacementForm" class="admin-placement-grid">
          <label>Selected advertisement<select id="longbarAdvertisement"><option value="">None / hidden</option></select></label>
          <button class="admin-primary" type="submit">Save placement</button>
        </form>
        <p id="longbarPlacementMessage" class="admin-muted" style="margin:10px 0 0"></p>
      </div>
      <div class="admin-card admin-placement-card">
        <strong>Course Details — Hero Banner / Native Ad</strong>
        <p style="margin:6px 0 0;color:#667085">Shown below the Lifetime access / Certificate row in the Course Details hero. Choose an Image ad for a banner or Embed code for a native/network ad unit.</p>
        <form id="courseHeroPlacementForm" class="admin-placement-grid">
          <label>Selected advertisement<select id="courseHeroAdvertisement"><option value="">None / hidden</option></select></label>
          <button class="admin-primary" type="submit">Save placement</button>
        </form>
        <p id="courseHeroPlacementMessage" class="admin-muted" style="margin:10px 0 0"></p>
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
    dialog.id='advertisementDialog';dialog.className='admin-dialog';
    dialog.innerHTML=`
      <form id="advertisementForm">
        <div class="dialog-head"><div><p class="eyebrow">ADVERTISEMENT</p><h2 id="advertisementDialogTitle">Add advertisement</h2></div><button type="button" id="closeAdvertisementDialog" aria-label="Close">×</button></div>
        <input type="hidden" name="id">
        <label>Ad name<input name="name" required maxlength="160" placeholder="Summer sale banner"></label>
        <label>Advertisement type<select name="ad_type" required><option value="image">Image ad</option><option value="embed">Embed code</option></select></label>
        <div data-ad-mode="image">
          <label>Advertisement image URL<input name="image_url" maxlength="2048" inputmode="url" placeholder="https://example.com/banner.jpg"></label>
          <img id="advertisementImagePreview" class="admin-ad-image-preview" alt="Advertisement preview">
          <label>Click / destination URL <small>Optional for LongBar; required for Popunder.</small><input name="target_url" maxlength="2048" inputmode="url" placeholder="https://advertiser.example.com/"></label>
          <label>Image alt text<input name="alt_text" maxlength="255" placeholder="Short description of the advertisement"></label>
        </div>
        <div data-ad-mode="embed" hidden>
          <label>Advertisement embed code <small>Paste the complete HTML / iframe / script snippet supplied by the ad provider.</small><textarea name="embed_code" rows="10" maxlength="200000" spellcheck="false" placeholder="<script>...</script> or <iframe ...></iframe>"></textarea></label>
          <pre id="advertisementEmbedPreview" aria-label="Embed code preview"></pre>
          <p class="admin-muted" style="margin:8px 0 0">For safety, embed code is stored as text and is not executed inside the Admin Panel.</p>
        </div>
        <label class="admin-check"><input name="active" type="checkbox" checked> <span><b>Active advertisement</b><small>Only active ads can run on website placements.</small></span></label>
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
  history.replaceState(null,'','#advertisements');load();
}

function matches(item){
  const q=String($('#advertisementSearch')?.value||'').trim().toLowerCase(),type=$('#advertisementTypeFilter')?.value||'',status=$('#advertisementStatusFilter')?.value||'';
  const text=`${item.name||''} ${item.ad_type||''} ${item.target_url||''} ${item.alt_text||''} ${item.embed_code||''}`.toLowerCase();
  return(!q||text.includes(q))&&(!type||item.ad_type===type)&&(!status||(status==='active'?item.active:!item.active));
}
function shortCode(value){const text=String(value||'').replace(/\s+/g,' ').trim();return text.length>90?text.slice(0,87)+'…':text}
function placementsOf(item){return Array.isArray(item.placements)?item.placements:(item.placement_key?[item.placement_key]:[])}
function placementLabel(key){if(key===GOOGLE_AI_PLACEMENT)return'Homepage · Google AI Popunder';if(key===LONGBAR_PLACEMENT)return'Homepage · Popular Skills LongBar';if(key===COURSE_HERO_PLACEMENT)return'Course Details · Hero Ad';return key||'Unassigned'}
function usableForPopunder(item){return !!item.active&&(item.ad_type==='embed'?!!String(item.embed_code||'').trim():!!String(item.target_url||'').trim())}
function usableForLongbar(item){return !!item.active&&(item.ad_type==='embed'?!!String(item.embed_code||'').trim():!!String(item.image_url||'').trim())}

function fillPlacement(selectId,msgId,key,usable,emptyText,selectedText){
  const select=$(selectId),msg=$(msgId);if(!select)return;
  const selected=items.find(x=>placementsOf(x).includes(key));
  select.innerHTML='<option value="">None / disabled</option>'+items.map(item=>{
    const ok=usable(item),type=item.ad_type==='embed'?'Embed':'Image';
    const why=!item.active?' — inactive':(!ok?' — missing required content':'');
    return `<option value="${item.id}" ${ok?'':'disabled'}>${esc(item.name)} (${type})${esc(why)}</option>`;
  }).join('');
  select.value=selected?String(selected.id):'';
  if(msg)msg.textContent=selected?selectedText(selected):emptyText;
}

function renderPlacements(){
  fillPlacement('#googleAiPopunderAdvertisement','#googleAiPopunderPlacementMessage',GOOGLE_AI_PLACEMENT,usableForPopunder,'No popunder advertisement is currently assigned.',x=>`Currently selected: ${x.name}.`);
  fillPlacement('#longbarAdvertisement','#longbarPlacementMessage',LONGBAR_PLACEMENT,usableForLongbar,'No LongBar advertisement is currently assigned; Popular Skills will be hidden.',x=>`Currently selected: ${x.name}. It replaces the Popular Skills section.`);
  fillPlacement('#courseHeroAdvertisement','#courseHeroPlacementMessage',COURSE_HERO_PLACEMENT,usableForLongbar,'No Course Details hero advertisement is currently assigned.',x=>`Currently selected: ${x.name}. It appears below the course metadata.`);
}

function render(){
  const body=$('#advertisementsBody'),empty=$('#advertisementsEmpty');if(!body||!empty)return;
  const list=items.filter(matches);
  body.innerHTML=list.map(item=>{
    const type=item.ad_type==='embed'?'embed':'image';
    const preview=type==='embed'?'<div class="admin-ad-code-preview">&lt;/&gt;<br>Embed</div>':`<img class="admin-ad-preview" src="${esc(item.image_url||'')}" alt="${esc(item.alt_text||item.name)}">`;
    const detail=type==='embed'?shortCode(item.embed_code):String(item.image_url||'');
    const destination=type==='embed'?'<span class="admin-muted">Inside embed code</span>':(item.target_url?`<a class="admin-link" href="${esc(item.target_url)}" target="_blank" rel="noopener noreferrer">Open destination ↗</a>`:'<span class="admin-muted">Not set</span>');
    const placementText=placementsOf(item).length?placementsOf(item).map(placementLabel).join(' · '):'Unassigned';
    return `<tr><td>${preview}</td><td class="admin-ad-name"><strong>${esc(item.name)}</strong><span class="admin-ad-type">${type==='embed'?'Embed code':'Image'}</span><small>${esc(detail)}</small></td><td>${destination}</td><td><span class="admin-ad-placement">${esc(placementText)}</span></td><td><span class="status-pill ${item.active?'status-active':'status-hidden'}">${item.active?'active':'inactive'}</span></td><td><div class="admin-actions"><button class="admin-small primary" type="button" data-ad-edit="${item.id}">Edit</button><button class="admin-small danger" type="button" data-ad-delete="${item.id}">Delete</button></div></td></tr>`;
  }).join('');
  empty.hidden=list.length>0;
}

async function load(){
  try{if(!api)await backend();const out=await api('/api/admin/manage/advertisements');items=out.advertisements||[];render();renderPlacements();message(`${items.length} advertisement${items.length===1?'':'s'} saved.`)}
  catch(err){message(err?.message||'Could not load advertisements.',true)}
}

function syncMode(){
  const form=$('#advertisementForm');if(!form)return;const type=form.elements.ad_type.value==='embed'?'embed':'image';
  document.querySelectorAll('#advertisementDialog [data-ad-mode]').forEach(group=>group.hidden=group.dataset.adMode!==type);
  form.elements.image_url.required=type==='image';form.elements.embed_code.required=type==='embed';paintPreview();paintEmbedPreview();
}
function openDialog(item=null){
  const dialog=$('#advertisementDialog'),form=$('#advertisementForm');if(!dialog||!form)return;form.reset();
  form.elements.id.value=item?.id||'';form.elements.name.value=item?.name||'';form.elements.ad_type.value=item?.ad_type==='embed'?'embed':'image';form.elements.image_url.value=item?.image_url||'';form.elements.embed_code.value=item?.embed_code||'';form.elements.target_url.value=item?.target_url||'';form.elements.alt_text.value=item?.alt_text||'';form.elements.active.checked=item?!!item.active:true;
  $('#advertisementDialogTitle').textContent=item?'Edit advertisement':'Add advertisement';syncMode();if(!dialog.open)dialog.showModal();
}
function closeDialog(){const dialog=$('#advertisementDialog');if(dialog?.open)dialog.close()}
function paintPreview(){const form=$('#advertisementForm'),img=$('#advertisementImagePreview');if(!form||!img)return;const value=String(form.elements.image_url.value||'').trim();if(!value){img.style.display='none';img.removeAttribute('src');return}img.src=value;img.style.display='block'}
function paintEmbedPreview(){const form=$('#advertisementForm'),pre=$('#advertisementEmbedPreview');if(!form||!pre)return;const value=String(form.elements.embed_code.value||'').trim();pre.textContent=value;pre.style.display=value?'block':'none'}

async function save(e){
  e.preventDefault();const form=e.currentTarget,id=Number(form.elements.id.value||0),type=form.elements.ad_type.value==='embed'?'embed':'image';
  const payload={name:form.elements.name.value.trim(),ad_type:type,image_url:type==='image'?(form.elements.image_url.value.trim()||null):null,embed_code:type==='embed'?(form.elements.embed_code.value.trim()||null):null,target_url:type==='image'?(form.elements.target_url.value.trim()||null):null,alt_text:type==='image'?(form.elements.alt_text.value.trim()||null):null,active:form.elements.active.checked};
  try{if(!api)await backend();await api(id?`/api/admin/manage/advertisements/${id}`:'/api/admin/manage/advertisements',{method:id?'PUT':'POST',body:JSON.stringify(payload)});closeDialog();await load();message(id?'Advertisement updated successfully.':'Advertisement created successfully.')}
  catch(err){message(err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save advertisement.'),true)}
}

async function savePlacement(e,selectId,msgId,url,label){
  e.preventDefault();const select=$(selectId),msg=$(msgId),id=Number(select?.value||0)||null;
  try{if(!api)await backend();await api(url,{method:'PUT',body:JSON.stringify({advertisement_id:id})});await load();if(msg)msg.textContent=id?`${label} placement saved successfully.`:`${label} placement disabled.`}
  catch(err){if(msg)msg.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||`Could not save ${label} placement.`)}
}

async function remove(id){
  const item=items.find(x=>Number(x.id)===Number(id));if(!item||!confirm(`Delete advertisement "${item.name}"?`))return;
  try{if(!api)await backend();await api(`/api/admin/manage/advertisements/${id}`,{method:'DELETE'});await load();message('Advertisement deleted.')}
  catch(err){message(err?.message||'Could not delete advertisement.',true)}
}

function init(){
  ensureUi();
  $('#addAdvertisementBtn')?.addEventListener('click',()=>openDialog());
  $('#closeAdvertisementDialog')?.addEventListener('click',closeDialog);
  $('#cancelAdvertisementDialog')?.addEventListener('click',closeDialog);
  $('#advertisementForm')?.addEventListener('submit',save);
  $('#googleAiPopunderPlacementForm')?.addEventListener('submit',e=>savePlacement(e,'#googleAiPopunderAdvertisement','#googleAiPopunderPlacementMessage','/api/admin/manage/advertisement-placements/homepage-google-ai-popunder','Google AI popunder'));
  $('#longbarPlacementForm')?.addEventListener('submit',e=>savePlacement(e,'#longbarAdvertisement','#longbarPlacementMessage','/api/admin/manage/advertisement-placements/homepage-popular-skills-longbar','Homepage LongBar'));
  $('#courseHeroPlacementForm')?.addEventListener('submit',e=>savePlacement(e,'#courseHeroAdvertisement','#courseHeroPlacementMessage','/api/admin/manage/advertisement-placements/course-detail-hero-ad','Course Details hero'));
  $('#advertisementForm [name="ad_type"]')?.addEventListener('change',syncMode);
  $('#advertisementForm [name="image_url"]')?.addEventListener('input',paintPreview);
  $('#advertisementForm [name="embed_code"]')?.addEventListener('input',paintEmbedPreview);
  $('#advertisementSearch')?.addEventListener('input',render);
  $('#advertisementTypeFilter')?.addEventListener('change',render);
  $('#advertisementStatusFilter')?.addEventListener('change',render);
  document.addEventListener('click',e=>{if(!(e.target instanceof Element))return;const edit=e.target.closest('[data-ad-edit]');if(edit){openDialog(items.find(x=>Number(x.id)===Number(edit.dataset.adEdit)));return}const del=e.target.closest('[data-ad-delete]');if(del)remove(Number(del.dataset.adDelete))});
  if(location.hash==='#advertisements')activatePanel();
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();