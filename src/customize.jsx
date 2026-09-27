// KARIA V7.33 — CUSTOMIZE: 3D bag configurator + admin Customize Settings
import React,{useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame} from "@react-three/fiber";
import {OrbitControls,ContactShadows} from "@react-three/drei";
import * as THREE from "three";
import {ArrowRight,RotateCcw,Shuffle,MousePointerClick,Check} from "lucide-react";
import {supabase} from "./supabase";

/* ───────────────────────── DEFAULT DATA ───────────────────────── */
export const CUSTOM_SKU="KARIA-CUSTOM-BAG";
export const DEFAULT_COLORS=[
 {id:"black",name:"Black",hex:"#1c1c1e"},{id:"carbon-gray",name:"Carbon Gray",hex:"#3b3c40"},{id:"dark-grey",name:"Dark Grey",hex:"#86888b"},{id:"light-green",name:"Light Green",hex:"#b8bbb6"},
 {id:"coffee",name:"Coffee",hex:"#4a2a1c"},{id:"brown",name:"Brown",hex:"#7a5240"},{id:"dark-khaki",name:"Dark Khaki",hex:"#b8a27f"},{id:"dark-green",name:"Dark Green",hex:"#1e3a33"},
 {id:"denim-blue",name:"Denim Blue",hex:"#1f4e7a"},{id:"violets",name:"Violets",hex:"#5a2a6d"},{id:"sapphire-blue",name:"Sapphire Blue",hex:"#1d5fc0"},{id:"lake-blue",name:"Lake Blue",hex:"#2e99c8"},
 {id:"peacock-green",name:"Peacock Green",hex:"#128f88"},{id:"grass-green",name:"Grass Green",hex:"#2e983a"},{id:"lime-green",name:"Lime Green",hex:"#86b23a"},{id:"burgundy",name:"Burgundy",hex:"#6d1024"},
 {id:"red",name:"Red",hex:"#d01c2b"},{id:"rose",name:"Rose",hex:"#e0217a"},{id:"orange",name:"Orange",hex:"#f06a1c"},{id:"gray-pink",name:"Gray Pink",hex:"#d9adba"},
 {id:"milky-white",name:"Milky White",hex:"#efeae0"},{id:"light-tan",name:"Light Tan",hex:"#e3c2a2"},{id:"golden-yellow",name:"Golden Yellow",hex:"#eeb41f"},{id:"mint-green",name:"Mint Green",hex:"#8fdfcb"},
].map((c,i)=>({...c,active:true,sort_order:i}));
export const HARDWARE=[{id:"gold",name:"Gold",hex:"#c9a24a",metal:1,rough:.28},{id:"silver",name:"Silver",hex:"#c9cbd0",metal:1,rough:.22},{id:"black",name:"Matte Black",hex:"#26231f",metal:.6,rough:.5}];

const R=28,C=112; // stitch rows (bottom→top) and stitches around the bag
const band=(key,label,from,to)=>({key,label,from,to});
// Built-in styles = the 10 designs of the KARIA reference sheet.
export const BUILTIN_STYLES=[
 {id:"classic-double",name:"Classic Double Stripe",sub:"Dos rayas horizontales",kind:"bands",bands:[band("bottom","Bottom Stripe",.25,.33),band("top","Top Stripe",.42,.50)]},
 {id:"multi-stripe",name:"Multi Stripe",sub:"Rayas múltiples",kind:"bands",bands:[band("s1","Stripe 1 (bottom)",.12,.19),band("s2","Stripe 2",.27,.34),band("s3","Stripe 3",.42,.49),band("s4","Stripe 4",.57,.64),band("s5","Stripe 5 (top)",.72,.79)]},
 {id:"vertical-stripe",name:"Vertical Stripe",sub:"Rayas verticales",kind:"vertical"},
 {id:"wide-stripe",name:"Wide Stripe",sub:"Raya ancha central",kind:"bands",bands:[band("wide","Wide Stripe",.22,.56)]},
 {id:"asymmetric-stripe",name:"Asymmetric Stripe",sub:"Rayas asimétricas",kind:"bands",bands:[band("s1","Thin Stripe (bottom)",.14,.18),band("s2","Medium Stripe",.27,.33),band("s3","Wide Stripe (top)",.42,.52)]},
 {id:"framed-stripe",name:"Framed Stripe",sub:"Doble raya enmarcada",kind:"bands",bands:[band("lower","Lower Band",.17,.33),band("upper","Upper Band",.40,.56)]},
 {id:"diagonal-stripe",name:"Diagonal Stripe",sub:"Rayas diagonales",kind:"diagonal"},
 {id:"triple-stripe",name:"Triple Stripe",sub:"Tres rayas",kind:"bands",bands:[band("bottom","Bottom Stripe",.14,.23),band("middle","Middle Stripe",.35,.44),band("top","Top Stripe",.56,.65)]},
 {id:"border-stripe",name:"Border Stripe",sub:"Raya con borde",kind:"bands",bands:[band("bline","Bottom Line",.15,.19),band("center","Center Panel",.25,.64),band("tline","Top Line",.70,.74)]},
 {id:"block-stripe",name:"Block Stripe",sub:"Rayas en bloques",kind:"block"},
].map((s,i)=>({...s,builtin:true,active:true,extra_price:0,sort_order:i,allowed_colors:null}));

