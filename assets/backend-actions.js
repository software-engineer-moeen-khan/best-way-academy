(()=>{
  const backend=()=>window.BWABackend;
  const errorText=err=>err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Request failed.');

  const normalizeLearnerFooter=()=>{
    if(document.body.classList.contains('admin-body')||document.body.classList.contains('instructor-app')||document.body.classList.contains('checkout-page')||document.body.classList.contains('awk-home')||document.querySelector('.player-layout,.certificate-wrap'))return;
    const footer=document.querySelector('footer:not(.awk-footer),.portal-footer');
    if(!footer)return;

    let row=[...footer.querySelectorAll('.footer-grid > div')].find(group=>{
      const heading=group.querySelector('h2,h3,h4,strong');
      return heading&&heading.textContent.trim().toLowerCase()==='for learners';
    });

    if(!row){
      const heading=[...footer.querySelectorAll('h2,h3,h4,strong')].find(el=>el.textContent.trim().toLowerCase()==='for learners');
      if(heading)row=heading.parentElement;
    }

    if(!row){
      row=document.createElement('div');
      row.className='bwa-footer-learners-row shell';
      const bottom=footer.querySelector('.footer-bottom');
      if(bottom)bottom.insertAdjacentElement('beforebegin',row);
      else footer.appendChild(row);
    }

    row.classList.add('bwa-footer-learners-row');
    row.innerHTML='<h4>For learners</h4><a href="/courses">All courses</a><a href="/wishlist">Wishlist</a><a href="/my-learning">My learning</a><a href="/contact">Support</a>';
  };

  const ensureScrollTopButton=()=>{
    if(document.getElementById('bwaScrollTop'))return;
    const style=document.createElement('style');
    style.id='bwaScrollTopStyle';
    style.textContent=`
      #bwaScrollTop{position:fixed;right:22px;bottom:22px;width:46px;height:46px;border:0;border-radius:50%;display:grid;place-items:center;background:#6d28d9;color:#fff;font-size:24px;font-weight:900;line-height:1;cursor:pointer;z-index:9998;box-shadow:0 10px 28px rgba(17,24,39,.28);opacity:0;visibility:hidden;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease,visibility .2s ease,background .2s ease}
      #bwaScrollTop:hover{background:#4c1d95;transform:translateY(-2px)}
      #bwaScrollTop.is-visible{opacity:1;visibility:visible;transform:translateY(0)}
      #bwaScrollTop:focus-visible{outline:3px solid rgba(109,40,217,.3);outline-offset:3px}
      @media(max-width:640px){#bwaScrollTop{right:14px;bottom:16px;width:44px;height:44px;font-size:22px}}
      @media(prefers-reduced-motion:reduce){#bwaScrollTop{transition:none}}
    `;
    document.head.appendChild(style);

    const button=document.createElement('button');
    button.id='bwaScrollTop';
    button.type='button';
    button.setAttribute('aria-label','Back to top');
    button.setAttribute('title','Back to top');
    button.textContent='↑';
    document.body.appendChild(button);

    const sync=()=>button.classList.toggle('is-visible',window.scrollY>360);
    button.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
    window.addEventListener('scroll',sync,{passive:true});
    sync();
  };

  document.addEventListener('DOMContentLoaded',()=>{
    normalizeLearnerFooter();
    ensureScrollTopButton();
    setTimeout(normalizeLearnerFooter,220);
  });

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
