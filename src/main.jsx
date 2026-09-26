import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {Canvas,useFrame} from "@react-three/fiber";
import {Image as DreiImage,Float,Environment} from "@react-three/drei";
import * as THREE from "three";
import {ShoppingBag,User,Search,ArrowRight,Menu,X,Play,MoveDown,Package,Wallet,Users,Boxes,BarChart3,Settings,ShieldCheck} from "lucide-react";
import "./style.css";
import {supabase,configured} from "./supabase";

const products=[
 {id:1,name:"Terra Woven Bag",brand:"Independent Artisan",price:118,img:"/products/bag-brown.jpg",stock:4,tone:"Cocoa / Ivory"},
 {id:2,name:"Midnight Woven Bag",brand:"Independent Artisan",price:126,img:"/products/bag-blue.jpg",stock:3,tone:"Midnight Blue"},
 {id:3,name:"Signature Handwoven",brand:"Independent Artisan",price:132,img:"/products/bag-detail.jpg",stock:2,tone:"Artisan Edition"},
];

function HeroScene({progress,items=[]}){
 const group=useRef(),ringA=useRef(),ringB=useRef();
 const fallback=["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"];
 const imgs=(items.length?items.map(x=>x.img):fallback).filter(Boolean).slice(0,5);
 while(imgs.length<5)imgs.push(fallback[imgs.length%fallback.length]);
 useFrame((state,delta)=>{
  const t=state.clock.elapsedTime,p=progress.current;
  if(group.current){group.current.rotation.y=THREE.MathUtils.lerp(group.current.rotation.y,state.pointer.x*.16+p*.72,.035);group.current.rotation.x=THREE.MathUtils.lerp(group.current.rotation.x,-state.pointer.y*.08,.035);group.current.position.y=Math.sin(t*.45)*.05-p*.32;}
  if(ringA.current)ringA.current.rotation.z+=delta*.055;
  if(ringB.current)ringB.current.rotation.z-=delta*.035;
 });
 const cards=[[-1.8,.85,.25,-.12,1.45,1.85],[.15,.15,.85,.05,1.7,2.2],[1.85,-.8,.05,.11,1.3,1.7],[-1.1,-1.25,-.25,.08,1.1,1.45],[1.45,1.3,-.45,-.08,1.0,1.35]];
 return <><ambientLight intensity={1.7}/><directionalLight position={[3,5,5]} intensity={2.3}/><group ref={group}>
  <mesh ref={ringA} position={[0,0,-1.4]} rotation={[1.18,.05,.2]}><torusGeometry args={[2.55,.012,16,180]}/><meshStandardMaterial color="#bda17e" metalness={.7} roughness={.3}/></mesh>
  <mesh ref={ringB} position={[0,0,-1.55]} rotation={[1.38,.3,-.25]}><torusGeometry args={[3.25,.008,16,180]}/><meshStandardMaterial color="#8d765d" metalness={.55} roughness={.45}/></mesh>
  {cards.map((c,i)=><Float key={i} speed={.75+i*.12} rotationIntensity={.12} floatIntensity={.28}><DreiImage url={imgs[i]} transparent position={[c[0],c[1],c[2]]} rotation={[0,0,c[3]]} scale={[c[4],c[5],1]} radius={.06}/></Float>)}
  <Float speed={1.2} floatIntensity={.5}><mesh position={[2.55,.75,.45]}><sphereGeometry args={[.09,24,24]}/><meshStandardMaterial color="#f5dfbe" metalness={.5}/></mesh></Float>
 </group><Environment preset="studio"/></>;
}

function StoreHeader({cartCount,onCart}){
 return <header><a className="logo" href="/">KARIA</a><nav><a href="/shop">SHOP</a><a href="/new">NEW</a><a href="/#contact">CONTACT</a></nav><div className="actions"><a className="iconLink" href="/shop"><Search/></a><button className="bag" onClick={onCart}><ShoppingBag/><b>{cartCount}</b></button></div></header>
}
function CartDrawer({open,setOpen,cart,setCart,checkout}){
 if(!open)return null;return <div className="accountBackdrop" onMouseDown={()=>setOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setOpen(false)}><X/></button><div className="accountBrand">KARIA</div><small className="accountEyebrow">YOUR BAG</small><h2>{cart.length?`${cart.length} piece${cart.length>1?'s':''}`:'Your bag is empty'}</h2><div className="cartList">{cart.map((p,i)=><div className="cartRow" key={`${p.id}-${i}`}><img src={p.img}/><div><b>{p.name}</b><small>${Number(p.price).toFixed(2)}</small></div><button onClick={()=>setCart(c=>c.filter((_,x)=>x!==i))}>×</button></div>)}</div>{cart.length>0&&<><div className="cartTotal"><span>Total</span><b>${cart.reduce((s,p)=>s+Number(p.price),0).toFixed(2)}</b></div><button type="button" className="accountPrimary secureCheckoutBtn" onClick={(e)=>{e.preventDefault();e.stopPropagation();checkout()}}>SECURE CHECKOUT <ArrowRight/></button></>}</section></div>
}
function ShopPage({products,add,cart,setCart,cartOpen,setCartOpen,checkout}){
 const initialCategory=new URLSearchParams(location.search).get('category')||'ALL';
 const [q,setQ]=useState(''),[sort,setSort]=useState('newest'),[category,setCategory]=useState(initialCategory);
 const categories=useMemo(()=>Array.from(new Set(products.map(p=>String(p.category||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[products]);
 const shown=useMemo(()=>products.filter(p=>{
   const matchesCategory=category==='ALL'||String(p.category||'').toLowerCase()===category.toLowerCase();
   const matchesSearch=`${p.name} ${p.brand} ${p.tone} ${p.category||''}`.toLowerCase().includes(q.toLowerCase());
   return matchesCategory&&matchesSearch;
  }).slice().sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:sort==='newest'?new Date(b.created_at||0)-new Date(a.created_at||0):String(a.name).localeCompare(String(b.name))),[products,q,sort,category]);
 const chooseCategory=c=>{setCategory(c);const u=c==='ALL'?'/shop':`/shop?category=${encodeURIComponent(c)}`;history.replaceState({},'',u)};
 return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout}/>
  <main className="catalogMain">
   <div className="catalogHero"><small>KARIA COLLECTION</small><h1>Explore KARIA.</h1><p>Fashion, beauty, home, lifestyle and more — curated in one place.</p></div>
   <div className="shopLayout">
    <aside className="categorySidebar">
     <div className="categorySidebarTitle"><small>SHOP BY</small><h2>Categories</h2></div>
     <button className={category==='ALL'?'active':''} onClick={()=>chooseCategory('ALL')}><span>All products</span><b>{products.length}</b></button>
     {categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>chooseCategory(c)}><span>{c}</span><b>{products.filter(p=>String(p.category||'').toLowerCase()===c.toLowerCase()).length}</b></button>)}
     {!categories.length&&<p className="categoryHint">Categories will appear here automatically as you assign them to products in Admin.</p>}
    </aside>
    <section className="shopProducts">
     <div className="catalogTools"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products"/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest</option><option value="name">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
     <div className="catalogContext"><div><small>{category==='ALL'?'KARIA SHOP':'CATEGORY'}</small><h2>{category==='ALL'?'All products':category}</h2></div><span>{shown.length} product{shown.length===1?'':'s'}</span></div>
     <div className="catalogGrid">{shown.map(p=><article className="catalogCard" key={p.id}><a href={`/product/${p.id}`}><div className="catalogImage"><img src={p.img}/></div><small>{p.category||p.brand}</small><h2>{p.name}</h2></a><div className="catalogBuy"><b>${Number(p.price).toFixed(2)}</b><button onClick={()=>add(p)}>ADD TO BAG</button></div></article>)}</div>
     {!shown.length&&<div className="catalogEmpty">No products found in this category.</div>}
    </section>
   </div>
  </main></div>
}

function NewPage({products,add,cart,setCart,cartOpen,setCartOpen,checkout}){
 const newest=useMemo(()=>products.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)),[products]);
 return <div className="catalogPage newPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout}/>
  <main className="catalogMain">
   <div className="newPageHero"><small>JUST ARRIVED</small><h1>New at KARIA.</h1><p>The latest products registered in KARIA, shown newest first.</p></div>
   <div className="newPageRule"><span>LATEST ARRIVALS</span><b>{newest.length}</b></div>
   <div className="catalogGrid newPageGrid">{newest.map((p,i)=><article className="catalogCard" key={p.id}><a href={`/product/${p.id}`}><div className="catalogImage newArrivalImage"><img src={p.img}/><span className="newBadge">NEW</span></div><small>{p.category||p.brand}</small><h2>{p.name}</h2></a><div className="catalogBuy"><b>${Number(p.price).toFixed(2)}</b><button onClick={()=>add(p)}>ADD TO BAG</button></div></article>)}</div>
   {!newest.length&&<div className="catalogEmpty">New products will appear here automatically when they are registered.</div>}
  </main>
 </div>
}
function ProductPage({products,id,add,cart,setCart,cartOpen,setCartOpen,checkout}){
 const p=products.find(x=>String(x.id)===String(id));
 if(!p)return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><main className="catalogMain"><div className="catalogHero"><h1>Product not found.</h1><a className="cta" href="/shop">Back to shop <ArrowRight/></a></div></main></div>;
 return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout}/><main className="productPage"><div className="productGallery"><img src={p.img}/></div><div className="productInfo"><small>{p.brand}</small><h1>{p.name}</h1><div className="productPrice">${Number(p.price).toFixed(2)}</div><p>{p.description||'A KARIA selection chosen for the collection.'}</p>{p.tone&&<div className="productFact"><span>DETAILS</span><b>{p.tone}</b></div>}<div className="productFact"><span>AVAILABILITY</span><b>{p.stock>0?`${p.stock} available`:'Made in limited quantities'}</b></div><button className="productAdd" onClick={()=>add(p)}>ADD TO BAG <ArrowRight/></button><a className="backShop" href="/shop">← Continue shopping</a></div></main></div>
}


