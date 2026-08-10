(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function backend(){
  for(let i=0;i<150&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  return window.BWABackend;
}

function ensureUi(){
  const panel=$('[data-panel="categories"]');
  if(!panel)return null;
  let card=$('#homepageCategoriesCard');
  if(card)return card;

  card=document.createElement('section');
  card.id='homepageCategoriesCard';
  card.className='admin-card';
  card.style.marginBottom='22px';
  card.innerHTML=`
    <div class="admin-card-head">
      <div>
        <h2>Homepage Categories</h2>
        <p style="margin:6px 0 0;color:#667085">Choose up to 4 categories for the “Skills to transform your career and life” section. Their order below is the homepage order.</p>
      </div>
      <a class="admin-small admin-link" href="/" target="_blank" rel="noopener">View homepage</a>
    </div>
    <form id="homepageCategoriesForm">
      <div class="admin-form-grid" id="homepageCategorySlots"></div>
      <p id="homepageCategoriesMessage" class="admin-muted" style="margin:12px 0 0"></p>
      <div class="admin-form-actions"><button class="admin-primary" type="submit">Save homepage categories</button></div>
    </form>`;

  const heading=panel.querySelector('.admin-heading');
  if(heading)heading.insertAdjacentElement('afterend',card);else panel.prepend(card);
  return card;
}

function renderSlots(categories,selected){
  const wrap=$('#homepageCategorySlots');
  if(!wrap)return;
  const options=categories.map(c=>`<option value="${Number(c.id)}">${esc(c.name)}</option>`).join('');
  wrap.innerHTML=[0,1,2,3].map(i=>`
    <label>Category ${i+1}
      <select name="category_${i+1}">
        <option value="">${i===0?'Choose category':'None'}</option>
        ${options}
      </select>
    </label>`).join('');
  [0,1,2,3].forEach(i=>{const select=wrap.querySelector(`[name="category_${i+1}"]`);if(select)select.value=selected[i]?String(selected[i]):''});
}

async function load(){
  ensureUi();
  const message=$('#homepageCategoriesMessage');
  try{
    const b=await backend();
    const out=await b.api('/api/admin/manage/homepage-categories');
    renderSlots(out.categories||[],out.selected_ids||[]);
    if(message)message.textContent='Clicking a homepage category opens the Courses page filtered to that category.';
  }catch(err){if(message)message.textContent=err?.message||'Could not load homepage categories.'}
}

async function save(e){
  e.preventDefault();
  const form=e.currentTarget,message=$('#homepageCategoriesMessage');
  const ids=[1,2,3,4].map(i=>Number(form.elements[`category_${i}`]?.value||0)).filter(Boolean);
  if(!ids.length){if(message)message.textContent='Choose at least one category.';return}
  if(new Set(ids).size!==ids.length){if(message)message.textContent='Choose each category only once.';return}
  try{
    const b=await backend();
    await b.api('/api/admin/manage/homepage-categories',{method:'PUT',body:JSON.stringify({category_ids:ids})});
    if(message)message.textContent='Homepage categories saved successfully.';
  }catch(err){if(message)message.textContent=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Could not save homepage categories.')}
}

function init(){
  ensureUi();
  $('#homepageCategoriesForm')?.addEventListener('submit',save);
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
