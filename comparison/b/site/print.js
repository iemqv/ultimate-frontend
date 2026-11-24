(()=>{
const canvas=document.querySelector('#impression'), W=760,H=500, ink='#253f83', paper='#f3e9d1'; if(!canvas)return; canvas.width=W;canvas.height=H;
const c=canvas.getContext('2d');let seed=831;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const fill=(d,col)=>{c.fillStyle=col;c.fill(new Path2D(d))};const line=(d,col,w)=>{c.strokeStyle=col;c.lineWidth=w;c.stroke(new Path2D(d))};
const mountain='M36 312 L55 305 72 289 92 275 109 253 123 247 143 220 154 212 179 187 197 177 220 151 237 140 260 103 275 84 285 67 295 79 313 88 327 114 341 126 359 150 376 161 391 185 405 192 430 223 447 229 466 251 486 257 509 275 545 292 565 293 586 306 620 309 663 320 725 320 L725 398 36 398Z';
const ridges=[['M285 67L277 122 258 139 248 174 220 192 213 226 190 241 177 277 139 308 110 334 190 312 238 287 255 249 276 227 292 184 296 151 316 112 303 101Z',0],['M330 118L315 174 327 196 318 216 332 238 306 279 285 288 248 331 367 291 402 260 381 230 380 200 355 177 352 148Z',1],['M391 182L404 223 420 250 416 267 439 281 450 299 503 328 587 342 527 300 484 279 470 257 434 230Z',2],['M225 148L203 192 185 206 168 247 134 258 120 285 84 307 39 327 38 344 111 320 150 296 162 274 180 270 202 231 226 206 247 158Z',3]];
function render(mode='both'){
seed=831;c.fillStyle=paper;c.fillRect(0,0,W,H);
const blue=mode!=='red', red=mode!=='blue';
if(red){c.save();c.beginPath();c.arc(552,150,83,0,Math.PI*2);c.clip();c.fillStyle='#bd442b';c.fillRect(460,65,187,175);for(let i=0;i<110;i++){let y=65+i*1.55,x=459+rand()*175;line(`M${x} ${y}q${10+rand()*24} ${-1+rand()*2} ${21+rand()*58} 0`,i%4===0?'#e48d64':'#c95a37',rand()*1.1+.2)} c.restore();}
seed=18261;
if(blue){c.save();c.beginPath();c.rect(36,32,688,407);c.clip();
line('M37 37Q120 33 204 36T386 36T568 36T724 36L724 436 36 436Z',ink,2.4);
for(let i=0;i<30;i++){let y=60+i*8.3,x=35+rand()*600;line(`M${x} ${y}q${15+rand()*34} ${-5-rand()*4} ${52+rand()*110} -2`,i%5===0?'#60739d':'#b0a99b',.45+rand()*.55)}
fill(mountain,ink);c.save();c.clip(new Path2D(mountain));
for(let j=0;j<160;j++){let x=45+rand()*660,y=83+rand()*272,d=10+rand()*76;line(`M${x} ${y}l${-d*.48} ${d}`,j%5===0?'#d4c7ae':'#8290af',.35+rand()*.85)}
for(const [d,j] of ridges){c.save();c.clip(new Path2D(d));for(let i=0;i<94;i++){const x=10+i*6.1, t=rand()*12;line(j===2?`M${x+180} ${117+t}q33 78 123 133t145 98`:`M${x} ${62+t}q-15 63 -43 120t-95 145`,paper,.7+rand()*2.1)}c.restore();line(d,'#b0adab',.75)}
line('M289 75L276 114 274 139 254 164 245 210 219 234 210 259 173 285 146 315M310 96L299 139 311 162 298 190 305 211 273 256 263 286 221 320M345 143L358 188 354 211 385 242 368 278 339 299M410 207L426 245 453 262 463 286 503 307 532 308 579 334',paper,2.1);c.restore();
fill('M34 328Q96 295 162 325T278 326Q348 284 428 310T573 319Q653 291 725 314L725 442H34Z',ink);
for(let j=0;j<29;j++){let y=318+j*4.65;for(let i=0;i<7;i++){let x=i*115-40+rand()*37, a=rand()*17, l=47+rand()*120;line(`M${x} ${y+a}q${l*.24} ${-12-rand()*18} ${l*.47} ${-6+a*.32}t${l*.53} ${-1-rand()*14}`,j%7===0?'#e5d8be':'#a8afbc',.46+rand()*1.45)}}
const waves=[['M31 382Q76 367 122 375Q182 385 225 350Q258 324 285 328Q311 330 313 345Q292 337 276 353Q244 389 213 405Q157 432 32 409Z',0],['M196 436Q266 418 309 384Q355 339 399 344Q446 345 453 367Q437 358 421 367Q397 384 380 405Q356 432 331 441Z',1],['M410 449Q457 431 501 396Q559 348 614 360Q663 365 660 387Q642 369 614 380Q584 389 576 411Q565 435 531 447Z',2],['M565 447Q625 409 660 403Q696 394 727 406L730 442Z',3]];
for(const [d,j] of waves){fill(d,ink);c.save();c.clip(new Path2D(d));for(let k=0;k<21;k++){let x=[-16,156,382,528][j]+k*1.7,y=[388,438,450,471][j]+k*2.3;line(`M${x} ${y}q104 ${18-k*.6} 161 -33t111 ${-22+k*.21}q30 8 45 21`,paper,k%5===0?2.35:.7+rand()*1.15)}c.restore();line(d,paper,1.65)}
for(let i=0;i<620;i++){let x=36+rand()*688,y=313+rand()*128;if(rand()<.36&&y<370)continue;c.fillStyle=i%5?'#b5b6bd':paper;c.fillRect(x,y,.4+rand()*2,.35+rand()*1.35)}
c.restore();}
seed=61847;
const image=c.getImageData(0,0,W,H),p=image.data;
for(let i=0;i<p.length;i+=4){let x=(i/4)%W,y=Math.floor(i/4/W);let r=rand(),b=rand();const printed=p[i]<220;if(printed&&r<.13){let f=b<.22?.64:.25;for(let k=0;k<3;k++)p[i+k]=p[i+k]*(1-f)+[243,233,209][k]*f} else {let n=(b-.49)*(printed?24:13)+Math.sin(x*.11+y*.035)*1.5;for(let k=0;k<3;k++)p[i+k]+=n;}}
c.putImageData(image,0,0);
for(let x of [26,734])for(let y of [23,449]){line(`M${x-5} ${y}h10m-5 -5v10`,'#827c6b',.65)}
c.fillStyle='#62584f';c.font='italic 12px Georgia';c.fillText('Проба',45,467);c.fillText('Северный ветер',336,467);
}
const text={both:['Готовый оттиск','Две формы, два прогона. Кобальтовая краска держит рисунок, киноварь печатает солнце.','Кобальтовые горы и волны под киноварным солнцем'],blue:['Кобальт','Первая форма печатает горы и воду. Светлые штрихи — это бумага в местах, где линолеум вырезан.','Горы и волны кобальтовой краской, без солнца'],red:['Киноварь','Вторая форма печатает только солнце. Метки по краям помогают совместить её с синим слоем.','Киноварное солнце и метки совмещения на бумаге']};
const buttons=document.querySelectorAll('[data-layer]');
buttons.forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.layer;render(mode);buttons.forEach(other=>other.setAttribute('aria-pressed',other===button));document.querySelector('#state-title').textContent=text[mode][0];document.querySelector('#state-copy').textContent=text[mode][1];canvas.setAttribute('aria-label', 'Северный ветер: '+text[mode][2]);}));render();
})();