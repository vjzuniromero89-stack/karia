// KARIA V7.36 — storefront pages: header, bag, shop, product, my orders, contact, about, footer
import React,{useEffect,useMemo,useState} from "react";
import {ShoppingBag,User,Search,ArrowRight,Menu,X,Play} from "lucide-react";
import {supabase} from "./supabase";

/* ───────────────────────── HELPERS ───────────────────────── */
// Made-to-order custom bags have no stock; everything else sells only what Inventory says is available.
export const soldOut=p=>!p.customization&&Number(p.stock||0)<=0;
const NEW_DAYS=30;
export const isNew=p=>!!p.created_at&&Date.now()-new Date(p.created_at).getTime()<NEW_DAYS*864e5;
export const isVideo=m=>String(m?.media_type||"").startsWith("video")||/\.(mp4|webm)(\?|$)/i.test(m?.url||"");
export const sortedMedia=list=>[...(list||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
// main product photo: first image, never a video
export const mainPhoto=list=>sortedMedia(list).find(m=>!isVideo(m))?.url||"";
const cartKey=p=>p.cartKey||p.id;
const money=n=>`$${Number(n||0).toFixed(2)}`;

/* ───────────────────────── HEADER ───────────────────────── */
// One header for every storefront page: mobile menu, search, account and bag.
export function StoreHeader({cartCount,onCart,onAccount}){
 const [menu,setMenu]=useState(false);
 const close=()=>setMenu(false);
 const links=[["SHOP","/shop"],["CUSTOMIZE","/customize"],["ABOUT","/about"],["CONTACT","/contact"]];
 const here=location.pathname;
 return <><header className={menu?"menuHeaderOpen":""}><button className="icon mobile" aria-label="Menu" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><a className="logo" href="/">KARIA</a>
  <nav className={menu?"open":""}>{links.map(([label,href])=><a key={href} href={href} className={here===href?"current":""} onClick={close}>{label}</a>)}</nav>
  <div className="actions"><a className="iconLink" href="/shop" aria-label="Search products"><Search/></a><button className="accountIcon" aria-label="Account" onClick={onAccount}><User/></button><button className="bag" aria-label="Open bag" onClick={onCart}><ShoppingBag/><b>{cartCount}</b></button></div>
 </header>{menu&&<div className="mobileMenuBackdrop" onClick={close} aria-hidden="true"/>}</>
}

/* ───────────────────────── BAG ───────────────────────── */
// The bag is stored as one entry per piece; here it is shown as one row per product with + / −.
export function CartDrawer({open,setOpen,cart,setCart,checkout,notice,add}){
 if(!open)return null;
 const groups=Object.values(cart.reduce((a,p)=>{const k=cartKey(p);a[k]??={...p,key:k,qty:0};a[k].qty++;return a},{}));
 const removeOne=k=>setCart(c=>{const i=c.map(cartKey).lastIndexOf(k);return i<0?c:c.filter((_,x)=>x!==i)});
 const removeAll=k=>setCart(c=>c.filter(x=>cartKey(x)!==k));
 return <div className="accountBackdrop" onMouseDown={()=>setOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" aria-label="Close" onClick={()=>setOpen(false)}><X/></button><div className="accountBrand">KARIA</div><small className="accountEyebrow">YOUR BAG</small><h2>{cart.length?`${cart.length} piece${cart.length>1?"s":""}`:"Your bag is empty"}</h2>
  {notice&&<p className="cartNotice">{notice}</p>}
  <div className="cartList">{groups.map(p=><div className="cartRow" key={p.key}><img src={p.img} alt=""/><div><b>{p.name}</b><small>{money(p.price)}</small><div className="cartQty"><button aria-label="Remove one" onClick={()=>removeOne(p.key)}>−</button><span>{p.qty}</span><button aria-label="Add one" onClick={()=>add(p)}>+</button></div></div><button className="cartRemove" aria-label={`Remove ${p.name}`} onClick={()=>removeAll(p.key)}>×</button></div>)}</div>
  {cart.length>0?<><div className="cartTotal"><span>Subtotal</span><b>{money(cart.reduce((s,p)=>s+Number(p.price),0))}</b></div><button type="button" className="accountPrimary secureCheckoutBtn" onClick={e=>{e.preventDefault();e.stopPropagation();checkout()}}>SECURE CHECKOUT <ArrowRight/></button></>:<a className="accountPrimary accountLink" href="/shop">SHOP KARIA <ArrowRight/></a>}
 </section></div>
}

/* ───────────────────────── SHOP ───────────────────────── */
export function ProductCard({p,add}){
 const out=soldOut(p);
 return <article className="catalogCard"><a href={`/product/${p.id}`}><div className="catalogImage newArrivalImage"><img src={p.img} alt={p.name} loading="lazy"/>{out?<span className="newBadge soldBadge">SOLD OUT</span>:isNew(p)&&<span className="newBadge">NEW</span>}</div><small>{p.category||p.brand}</small><h2>{p.name}</h2></a><div className="catalogBuy"><b>{money(p.price)}</b><button onClick={()=>add(p)} disabled={out}>{out?"SOLD OUT":"ADD TO BAG"}</button></div></article>
}

// Category "ALL" = everything, "NEW" = registered in the last 30 days, anything else = a category name.
export function ShopPage({products,add,Header,startNew}){
 const params=new URLSearchParams(location.search);
 const [q,setQ]=useState(params.get("q")||""),[sort,setSort]=useState("newest"),[category,setCategory]=useState(startNew?"NEW":params.get("category")||"ALL");
 const categories=useMemo(()=>Array.from(new Set(products.map(p=>String(p.category||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[products]);
 const inCategory=(p,c)=>c==="ALL"||(c==="NEW"?isNew(p):String(p.category||"").toLowerCase()===c.toLowerCase());
 const shown=useMemo(()=>products.filter(p=>inCategory(p,category)&&`${p.name} ${p.brand} ${p.tone} ${p.category||""}`.toLowerCase().includes(q.toLowerCase()))
  .slice().sort((a,b)=>sort==="low"?a.price-b.price:sort==="high"?b.price-a.price:sort==="newest"?new Date(b.created_at||0)-new Date(a.created_at||0):String(a.name).localeCompare(String(b.name))),[products,q,sort,category]);
 const choose=c=>{setCategory(c);history.replaceState({},"",c==="ALL"?"/shop":c==="NEW"?"/new":`/shop?category=${encodeURIComponent(c)}`)};
 const chips=[["ALL","All products"],...(products.some(isNew)||category==="NEW"?[["NEW","New arrivals"]]:[]),...categories.map(c=>[c,c])];
 const title=category==="ALL"?"All products":category==="NEW"?"New arrivals":category;
 return <div className="catalogPage">{Header}
  <main className="catalogMain">
   <div className="catalogHero"><small>KARIA COLLECTION</small><h1>{category==="NEW"?"New at KARIA.":"Shop KARIA."}</h1><p>Fashion, beauty, home, lifestyle and more — curated in one place.</p></div>
   <div className="shopChips">{chips.map(([id,label])=><button key={id} className={category===id?"active":""} onClick={()=>choose(id)}>{label}<b>{products.filter(p=>inCategory(p,id)).length}</b></button>)}</div>
   <section className="shopProducts">
    <div className="catalogTools"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products" aria-label="Search products"/><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort"><option value="newest">Newest</option><option value="name">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="catalogContext"><div><small>{category==="ALL"?"KARIA SHOP":category==="NEW"?"JUST ARRIVED":"CATEGORY"}</small><h2>{title}</h2></div><span>{shown.length} product{shown.length===1?"":"s"}</span></div>
    <div className="catalogGrid">{shown.map(p=><ProductCard key={p.id} p={p} add={add}/>)}</div>
    {!shown.length&&<div className="catalogEmpty">{q?`No products match "${q}".`:category==="NEW"?"Nothing new in the last 30 days.":"No products found in this category."} {category!=="ALL"&&<button className="dashLink" onClick={()=>{setQ("");choose("ALL")}}>SEE ALL PRODUCTS</button>}</div>}
   </section>
  </main></div>
}

/* ───────────────────────── PRODUCT ───────────────────────── */
export function ProductPage({products,id,add,Header}){
 const [sel,setSel]=useState(0),[qty,setQty]=useState(1);
 useEffect(()=>{setSel(0);setQty(1)},[id]);
 const p=products.find(x=>String(x.id)===String(id));
 if(!p)return <div className="catalogPage">{Header}<main className="catalogMain"><div className="catalogHero"><h1>Product not found.</h1><a className="cta" href="/shop">Back to shop <ArrowRight/></a></div></main></div>;
 const media=p.media?.length?p.media:[{url:p.img,media_type:"image"}];
 const cur=media[Math.min(sel,media.length-1)],out=soldOut(p),max=Math.max(1,Number(p.stock||0));
 // same category first, then the rest of the shop
 const related=products.filter(x=>x.id!==p.id).sort((a,b)=>(b.category===p.category)-(a.category===p.category)).slice(0,3);
 return <div className="catalogPage">{Header}<main className="productPage">
  <div className="productGalleryWrap"><div className="productGallery">{isVideo(cur)?<video src={cur.url} controls playsInline muted/>:<img src={cur.url} alt={p.name}/>}</div>
   {media.length>1&&<div className="productThumbs">{media.map((m,i)=><button key={m.url||i} className={i===sel?"on":""} onClick={()=>setSel(i)} aria-label={`View ${i+1} of ${media.length}`}>{isVideo(m)?<span><Play/></span>:<img src={m.url} alt=""/>}</button>)}</div>}
  </div>
  <div className="productInfo"><small>{p.category||p.brand}</small><h1>{p.name}</h1><div className="productPrice">{money(p.price)}</div><p>{p.description||"A KARIA selection chosen for the collection."}</p>
   {p.tone&&<div className="productFact"><span>DETAILS</span><b>{p.tone}</b></div>}
   <div className="productFact"><span>AVAILABILITY</span><b>{out?"Sold out":`${p.stock} available`}</b></div>
   {!out&&<div className="productFact productQty"><span>QUANTITY</span><div className="cartQty"><button aria-label="Less" onClick={()=>setQty(n=>Math.max(1,n-1))}>−</button><span>{qty}</span><button aria-label="More" onClick={()=>setQty(n=>Math.min(max,n+1))}>+</button></div></div>}
   <button className="productAdd" onClick={()=>add(p,qty)} disabled={out}>{out?"SOLD OUT":<>ADD TO BAG · {money(Number(p.price)*qty)} <ArrowRight/></>}</button>
   <a className="backShop" href="/shop">← Continue shopping</a>
  </div>
  {related.length>0&&<section className="relatedProducts"><div className="catalogContext"><div><small>YOU MAY ALSO LIKE</small><h2>More from KARIA</h2></div><a className="dashLink" href="/shop">SHOP ALL</a></div><div className="catalogGrid">{related.map(x=><ProductCard key={x.id} p={x} add={add}/>)}</div></section>}
 </main></div>
}

/* ───────────────────────── MY ORDERS ───────────────────────── */
const STATUS_TEXT={paid:"Payment received — we are preparing your order.",processing:"We are preparing your order.",shipped:"Your order is on its way.",delivered:"Delivered.",cancelled:"This order was cancelled.",refunded:"This order was refunded."};
export function OrdersPage({user,Header,onSignIn}){
 const [orders,setOrders]=useState(null),[error,setError]=useState("");
 useEffect(()=>{if(!user||!supabase)return;let live=true;(async()=>{
  let r=await supabase.from("orders").select("id,order_number,status,total,created_at,carrier,tracking_number,order_items(id,qty,unit_price,customization,products(name))").eq("customer_id",user.id).order("created_at",{ascending:false});
  // customers may not be allowed to read order lines; the order itself is enough
  if(r.error)r=await supabase.from("orders").select("id,order_number,status,total,created_at,carrier,tracking_number").eq("customer_id",user.id).order("created_at",{ascending:false});
  if(!live)return;if(r.error)setError(r.error.message);
  // an order that never reached payment is not an order for the customer
  setOrders((r.data||[]).filter(o=>String(o.status).toLowerCase()!=="pending"));
 })();return()=>{live=false}},[user]);
 const body=!user?<div className="catalogEmpty">Sign in to see your orders. <button className="dashLink" onClick={onSignIn}>SIGN IN</button></div>
  :orders===null?<div className="catalogEmpty">Loading your orders…</div>
  :error?<div className="catalogEmpty">We could not load your orders right now. Please try again later.</div>
  :!orders.length?<div className="catalogEmpty">You have no orders yet. <a className="dashLink" href="/shop">SHOP KARIA</a></div>
  :<div className="myOrders">{orders.map(o=>{const status=String(o.status||"").toLowerCase(),items=o.order_items||[];return <article className="myOrder" key={o.id}>
    <div className="myOrderHead"><div><small>ORDER</small><h2>#{o.order_number||"—"}</h2></div><span className={`orderStatus ${status}`}>{status.toUpperCase()}</span></div>
    <p className="myOrderNote">{STATUS_TEXT[status]||""}</p>
    {items.length>0&&<ul>{items.map(it=><li key={it.id}><span>{it.qty} × {it.customization?`Custom Bag · ${it.customization.style_name||""}`:it.products?.name||"Product"}</span><b>{money(Number(it.qty||0)*Number(it.unit_price||0))}</b></li>)}</ul>}
    <div className="myOrderFoot"><span>{o.created_at?new Date(o.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):""}</span><b>Total {money(o.total)}</b></div>
    {(o.carrier||o.tracking_number)&&<div className="myOrderTrack"><small>TRACKING</small><b>{[o.carrier,o.tracking_number].filter(Boolean).join(" · ")}</b></div>}
   </article>})}</div>;
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>MY ACCOUNT</small><h1>My orders.</h1>{user&&<p>{user.email}</p>}</div>{body}</main></div>
}

/* ───────────────────────── CONTACT + ABOUT ───────────────────────── */
// `info` is the "storefront" setting edited in Admin → Settings; nothing is shown until it is filled in.
export function ContactPage({Header,info={}}){
 const [state,setState]=useState("");
 const wa=String(info.whatsapp||"").replace(/[^0-9]/g,""),ig=String(info.instagram||"").replace(/^@/,"").trim();
 const submit=async e=>{e.preventDefault();const form=e.currentTarget,f=Object.fromEntries(new FormData(form));if(!supabase){setState("error");return}setState("busy");const {error}=await supabase.from("contact_messages").insert({name:String(f.name).trim(),email:String(f.email).trim().toLowerCase(),message:String(f.message).trim()});if(error){setState("error");return}form.reset();setState("ok")};
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>WE ARE HERE TO HELP</small><h1>Contact us.</h1><p>Questions about an order, a custom bag or anything else — write to us and we will answer as soon as we can.</p></div>
  <div className="contactGrid">
   <form className="checkoutForm" onSubmit={submit}><h2>Send a message</h2><label>Name<input name="name" required maxLength={120}/></label><label>Email<input name="email" type="email" required maxLength={200}/></label><label>Message<textarea name="message" rows={6} required maxLength={4000}/></label>
    {state==="ok"&&<p className="checkoutCouponSuccess">Thank you — your message was sent.</p>}{state==="error"&&<p className="checkoutError">We could not send your message right now. Please try again later.</p>}
    <button className="checkoutPay" disabled={state==="busy"}>{state==="busy"?"SENDING…":"SEND MESSAGE"} <ArrowRight/></button></form>
   <aside className="contactInfo"><small>OTHER WAYS TO REACH US</small>
    {info.contact_email&&<div><span>EMAIL</span><a href={`mailto:${info.contact_email}`}>{info.contact_email}</a></div>}
    {wa&&<div><span>WHATSAPP</span><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">{info.whatsapp}</a></div>}
    {ig&&<div><span>INSTAGRAM</span><a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">@{ig}</a></div>}
    <div><span>YOUR ORDERS</span><a href="/orders">Check status and tracking</a></div>
   </aside>
  </div></main></div>
}

const ABOUT_DEFAULT=["KARIA is one store with many worlds — fashion, beauty, home and lifestyle pieces chosen one by one.","Our handmade bags are crocheted by hand in small batches. With KARIA Atelier you can design your own: pick a style, choose every color, and we make it just for you."];
export function AboutPage({Header,info={}}){
 const text=String(info.about||"").split(/\n+/).map(s=>s.trim()).filter(Boolean);
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>OUR STORY</small><h1>About KARIA.</h1></div>
  <div className="aboutText">{(text.length?text:ABOUT_DEFAULT).map((t,i)=><p key={i}>{t}</p>)}</div>
  <div className="aboutActions"><a className="cta" href="/shop">SHOP KARIA <ArrowRight/></a><a className="cta" href="/customize">CREATE YOUR BAG <ArrowRight/></a></div>
 </main></div>
}

/* ───────────────────────── FOOTER ───────────────────────── */
function Newsletter(){
 const [state,setState]=useState("");
 const submit=async e=>{e.preventDefault();const form=e.currentTarget,email=String(new FormData(form).get("email")||"").trim().toLowerCase();if(!email)return;if(!supabase){setState("error");return}setState("busy");const {error}=await supabase.from("newsletter_subscribers").insert({email});if(error&&error.code!=="23505"){setState("error");return}form.reset();setState("ok")};
 return <div className="newsletter"><small>JOIN THE KARIA LETTER</small><form onSubmit={submit}><input name="email" type="email" placeholder="Your email address" required/><button aria-label="Subscribe" disabled={state==="busy"}>→</button></form>{state==="ok"&&<p className="newsletterNote">Thank you — you are on the list.</p>}{state==="error"&&<p className="newsletterNote">We could not save your email right now. Please try again later.</p>}</div>
}
export function Footer({canAdmin,openAdmin}){
 return <footer><div><div className="logo">KARIA</div><p>Fashion, beauty, home, lifestyle & more.<br/>Curated by KARIA.</p></div><div className="footLinks"><a href="/shop">Shop</a><a href="/customize">Customize</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/orders">My orders</a></div><Newsletter/>{canAdmin&&<button className="adminLink" onClick={openAdmin}>Admin</button>}<div className="copyright">© 2026 KARIA · ONE STORE · MANY WORLDS</div></footer>
}
