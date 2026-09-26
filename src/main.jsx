import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {Canvas,useFrame} from "@react-three/fiber";
import {Image as DreiImage,Float,Environment} from "@react-three/drei";
import * as THREE from "three";
import {ShoppingBag,User,Search,ArrowRight,Menu,X,Play,MoveDown,Package,Wallet,Users,Boxes,BarChart3,Settings,ShieldCheck} from "lucide-react";
import "./style.css";

const products=[
 {id:1,name:"Terra Woven Bag",brand:"Independent Artisan",price:118,img:"/products/bag-brown.jpg",stock:4,tone:"Cocoa / Ivory"},
 {id:2,name:"Midnight Woven Bag",brand:"Independent Artisan",price:126,img:"/products/bag-blue.jpg",stock:3,tone:"Midnight Blue"},
 {id:3,name:"Signature Handwoven",brand:"Independent Artisan",price:132,img:"/products/bag-detail.jpg",stock:2,tone:"Artisan Edition"},
];

function HeroScene({progress}){
 const group=useRef(),card=useRef(),ring=useRef();
 useFrame((state,delta)=>{
  const t=state.clock.elapsedTime;
  const p=progress.current;
  if(group.current){group.current.rotation.y=THREE.MathUtils.lerp(group.current.rotation.y,(state.pointer.x*.16)+(p*.55),.04);group.current.rotation.x=THREE.MathUtils.lerp(group.current.rotation.x,-state.pointer.y*.06,.04);group.current.position.y=Math.sin(t*.65)*.055-p*.45;}
  if(card.current){card.current.rotation.z=THREE.MathUtils.lerp(card.current.rotation.z,-.035+state.pointer.x*.025,.04);card.current.scale.setScalar(1+p*.12)}
  if(ring.current) ring.current.rotation.z+=delta*.07;
 });
 return <>
  <ambientLight intensity={1.6}/><directionalLight position={[3,5,4]} intensity={2.2}/>
  <group ref={group}>
   <mesh ref={ring} position={[0,0,-1.1]} rotation={[1.25,0,.25]}><torusGeometry args={[2.35,.012,16,180]}/><meshStandardMaterial color="#b89b78" metalness={.65} roughness={.35}/></mesh>
   <mesh position={[0,0,-1.25]}><circleGeometry args={[2.02,64]}/><meshStandardMaterial color="#d7c4aa" roughness={1}/></mesh>
   <DreiImage ref={card} url="/products/bag-brown.jpg" transparent position={[0,0,.15]} scale={[3.15,4.25,1]} radius={.03}/>
   <Float speed={1.4} rotationIntensity={.25} floatIntensity={.35}><mesh position={[-2.1,1.45,.45]} rotation={[.3,.1,.4]}><torusGeometry args={[.2,.025,12,48]}/><meshStandardMaterial color="#d5ad73" metalness={1} roughness={.2}/></mesh></Float>
   <Float speed={1.1} rotationIntensity={.2} floatIntensity={.4}><mesh position={[2.0,-1.25,.3]}><sphereGeometry args={[.085,24,24]}/><meshStandardMaterial color="#fff3dc"/></mesh></Float>
  </group><Environment preset="studio"/>
 </>
}

