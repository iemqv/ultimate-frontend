(() => {
  const dialog = document.querySelector('#viewer');
  const data = {
    herbarium: {title:'Сухоцвет', alt:'Силуэт сухого полевого растения на фоне красного круга', url:'herbarium.svg'},
    tide: {title:'Красный прилив', alt:'Красное солнце над бурной водой'},
    wind: {title:'Дюны', alt:'Охристые линии песчаных дюн под тёмным небом'}
  };
  for (const key of ['tide','wind']) {
    const art = document.querySelector(`[data-print="${key}"] svg`);
    data[key].url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(art)], {type:'image/svg+xml;charset=utf-8'}));
  }
  document.querySelector('.detail-plate').style.backgroundImage = `url("${data.tide.url}")`;
  const workOpen = document.querySelector('#work-open');
  const image = document.querySelector('#work-image');
  const viewImage = document.querySelector('#viewer-image');
  const buttons = [...document.querySelectorAll('[data-work]')];
  const setDownload = (anchor, work) => {anchor.href = work.url;anchor.download = `${work.title}.svg`;};
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.work;
    const work = data[key];
    buttons.forEach(el => el.setAttribute('aria-pressed', String(el === btn)));
    image.src = work.url;
    image.alt = work.alt;
    workOpen.dataset.open = key;
    workOpen.setAttribute('aria-label', `Рассмотреть лист «${work.title}»`);
    document.querySelector('#work-caption').textContent = `«${work.title}» · цифровой эскиз`;
    setDownload(document.querySelector('#work-download'), work);
  }));
  let opener;
  document.querySelectorAll('[data-open]').forEach(trigger => trigger.addEventListener('click', () => {
    const work = data[trigger.dataset.open];
    opener = trigger;
    document.querySelector('#viewer-title').textContent = `«${work.title}»`;
    viewImage.src = work.url;
    viewImage.alt = work.alt;
    setDownload(document.querySelector('#viewer-download'), work);
    dialog.showModal();
  }));
  dialog.addEventListener('close', () => opener?.focus({preventScroll:true}));
  dialog.addEventListener('click', event => { if(event.target === dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();} });
})();