/* ───────────────────────── STYLE ENGINE ───────────────────────── */
// Every style resolves to: parts (what the customer can color) + pattern(row,col) → part key.
export function resolveStyle(s){
 if(!s)return null;
 const kind=s.kind||"bands";
 let parts=[{key:"body",label:"Main Body"}],pattern;
 if(kind==="vertical"){parts.push({key:"stripes",label:"Vertical Stripes"});pattern=(r,c)=>{const f=(r+.5)/R;if(f<.07||f>.88)return"body";return Math.floor(c/7)%2?"stripes":"body"}}
 else if(kind==="diagonal"){parts.push({key:"stripes",label:"Diagonal Stripes"});pattern=(r,c)=>{const f=(r+.5)/R;if(f<.07||f>.88)return"body";return((c+Math.floor(r*1.25))%14)<7?"stripes":"body"}}
 else if(kind==="block"){parts.push({key:"blocks",label:"Blocks"});pattern=(r,c)=>{const f=(r+.5)/R;if(f<.07||f>.85)return"body";const br=Math.floor((f-.07)/.26),bc=Math.floor(c/8);return(br+bc)%2?"blocks":"body"}}
 else{const bands=(s.bands||[]).filter(b=>b&&b.key);bands.forEach(b=>parts.push({key:b.key,label:b.label||b.key}));pattern=(r)=>{const f=(r+.5)/R;const b=bands.find(b=>f>=Number(b.from)&&f<Number(b.to));return b?b.key:"body"}}
 parts.push({key:"handle",label:"Handle"});
 return {...s,parts,pattern};
}
const defaultFor=(key)=>key==="body"||key==="handle"?"coffee":"milky-white";
const lum=hex=>{const c=new THREE.Color(hex);return .299*c.r+.587*c.g+.114*c.b};
// Completes a color map for any style: body/handle keep their color, un-chosen stripes use the customer's accent (or a contrast of the body).
export function fillColors(st,colors,palette,accent){
 if(!st)return colors;const out={};const find=id=>palette.find(c=>c.id===id);
 const body=find(colors.body)||find("coffee")||palette[0];out.body=body?.id;out.handle=(find(colors.handle)||find("coffee")||palette[0])?.id;
 let acc=find(accent);if(!acc||acc.id===out.body)acc=find(lum(body?.hex||"#000")>.55?"coffee":"milky-white")||palette.find(c=>c.id!==out.body)||palette[0];
 st.parts.forEach(p=>{if(p.key==="body"||p.key==="handle")return;out[p.key]=find(colors[p.key])?colors[p.key]:acc?.id});
 return out;
}
export function colorFor(key,colors,palette){const id=colors?.[key]??defaultFor(key);return palette.find(c=>c.id===id)||palette.find(c=>c.id===defaultFor(key))||palette[0]||{id:"x",name:"—",hex:"#999"}}

/* ───────────────────────── 2D FRONT VIEW (SVG) ─────────────────────────
   Used for style cards, admin previews and the Orders "how to make it" sheet. */
export function BagSVG({style,colors={},palette=DEFAULT_COLORS,hardware="gold",className="",active}){
 const st=useMemo(()=>resolveStyle(style),[style]);
 const uid=useMemo(()=>"b"+Math.random().toString(36).slice(2,8),[]);
 if(!st)return null;
 const hx=k=>colorFor(k,colors,palette).hex;
 const x0=30,x1=170,y0=88,y1=184,cols=C/2,c0=C/4,cw=(x1-x0)/cols,rh=(y1-y0)/R;
 const rects=[];
 for(let r=0;r<R;r++){let start=0,cur=st.pattern(r,c0);for(let i=1;i<=cols;i++){const k=i<cols?st.pattern(r,c0+i):null;if(k!==cur){rects.push(<rect key={`${r}-${start}`} x={x0+start*cw-.2} y={y1-(r+1)*rh-.2} width={(i-start)*cw+.4} height={rh+.4} fill={hx(cur)} opacity={active&&active!==cur?.55:1}/>);start=i;cur=k}}}
 const hw=HARDWARE.find(h=>h.id===hardware)||HARDWARE[0];
 return <svg className={className} viewBox="0 0 200 200" role="img" aria-label={st.name}>
  <defs><clipPath id={`${uid}c`}><rect x={x0} y={y0} width={x1-x0} height={y1-y0} rx="16"/></clipPath>
   <pattern id={`${uid}p`} width="5" height="6.8" patternUnits="userSpaceOnUse"><path d="M.4 .6 Q1.3 4 2.5 6.2 M4.6 .6 Q3.7 4 2.5 6.2" stroke="rgba(0,0,0,.2)" strokeWidth=".7" fill="none"/><path d="M1.2 1.2 Q1.8 3.4 2.4 4.8" stroke="rgba(255,255,255,.22)" strokeWidth=".6" fill="none"/></pattern>
   <linearGradient id={`${uid}g`} x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity=".22"/><stop offset=".25" stopColor="#000" stopOpacity="0"/><stop offset=".75" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".25"/></linearGradient></defs>
  <path d="M52 92 C50 12 150 12 148 92" fill="none" stroke={hx("handle")} strokeWidth="13" strokeLinecap="round" opacity={active&&active!=="handle"?.55:1}/>
  <path d="M52 92 C50 12 150 12 148 92" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="13" strokeDasharray="1.4 3" strokeLinecap="butt"/>
  <g clipPath={`url(#${uid}c)`}>{rects}<rect x={x0} y={y0} width={x1-x0} height={y1-y0} fill={`url(#${uid}p)`}/><rect x={x0} y={y0} width={x1-x0} height={y1-y0} fill={`url(#${uid}g)`}/></g>
  <circle cx="52" cy="90" r="5.5" fill="none" stroke={hw.hex} strokeWidth="2.4"/><circle cx="148" cy="90" r="5.5" fill="none" stroke={hw.hex} strokeWidth="2.4"/>
 </svg>;
}

