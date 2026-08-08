(()=>{
  const backend=()=>window.BWABackend;
  const errorText=err=>err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Request failed.');

  document.addEventListener('submit',async e=>{
    const form=e.target;
    if(!(form instanceof HTMLFormElement)||form.id!=='contactForm')return;
    if(!backend()?.available)return;
    e.preventDefault();e.stopImmediatePropagation();
    const textInputs=[...form.querySelectorAll('input[type="text"]')];
    const payload={
      name:(textInputs[0]?.value||'').trim(),
      email:(form.querySelector('input[type="email"]')?.value||'').trim(),
      subject:(textInputs[1]?.value||'').trim(),
      message:(form.querySelector('textarea')?.value||'').trim(),
    };
    const out=document.querySelector('#contactMessage');
    try{
      await backend().ready;
      const result=await backend().api('/api/contact',{method:'POST',body:JSON.stringify(payload)});
      form.reset();
      if(out){out.textContent=`${result.message} Reference: ${result.request_id}`;out.classList.add('success-message')}
    }catch(err){if(out){out.textContent=errorText(err);out.classList.remove('success-message')}}
  },true);

  document.addEventListener('click',async e=>{
    const element=e.target instanceof Element?e.target:null;
    const userMenu=element?.closest('#userMenu');
    if(userMenu&&backend()?.available){
      e.preventDefault();e.stopImmediatePropagation();
      if(!confirm('Log out of Best Way Academy?'))return;
      try{await backend().ready;await backend().api('/api/auth/logout',{method:'POST',body:'{}'})}catch{}
      localStorage.setItem('bwa_user','null');
      sessionStorage.removeItem('bwa_backend_bootstrapped_v2');
      location.href='/';
      return;
    }

    const button=element?.closest('#applyCoupon');
    if(!button||!backend()?.available)return;
    e.preventDefault();e.stopImmediatePropagation();
    const input=document.querySelector('#couponCode'),message=document.querySelector('#couponMessage');
    const code=(input?.value||'').trim().toUpperCase();
    if(!/^[A-Z0-9_-]{3,80}$/.test(code)){
      if(message){message.textContent='Enter a valid coupon code.';message.style.color='#b42318'}
      return;
    }
    localStorage.setItem('bwa_pending_discount',JSON.stringify({code}));
    if(message){message.textContent='Coupon will be validated securely when you complete enrollment.';message.style.color='#166534'}
  },true);
})();