function App(){
 const [cart,setCart]=useState([]),[admin,setAdmin]=useState(false),[menu,setMenu]=useState(false),[active,setActive]=useState(0);
 const progress=useRef(0);
 const add=p=>setCart(c=>[...c,p]);
 useEffect(()=>{const fn=()=>{const max=Math.max(innerHeight,document.documentElement.scrollHeight-innerHeight);const p=scrollY/max;progress.current=p;document.documentElement.style.setProperty("--sy",scrollY+"px");document.documentElement.style.setProperty("--sp",p)};fn();addEventListener("scroll",fn,{passive:true});return()=>removeEventListener("scroll",fn)},[]);
 if(admin) return <Admin back={()=>setAdmin(false)}/>;
 return <div className="site">
  <header><button className="icon mobile" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><a className="logo" href="#top">KARIA</a>
   <nav className={menu?"open":""}><a href="#shop">SHOP</a><a href="#story">THE CRAFT</a><a href="#brands">BRANDS</a><a href="#contact">CONTACT</a></nav>
   <div className="actions"><Search/><User/><button className="bag"><ShoppingBag/><b>{cart.length}</b></button></div>
  </header>
  <main id="top">
   <section className="heroCine">
    <div className="heroWords"><div className="eyebrow">HANDCRAFTED · CURATED BY KARIA</div><h1><span>Made by hand.</span><em>Made to be yours.</em></h1><p>Wearable pieces of craft, made slowly and chosen with intention.</p><a href="#shop" className="cta">Explore the collection <ArrowRight/></a></div>
    <div className="canvasWrap"><Canvas camera={{position:[0,0,6.4],fov:34}} dpr={[1,1.6]} gl={{alpha:true,antialias:true}}><HeroScene progress={progress}/></Canvas></div>
    <div className="heroVertical">KARIA · HANDCRAFTED STORIES · 2026</div><div className="scrollOrb"><MoveDown/><span>SCROLL</span></div>
   </section>

   <section className="statement"><div className="marquee"><span>HANDWOVEN&nbsp; · &nbsp;SMALL BATCH&nbsp; · &nbsp;ONE OF A KIND&nbsp; · &nbsp;MADE SLOWLY&nbsp; · &nbsp;</span><span>HANDWOVEN&nbsp; · &nbsp;SMALL BATCH&nbsp; · &nbsp;ONE OF A KIND&nbsp; · &nbsp;MADE SLOWLY&nbsp; · &nbsp;</span></div><p>KARIA is a home for independent craft — a place where every bag keeps the name, mark and story of the hands behind it.</p></section>

   <section className="craftScene" id="story"><div className="stickyMedia"><img src="/products/bag-blue.jpg"/><div className="scan"></div><div className="materialTag t1">01 / HANDWOVEN BODY</div><div className="materialTag t2">02 / WOVEN STRAP</div><div className="materialTag t3">03 / GOLD HARDWARE</div></div><div className="craftCopy"><div className="chapter"><small>01 — THE CRAFT</small><h2>Texture you can<br/><i>almost touch.</i></h2><p>Every loop, edge and detail carries evidence of the maker. We put that workmanship at the center of the experience.</p></div><div className="chapter"><small>02 — THE DETAILS</small><h2>Designed slowly.<br/><i>Worn endlessly.</i></h2><p>Close-up storytelling, movement and light reveal what a flat product grid normally hides.</p></div></div></section>

   <section className="film"><video src="/products/bag-video.mp4" muted autoPlay loop playsInline/><div className="filmShade"></div><div className="filmCopy"><button><Play fill="currentColor"/> CRAFT IN MOTION</button><h2>Not manufactured.<br/><i>Made.</i></h2><p>A slower process creates pieces with a different kind of value.</p></div><div className="filmIndex">K / 02</div></section>

   <section className="orbitShowcase" id="brands"><div className="orbitCopy"><small>03 — CURATED BRANDS</small><h2>Different makers.<br/>One point of view.</h2><p>KARIA is the destination. Every artisan brand keeps its own identity, logo and story.</p></div><div className="orbitStage"><div className="orbitRing r1"></div><div className="orbitRing r2"></div><img className="orbitBag one" src="/products/bag-brown.jpg"/><img className="orbitBag two" src="/products/bag-blue.jpg"/><span className="orbitLabel l1">ARTISAN 01</span><span className="orbitLabel l2">ARTISAN 02</span></div></section>

   <section id="shop" className="shop"><div className="sectionHead"><div><span>04 — SHOP THE COLLECTION</span><h2>Objects with a soul.</h2></div><p>Limited pieces. Small runs.<br/>Made to live with you.</p></div>
    <div className="grid">{products.map((p,i)=><article key={p.id} className={active===i?"active":""} onMouseEnter={()=>setActive(i)}><div className="productImg"><span className="number">0{i+1}</span><img src={p.img}/><div className="glassLabel"><small>{p.tone}</small><b>${p.price}.00</b></div><button onClick={()=>add(p)}>ADD TO BAG <ArrowRight/></button></div><div className="productMeta"><div><small>{p.brand}</small><h3>{p.name}</h3></div><span>{p.stock} PIECES</span></div></article>)}</div>
   </section>

   <section className="closing"><div className="closingWord">KARIA</div><div className="closingCard"><small>THE KARIA EDIT</small><h2>Carry something<br/>with a story.</h2><a href="#shop">Discover the collection <ArrowRight/></a></div><img src="/products/bag-detail.jpg"/></section>
  </main>
  <footer id="contact"><div><div className="logo">KARIA</div><p>Handcrafted bags & accessories.<br/>Curated with intention.</p></div><div className="footLinks"><a href="#shop">Shop</a><a href="#story">Our story</a><a href="#brands">Brands</a><a href="#">Shipping & returns</a></div><div className="newsletter"><small>JOIN THE KARIA LETTER</small><div><input placeholder="Your email address"/><button>→</button></div></div><button className="adminLink" onClick={()=>setAdmin(true)}>Admin</button><div className="copyright">© 2026 KARIA · HANDCRAFTED STORIES</div></footer>
 </div>
}

function Admin({back}){const cards=[["Revenue","$0.00",Wallet],["Orders","0",ShoppingBag],["Inventory","9",Boxes],["Net result","$0.00",BarChart3]];return <div className="admin"><aside><div className="logo">KARIA</div><small>ADMINISTRATION</small>{[["Dashboard",BarChart3],["Orders",ShoppingBag],["Products",Package],["Brands",ShieldCheck],["Inventory",Boxes],["Production",Settings],["Customers",Users],["Accounting",Wallet],["Reports",BarChart3],["Admin users",Users]].map(([x,I])=><button key={x}><I/>{x}</button>)}<button onClick={back}>← Storefront</button></aside><section className="adminMain"><div className="adminTop"><div><small>BUSINESS OVERVIEW</small><h1>Dashboard</h1></div><div className="owners"><b>Ownership</b><span>Partner A 50%</span><span>Partner B 50%</span></div></div><div className="cards">{cards.map(([a,b,I])=><div key={a}><I/><small>{a}</small><strong>{b}</strong><em>Live from Supabase</em></div>)}</div><div className="adminGrid"><div className="panel"><h2>Inventory movements</h2><p>Confirmed sales create stock OUT movements automatically. Production receipts, returns and adjustments remain auditable.</p></div><div className="panel"><h2>Accounting engine</h2><p>Orders → payment → sales → tax liability → fees → COGS → inventory → reports.</p><div className="flow">SALE → INVENTORY → LEDGER → REPORTS</div></div></div></section></div>}
createRoot(document.getElementById("root")).render(<App/>);
