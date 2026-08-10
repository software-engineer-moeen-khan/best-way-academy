(()=>{
'use strict';
if(window.__AWKSadaPayAdminTools)return;window.__AWKSadaPayAdminTools=true;
const $=s=>document.querySelector(s);
let bridge=null,orders=[];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function ready(){for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));if(!window.BWABackend)return null;await window.BWABackend.ready;if(!window.BWABackend.available||window.BWABackend.user?.role!=='admin')return null;bridge=window.BWABackend;return bridge}
function toast(text,error=false){const el=$('#adminToast');if(!el){alert(text);return}el.textContent=text;el.classList.toggle('error',error);el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3600)}
function meta(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)||{}}catch{return{}}}
function errorText(e,fallback){if(e?.data?.errors)return Object.values(e.data.errors).flat().join(' ');return e?.data?.message||e?.message||fallback}

function installCard(){
  const panel=document.querySelector('.admin-section[data-panel="settings"]');if(!panel||$('#adminPaymentQrCard'))return;
  const card=document.createElement('section');card.id='adminPaymentQrCard';card.className='admin-card admin-payment-card';card.innerHTML=`
    <div class="admin-card-head">
      <div><h2>SadaPay payment settings</h2><p>Set the SadaPay number and QR shown to learners during checkout.</p></div>
      <span id="adminPaymentQrStatus" class="status-pill status-pending">Checking</span>
    </div>
    <div class="admin-payment-body">
      <div class="admin-payment-preview"><img id="adminPaymentQrPreview" alt="SadaPay payment QR" hidden><div id="adminPaymentQrEmpty">No QR uploaded yet.</div></div>
      <div class="admin-payment-controls">
        <label>SadaPay account / mobile number
          <input id="adminSadapayNumber" type="text" maxlength="60" autocomplete="off" placeholder="e.g. +92 3XX XXXXXXX">
        </label>
        <div class="admin-actions"><button id="adminSadapaySave" type="button" class="admin-primary">Save SadaPay Number</button></div>
        <p>Upload the official SadaPay QR. The QR is stored in MySQL so server file permissions cannot break checkout.</p>
        <label class="admin-payment-file">SadaPay QR image<input id="adminPaymentQrFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <div id="adminPaymentQrFilename" class="admin-payment-filename">No file selected</div>
        <div class="admin-actions"><button id="adminPaymentQrUpload" type="button" class="admin-primary">Upload / Replace QR</button><button id="adminPaymentQrRemove" type="button" class="admin-danger">Remove QR</button></div>
        <small>Accepted QR: JPG, PNG or WebP · maximum 3 MB.</small>
      </div>
    </div>`;
  const settings=$('#adminSettingsForm');(settings||panel.lastElementChild)?.insertAdjacentElement('afterend',card);
  $('#adminSadapaySave')?.addEventListener('click',saveNumber);
  $('#adminPaymentQrUpload')?.addEventListener('click',upload);
  $('#adminPaymentQrRemove')?.addEventListener('click',removeQr);
  $('#adminPaymentQrFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];const out=$('#adminPaymentQrFilename');if(out)out.textContent=f?`${f.name} · ${(f.size/1024).toFixed(0)} KB`:'No file selected'});
}
async function getConfig(){const r=await fetch('/api/payment/sadapay?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error(`SadaPay settings request failed (${r.status})`);return r.json()}
async function loadConfig(){
  try{
    const c=await getConfig(),status=$('#adminPaymentQrStatus'),img=$('#adminPaymentQrPreview'),empty=$('#adminPaymentQrEmpty'),remove=$('#adminPaymentQrRemove'),number=$('#adminSadapayNumber');
    if(number)number.value=c.account_number||'';
    if(status){status.textContent=c.enabled?'Checkout ready':'Needs setup';status.className='status-pill '+(c.enabled?'status-active':'status-pending')}
    if(c.qr_url){if(img){img.src=c.qr_url+(c.qr_url.includes('?')?'&':'?')+'t='+Date.now();img.hidden=false}if(empty)empty.hidden=true;if(remove)remove.disabled=false}else{if(img){img.hidden=true;img.removeAttribute('src')}if(empty)empty.hidden=false;if(remove)remove.disabled=true}
    return c;
  }catch(e){toast(errorText(e,'Could not load SadaPay settings.'),true);return null}
}
async function saveNumber(){
  const input=$('#adminSadapayNumber'),number=String(input?.value||'').trim(),btn=$('#adminSadapaySave');
  if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{await bridge.api('/api/admin/manage/payment/sadapay',{method:'PUT',body:JSON.stringify({account_number:number||null})});toast(number?'SadaPay number saved.':'SadaPay number cleared.');await loadConfig()}catch(e){toast(errorText(e,'Could not save SadaPay number.'),true)}finally{if(btn){btn.disabled=false;btn.textContent='Save SadaPay Number'}}
}
async function upload(){
  const input=$('#adminPaymentQrFile'),file=input?.files?.[0];
  if(!file){toast('Choose the SadaPay QR image first.',true);return}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Choose a JPG, PNG or WebP QR image.',true);return}
  if(file.size>3*1024*1024){toast('QR image must be 3 MB or smaller.',true);return}
  const fd=new FormData();fd.append('qr',file,file.name);
  const btn=$('#adminPaymentQrUpload');if(btn){btn.disabled=true;btn.textContent='Uploading…'}
  try{
    await bridge.api('/api/admin/manage/payment/sadapay-qr',{method:'POST',body:fd});
    const c=await loadConfig();if(!c?.qr_url)throw new Error('Upload finished but the QR could not be verified. Please try again.');
    toast('SadaPay QR uploaded successfully.');input.value='';const name=$('#adminPaymentQrFilename');if(name)name.textContent='No file selected';
  }catch(e){toast(errorText(e,'QR upload failed.'),true)}finally{if(btn){btn.disabled=false;btn.textContent='Upload / Replace QR'}}
}
async function removeQr(){if(!confirm('Remove the SadaPay payment QR? Learners can still use the SadaPay number if it is configured.'))return;try{await bridge.api('/api/admin/manage/payment/sadapay-qr',{method:'DELETE'});toast('SadaPay QR removed.');await loadConfig()}catch(e){toast(errorText(e,'Could not remove QR.'),true)}}

async function loadOrderMeta(){try{const out=await bridge.api('/api/admin/manage/workspace');orders=out.orders||[];decorateOrders()}catch{}}
function decorateOrders(){
  const rows=[...document.querySelectorAll('#adminOrdersBody tr')];
  rows.forEach(row=>{
    const number=row.querySelector('td:first-child strong')?.textContent?.trim();if(!number)return;
    const order=orders.find(o=>String(o.number)===number);if(!order)return;
    const m=meta(order.metadata);if(order.payment_method!=='sadapay'&&!String(m.payment_channel||'').includes('sadapay'))return;
    const cell=row.children[3];if(!cell||cell.querySelector('.admin-payment-reference'))return;
    const ref=esc(m.payment_reference||'Not supplied');cell.insertAdjacentHTML('beforeend',`<small class="admin-payment-reference"><b>SadaPay Ref:</b> ${ref}</small>${m.payment_submitted_at?`<small class="admin-payment-reference">Submitted: ${esc(new Date(m.payment_submitted_at).toLocaleString('en-PK'))}</small>`:''}`)
  });
}

async function init(){if(!await ready())return;installCard();injectCss();await loadConfig();await loadOrderMeta();const body=$('#adminOrdersBody');if(body)new MutationObserver(()=>decorateOrders()).observe(body,{childList:true,subtree:true});$('#adminRefresh')?.addEventListener('click',()=>setTimeout(()=>{loadConfig();loadOrderMeta()},500))}
function injectCss(){if(document.querySelector('link[data-admin-payment-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/admin-payment-tools.css?rev=20260810-sadapay-v1';l.dataset.adminPaymentCss='1';document.head.appendChild(l)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
