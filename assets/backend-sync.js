(()=>{
  const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  let csrf=null,currentUser=null,backend=false,syncing=false,courseSnapshot={};
  const canonicalKeys=new Set(['bwa_user','bwa_enrollments','bwa_orders','bwa_last_order','bwa_admin_courses']);
  const globalKey=k=>k.startsWith('bwa_global_');

  const api=async(path,options={},retry419=true)=>{
    const headers={'Accept':'application/json','X-Requested-With':'XMLHttpRequest',...(options.headers||{})};
    if(options.body&&!(options.body instanceof FormData))headers['Content-Type']='application/json';
    if(csrf&&!['GET','HEAD'].includes((options.method||'GET').toUpperCase()))headers['X-CSRF-TOKEN']=csrf;
    const r=await fetch(path,{credentials:'same-origin',...options,headers});
    if(r.status===419&&retry419){
      try{const sr=await fetch('/api/session',{credentials:'same-origin',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});const s=await sr.json();csrf=s.csrf_token||csrf;currentUser=s.user||currentUser;return api(path,options,false)}catch{}
    }
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(data.message||`Request failed (${r.status})`);e.status=r.status;e.data=data;throw e}
    return data;
  };

  const putLocal=(k,v)=>nativeSet.call(localStorage,k,typeof v==='string'?v:JSON.stringify(v));
  const removeLocal=k=>nativeRemove.call(localStorage,k);
  const readLocal=(k,d=null)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}};

  async function pushKey(k,v){
    if(!backend||!currentUser||syncing||!k.startsWith('bwa_'))return;
    try{
      if(k==='bwa_admin_courses'&&['admin','instructor'].includes(currentUser.role)){
        const next=JSON.parse(v||'{}')||{},changed={};
        for(const [slug,patch] of Object.entries(next)){
          if(JSON.stringify(courseSnapshot[slug]??null)!==JSON.stringify(patch))changed[slug]=patch;
        }
        if(!Object.keys(changed).length)return;
        await api('/api/instructor/courses/sync',{method:'POST',body:JSON.stringify({courses:changed})});
        for(const [slug,patch] of Object.entries(changed))courseSnapshot[slug]=patch;
        return;
      }
      if(canonicalKeys.has(k))return;
      if(k.startsWith('bwa_curriculum_')&&['admin','instructor'].includes(currentUser.role)){
        const slug=k.replace('bwa_curriculum_','');
        await api(`/api/instructor/courses/${encodeURIComponent(slug)}/curriculum/sync`,{method:'POST',body:JSON.stringify({sections:JSON.parse(v||'[]')||[]})});return;
      }
      if(k.startsWith('bwa_announcements_')&&['admin','instructor'].includes(currentUser.role)){
        const slug=k.replace('bwa_announcements_','');
        await api(`/api/instructor/courses/${encodeURIComponent(slug)}/announcements/sync`,{method:'POST',body:JSON.stringify({announcements:JSON.parse(v||'[]')||[]})});return;
      }
      if(k==='bwa_coupons'&&['admin','instructor'].includes(currentUser.role)){
        await api('/api/instructor/coupons/sync',{method:'POST',body:JSON.stringify({coupons:JSON.parse(v||'[]')||[]})});return;
      }
      if(k.startsWith('bwa_player_')){
        const slug=k.replace('bwa_player_',''),state=JSON.parse(v||'{}')||{};
        await api(`/api/courses/${encodeURIComponent(slug)}/progress/sync`,{method:'POST',body:JSON.stringify({completed_positions:state.completed||[]})});return;
      }
      const value=(()=>{try{return JSON.parse(v)}catch{return v}})();
      const target=globalKey(k)&&currentUser.role==='admin'?'/api/global-state':'/api/state';
      await api(target,{method:'PUT',body:JSON.stringify({key:k,value})});
    }catch(e){console.warn('[BWA backend sync]',k,e.message)}
  }

  Storage.prototype.setItem=function(k,v){nativeSet.call(this,k,v);if(this===localStorage)queueMicrotask(()=>pushKey(String(k),String(v)))};
  Storage.prototype.removeItem=function(k){
    nativeRemove.call(this,k);
    if(this!==localStorage||!backend||!currentUser||!String(k).startsWith('bwa_'))return;
    if(k==='bwa_user'){api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});currentUser=null;return}
    if(canonicalKeys.has(String(k)))return;
    const target=globalKey(String(k))&&currentUser.role==='admin'?'/api/global-state':'/api/state';
    api(target,{method:'DELETE',body:JSON.stringify({key:String(k)})}).catch(()=>{});
  };

  async function init(){
    try{
      const s=await api('/api/session');backend=true;csrf=s.csrf_token;currentUser=s.user||null;if(!currentUser)return s;
      const b=await api('/api/bootstrap');csrf=b.csrf_token||csrf;syncing=true;
      const protectedStateKeys=new Set(['bwa_user','bwa_enrollments','bwa_orders','bwa_last_order','bwa_admin_courses']);
      for(const [k,v] of Object.entries(b.states||{})){if(!protectedStateKeys.has(k)&&!k.startsWith('bwa_player_'))putLocal(k,v)}
      if(currentUser.role==='admin')for(const [k,v] of Object.entries(b.global_states||{}))putLocal(k,v);

      const courseOverrides={};
      for(const [slug,c] of Object.entries(b.courses||{}))courseOverrides[slug]={title:c.title,category:c.category,subtitle:c.subtitle,description:c.description,price:c.price,status:c.status,image:c.image,badge:c.badge};
      courseSnapshot=JSON.parse(JSON.stringify(courseOverrides));
      putLocal('bwa_admin_courses',courseOverrides);
      for(const [slug,sections] of Object.entries(b.curricula||{})){
        const compatible=(Array.isArray(sections)?sections:[]).map(section=>({
          title:section?.title||'Course section',
          lectures:(Array.isArray(section?.lectures)?section.lectures:[]).map(lecture=>typeof lecture==='string'?lecture:(lecture?.title||'Lesson')),
        }));
        putLocal(`bwa_curriculum_${slug}`,compatible);
      }
      for(const [slug,state] of Object.entries(b.player_states||{}))putLocal(`bwa_player_${slug}`,state);
      for(const [slug,items] of Object.entries(b.announcements||{}))putLocal(`bwa_announcements_${slug}`,items);
      if(['admin','instructor'].includes(currentUser.role))putLocal('bwa_coupons',b.coupons||[]);
      putLocal('bwa_enrollments',b.enrollments||[]);
      putLocal('bwa_orders',b.orders||[]);
      if((b.orders||[]).length)putLocal('bwa_last_order',b.orders[0]);else removeLocal('bwa_last_order');
      putLocal('bwa_user',b.user);
      syncing=false;

      if(!sessionStorage.getItem('bwa_backend_bootstrapped_v2')){sessionStorage.setItem('bwa_backend_bootstrapped_v2','1');location.reload()}
      return b;
    }catch(e){backend=false;syncing=false;console.info('[BWA] Laravel backend not available; frontend stays in offline/local mode.');return null}
  }

  const ready=init();
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!(form instanceof HTMLFormElement))return;
    if(form.id==='demoAuthForm'){
      e.preventDefault();e.stopImmediatePropagation();await ready;if(!backend)return;
      const signup=location.pathname.toLowerCase().includes('signup'),email=form.querySelector('input[type=email]')?.value.trim(),password=form.querySelector('input[type=password]')?.value||'',name=form.querySelector('input[type=text]')?.value.trim()||'Learner';
      try{const out=await api(signup?'/api/auth/register':'/api/auth/login',{method:'POST',body:JSON.stringify(signup?{name,email,password}:{email,password})});currentUser=out.user;csrf=out.csrf_token||csrf;putLocal('bwa_user',out.user);sessionStorage.removeItem('bwa_backend_bootstrapped_v2');const next=new URLSearchParams(location.search).get('next');location.href=next||out.redirect||'/dashboard'}catch(err){const m=document.querySelector('#authMessage');if(m)m.textContent=err.data?.errors?Object.values(err.data.errors).flat().join(' '):err.message}return;
    }
    if(form.id==='checkoutForm'){
      await ready;if(!backend)return;
      if(!currentUser){e.preventDefault();e.stopImmediatePropagation();location.href='/login?next='+encodeURIComponent(location.pathname+location.search);return}
      e.preventDefault();e.stopImmediatePropagation();
      const p=new URLSearchParams(location.search);let ids=p.get('cart')==='1'?(readLocal('bwa_cart',[])||[]):[p.get('course')||'python'];ids=[...new Set(ids.filter(Boolean))];
      try{
        const pm=form.querySelector('input[name=payment]:checked')?.value||'demo',pending=readLocal('bwa_pending_discount',null);
        const out=await api('/api/checkout',{method:'POST',body:JSON.stringify({course_slugs:ids,payment_method:pm,coupon_code:pending?.code||null})});
        const order={number:out.order.number,total:Number(out.order.total||0),date:out.order.created_at,ids,originalTotal:Number(out.subtotal||out.order.total||0),discount:out.coupon_code?{code:out.coupon_code,amount:Number(out.discount_total||0)}:null};
        putLocal('bwa_last_order',order);putLocal('bwa_orders',[order,...(readLocal('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);
        const enroll=(out.enrollments||[]).map(x=>({id:x.id||x.course?.slug,date:x.date||x.enrolled_at||x.created_at,progress:Number(x.progress||0)})).filter(x=>x.id);
        putLocal('bwa_enrollments',enroll);putLocal('bwa_cart',[]);removeLocal('bwa_pending_discount');removeLocal('bwa_apply_discount_on_success');location.href='/success';
      }catch(err){const m=document.querySelector('#checkoutMessage');if(m)m.textContent=err.data?.errors?Object.values(err.data.errors).flat().join(' '):err.message;else alert(err.data?.errors?Object.values(err.data.errors).flat().join(' '):err.message)}return;
    }
    if(form.id==='profileForm'&&backend&&currentUser){
      e.preventDefault();e.stopImmediatePropagation();const name=form.querySelector('input[type=text]')?.value.trim(),email=form.querySelector('input[type=email]')?.value.trim();
      try{const out=await api('/api/profile',{method:'PUT',body:JSON.stringify({name,email})});currentUser=out.user;putLocal('bwa_user',out.user);location.reload()}catch(err){alert(err.data?.errors?Object.values(err.data.errors).flat().join(' '):err.message)}
    }
  },true);

  const cleanMap={'index.html':'/','about.html':'/about','account.html':'/account','admin.html':'/admin','cart.html':'/cart','categories.html':'/categories','certificate.html':'/certificate','checkout.html':'/checkout','contact.html':'/contact','course.html':'/course','courses.html':'/courses','dashboard.html':'/dashboard','faq.html':'/faq','gift.html':'/gift','instructor-profile.html':'/instructor-profile','instructor.html':'/instructor','learn.html':'/learn','login.html':'/login','messages.html':'/messages','my-learning.html':'/my-learning','notifications.html':'/notifications','orders.html':'/orders','plans.html':'/plans','practice.html':'/practice','privacy.html':'/privacy','signup.html':'/signup','success.html':'/success','teach.html':'/teach','terms.html':'/terms','wishlist.html':'/wishlist'};
  const rewriteLinks=()=>document.querySelectorAll('a[href]').forEach(a=>{const raw=a.getAttribute('href');if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:'))return;try{const u=new URL(raw,location.href);if(u.origin!==location.origin)return;const file=u.pathname.split('/').pop();if(!cleanMap[file])return;u.pathname=cleanMap[file];a.href=u.pathname+u.search+u.hash}catch{}});
  document.addEventListener('DOMContentLoaded',()=>{rewriteLinks();const mo=new MutationObserver(rewriteLinks);mo.observe(document.body,{childList:true,subtree:true})});

  window.BWABackend={ready,api,get user(){return currentUser},get available(){return backend}};
})();
