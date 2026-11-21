// KARIA V7.36 — storefront pages: header, bag, shop, product, my orders, contact, about, footer
import React,{useEffect,useMemo,useState} from "react";
import {ShoppingBag,User,Search,ArrowRight,Menu,X,Play,Star} from "lucide-react";
import {supabase} from "./supabase";

/* ───────────────────────── HELPERS ───────────────────────── */
// Customize (design your own bag) is switched off for now: no menu link, no home teaser, /customize opens the Shop.
// Set to true to bring it back; the page and its admin settings are untouched.
export const CUSTOMIZE_ON=false;
// Made-to-order custom bags have no stock; everything else sells only what Inventory says is available.
export const soldOut=p=>!p.customization&&Number(p.stock||0)<=0;
const NEW_DAYS=30;
export const isNew=p=>!!p.created_at&&Date.now()-new Date(p.created_at).getTime()<NEW_DAYS*864e5;
export const isVideo=m=>String(m?.media_type||"").startsWith("video")||/\.(mp4|webm)(\?|$)/i.test(m?.url||"");
export const sortedMedia=list=>[...(list||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
// main product photo: first image, never a video
export const mainPhoto=list=>sortedMedia(list).find(m=>!isVideo(m))?.url||"";
// A product is on sale when it has an original price above its current price.
export const onSale=p=>Number(p.compareAt||0)>Number(p.price||0);
const percentOff=p=>Math.round((1-Number(p.price)/Number(p.compareAt))*100);
// One description field, three parts: first line = short description; the lines right under it = features ("Color: Brown");
// anything after an empty line = long description.
export function parseDescription(text){
 const blocks=String(text||"").replace(/\r/g,"").split(/\n\s*\n/),head=blocks[0].split("\n").map(s=>s.trim()).filter(Boolean);
 return {short:head[0]||"",features:head.slice(1).map(s=>s.replace(/^[-•*]\s*/,"")),long:blocks.slice(1).join("\n\n").trim()};
}
const cartKey=p=>p.cartKey||p.id;
const money=n=>`$${Number(n||0).toFixed(2)}`;
// Panels (bag, account) close with the Escape key.
export function useEscape(open,close){useEffect(()=>{if(!open)return;const f=e=>{if(e.key==="Escape")close()};addEventListener("keydown",f);return()=>removeEventListener("keydown",f)},[open,close])}
// Legal pages linked from the footer and the checkout.
export const LEGAL=[["Shipping","/shipping"],["Returns & Refunds","/returns"],["Privacy","/privacy"],["Terms","/terms"]];

/* ───────────── NOIR "BOUTIQUE" PIECES (Shop, Reviews, About, Contact; classic keeps its own markup) ───────────── */
// second photo of a product (the close-up), falling back to the main one — same rule as noir.jsx
const closeUp=p=>(p.media||[]).filter(m=>!isVideo(m))[1]?.url||p.img;
// Products have no color field: the color is the word in the bag's name ("Emerald Stripe Bag"). Unknown names get no swatch.
const COLORS=[["Chocolate","#5a3a28"],["Camel","#c49a62"],["Emerald","#0f6b4b"],["Turquoise","#1aa3a8"],["Navy","#1d2c4f"],["Mustard","#d4a017"],["Rose","#e3a1ad"],["Lavender","#a99bd1"],["Olive","#6b7034"],["Sand","#d8c3a0"],["Terracotta","#b85a3c"],["Burgundy","#7a1f2e"],["Pearl Gray","#b9bcc0"],["Black","#1b1b1b"]];
const colorOf=p=>COLORS.find(([c])=>new RegExp(`\\b${c}\\b`,"i").test(p.name||""))?.[0]||"";
const BqHero=({eyebrow,title,lead})=><div className="bqHero"><div className="bqEye">{eyebrow}</div><h1>{title}</h1><div className="bqRule"/>{lead&&<p className="bqLead">{lead}</p>}</div>;

/* ───────────────────────── HEADER ───────────────────────── */
// One header for every storefront page: mobile menu, search, account and bag.
export function StoreHeader({cartCount,onCart,onAccount}){
 const [menu,setMenu]=useState(false);
 const close=()=>setMenu(false);
 const links=[["HOME","/"],["SHOP","/shop"],...(CUSTOMIZE_ON?[["CUSTOMIZE","/customize"]]:[]),["REVIEWS","/reviews"],["ABOUT","/about"],["CONTACT","/contact"]];
 const here=location.pathname;
 return <><header className={menu?"menuHeaderOpen":""}><button className="icon mobile" aria-label="Menu" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><a className="logo" href="/">KARIA</a>
  <nav className={menu?"open":""}>{links.map(([label,href])=><a key={href} href={href} className={here===href?"current":""} onClick={close}>{label}</a>)}<a className="menuOnly" href="/orders" onClick={close}>MY ORDERS</a><button type="button" className="menuOnly" onClick={()=>{close();onAccount()}}>ACCOUNT</button></nav>
  <div className="actions"><a className="iconLink" href="/shop" aria-label="Search products"><Search/></a><button className="accountIcon" aria-label="Account" onClick={onAccount}><User/></button><button className="bag" aria-label="Open bag" onClick={onCart}><ShoppingBag/><b>{cartCount}</b></button></div>
 </header>{menu&&<div className="mobileMenuBackdrop" onClick={close} aria-hidden="true"/>}</>
}

/* ───────────────────────── BAG ───────────────────────── */
// The bag is stored as one entry per piece; here it is shown as one row per product with + / −.
export function CartDrawer({open,setOpen,cart,setCart,checkout,notice,add}){
 useEscape(open,()=>setOpen(false));
 if(!open)return null;
 const groups=Object.values(cart.reduce((a,p)=>{const k=cartKey(p);a[k]??={...p,key:k,qty:0};a[k].qty++;return a},{}));
 const removeOne=k=>setCart(c=>{const i=c.map(cartKey).lastIndexOf(k);return i<0?c:c.filter((_,x)=>x!==i)});
 const removeAll=k=>setCart(c=>c.filter(x=>cartKey(x)!==k));
 return <div className="accountBackdrop" onMouseDown={()=>setOpen(false)}><section className="accountPanel" role="dialog" aria-modal="true" aria-label="Your bag" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" aria-label="Close" autoFocus onClick={()=>setOpen(false)}><X/></button><div className="accountBrand">KARIA</div><small className="accountEyebrow">YOUR BAG</small><h2>{cart.length?`${cart.length} piece${cart.length>1?"s":""}`:"Your bag is empty"}</h2>
  {notice&&<p className="cartNotice">{notice}</p>}
  {!cart.length&&<p className="accountIntro">Find a handmade bag you love. It stays here while you keep looking.</p>}
  <div className="cartList">{groups.map(p=><div className="cartRow" key={p.key}><img src={p.img} alt=""/><div><b>{p.name}</b><small>{money(p.price)}</small><div className="cartQty"><button aria-label="Remove one" onClick={()=>removeOne(p.key)}>−</button><span>{p.qty}</span><button aria-label="Add one" onClick={()=>add(p)}>+</button></div></div><button className="cartRemove" aria-label={`Remove ${p.name}`} onClick={()=>removeAll(p.key)}>×</button></div>)}</div>
  {cart.length>0?<><div className="cartTotal"><span>Subtotal</span><b>{money(cart.reduce((s,p)=>s+Number(p.price),0))}</b></div><p className="cartShipNote">Free standard shipping (2–5 business days). Faster shipping can be chosen at checkout. Secure payment by Stripe.</p><button type="button" className="accountPrimary secureCheckoutBtn" onClick={e=>{e.preventDefault();e.stopPropagation();checkout()}}>SECURE CHECKOUT <ArrowRight/></button></>:<a className="accountPrimary accountLink" href="/shop">SHOP KARIA <ArrowRight/></a>}
 </section></div>
}

/* ───────────────────────── SHOP ───────────────────────── */
function Price({p}){return onSale(p)?<span className="priceSale"><s>{money(p.compareAt)}</s><b>{money(p.price)}</b></span>:<b>{money(p.price)}</b>}
export function ProductCard({p,add}){
 const out=soldOut(p);
 return <article className="catalogCard"><a href={`/product/${p.id}`}><div className="catalogImage newArrivalImage"><img src={p.thumb||p.img} alt={p.name} loading="lazy"/>{out?<span className="newBadge soldBadge">SOLD OUT</span>:onSale(p)?<span className="newBadge saleBadge">SALE −{percentOff(p)}%</span>:isNew(p)&&<span className="newBadge">NEW</span>}</div><small>{p.category||p.brand}</small><h2>{p.name}</h2>{p.reviewCount>0&&<div className="cardStars"><Stars value={p.rating||0}/><span>{`${p.rating.toFixed(1)} (${p.reviewCount})`}</span></div>}</a><div className="catalogBuy"><Price p={p}/><button onClick={()=>add(p)} disabled={out}>{out?"SOLD OUT":"ADD TO BAG"}</button></div></article>
}

// Category "ALL" = everything, "NEW" = registered in the last 30 days, anything else = a category name.
function BqCard({p,add}){
 const out=soldOut(p);
 return <article className="bqCard"><a href={`/product/${p.id}`}><div className="bqPh"><img src={closeUp(p)} alt={p.name} loading="lazy"/>{out?<span className="bqTag">Sold out</span>:onSale(p)?<span className="bqTag">Sale −{percentOff(p)}%</span>:isNew(p)&&<span className="bqTag">New</span>}</div><h3>{p.name}</h3></a>
  {p.reviewCount>0&&<div className="bqStars"><Stars value={p.rating||0}/><span>{`${p.rating.toFixed(1)} (${p.reviewCount})`}</span></div>}
  <div className="bqPrice"><Price p={p}/></div><div className="bqAct"><button className="bqBtn ghost" onClick={()=>add(p)} disabled={out}>{out?"Sold out":"Add to bag"}</button></div></article>
}

export function ShopPage({products,add,Header,startNew,loaded=true,theme}){
 const params=new URLSearchParams(location.search);
 const [q,setQ]=useState(params.get("q")||""),[sort,setSort]=useState("available"),[category,setCategory]=useState(startNew?"NEW":params.get("category")||"ALL");
 const [show,setShow]=useState("all"),[color,setColor]=useState("");
 const categories=useMemo(()=>Array.from(new Set(products.map(p=>String(p.category||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[products]);
 const inCategory=(p,c)=>c==="ALL"||(c==="NEW"?isNew(p):String(p.category||"").toLowerCase()===c.toLowerCase());
 const shown=useMemo(()=>products.filter(p=>inCategory(p,category)&&`${p.name} ${p.brand} ${p.tone} ${p.category||""}`.toLowerCase().includes(q.toLowerCase()))
  .slice().sort((a,b)=>sort==="low"?a.price-b.price:sort==="high"?b.price-a.price:sort==="newest"?new Date(b.created_at||0)-new Date(a.created_at||0):sort==="available"?(soldOut(a)-soldOut(b))||new Date(b.created_at||0)-new Date(a.created_at||0):String(a.name).localeCompare(String(b.name))),[products,q,sort,category]);
 const choose=c=>{setCategory(c);history.replaceState({},"",c==="ALL"?"/shop":c==="NEW"?"/new":`/shop?category=${encodeURIComponent(c)}`)};
 const chips=[["ALL","All products"],...(products.some(isNew)||category==="NEW"?[["NEW","New arrivals"]]:[]),...categories.map(c=>[c,c])];
 const title=category==="ALL"?"All products":category==="NEW"?"New arrivals":category;
 if(theme==="noir"){
  // "Show" and the color swatches narrow what search + category already picked
  const grid=shown.filter(p=>(show==="all"||(show==="out")===soldOut(p))&&(!color||colorOf(p)===color));
  const swatches=COLORS.filter(([c])=>products.some(p=>colorOf(p)===c));
  const reset=()=>{setQ("");setShow("all");setColor("");choose("ALL")};
  return <div className="catalogPage">{Header}<main className="bqMain">
   <BqHero eyebrow="Handmade crochet bags" title={category==="ALL"?"The Collection":title} lead="Each bag is crocheted by hand and finished with gold-tone rings."/>
   <div className="bqShop"><aside className="bqSide" aria-label="Filters">
    <input className="bqSearch" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search bags" aria-label="Search products"/>
    <h4>Show</h4>{[["all","All bags",shown.length],["in","Available",shown.filter(p=>!soldOut(p)).length],["out","Sold out",shown.filter(soldOut).length]].map(([k,t,n])=><button key={k} className="bqFilter" aria-pressed={show===k} onClick={()=>setShow(k)}><span>{t}</span><span>{n}</span></button>)}
    {(chips.length>2||category!=="ALL")&&<><h4>Category</h4>{chips.map(([id,label])=><button key={id} className="bqFilter" aria-pressed={category===id} onClick={()=>choose(id)}><span>{label}</span><span>{products.filter(p=>inCategory(p,id)).length}</span></button>)}</>}
    {swatches.length>0&&<><h4>Colors</h4><div className="bqSw">{swatches.map(([c,hex])=><button key={c} style={{background:hex}} title={c} aria-label={c} aria-pressed={color===c} onClick={()=>setColor(color===c?"":c)}/>)}</div>{color&&<button className="bqClear" onClick={()=>setColor("")}>{color} · show all colors</button>}</>}
    <h4>Sort</h4><select className="bqSort" value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort"><option value="available">Available first</option><option value="newest">Newest</option><option value="name">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
   </aside>
   <section aria-label="Products"><div className="bqGrid">{grid.map(p=><BqCard key={p.id} p={p} add={add}/>)}</div>
    {!grid.length&&<div className="bqNone">{!loaded&&!products.length?"Loading the collection…":<><b>No bags match these filters.</b><button className="bqBtn ghost" onClick={reset}>See all bags</button></>}</div>}
   </section></div>
  </main></div>
 }
 return <div className="catalogPage">{Header}
  <main className="catalogMain">
   <div className="catalogHero"><small>KARIA COLLECTION</small><h1>{category==="NEW"?"New at KARIA.":"Shop KARIA."}</h1><p>Handmade crochet bags, crocheted one by one.</p></div>
   <div className="shopChips">{chips.map(([id,label])=><button key={id} className={category===id?"active":""} onClick={()=>choose(id)}>{label}<b>{products.filter(p=>inCategory(p,id)).length}</b></button>)}</div>
   <section className="shopProducts">
    <div className="catalogTools"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products" aria-label="Search products"/><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort"><option value="available">Available first</option><option value="newest">Newest</option><option value="name">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="catalogContext"><div><small>{category==="ALL"?"KARIA SHOP":category==="NEW"?"JUST ARRIVED":"CATEGORY"}</small><h2>{title}</h2></div><span>{shown.length} product{shown.length===1?"":"s"}</span></div>
    <div className="catalogGrid">{shown.map(p=><ProductCard key={p.id} p={p} add={add}/>)}</div>
    {!shown.length&&!loaded&&<div className="catalogEmpty">Loading the collection…</div>}
    {!shown.length&&loaded&&<div className="catalogEmpty">{q?`No products match "${q}".`:category==="NEW"?"Nothing new in the last 30 days.":"No products found in this category."} {category!=="ALL"&&<button className="dashLink" onClick={()=>{setQ("");choose("ALL")}}>SEE ALL PRODUCTS</button>}</div>}
   </section>
  </main></div>
}

/* ───────────────────────── PRODUCT ───────────────────────── */
export function ProductPage({products,id,add,Header,reviews=[],user,onSignIn,onSaved,loaded=true}){
 const [sel,setSel]=useState(0),[qty,setQty]=useState(1);
 useEffect(()=>{setSel(0);setQty(1)},[id]);
 const p=products.find(x=>String(x.id)===String(id));
 if(!p)return <div className="catalogPage">{Header}<main className="catalogMain"><div className="catalogHero">{loaded?<><h1>Product not found.</h1><a className="cta" href="/shop">Back to shop <ArrowRight/></a></>:<h1>Loading…</h1>}</div></main></div>;
 const media=p.media?.length?p.media:[{url:p.img,media_type:"image"}];
 const desc=parseDescription(p.description);
 const cur=media[Math.min(sel,media.length-1)],out=soldOut(p),max=Math.max(1,Number(p.stock||0));
 // same category first, then the rest of the shop
 const related=products.filter(x=>x.id!==p.id).sort((a,b)=>(soldOut(a)-soldOut(b))||(b.category===p.category)-(a.category===p.category)).slice(0,3);
 return <div className="catalogPage">{Header}<main className="productPage">
  <div className="productGalleryWrap"><div className="productGallery">{isVideo(cur)?<video src={cur.url} controls playsInline muted/>:<img src={cur.url} alt={p.name}/>}{out&&<span className="newBadge soldBadge">SOLD OUT</span>}</div>
   {media.length>1&&<div className="productThumbs">{media.map((m,i)=><button key={m.url||i} className={i===sel?"on":""} onClick={()=>setSel(i)} aria-label={`View ${i+1} of ${media.length}`}>{isVideo(m)?<span><Play/></span>:<img src={m.url} alt=""/>}</button>)}</div>}
  </div>
  <div className="productInfo"><small>{p.category||p.brand}</small><h1>{p.name}</h1><a className="cardStars" href="#reviews">{p.reviewCount>0?<><Stars value={p.rating||0} size={16}/><span>{`${p.rating.toFixed(1)} · ${p.reviewCount} review${p.reviewCount===1?"":"s"}`}</span></>:<span>Write the first review</span>}</a><div className="productPrice">{onSale(p)?<><s>{money(p.compareAt)}</s>{money(p.price)}<em>SAVE {percentOff(p)}%</em></>:money(p.price)}</div><p>{desc.short||"A KARIA selection chosen for the collection."}</p>{desc.features.length>0&&<ul className="productFeatures">{desc.features.map((f,i)=>{const at=f.indexOf(":");return <li key={i}>{at>0&&at<28?<><b>{f.slice(0,at)}</b>{f.slice(at+1)}</>:f}</li>})}</ul>}
   {p.tone&&<div className="productFact"><span>DETAILS</span><b>{p.tone}</b></div>}
   <div className="productFact"><span>AVAILABILITY</span><b>{out?"Sold out":`${p.stock} available`}</b></div>
   {!out&&<div className="productFact productQty"><span>QUANTITY</span><div className="cartQty"><button aria-label="Less" onClick={()=>setQty(n=>Math.max(1,n-1))}>−</button><span>{qty}</span><button aria-label="More" onClick={()=>setQty(n=>Math.min(max,n+1))}>+</button></div></div>}
   <button className="productAdd" onClick={()=>add(p,qty)} disabled={out}>{out?"SOLD OUT":<>ADD TO BAG · {money(Number(p.price)*qty)} <ArrowRight/></>}</button>
   <p className="productTrust">Handmade · Free shipping in the US · Secure checkout by Stripe</p>
   <p className="productNote">Free standard shipping (2–5 business days); Priority and Express can be chosen at checkout. See <a href="/shipping">Shipping</a> and <a href="/returns">Returns &amp; Refunds</a>, or <a href="/contact">ask us a question</a>.</p>
   <a className="backShop" href="/shop">← Continue shopping</a>
  </div>
  {desc.long&&<section className="relatedProducts productLong"><div className="catalogContext"><div><small>ABOUT THIS PRODUCT</small><h2>Description</h2></div></div><div className="aboutText">{desc.long.split(/\n+/).map((t,i)=><p key={i}>{t}</p>)}</div></section>}
  {related.length>0&&<section className="relatedProducts"><div className="catalogContext"><div><small>YOU MAY ALSO LIKE</small><h2>More from KARIA</h2></div><a className="dashLink" href="/shop">SHOP ALL</a></div><div className="catalogGrid">{related.map(x=><ProductCard key={x.id} p={x} add={add}/>)}</div></section>}
  <ProductReviews product={p} products={products} reviews={reviews} user={user} onSignIn={onSignIn} onSaved={onSaved}/>
 </main></div>
}

/* ───────────────────────── REVIEWS ─────────────────────────
   Signed-in customers leave one review per product (1–5 stars + text). Admin can hide or delete them. */
export const ratingOf=list=>list.length?list.reduce((s,r)=>s+Number(r.rating||0),0)/list.length:0;
export function Stars({value=0,size=14}){
 const full=Math.round(value);
 return <span className="stars" role="img" aria-label={`${Number(value).toFixed(1)} out of 5 stars`}>{[1,2,3,4,5].map(i=><Star key={i} width={size} height={size} className={i<=full?"on":""} aria-hidden="true"/>)}</span>
}
function ReviewForm({products,productId,user,onSignIn,onSaved}){
 const [rating,setRating]=useState(5),[state,setState]=useState(""),[pid,setPid]=useState(productId||"");
 if(!user)return <div className="checkoutForm reviewForm"><h2>Write a review</h2><p className="reviewHint">Sign in to your KARIA account to leave a review.</p><button type="button" className="checkoutPay" onClick={onSignIn}>SIGN IN <ArrowRight/></button></div>;
 const submit=async e=>{e.preventDefault();const form=e.currentTarget,f=Object.fromEntries(new FormData(form)),product_id=productId||pid;if(!product_id||!supabase){setState("error");return}setState("busy");
  // one review per customer and product: sending again replaces the earlier one
  const {error}=await supabase.from("product_reviews").upsert({product_id,user_id:user.id,author_name:String(f.author_name).trim(),rating,body:String(f.body).trim()},{onConflict:"product_id,user_id"});
  // RLS only lets customers who bought the bag write a review
  if(error){setState(error.code==="42501"?"buyers":"error");return}form.reset();setState("ok");onSaved?.()};
 return <form className="checkoutForm reviewForm" onSubmit={submit}><h2>Write a review</h2>
  {!productId&&<label>Product<select value={pid} onChange={e=>setPid(e.target.value)} required><option value="">Choose a product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
  <div className="starPick" role="radiogroup" aria-label="Your rating"><span>YOUR RATING</span><div>{[1,2,3,4,5].map(i=><button type="button" key={i} role="radio" aria-checked={rating===i} aria-label={`${i} star${i>1?"s":""}`} className={i<=rating?"on":""} onClick={()=>setRating(i)}><Star aria-hidden="true"/></button>)}</div></div>
  <label>Name shown with your review<input name="author_name" defaultValue={user.user_metadata?.full_name||""} required maxLength={60}/></label>
  <label>Your review<textarea name="body" rows={5} required minLength={3} maxLength={2000}/></label>
  {state==="ok"&&<p className="checkoutCouponSuccess">Thank you — your review is published.</p>}{state==="error"&&<p className="checkoutError">We could not save your review right now. Please try again later.</p>}{state==="buyers"&&<p className="checkoutError">Reviews are open to customers who bought this bag. Thank you for understanding.</p>}
  <button className="checkoutPay" disabled={state==="busy"}>{state==="busy"?"SENDING…":"PUBLISH REVIEW"} <ArrowRight/></button></form>
}
function ReviewList({reviews,products,showProduct,empty}){
 if(!reviews.length)return <div className="catalogEmpty reviewEmpty"><Stars value={0} size={22}/><b>{empty}</b><span>Reviews come from customers who bought a KARIA bag.</span></div>;
 const name=id=>products.find(p=>p.id===id)?.name;
 return <div className="reviewList">{reviews.map(r=><article className="reviewItem" key={r.id}>
  <div className="reviewTop"><Stars value={r.rating} size={16}/><span>{r.created_at?new Date(r.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):""}</span></div>
  <p>{r.body}</p>
  <div className="reviewBy"><b>{r.author_name||"KARIA customer"}</b>{showProduct&&name(r.product_id)&&<a href={`/product/${r.product_id}`}>{name(r.product_id)}</a>}</div>
 </article>)}</div>
}
function ReviewSummary({reviews}){
 if(!reviews.length)return null;
 return <div className="reviewSummary"><strong>{ratingOf(reviews).toFixed(1)}</strong><div><Stars value={ratingOf(reviews)} size={18}/><span>{reviews.length} review{reviews.length===1?"":"s"}</span></div></div>
}
// Reviews of one product, shown at the bottom of its page.
export function ProductReviews({product,products,reviews,user,onSignIn,onSaved}){
 const mine=reviews.filter(r=>r.product_id===product.id);
 return <section className="relatedProducts productReviews" id="reviews"><div className="catalogContext"><div><small>CUSTOMER REVIEWS</small><h2>What customers say</h2></div><ReviewSummary reviews={mine}/></div>
  <div className="reviewGrid"><ReviewList reviews={mine} products={products} empty="No reviews yet. Be the first to review this product."/><ReviewForm products={products} productId={product.id} user={user} onSignIn={onSignIn} onSaved={onSaved}/></div></section>
}
// Every review in the store, on its own page.
export function ReviewsPage({Header,products,reviews,user,onSignIn,onSaved,theme}){
 if(theme==="noir"){
  const n=reviews.length,prod=id=>products.find(p=>p.id===id);
  return <div className="catalogPage">{Header}<main className="bqMain"><BqHero eyebrow="Reviews" title={n?"Loved by our customers":"Customer reviews"} lead="Real words from people who carry a KARIA bag."/>
   {n?<div className="bqSum"><div><b>{ratingOf(reviews).toFixed(1)}</b>Average</div><div><b>{n}</b>{n===1?"Review":"Reviews"}</div><div><b>100%</b>Verified buyers</div></div>
    :<div className="bqSum bqEmpty"><Stars value={0} size={22}/><b>No reviews yet</b><span>Reviews come from customers who bought a KARIA bag.</span></div>}
   <div className={`bqRv${n?"":" solo"}`}>{reviews.map(r=>{const p=prod(r.product_id);return <article className="bqRcard" key={r.id}><Stars value={r.rating} size={16}/><p className="bqQ">“{r.body}”</p>
     <div className="bqBy">{p&&<img src={closeUp(p)} alt=""/>}<div><b>{r.author_name||"KARIA customer"}</b>{p&&<a href={`/product/${p.id}`}>{p.name}</a>}</div></div></article>})}
    <div className="bqRcard bqWrite"><h2>Bought a bag?</h2><p className="bqWriteLead">Tell other customers what you think.</p><ReviewForm products={products} user={user} onSignIn={onSignIn} onSaved={onSaved}/></div></div>
  </main></div>
 }
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>FROM OUR CUSTOMERS</small><h1>Reviews.</h1><p>Real words from people who carry a KARIA bag.</p></div>
  <div className="catalogContext"><div><small>ALL PRODUCTS</small><h2>Customer reviews</h2></div><ReviewSummary reviews={reviews}/></div>
  <div className="reviewGrid"><ReviewList reviews={reviews} products={products} showProduct empty="No reviews yet. Be the first to leave one."/><ReviewForm products={products} user={user} onSignIn={onSignIn} onSaved={onSaved}/></div>
 </main></div>
}

/* ───────────────────────── MY ORDERS ───────────────────────── */
const STATUS_TEXT={paid:"Payment received — we are preparing your order.",processing:"We are preparing your order.",shipped:"Your order is on its way.",delivered:"Delivered.",cancelled:"This order was cancelled.",refunded:"This order was refunded."};
/* Returns (V7.58): the customer asks in 3 steps; the database (karia_can_return + RLS) is the real guard. */
const RETURN_REASONS=["Changed my mind","Color looks different","Arrived damaged","Wrong item"];
const RETURN_FLOW=["requested","approved","received","refunded"];
const RETURN_STEP={requested:"Requested",approved:"Approved — return label",received:"Bag received",refunded:"Refunded",declined:"Declined"};
// Returns policy: KARIA pays return shipping only when the bag arrived damaged or wrong.
export const kariaPaysReturn=reason=>reason==="Arrived damaged"||reason==="Wrong item";
const itemName=it=>it.customization?`Custom Bag · ${it.customization.style_name||""}`:it.products?.name||"Product";
const longDay=v=>v?new Date(v).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"";
// Photos are redrawn as JPEG, 1600 px at most on the long side (the bucket takes JPEG only, 5 MB max).
async function toJpeg(file){
 const img=await createImageBitmap(file),k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement("canvas");
 c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);img.close?.();
 const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.85));if(!blob)throw new Error("no blob");return blob;
}
function ReturnRequest({order,user,onCancel,onSent}){
 const items=(order.order_items||[]).filter(it=>it.id);
 const [step,setStep]=useState(1),[pick,setPick]=useState(()=>items.length===1?{[items[0].id]:1}:{}),[reason,setReason]=useState(""),[note,setNote]=useState(""),[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[err,setErr]=useState("");
 const urls=useMemo(()=>files.map(f=>URL.createObjectURL(f)),[files]);
 useEffect(()=>()=>urls.forEach(u=>URL.revokeObjectURL(u)),[urls]);
 const chosen=items.filter(it=>pick[it.id]);
 const customPicked=chosen.some(it=>it.customization),free=kariaPaysReturn(reason);
 const amount=chosen.reduce((s,it)=>s+pick[it.id]*Number(it.unit_price||0),0);
 const subtotal=Number(order.subtotal)||items.reduce((s,it)=>s+Number(it.qty||0)*Number(it.unit_price||0),0);
 const estimate=amount-(subtotal>0?Number(order.discount_total||0)*amount/subtotal:0);
 const toggle=(it,on)=>setPick(p=>{const n={...p};if(on)n[it.id]=1;else delete n[it.id];return n});
 const send=async()=>{setBusy(true);setErr("");try{
   const folder=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}`,photo_paths=[];
   if(free)for(let i=0;i<files.length;i++){let blob;try{blob=await toJpeg(files[i])}catch{throw new Error(`We could not read the photo "${files[i].name}". Please choose a JPEG or PNG photo.`)}
    const path=`${folder}/${i+1}.jpg`,{error}=await supabase.storage.from("return-photos").upload(path,blob,{contentType:"image/jpeg",upsert:false});if(error)throw new Error("We could not upload your photos. Please try again, or send the request without photos.");photo_paths.push(path)}
   const {error}=await supabase.from("return_requests").insert({order_id:order.id,reason,note:note.trim()||null,photo_paths,items:chosen.map(it=>({order_item_id:it.id,product_id:it.product_id,name:itemName(it),qty:pick[it.id],unit_price:Number(it.unit_price||0)}))});
   if(error)throw new Error(error.code==="23505"?"You already have an open return for this order.":error.code==="42501"?"This order can no longer be returned online. Please contact us and we will help.":error.code==="P0001"?error.message:"We could not send your request right now. Please try again later.");
   onSent();
  }catch(e){setErr(e.message)}finally{setBusy(false)}};
 const nav=(back,next,label="Continue",dis=false)=><div className="rtActs"><button type="button" className="rtBtn ghost" onClick={back}>{step===1?"Cancel":"Back"}</button><button type="button" className="rtBtn" disabled={dis||busy} onClick={next}>{busy?"Sending…":label}</button></div>;
 return <div className="rtPanel"><h3>Request a return</h3>
  <div className="rtSteps">{["1 · Choose bags","2 · Reason","3 · Review"].map((t,i)=><span key={t} className={step===i+1?"on":""}>{t}</span>)}</div>
  {step===1&&<><p className="rtNote">Which bag do you want to return?</p>
   {items.map(it=><label key={it.id} className="rtPick"><input type="checkbox" checked={!!pick[it.id]} onChange={e=>toggle(it,e.target.checked)}/>{mainPhoto(it.products?.product_media)?<img src={mainPhoto(it.products.product_media)} alt=""/>:<span className="rtNoImg"/>}<span className="rtGrow">{itemName(it)}{it.customization&&<small className="rtSmall">Made to order — returnable only if it arrived damaged or wrong</small>}</span>
    {it.qty>1&&pick[it.id]?<select aria-label={`How many ${itemName(it)}`} value={pick[it.id]} onClick={e=>e.preventDefault()} onChange={e=>setPick(p=>({...p,[it.id]:Number(e.target.value)}))}>{Array.from({length:it.qty},(_,i)=><option key={i} value={i+1}>{i+1} of {it.qty}</option>)}</select>:null}<span>{money(it.unit_price)}</span></label>)}
   {nav(onCancel,()=>setStep(2),"Continue",!chosen.length)}</>}
  {step===2&&<><p className="rtNote">Tell us why — it helps us make better bags.</p>
   {customPicked&&<p className="rtNote">Custom bags can be returned only if they arrived damaged or wrong.</p>}
   <div className="rtReasons" role="radiogroup" aria-label="Reason">{RETURN_REASONS.map(r=>{const off=customPicked&&!kariaPaysReturn(r);return <label key={r} className={off?"off":""}><input type="radio" name={`reason-${order.id}`} value={r} checked={reason===r} disabled={off} onChange={()=>setReason(r)}/>{r}</label>})}</div>
   {free&&<div className="rtDrop"><span>Add photos of the bag (helps us approve faster) — up to 3.</span>
    {urls.length>0&&<div className="rtThumbs">{urls.map((u,i)=><figure key={u}><img src={u} alt={`Photo ${i+1}`}/><button type="button" aria-label={`Remove photo ${i+1}`} onClick={()=>setFiles(f=>f.filter((_,j)=>j!==i))}>×</button></figure>)}</div>}
    {files.length<3&&<label className="rtBtn ghost rtFile">+ Add photo<input type="file" accept="image/*" multiple onChange={e=>{const add=Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/")||/\.hei[cf]$/i.test(f.name));e.target.value="";setFiles(f=>[...f,...add].slice(0,3))}}/></label>}</div>}
   <label className="rtNote rtLabel" htmlFor={`rnote-${order.id}`}>Anything else? (optional)</label><textarea id={`rnote-${order.id}`} className="rtText" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/>
   {nav(()=>setStep(1),()=>setStep(3),"Continue",!reason||(customPicked&&!free))}</>}
  {step===3&&<><ul className="rtItems">{chosen.map(it=><li key={it.id}>{mainPhoto(it.products?.product_media)?<img src={mainPhoto(it.products.product_media)} alt=""/>:<span className="rtNoImg"/>}<div><b>{pick[it.id]>1?`${pick[it.id]} × `:""}{itemName(it)}</b><span>{reason}</span></div></li>)}</ul>
   <p className="rtNote">Estimated refund: <b className="rtStrong">{money(estimate)}</b> to your original card after we receive the bag. {free?"We pay the return shipping because the item arrived damaged or wrong.":"Return shipping is paid by you, as our Returns policy says."}</p>
   {err&&<p className="checkoutError" role="alert">{err}</p>}
   {nav(()=>setStep(2),send,"Send return request")}</>}
 </div>
}
function ReturnTracker({ret}){
 const st=ret.status,hist=Array.isArray(ret.history)?ret.history:[],when=s=>{const h=[...hist].reverse().find(x=>x.status===s);return h?new Date(h.at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):""};
 const steps=st==="declined"?["requested","declined"]:RETURN_FLOW,at=steps.indexOf(st);
 return <div className="rtPanel"><h3>Your return</h3><p className="rtNote">{(ret.items||[]).map(x=>`${x.qty>1?x.qty+" × ":""}${x.name}`).join(", ")} · {ret.reason}</p>
  <ol className="rtLine">{steps.map((s,i)=><li key={s} className={`${i<=at?"done":""}${i===at?" now":""}`}><b>{RETURN_STEP[s]}</b>{i<=at&&when(s)}</li>)}</ol>
  {ret.return_tracking&&["approved","received"].includes(st)&&<div className="rtLabelBox"><span>Ship the bag back with the return label we sent you. Tracking:</span><code>{ret.return_tracking}</code></div>}
  {st==="refunded"&&<p className="rtNote">{money(ret.refund_amount)} was refunded to your card. Banks take 5–10 business days to show it.</p>}
  {st==="declined"&&<p className="rtNote">We could not accept this return. <a href="/contact">Contact us</a> if you have any questions.</p>}
 </div>
}
export function OrdersPage({user,Header,onSignIn,info={}}){
 const [orders,setOrders]=useState(null),[error,setError]=useState(""),[returns,setReturns]=useState(null),[opened,setOpened]=useState(null);
 const days=Number(info.returns_days)>0?Number(info.returns_days):14;
 const loadReturns=async()=>{const {data,error}=await supabase.from("return_requests").select("id,order_id,status,items,reason,return_tracking,refund_amount,history,created_at").eq("customer_id",user.id).order("created_at",{ascending:false});setReturns(error?null:data||[])};
 useEffect(()=>{if(!user||!supabase)return;loadReturns()},[user]);
 useEffect(()=>{if(!user||!supabase)return;let live=true;(async()=>{
  let r=await supabase.from("orders").select("id,order_number,status,total,subtotal,discount_total,shipping_total,created_at,carrier,tracking_number,order_items(id,product_id,qty,unit_price,customization,products(name,product_media(url,media_type,sort_order)))").eq("customer_id",user.id).order("created_at",{ascending:false});
  // customers may not be allowed to read order lines; the order itself is enough
  if(r.error)r=await supabase.from("orders").select("id,order_number,status,total,created_at,carrier,tracking_number").eq("customer_id",user.id).order("created_at",{ascending:false});
  if(!live)return;if(r.error)setError(r.error.message);
  // an order that never reached payment is not an order for the customer
  setOrders((r.data||[]).filter(o=>String(o.status).toLowerCase()!=="pending"));
 })();return()=>{live=false}},[user]);
 const body=!user?<div className="catalogEmpty emptyState"><b>Sign in to see your orders.</b><span>Your orders, their status and tracking appear here once you sign in.</span><button className="cta" onClick={onSignIn}>SIGN IN <ArrowRight/></button></div>
  :orders===null?<div className="catalogEmpty">Loading your orders…</div>
  :error?<div className="catalogEmpty">We could not load your orders right now. Please try again later.</div>
  :!orders.length?<div className="catalogEmpty emptyState"><b>No orders yet.</b><span>When you buy a KARIA bag, it appears here with its status and tracking.</span><a className="cta" href="/shop">SHOP KARIA <ArrowRight/></a></div>
  :<div className="myOrders">{orders.map(o=>{const status=String(o.status||"").toLowerCase(),items=o.order_items||[],ret=returns?.find(r=>r.order_id===o.id);
    // shipped or delivered, inside the returns window + 21 days for the trip (same rule as karia_can_return)
    const canReturn=!!returns&&!ret&&items.some(it=>it.id)&&["shipped","delivered"].includes(status)&&Date.now()-new Date(o.created_at).getTime()<(days+21)*864e5;
    return <article className="myOrder" key={o.id}>
    <div className="myOrderHead"><div><small>ORDER</small><h2>#{o.order_number||"—"}</h2></div><div className="rtHeadTags"><span className={`orderStatus ${status}`}>{status.toUpperCase()}</span>{ret&&ret.status!=="refunded"&&<span className={`rtTag ${ret.status}`}>Return · {RETURN_STEP[ret.status].split(" —")[0]}</span>}</div></div>
    <p className="myOrderNote">{STATUS_TEXT[status]||""}</p>
    {items.length>0&&<ul>{items.map(it=><li key={it.id}><span>{it.qty} × {itemName(it)}</span><b>{money(Number(it.qty||0)*Number(it.unit_price||0))}</b></li>)}</ul>}
    <div className="myOrderFoot"><span>{longDay(o.created_at)}</span><b>Total {money(o.total)}</b></div>
    {(o.carrier||o.tracking_number)&&<div className="myOrderTrack"><small>TRACKING</small><b>{[o.carrier,o.tracking_number].filter(Boolean).join(" · ")}</b></div>}
    {canReturn&&opened!==o.id&&<div className="rtStart"><span className="rtNote">Returns are open for {days} days after delivery.</span><button type="button" className="rtBtn ghost" onClick={()=>setOpened(o.id)}>Request a return</button></div>}
    {canReturn&&opened===o.id&&<ReturnRequest order={o} user={user} onCancel={()=>setOpened(null)} onSent={async()=>{await loadReturns();setOpened(null)}}/>}
    {ret&&<ReturnTracker ret={ret}/>}
   </article>})}</div>;
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>MY ACCOUNT</small><h1>My orders.</h1>{user&&<p>{user.email}</p>}</div>{body}</main></div>
}

/* ───────────────────────── CONTACT + ABOUT ───────────────────────── */
// `info` is the "storefront" setting edited in Admin → Settings; nothing is shown until it is filled in.
export function ContactPage({Header,info={},theme}){
 const [state,setState]=useState("");
 const wa=String(info.whatsapp||"").replace(/[^0-9]/g,""),ig=String(info.instagram||"").replace(/^@/,"").trim();
 const submit=async e=>{e.preventDefault();const form=e.currentTarget,f=Object.fromEntries(new FormData(form));if(!supabase){setState("error");return}setState("busy");const {error}=await supabase.from("contact_messages").insert({name:String(f.name).trim(),email:String(f.email).trim().toLowerCase(),message:String(f.message).trim()});if(error){setState("error");return}form.reset();setState("ok")};
 if(theme==="noir"){
  const tiles=[info.contact_email&&["Email",info.contact_email,`mailto:${info.contact_email}`],["Orders","Track your order","/orders"],["Shipping","Rates & delivery","/shipping"],["Returns","Returns & refunds","/returns"],
   wa&&["WhatsApp",info.whatsapp,`https://wa.me/${wa}`,1],ig&&["Instagram",`@${ig}`,`https://instagram.com/${ig}`,1]].filter(Boolean);
  return <div className="catalogPage">{Header}<main className="bqMain"><BqHero eyebrow="Contact" title="We'd love to hear from you" lead="Questions about an order, a bag or anything else — write to us and we will answer as soon as we can."/>
   <div className="bqCt"><form className="bqBox" onSubmit={submit}><h2>Send a message</h2><label>Name<input name="name" required maxLength={120}/></label><label>Email<input name="email" type="email" required maxLength={200}/></label><label>Message<textarea name="message" rows={6} required maxLength={4000}/></label>
     {state==="ok"&&<p className="checkoutCouponSuccess">Thank you — your message was sent.</p>}{state==="error"&&<p className="checkoutError">We could not send your message right now. Please try again later.</p>}
     <button className="bqBtn" disabled={state==="busy"}>{state==="busy"?"Sending…":"Send message"}</button></form>
    <div className="bqTiles">{tiles.map(([k,t,href,ext])=><a key={k} className="bqTile" href={href} {...(ext?{target:"_blank",rel:"noreferrer"}:{})}><span className="bqEye">{k}</span><b>{k==="Email"&&t.includes("@")?<>{t.slice(0,t.indexOf("@"))}<wbr/>{t.slice(t.indexOf("@"))}</>:t}</b></a>)}
     <div className="bqTile wide"><span className="bqEye">Business</span><b>Karia Shop LLC</b></div></div>
   </div></main></div>
 }
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>WE ARE HERE TO HELP</small><h1>Contact us.</h1><p>Questions about an order, a product or anything else — write to us and we will answer as soon as we can.</p></div>
  <div className="contactGrid">
   <form className="checkoutForm" onSubmit={submit}><h2>Send a message</h2><label>Name<input name="name" required maxLength={120}/></label><label>Email<input name="email" type="email" required maxLength={200}/></label><label>Message<textarea name="message" rows={6} required maxLength={4000}/></label>
    {state==="ok"&&<p className="checkoutCouponSuccess">Thank you — your message was sent.</p>}{state==="error"&&<p className="checkoutError">We could not send your message right now. Please try again later.</p>}
    <button className="checkoutPay" disabled={state==="busy"}>{state==="busy"?"SENDING…":"SEND MESSAGE"} <ArrowRight/></button></form>
   <aside className="contactInfo"><small>OTHER WAYS TO REACH US</small>
    {info.contact_email&&<div><span>EMAIL</span><a href={`mailto:${info.contact_email}`}>{info.contact_email}</a></div>}
    {wa&&<div><span>WHATSAPP</span><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">{info.whatsapp}</a></div>}
    {ig&&<div><span>INSTAGRAM</span><a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">@{ig}</a></div>}
    <div><span>YOUR ORDERS</span><a href="/orders">Check status and tracking</a></div>
    <div><span>SHIPPING</span><a href="/shipping">Rates and delivery</a></div>
    <div><span>RETURNS</span><a href="/returns">Returns & refunds</a></div>
    <div><span>BUSINESS</span><b className="contactBiz">Karia Shop LLC</b></div>
   </aside>
  </div></main></div>
}

const ABOUT_DEFAULT=["KARIA makes handmade crochet bags, stitch by stitch, in small batches.","Each piece is made one at a time, so colors and stitches can vary slightly from bag to bag."+(CUSTOMIZE_ON?" With KARIA Atelier you can design your own: pick a style, choose every color, and we make it just for you.":"")];
export function AboutPage({Header,info={},products=[],theme}){
 const text=String(info.about||"").split(/\n+/).map(s=>s.trim()).filter(Boolean);
 // three bags in stock first, for the photo strip
 const pics=[...products].sort((a,b)=>soldOut(a)-soldOut(b)).slice(0,3);
 if(theme==="noir")return <div className="catalogPage">{Header}<main className="bqMain"><BqHero eyebrow="Our story" title="About KARIA"/>
  <blockquote className="bqQuote">{(text.length?text:ABOUT_DEFAULT).map((t,i)=><p key={i}>{t}</p>)}</blockquote>
  {pics.length>0&&<div className="bqStory">{pics.map(p=><figure key={p.id}><a href={`/product/${p.id}`}><img src={closeUp(p)} alt={p.name} loading="lazy"/></a><figcaption>{p.name}</figcaption></figure>)}</div>}
  <div className="bqSum">{products.length>0&&<div><b>{products.length}</b>Colors</div>}<div><b>100%</b>Handmade</div><div><b>2</b>Founders</div></div>
  <div className="bqCta"><a className="bqBtn" href="/shop">Shop the collection</a>{CUSTOMIZE_ON&&<a className="bqBtn ghost" href="/customize">Create your bag</a>}<a className="bqBtn ghost" href="/contact">Contact us</a></div>
 </main></div>;
 return <div className="catalogPage">{Header}<main className="catalogMain aboutMain"><div className="catalogHero"><small>OUR STORY</small><h1>About KARIA.</h1></div>
  <div className="aboutText">{(text.length?text:ABOUT_DEFAULT).map((t,i)=><p key={i}>{t}</p>)}</div>
  {pics.length>0&&<div className="aboutStrip">{pics.map(p=><a key={p.id} href={`/product/${p.id}`}><img src={p.thumb||p.img} alt={p.name} loading="lazy"/><span>{p.name}</span></a>)}</div>}
  <div className="aboutValues">
   <div><b>Made by hand</b><p>Every bag is crocheted stitch by stitch in thick cotton cord. No machines, no shortcuts.</p></div>
   <div><b>Small batches</b><p>We make a few pieces of each color at a time, so every bag gets full attention.</p></div>
   <div><b>Made to last</b><p>Tight stitches, a wrapped handle and gold-tone rings, built for everyday use.</p></div>
  </div>
  <div className="aboutActions"><a className="cta" href="/shop">SHOP KARIA <ArrowRight/></a>{CUSTOMIZE_ON&&<a className="cta" href="/customize">CREATE YOUR BAG <ArrowRight/></a>}<a className="dashLink" href="/contact">CONTACT US</a></div>
 </main></div>
}

/* ───────────────────────── FOOTER ───────────────────────── */
function Newsletter(){
 const [state,setState]=useState("");
 const submit=async e=>{e.preventDefault();const form=e.currentTarget,email=String(new FormData(form).get("email")||"").trim().toLowerCase();if(!email)return;if(!supabase){setState("error");return}setState("busy");const {error}=await supabase.from("newsletter_subscribers").insert({email});if(error&&error.code!=="23505"){setState("error");return}form.reset();setState("ok")};
 return <div className="newsletter"><small>JOIN THE KARIA LETTER</small><p className="newsletterLead">New bags and restocks, by email.</p><form onSubmit={submit}><input name="email" type="email" placeholder="Your email address" aria-label="Your email address" required/><button aria-label="Subscribe" disabled={state==="busy"}>→</button></form>{state==="ok"&&<p className="newsletterNote">Thank you — you are on the list.</p>}{state==="error"&&<p className="newsletterNote">We could not save your email right now. Please try again later.</p>}</div>
}
export function Footer({canAdmin,openAdmin}){
 // three link columns: Shop, Help, Legal (LEGAL = Shipping, Returns, Privacy, Terms)
 return <footer><div><div className="logo">KARIA</div><p>Handmade crochet bags.<br/>Karia Shop LLC.</p></div><div className="footCols">
  <div className="footLinks" role="group" aria-label="Shop"><b className="footHead">Shop</b><a href="/shop">Shop all</a>{CUSTOMIZE_ON&&<a href="/customize">Customize</a>}<a href="/reviews">Reviews</a><a href="/about">About</a></div>
  <div className="footLinks" role="group" aria-label="Help"><b className="footHead">Help</b>{LEGAL.slice(0,2).map(([t,h])=><a key={h} href={h}>{t}</a>)}<a href="/contact">Contact</a><a href="/orders">My orders</a></div>
  <div className="footLinks footLegal" role="group" aria-label="Legal"><b className="footHead">Legal</b>{LEGAL.slice(2).map(([t,h])=><a key={h} href={h}>{t}</a>)}</div>
 </div><Newsletter/>{canAdmin&&<button className="adminLink" onClick={openAdmin}>Admin</button>}<div className="copyright">© 2026 Karia Shop LLC · Handmade crochet bags</div></footer>
}
