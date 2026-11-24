(() => {
const W=780,H=630;let seed=177;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const make=(kind,id)=>{seed=kind==='wind'?199:177;const red=kind==='wind'?'#d4bca1':'#db5638';const fine=kind==='wind'?'#e0ccad':'#ee7653';let s=`<svg viewBox="0 0 780 630" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${kind==='wind'?'Дюны под тёмным небом, графический лист':'Красное солнце над бурной водой, графический лист'}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="${id}grain" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".77" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><clipPath id="${id}disc"><circle cx="${kind==='wind'?510:435}" cy="214" r="136"/></clipPath></defs><rect width="780" height="630" fill="#211f1b"/>`;
const path=(d,col,w,o=1)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
// Small irregular tool marks in the open ink field.
for(let i=0;i<3100;i++){const x=rand()*W,y=rand()*H; if(y>370&&rand()<.65)continue;const l=.25+rand()*2.7;s+=path(`M${x.toFixed(1)} ${y.toFixed(1)}l${l.toFixed(1)} ${((rand()-.5)*1.8).toFixed(1)}`,i%4?'#a89b85':red,.28+rand()*.9,.09+rand()*.46);}
s+=`<circle cx="${kind==='wind'?510:435}" cy="214" r="136" fill="${red}"/><g clip-path="url(#${id}disc)">`;
for(let i=0;i<440;i++){const x=250+rand()*410,y=75+rand()*286;const l=rand()*(y>260?52:19)+.6;s+=path(`M${x.toFixed(1)} ${y.toFixed(1)}q${(l/2).toFixed(1)} ${(rand()*2-1).toFixed(1)} ${l.toFixed(1)} ${(rand()*2-1).toFixed(1)}`,'#2c221d',.35+rand()*1.7,.13+rand()*.7);}
s+='</g>';
// Carved islands, then successive bands of water / sand.
const ridge=(x, j)=>{if(kind==='wind')return 301+25*Math.sin(x/113+j*.16)+57*Math.sin(x/228+1.1+j*.1)+j*(3.8+x*.002)+8*Math.cos(x/39+j*.15);const peak=92*Math.exp(-((x-195-j*1.75)**2)/(2*(62+j*1.4)**2));const bowl=45*Math.exp(-((x-445+j*2.4)**2)/(2*(100+j*.05)**2));return 330+j*(4.6+.0021*x)-peak+bowl+26*Math.sin(x/112+j*.079)+12*Math.sin(x/38+j*.08)*(1-j/135)+3*Math.sin(x/12+j*.3);};
const profile=[[0,286],[28,271],[51,274],[71,259],[104,261],[121,255],[137,257],[156,275],[184,283],[209,299],[227,295],[254,309],[284,312],[302,326],[341,331],[373,320],[405,319],[421,310],[450,315],[476,306],[492,294],[509,288],[521,268],[543,272],[555,254],[572,260],[593,240],[607,248],[623,233],[635,231],[651,248],[666,251],[697,268],[722,259],[755,274],[780,272]];
if(kind!=='wind'){
const rp=x=>{let i=0;while(i<profile.length-2&&x>profile[i+1][0])i++;return profile[i][1]+(profile[i+1][1]-profile[i][1])*(x-profile[i][0])/(profile[i+1][0]-profile[i][0]);};
s+=`<path d="M${profile.map(p=>p.join(' ')).join('L')}V480H0Z" fill="#25201c"/>`;
for(let j=0;j<37;j++){let d='';for(let x=0;x<=780;x+=4){const y=rp(x)+j*(2.15+.8*Math.sin(x*.012+j*.08))+2*Math.sin(x*.13+j);d+=(x===0?'M':'L')+x+' '+y.toFixed(1);}s+=path(d,j%4?red:fine,.45+rand()*1.0,.23+rand()*.52);}
}
let edge='';for(let x=0;x<=780;x+=4)edge+=(x?'L':'M')+x+' '+ridge(x,0).toFixed(1);s+=`<path d="${edge}V630H0Z" fill="#26211c"/>`;
for(let j=0;j<85;j++){let x=-10;while(x<790){let len=18+rand()*135;if(j<15)len+=45;const end=x+len;let d='';for(let k=x;k<=end;k+=3){const y=ridge(k,j)+1.12*Math.sin(k*.105+j*2.1)+.58*Math.sin(k*.48+j*1.4)+(rand()-.5)*1.3;d+=(k===x?'M':'L')+k.toFixed(1)+' '+y.toFixed(1);}s+=path(d,j%5?red:fine,.48+rand()*2.5,(.43+rand()*.55));x=end+2+rand()*16;}}
// Short cuts following the flow add a dry, uneven transfer to the longer lines.
for(let i=0;i<2900;i++){let x=rand()*W,j=rand()*82,y=ridge(x,j);if(y>H)continue;let l=.5+rand()*9;s+=path(`M${x.toFixed(1)} ${y.toFixed(1)}l${l.toFixed(1)} ${(ridge(x+l,j)-y).toFixed(1)}`,i%4?fine:'#1d1b18',.45+rand()*1.6,.21+rand()*.61);}
s+=`<rect width="780" height="630" filter="url(#${id}grain)" opacity=".22" style="mix-blend-mode:soft-light"/></svg>`;return s;};
document.querySelectorAll('[data-print]').forEach((el,i)=>{el.innerHTML=make(el.dataset.print,'art'+i);});
})();