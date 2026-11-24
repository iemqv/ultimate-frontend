const detail = document.querySelector('#detail');
if (typeof detail.showModal === 'function') {
  const image = document.querySelector('#detail-image');
  const close = detail.querySelector('.close');
  let trigger;
  document.querySelectorAll('.edition').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    trigger = link;
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    document.querySelector('#detail-title').textContent = link.dataset.title;
    document.querySelector('#detail-tech').textContent = link.dataset.tech;
    document.querySelector('#detail-note').textContent = link.dataset.note;
    detail.showModal();
    close.focus();
  }));
  close.addEventListener('click', () => detail.close());
  detail.addEventListener('click', event => { if (event.target === detail) detail.close(); });
  detail.addEventListener('close', () => trigger?.focus({preventScroll:true}));
}
