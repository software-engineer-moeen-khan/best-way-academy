(()=>{
  const form=document.getElementById('courseForm');
  if(form&&!form.elements.course_link){
    const label=document.createElement('label');
    label.className='span-2 admin-course-link-field';
    label.innerHTML='Course link <small>Required. Students receive this link only after payment/access is approved.</small><input name="course_link" type="url" inputmode="url" required maxlength="2048" placeholder="https://your-course-platform.com/course/..." autocomplete="off">';
    const image=form.elements.image?.closest('label');
    if(image)image.insertAdjacentElement('afterend',label);
    else form.querySelector('.admin-form-grid')?.appendChild(label);
  }
})();
document.write('<script src="/assets/admin-course-links.js?rev=20260810-course-link-v2"><\/script>');
document.write('<script src="/assets/admin.js?rev=20260810-admin-management-v4"><\/script>');
document.write('<script src="/assets/admin-extras.js?rev=20260808-admin-management-v3"><\/script>');
document.write('<script src="/assets/admin-mobile.js?rev=20260808-admin-mobile-v1"><\/script>');
document.write('<script src="/assets/admin-payment-tools.js?rev=20260810-payment-v2"><\/script>');
