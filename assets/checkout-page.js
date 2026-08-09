(()=>{
  const $=s=>document.querySelector(s);
  const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
  const params=new URLSearchParams(location.search);
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  async function getCourse(slug){
    const r=await fetch(`/api/courses/${encodeURIComponent(slug)}`,{headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},credentials:'same-origin'});
    if(!r.ok)throw new Error(`Course could not be loaded (${r.status})`);
    return r.json();
  }
  function requestedSlugs(){
    if(params.get('cart')==='1')return [...new Set((read('bwa_cart',[])||[]).filter(Boolean))];
    return [params.get('course')||'python'];
  }
  function renderCourses(courses){
    const list=$('#checkoutItems');
    const total=courses.reduce((sum,c)=>sum+Number(c.price||0),0);
    if(list)list.innerHTML=courses.map(c=>`<article class="checkout-item"><img src="${c.image||''}" alt=""><div class="checkout-item-copy"><b>${c.title||'Course'}</b><span>${c.category||'Online course'}</span><strong>${c.priceLabel||money(c.price)}</strong></div></article>`).join('');
    $('#checkoutTotal')&&( $('#checkoutTotal').textContent=money(total) );
    $('#checkoutSubtotal')&&( $('#checkoutSubtotal').textContent=money(total) );
    $('#checkoutPayAmount')&&( $('#checkoutPayAmount').textContent=money(total) );
    const btn=$('#checkoutSubmit');if(btn){btn.disabled=true;btn.textContent=courses.length?'Apply coupon to continue':'Course unavailable';}
  }
  function showError(message){
    const card=$('.order-card');if(!card)return;
    let el=$('#checkoutError');if(!el){el=document.createElement('div');el.id='checkoutError';el.className='checkout-error';card.appendChild(el)}
    el.textContent=message;
  }
  async function hydrate(){
    const slugs=requestedSlugs();
    if(!slugs.length){renderCourses([]);showError('Your cart is empty. Add a course before checking out.');return;}
    try{
      const courses=(await Promise.all(slugs.map(s=>getCourse(s).catch(()=>null)))).filter(Boolean);
      renderCourses(courses);
      if(courses.length!==slugs.length)showError('One or more courses are currently unavailable and were removed from this order.');
    }catch(e){renderCourses([]);showError(e.message||'Unable to load your order. Please refresh and try again.');}
  }
  document.addEventListener('DOMContentLoaded',hydrate);
})();