function CheckoutSuccessPage({setCart}){
 useEffect(()=>{setCart([]);try{localStorage.removeItem('karia_cart')}catch{}},[setCart]);
 let pending={};try{pending=JSON.parse(sessionStorage.getItem('karia_pending_order')||'{}')}catch{}
 return <div className="catalogPage"><StoreHeader cartCount={0} onCart={()=>{}}/><main className="checkoutPage"><section className="checkoutSuccess"><small>PAYMENT RECEIVED</small><h1>Thank you.</h1><p>Your Stripe payment was submitted successfully{pending.order_number?<> for KARIA order <b>#{pending.order_number}</b></>:'.'}.</p>{pending.total!=null&&<div className="checkoutSuccessTotal"><span>Total</span><b>${Number(pending.total||0).toFixed(2)}</b></div>}<p className="checkoutPending">Stripe is confirming the payment with KARIA. Your order will update automatically through the secure webhook.</p><a className="accountPrimary checkoutLink" href="/shop">CONTINUE SHOPPING <ArrowRight/></a></section></main></div>
}
function CheckoutPage({cart,setCart,user}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[created,setCreated]=useState(null);
 const grouped=useMemo(()=>Object.values(cart.reduce((a,p)=>{a[p.id]??={...p,qty:0};a[p.id].qty++;return a},{})),[cart]);
 const subtotal=grouped.reduce((sum,p)=>sum+Number(p.price||0)*p.qty,0);
 const submit=async(e)=>{e.preventDefault();if(busy||created)return;setNotice('');if(!user){setNotice('Please sign in before continuing to payment.');return}if(!supabase){setNotice('Supabase is not configured.');return}if(!user){setNotice('Please sign in before placing the order.');return}if(!grouped.length){setNotice('Your bag is empty.');return}setBusy(true);try{const f=Object.fromEntries(new FormData(e.currentTarget));const items=grouped.map(p=>({product_id:p.id,qty:p.qty,quantity:p.qty}));const shipping_address={full_name:f.full_name,address1:f.address1,address2:f.address2||'',city:f.city,state:f.state,postal_code:f.postal_code,country:f.country,phone:f.phone||''};const {data,error}=await supabase.functions.invoke('create-checkout',{body:{items,shipping_address:shipping_address,coupon_code:f.coupon_code||null}});if(error){let msg=error.message;try{const ctx=error.context;if(ctx&&typeof ctx.json==='function'){const body=await ctx.json();msg=body?.error||body?.message||msg}}catch{}throw new Error(msg)}if(!data?.ok)throw new Error(data?.error||'Checkout could not be created.');if(!data?.checkout_url)throw new Error('Stripe Checkout URL was not returned.');sessionStorage.setItem('karia_pending_order',JSON.stringify({order_id:data.order_id,order_number:data.order_number,total:data.total}));window.location.assign(data.checkout_url);return;}catch(err){setNotice(err?.message||'Checkout could not be created.')}finally{setBusy(false)}};
 if(created)return <div className="catalogPage"><StoreHeader cartCount={0} onCart={()=>{}}/><main className="checkoutPage"><section className="checkoutSuccess"><small>ORDER RECEIVED</small><h1>Thank you.</h1><p>Your KARIA order <b>#{created.order_number||String(created.order_id||'').slice(0,8)}</b> was created successfully.</p><div className="checkoutSuccessTotal"><span>Total</span><b>${Number(created.total||0).toFixed(2)}</b></div><p className="checkoutPending">Payment is still pending. Stripe payment will be connected in the next checkout step.</p><a className="accountPrimary checkoutLink" href="/shop">CONTINUE SHOPPING <ArrowRight/></a></section></main></div>;
 return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>location.href='/shop'}/><main className="checkoutPage"><div className="checkoutIntro"><small>SECURE CHECKOUT</small><h1>Complete your order.</h1><p>Enter your shipping details to continue with your KARIA order.</p></div><div className="checkoutGrid"><form className="checkoutForm" onSubmit={submit}><h2>Shipping details</h2><label>Full name<input name="full_name" required/></label><label>Email<input value={user?.email||''} readOnly placeholder={user?'':'Sign in to continue'}/></label>{!user&&<div className="checkoutAuthNotice">Please sign in to your KARIA account before submitting the order. You can still review your bag and shipping form here.</div>}<label>Address<input name="address1" required/></label><label>Apartment / suite<input name="address2"/></label><div className="checkoutTwo"><label>City<input name="city" required/></label><label>State / Province<input name="state" required/></label></div><div className="checkoutTwo"><label>ZIP / Postal code<input name="postal_code" required/></label><label>Country<select name="country" defaultValue="US"><option value="US">United States</option><option value="NI">Nicaragua</option><option value="SV">El Salvador</option><option value="OTHER">Other</option></select></label></div><label>Phone<input name="phone" type="tel"/></label><label>Coupon code<input name="coupon_code" placeholder="Optional"/></label>{notice&&<p className="checkoutError">{notice}</p>}<button className="checkoutPay" disabled={busy||!cart.length||!user}>{busy?'CREATING ORDER…':user?'CONTINUE TO PAYMENT':'SIGN IN REQUIRED'} <ArrowRight/></button><a className="checkoutBack" href="/shop">← Return to shop</a></form><aside className="checkoutSummary"><small>YOUR ORDER</small><h2>{cart.length} piece{cart.length===1?'':'s'}</h2>{grouped.map(p=><div className="checkoutItem" key={p.id}><img src={p.img}/><div><b>{p.name}</b><span>Qty {p.qty}</span></div><strong>${(Number(p.price)*p.qty).toFixed(2)}</strong></div>)}<div className="checkoutLine"><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div><div className="checkoutLine muted"><span>Shipping</span><span>Calculated next</span></div><div className="checkoutLine muted"><span>Tax</span><span>Calculated next</span></div><div className="checkoutTotal"><span>Total before shipping & tax</span><b>${subtotal.toFixed(2)}</b></div></aside></div></main></div>
}

