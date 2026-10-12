// Segments the real bag photo into parts and writes the assets the configurator recolors.
// usage: node seg.cjs <photo> <outDir> [debug.jpg]
const sharp=require("sharp");const fs=require("fs");
const SRC=process.argv[2],OUT=process.argv[3],DEBUG=process.argv[4];
// measured on the 1536x1024 photo
const CROP={x:318,y:30,w:900,h:970};
const ROWS=[886,858,836,814,790,765,744,718,694,672,650,628,605,584,562]; // stitch row boundaries, bottom -> top (front face)
const XC=585,STITCH=25,SIDE_STITCH=11.5,AROUND=50;                        // front/side corner, stitch widths, stitches around the bag
const SIDE={x:532,a:-51.6,b:1.088};                                       // row lines on the side face: y' = a + b*y at x=532
(async()=>{
 const {data,info}=await sharp(SRC).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,N=W*H;
 const lum=new Float32Array(N),sat=new Float32Array(N),brown=new Uint8Array(N),gold=new Uint8Array(N);
 for(let i=0;i<N;i++){const r=data[i*3],g=data[i*3+1],b=data[i*3+2];lum[i]=.299*r+.587*g+.114*b;const rb=(r-b)/Math.max(r,1),rg=(r-g)/Math.max(r,1);sat[i]=rb;
  if(rb>.38&&rg>.33&&lum[i]<175&&r>30)brown[i]=1;else if(rb>.42&&rg<=.33&&rg>.08&&lum[i]>70)gold[i]=1}
 // largest brown component = handle + top of the body (they touch at the rings)
 const lab=new Int32Array(N);let nl=0,top=null;const stack=[];
 for(let s=0;s<N;s++){if(!brown[s]||lab[s])continue;nl++;let area=0,x0=W,x1=0,y0=H,y1=0;stack.push(s);lab[s]=nl;
  while(stack.length){const i=stack.pop(),x=i%W,y=(i/W)|0;area++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   for(const j of [i-1,i+1,i-W,i+W,i-W-1,i-W+1,i+W-1,i+W+1]){if(j<0||j>=N||Math.abs(j%W-x)>1)continue;if(brown[j]&&!lab[j]){lab[j]=nl;stack.push(j)}}}
  if(!top||area>top.area)top={id:nl,area,x0,x1,y0,y1}}
 const cx=(top.x0+top.x1)>>1;let rimY=H;
 for(let x=cx-120;x<=cx+120;x++)for(let y=300;y<H;y++)if(lab[y*W+x]===top.id){if(y<rimY)rimY=y;break}
 rimY-=2;const bodyBot=ROWS[0]-2;
 // body edges per row: trust full-width brown rows, interpolate through the cream stripes
 const L=new Float32Array(H).fill(-1),R=new Float32Array(H).fill(-1),aL=new Int32Array(H).fill(-1),aR=new Int32Array(H).fill(-1);
 for(let y=rimY;y<=bodyBot+6;y++){let l=-1,r=-1;for(let x=top.x0-10;x<=top.x1+12;x++)if(brown[y*W+x]){if(l<0)l=x;r=x}aL[y]=l;aR[y]=r}
 const ws=[];for(let y=560;y<=860;y++)ws.push(aR[y]-aL[y]);ws.sort((a,b)=>a-b);const wide=ws[Math.floor(ws.length*.9)];
 const valid=y=>y>=548&&y<=862&&aL[y]>=0&&(aR[y]-aL[y])>.975*wide;
 let fv=548;while(!valid(fv))fv++;let lv=862;while(!valid(lv))lv--;
 for(let y=rimY;y<=bodyBot+6;y++){
  if(y<fv){L[y]=Math.max(aL[y],aL[fv]);R[y]=Math.min(aR[y],aR[fv]+1)}       // rim: never wider than the wall below (cuts the handle ends)
  else if(y>lv){L[y]=aL[y];R[y]=aR[y]}                                       // rounded bottom: real extents
  else if(valid(y)){L[y]=aL[y];R[y]=aR[y]}
  else{let a=y;while(!valid(a))a--;let b=y;while(!valid(b))b++;const t=(y-a)/(b-a);L[y]=aL[a]+(aL[b]-aL[a])*t;R[y]=aR[a]+(aR[b]-aR[a])*t}}
 for(const E of [L,R]){const c=Float32Array.from(E);for(let y=fv;y<=lv;y++){const w=[];for(let k=-6;k<=6;k++)if(y+k>=fv&&y+k<=lv)w.push(c[y+k]);w.sort((a,b)=>a-b);E[y]=w[w.length>>1]}}
 // the shadowed edges of the wall are too dark to read as brown: grow the span over dark pixels (the backdrop is bright)
 for(let y=fv;y<=lv;y++){let l=Math.round(L[y]),r=Math.round(R[y]);for(let k=0;k<12&&lum[y*W+l-1]<150&&!gold[y*W+l-1];k++)l--;for(let k=0;k<12&&lum[y*W+r+1]<150&&!gold[y*W+r+1];k++)r++;L[y]=l;R[y]=r}
 const part=new Uint8Array(N); // 1 body, 2 handle, 3 hardware
 for(let y=rimY;y<=bodyBot+6;y++){if(L[y]<0)continue;for(let x=Math.round(L[y]);x<=Math.round(R[y]);x++){const i=y*W+x;if(y<fv||y>lv){if(brown[i])part[i]=1}else part[i]=1}}
 // fill grooves inside the rim / bottom rows that failed the brown test
 for(let pass=0;pass<3;pass++){const add=[];for(let y=rimY;y<=bodyBot+6;y++)for(let x=top.x0;x<=top.x1;x++){const i=y*W+x;if(part[i]||gold[i])continue;let n=0;for(const j of [i-1,i+1,i-W,i+W,i-2,i+2,i-2*W,i+2*W])if(part[j]===1)n++;if(n>=6)add.push(i)}add.forEach(i=>part[i]=1)}
 // handle: the rest of the top component, plus its ends that hang below the rim line
 for(let i=0;i<N;i++){if(part[i]||!brown[i])continue;const y=(i/W)|0;if(lab[i]===top.id&&y<rimY+32)part[i]=2}
 for(let pass=0;pass<3;pass++){const add=[];for(let y=top.y0;y<=rimY+32;y++)for(let x=top.x0;x<=top.x1;x++){const i=y*W+x;if(part[i]||gold[i])continue;let n=0;for(const j of [i-1,i+1,i-W,i+W,i-2,i+2,i-2*W,i+2*W])if(part[j]===2)n++;if(n>=6)add.push(i)}add.forEach(i=>part[i]=2)}
 for(let y=rimY-75;y<=rimY+45;y++)for(let x=top.x0-30;x<=top.x1+30;x++){const i=y*W+x;if(gold[i])part[i]=3}
 // shading: luminance relative to the yarn that is there today (brown or cream), so any color can be laid on top
 const pct=(a,p)=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length*p)]};
 const lb=[],lc=[],lg=[];for(let i=0;i<N;i++){if(part[i]===1||part[i]===2){if(sat[i]>.45)lb.push(lum[i]);else if(sat[i]<.25)lc.push(lum[i])}else if(part[i]===3)lg.push(lum[i])}
 const Lb=pct(lb,.82),Lc=pct(lc,.7),Lg=pct(lg,.8);console.log({rimY,fv,lv,wide,Lb,Lc,Lg});
 const shade=new Float32Array(N);
 for(let i=0;i<N;i++){if(!part[i])continue;if(part[i]===3){shade[i]=lum[i]/Lg;continue}const w=Math.max(0,Math.min(1,(.45-sat[i])/.2));const sb=lum[i]/Lb,sc=Math.pow(lum[i]/Lc,3);shade[i]=sb+(sc-sb)*w} // cream yarn shows far less relief than brown: steepen it so every row keeps its texture
 // coverage: soft edge so the recolored bag blends into the photo
 const cov=new Float32Array(N);for(let i=0;i<N;i++){if(!part[i])continue;cov[i]=1}
 const soft=new Float32Array(N);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;soft[i]=(cov[i]*4+cov[i-1]+cov[i+1]+cov[i-W]+cov[i+W])/8}
 // row / column of every body pixel
 const rowOf=(x,y)=>{let yy=y;if(x<XC){const t=(XC-x)/(XC-SIDE.x);yy=y+t*((SIDE.a+SIDE.b*y)-y)}let r=ROWS.length-1;for(let k=0;k<ROWS.length-1;k++)if(yy<=ROWS[k]&&yy>ROWS[k+1]){r=k;break}if(yy>ROWS[0])r=0;return r};
 const colOf=x=>{const c=x>=XC?Math.floor((x-XC)/STITCH):-1-Math.floor((XC-x)/SIDE_STITCH);return ((c%AROUND)+AROUND)%AROUND};
 const map=Buffer.alloc(CROP.w*CROP.h*3),sh=Buffer.alloc(CROP.w*CROP.h*3);
 for(let y=0;y<CROP.h;y++)for(let x=0;x<CROP.w;x++){const sx=x+CROP.x,sy=y+CROP.y,i=sy*W+sx,o=(y*CROP.w+x)*3;
  // a soft edge pixel takes the part of its neighbour so it can be tinted
  let p=part[i];if(!p&&soft[i]>0){for(const j of [i-1,i+1,i-W,i+W])if(part[j]){p=part[j];break}}
  map[o]=p;map[o+1]=p===1?rowOf(sx,sy):0;map[o+2]=p===1?colOf(sx):0;
  let s=shade[i];if(!part[i]&&p){let acc=0,n=0;for(const j of [i-1,i+1,i-W,i+W])if(part[j]){acc+=shade[j];n++}s=n?acc/n:1}
  sh[o]=Math.max(0,Math.min(255,Math.round(s*110)));sh[o+1]=Math.round(Math.max(part[i]?soft[i]:0,soft[i])*255);sh[o+2]=0}
 await sharp(SRC).extract({left:CROP.x,top:CROP.y,width:CROP.w,height:CROP.h}).jpeg({quality:86,mozjpeg:true}).toFile(OUT+"/bag-photo.jpg");
 await sharp(map,{raw:{width:CROP.w,height:CROP.h,channels:3}}).png({compressionLevel:9}).toFile(OUT+"/bag-map.png");
 await sharp(sh,{raw:{width:CROP.w,height:CROP.h,channels:3}}).png({compressionLevel:9}).toFile(OUT+"/bag-shade.png");
 console.log("rows",ROWS.length,"files",["bag-photo.jpg","bag-map.png","bag-shade.png"].map(f=>f+" "+fs.statSync(OUT+"/"+f).size).join(", "));
 if(DEBUG){ // test render: every row a different color, handle red, hardware blue
  const pal=[[230,60,60],[60,160,230],[240,200,60],[80,190,120],[200,90,200]];const o=Buffer.alloc(CROP.w*CROP.h*3);const base=await sharp(SRC).extract({left:CROP.x,top:CROP.y,width:CROP.w,height:CROP.h}).removeAlpha().raw().toBuffer();
  for(let k=0;k<CROP.w*CROP.h;k++){const p=map[k*3],a=sh[k*3+1]/255,s=sh[k*3]/110;let c=p===1?pal[(map[k*3+1]+(process.argv[5]==="cols"?map[k*3+2]:0))%pal.length]:p===2?[150,40,40]:p===3?[60,60,200]:null;for(let ch=0;ch<3;ch++){const b=base[k*3+ch];o[k*3+ch]=c?Math.round(b*(1-a)+Math.min(255,c[ch]*s)*a):b}}
  await sharp(o,{raw:{width:CROP.w,height:CROP.h,channels:3}}).jpeg({quality:85}).toFile(DEBUG)}
})();