/* ───────────────────────── 3D BAG ───────────────────────── */
const H=1.7,A=1.32,B=.62,N=5; // height, half-width, half-depth, superellipse roundness
const superXY=(theta)=>{const s=Math.sin(theta),c=Math.cos(theta);return [A*Math.sign(s)*Math.pow(Math.abs(s),2/N),B*Math.sign(c)*Math.pow(Math.abs(c),2/N)]};
const bulge=v=>1+.045*Math.sin(Math.PI*Math.min(1,v*1.05));
function makeBodyGeometry(){
 const g=new THREE.CylinderGeometry(1,1,H,192,40,true,Math.PI,Math.PI*2); // seam at the back, u=.5 is the front
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),theta=Math.atan2(x,z),v=(y+H/2)/H,[sx,sz]=superXY(theta),k=bulge(v);p.setXYZ(i,sx*k,y,sz*k)}
 g.computeVertexNormals();return g;
}
function makeBaseGeometry(){const sh=new THREE.Shape();for(let i=0;i<=128;i++){const [x,z]=superXY(i/128*Math.PI*2);i?sh.lineTo(x,z):sh.moveTo(x,z)}const g=new THREE.ShapeGeometry(sh,64);g.rotateX(Math.PI/2);g.translate(0,-H/2+.004,0);return g}
function makeRimGeometry(){const pts=[];for(let i=0;i<128;i++){const [x,z]=superXY(i/128*Math.PI*2),k=bulge(1);pts.push(new THREE.Vector3(x*k,H/2,z*k))}return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),256,.05,12,true)}
const HX=.86;
class HandleCurve extends THREE.Curve{getPoint(t,o=new THREE.Vector3()){const a=Math.PI*t;return o.set(-HX*Math.cos(a),H/2+.02+1.28*Math.pow(Math.sin(a),.8),0)}}
function makeHandleGeometry(){return new THREE.TubeGeometry(new HandleCurve(),160,.095,18,false)}

