function drawPrint(canvas,idx){
const c=canvas.getContext('2d',{willReadFrequently:true}),W=canvas.width,H=canvas.height;
let s=17431+idx*215;const r=()=>((s=Math.imul(1664525,s)+1013904223|0)>>>0)/4294967296;
const cream=['#ece7cd','#efd6a1','#ede8cb'][idx], ink=['#263bad','#a3442b','#435445'][idx];
function fill(d,col){c.fillStyle=col;c.fill(new Path2D(d))}function stroke(d,col,w=1){c.strokeStyle=col;c.lineWidth=w;c.stroke(new Path2D(d))}function ellipse(x,y,rx,ry,col,rot=0){c.beginPath();c.ellipse(x,y,rx,ry,rot,0,Math.PI*2);c.fillStyle=col;c.fill()}
function line(points,color,w){c.beginPath();for(let i=0;i<points.length;i++)i?c.lineTo(...points[i]):c.moveTo(...points[i]);c.strokeStyle=color;c.lineWidth=w;c.stroke()}
c.fillStyle=ink;c.fillRect(0,0,W,H);c.lineJoin='round';c.lineCap='round';
if(idx===0){
const pale='#dcdabf',mid='#9fabc9', deep='#1d2d90';
for(let i=0;i<315;i++){let y=29+r()*313,x=-75+r()*1650,l=10+r()**2*285;let group=Math.sin(y*.082+x*.0075)+.54*Math.sin(y*.16-x*.012);if(group<-.24)continue;c.globalAlpha=.12+r()*.58;stroke(`M${x} ${y} q${l*.38} ${-3+r()*6} ${l} ${-2+r()*5}`,r()<.21?cream:mid,.36+r()**2*1.65)}c.globalAlpha=1;
ellipse(1084,133,64,63,mid,-.1);ellipse(1080,130,64,63,cream,-.1);
c.save();c.clip(new Path2D('M1016 130a64 63 0 1 0 128 0a64 63 0 1 0 -128 0'));for(let i=0;i<140;i++){let x=1010+r()*140,y=66+r()*130;c.globalAlpha=.08+r()*.35;stroke(`M${x} ${y}l${r()**2*37} ${r()*1.2}`,ink,.3+r()*.8)}c.restore();
// Headlands in two impressions, with a low bank of wind-streaked water.
fill('M0 270 Q107 267 218 241L277 237l52-15 68 9 49-4 29-9 32 9 69 3 48 22 78 16 73 30 106 16 154-17 91-19 81-2 59-12 71 11 63-15 125 17v330H0Z','#7184bb');
fill('M0 278l162-7 47-18 65-7 59-16 53 9 58 0 33-10 31 6 47 1 48 13 36 17 89 16 59 28-89 42q-140 20-250-2t-272 6q-113 12-176-3Z',deep);
for(let i=0;i<455;i++){let x=-100+r()*1600,y=235+r()*182,l=r()**2*190;let horizon=239+Math.max(0,Math.abs(x-396)-135)*.068;if(y<horizon)continue;c.globalAlpha=.14+r()*.60;stroke(`M${x} ${y}q${l*.45} ${-3+r()*6} ${l} ${-2+r()*4}`,r()<.44?pale:deep,.45+r()**2*2.7)}c.globalAlpha=1;
for(let j=0;j<9;j++){const y=331+j*6.5;c.globalAlpha=.24+r()*.25;c.setLineDash([85+r()*150,13+r()*38,7+r()*17,31]);c.lineDashOffset=r()*250;stroke(`M-50 ${y} C180 ${y-21} 309 ${y+25} 541 ${y+11} S875 ${y-3} 1011 ${y+6} S1337 ${y-23} 1550 ${y-23}`,j%3===0?pale:deep,1+j*.2)}c.setLineDash([]);c.globalAlpha=1;
// Breaking wave. Its crest and the parallel gouges are drawn separately.
const sea='M-20 368C111 385 223 416 344 418C490 423 583 407 659 367C765 310 798 244 917 225C978 215 1039 233 1084 271C1114 296 1129 333 1134 362C1105 324 1072 305 1032 304C979 302 953 327 971 363C996 414 1127 425 1233 403C1354 378 1406 325 1520 343V610H-20Z';
fill(sea,cream);
const inner='M-30 381C125 395 227 427 356 431C492 434 595 415 678 367C777 311 818 258 915 246C996 235 1069 266 1100 316C1060 284 1027 282 993 294C944 308 936 341 964 378C1004 431 1130 436 1238 416C1368 391 1420 340 1520 357V610H-30Z';fill(inner,ink);
c.save();c.clip(new Path2D(inner));
for(let i=0;i<86;i++){
 const d=i*3.6, jitter=r()*20-10, start=-150+r()*155, l=20+r()*60;
 const path=`M${start} ${382+d+jitter} C${143+d*.17} ${390+d} ${230+d*.27} ${424+d} ${355+d*.39} ${431+d*.94} C${492+d*.45} ${438+d*.91} ${605+d*.37} ${413+d*.8} ${679+d*.41} ${371+d*.7} C${770+d*.47} ${321+d*.56} ${820+d*.52} ${265+d*.67} ${921+d*.51} ${247+d*.69} C${989+d*.54} ${237+d*.68} ${1051+d*.63} ${267+d*.73} ${1109+d*.84} ${322+d*.86}`;
 c.globalAlpha=.36+r()*.57;let dash=i<7?[]:[70+r()*200,8+r()*35,5+r()*l,4+r()*24];c.setLineDash(dash);c.lineDashOffset=r()*305;stroke(path,i%8===0?cream:mid,i%9===0?3.1:.5+r()*1.6);
}
c.setLineDash([]);c.restore();c.globalAlpha=1;
// Hand-cut foam marks under the lip.
for(let i=0;i<176;i++){
 const t=r(), x=740+t*391, y=225+Math.pow((x-947)/195,2)*99+(x>1045?(x-1045)*.4:0), len=2+r()**2*16;
 const dy=(r()-.60)*(t>.82?47:29);
 c.globalAlpha=.32+r()*.64;stroke(`M${x} ${y+dy} q${len*.43} ${-len*.34} ${len} ${len*.15}`,r()<.78?cream:mid,.55+r()*1.85);
 if(i%5===0)ellipse(x-4*r(),y+dy-9-r()*25,.7+r()*2.6,.7+r()*1.65,cream,-.7);
}c.globalAlpha=1;
fill('M758 315C812 268 864 240 922 233c44-8 84 6 115 19-56-15-93-17-137 0-11 4-11 12-28 12-13 0-9 10-28 13-17 2-16 12-32 16-10 2-27 13-54 22Z',cream);
fill('M985 238c45 7 84 25 113 53 8 8 29 35 33 65-10-16-16-28-25-34-7-6-9-4-12-13-2-7-16-8-20-18-7-12-13-7-23-17-14-13-45-28-66-36Z',cream);
c.save();c.clip(new Path2D(sea));
for(let i=0;i<195;i++){let x=720+r()*420,y=222+r()*175,len=2+r()**3*23;c.globalAlpha=.22+r()*.25;stroke(`M${x} ${y}q${len*.35} ${-2+r()*4} ${len} ${-2+r()*4}`,i%4===0?cream:deep,.5+r()*1.35)}
c.restore();
// Cross seas in the foreground, alternating solid and thin cuts.
const waves=[['M-25 445C151 430 255 500 463 510C640 521 751 472 864 439C963 410 1049 450 1113 472C1228 510 1335 470 1530 405',7.0],['M-24 467C205 462 267 548 493 535C663 525 784 481 868 460C971 436 1049 470 1113 491C1245 534 1396 482 1527 432',3.2],['M-20 520C160 484 248 580 432 570C630 557 726 527 884 509C1003 493 1046 534 1160 545C1284 557 1385 523 1523 480',7],['M-28 557C111 528 264 605 484 590C681 574 752 556 879 548C1019 540 1071 570 1163 581C1291 595 1391 558 1527 514',3.8]];
for(const [path,w] of waves){stroke(path,deep,w*4.5);stroke(path,cream,w);for(let j=1;j<=4;j++){c.save();c.translate(7*j,j*4.3);c.setLineDash([26+j*14,14,8,13]);c.lineDashOffset=11*j;c.globalAlpha=.66;stroke(path,j%3===0?cream:mid,1+j*.17);c.restore()}}
for(let i=0;i<800;i++){let x=r()*W,y=340+r()*255,l=1+r()**3*27;if(r()<.48&&y<480)continue;c.globalAlpha=.13+r()*.38;stroke(`M${x} ${y}q${l*.34} ${-l*.15} ${l} ${-l*.19}`,r()<.55?cream:mid,.5+r()**2*1.8)}c.globalAlpha=1;
}else if(idx===1){
 for(let i=0;i<400;i++){const x=r()*1500,y=r()*590;c.globalAlpha=r()*.2;stroke(`M${x} ${y}l${r()*120} ${-r()*9}`,'#f2be7c',r()*2)}c.globalAlpha=1;
 ellipse(1055,174,118,116,'#ca7851',-.16);
 for(let i=0;i<73;i++){
 let x=-130+r()*1630, base=585+r()*135, h=80+r()**.8*496, lean=35+r()*165, clr=['#e7bc7f','#ecd29a','#d7965f','#742e27','#f0dab0'][Math.floor(r()*5)], width=.6+r()*2.1;
 function pt(t){return [x+lean*t*t,base-h*t]}
 line(Array.from({length:24},(_,j)=>pt(j/23)),clr,width);
 let n=3+Math.floor(r()*10);
 for(let j=0;j<n;j++){let t=.45+j/n*.53,[xx,yy]=pt(t),sign=j%2?-1:1,l=5+r()*31;stroke(`M${xx} ${yy}q${l*.65*sign} ${-l*.22} ${l*sign} ${-l}`,clr,width*.68);ellipse(xx+l*sign,yy-l,2+r()*2,4+r()*6,clr,sign*.58)}
 ellipse(...pt(1),2+r()*3,7+r()*11,clr,.46);
 }
}else{
 for(let i=0;i<520;i++){const x=r()*1550-50,y=r()*590,l=r()**2*240;c.globalAlpha=.06+r()*.51;stroke(`M${x} ${y}q${l*.58} ${r()*6-3} ${l} ${r()*4-2}`,r()<.6?'#a7af8c':'#d5d9b2',.5+r()**2*6)}c.globalAlpha=1;
 const rocks=[[291,318,216,106],[537,343,177,85],[778,342,209,140],[1119,276,235,166],[1303,358,158,102],[1512,398,141,83]];
 for(const [x,y,a,b] of rocks){const pts=[];for(let j=0;j<=32;j++){const t=j/32*Math.PI*2,fac=.86+r()*.16;pts.push([x+Math.cos(t)*a*fac+Math.sin(t)*b*.27,y+Math.sin(t)*b*fac])}const path=new Path2D('M'+pts.map(p=>p.join(' ')).join('L')+'Z');c.fillStyle='#222e29';c.fill(path);c.save();c.clip(path);for(let j=0;j<370;j++){let xx=x-a+r()*2*a,yy=y-b+r()*2*b,l=r()**2*51;c.globalAlpha=.05+r()*.7;stroke(`M${xx} ${yy}l${l} ${-l*(.12+r()*.42)}`,yy<y?'#c9c89d':'#72836a',.3+r()**2*3.6)}c.restore()}
 for(let i=0;i<275;i++){let x=r()*1500,y=403+r()*187,l=10+r()**2*190;c.globalAlpha=.1+r()*.55;stroke(`M${x} ${y}l${l} ${-r()*2}`,r()<.5?'#d0d0aa':'#26342e',.4+r()**2*3.4)}c.globalAlpha=1;
}
// Grain and pinholes from the uneven pressure of an inked block.
let img=c.getImageData(0,0,W,H), d=img.data;const paper=idx===0?[239,233,206]:idx===1?[240,209,156]:[231,230,202];
for(let y=0,k=0;y<H;y++){for(let x=0;x<W;x++,k+=4){const n=r(), wear=r(), w=Math.sin(x*.033+y*.089)*Math.sin(y*.041-x*.014), m=(n-.5)*29+w*7, fleck=wear<.022+Math.max(0,w)*.022?.16+r()**2*.53:0;for(let j=0;j<3;j++)d[k+j]=d[k+j]+m+(paper[j]-d[k+j])*fleck;}}
c.putImageData(img,0,0);
}