function App(){
 useEffect(()=>{
  if('scrollRestoration' in window.history)window.history.scrollRestoration='manual';
  const goTop=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
  goTop();
  const id=requestAnimationFrame(goTop);
  window.addEventListener('pageshow',goTop);
  return()=>{cancelAnimationFrame(id);window.removeEventListener('pageshow',goTop)};
 },[]);
 const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('karia_cart')||'[]')}catch{return []}}),[admin,setAdmin]=useState(false),[menu,setMenu]=useState(false),[active,setActive]=useState(0),[cartOpen,setCartOpen]=useState(false),[storeProducts,setStoreProducts]=useState(products);
 const [accountOpen,setAccountOpen]=useState(false),[user,setUser]=useState(null),[profile,setProfile]=useState(null),[authMode,setAuthMode]=useState("signin"),[authError,setAuthError]=useState(""),[passwordOpen,setPasswordOpen]=useState(false),[passwordNotice,setPasswordNotice]=useState("");
 const progress=useRef(0);
 const add=p=>{setCart(c=>[...c,p]);setCartOpen(true)};
 useEffect(()=>{if(!supabase)return; (async()=>{const [{data},{data:stockRows}]=await Promise.all([supabase.from("products").select("id,name,price,sku,materials,dimensions,description,brand_id,category,created_at,product_media(url,sort_order)").eq("active",true).order("created_at",{ascending:false}),supabase.from("product_stock").select("*")]);const stockMap=Object.fromEntries((stockRows||[]).map(r=>[r.product_id,Number(r.stock??r.quantity??r.qty??0)]));setStoreProducts((data||[]).map((p,i)=>({id:p.id,name:p.name,brand:"KARIA Artisan",price:Number(p.price),img:p.product_media?.sort((a,b)=>a.sort_order-b.sort_order)?.[0]?.url||products[i%products.length].img,stock:stockMap[p.id]||0,tone:p.materials||p.dimensions||"Handcrafted",description:p.description||"",category:p.category||"",created_at:p.created_at||""})))})()},[]);
 const checkout=()=>{if(!cart.length)return;try{localStorage.setItem('karia_cart',JSON.stringify(cart))}catch{}setCartOpen(false);window.location.assign('/checkout')};
 useEffect(()=>{try{localStorage.setItem('karia_cart',JSON.stringify(cart))}catch{}},[cart]);
 const loadProfile=async(u)=>{if(!u||!supabase){setProfile(null);return} const {data}=await supabase.from("profiles").select("id,full_name,role,disabled").eq("id",u.id).single(); setProfile(data||null)};
 useEffect(()=>{if(!supabase)return; supabase.auth.getSession().then(({data})=>{const u=data.session?.user||null;setUser(u);loadProfile(u);if(u?.user_metadata?.must_change_password)setPasswordOpen(true)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;setUser(u);loadProfile(u);if(u?.user_metadata?.must_change_password)setPasswordOpen(true)});return()=>subscription.unsubscribe()},[]);
 const submitAuth=async(e)=>{e.preventDefault();setAuthError("");if(!supabase){setAuthError("Supabase is not configured.");return}const fd=new FormData(e.currentTarget),email=String(fd.get("email")||""),password=String(fd.get("password")||"");let r;if(authMode==="signup")r=await supabase.auth.signUp({email,password,options:{data:{full_name:String(fd.get("name")||"")}}});else r=await supabase.auth.signInWithPassword({email,password});if(r.error)setAuthError(r.error.message);else if(authMode==="signup")setAuthError("Check your email to confirm your account.");else {const u=r.data?.user;if(u?.user_metadata?.must_change_password){setUser(u);setAccountOpen(false);setPasswordOpen(true)}else setAccountOpen(false)}};
 const mustChangePassword=!!user?.user_metadata?.must_change_password;
 const changePassword=async(e)=>{e.preventDefault();setPasswordNotice("");if(!supabase)return;const fd=new FormData(e.currentTarget),password=String(fd.get("new_password")||""),confirm=String(fd.get("confirm_password")||"");if(password.length<8){setPasswordNotice("Password must be at least 8 characters.");return}if(password!==confirm){setPasswordNotice("Passwords do not match.");return}const {data,error}=await supabase.auth.updateUser({password,data:{...user?.user_metadata,must_change_password:false}});if(error){setPasswordNotice(error.message);return}if(data?.user)setUser(data.user);setPasswordNotice("Password updated successfully.");e.currentTarget.reset();setTimeout(()=>setPasswordOpen(false),700)};
 const signOut=async()=>{await supabase?.auth.signOut();setAccountOpen(false);setPasswordOpen(false);setAdmin(false)};
 const canAdmin=["staff","admin","super_admin"].includes(profile?.role);
 useEffect(()=>{const fn=()=>{const max=Math.max(innerHeight,document.documentElement.scrollHeight-innerHeight);const p=scrollY/max;progress.current=p;document.documentElement.style.setProperty("--sy",scrollY+"px");document.documentElement.style.setProperty("--sp",p)};fn();addEventListener("scroll",fn,{passive:true});return()=>removeEventListener("scroll",fn)},[]);
 if(admin) return <Admin back={()=>setAdmin(false)}/>;
 const path=location.pathname;
 if(path==="/checkout/success") return <CheckoutSuccessPage setCart={setCart}/>;
 if(path==="/checkout") return <CheckoutPage cart={cart} setCart={setCart} user={user}/>;
 if(path==="/shop") return <ShopPage products={storeProducts} add={add} cart={cart} setCart={setCart} cartOpen={cartOpen} setCartOpen={setCartOpen} checkout={checkout}/>;
 if(path==="/new") return <NewPage products={storeProducts} add={add} cart={cart} setCart={setCart} cartOpen={cartOpen} setCartOpen={setCartOpen} checkout={checkout}/>;
 if(path.startsWith("/product/")) return <ProductPage products={storeProducts} id={decodeURIComponent(path.split("/").pop())} add={add} cart={cart} setCart={setCart} cartOpen={cartOpen} setCartOpen={setCartOpen} checkout={checkout}/>;
 return <div className="site">
  <header className={menu?"menuHeaderOpen":""}><button className="icon mobile" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><a className="logo" href="#top">KARIA</a>
   <nav className={menu?"open":""}><a href="/shop" onClick={()=>setMenu(false)}>SHOP</a><a href="/new" onClick={()=>setMenu(false)}>NEW</a><a href="#contact" onClick={()=>setMenu(false)}>CONTACT</a></nav>
   <div className="actions"><Search/><button className="accountIcon" aria-label="Account" onClick={()=>setAccountOpen(true)}><User/></button><button className="bag" onClick={()=>setCartOpen(true)}><ShoppingBag/><b>{cart.length}</b></button></div>
  </header>
  {menu&&<div className="mobileMenuBackdrop" onClick={()=>setMenu(false)} aria-hidden="true"/>}
  {cartOpen&&<div className="accountBackdrop" onMouseDown={()=>setCartOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setCartOpen(false)}><X/></button><div className="accountBrand">KARIA</div><small className="accountEyebrow">YOUR BAG</small><h2>{cart.length?`${cart.length} piece${cart.length>1?"s":""}`:"Your bag is empty"}</h2><div className="cartList">{cart.map((p,i)=><div className="cartRow" key={`${p.id}-${i}`}><img src={p.img}/><div><b>{p.name}</b><small>${Number(p.price).toFixed(2)}</small></div><button onClick={()=>setCart(c=>c.filter((_,x)=>x!==i))}>×</button></div>)}</div>{cart.length>0&&<><div className="cartTotal"><span>Total</span><b>${cart.reduce((s,p)=>s+Number(p.price),0).toFixed(2)}</b></div><button type="button" className="accountPrimary secureCheckoutBtn" onClick={(e)=>{e.preventDefault();e.stopPropagation();checkout()}}>SECURE CHECKOUT <ArrowRight/></button></>}</section></div>}{accountOpen&&<div className="accountBackdrop" onMouseDown={()=>setAccountOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setAccountOpen(false)}><X/></button><div className="accountBrand">KARIA</div>{user?<><small className="accountEyebrow">MY ACCOUNT</small><h2>{profile?.full_name||user.email?.split("@")[0]}</h2><p className="accountEmail">{user.email}</p><div className="accountRole">{profile?.role?.replace("_"," ")||"customer"}</div><button className="accountSecondary passwordAction" onClick={()=>{setAccountOpen(false);setPasswordNotice("");setPasswordOpen(true)}}>CHANGE PASSWORD</button>{canAdmin&&<button className="accountPrimary" onClick={()=>{setAccountOpen(false);setAdmin(true)}}>OPEN ADMINISTRATION <ArrowRight/></button>}<button className="accountSecondary" onClick={signOut}>SIGN OUT</button></>:<><small className="accountEyebrow">WELCOME TO KARIA</small><h2>{authMode==="signin"?"Sign in":"Create account"}</h2><p className="accountIntro">Access your orders, saved details and KARIA account.</p><form onSubmit={submitAuth}>{authMode==="signup"&&<input name="name" placeholder="Full name" required/>}<input name="email" type="email" placeholder="Email address" required/><input name="password" type="password" placeholder="Password" minLength="6" required/>{authError&&<p className="authError">{authError}</p>}<button className="accountPrimary" type="submit">{authMode==="signin"?"SIGN IN":"CREATE ACCOUNT"}<ArrowRight/></button></form><button className="accountSwitch" onClick={()=>{setAuthError("");setAuthMode(authMode==="signin"?"signup":"signin")}}>{authMode==="signin"?"New to KARIA? Create an account":"Already have an account? Sign in"}</button></>}</section></div>}{passwordOpen&&<div className="accountBackdrop" onMouseDown={()=>{if(!mustChangePassword)setPasswordOpen(false)}}><section className="accountPanel securityPanel" onMouseDown={e=>e.stopPropagation()}>{!mustChangePassword&&<button className="accountClose" onClick={()=>setPasswordOpen(false)}><X/></button>}<div className="accountBrand">KARIA</div><small className="accountEyebrow">ACCOUNT SECURITY</small><h2>{mustChangePassword?"Create your new password":"Change password"}</h2><p className="accountIntro">{mustChangePassword?"Your account was created with a temporary password. Choose your private password before continuing.":"Choose a new password for your KARIA account."}</p><form onSubmit={changePassword}><input name="new_password" type="password" placeholder="New password" minLength="8" autoComplete="new-password" required/><input name="confirm_password" type="password" placeholder="Confirm new password" minLength="8" autoComplete="new-password" required/>{passwordNotice&&<p className={passwordNotice.startsWith("Password updated")?"authSuccess":"authError"}>{passwordNotice}</p>}<button className="accountPrimary" type="submit">UPDATE PASSWORD <ArrowRight/></button></form>{mustChangePassword&&<button className="accountSecondary" onClick={signOut}>SIGN OUT</button>}</section></div>}
  <main id="top">
   <section className="phonePortalHero">
    <div className="phoneHeroCopy">
     <div className="eyebrow">KARIA · ONE STORE · MANY WORLDS</div>
     <h1><span>Everything you love.</span><em>In one place.</em></h1>
     <p>Discover products that move around your world — fashion, beauty, home, lifestyle and more.</p>
     <a href="/shop" className="cta">SHOP KARIA <ArrowRight/></a>
    </div>
    <div className="phoneStage" aria-label="KARIA product universe">
     <div className="phoneGlow"></div>
     <div className="phoneDevice">
      <div className="phoneNotch"></div>
      <div className="phoneScreen">
       <div className="phoneScreenTop"><b>KARIA</b><span>SHOP</span></div>
       <div className="phoneScreenHero"><small>THE KARIA EDIT</small><strong>Find your<br/><i>world.</i></strong></div>
       <div className="phoneScreenGrid">
        {(storeProducts.length?storeProducts:products).slice(0,4).map((p,i)=><div key={p.id||i}><img src={p.img}/></div>)}
       </div>
       <div className="phoneScreenNav"><span>HOME</span><span>DISCOVER</span><span>BAG</span></div>
      </div>
     </div>
     <div className="productOrbit orbitOne">
      <div className="orbitCard"><img src={(storeProducts[0]||products[0]).img}/><span>{(storeProducts[0]||products[0]).name}</span></div>
     </div>
     <div className="productOrbit orbitTwo">
      <div className="orbitCard orbitCardWide"><img src={(storeProducts[1]||products[1]).img}/><span>STYLE</span></div>
     </div>
     <div className="productOrbit orbitThree">
      <div className="orbitCard orbitCardSmall"><img src={(storeProducts[2]||products[2]).img}/><span>NEW</span></div>
     </div>
     <div className="productOrbit orbitFour">
      <div className="orbitMini"><ShoppingBag/></div>
     </div>
     <div className="phoneOrbitLine lineOne"></div><div className="phoneOrbitLine lineTwo"></div>
    </div>
    <div className="phoneScrollCue"><MoveDown/><span>ENTER THE UNIVERSE</span></div>
   </section>

   <section className="heroCine universeHero universeSecond">
    <div className="heroWords universeWords"><div className="eyebrow">THE KARIA UNIVERSE · 2026</div><h1><span>Find what fits</span><em>your world.</em></h1><p>One destination. Many worlds. Discover fashion, beauty, home, lifestyle, accessories and whatever comes next.</p><a href="/shop" className="cta">Enter KARIA <ArrowRight/></a></div>
    <div className="canvasWrap universeCanvas"><Canvas camera={{position:[0,0,7.2],fov:36}} dpr={[1,1.6]} gl={{alpha:true,antialias:true}}><HeroScene progress={progress} items={storeProducts}/></Canvas></div>
    <div className="universeHalo h1"></div><div className="universeHalo h2"></div><div className="heroVertical">KARIA · ONE STORE · MANY WORLDS</div><div className="scrollOrb"><MoveDown/><span>EXPLORE</span></div>
   </section>

   <section className="categoryWorlds" id="categories">
    <div className="categoryWorldsHead"><div><small>02 — EXPLORE YOUR WORLD</small><h2>Different worlds.<br/><i>One KARIA.</i></h2></div><p>Explore KARIA by category. Each world is designed like a small cinematic campaign — products floating in space, depth, light and motion.</p></div>
    <div className="worldCompositions">
     {[
      {name:"STYLE",sub:"Fashion · Bags · Accessories",cls:"styleWorld",a:0,b:1,c:2},
      {name:"BEAUTY",sub:"Beauty · Fragrance · Self care",cls:"beautyWorld",a:1,b:2,c:0},
      {name:"HOME",sub:"Home · Decor · Everyday living",cls:"homeWorld",a:2,b:0,c:1},
      {name:"LIFESTYLE",sub:"Objects · Essentials · Discoveries",cls:"lifeWorld",a:0,b:2,c:1}
     ].map((w,i)=><a href="/shop" className={`worldComposition ${w.cls}`} key={w.name}>
       <div className="worldNumber">0{i+1}</div>
       <div className="compositionStage">
        <span className="compositionArc arcA"></span><span className="compositionArc arcB"></span><span className="compositionLine lineA"></span>
        <div className="productFloat productMain"><img src={storeProducts[w.a]?.img||["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"][w.a]}/></div>
        <div className="productFloat productSide"><img src={storeProducts[w.b]?.img||["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"][w.b]}/></div>
        <div className="productFloat productTiny"><img src={storeProducts[w.c]?.img||["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"][w.c]}/></div>
        <span className="floatingSphere sphereA"></span><span className="floatingSphere sphereB"></span>
       </div>
       <div className="worldMeta"><small>{w.sub}</small><h3>{w.name}</h3><span>EXPLORE <ArrowRight/></span></div>
      </a>)}
    </div>
   </section>

   <section className="newKaria" id="new">
    <div className="newKariaHead"><div><small>03 — NEW AT KARIA</small><h2>Fresh discoveries.</h2></div><a href="/shop">SHOP ALL <ArrowRight/></a></div>
    <div className="newProductRail">
     {storeProducts.slice(0,4).map((p,i)=><a className="newProductCard" href={`/product/${p.id}`} key={p.id||i}><div className="newProductImage"><img src={p.img}/><span>0{i+1}</span></div><div><small>{p.brand||"KARIA"}</small><h3>{p.name}</h3><b>${Number(p.price||0).toFixed(2)}</b></div></a>)}
     {!storeProducts.length&&<>
      <a className="newProductCard" href="/shop"><div className="newProductImage"><img src="/products/bag-brown.jpg"/><span>01</span></div><div><small>KARIA</small><h3>Discover the collection</h3></div></a>
      <a className="newProductCard" href="/shop"><div className="newProductImage"><img src="/products/bag-blue.jpg"/><span>02</span></div><div><small>KARIA</small><h3>New worlds arriving</h3></div></a>
     </>}
    </div>
    <div className="newKariaClosing"><span>ONE STORE</span><b>KARIA</b><span>MANY WORLDS</span></div>
   </section>
  </main>
  <footer id="contact"><div><div className="logo">KARIA</div><p>Fashion, beauty, home, lifestyle & more.<br/>Curated by KARIA.</p></div><div className="footLinks"><a href="/shop">Shop</a><a href="/new">New</a><a href="#">Shipping & returns</a></div><div className="newsletter"><small>JOIN THE KARIA LETTER</small><div><input placeholder="Your email address"/><button>→</button></div></div>{canAdmin&&<button className="adminLink" onClick={()=>setAdmin(true)}>Admin</button>}<div className="copyright">© 2026 KARIA · ONE STORE · MANY WORLDS</div></footer>
 </div>
}

