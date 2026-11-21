// KARIA V7.49 — "Noir Atelier" home page: crossfade hero, 3D coverflow of every bag, the craft story and the making-of film.
// The original home (HomePage in main.jsx) is kept; Admin → Settings → Store look switches between them.
import React,{useEffect,useMemo,useRef,useState} from "react";
import {ArrowRight,ArrowLeft} from "lucide-react";
import {soldOut,onSale,isVideo} from "./storefront";

const money=n=>`$${Number(n||0).toFixed(2)}`;
const reduceMotion=()=>typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
// second photo of a product (the close-up), falling back to the main one
const closeUp=p=>(p.media||[]).filter(m=>!isVideo(m))[1]?.url||p.img;
// bags you can buy first, then the sold-out ones
const availableFirst=list=>[...list].sort((a,b)=>soldOut(a)-soldOut(b));

function Hero({products}){
 const slides=useMemo(()=>availableFirst(products).slice(0,5),[products]);
 const [i,setI]=useState(0);
 const go=d=>setI(n=>(n+d+slides.length)%slides.length);
 useEffect(()=>{if(slides.length<2||reduceMotion())return;const t=setInterval(()=>setI(n=>(n+1)%slides.length),5600);return()=>clearInterval(t)},[slides.length,i]);
 // Text on the left, the whole photo on the right: the frame has the photos' own 3:2 shape, so no bag is ever cropped.
 return <section className="noirHero noirHeroSplit" aria-label="Featured bags">
  <div className="noirHeroText"><small>Hand-crocheted · Limited pieces</small><h1>Made slowly, <i>worn</i> every day.</h1><p>Each KARIA bag is crocheted by hand, stripe by stripe, and finished with gold-tone rings.</p><a className="noirBtn" href="/shop">Shop the collection <ArrowRight/></a></div>
  <div className="noirStage">
   {slides.map((p,n)=><a key={p.id} href={`/product/${p.id}`} className={`noirSlide${n===i?" on":""}`} aria-hidden={n!==i} tabIndex={n===i?0:-1}><img src={p.img} alt={n===i?p.name:""} fetchPriority={n===0?"high":"auto"}/></a>)}
   <span className="noirStageName">{slides[i]?.name}</span>
   {slides.length>1&&<div className="noirHeroNav"><button aria-label="Previous photo" onClick={()=>go(-1)}><ArrowLeft/></button><span><b>{String(i+1).padStart(2,"0")}</b> / {String(slides.length).padStart(2,"0")}</span><button aria-label="Next photo" onClick={()=>go(1)}><ArrowRight/></button></div>}
  </div>
 </section>
}

// 3D coverflow: the centre bag is big and lit, its neighbours turn away; arrows, a tap on a side bag or a swipe move it.
function Coverflow({products,add}){
 const list=useMemo(()=>availableFirst(products),[products]);
 const [c,setC]=useState(0),start=useRef(null),dragged=useRef(false);
 useEffect(()=>{if(c>=list.length)setC(0)},[list.length,c]);
 if(!list.length)return null;
 const n=list.length,cur=list[Math.min(c,n-1)],out=soldOut(cur);
 const go=d=>setC(x=>(x+d+n)%n);
 const place=k=>{let o=k-c;if(o>n/2)o-=n;if(o<-n/2)o+=n;const a=Math.abs(o);
  return {transform:`translateX(${o*58}%) translateZ(${-a*140}px) rotateY(${o*-28}deg) scale(${a?0.86:1})`,zIndex:50-a,opacity:a>3?0:1,filter:a?"brightness(.55)":"none",pointerEvents:a>3?"none":"auto"}};
 return <section className="noirFlowSec" aria-roledescription="carousel" aria-label="The collection">
  <div className="noirSecHead"><small>{n} handmade bags</small><h2>The Collection</h2></div>
  <div className="noirFlow" onKeyDown={e=>{if(e.key==="ArrowRight")go(1);if(e.key==="ArrowLeft")go(-1)}}
   onPointerDown={e=>{start.current=e.clientX;dragged.current=false}} onPointerUp={e=>{if(start.current==null)return;const dx=e.clientX-start.current;start.current=null;if(Math.abs(dx)>40){dragged.current=true;go(dx<0?1:-1)}}}>
   {list.map((p,k)=><button type="button" key={p.id} className="noirFlowItem" style={place(k)} tabIndex={k===c?0:-1} aria-label={k===c?`${p.name}, ${money(p.price)}`:`Show ${p.name}`} onClick={()=>{if(dragged.current){dragged.current=false;return}if(k===c)location.assign(`/product/${p.id}`);else setC(k)}}>
    <img src={closeUp(p)} alt="" loading={Math.abs(k-c)<3?"eager":"lazy"} draggable="false"/>{soldOut(p)&&<span className="noirSold">Sold out</span>}
   </button>)}
  </div>
  <div className="noirFlowInfo" aria-live="polite"><h3>{cur.name}</h3><p>{onSale(cur)?<><s>{money(cur.compareAt)}</s> {money(cur.price)}</>:money(cur.price)} · {out?"Sold out":"Hand-crocheted"}</p>
   <div className="noirFlowNav"><button className="noirRound" aria-label="Previous bag" onClick={()=>go(-1)}><ArrowLeft/></button>
    <a className="noirBtn ghost" href={`/product/${cur.id}`}>View details</a>
    <button className="noirBtn" disabled={out} onClick={()=>add(cur)}>{out?"Sold out":"Add to bag"}</button>
    <button className="noirRound" aria-label="Next bag" onClick={()=>go(1)}><ArrowRight/></button></div>
  </div>
 </section>
}

// Plays the film only while it is on screen, and never downloads it before.
function Film(){
 const ref=useRef(null);
 useEffect(()=>{const v=ref.current;if(!v||reduceMotion()||!("IntersectionObserver" in window))return;
  const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)v.play().catch(()=>{});else v.pause()},{threshold:.35});io.observe(v);return()=>io.disconnect()},[]);
 return <video ref={ref} src="/products/bag-video.mp4" poster="/products/bag-detail.jpg" muted loop playsInline preload="none" controls aria-label="How a KARIA bag is made"/>
}

export function NoirHome({Header,products,add,loaded}){
 const minPrice=products.length?Math.min(...products.map(p=>Number(p.price)||0)):0;
 const story=products.find(p=>/chocolate/i.test(p.name))||products[0];
 return <div className="site noirHome">{Header}<main id="top">
  {products.length?<Hero products={products}/>:<section className="noirHero noirHeroEmpty"><div className="noirHeroText"><small>KARIA</small><h1>{loaded?"New bags are on the way.":"Loading the collection…"}</h1></div></section>}
  <Coverflow products={products} add={add}/>
  {story&&<section className="noirSplit"><img src={closeUp(story)} alt={`${story.name}, close-up of the crochet stitches`} loading="lazy"/><div><small>The craft</small><h2>Every stitch, by hand.</h2><p>Thick cotton cord, tight single crochet and a rounded handle wrapped end to end. No two bags come out exactly alike.</p>
   <div className="noirFacts"><div><b>{products.length}</b><span>Colorways</span></div><div><b>100%</b><span>Handmade</span></div><div><b>{money(minPrice).replace(".00","")}</b><span>Each bag</span></div></div>
   <a className="noirBtn ghost" href="/about">Our story <ArrowRight/></a></div></section>}
  <section className="noirFilm"><div className="noirSecHead"><small>Behind KARIA</small><h2>The making of a bag.</h2></div><Film/></section>
 </main></div>
}
