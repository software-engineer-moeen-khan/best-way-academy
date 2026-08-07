(()=>{
  const nativeSet=Storage.prototype.setItem, nativeRemove=Storage.prototype.removeItem;
  let csrf=null, currentUser=null, backend=false, syncing=false;
  const globalKey=k=>k==='bwa_admin_courses'||k.startsWith('bwa_curriculum_')||k.startsWith('bwa_announcements_')||k.startsWith('bwa_coupons_')||k.startsWith('bwa_instructor_');
  const api=async(path,options={})=>{
    const headers={'Accept':'application/json','X-Requested-With':'XMLHttpRequest',...(options.headers||{})};
    if(options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
    if(csrf && !['GET','HEAD'].includes((options.method||'GET').toUpperCase())) headers['X-CSRF-TOKEN']=csrf;
    const r=await fetch(path,{credentials:'same-origin',...options,headers});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(data.message||`Request failed (${r.status})`);e.status=r.status;e.data=data;throw e}return data;
  };
  const putLocal=(k,v)=>nativeSet.call(localStorage,k,typeof v==='string'?v:JSON.stringify(v));
  const readLocal=(k,d=null)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}};
  async function pushKey(k,v){if(!backend||!currentUser||syncing||!k.startsWith('bwa_'))return;
    try{
      if(k==='bwa_admin_courses'&&['admin','instructor'].includes(currentUser.role)){
        await api('/api/instructor/courses/sync',{method:'POST',body:JSON.stringify({courses:JSON.parse(v||'{}')||{}})});return;
      }
      if(k.startsWith('bwa_curriculum_')&&['admin','instructor'].includes(currentUser.role)){
        const slug=k.replace('bwa_curriculum_','');await api(`/api/instructor/courses/${encodeURIComponent(slug)}/curriculum/sync`,{method:'POST',body:JSON.stringify({sections:JSON.parse(v||'[]')||[]})});return;
      }
      if(k.startsWith('bwa_player_')){
        const slug=k.replace('bwa_player_',''),state=JSON.parse(v||'{}')||{};await api(`/api/courses/${encodeURIComponent(slug)}/progress/sync`,{method:'POST',body:JSON.stringify({completed_positions:state.completed||[]})});return;
      }
      const value=(()=>{try{return JSON.parse(v)}catch{return v}})();
      await api(globalKey(k)&&['admin','instructor'].includes(currentUser.role)?'/api/global-state':'/api/state',{method:'PUT',body:JSON.stringify({key:k,value})});
    }catch(e){console.warn('[BWA backend sync]',k,e.message)}
  }
  Storage.prototype.setItem=function(k,v){nativeSet.call(this,k,v);if(this===localStorage)queueMicrotask(()=>pushKey(String(k),String(v)))};
  Storage.prototype.removeItem=function(k){nativeRemove.call(this,k);if(this===localStorage&&backend&&currentUser&&String(k).startsWith('bwa_')){
    if(k==='bwa_user'){api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});currentUser=null;return}
    api('/api/state',{method:'DELETE',body:JSON.stringify({key:String(k)})}).catch(()=>{});
  }};
  async function init(){
    try{const s=await api('/api/session');backend=true;csrf=s.csrf_token;currentUser=s.user||null;if(!currentUser)return s;
      const b=await api('/api/bootstrap');csrf=b.csrf_token||csrf;syncing=true;
      const serverStates=b.states||{};for(const [k,v] of Object.entries(serverStates))putLocal(k,v);
      for(const [k,v] of Object.entries(b.global_states||{}))putLocal(k,v);
      const courseOverrides={};for(const [slug,c] of Object.entries(b.courses||{}))courseOverrides[slug]={title:c.title,category:c.category,subtitle:c.subtitle,description:c.description,price:c.price,status:c.status,image:c.image,badge:c.badge};
      putLocal('bwa_admin_courses',courseOverrides);putLocal('bwa_user',b.user);syncing=false;
      if(!sessionStorage.getItem('bwa_backend_bootstrapped')){sessionStorage.setItem('bwa_backend_bootstrapped','1');location.reload()}
      return b;
    }catch(e){backend=false;console.info('[BWA] Laravel backend not available; frontend stays in offline/local mode.');return null}
  }
  const ready=init();
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!(form instanceof HTMLFormElement))return;
    if(form.id==='demoAuthForm'){
      e.preventDefault();e.stopImmediatePropagation();await ready; if(!backend)return;
      const signup=location.pathname.toLowerCase().includes('signup'),email=form.querySelector('input[type=email]')?.value.trim(),password=form.querySelector('input[type=password]')?.value||'',name=form.querySelector('input[type=text]')?.value.trim()||'Learner';
      try{const out=await api(signup?'/api/auth/register':'/api/auth/login',{method:'POST',body:JSON.stringify(signup?{name,email,password}:{email,password})});currentUser=out.user;csrf=out.csrf_token||csrf;putLocal('bwa_user',out.user);const next=new URLSearchParams(location.search).get('next');location.href=next||out.redirect||'dashboard.html'}catch(err){const m=document.querySelector('#authMessage');if(m)m.textContent=err.data?.errors?Object.values(err.data.errors).flat().join(' '):err.message}return;
    }
    if(form.id==='checkoutForm'){
      await ready;if(!backend)return;if(!currentUser){e.preventDefault();e.stopImmediatePropagation();location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return}
      e.preventDefault();e.stopImmediatePropagation();const p=new URLSearchParams(location.search);let ids=p.get('cart')==='1'?(readLocal('bwa_cart',[])||[]):[p.get('course')||'python'];
      try{const pm=form.querySelector('input[name=payment]:checked')?.value||'demo',out=await api('/api/checkout',{method:'POST',body:JSON.stringify({course_slugs:ids,payment_method:pm})});
        const order={number:out.order.number,total:out.order.total,date:out.order.created_at,ids};putLocal('bwa_last_order',order);putLocal('bwa_orders',[order,...(readLocal('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);
        const enroll=(out.enrollments||[]).map(x=>({id:x.course?.slug,date:x.enrolled_at||x.created_at,progress:x.progress||0})).filter(x=>x.id);putLocal('bwa_enrollments',enroll);putLocal('bwa_cart',[]);location.href='success.html';
      }catch(err){alert(err.message)}return;
    }
    if(form.id==='profileForm'&&backend&&currentUser){
      e.preventDefault();e.stopImmediatePropagation();const name=form.querySelector('input[type=text]')?.value.trim(),email=form.querySelector('input[type=email]')?.value.trim();
      try{const out=await api('/api/profile',{method:'PUT',body:JSON.stringify({name,email})});currentUser=out.user;putLocal('bwa_user',out.user);location.reload()}catch(err){alert(err.message)}
    }
  },true);
  window.BWABackend={ready,api,get user(){return currentUser},get available(){return backend}};
})();
