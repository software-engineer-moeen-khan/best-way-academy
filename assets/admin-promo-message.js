(()=>{
'use strict';
const $=s=>document.querySelector(s);

function toast(message,error=false){
  const el=$('#adminToast');
  if(el){
    el.textContent=message;
    el.classList.toggle('error',error);
    el.classList.add('show');
    clearTimeout(window.__bwaPromoToast);
    window.__bwaPromoToast=setTimeout(()=>el.classList.remove('show'),3200);
    return;
  }
  if(error)alert(message);
}

async function backend(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,50));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available||window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

function loadBulkFreeControls(){
  if(document.querySelector('script[data-bwa-bulk-free-loader]'))return;
  const script=document.createElement('script');
  script.src='/assets/admin-bulk-free.js?rev=20260820-bulk-free-v1';
  script.async=true;
  script.dataset.bwaBulkFreeLoader='1';
  document.body.appendChild(script);
}

function buildUi(){
  const panel=document.querySelector('[data-panel="settings"]');
  if(!panel||$('#adminPromoMessageForm'))return null;

  const form=document.createElement('form');
  form.id='adminPromoMessageForm';
  form.className='admin-card admin-settings-form';
  form.style.marginTop='18px';
  form.innerHTML=`
    <div class="admin-card-head">
      <div>
        <h2>Top announcement message</h2>
        <p class="admin-muted">Controls the message strip shown above the public website header.</p>
      </div>
    </div>
    <label class="span-2">Top message
      <input id="adminPromoMessageInput" name="message" type="text" maxlength="300" autocomplete="off" placeholder="Save 30% on yearly learning plans — learn more, spend less.">
      <small>Leave this field blank and save if you want to hide the top announcement strip.</small>
    </label>
    <div class="admin-form-actions">
      <button class="admin-primary" type="submit">Save top message</button>
    </div>`;

  panel.appendChild(form);
  return form;
}

async function load(){
  loadBulkFreeControls();
  const form=buildUi();
  if(!form)return;
  const input=$('#adminPromoMessageInput');
  const button=form.querySelector('button[type="submit"]');

  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/promo-message');
    input.value=String(out?.message??'');
  }catch(err){
    toast(err?.message||'Could not load the top message.',true);
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    button.disabled=true;
    const old=button.textContent;
    button.textContent='Saving…';
    try{
      const b=await backend();
      await b.api('/api/admin/manage/promo-message',{
        method:'PUT',
        body:JSON.stringify({message:input.value.trim()})
      });
      toast('Top announcement message saved.');
    }catch(err){
      const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save the top message.');
      toast(text,true);
    }finally{
      button.disabled=false;
      button.textContent=old;
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
