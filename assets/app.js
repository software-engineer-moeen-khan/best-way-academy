const search = document.getElementById('courseSearch');
const cards = [...document.querySelectorAll('.course-card')];
const noResults = document.getElementById('noResults');

search?.addEventListener('input', () => {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const haystack = (card.dataset.search + ' ' + card.innerText).toLowerCase();
    const show = !term || haystack.includes(term);
    card.style.display = show ? '' : 'none';
    if (show) visible += 1;
  });
  if (noResults) noResults.hidden = visible !== 0;
});

document.querySelectorAll('#skillTabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('#skillTabs button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
});

document.getElementById('menuBtn')?.addEventListener('click', () => {
  document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
});
