(()=>{
let seed=1762; const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const lerp=(a,b,t)=>a+(b-a)*t;
const cubic=(a,b,c,d,t)=>{let u=1-t;return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]};
const unit=(x,y)=>{let l=Math.hypot(x,y)||1;return [x/l,y/l]};
function stroke(c,pts,col,w){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=col;c.lineWidth=w;c.stroke()}
function paper(c,w,h,power,specks){let im=c.getImageData(0,0,w,h),d=im.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=(y*w+x)*4;let n=(r()-.5)*power+Math.sin(x*.04+y*.015)*1.7+Math.sin(y*.23+Math.sin(x*.08))*1.7;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}c.putImageData(im,0,0);for(let i=0;i<specks;i++){let x=r()*w,y=r()*h;c.fillStyle=r()<.57?'rgba(226,208,162,.24)':'rgba(25,30,22,.26)';c.fillRect(x,y,.3+r()*2.5,.35+r()*1.6)}}
function frond(c,pts,spread,n,col,cut){let P=t=>cubic(...pts,t);let stem=Array.from({length:61},(_,i)=>P(i/60));c.lineCap='round';
for(let i=0;i<n;i++)for(let sign of [-1,1]){
let t=.16+i/(n-1)*.784+(sign===1?.013:0), p=P(t), q=P(t+.004), [dx,dy]=unit(q[0]-p[0],q[1]-p[1]);let nx=-dy*sign,ny=dx*sign;
let size=spread*Math.pow(Math.sin(Math.PI*(.08+.91*(t-.12)/.89)),.89)*(1-.45*t)*(sign<0?.96:1.12)*(0.92+r()*.16);let sweep=.35+.48*t;
let b=[p[0]+nx*size*.38-dx*size*.06,p[1]+ny*size*.38-dy*size*.06], d=[p[0]+nx*size*.97+dx*size*sweep,p[1]+ny*size*.97+dy*size*sweep], e=[p[0]+nx*size*.76+dx*size*.18,p[1]+ny*size*.76+dy*size*.18];let V=v=>cubic(p,b,e,d,v);
let axis=Array.from({length:28},(_,j)=>V(j/27));stroke(c,axis,col,Math.max(1,size*.017));let count=Math.max(5,Math.round(size/8));
for(let j=0;j<count;j++) for(let s of [-1,1]){
let v=.06+j/count*.91+(s===1?.018:0), a=V(v), bb=V(v+.009), [ux,uy]=unit(bb[0]-a[0],bb[1]-a[1]), vx=-uy*s,vy=ux*s;
let l=size*(.055+.064*Math.sin(Math.PI*v))*Math.pow(1-v,.46)*(1.05+r()*.27); let f=l*(.74+.47*v), width=size*(.025+.018*Math.sin(Math.PI*v))*Math.pow(1-v,.65);
let tip=[a[0]+vx*l+ux*f,a[1]+vy*l+uy*f], base=[a[0]+ux*width*1.09,a[1]+uy*width*1.09];
c.fillStyle=col;c.beginPath();c.moveTo(...a);c.bezierCurveTo(a[0]+vx*l*.33-ux*width*.42,a[1]+vy*l*.33-uy*width*.42,tip[0]-ux*f*.6-vx*l*.12,tip[1]-uy*f*.6-vy*l*.12,...tip);c.bezierCurveTo(tip[0]+ux*width*.39-vx*l*.31,tip[1]+uy*width*.39-vy*l*.31,base[0]+vx*l*.39,base[1]+vy*l*.39,...base);c.closePath();c.fill();
if(size>50){c.beginPath();c.moveTo(a[0]+ux*width*.45+vx*l*.10,a[1]+uy*width*.45+vy*l*.10);c.quadraticCurveTo(a[0]+ux*f*.26+vx*l*.56,a[1]+uy*f*.26+vy*l*.56,lerp(a[0],tip[0],.83),lerp(a[1],tip[1],.83));c.strokeStyle=cut;c.lineWidth=.65;c.stroke();}
}}
for(let i=1;i<stem.length;i++)stroke(c,[stem[i-1],stem[i]],col,1+spread*.023*Math.pow(1-i/stem.length,1.08));}
const fern=document.querySelector('#fern').getContext('2d');let g=fern.createLinearGradient(0,100,1400,590);g.addColorStop(0,'#1e352d');g.addColorStop(.55,'#345144');g.addColorStop(1,'#243b30');fern.fillStyle=g;fern.fillRect(0,0,1400,720);
for(let i=0;i<1150;i++){let x=r()*1400,y=r()*720;fern.fillStyle=i%3===0?'#9e9c7021':'#0e291a28';fern.fillRect(x,y,(2+r()*42)*(r()*.6+.4),.2+r()*1.8);}
frond(fern,[[909,789],[866,556],[748,437],[576,452]],113,17,'#72816a','#425a46');
frond(fern,[[925,741],[1040,656],[1192,444],[1419,484]],159,21,'#8b9170','#475d46');
frond(fern,[[748,842],[719,531],[935,206],[715,95]],221,22,'#bcba93','#58674d');
frond(fern,[[734,762],[795,472],[1025,127],[1331,91]],273,24,'#e1d2aa','#60674d');
paper(fern,1400,720,32,24500);
const tide=document.querySelector('#tide').getContext('2d');tide.fillStyle='#eadbc0';tide.fillRect(0,0,700,525);tide.save();tide.beginPath();tide.rect(29,25,642,475);tide.clip();tide.fillStyle='#a64029';tide.fillRect(29,25,642,475);
let wv=(x,k)=> 264+k*13+26*Math.sin(x/85+k*.28)+16*Math.sin(x/42-k*.31)+34*Math.sin(x/178+k*.26);
tide.fillStyle='#edc696';tide.beginPath();tide.arc(394,219,112,0,Math.PI*2);tide.fill();
let path=new Path2D('M28 275 C106 225 134 230 189 254 C237 274 273 284 333 245 C399 203 425 183 472 211 C531 247 560 225 611 188 C646 163 652 176 680 169 L680 510 H28Z');tide.fillStyle='#983522';tide.fill(path);tide.clip(path);
for(let k=-5;k<24;k++){tide.beginPath();for(let x=25;x<=680;x+=3){let y=wv(x,k)+Math.sin(x*1.2+k)*1.2;x===25?tide.moveTo(x,y):tide.lineTo(x,y)}tide.strokeStyle=k%5===0?'#f1d4ac':'#ddb184';tide.lineWidth=1.3+r()*3;tide.stroke();}
for(let i=0;i<1200;i++){let x=r()*680,y=r()*530;tide.fillStyle=r()<.7?'#e9caa577':'#6f2b235c';tide.fillRect(x,y,1+r()*9,.3+r()*1.3)}tide.restore();paper(tide,700,525,24,6700);
const bird=document.querySelector('#bird').getContext('2d');bird.fillStyle='#e7deca';bird.fillRect(0,0,700,525);bird.save();bird.beginPath();bird.rect(31,25,638,475);bird.clip();let blue=bird.createLinearGradient(0,0,520,500);blue.addColorStop(0,'#292f38');blue.addColorStop(.52,'#435968');blue.addColorStop(1,'#657c83');bird.fillStyle=blue;bird.fillRect(31,25,638,475);
for(let i=0;i<3350;i++){let x=r()*740-20,y=r()*530;bird.fillStyle=['#c2bda039','#26333e47','#879c981f','#1d33353f'][i%4];bird.fillRect(x,y,r()*92+1,r()*2.5+.2)}
for(let i=0;i<31;i++){let x=r()*600,y=343+r()*145;stroke(bird,[[x,y],[x+18+r()*130,y-.3]],'#b6b6a279',.6+r()*1.6)}
bird.fillStyle='#ddd8c1';bird.fill(new Path2D('M102 285 C167 285 193 216 249 210 C293 205 320 251 360 225 C386 210 387 155 400 130 C410 111 427 111 438 121 L515 133 L440 136 C414 153 432 224 400 255 C364 288 324 286 279 279 C228 269 172 305 102 285 Z'));
bird.fillStyle='#27363d';bird.fill(new Path2D('M153 284 C218 269 229 224 272 220 C294 218 309 241 332 244 C282 243 245 281 153 284Z'));bird.beginPath();bird.arc(427,125,2.6,0,7);bird.fill();
stroke(bird,[[279,276],[219,320],[137,343]],'#d4cdb4',2);stroke(bird,[[299,280],[247,324],[159,353]],'#d4cdb4',1.6);
for(let i=0;i<23;i++){let x=38+r()*620;let y=370+r()*190;bird.strokeStyle='#283d445c';bird.lineWidth=1+r()*2;bird.beginPath();bird.moveTo(x,y+155);bird.quadraticCurveTo(x-24,y+35,x-25+r()*49,y-28);bird.stroke()}
bird.restore();paper(bird,700,525,26,7000);
const fungi=document.querySelector('#fungi').getContext('2d');fungi.fillStyle='#eee1bf';fungi.fillRect(0,0,700,525);fungi.save();fungi.beginPath();fungi.rect(29,25,642,475);fungi.clip();fungi.fillStyle='#c5a258';fungi.fillRect(29,25,642,475);
for(let i=0;i<22;i++){let x=65+r()*580,y=478+r()*80;fungi.strokeStyle=i%3===0?'#b15b36':'#6d693d';fungi.lineWidth=.7+r()*1.4;fungi.beginPath();fungi.moveTo(x,y);fungi.quadraticCurveTo(x-30,y-71,x-60+r()*110,y-88-r()*90);fungi.stroke()}
function mushroom(x,y,s,rot){let c=fungi;c.save();c.translate(x,y);c.rotate(rot);c.scale(s,s);c.fillStyle='#34392c';c.fill(new Path2D('M-15 -39 Q-8 29 -27 79 Q-5 92 30 77 Q14 31 20 -41Z'));c.fillStyle='#ead5a0';c.fill(new Path2D('M-7 -34 Q3 33 -17 76 Q0 83 18 75 Q8 19 11 -32Z'));
c.fillStyle='#a14d32';c.fill(new Path2D('M-113 -37 C-102 -50 -84 -63 -60 -85 C-24 -118 16 -134 57 -101 C82 -81 81 -73 114 -45 C128 -25 76 -14 12 -15 C-45 -14 -130 -19 -113 -37Z'));c.fillStyle='#37392b';c.fill(new Path2D('M-113 -35 C-82 -52 -48 -35 -12 -43 C28 -51 81 -43 113 -45 C128 -25 76 -14 12 -15 C-45 -14 -130 -19 -113 -35Z'));
for(let i=0;i<36;i++){let f=i/35,x=-107+f*219, bx=x*.86;stroke(c,[[x,-37+Math.sin(f*23)*3],[bx,-20+Math.sin(f*4)*4]],'#dcb66f',.7+r()*.6)}
for(let i=0;i<125;i++){let x=(r()-.5)*190,y=-42-r()*70;if(y<(-112+x*x*.0068))continue;c.fillStyle=r()<.5?'#e1b77a':'#733b2c';c.beginPath();c.ellipse(x,y,.5+r()*3,.4+r()*1.8,-.3,0,7);c.fill()}c.restore()}
mushroom(219,330,.82,-.34);mushroom(427,270,1.42,.15);mushroom(511,409,.65,.3);
for(let i=0;i<950;i++){let x=r()*700,y=414+r()*96;fungi.fillStyle=i%3===0?'#b15b3670':'#795e3677';fungi.fillRect(x,y,1+r()*7,.4+r()*1.3)}fungi.restore();paper(fungi,700,525,28,7350);
})();