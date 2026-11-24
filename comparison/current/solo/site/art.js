(()=>{
const W=1040,H=830,PI=Math.PI,TAU=2*PI;
const cache={};
function rng(seed){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}}
function line(c,fn,n=80){c.beginPath();for(let i=0;i<=n;i++){let [x,y]=fn(i/n);if(i)c.lineTo(x,y);else c.moveTo(x,y)}c.stroke()}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h)}
function flecks(c,r,n,ink,alpha,x=0,y=0,w=W,h=H){c.fillStyle=ink;c.globalAlpha=alpha;for(let i=0;i<n;i++){let l=r();c.fillRect(x+r()*w,y+r()*h,.3+l*l*4,.27+r()*1.4)}c.globalAlpha=1}
function stock(c,r,pale){rect(c,0,0,W,H,pale);flecks(c,r,12500,'#5c452c',.17);flecks(c,r,15500,'#fff8e2',.30)}
function shell(c){let r=rng(428);stock(c,r,'#e9b088');let pad=24;rect(c,pad,pad,W-2*pad,H-pad*2,'#1d1916');c.save();c.beginPath();c.rect(pad,pad,W-pad*2,H-pad*2);c.clip();
for(let j=0;j<145;j++){let y=20+j*5.7+r()*3;let phase=r()*8;let trem=r()*3;c.strokeStyle=['#bc6a42','#774530','#e58751','#513a2e'][j%4];c.lineWidth=.55+r()*1.5;c.globalAlpha=.17+r()*.37;let a=r()*110,b=910+r()*124;line(c,u=>{let x=a+(b-a)*u;return[x,y+Math.sin(x/185+phase)*12+Math.sin(x/25+phase)*trem+22*Math.sin(x/470+y/65)]},95)}c.globalAlpha=1;
flecks(c,r,38000,'#ce6f43',.25);flecks(c,r,22000,'#bcbcaa',.09);
let max=TAU*2.85,theta=-.50-max;const rad=t=>465*Math.exp(.158*(t-max));
function pos(t,s){let rr=rad(t)*(.355+.645*s);let angle=t+theta+.09*Math.sin(PI*s)+.02*Math.sin(t*2)*(1-s);return [462+rr*Math.cos(angle)*1.025,433+rr*Math.sin(angle)*.88]}
function edge(t){return pos(t,1)}
function segment(a,b,fn){for(let i=0;i<=54;i++){let t=a+(b-a)*i/54;let [x,y]=fn(t);c.lineTo(x,y)}}
function trace(a,b){c.beginPath();let [x,y]=edge(a);c.moveTo(x,y);segment(a,b,edge);for(let k=1;k<=32;k++){let xy=pos(b,1-k/32);c.lineTo(...xy)}segment(b,a,t=>pos(t,0));c.closePath()}
// Shape filled like a relief ink patch, then etched once for each chamber.
trace(0,max);c.fillStyle='#241913';c.fill();c.strokeStyle='#dd7947';c.lineWidth=4.5;c.lineJoin='round';c.stroke();
let cuts=[0];while(cuts.at(-1)<max-1.54){cuts.push(cuts.at(-1)+.225+(cuts.at(-1)/max)*.065+r()*.056)}cuts.push(max);
for(let k=1;k<cuts.length;k++){let a=cuts[k-1],b=Math.min(max,cuts[k]),big=k===cuts.length-1;let d=b-a;
function cell(u,v){let t=a+d*u-.32*Math.sin(PI*v)*Math.pow(k/cuts.length,.62)*(big?.82:1)+.023*Math.sin(v*7+u*4+k);return pos(t,v)}
if(big){c.save();trace(a-.37,b);c.clip();}
let palette=['#f7a76b','#e97c46','#e98e59','#fbba83','#b65730'];
for(let j=0;j<(big?85:14);j++){let u=(j+.7)/(big?85:14)+(r()-.5)*.025,v0=r()*.16,v1=.93+r()*.07;let wave=(r()-.5)*.1;c.strokeStyle=palette[Math.floor(r()*palette.length)];c.lineWidth=(.36+r()*1.62)*(k/cuts.length*.72+.44);c.globalAlpha=.48+r()*.5;line(c,s=>{let v=v0+(v1-v0)*s;return cell(u+wave*Math.sin(v*11+k)+.016*Math.sin(v*45+j),v)},28)}
for(let j=0;j<(big?59:15);j++){let v=(j+.4)/(big?59:15);let u0=r()*.68;let u1=Math.min(.99,u0+r()*.66);c.strokeStyle=palette[(j+k)%5];c.lineWidth=.4+r()*1.35;c.globalAlpha=.35+r()*.45;line(c,s=>cell(u0+(u1-u0)*s,v+.029*Math.sin(s*3+j)),21)}
c.globalAlpha=1;c.strokeStyle='#271811';c.lineWidth=3.2;line(c,v=>cell(.025,v),40);c.strokeStyle='#f6a262';c.lineWidth=1.7;line(c,v=>cell(.105,v*.985),40);
if(big)c.restore();
}
for(let j=0;j<11;j++){let v=.92+j*.009;c.strokeStyle=['#eb9b64','#824623','#fbaf77','#381d13'][j%4];c.lineWidth=1.1+(j%3)*.6;line(c,s=>pos(max*s,v+.004*Math.sin(s*310+j)),280)}
for(let j=0;j<5;j++){c.strokeStyle=['#fcb47f','#e07f47','#211611'][j%3];c.lineWidth=1.5+j%2;line(c,s=>pos(max-j*.016,.34+s*.66),68)}
// Scuffed ink and repeating grain over the image.
flecks(c,r,74000,'#221913',.24,pad,pad,W-2*pad,H-2*pad);flecks(c,r,46500,'#f1a879',.19,pad,pad,W-2*pad,H-2*pad);
c.restore();c.strokeStyle='#a65938';c.lineWidth=1;c.strokeRect(17.5,17.5,W-35,H-35);c.strokeStyle='#633b2b';c.strokeRect(28.5,28.5,W-57,H-57);
}
function tide(c){let r=rng(59);stock(c,r,'#dedace');rect(c,24,24,992,782,'#273d77');c.save();c.beginPath();c.rect(24,24,992,782);c.clip();
let palette=['#0e2345','#233767','#335493','#476ba2','#a4b8c2','#e8e2ca'];
for(let i=0;i<15;i++){let y=185+i*48,amp=48+i*12,shift=i*61;const f=x=>y+amp*Math.sin((x+shift)/193)+amp*.34*Math.sin((x+shift)/78)-65*Math.sin(x/411);c.fillStyle=palette[i%5];c.beginPath();c.moveTo(0,f(0));for(let x=1;x<=W;x+=3)c.lineTo(x,f(x));c.lineTo(W,H+200);c.lineTo(0,H+200);c.fill();
for(let j=0;j<105;j++){let x=r()*W,w=14+r()*150,o=r()*55;c.strokeStyle=palette[(i+2+j)%6];c.globalAlpha=.3+r()*.6;c.lineWidth=.7+r()*3.2;line(c,s=>{let xx=x+s*w;return[xx,f(xx)+o+Math.sin(xx*.03+j)*1.6]},30)}c.globalAlpha=1;
c.strokeStyle='#dddcc8';c.lineWidth=2.5;line(c,s=>[W*s,f(W*s)+1+2*Math.sin(s*160)],250);
}c.fillStyle='#dcd6b8';c.beginPath();c.arc(770,179,64,0,TAU);c.fill();flecks(c,r,105000,'#152d45',.3);flecks(c,r,64000,'#dad8c0',.25);c.restore()}
function herb(c){let r=rng(2001);stock(c,r,'#e0dec5');rect(c,24,24,992,782,'#1d3b32');c.save();c.beginPath();c.rect(24,24,992,782);c.clip();flecks(c,r,60000,'#8faa77',.25);flecks(c,r,30000,'#0f2b26',.42);
function fern(x,y,dx,dy,scale){let p=t=>[x+dx*t+107*scale*Math.sin(t*2.7),y+dy*t];c.strokeStyle='#ccc494';c.lineWidth=3*scale;line(c,p);for(let i=2;i<29;i++){let t=i/29;let [a,b]=p(t);let l=(Math.sin((t*.97+.04)*PI)**.85)*230*scale;for(let s of [-1,1]){let tipx=a+s*l*.86+dx*.16,tipy=b-l*(.43+(s+1)*.13);let m=(l*.12)+3;
function leaf(v,k){return [a+(tipx-a)*v+s*Math.sin(v*PI)*m*k,b+(tipy-b)*v+Math.sin(v*PI)*m*k]}
c.beginPath();c.moveTo(a,b);for(let j=0;j<=32;j++)c.lineTo(...leaf(j/32,1));for(let j=32;j>=0;j--)c.lineTo(...leaf(j/32,-1));c.closePath();c.fillStyle=['#bcba8b','#cfcb9b','#a6ae7e','#d0c297'][(i+(s+1))%4];c.fill();
c.strokeStyle='#294b3e';for(let j=0;j<27;j++){let v=j/27;c.lineWidth=.5+r()*1.2;line(c,k=>leaf(v+k*.07,k*2-1),8)}
}}}
fern(447,727,130,-586,1.18);fern(450,731,-272,-455,.77);fern(470,738,252,-372,.78);
c.strokeStyle='#9c9f7a';c.globalAlpha=.66;c.lineWidth=1;c.strokeRect(37,37,967,757);c.globalAlpha=1;flecks(c,r,74000,'#1b3a32',.23);flecks(c,r,50000,'#c0bd91',.13);c.restore()
}
const renderers={shell,tide,herb};window.drawPrint=(canvas,key)=>{if(!cache[key]){const src=document.createElement('canvas');src.width=W;src.height=H;renderers[key](src.getContext('2d'));cache[key]=src}canvas.getContext('2d').drawImage(cache[key],0,0,canvas.width,canvas.height)};
const hero=document.querySelector('#hero-art');if(hero)window.drawPrint(hero,hero.dataset.art);
const others=[...document.querySelectorAll('canvas[data-art]:not(#hero-art)')];if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(({isIntersecting,target})=>{if(isIntersecting){window.drawPrint(target,target.dataset.art);observer.unobserve(target)}}),{rootMargin:'250px'});others.forEach(c=>observer.observe(c))}else{others.forEach(c=>window.drawPrint(c,c.dataset.art))}
})();