function shade(hex,amt){const c=new THREE.Color(hex);const hsl={};c.getHSL(hsl);c.setHSL(hsl.h,hsl.s,Math.max(0,Math.min(1,hsl.l+amt)));return"#"+c.getHexString()}
function drawStitch(ctx,x,y,w,h,col,dark,light){
 ctx.fillStyle=dark;ctx.fillRect(x,y,w,h);
 ctx.fillStyle=col;
 ctx.beginPath();ctx.ellipse(x+w*.3,y+h*.52,w*.3,h*.5,-.42,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.ellipse(x+w*.7,y+h*.52,w*.3,h*.5,.42,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=light;
 ctx.beginPath();ctx.ellipse(x+w*.27,y+h*.42,w*.1,h*.26,-.42,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.ellipse(x+w*.67,y+h*.42,w*.1,h*.26,.42,0,Math.PI*2);ctx.fill();
}
const CW=14,CH=18;
function paintBody(canvas,st,colorOf,rowsVisible){
 const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
 const cache={};const tone=k=>cache[k]||(cache[k]=(h=>[h,shade(h,-.16),shade(h,.1)])(colorOf(k)));
 for(let r=0;r<Math.min(R,rowsVisible);r++){const y=canvas.height-(r+1)*CH;for(let c=0;c<C;c++){const [a,d,l]=tone(st.pattern(r,c));drawStitch(ctx,c*CW,y,CW,CH,a,d,l)}}
}
function paintMask(canvas,st,active){const ctx=canvas.getContext("2d");ctx.fillStyle="#000";ctx.fillRect(0,0,canvas.width,canvas.height);if(!active||active==="handle")return;ctx.fillStyle="#fff";for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(st.pattern(r,c)===active)ctx.fillRect(c*CW,canvas.height-(r+1)*CH,CW,CH)}
function paintBump(canvas){const ctx=canvas.getContext("2d");for(let r=0;r<R;r++)for(let c=0;c<C;c++)drawStitch(ctx,c*CW,canvas.height-(r+1)*CH,CW,CH,"#9a9a9a","#202020","#f2f2f2")}
function paintHandle(canvas,hex){const ctx=canvas.getContext("2d");const d=shade(hex,-.16),l=shade(hex,.1);const cols=canvas.width/CW,rows=canvas.height/CH;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)drawStitch(ctx,c*CW,r*CH,CW,CH,hex,d,l)}
const mkTex=(cv,srgb=true)=>{const t=new THREE.CanvasTexture(cv);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};

function Bag3D({style,colors,palette,hardware,active,buildKey,onPick,onHover}){
 const st=useMemo(()=>resolveStyle(style),[style]);
 const geo=useMemo(()=>({body:makeBodyGeometry(),base:makeBaseGeometry(),rim:makeRimGeometry(),handle:makeHandleGeometry()}),[]);
 const cv=useMemo(()=>{const mk=(w,h)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c};return{body:mk(C*CW,R*CH),mask:mk(C*CW,R*CH),bump:mk(C*CW,R*CH),handle:mk(CW*6,CH*4)}},[]);
 const tex=useMemo(()=>{paintBump(cv.bump);const handle=mkTex(cv.handle);handle.wrapS=handle.wrapT=THREE.RepeatWrapping;handle.repeat.set(9,1);return{body:mkTex(cv.body),mask:mkTex(cv.mask,false),bump:mkTex(cv.bump,false),handle}},[cv]);
 const bodyMat=useRef(),handleMat=useRef(),group=useRef(),handleGroup=useRef(),rim=useRef();
 const build=useRef({p:0,rows:0,spin:0});
 const colorOf=k=>colorFor(k,colors,palette).hex;
 const repaint=(rows)=>{paintBody(cv.body,st,colorOf,rows);tex.body.needsUpdate=true};
 // style change → the bag is "crocheted" row by row + a turn on its axis
 useEffect(()=>{build.current.p=0;build.current.rows=-1;build.current.spin+=Math.PI*2},[buildKey]);
 // colour change → instant repaint of the rows already built
 useEffect(()=>{repaint(build.current.rows<0?0:build.current.rows)},[st,colors,palette]);
 useEffect(()=>{paintHandle(cv.handle,colorOf("handle"));tex.handle.needsUpdate=true},[colors,palette]);
 useEffect(()=>{paintMask(cv.mask,st,active);tex.mask.needsUpdate=true},[st,active]);
 useFrame((state,dt)=>{
  const b=build.current;
  if(b.p<1.35){b.p=Math.min(1.35,b.p+dt/1.15);const rows=Math.min(R,Math.ceil(b.p*R));if(rows!==b.rows){b.rows=rows;repaint(rows)}}
  if(rim.current)rim.current.visible=b.p>=1;
  if(handleGroup.current){const t=THREE.MathUtils.clamp((b.p-1)/.3,0,1),e=1-Math.pow(1-t,3);handleGroup.current.scale.set(1,e,1);handleGroup.current.visible=e>.01}
  if(group.current){group.current.rotation.y=THREE.MathUtils.lerp(group.current.rotation.y,b.spin,.06)}
  const pulse=.1+.12*(.5+.5*Math.sin(state.clock.elapsedTime*4));
  if(bodyMat.current)bodyMat.current.emissiveIntensity=active&&active!=="handle"?pulse:0;
  if(handleMat.current)handleMat.current.emissiveIntensity=active==="handle"?pulse*.9:0;
 });
 const hw=HARDWARE.find(h=>h.id===hardware)||HARDWARE[0];
 const partAt=e=>{const uv=e.uv;if(!uv)return null;return st.pattern(Math.min(R-1,Math.floor(uv.y*R)),Math.min(C-1,Math.floor(uv.x*C)))};
 const click=(e,k)=>{e.stopPropagation();if(e.delta>8)return;onPick(k||partAt(e))};
 const move=(e,k)=>{e.stopPropagation();onHover(k||partAt(e));document.body.style.cursor="pointer"};
 const out=()=>{onHover(null);document.body.style.cursor=""};
 const topColor=colorOf(st.pattern(R-1,C/2)),baseColor=colorOf(st.pattern(0,C/2));
 return <group ref={group} position={[0,-.8,0]}>
  <mesh geometry={geo.body} castShadow receiveShadow onClick={e=>click(e)} onPointerMove={e=>move(e)} onPointerOut={out}>
   <meshStandardMaterial ref={bodyMat} map={tex.body} bumpMap={tex.bump} bumpScale={2.2} roughness={.92} metalness={0} side={THREE.DoubleSide} alphaTest={.5} emissive="#ffffff" emissiveMap={tex.mask} emissiveIntensity={0}/>
  </mesh>
  <mesh geometry={geo.base} receiveShadow><meshStandardMaterial color={shade(baseColor,-.05)} roughness={.95} side={THREE.DoubleSide}/></mesh>
  <mesh ref={rim} geometry={geo.rim} castShadow onClick={e=>click(e,st.pattern(R-1,C/2))} onPointerMove={e=>move(e,st.pattern(R-1,C/2))} onPointerOut={out}><meshStandardMaterial color={topColor} bumpMap={tex.bump} bumpScale={1.2} roughness={.9}/></mesh>
  <group ref={handleGroup} position={[0,H/2,0]}><group position={[0,-H/2,0]}>
   <mesh geometry={geo.handle} castShadow onClick={e=>click(e,"handle")} onPointerMove={e=>move(e,"handle")} onPointerOut={out}><meshStandardMaterial ref={handleMat} map={tex.handle} bumpMap={tex.handle} bumpScale={1.5} roughness={.9} emissive="#ffffff" emissiveIntensity={0}/></mesh>
   {[-HX,HX].map(x=><mesh key={x} position={[x,H/2+.05,0]} castShadow><torusGeometry args={[.12,.026,16,48]}/><meshStandardMaterial color={hw.hex} metalness={hw.metal} roughness={hw.rough}/></mesh>)}
  </group></group>
 </group>;
}

function Stage({glRef,...props}){
 const [spin,setSpin]=useState(true);
 return <Canvas shadows camera={{position:[0,.7,typeof window!=="undefined"&&window.innerWidth<900?8.8:7.4],fov:34}} dpr={[1,2]} gl={{preserveDrawingBuffer:true,antialias:true,alpha:true}} onCreated={({gl})=>{glRef.current=gl}}>
  <ambientLight intensity={.55}/>
  <directionalLight position={[3.5,5,4]} intensity={2.1} castShadow shadow-mapSize={[1024,1024]}/>
  <directionalLight position={[-4,2,-3]} intensity={.6} color="#ffe8cf"/>
  <hemisphereLight args={["#fff6ea","#8a7560",.9]}/>
  <pointLight position={[0,1.5,3.5]} intensity={6} distance={9} color="#fff1dc"/>
  <Bag3D {...props}/>
  <ContactShadows position={[0,-1.66,0]} opacity={.42} scale={7} blur={2.6} far={2.5}/>
  <OrbitControls enablePan={false} minDistance={4} maxDistance={10} minPolarAngle={.35} maxPolarAngle={1.62} autoRotate={spin} autoRotateSpeed={.7} onStart={()=>setSpin(false)} target={[0,0,0]}/>
 </Canvas>;
}

/* ───────────────────────── DATA LOADING ───────────────────────── */
export async function loadCustomizeData(){
 const out={colors:DEFAULT_COLORS,styles:BUILTIN_STYLES,config:{enabled:true,customization_fee:0,lead_time:"Handmade to order · ships in 7–10 days"},product:null,live:false};
 if(!supabase)return out;
 try{
  const [{data:cols,error:ce},{data:sty,error:se},{data:cfg},{data:prod}]=await Promise.all([
   supabase.from("customize_colors").select("*").order("sort_order"),
   supabase.from("customize_styles").select("*").order("sort_order"),
   supabase.from("customize_config").select("*").eq("id",1).maybeSingle(),
   supabase.from("products").select("id,name,price,sku").eq("sku",CUSTOM_SKU).maybeSingle(),
  ]);
  if(!ce&&cols?.length)out.colors=cols;
  if(!se&&sty?.length)out.styles=sty.map(row=>{const b=BUILTIN_STYLES.find(x=>x.id===row.id);return{...(b||{}),...row,kind:row.kind||b?.kind||"bands",bands:row.bands&&row.bands.length?row.bands:b?.bands||[],builtin:!!b}});
  if(cfg)out.config={...out.config,...cfg};
  if(prod)out.product=prod;
  out.live=!ce&&!se;
 }catch(e){console.warn("KARIA customize: using built-in defaults",e)}
 return out;
}

/* ───────────────────────── CUSTOMER PAGE ───────────────────────── */
export function CustomizePage({Header,add}){
 const [data,setData]=useState(null);
 const [styleId,setStyleId]=useState("triple-stripe");
 const [colors,setColors]=useState({body:"milky-white",bottom:"coffee",middle:"rose",top:"coffee",handle:"coffee"});
 const [hardware,setHardware]=useState("gold"),[accent,setAccent]=useState("coffee");
 const [active,setActive]=useState("body");
 const [hover,setHover]=useState(null);
 const [buildKey,setBuildKey]=useState(0);
 const [added,setAdded]=useState(false);
 const glRef=useRef(),colorsRef=useRef(null);
 useEffect(()=>{loadCustomizeData().then(d=>{setData(d);const first=d.styles.filter(s=>s.active!==false);if(first.length&&!first.find(s=>s.id==="triple-stripe"))setStyleId(first[0].id)})},[]);
 const styles=(data?.styles||BUILTIN_STYLES).filter(s=>s.active!==false);
 const style=styles.find(s=>s.id===styleId)||styles[0];
 const st=useMemo(()=>resolveStyle(style),[style]);
 const allowed=useMemo(()=>{const pal=(data?.colors||DEFAULT_COLORS).filter(c=>c.active!==false);const a=style?.allowed_colors;return a&&a.length?pal.filter(c=>a.includes(c.id)):pal},[data,style]);
 const fullPalette=data?.colors||DEFAULT_COLORS;
 const pal=allowed.length?allowed:fullPalette;
 const filled=useMemo(()=>fillColors(st,colors,pal,accent),[st,colors,pal,accent]);
 useEffect(()=>{if(st&&!st.parts.find(p=>p.key===active))setActive("body")},[st]);
 if(!st||data?.config?.enabled===false)return <div className="catalogPage">{Header}<main className="catalogMain"><div className="catalogHero"><small>KARIA ATELIER</small><h1>Customize is coming soon.</h1><p>Our made-to-order bags will be back shortly.</p></div></main></div>;
 const cfg=data?.config||{};
 const basePrice=Number(data?.product?.price??118),price=basePrice+Number(cfg.customization_fee||0)+Number(style.extra_price||0);
 const partColor=k=>colorFor(k,filled,pal);
 const chooseStyle=id=>{if(id===styleId)return;setStyleId(id);setBuildKey(k=>k+1);setActive("body");if(window.innerWidth<900)window.scrollTo({top:0,behavior:"smooth"})};
 const pick=k=>{if(!k)return;setActive(k);setTimeout(()=>colorsRef.current?.querySelector(`[data-part="${k}"]`)?.scrollIntoView({behavior:"smooth",block:"nearest"}),60)};
 const setPart=(k,id)=>{setColors(c=>({...c,[k]:id}));if(k!=="body"&&k!=="handle")setAccent(id)};
 const shuffle=()=>{const pal=allowed.length?allowed:fullPalette;const next={...colors};const used=new Set();st.parts.forEach(p=>{let c;let tries=0;do{c=pal[Math.floor(Math.random()*pal.length)]}while(used.has(c.id)&&tries++<6);used.add(c.id);next[p.key]=c.id});setColors(next)};
 const reset=()=>{setColors({});setAccent("coffee")};
 const snapshot=()=>{try{const src=glRef.current?.domElement;if(!src)return"";const s=360,cv=document.createElement("canvas");cv.width=s;cv.height=s;const ctx=cv.getContext("2d");ctx.fillStyle="#efe8dd";ctx.fillRect(0,0,s,s);const sc=Math.min(s/src.width,s/src.height)*1.15,w=src.width*sc,h=src.height*sc;ctx.drawImage(src,(s-w)/2,(s-h)/2,w,h);return cv.toDataURL("image/jpeg",.82)}catch{return""}};
 const addToCart=()=>{
  if(!data?.product){alert("Customize checkout is not configured yet. Please run the KARIA-V7.33 SQL in Supabase.");return}
  const parts={};st.parts.forEach(p=>{const c=partColor(p.key);parts[p.key]={label:p.label,color_id:c.id,color_name:c.name,hex:c.hex}});
  const hw=HARDWARE.find(h=>h.id===hardware)||HARDWARE[0];
  const customization={style_id:style.id,style_name:style.name,parts,hardware:hw.id,hardware_name:hw.name};
  if(!style.builtin){customization.kind=style.kind||"bands";customization.bands=style.bands||[]}
  add({id:data.product.id,cartKey:`custom-${Date.now()}`,name:`Custom Bag · ${style.name}`,price,img:snapshot()||"/products/bag-brown.jpg",customization,tone:Object.values(parts).map(p=>`${p.label}: ${p.color_name}`).join(" · ")});
  setAdded(true);setTimeout(()=>setAdded(false),2200);
 };
 const hoverLabel=hover&&st.parts.find(p=>p.key===hover)?.label;
 return <div className="catalogPage customizePage">{Header}
  <main className="customizeMain">
   <section className="customizeStage">
    <div className="customizeStageHead"><small>KARIA ATELIER · MADE FOR YOU</small><h1>Create your bag.</h1></div>
    <div className="customizeCanvas">
     <Stage glRef={glRef} style={style} colors={filled} palette={pal} hardware={hardware} active={active} buildKey={buildKey} onPick={pick} onHover={k=>setHover(h=>h===k?h:k)}/>
     <div className="customizeHint"><MousePointerClick/>{hoverLabel?<span>Tap to color <b>{hoverLabel}</b></span>:<span>Drag to rotate · tap any part of the bag to color it</span>}</div>
     <div className="customizeStyleTag"><small>STYLE</small><b>{style.name}</b></div>
    </div>
   </section>
   <section className="customizePanel">
    <div className="customizeStep"><div className="customizeStepHead"><span>01</span><div><small>CHOOSE YOUR STYLE</small><h2>{styles.length} designs</h2></div></div>
     <div className="styleGrid">{styles.map((s,i)=><button key={s.id} className={`styleCard ${s.id===style.id?"active":""}`} onClick={()=>chooseStyle(s.id)}><BagSVG style={s} colors={fillColors(resolveStyle(s),colors,fullPalette,accent)} palette={fullPalette} hardware={hardware}/><span className="styleNum">{i+1}</span><b>{s.name}</b><small>{s.sub||""}</small>{Number(s.extra_price||0)>0&&<em>+${Number(s.extra_price).toFixed(2)}</em>}</button>)}</div>
    </div>
    <div className="customizeStep" ref={colorsRef}><div className="customizeStepHead"><span>02</span><div><small>CHOOSE YOUR COLORS</small><h2>{st.parts.length} parts to color</h2></div><div className="customizeTools"><button onClick={shuffle} title="Surprise me"><Shuffle/></button><button onClick={reset} title="Reset colors"><RotateCcw/></button></div></div>
     <div className="partList">{st.parts.map(p=>{const c=partColor(p.key),open=active===p.key;return <div className={`partRow ${open?"open":""}`} key={p.key} data-part={p.key}>
      <button className="partHead" onClick={()=>setActive(open?null:p.key)}><i style={{background:c.hex}}/><span>{p.label}</span><b>{c.name}</b></button>
      {open&&<div className="swatches">{allowed.map(col=><button key={col.id} className={col.id===c.id?"on":""} style={{"--sw":col.hex}} onClick={()=>setPart(p.key,col.id)} title={col.name} aria-label={col.name}>{col.id===c.id&&<Check/>}</button>)}<p>{c.name}</p></div>}
     </div>})}
      <div className="partRow hardwareRow"><div className="partHead static"><i className="metal" style={{background:(HARDWARE.find(h=>h.id===hardware)||HARDWARE[0]).hex}}/><span>Hardware rings</span><div className="hwChoices">{HARDWARE.map(h=><button key={h.id} className={h.id===hardware?"on":""} onClick={()=>setHardware(h.id)}>{h.name}</button>)}</div></div></div>
     </div>
    </div>
    <div className="customizeStep summaryStep"><div className="customizeStepHead"><span>03</span><div><small>YOUR KARIA</small><h2>Summary</h2></div></div>
     <div className="customSummary"><div><span>Style</span><b>{style.name}</b></div>{st.parts.map(p=>{const c=partColor(p.key);return <div key={p.key}><span>{p.label}</span><b><i style={{background:c.hex}}/>{c.name}</b></div>})}<div><span>Hardware</span><b>{(HARDWARE.find(h=>h.id===hardware)||HARDWARE[0]).name}</b></div></div>
     <div className="customPrice"><span>{cfg.lead_time||"Handmade to order"}</span><strong>${price.toFixed(2)}</strong></div>
     <button className="productAdd customAdd" onClick={addToCart}>{added?"ADDED TO YOUR BAG":"ADD CUSTOM BAG TO CART"} {added?<Check/>:<ArrowRight/>}</button>
     {data&&!data.product&&<p className="customNote">Preview mode — checkout for custom bags activates after the KARIA-V7.33 SQL is run.</p>}
    </div>
   </section>
  </main>
 </div>;
}

/* ───────────────────────── ORDERS: HOW TO MAKE IT ───────────────────────── */
export function CustomizationSheet({c,compact}){
 if(!c)return null;
 const parts=c.parts||{};
 const palette=Object.values(parts).map(p=>({id:p.color_id,name:p.color_name,hex:p.hex}));
 const colors=Object.fromEntries(Object.entries(parts).map(([k,p])=>[k,p.color_id]));
 const style=BUILTIN_STYLES.find(s=>s.id===c.style_id)||(c.bands?{id:c.style_id,name:c.style_name,kind:"bands",bands:c.bands}:{id:c.style_id,name:c.style_name,kind:c.kind||"bands",bands:Object.entries(parts).filter(([k])=>!["body","handle"].includes(k)).map(([k,p],i)=>({key:k,label:p.label,from:.15+i*.2,to:.25+i*.2}))});
 const svg=<BagSVG style={style} colors={colors} palette={palette.length?palette:DEFAULT_COLORS} hardware={c.hardware||"gold"}/>;
 if(compact)return svg;
 return <div className="customSheet"><div className="customSheetArt">{svg}</div><div><small>CUSTOM BAG · MAKE TO ORDER</small><h4>{c.style_name||c.style_id}</h4><ul>{Object.entries(parts).map(([k,p])=><li key={k}><i style={{background:p.hex}}/><span>{p.label}</span><b>{p.color_name}</b></li>)}<li><i className="metal" style={{background:(HARDWARE.find(h=>h.id===c.hardware)||HARDWARE[0]).hex}}/><span>Hardware</span><b>{c.hardware_name||c.hardware||"Gold"}</b></li></ul></div></div>;
}

/* ───────────────────────── ADMIN · CUSTOMIZE SETTINGS ───────────────────────── */
const slug=s=>String(s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
export function CustomizeAdmin({setNotice}){
 const [d,setD]=useState(null),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null),[newBands,setNewBands]=useState([{label:"Stripe 1",from:30,to:40}]),[newName,setNewName]=useState("");
 const reload=async()=>setD(await loadCustomizeData());
 useEffect(()=>{reload()},[]);
 const run=async(fn,ok)=>{setBusy(true);setNotice("");try{await fn();setNotice(ok);await reload()}catch(e){setNotice(e?.message||String(e))}finally{setBusy(false)}};
 if(!d)return <div className="panel">Loading customize settings…</div>;
 if(!d.live)return <div className="panel"><h2>Customize Settings</h2><p>The customize tables were not found in Supabase. Run <b>KARIA-V7.33-CUSTOMIZE.sql</b> in the Supabase SQL editor, then reopen this tab. The storefront already shows the configurator with the default 10 styles and 24 yarn colors.</p></div>;
 const saveConfig=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));run(async()=>{const {error}=await supabase.from("customize_config").upsert({id:1,enabled:f.enabled==="on",customization_fee:Number(f.fee||0),lead_time:f.lead_time||null,updated_at:new Date().toISOString()});if(error)throw error;if(d.product&&f.base_price!==""){const {error:pe}=await supabase.from("products").update({price:Number(f.base_price)}).eq("id",d.product.id);if(pe)throw pe}},"Customize settings saved.")};
 const updColor=(c,patch)=>run(async()=>{const {error}=await supabase.from("customize_colors").update(patch).eq("id",c.id);if(error)throw error},"Color updated.");
 const delColor=c=>{if(!confirm(`Delete color "${c.name}"? Past orders keep their color name.`))return;run(async()=>{const {error}=await supabase.from("customize_colors").delete().eq("id",c.id);if(error)throw error},"Color deleted.")};
 const addColor=e=>{e.preventDefault();const form=e.currentTarget;const f=Object.fromEntries(new FormData(form));run(async()=>{const id=slug(f.name)||"color";const exists=d.colors.some(c=>c.id===id);const {error}=await supabase.from("customize_colors").insert({id:exists?`${id}-${Date.now().toString(36).slice(-4)}`:id,name:f.name.trim(),hex:f.hex,active:true,sort_order:d.colors.length});if(error)throw error;form.reset()},"Color added.")};
 const updStyle=(s,patch)=>run(async()=>{const {error}=await supabase.from("customize_styles").update(patch).eq("id",s.id);if(error)throw error},"Style updated.");
 const delStyle=s=>{if(!confirm(`Delete style "${s.name}"?`))return;run(async()=>{const {error}=await supabase.from("customize_styles").delete().eq("id",s.id);if(error)throw error},"Style deleted.")};
 const cleanBands=newBands.filter(b=>b.label).map((b,i)=>({key:`b${i+1}`,label:b.label,from:Math.max(0,Math.min(100,Number(b.from)))/100,to:Math.max(0,Math.min(100,Number(b.to)))/100})).filter(b=>b.to>b.from);
 const addStyle=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));if(!cleanBands.length){setNotice("Add at least one stripe band.");return}run(async()=>{const id=slug(f.name)+"-"+Date.now().toString(36).slice(-4);const {error}=await supabase.from("customize_styles").insert({id,name:f.name.trim(),sub:f.sub||null,kind:"bands",bands:cleanBands,extra_price:Number(f.extra_price||0),active:true,sort_order:d.styles.length});if(error)throw error;setNewBands([{label:"Stripe 1",from:30,to:40}]);setNewName("")},"New style created.")};
 const activeColors=d.colors.filter(c=>c.active!==false);
 return <div className={`customizeAdmin ${busy?"busy":""}`}>
  <section className="categoryAdminHero"><div><small>KARIA ATELIER</small><h2>Customize Settings</h2><p>Control the styles, yarn colors and pricing customers see on the CUSTOMIZE page. Changes go live immediately — no code needed.</p></div><div><strong>{activeColors.length}</strong><small>COLORS IN STOCK</small></div></section>
  <form className="adminForm wide" onSubmit={saveConfig}><h2>Pricing & availability</h2>
   <label className="caField">Base bag price (product {CUSTOM_SKU})<input name="base_price" type="number" step="0.01" defaultValue={d.product?.price??""} disabled={!d.product}/></label>
   <label className="caField">Customization fee (added to every custom bag)<input name="fee" type="number" step="0.01" defaultValue={d.config.customization_fee??0}/></label>
   <label className="caField full">Production note shown to customers<input name="lead_time" defaultValue={d.config.lead_time||""} placeholder="Handmade to order · ships in 7–10 days"/></label>
   <label className="checkLine"><input name="enabled" type="checkbox" defaultChecked={d.config.enabled!==false}/> Show CUSTOMIZE page in the store</label>
   <button disabled={busy}>SAVE SETTINGS</button>
  </form>
  <section className="panel caBlock"><div className="caHead"><div><small>YARN PALETTE</small><h2>Colors</h2></div><span>Click a swatch to change its shade · SOLD OUT hides a color from customers.</span></div>
   <div className="caColors">{d.colors.map(c=><div className={`caColor ${c.active===false?"off":""}`} key={c.id}><label className="caSwatch" style={{background:c.hex}}><input type="color" defaultValue={c.hex} onBlur={e=>e.target.value!==c.hex&&updColor(c,{hex:e.target.value})}/></label><div><b>{c.name}</b><small>{c.active===false?"SOLD OUT":"IN STOCK"}</small></div><div className="caActions"><button onClick={()=>updColor(c,{active:c.active===false})}>{c.active===false?"ACTIVATE":"SOLD OUT"}</button><button className="dangerBtn" onClick={()=>delColor(c)}>×</button></div></div>)}</div>
   <form className="caAdd" onSubmit={addColor}><input name="name" placeholder="New color name — e.g. Olive" required/><input name="hex" type="color" defaultValue="#8a7a4a"/><button disabled={busy}>ADD COLOR</button></form>
  </section>
  <section className="panel caBlock"><div className="caHead"><div><small>DESIGNS</small><h2>Styles</h2></div><span>Deactivate a style to hide it · set an extra price per style · limit which colors each style can use.</span></div>
   <div className="caStyles">{d.styles.map(s=><div className={`caStyle ${s.active===false?"off":""}`} key={s.id}><BagSVG style={s} palette={d.colors}/><b>{s.name}</b><small>{s.sub||(s.builtin?"Built-in":"Custom stripes")}</small>
    <label>Extra price<input type="number" step="0.01" defaultValue={s.extra_price||0} onBlur={e=>Number(e.target.value)!==Number(s.extra_price||0)&&updStyle(s,{extra_price:Number(e.target.value||0)})}/></label>
    <div className="caActions"><button onClick={()=>updStyle(s,{active:s.active===false})}>{s.active===false?"ACTIVATE":"HIDE"}</button><button onClick={()=>setEditing(editing===s.id?null:s.id)}>COLORS{s.allowed_colors?.length?` (${s.allowed_colors.length})`:""}</button>{!s.builtin&&<button className="dangerBtn" onClick={()=>delStyle(s)}>DELETE</button>}</div>
    {editing===s.id&&<StyleColorLimiter style={s} colors={d.colors} onSave={ids=>{updStyle(s,{allowed_colors:ids.length&&ids.length<d.colors.length?ids:null});setEditing(null)}}/>}
   </div>)}</div>
  </section>
  <form className="panel caBlock caNewStyle" onSubmit={addStyle}><div className="caHead"><div><small>NEW DESIGN</small><h2>Create a stripe style</h2></div><span>Define horizontal bands by height (0% = bottom, 100% = top). Each band becomes a color choice for the customer.</span></div>
   <div className="caNewGrid"><div className="caNewPreview"><BagSVG style={{id:"preview",name:newName||"Preview",kind:"bands",bands:cleanBands}} palette={DEFAULT_COLORS} colors={Object.fromEntries(cleanBands.map((b,i)=>[b.key,["milky-white","rose","golden-yellow","lake-blue","mint-green"][i%5]]))}/></div>
    <div className="caNewFields"><input name="name" placeholder="Style name — e.g. Sunset Stripe" value={newName} onChange={e=>setNewName(e.target.value)} required/><input name="sub" placeholder="Spanish subtitle (optional)"/><input name="extra_price" type="number" step="0.01" placeholder="Extra price (optional)"/>
     {newBands.map((b,i)=><div className="caBand" key={i}><input value={b.label} placeholder="Band name" onChange={e=>setNewBands(x=>x.map((y,j)=>j===i?{...y,label:e.target.value}:y))}/><input type="number" value={b.from} min="0" max="100" onChange={e=>setNewBands(x=>x.map((y,j)=>j===i?{...y,from:e.target.value}:y))}/><span>% →</span><input type="number" value={b.to} min="0" max="100" onChange={e=>setNewBands(x=>x.map((y,j)=>j===i?{...y,to:e.target.value}:y))}/><span>%</span><button type="button" onClick={()=>setNewBands(x=>x.filter((_,j)=>j!==i))}>×</button></div>)}
     <button type="button" className="caGhost" onClick={()=>setNewBands(x=>{const last=x[x.length-1];const from=last?Math.min(90,Number(last.to)+8):20;return[...x,{label:`Stripe ${x.length+1}`,from,to:Math.min(100,from+8)}]})}>+ ADD BAND</button>
     <button disabled={busy}>CREATE STYLE</button></div></div>
  </form>
 </div>;
}
function StyleColorLimiter({style,colors,onSave}){
 const [sel,setSel]=useState(()=>new Set(style.allowed_colors?.length?style.allowed_colors:colors.map(c=>c.id)));
 const tog=id=>setSel(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n});
 return <div className="caLimiter"><p>Colors available for this style:</p><div>{colors.map(c=><button type="button" key={c.id} className={sel.has(c.id)?"on":""} style={{"--sw":c.hex}} title={c.name} onClick={()=>tog(c.id)}/>)}</div><div className="caActions"><button type="button" onClick={()=>setSel(new Set(colors.map(c=>c.id)))}>ALL</button><button type="button" onClick={()=>onSave([...sel])}>SAVE</button></div></div>;
}