function Admin({back}){
 const [tab,setTab]=useState('Dashboard'),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState('');
 const [brands,setBrands]=useState([]),[categories,setCategories]=useState([]),[productsList,setProductsList]=useState([]),[uploading,setUploading]=useState(false),[editingProduct,setEditingProduct]=useState(null),[editingMovement,setEditingMovement]=useState(null),[viewingOrder,setViewingOrder]=useState(null);
 const [stats,setStats]=useState({revenue:0,orders:0,inventory:0,net:0});
 const [inventorySummary,setInventorySummary]=useState([]),[inventoryTotals,setInventoryTotals]=useState({opening:0,received:0,sold:0,out:0,returns:0,adjustments:0,current:0,value:0});
 const [currentAdmin,setCurrentAdmin]=useState(null),[currentUserId,setCurrentUserId]=useState(null);
 const [accountingSales,setAccountingSales]=useState([]),[accountingExpenses,setAccountingExpenses]=useState([]),[accountingTotals,setAccountingTotals]=useState({sales:0,cogs:0,shipping:0,tax:0,fees:0,gross:0,margin:0,expenses:0,net:0});
 const nav=[["Dashboard",BarChart3],["Orders",ShoppingBag],["Products",Package],["Categories",Boxes],["Brands",ShieldCheck],["Inventory",Boxes],["Customers",Users],["Accounting",Wallet],["Reports",BarChart3],["Admin users",Users],["Coupons",ShoppingBag],["Settings",Settings]];
 const loadInventoryAccounting=async()=>{
  if(!supabase)return;
  const [{data:prods,error:pe},{data:moves,error:me}]=await Promise.all([
    supabase.from('products').select('id,name,sku,unit_cost,price,active').order('name'),
    supabase.from('inventory_movements').select('*').order('created_at',{ascending:true})
  ]);
  if(pe)throw pe;if(me)throw me;
  const summary=(prods||[]).map(product=>{
    let opening=0,received=0,sold=0,out=0,returns=0,adjustments=0,current=0;
    (moves||[]).filter(m=>m.product_id===product.id).forEach(m=>{
      const q=Number(m.qty??m.quantity??0);
      const type=String(m.movement_type||'').toUpperCase();
      const note=String(m.note||'').toLowerCase();
      if(note.includes('opening stock')){opening+=Math.abs(q);current+=Math.abs(q)}
      else if(type==='IN'||type==='PRODUCTION_IN'){received+=Math.abs(q);current+=Math.abs(q)}
      else if(type==='RETURN'){returns+=Math.abs(q);current+=Math.abs(q)}
      else if(type==='SALE'||type==='SOLD'||note.includes('sale')||note.includes('order')){sold+=Math.abs(q);current-=Math.abs(q)}
      else if(type==='OUT'){out+=Math.abs(q);current-=Math.abs(q)}
      else if(type==='ADJUST'||type==='ADJUSTMENT'){adjustments+=q;current+=q}
    });
    return {...product,opening,received,sold,out,returns,adjustments,current,value:current*Number(product.unit_cost||0)};
  });
  const totals=summary.reduce((a,r)=>({opening:a.opening+r.opening,received:a.received+r.received,sold:a.sold+r.sold,out:a.out+r.out,returns:a.returns+r.returns,adjustments:a.adjustments+r.adjustments,current:a.current+r.current,value:a.value+r.value}),{opening:0,received:0,sold:0,out:0,returns:0,adjustments:0,current:0,value:0});
  setInventorySummary(summary);setInventoryTotals(totals);
 };
 const loadAccounting=async()=>{
  if(!supabase)return;
  const [{data:items,error:ie},{data:expenses,error:ee}]=await Promise.all([
    supabase.from('order_items').select('id,order_id,product_id,qty,unit_price,unit_cost,orders!inner(order_number,status,created_at,subtotal,discount,discount_total,shipping,shipping_total,tax,total,processor_fee),products(name,sku,description)').order('id',{ascending:false}),
    supabase.from('expenses').select('*').order('created_at',{ascending:false})
  ]);
  if(ie)throw ie;if(ee)throw ee;
  const paidStatuses=['paid','processing','shipped','delivered'];
  const paidItems=(items||[]).filter(x=>paidStatuses.includes(String(x.orders?.status||'').toLowerCase()));
  const orderBases={};
  paidItems.forEach(x=>{const base=Number(x.qty||0)*Number(x.unit_price||0);orderBases[x.order_id]=(orderBases[x.order_id]||0)+base});
  const sales=paidItems.map(x=>{
    const qty=Number(x.qty||0),unitPrice=Number(x.unit_price||0),unitCost=Number(x.unit_cost||0);
    const grossProductSales=qty*unitPrice,totalCost=qty*unitCost;
    const o=x.orders||{},orderBase=orderBases[x.order_id]||grossProductSales||1,share=grossProductSales/orderBase;
    const discount=Number(o.discount_total??o.discount??0)*share;
    const shipping=Number(o.shipping_total??o.shipping??0)*share;
    const tax=Number(o.tax||0)*share;
    const processorFee=Number(o.processor_fee||0)*share;
    const netSale=grossProductSales-discount;
    const customerTotal=netSale+shipping+tax;
    const deductions=totalCost+shipping+tax+processorFee;
    const profit=netSale-totalCost-shipping-tax-processorFee;
    const profitPercent=netSale?profit/netSale*100:0;
    const markup=totalCost?profit/totalCost*100:(profit>0?100:0);
    return {...x,qty,unitPrice,unitCost,grossProductSales,discount,netSale,shipping,tax,customerTotal,totalCost,processorFee,deductions,profit,profitPercent,markup};
  });
  const revenue=sales.reduce((a,x)=>a+x.netSale,0),cogs=sales.reduce((a,x)=>a+x.totalCost,0);
  const shipping=sales.reduce((a,x)=>a+x.shipping,0),tax=sales.reduce((a,x)=>a+x.tax,0),fees=sales.reduce((a,x)=>a+x.processorFee,0);
  const gross=sales.reduce((a,x)=>a+x.profit,0);
  const expenseTotal=(expenses||[]).reduce((a,x)=>a+Number(x.amount||0),0);
  setAccountingSales(sales);setAccountingExpenses(expenses||[]);
  const grossSales=sales.reduce((a,x)=>a+x.grossProductSales,0),discounts=sales.reduce((a,x)=>a+x.discount,0);
  const paidOrders=new Set(paidItems.map(x=>x.order_id)).size;
  setAccountingTotals({sales:revenue,grossSales,discounts,orders:paidOrders,cogs,shipping,tax,fees,gross,margin:revenue?gross/revenue*100:0,expenses:expenseTotal,net:gross-expenseTotal});
 };
 const load=async()=>{if(!supabase)return;setLoading(true);setNotice('');try{
  const table={Orders:'orders',Products:'products',Categories:'categories',Brands:'brands',Inventory:'inventory_movements',Customers:'profiles',Accounting:'expenses','Admin users':'profiles',Coupons:'coupons'}[tab];
  if(table){let q=tab==='Orders'?supabase.from('orders').select('id,order_number,email,status,subtotal,discount,shipping,tax,total,processor_fee,shipping_address,tracking_number,carrier,created_at,stripe_session_id,stripe_payment_intent,order_items(id,product_id,qty,unit_price,unit_cost,products(id,name,sku,description,product_media(url,media_type,sort_order)))').order('created_at',{ascending:false}).limit(100):tab==='Inventory'?supabase.from('inventory_movements').select('*, products(name,sku)').order('created_at',{ascending:false}).limit(100):tab==='Categories'?supabase.from('categories').select('*').order('name',{ascending:true}).limit(100):tab==='Products'?supabase.from('products').select('id,name,sku,description,price,unit_cost,category,brand_id,materials,dimensions,weight,low_stock_threshold,featured,active,created_at,product_media(url,media_type,sort_order)').order('created_at',{ascending:false}).limit(100):supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100);if(tab==='Admin users')q=q.in('role',['staff','admin','super_admin']);const {data,error}=await q;if(error)throw error;setRows(data||[])}
  const [{data:o},{data:im},{data:ex}]=await Promise.all([supabase.from('orders').select('total,status'),supabase.from('inventory_movements').select('quantity,qty,movement_type'),supabase.from('expenses').select('amount')]);
  const paid=(o||[]).filter(x=>['paid','processing','shipped','delivered'].includes(String(x.status).toLowerCase()));const rev=paid.reduce((s,x)=>s+Number(x.total||0),0);const inv=(im||[]).reduce((s,x)=>{const n=Number(x.quantity??x.qty??0);return s+(['out','sale','consume'].includes(String(x.movement_type).toLowerCase())?-Math.abs(n):n)},0);const expenses=(ex||[]).reduce((s,x)=>s+Number(x.amount||0),0);setStats({revenue:rev,orders:(o||[]).length,inventory:inv,net:rev-expenses});
  if(tab==='Inventory')await loadInventoryAccounting();
  if(tab==='Accounting')await loadAccounting();
 }catch(e){setNotice(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[tab]);
 useEffect(()=>{if(!supabase)return;(async()=>{const {data:{user}}=await supabase.auth.getUser();setCurrentUserId(user?.id||null);if(user?.id){const {data}=await supabase.from('profiles').select('id,role').eq('id',user.id).single();setCurrentAdmin(data||null)}})()},[]);
 useEffect(()=>{if(!supabase)return;(async()=>{const [{data:b},{data:c},{data:p}]=await Promise.all([supabase.from('brands').select('id,name').eq('active',true).order('name'),supabase.from('categories').select('id,name,slug,active').order('name'),supabase.from('products').select('id,name,sku').eq('active',true).order('name')]);setBrands(b||[]);setCategories((c||[]).filter(x=>x.active!==false));setProductsList(p||[])})()},[tab,notice]);
 const create=async(e,kind)=>{e.preventDefault();const form=e.currentTarget;const imageFiles=kind==='product'?Array.from(form.elements?.images?.files||[]):[];const f=Object.fromEntries(new FormData(form));setNotice('');try{
  if(kind==='brand'){const {error}=await supabase.from('brands').insert({name:f.name,slug:String(f.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),story:f.description||null});if(error)throw error}
  if(kind==='category'){const name=String(f.name||'').trim();const slug=String(f.slug||name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');const {error}=await supabase.from('categories').insert({name,slug,active:true});if(error)throw error}
  if(kind==='product'){setUploading(true);const payload={name:f.name,sku:f.sku,description:f.description||null,materials:f.materials||null,dimensions:f.dimensions||null,price:Number(f.price||0),unit_cost:Number(f.cost||0),brand_id:f.brand_id||null,weight:f.weight?Number(f.weight):null,low_stock_threshold:Number(f.low_stock_threshold||2),featured:f.featured==='on',category:(categories.find(c=>c.id===f.category_id)?.name||null),active:f.publish_shop!=='off',slug:String(f.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Date.now().toString().slice(-5)};const {data,error}=await supabase.from('products').insert(payload).select().single();if(error)throw error;const files=imageFiles;for(let i=0;i<files.length;i++){const file=files[i];const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${data.id}/${Date.now()}-${i}.${ext}`;const {error:ue}=await supabase.storage.from('product-media').upload(path,file,{upsert:false,contentType:file.type});if(ue)throw ue;const {data:pub}=supabase.storage.from('product-media').getPublicUrl(path);const {error:me}=await supabase.from('product_media').insert({product_id:data.id,url:pub.publicUrl,media_type:file.type.startsWith('video/')?'video':'image',sort_order:i});if(me)throw me}setUploading(false)}
  if(kind==='inventory'){const isOpening=f.movement_type==='OPENING_UI';const movementType=isOpening?'ADJUST':f.movement_type;const note=isOpening?`OPENING STOCK${f.note?' · '+f.note:''}`:(f.note||null);const {error}=await supabase.from('inventory_movements').insert({product_id:f.product_id,qty:Number(f.quantity),movement_type:movementType,note});if(error)throw error}
  if(kind==='production'){const {error}=await supabase.from('production_orders').insert({product_id:f.product_id,qty:Number(f.quantity),status:'pending'});if(error)throw error}
  if(kind==='expense'){const {error}=await supabase.from('expenses').insert({description:f.description,amount:Number(f.amount),category:f.category||'Operating',expense_date:f.expense_date||new Date().toISOString().slice(0,10)});if(error)throw error}
  if(kind==='material'){const {error}=await supabase.from('materials').insert({name:f.name,sku:f.sku||null,unit:f.unit||'unit',unit_cost:Number(f.unit_cost||0),stock:Number(f.stock||0)});if(error)throw error}
  if(kind==='coupon'){const {error}=await supabase.from('coupons').insert({code:String(f.code).toUpperCase(),percent_off:f.percent_off?Number(f.percent_off):null,amount_off:f.amount_off?Number(f.amount_off):null,active:true,ends_at:f.ends_at||null});if(error)throw error}
  if(kind==='settings'){for(const [key,value] of Object.entries({store:{name:f.store_name||'KARIA',currency:f.currency||'USD'},shipping:{default_rate:Number(f.shipping_rate||0),free_shipping_over:Number(f.free_shipping_over||0)},legal:{returns_days:Number(f.returns_days||14)}})){const {error}=await supabase.from('settings').upsert({key,value,updated_at:new Date().toISOString()});if(error)throw error}}
  form.reset();setNotice('Saved successfully.');await load();
 }catch(err){setUploading(false);setNotice(err.message)}};
 const editCategory=async(r)=>{const name=prompt('Category name',r.name||'');if(name===null)return;const clean=name.trim();if(!clean)return;const oldName=r.name;const slug=clean.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');setNotice('');try{const {error}=await supabase.from('categories').update({name:clean,slug}).eq('id',r.id);if(error)throw error;if(oldName&&oldName!==clean){const {error:pe}=await supabase.from('products').update({category:clean}).eq('category',oldName);if(pe)throw pe}setNotice('Category updated successfully.');await load()}catch(e){setNotice(e.message)}};
 const toggleCategory=async(r)=>{setNotice('');try{const {error}=await supabase.from('categories').update({active:!r.active}).eq('id',r.id);if(error)throw error;setNotice(r.active?'Category deactivated.':'Category activated.');await load()}catch(e){setNotice(e.message)}};
 const deleteCategory=async(r)=>{setNotice('');try{const {count,error:ce}=await supabase.from('products').select('id',{count:'exact',head:true}).eq('category',r.name);if(ce)throw ce;if((count||0)>0){setNotice(`Cannot delete "${r.name}". ${count} product${count===1?' is':'s are'} assigned to it. Move those products to another category or deactivate this category.`);return}if(!confirm(`Delete category "${r.name}"? This cannot be undone.`))return;const {error}=await supabase.from('categories').delete().eq('id',r.id);if(error)throw error;setNotice('Category deleted.');await load()}catch(e){setNotice(e.message)}};
 const createAdmin=async(e)=>{e.preventDefault();const form=e.currentTarget;const f=Object.fromEntries(new FormData(form));const {data,error}=await supabase.functions.invoke('admin-create-user',{body:{email:f.email,full_name:f.full_name,role:f.role}});if(error||!data?.ok){setNotice(data?.error||error?.message||'Unable to create user');return}setNotice(`Administrator created — temporary password: ${data.temporaryPassword}`);form.reset();await load()};
 const updateAdmin=async(id,role,disabled)=>{const {data,error}=await supabase.functions.invoke('admin-update-user',{body:{user_id:id,role,disabled}});setNotice(error?.message||data?.error||'Access updated.');load()};
 const resetAdminPassword=async(target)=>{
  if(currentAdmin?.role!=='super_admin')return;
  const password=window.prompt(`Set a new temporary password for ${target.full_name||target.email||'this administrator'}\n\nMinimum 8 characters:`);
  if(password===null)return;
  if(password.length<8){setNotice('Temporary password must be at least 8 characters.');return}
  if(!window.confirm(`Change the password for ${target.full_name||target.email||'this administrator'}?\n\nThey will be required to create a new password at their next login.`))return;
  const {data,error}=await supabase.functions.invoke('admin-update-user',{body:{user_id:target.id,reset_password:password,force_password_change:true}});
  setNotice(error?.message||data?.error||'Password changed. The administrator must create a new password at next login.');
  load();
 };
 const deleteOrder=async(order)=>{
  if(!order?.id)return;
  const status=String(order.status||'').toLowerCase();
  const paid=status==='paid';
  const warning=paid
    ? `DELETE PAID TEST ORDER #${order.order_number||''}?\n\nKARIA IS CURRENTLY IN TESTING. This removes the paid demo order and its order items from KARIA, so it will also disappear from Accounting. It does NOT delete the Sandbox payment from Stripe.\n\nThis cannot be undone.`
    : `Delete test order #${order.order_number||''}?\n\nThis will also delete its order items. Products will NOT be deleted.\n\nThis cannot be undone.`;
  if(!window.confirm(warning))return;
  setNotice('');
  try{
    const {error:itemsError}=await supabase.from('order_items').delete().eq('order_id',order.id);
    if(itemsError)throw itemsError;
    const {data:deleted,error:orderError}=await supabase.from('orders').delete().eq('id',order.id).select('id');
    if(orderError)throw orderError;
    if(!deleted?.length)throw new Error('The order could not be deleted. Check the Orders delete policy in Supabase.');
    setViewingOrder(null);
    setNotice(`Test order #${order.order_number||''} deleted from KARIA${paid?' (Stripe Sandbox history is unchanged)':''}.`);
    await load();
  }catch(err){
    setNotice(err?.message||'Unable to delete order.');
  }
 };
 const deleteInventoryMovement=async(movement)=>{
  if(!movement?.id)return;
  const type=String(movement.movement_type||'').toUpperCase();
  const note=String(movement.note||'').toLowerCase();
  const saleLinked=['SALE','SOLD'].includes(type)||note.includes('sale')||note.includes('order');
  if(saleLinked){
    const ok=window.confirm('This movement belongs to a sale/order and cannot be deleted from the audit history. Create a reversing adjustment instead?');
    if(!ok)return;
    const {error}=await supabase.from('inventory_movements').insert({product_id:movement.product_id,qty:Math.abs(Number(movement.qty??movement.quantity??0)),movement_type:'ADJUST',note:`Reversal of sale movement ${movement.id}`});
    if(error){setNotice(error.message);return}
    setNotice('Sale history preserved. Reversing adjustment created.');
  }else{
    if(!window.confirm('Delete this product entry from inventory? This removes this inventory movement and recalculates the product stock.'))return;
    const {error}=await supabase.from('inventory_movements').delete().eq('id',movement.id);
    if(error){setNotice(error.message);return}
    setNotice('Product inventory entry deleted. Stock recalculated.');
  }
  await load();
 };
 const editProduct=(product)=>setEditingProduct(product);
 const saveProductEdit=async(e)=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));setNotice('Saving product…');
  try{
    const payload={name:f.name.trim(),sku:f.sku.trim(),brand_id:f.brand_id||null,category:f.category||null,description:f.description.trim()||null,materials:f.materials.trim()||null,dimensions:f.dimensions.trim()||null,price:Number(f.price||0),unit_cost:Number(f.unit_cost||0),weight:f.weight?Number(f.weight):null,low_stock_threshold:Number(f.low_stock_threshold||2),active:f.active==='true',featured:f.featured==='on'};
    const {data,error}=await supabase.from('products').update(payload).eq('id',editingProduct.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Product update affected no rows.');
    setEditingProduct(null);setNotice('Product updated successfully.');await load();
  }catch(err){setNotice(`Edit failed: ${err?.message||String(err)}`)}
 };
 const editInventoryMovement=(movement)=>setEditingMovement(movement);
 const saveMovementEdit=async(e)=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));setNotice('Saving inventory movement…');
  try{
    const isOpening=String(editingMovement.note||'').toLowerCase().includes('opening stock');
    const note=isOpening?`OPENING STOCK${f.note?.trim()?' · '+f.note.trim():''}`:(f.note?.trim()||null);
    const {data,error}=await supabase.from('inventory_movements').update({product_id:f.product_id,qty:Number(f.qty),movement_type:f.movement_type,note}).eq('id',editingMovement.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Inventory movement update affected no rows.');
    setEditingMovement(null);setNotice('Inventory movement updated successfully.');await load();
  }catch(err){setNotice(`Edit failed: ${err?.message||String(err)}`)}
 };
 const deleteProduct=async(product)=>{
  if(!product?.id)return;
  if(!window.confirm(`Delete "${product.name||'this product'}"?\n\nIf it has sales history, KARIA will archive it to preserve accounting. Otherwise it will be permanently deleted.`))return;
  setNotice('Deleting product…');
  try{
    const {data,error}=await supabase.rpc('admin_delete_product',{p_product_id:product.id});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error(result?.message||'Product could not be deleted.');
    setNotice(result.action==='archived'
      ?'Product archived because it has sales history. It was removed from the active catalog.'
      :'Product permanently deleted.');
    await load();
  }catch(err){setNotice(`Delete failed: ${err?.message||String(err)}`)}
 };
 const cards=[["Revenue",`$${stats.revenue.toFixed(2)}`,Wallet],["Orders",String(stats.orders),ShoppingBag],["Inventory",String(stats.inventory),Boxes],["Net result",`$${stats.net.toFixed(2)}`,BarChart3]];
 const Field=({name,placeholder,type='text',required=false})=><input name={name} placeholder={placeholder} type={type} required={required}/>;
 const module=()=>{
  if(tab==='Dashboard')return <><div className="cards">{cards.map(([a,b,I])=><div key={a}><I/><small>{a}</small><strong>{b}</strong><em>Live from Supabase</em></div>)}</div><div className="adminGrid"><div className="panel"><h2>Inventory movements</h2><p>Sales, production, returns and adjustments remain auditable.</p></div><div className="panel"><h2>Accounting engine</h2><p>Order → payment → sales → tax → fees → COGS → inventory → reports.</p><div className="flow">SALE → INVENTORY → LEDGER → REPORTS</div></div></div></>;
  if(tab==='Orders')return <><div className="adminSectionHead"><div><small>ORDER HISTORY</small><h2>Orders</h2><p className="formHelp">Visual order history with products, customer, payment status and totals. TEST MODE: orders can be deleted during setup. Paid production orders will be protected when KARIA goes live.</p></div></div><OrderAdminTable rows={rows} onView={setViewingOrder} onDelete={deleteOrder}/></>;
  if(tab==='Categories')return <><section className="categoryAdminHero"><div><small>SHOP ORGANIZATION</small><h2>Categories</h2><p>Create the departments customers use to browse KARIA. Products can only be assigned to active categories.</p></div><div><strong>{rows.filter(r=>r.active!==false).length}</strong><small>ACTIVE</small></div></section><form className="adminForm categoryForm" onSubmit={e=>create(e,'category')}><h2>New category</h2><Field name="name" placeholder="Category name — e.g. Beauty" required/><Field name="slug" placeholder="URL slug (optional)"/><button>CREATE CATEGORY</button></form><div className="categoryAdminGrid">{rows.map(r=><div className={`categoryAdminCard ${r.active===false?'inactive':''}`} key={r.id}><div><small>{r.active===false?'INACTIVE':'ACTIVE'}</small><h3>{r.name}</h3><span>/{r.slug}</span></div><div className="categoryAdminActions"><button onClick={()=>editCategory(r)}>EDIT</button><button onClick={()=>toggleCategory(r)}>{r.active===false?'ACTIVATE':'DEACTIVATE'}</button><button className="dangerBtn" onClick={()=>deleteCategory(r)}>DELETE</button></div></div>)}</div></>;
  if(tab==='Brands')return <><form className="adminForm" onSubmit={e=>create(e,'brand')}><h2>New brand</h2><Field name="name" placeholder="Brand name" required/><Field name="description" placeholder="Story / description"/><button>CREATE BRAND</button></form><DataTable rows={rows}/></>;
  if(tab==='Products')return <><form className="adminForm wide productForm" onSubmit={e=>create(e,'product')}><h2>New product</h2><p className="formHelp">Step 1: create the product and publish it to the Shop. Stock starts at 0. Step 2: go to Inventory to enter the real quantity available.</p><Field name="name" placeholder="Product name" required/><Field name="sku" placeholder="SKU" required/><select name="brand_id"><option value="">Select brand (optional)</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><Field name="price" placeholder="Sale price" type="number" required/><Field name="cost" placeholder="Unit cost" type="number"/><Field name="weight" placeholder="Weight" type="number"/><Field name="low_stock_threshold" placeholder="Low stock alert (default 2)" type="number"/><Field name="materials" placeholder="Materials"/><Field name="dimensions" placeholder="Dimensions"/><select name="category_id" required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea name="description" placeholder="Description and story"/><label className="uploadBox"><b>PRODUCT PHOTOS / VIDEO</b><span>Choose one or several images. The first image becomes the main product photo.</span><input name="images" type="file" accept="image/*,video/mp4,video/webm" multiple required/></label><label className="checkLine"><input name="publish_shop" type="checkbox" defaultChecked/> Publish in KARIA Shop</label><label className="checkLine"><input name="featured" type="checkbox"/> Featured product</label><button disabled={uploading}>{uploading?'UPLOADING MEDIA…':'CREATE PRODUCT + UPLOAD MEDIA'}</button></form><ProductAdminTable rows={rows} onEdit={editProduct} onDelete={deleteProduct}/></>;
  if(tab==='Inventory')return <><section className="inventoryHero"><div><small>LIVE INVENTORY CONTROL</small><h2>Inventory accounting</h2><p>Every product keeps a permanent movement history. Opening stock + receipts + returns + adjustments − sales − other outputs = current stock.</p></div><div><small>INVENTORY VALUE AT COST</small><strong>${inventoryTotals.value.toFixed(2)}</strong></div></section><div className="inventoryKpis"><div><span>Opening stock</span><strong>{inventoryTotals.opening}</strong></div><div><span>Received</span><strong>+{inventoryTotals.received}</strong></div><div><span>Sales</span><strong>-{inventoryTotals.sold}</strong></div><div><span>Returns</span><strong>+{inventoryTotals.returns}</strong></div><div><span>Other OUT</span><strong>-{inventoryTotals.out}</strong></div><div className="currentKpi"><span>Current stock</span><strong>{inventoryTotals.current}</strong></div></div><section className="inventorySummary"><div className="inventorySectionTitle"><div><small>PRODUCT LEDGER</small><h3>Inventory by product</h3></div><span>{inventorySummary.length} products</span></div><div className="tableWrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>OPENING</th><th>RECEIVED</th><th>SALES</th><th>RETURNS</th><th>OTHER OUT</th><th>ADJ.</th><th>CURRENT</th><th>VALUE</th></tr></thead><tbody>{inventorySummary.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.sku||'—'}</td><td>{r.opening}</td><td className="positive">+{r.received}</td><td className="negative">-{r.sold}</td><td className="positive">+{r.returns}</td><td className="negative">-{r.out}</td><td>{r.adjustments}</td><td><span className={r.current<=0?'stockPill zero':'stockPill'}>{r.current}</span></td><td>${r.value.toFixed(2)}</td></tr>)}</tbody></table></div></section><form className="adminForm wide" onSubmit={e=>create(e,'inventory')}><h2>Add inventory movement</h2><p className="formHelp">Use OPENING STOCK only when entering the first physical count of a product. Use IN for later receipts. Sales will be recorded automatically by the order system.</p><select name="product_id" required><option value="">Select product</option>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><Field name="quantity" placeholder="Quantity" type="number" required/><select name="movement_type"><option value="OPENING_UI">OPENING STOCK</option><option value="IN">IN / RECEIVED</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select><Field name="note" placeholder="Reason / reference"/><button>POST MOVEMENT</button></form><div className="inventorySectionTitle movementHead"><div><small>INVENTORY ENTRIES</small><h3>Movement history · delete manual entries here</h3></div></div><div className="inventoryHistory tableWrap">{rows.length===0?<div className="emptyInventory">No inventory movements yet.</div>:<table><thead><tr><th>DATE</th><th>PRODUCT</th><th>SKU</th><th>MOVEMENT</th><th>QTY</th><th>REASON / REFERENCE</th><th>ACTION</th></tr></thead><tbody>{rows.map(r=>{const note=String(r.note||'');const isOpening=note.toLowerCase().includes('opening stock');const movement=isOpening?'OPENING STOCK':r.movement_type==='IN'?'RECEIVED / IN':r.movement_type==='OUT'?'OUT':r.movement_type==='RETURN'?'RETURN':r.movement_type==='PRODUCTION_IN'?'PRODUCTION IN':r.movement_type==='ADJUST'?'ADJUSTMENT':(r.movement_type||'');return <tr key={r.id}><td>{r.created_at?new Date(r.created_at).toLocaleString():''}</td><td><b>{r.products?.name||''}</b></td><td>{r.products?.sku||''}</td><td><span className="movementPill">{movement}</span></td><td><b>{r.qty??''}</b></td><td>{isOpening?note.replace(/^OPENING STOCK\s*[·-]?\s*/i,''):note}</td><td><div className="rowActionButtons"><button onClick={()=>editInventoryMovement(r)}>EDIT</button><button className="dangerBtn" onClick={()=>deleteInventoryMovement(r)}>DELETE</button></div></td></tr>})}</tbody></table>}</div></>;
  if(tab==='Accounting'){const byOrder={};accountingSales.forEach(r=>{const k=r.order_id;if(!byOrder[k])byOrder[k]={order:r.orders,lines:[],total:0,fee:0,profit:0};byOrder[k].lines.push(r);byOrder[k].total+=r.customerTotal;byOrder[k].fee+=r.processorFee;byOrder[k].profit+=r.profit});const recent=Object.values(byOrder).slice(0,5);const byProduct={};accountingSales.forEach(r=>{const n=r.products?.name||'Product';if(!byProduct[n])byProduct[n]={name:n,sales:0,qty:0};byProduct[n].sales+=r.netSale;byProduct[n].qty+=r.qty});const topProducts=Object.values(byProduct).sort((a,b)=>b.sales-a.sales).slice(0,3);const totalSales=accountingTotals.grossSales??accountingTotals.sales;const profitBase=Math.max(totalSales,1);const pct=n=>Math.max(0,Math.min(100,n/profitBase*100));return <><section className="acct2Head"><div><small>ACCOUNTING</small><h2>Financial Overview</h2><p>Sales, costs, fees, taxes and real profit from every paid KARIA order.</p></div><select defaultValue="30"><option value="30">Last 30 days</option><option value="month">This month</option><option value="year">This year</option></select></section><div className="acct2Kpis"><div className="green"><span>SALES</span><strong>${totalSales.toFixed(2)}</strong><small>{accountingTotals.orders||0} paid orders</small></div><div className="blue"><span>ORDERS</span><strong>{accountingTotals.orders||0}</strong><small>Completed payments</small></div><div className="gold"><span>GROSS PROFIT</span><strong>${accountingTotals.gross.toFixed(2)}</strong><small>After direct costs</small></div><div className="purple"><span>STRIPE FEES</span><strong>−${accountingTotals.fees.toFixed(2)}</strong><small>Real processor fees</small></div><div className="pink"><span>TAXES</span><strong>−${accountingTotals.tax.toFixed(2)}</strong><small>Tax deducted</small></div><div className="red"><span>EXPENSES</span><strong>−${accountingTotals.expenses.toFixed(2)}</strong><small>Operating expenses</small></div></div><section className="acct2Grid"><div className="acct2Card acct2Chart"><h3>Sales & Profit</h3><div className="miniBars">{[42,65,50,78,58,88,70,96,64,82,72,92,76,100].map((h,i)=><i key={i} style={{height:`${h}%`}}/> )}</div><div className="chartLegend"><span>● Sales ${accountingTotals.sales.toFixed(2)}</span><span>● Net profit ${accountingTotals.net.toFixed(2)}</span></div></div><div className="acct2Card"><h3>Top Products</h3><div className="topProducts">{topProducts.length?topProducts.map((p,i)=><div key={p.name}><b>{i+1}</b><span>{p.name}<small>{p.qty} sold</small></span><strong>${p.sales.toFixed(2)}</strong></div>):<p>No paid products yet.</p>}</div></div><div className="acct2Card"><h3>Profit Breakdown</h3><div className="profitDonut" style={{background:`conic-gradient(#3c82f6 0 ${pct(accountingTotals.cogs)}%,#9b5de5 ${pct(accountingTotals.cogs)}% ${pct(accountingTotals.cogs+accountingTotals.fees)}%,#f59eaa ${pct(accountingTotals.cogs+accountingTotals.fees)}% ${pct(accountingTotals.cogs+accountingTotals.fees+accountingTotals.expenses)}%,#25a96b ${pct(accountingTotals.cogs+accountingTotals.fees+accountingTotals.expenses)}% 100%)`}}><div><strong>${accountingTotals.net.toFixed(0)}</strong><small>Net Profit</small></div></div><div className="profitLegend"><span>COGS ${accountingTotals.cogs.toFixed(2)}</span><span>Stripe ${accountingTotals.fees.toFixed(2)}</span><span>Expenses ${accountingTotals.expenses.toFixed(2)}</span><span>Net ${accountingTotals.net.toFixed(2)}</span></div></div></section><section className="acct2Card acct2Recent"><div className="acct2Title"><div><small>PAID ORDERS</small><h2>Recent Sales</h2></div><b>Net profit ${accountingTotals.net.toFixed(2)}</b></div><div className="tableWrap"><table><thead><tr><th>DATE</th><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>TOTAL</th><th>DISCOUNT</th><th>SHIPPING</th><th>TAX</th><th>STRIPE FEE</th><th>COGS</th><th>PROFIT</th></tr></thead><tbody>{recent.map((g,i)=>{const first=g.lines[0],o=g.order||{},cogs=g.lines.reduce((a,x)=>a+x.totalCost,0),discount=g.lines.reduce((a,x)=>a+x.discount,0),shipping=g.lines.reduce((a,x)=>a+x.shipping,0),tax=g.lines.reduce((a,x)=>a+x.tax,0);return <tr key={first.order_id||i}><td>{o.created_at?new Date(o.created_at).toLocaleDateString():''}</td><td><b>#{o.order_number||''}</b></td><td>{o.email||'Customer'}</td><td>{g.lines.length}</td><td>${g.total.toFixed(2)}</td><td>−${discount.toFixed(2)}</td><td>−${shipping.toFixed(2)}</td><td>−${tax.toFixed(2)}</td><td className="feeCell">−${g.fee.toFixed(2)}</td><td>−${cogs.toFixed(2)}</td><td className={g.profit>=0?'profitPositive':'profitNegative'}><b>${g.profit.toFixed(2)}</b></td></tr>})}</tbody></table></div></section><section className="acct2Bottom"><div className="acct2Card"><h3>Profit Summary</h3><div className="summaryRows"><div><span>Gross sales</span><b>${totalSales.toFixed(2)}</b></div><div><span>Discounts</span><b>−${(accountingTotals.discounts||0).toFixed(2)}</b></div><div><span>COGS</span><b>−${accountingTotals.cogs.toFixed(2)}</b></div><div><span>Shipping</span><b>−${accountingTotals.shipping.toFixed(2)}</b></div><div><span>Taxes</span><b>−${accountingTotals.tax.toFixed(2)}</b></div><div><span>Stripe fees</span><b>−${accountingTotals.fees.toFixed(2)}</b></div><div><span>Operating expenses</span><b>−${accountingTotals.expenses.toFixed(2)}</b></div><div className="net"><span>NET PROFIT</span><b>${accountingTotals.net.toFixed(2)}</b></div></div></div><div className="acct2Card"><h3>Operating Expenses</h3><form className="acct2ExpenseForm" onSubmit={e=>create(e,'expense')}><Field name="description" placeholder="Description" required/><Field name="amount" placeholder="Amount" type="number" step="0.01" required/><Field name="category" placeholder="Category"/><Field name="expense_date" type="date"/><button>ADD EXPENSE</button></form><DataTable rows={accountingExpenses.slice(0,5)}/></div></section></>}

  if(tab==='Reports')return <div className="reportGrid">{cards.map(([a,b])=><div className="panel" key={a}><small>{a}</small><h2>{b}</h2></div>)}<div className="panel"><h2>Ownership</h2><p>Partner A 50% · Partner B 50%. Capital contributions and distributions are tracked independently from ownership.</p></div></div>;
  if(tab==='Admin users')return <><form className="adminForm wide" onSubmit={createAdmin}><h2>Create administrator</h2><Field name="full_name" placeholder="Full name" required/><Field name="email" placeholder="Email" type="email" required/><select name="role"><option value="admin">Admin</option><option value="staff">Staff</option></select><button>CREATE ACCESS</button></form><div className="userCards">{rows.map(r=><div className="panel" key={r.id}><b>{r.full_name||r.email||'User'}</b><small>{r.role}</small><div><button onClick={()=>updateAdmin(r.id,r.role,!r.disabled)}>{r.disabled?'ACTIVATE':'DISABLE'}</button>{r.role!=='super_admin'&&<button onClick={()=>updateAdmin(r.id,r.role==='admin'?'staff':'admin',!!r.disabled)}>MAKE {r.role==='admin'?'STAFF':'ADMIN'}</button>}{currentAdmin?.role==='super_admin'&&r.id!==currentUserId&&<button className="passwordAdminBtn" onClick={()=>resetAdminPassword(r)}>RESET PASSWORD</button>}</div></div>)}</div></>;
  if(tab==='Coupons')return <><form className="adminForm wide" onSubmit={e=>create(e,'coupon')}><h2>New coupon</h2><Field name="code" placeholder="Code e.g. KARIA10" required/><Field name="percent_off" placeholder="Percent off" type="number"/><Field name="amount_off" placeholder="Fixed amount off" type="number"/><Field name="ends_at" type="date"/><button>CREATE COUPON</button></form><DataTable rows={rows}/></>;
  if(tab==='Settings')return <form className="adminForm wide" onSubmit={e=>create(e,'settings')}><h2>Store settings</h2><Field name="store_name" placeholder="Store name"/><Field name="currency" placeholder="Currency (USD)"/><Field name="shipping_rate" placeholder="Default shipping rate" type="number"/><Field name="free_shipping_over" placeholder="Free shipping over" type="number"/><Field name="returns_days" placeholder="Returns window (days)" type="number"/><button>SAVE SETTINGS</button><p>Stripe and Supabase secret keys never belong in the browser.</p></form>;
  return <DataTable rows={rows}/>;
 };
 return <div className="admin"><aside><div className="logo">KARIA</div><small>ADMINISTRATION</small>{nav.map(([x,I])=><button className={tab===x?'selected':''} key={x} onClick={()=>setTab(x)}><I/>{x}</button>)}<button onClick={back}>← Storefront</button></aside><section className="adminMain"><div className="adminTop"><div><small>KARIA OPERATIONS</small><h1>{tab}</h1></div><div className="owners"><b>Ownership</b><span>Partner A 50%</span><span>Partner B 50%</span></div></div>{notice&&<div className="notice">{notice}</div>}{loading?<div className="panel">Loading…</div>:module()}</section>
{viewingOrder&&<OrderDetailModal order={viewingOrder} onClose={()=>setViewingOrder(null)}/>}
{editingProduct&&<div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingProduct(null)}}><div className="editModal"><div className="editModalHead"><div><small>EDIT PRODUCT</small><h2>{editingProduct.name}</h2></div><button type="button" onClick={()=>setEditingProduct(null)}>×</button></div><form className="editModalForm" onSubmit={saveProductEdit}><label>Product name<input name="name" defaultValue={editingProduct.name||''} required/></label><label>SKU<input name="sku" defaultValue={editingProduct.sku||''} required/></label><label>Brand<select name="brand_id" defaultValue={editingProduct.brand_id||''}><option value="">No brand</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Category<select name="category" defaultValue={editingProduct.category||''} required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>Sale price<input name="price" type="number" step="0.01" defaultValue={editingProduct.price??''}/></label><label>Unit cost<input name="unit_cost" type="number" step="0.01" defaultValue={editingProduct.unit_cost??''}/></label><label>Weight<input name="weight" type="number" step="0.001" defaultValue={editingProduct.weight??''}/></label><label>Low stock alert<input name="low_stock_threshold" type="number" defaultValue={editingProduct.low_stock_threshold??2}/></label><label>Materials<input name="materials" defaultValue={editingProduct.materials||''}/></label><label>Dimensions<input name="dimensions" defaultValue={editingProduct.dimensions||''}/></label><label className="full">Description<textarea name="description" defaultValue={editingProduct.description||''}/></label><label>Status<select name="active" defaultValue={editingProduct.active===false?'false':'true'}><option value="true">Active / Published</option><option value="false">Archived / Hidden</option></select></label><label className="editCheck"><input name="featured" type="checkbox" defaultChecked={!!editingProduct.featured}/> Featured product</label><div className="editModalActions full"><button type="button" onClick={()=>setEditingProduct(null)}>CANCEL</button><button type="submit">SAVE PRODUCT</button></div></form></div></div>}
{editingMovement&&<div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingMovement(null)}}><div className="editModal inventoryEditModal"><div className="editModalHead"><div><small>EDIT INVENTORY MOVEMENT</small><h2>{editingMovement.products?.name||'Inventory entry'}</h2></div><button type="button" onClick={()=>setEditingMovement(null)}>×</button></div><form className="editModalForm" onSubmit={saveMovementEdit}><label className="full">Product<select name="product_id" defaultValue={editingMovement.product_id||''} required>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><label>Quantity<input name="qty" type="number" defaultValue={editingMovement.qty??editingMovement.quantity??''} required/></label><label>Movement type<select name="movement_type" defaultValue={editingMovement.movement_type||'ADJUST'}><option value="IN">IN / RECEIVED</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select></label><label className="full">Reason / reference<textarea name="note" defaultValue={String(editingMovement.note||'').replace(/^OPENING STOCK\s*[·-]?\s*/i,'')}/></label><div className="editModalActions full"><button type="button" onClick={()=>setEditingMovement(null)}>CANCEL</button><button type="submit">SAVE MOVEMENT</button></div></form></div></div>}
</div>
}
function orderPhoto(item){const media=[...(item?.products?.product_media||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));return media.find(m=>String(m.media_type||'image').startsWith('image'))?.url||media[0]?.url||''}
function OrderAdminTable({rows,onView,onDelete}){
 if(!rows?.length)return <div className="panel empty">No orders yet.</div>;
 return <div className="orderAdminGrid">{rows.map(o=>{const items=o.order_items||[],first=items[0],photo=orderPhoto(first),status=String(o.status||'pending').toLowerCase(),canDelete=true;return <article className="orderAdminCard" key={o.id}><div className="orderCardPhoto">{photo?<img src={photo} alt={first?.products?.name||'Order product'}/>:<div>NO PHOTO</div>}{items.length>1&&<span>+{items.length-1}</span>}</div><div className="orderCardBody"><div className="orderCardTop"><div><small>ORDER</small><h3>#{o.order_number||'—'}</h3></div><span className={`orderStatus ${status}`}>{status.toUpperCase()}</span></div><div className="orderProductName">{first?.products?.name||'Order'}{items.length>1?` + ${items.length-1} more`:''}</div><div className="orderMeta"><span>{o.created_at?new Date(o.created_at).toLocaleString():''}</span><span>{o.email||''}</span></div><div className="orderCardBottom"><div><small>CUSTOMER PAID</small><strong>${Number(o.total||0).toFixed(2)}</strong></div><div><small>STRIPE FEE</small><strong>−${Number(o.processor_fee||0).toFixed(2)}</strong></div><div><small>NET AFTER STRIPE</small><strong>${(Number(o.total||0)-Number(o.processor_fee||0)).toFixed(2)}</strong></div><div className="rowActionButtons"><button onClick={()=>onView(o)}>VIEW ORDER</button>{canDelete&&<button className="dangerBtn" onClick={()=>onDelete(o)}>DELETE</button>}</div></div></div></article>})}</div>
}
function OrderDetailModal({order,onClose}){const items=order.order_items||[],addr=order.shipping_address||{};return <div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="editModal orderDetailModal"><div className="editModalHead"><div><small>ORDER DETAILS</small><h2>Order #{order.order_number||'—'}</h2><span className={`orderStatus ${String(order.status||'').toLowerCase()}`}>{String(order.status||'').toUpperCase()}</span></div><button type="button" onClick={onClose}>×</button></div><section className="orderDetailProducts">{items.map((it,i)=>{const photo=orderPhoto(it);return <div className="orderDetailProduct" key={it.id||i}>{photo?<img src={photo} alt={it.products?.name||'Product'}/>:<div className="orderDetailNoPhoto">NO PHOTO</div>}<div><h3>{it.products?.name||'Product'}</h3><span>{it.products?.sku||''}</span><p>{it.products?.description||''}</p></div><div className="orderDetailPrice"><span>{it.qty} × ${Number(it.unit_price||0).toFixed(2)}</span><strong>${(Number(it.qty||0)*Number(it.unit_price||0)).toFixed(2)}</strong></div></div>})}</section><div className="orderDetailColumns"><section><small>CUSTOMER</small><h3>{order.email||'—'}</h3><p>{order.created_at?new Date(order.created_at).toLocaleString():''}</p></section><section><small>SHIPPING ADDRESS</small><h3>{addr.name||addr.full_name||''}</h3><p>{[addr.address_line1||addr.line1,addr.address_line2||addr.line2,addr.city,addr.state,addr.postal_code||addr.zip,addr.country].filter(Boolean).join(', ')||'No shipping address saved'}</p></section></div><div className="orderTotals"><div><span>Subtotal</span><b>${Number(order.subtotal||0).toFixed(2)}</b></div><div><span>Discount</span><b>−${Number(order.discount||0).toFixed(2)}</b></div><div><span>Shipping</span><b>${Number(order.shipping||0).toFixed(2)}</b></div><div><span>Tax</span><b>${Number(order.tax||0).toFixed(2)}</b></div><div><span>Stripe processing fee</span><b>−${Number(order.processor_fee||0).toFixed(2)}</b></div><div className="orderGrandTotal"><span>Customer paid</span><strong>${Number(order.total||0).toFixed(2)}</strong></div><div><span>Net after Stripe</span><b>${(Number(order.total||0)-Number(order.processor_fee||0)).toFixed(2)}</b></div><div><span>Product cost / COGS</span><b>−${items.reduce((sum,it)=>sum+Number(it.qty||0)*Number(it.unit_cost||0),0).toFixed(2)}</b></div><div className="orderGrandTotal"><span>Final profit</span><strong>${(Number(order.subtotal||0)-Number(order.discount||0)-Number(order.shipping||0)-Number(order.tax||0)-Number(order.processor_fee||0)-items.reduce((sum,it)=>sum+Number(it.qty||0)*Number(it.unit_cost||0),0)).toFixed(2)}</strong></div></div>{(order.carrier||order.tracking_number)&&<div className="orderTracking"><small>SHIPPING / TRACKING</small><p>{order.carrier||''} {order.tracking_number||''}</p></div>}<div className="orderPaymentRef"><small>PAYMENT REFERENCE</small><span>Stripe session: {order.stripe_session_id||'—'}</span><span>Payment intent: {order.stripe_payment_intent||'—'}</span></div><div className="editModalActions"><button type="button" onClick={onClose}>CLOSE</button></div></div></div>}

function ProductAdminTable({rows,onEdit,onDelete}){
 if(!rows?.length)return <div className="panel empty">No products yet.</div>;
 return <div className="tableWrap productAdminTable"><table><thead><tr><th>PHOTO</th><th>PRODUCT</th><th>CATEGORY</th><th>SKU</th><th>DESCRIPTION</th><th>PRICE</th><th>COST</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{rows.map((r,i)=>{
   const media=[...(r.product_media||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
   const photo=media.find(m=>String(m.media_type||'image').startsWith('image'))?.url||media[0]?.url||'';
   return <tr key={r.id||i}><td>{photo?<img className="adminProductThumb" src={photo} alt={r.name||'Product'}/>:<div className="adminProductThumb emptyThumb">NO PHOTO</div>}</td><td><b>{r.name||''}</b></td><td>{r.category||''}</td><td>{r.sku||''}</td><td className="productDescCell">{r.description||''}</td><td>{r.price==null?'':`$${Number(r.price).toFixed(2)}`}</td><td>{r.unit_cost==null?'':`$${Number(r.unit_cost).toFixed(2)}`}</td><td>{r.active===false?'ARCHIVED':'ACTIVE'}</td><td className="actionsCell"><div className="rowActionButtons"><button onClick={()=>onEdit(r)}>EDIT</button><button className="dangerBtn" onClick={()=>onDelete(r)}>DELETE</button></div></td></tr>
 })}</tbody></table></div>
}

function DataTable({rows,actions}){if(!rows?.length)return <div className="panel empty">No records yet.</div>;const keys=Object.keys(rows[0]).filter(k=>!['metadata','after_data','before_data'].includes(k)).slice(0,7);return <div className="tableWrap"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}{actions&&<th>ACTIONS</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{keys.map(k=><td key={k}>{typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k]??'')}</td>)}{actions&&<td className="actionsCell">{actions(r)}</td>}</tr>)}</tbody></table></div>}

createRoot(document.getElementById("root")).render(<App/>);
