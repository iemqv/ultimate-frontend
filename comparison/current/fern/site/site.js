(()=>{
const filters=[...document.querySelectorAll('[data-filter]')], gallery=document.querySelector('.gallery'), figures=[...gallery.querySelectorAll('figure')];
function filter(name){filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===name)));figures.forEach(figure=>figure.hidden=name!=='all'&&figure.dataset.type!==name);gallery.classList.toggle('is-filtered',name!=='all');}
filters.forEach(btn=>btn.addEventListener('click',()=>filter(btn.dataset.filter)));
document.querySelectorAll('[data-show]').forEach(link=>link.addEventListener('click',()=>{filter(link.dataset.show);filters.find(btn=>btn.dataset.filter===link.dataset.show).focus({preventScroll:true});}));
const dialog=document.querySelector('#detail'), ctx=document.querySelector('#detail-art').getContext('2d');
const descriptions={tide:'Цифровой этюд в духе линогравюры. Светлые полосы имитируют следы резца: в углублениях печатной формы нет краски.',bird:'Цифровой этюд в духе монотипии. Горизонтальные мазки размывают границу между водой и небом.',fungi:'Цифровой этюд в духе шелкографии. Охристый фон, терракотовые шляпки и тёмные контуры напоминают отдельные печатные слои.'};
let trigger;
document.querySelectorAll('[data-art]').forEach(button=>button.addEventListener('click',()=>{trigger=button;const id=button.dataset.art;ctx.clearRect(0,0,700,525);ctx.drawImage(document.getElementById(id),0,0);document.querySelector('#detail-title').textContent=button.closest('figure').querySelector('h3').textContent;document.querySelector('#detail-text').textContent=descriptions[id];dialog.showModal();dialog.querySelector('.close').focus();}));
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});dialog.addEventListener('close',()=>trigger?.focus({preventScroll:true}));
})();