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


function StoreHeader({cartCount,onCart}){
 return <header><a className="logo" href="/">KARIA</a><nav><a href="/shop">SHOP / CATALOG</a><a href="/#story">THE CRAFT</a><a href="/#brands">BRANDS</a><a href="/#contact">CONTACT</a></nav><div className="actions"><a className="iconLink" href="/shop"><Search/></a><button className="bag" onClick={onCart}><ShoppingBag/><b>{cartCount}</b></button></div></header>
}
function CartDrawer({open,setOpen,cart,setCart,checkout}){
 if(!open)return null;return <div className="accountBackdrop" onMouseDown={()=>setOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setOpen(false)}><X/></button><div className="accountBrand">KARIA</div><small className="accountEyebrow">YOUR BAG</small><h2>{cart.length?`${cart.length} piece${cart.length>1?'s':''}`:'Your bag is empty'}</h2><div className="cartList">{cart.map((p,i)=><div className="cartRow" key={`${p.id}-${i}`}><img src={p.img}/><div><b>{p.name}</b><small>${Number(p.price).toFixed(2)}</small></div><button onClick={()=>setCart(c=>c.filter((_,x)=>x!==i))}>×</button></div>)}</div>{cart.length>0&&<><div className="cartTotal"><span>Total</span><b>${cart.reduce((s,p)=>s+Number(p.price),0).toFixed(2)}</b></div><button type="button" className="accountPrimary secureCheckoutBtn" onClick={(e)=>{e.preventDefault();e.stopPropagation();checkout()}}>SECURE CHECKOUT <ArrowRight/></button></>}</section></div>
}
function ShopPage({products,add,cart,setCart,cartOpen,setCartOpen,checkout}){
 const [q,setQ]=useState(''),[sort,setSort]=useState('newest');
 const shown=useMemo(()=>products.filter(p=>`${p.name} ${p.brand} ${p.tone}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:String(a.name).localeCompare(String(b.name))),[products,q,sort]);
 return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout}/><main className="catalogMain"><div className="catalogHero"><small>KARIA COLLECTION</small><h1>Shop the pieces.</h1><p>Handcrafted bags, limited runs and independent makers.</p></div><div className="catalogTools"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products"/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div><div className="catalogGrid">{shown.map(p=><article className="catalogCard" key={p.id}><a href={`/product/${p.id}`}><div className="catalogImage"><img src={p.img}/></div><small>{p.brand}</small><h2>{p.name}</h2></a><div className="catalogBuy"><b>${Number(p.price).toFixed(2)}</b><button onClick={()=>add(p)}>ADD TO BAG</button></div></article>)}</div>{!shown.length&&<div className="catalogEmpty">No products found.</div>}</main></div>
}
function ProductPage({products,id,add,cart,setCart,cartOpen,setCartOpen,checkout}){
 const p=products.find(x=>String(x.id)===String(id));
 if(!p)return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><main className="catalogMain"><div className="catalogHero"><h1>Product not found.</h1><a className="cta" href="/shop">Back to shop <ArrowRight/></a></div></main></div>;
 return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout}/><main className="productPage"><div className="productGallery"><img src={p.img}/></div><div className="productInfo"><small>{p.brand}</small><h1>{p.name}</h1><div className="productPrice">${Number(p.price).toFixed(2)}</div><p>{p.description||'A handcrafted KARIA piece made in a limited run.'}</p>{p.tone&&<div className="productFact"><span>DETAILS</span><b>{p.tone}</b></div>}<div className="productFact"><span>AVAILABILITY</span><b>{p.stock>0?`${p.stock} available`:'Made in limited quantities'}</b></div><button className="productAdd" onClick={()=>add(p)}>ADD TO BAG <ArrowRight/></button><a className="backShop" href="/shop">← Continue shopping</a></div></main></div>
}


function CheckoutPage({cart,setCart,user}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[created,setCreated]=useState(null);
 const grouped=useMemo(()=>Object.values(cart.reduce((a,p)=>{a[p.id]??={...p,qty:0};a[p.id].qty++;return a},{})),[cart]);
 const subtotal=grouped.reduce((sum,p)=>sum+Number(p.price||0)*p.qty,0);
 const submit=async(e)=>{e.preventDefault();if(busy||created)return;setNotice('');if(!user){setNotice('Please sign in before continuing to payment.');return}if(!supabase){setNotice('Supabase is not configured.');return}if(!user){setNotice('Please sign in before placing the order.');return}if(!grouped.length){setNotice('Your bag is empty.');return}setBusy(true);try{const f=Object.fromEntries(new FormData(e.currentTarget));const items=grouped.map(p=>({product_id:p.id,qty:p.qty,quantity:p.qty}));const shipping_address={full_name:f.full_name,address1:f.address1,address2:f.address2||'',city:f.city,state:f.state,postal_code:f.postal_code,country:f.country,phone:f.phone||''};const {data,error}=await supabase.functions.invoke('create-checkout',{body:{items,shipping_address:shipping_address,coupon_code:f.coupon_code||null}});if(error){let msg=error.message;try{const ctx=error.context;if(ctx&&typeof ctx.json==='function'){const body=await ctx.json();msg=body?.error||body?.message||msg}}catch{}throw new Error(msg)}if(!data?.ok)throw new Error(data?.error||'Checkout could not be created.');setCreated(data);setCart([]);localStorage.removeItem('karia_cart');}catch(err){setNotice(err?.message||'Checkout could not be created.')}finally{setBusy(false)}};
 if(created)return <div className="catalogPage"><StoreHeader cartCount={0} onCart={()=>{}}/><main className="checkoutPage"><section className="checkoutSuccess"><small>ORDER RECEIVED</small><h1>Thank you.</h1><p>Your KARIA order <b>#{created.order_number||String(created.order_id||'').slice(0,8)}</b> was created successfully.</p><div className="checkoutSuccessTotal"><span>Total</span><b>${Number(created.total||0).toFixed(2)}</b></div><p className="checkoutPending">Payment is still pending. Stripe payment will be connected in the next checkout step.</p><a className="accountPrimary checkoutLink" href="/shop">CONTINUE SHOPPING <ArrowRight/></a></section></main></div>;
 return <div className="catalogPage"><StoreHeader cartCount={cart.length} onCart={()=>location.href='/shop'}/><main className="checkoutPage"><div className="checkoutIntro"><small>SECURE CHECKOUT</small><h1>Complete your order.</h1><p>Enter the shipping details for your handcrafted KARIA piece.</p></div><div className="checkoutGrid"><form className="checkoutForm" onSubmit={submit}><h2>Shipping details</h2><label>Full name<input name="full_name" required/></label><label>Email<input value={user?.email||''} readOnly placeholder={user?'':'Sign in to continue'}/></label>{!user&&<div className="checkoutAuthNotice">Please sign in to your KARIA account before submitting the order. You can still review your bag and shipping form here.</div>}<label>Address<input name="address1" required/></label><label>Apartment / suite<input name="address2"/></label><div className="checkoutTwo"><label>City<input name="city" required/></label><label>State / Province<input name="state" required/></label></div><div className="checkoutTwo"><label>ZIP / Postal code<input name="postal_code" required/></label><label>Country<select name="country" defaultValue="US"><option value="US">United States</option><option value="NI">Nicaragua</option><option value="SV">El Salvador</option><option value="OTHER">Other</option></select></label></div><label>Phone<input name="phone" type="tel"/></label><label>Coupon code<input name="coupon_code" placeholder="Optional"/></label>{notice&&<p className="checkoutError">{notice}</p>}<button className="checkoutPay" disabled={busy||!cart.length||!user}>{busy?'CREATING ORDER…':user?'CONTINUE TO PAYMENT':'SIGN IN REQUIRED'} <ArrowRight/></button><a className="checkoutBack" href="/shop">← Return to shop</a></form><aside className="checkoutSummary"><small>YOUR ORDER</small><h2>{cart.length} piece{cart.length===1?'':'s'}</h2>{grouped.map(p=><div className="checkoutItem" key={p.id}><img src={p.img}/><div><b>{p.name}</b><span>Qty {p.qty}</span></div><strong>${(Number(p.price)*p.qty).toFixed(2)}</strong></div>)}<div className="checkoutLine"><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div><div className="checkoutLine muted"><span>Shipping</span><span>Calculated next</span></div><div className="checkoutLine muted"><span>Tax</span><span>Calculated next</span></div><div className="checkoutTotal"><span>Total before shipping & tax</span><b>${subtotal.toFixed(2)}</b></div></aside></div></main></div>
}

function App(){
 const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('karia_cart')||'[]')}catch{return []}}),[admin,setAdmin]=useState(false),[menu,setMenu]=useState(false),[active,setActive]=useState(0),[cartOpen,setCartOpen]=useState(false),[storeProducts,setStoreProducts]=useState(products);
 const [accountOpen,setAccountOpen]=useState(false),[user,setUser]=useState(null),[profile,setProfile]=useState(null),[authMode,setAuthMode]=useState("signin"),[authError,setAuthError]=useState(""),[passwordOpen,setPasswordOpen]=useState(false),[passwordNotice,setPasswordNotice]=useState("");
 const progress=useRef(0);
 const add=p=>{setCart(c=>[...c,p]);setCartOpen(true)};
 useEffect(()=>{if(!supabase)return; (async()=>{const [{data},{data:stockRows}]=await Promise.all([supabase.from("products").select("id,name,price,sku,materials,dimensions,description,brand_id,product_media(url,sort_order)").eq("active",true).order("created_at",{ascending:false}),supabase.from("product_stock").select("*")]);const stockMap=Object.fromEntries((stockRows||[]).map(r=>[r.product_id,Number(r.stock??r.quantity??r.qty??0)]));setStoreProducts((data||[]).map((p,i)=>({id:p.id,name:p.name,brand:"KARIA Artisan",price:Number(p.price),img:p.product_media?.sort((a,b)=>a.sort_order-b.sort_order)?.[0]?.url||products[i%products.length].img,stock:stockMap[p.id]||0,tone:p.materials||p.dimensions||"Handcrafted",description:p.description||""})))})()},[]);
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
 if(path==="/checkout") return <CheckoutPage cart={cart} setCart={setCart} user={user}/>;
 if(path==="/shop") return <ShopPage products={storeProducts} add={add} cart={cart} setCart={setCart} cartOpen={cartOpen} setCartOpen={setCartOpen} checkout={checkout}/>;
 if(path.startsWith("/product/")) return <ProductPage products={storeProducts} id={decodeURIComponent(path.split("/").pop())} add={add} cart={cart} setCart={setCart} cartOpen={cartOpen} setCartOpen={setCartOpen} checkout={checkout}/>;
 return <div className="site">
  <header><button className="icon mobile" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><a className="logo" href="#top">KARIA</a>
   <nav className={menu?"open":""}><a href="/shop">SHOP</a><a href="#story">THE CRAFT</a><a href="#brands">BRANDS</a><a href="#contact">CONTACT</a></nav>
   <div className="actions"><Search/><button className="accountIcon" aria-label="Account" onClick={()=>setAccountOpen(true)}><User/></button><button className="bag" onClick={()=>setCartOpen(true)}><ShoppingBag/><b>{cart.length}</b></button></div>
  </header>
  {cartOpen&&<div className="accountBackdrop" onMouseDown={()=>setCartOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setCartOpen(false)}><X/></button><div className="accountBrand">KARIA</div><small className="accountEyebrow">YOUR BAG</small><h2>{cart.length?`${cart.length} piece${cart.length>1?"s":""}`:"Your bag is empty"}</h2><div className="cartList">{cart.map((p,i)=><div className="cartRow" key={`${p.id}-${i}`}><img src={p.img}/><div><b>{p.name}</b><small>${Number(p.price).toFixed(2)}</small></div><button onClick={()=>setCart(c=>c.filter((_,x)=>x!==i))}>×</button></div>)}</div>{cart.length>0&&<><div className="cartTotal"><span>Total</span><b>${cart.reduce((s,p)=>s+Number(p.price),0).toFixed(2)}</b></div><button type="button" className="accountPrimary secureCheckoutBtn" onClick={(e)=>{e.preventDefault();e.stopPropagation();checkout()}}>SECURE CHECKOUT <ArrowRight/></button></>}</section></div>}{accountOpen&&<div className="accountBackdrop" onMouseDown={()=>setAccountOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setAccountOpen(false)}><X/></button><div className="accountBrand">KARIA</div>{user?<><small className="accountEyebrow">MY ACCOUNT</small><h2>{profile?.full_name||user.email?.split("@")[0]}</h2><p className="accountEmail">{user.email}</p><div className="accountRole">{profile?.role?.replace("_"," ")||"customer"}</div><button className="accountSecondary passwordAction" onClick={()=>{setAccountOpen(false);setPasswordNotice("");setPasswordOpen(true)}}>CHANGE PASSWORD</button>{canAdmin&&<button className="accountPrimary" onClick={()=>{setAccountOpen(false);setAdmin(true)}}>OPEN ADMINISTRATION <ArrowRight/></button>}<button className="accountSecondary" onClick={signOut}>SIGN OUT</button></>:<><small className="accountEyebrow">WELCOME TO KARIA</small><h2>{authMode==="signin"?"Sign in":"Create account"}</h2><p className="accountIntro">Access your orders, saved details and KARIA account.</p><form onSubmit={submitAuth}>{authMode==="signup"&&<input name="name" placeholder="Full name" required/>}<input name="email" type="email" placeholder="Email address" required/><input name="password" type="password" placeholder="Password" minLength="6" required/>{authError&&<p className="authError">{authError}</p>}<button className="accountPrimary" type="submit">{authMode==="signin"?"SIGN IN":"CREATE ACCOUNT"}<ArrowRight/></button></form><button className="accountSwitch" onClick={()=>{setAuthError("");setAuthMode(authMode==="signin"?"signup":"signin")}}>{authMode==="signin"?"New to KARIA? Create an account":"Already have an account? Sign in"}</button></>}</section></div>}{passwordOpen&&<div className="accountBackdrop" onMouseDown={()=>{if(!mustChangePassword)setPasswordOpen(false)}}><section className="accountPanel securityPanel" onMouseDown={e=>e.stopPropagation()}>{!mustChangePassword&&<button className="accountClose" onClick={()=>setPasswordOpen(false)}><X/></button>}<div className="accountBrand">KARIA</div><small className="accountEyebrow">ACCOUNT SECURITY</small><h2>{mustChangePassword?"Create your new password":"Change password"}</h2><p className="accountIntro">{mustChangePassword?"Your account was created with a temporary password. Choose your private password before continuing.":"Choose a new password for your KARIA account."}</p><form onSubmit={changePassword}><input name="new_password" type="password" placeholder="New password" minLength="8" autoComplete="new-password" required/><input name="confirm_password" type="password" placeholder="Confirm new password" minLength="8" autoComplete="new-password" required/>{passwordNotice&&<p className={passwordNotice.startsWith("Password updated")?"authSuccess":"authError"}>{passwordNotice}</p>}<button className="accountPrimary" type="submit">UPDATE PASSWORD <ArrowRight/></button></form>{mustChangePassword&&<button className="accountSecondary" onClick={signOut}>SIGN OUT</button>}</section></div>}
  <main id="top">
   <section className="heroCine">
    <div className="heroWords"><div className="eyebrow">HANDCRAFTED · CURATED BY KARIA</div><h1><span>Made by hand.</span><em>Made to be yours.</em></h1><p>Wearable pieces of craft, made slowly and chosen with intention.</p><a href="/shop" className="cta">Explore the collection <ArrowRight/></a></div>
    <div className="canvasWrap"><Canvas camera={{position:[0,0,6.4],fov:34}} dpr={[1,1.6]} gl={{alpha:true,antialias:true}}><HeroScene progress={progress}/></Canvas></div>
    <div className="heroVertical">KARIA · HANDCRAFTED STORIES · 2026</div><div className="scrollOrb"><MoveDown/><span>SCROLL</span></div>
   </section>

   <section className="statement"><div className="marquee"><span>HANDWOVEN&nbsp; · &nbsp;SMALL BATCH&nbsp; · &nbsp;ONE OF A KIND&nbsp; · &nbsp;MADE SLOWLY&nbsp; · &nbsp;</span><span>HANDWOVEN&nbsp; · &nbsp;SMALL BATCH&nbsp; · &nbsp;ONE OF A KIND&nbsp; · &nbsp;MADE SLOWLY&nbsp; · &nbsp;</span></div><p>KARIA is a home for independent craft — a place where every bag keeps the name, mark and story of the hands behind it.</p></section>

   <section className="craftScene" id="story"><div className="stickyMedia"><img src="/products/bag-blue.jpg"/><div className="scan"></div><div className="materialTag t1">01 / HANDWOVEN BODY</div><div className="materialTag t2">02 / WOVEN STRAP</div><div className="materialTag t3">03 / GOLD HARDWARE</div></div><div className="craftCopy"><div className="chapter"><small>01 — THE CRAFT</small><h2>Texture you can<br/><i>almost touch.</i></h2><p>Every loop, edge and detail carries evidence of the maker. We put that workmanship at the center of the experience.</p></div><div className="chapter"><small>02 — THE DETAILS</small><h2>Designed slowly.<br/><i>Worn endlessly.</i></h2><p>Close-up storytelling, movement and light reveal what a flat product grid normally hides.</p></div></div></section>

   <section className="film"><video src="/products/bag-video.mp4" muted autoPlay loop playsInline/><div className="filmShade"></div><div className="filmCopy"><button><Play fill="currentColor"/> CRAFT IN MOTION</button><h2>Not manufactured.<br/><i>Made.</i></h2><p>A slower process creates pieces with a different kind of value.</p></div><div className="filmIndex">K / 02</div></section>

   <section className="orbitShowcase" id="brands"><div className="orbitCopy"><small>03 — CURATED BRANDS</small><h2>Different makers.<br/>One point of view.</h2><p>KARIA is the destination. Every artisan brand keeps its own identity, logo and story.</p></div><div className="orbitStage"><div className="orbitRing r1"></div><div className="orbitRing r2"></div><img className="orbitBag one" src="/products/bag-brown.jpg"/><img className="orbitBag two" src="/products/bag-blue.jpg"/><span className="orbitLabel l1">ARTISAN 01</span><span className="orbitLabel l2">ARTISAN 02</span></div></section>

   <section id="shop" className="shop homeEditorial"><div className="sectionHead"><div><span>04 — SHOP THE COLLECTION</span><h2>Objects with a soul.</h2></div><p>Limited pieces. Small runs.<br/>Made to live with you.</p></div><div className="editorialGrid"><div className="editorialImage"><img src="/products/bag-brown.jpg"/></div><div className="editorialImage second"><img src="/products/bag-blue.jpg"/></div></div><div className="editorialCta"><a className="cta" href="/shop">ENTER THE SHOP <ArrowRight/></a></div></section>

   <section className="closing"><div className="closingWord">KARIA</div><div className="closingCard"><small>THE KARIA EDIT</small><h2>Carry something<br/>with a story.</h2><a href="/shop">Discover the collection <ArrowRight/></a></div><img src="/products/bag-detail.jpg"/></section>
  </main>
  <footer id="contact"><div><div className="logo">KARIA</div><p>Handcrafted bags & accessories.<br/>Curated with intention.</p></div><div className="footLinks"><a href="/shop">Shop</a><a href="#story">Our story</a><a href="#brands">Brands</a><a href="#">Shipping & returns</a></div><div className="newsletter"><small>JOIN THE KARIA LETTER</small><div><input placeholder="Your email address"/><button>→</button></div></div>{canAdmin&&<button className="adminLink" onClick={()=>setAdmin(true)}>Admin</button>}<div className="copyright">© 2026 KARIA · HANDCRAFTED STORIES</div></footer>
 </div>
}

function Admin({back}){
 const [tab,setTab]=useState('Dashboard'),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState('');
 const [brands,setBrands]=useState([]),[productsList,setProductsList]=useState([]),[uploading,setUploading]=useState(false);
 const [stats,setStats]=useState({revenue:0,orders:0,inventory:0,net:0});
 const [inventorySummary,setInventorySummary]=useState([]),[inventoryTotals,setInventoryTotals]=useState({opening:0,received:0,sold:0,out:0,returns:0,adjustments:0,current:0,value:0});
 const [currentAdmin,setCurrentAdmin]=useState(null),[currentUserId,setCurrentUserId]=useState(null);
 const nav=[["Dashboard",BarChart3],["Orders",ShoppingBag],["Products",Package],["Brands",ShieldCheck],["Inventory",Boxes],["Production",Settings],["Customers",Users],["Accounting",Wallet],["Reports",BarChart3],["Admin users",Users],["Materials",Boxes],["Coupons",ShoppingBag],["Settings",Settings]];
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
 const load=async()=>{if(!supabase)return;setLoading(true);setNotice('');try{
  const table={Orders:'orders',Products:'products',Brands:'brands',Inventory:'inventory_movements',Production:'production_orders',Customers:'profiles',Accounting:'expenses','Admin users':'profiles',Materials:'materials',Coupons:'coupons'}[tab];
  if(table){let q=tab==='Inventory'?supabase.from('inventory_movements').select('*, products(name,sku)').order('created_at',{ascending:false}).limit(100):supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100);if(tab==='Admin users')q=q.in('role',['staff','admin','super_admin']);const {data,error}=await q;if(error)throw error;setRows(data||[])}
  const [{data:o},{data:im},{data:ex}]=await Promise.all([supabase.from('orders').select('total,status'),supabase.from('inventory_movements').select('quantity,qty,movement_type'),supabase.from('expenses').select('amount')]);
  const paid=(o||[]).filter(x=>['paid','processing','shipped','delivered'].includes(String(x.status).toLowerCase()));const rev=paid.reduce((s,x)=>s+Number(x.total||0),0);const inv=(im||[]).reduce((s,x)=>{const n=Number(x.quantity??x.qty??0);return s+(['out','sale','consume'].includes(String(x.movement_type).toLowerCase())?-Math.abs(n):n)},0);const expenses=(ex||[]).reduce((s,x)=>s+Number(x.amount||0),0);setStats({revenue:rev,orders:(o||[]).length,inventory:inv,net:rev-expenses});
  if(tab==='Inventory')await loadInventoryAccounting();
 }catch(e){setNotice(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[tab]);
 useEffect(()=>{if(!supabase)return;(async()=>{const {data:{user}}=await supabase.auth.getUser();setCurrentUserId(user?.id||null);if(user?.id){const {data}=await supabase.from('profiles').select('id,role').eq('id',user.id).single();setCurrentAdmin(data||null)}})()},[]);
 useEffect(()=>{if(!supabase)return;(async()=>{const [{data:b},{data:p}]=await Promise.all([supabase.from('brands').select('id,name').eq('active',true).order('name'),supabase.from('products').select('id,name,sku').eq('active',true).order('name')]);setBrands(b||[]);setProductsList(p||[])})()},[tab,notice]);
 const create=async(e,kind)=>{e.preventDefault();const form=e.currentTarget;const imageFiles=kind==='product'?Array.from(form.elements?.images?.files||[]):[];const f=Object.fromEntries(new FormData(form));setNotice('');try{
  if(kind==='brand'){const {error}=await supabase.from('brands').insert({name:f.name,slug:String(f.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),story:f.description||null});if(error)throw error}
  if(kind==='product'){setUploading(true);const payload={name:f.name,sku:f.sku,description:f.description||null,materials:f.materials||null,dimensions:f.dimensions||null,price:Number(f.price||0),unit_cost:Number(f.cost||0),brand_id:f.brand_id||null,weight:f.weight?Number(f.weight):null,low_stock_threshold:Number(f.low_stock_threshold||2),featured:f.featured==='on',active:f.publish_shop!=='off',slug:String(f.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Date.now().toString().slice(-5)};const {data,error}=await supabase.from('products').insert(payload).select().single();if(error)throw error;const files=imageFiles;for(let i=0;i<files.length;i++){const file=files[i];const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${data.id}/${Date.now()}-${i}.${ext}`;const {error:ue}=await supabase.storage.from('product-media').upload(path,file,{upsert:false,contentType:file.type});if(ue)throw ue;const {data:pub}=supabase.storage.from('product-media').getPublicUrl(path);const {error:me}=await supabase.from('product_media').insert({product_id:data.id,url:pub.publicUrl,media_type:file.type.startsWith('video/')?'video':'image',sort_order:i});if(me)throw me}setUploading(false)}
  if(kind==='inventory'){const isOpening=f.movement_type==='OPENING_UI';const movementType=isOpening?'ADJUST':f.movement_type;const note=isOpening?`OPENING STOCK${f.note?' · '+f.note:''}`:(f.note||null);const {error}=await supabase.from('inventory_movements').insert({product_id:f.product_id,qty:Number(f.quantity),movement_type:movementType,note});if(error)throw error}
  if(kind==='production'){const {error}=await supabase.from('production_orders').insert({product_id:f.product_id,qty:Number(f.quantity),status:'pending'});if(error)throw error}
  if(kind==='expense'){const {error}=await supabase.from('expenses').insert({description:f.description,amount:Number(f.amount),category:f.category||'Operating',expense_date:f.expense_date||new Date().toISOString().slice(0,10)});if(error)throw error}
  if(kind==='material'){const {error}=await supabase.from('materials').insert({name:f.name,sku:f.sku||null,unit:f.unit||'unit',unit_cost:Number(f.unit_cost||0),stock:Number(f.stock||0)});if(error)throw error}
  if(kind==='coupon'){const {error}=await supabase.from('coupons').insert({code:String(f.code).toUpperCase(),percent_off:f.percent_off?Number(f.percent_off):null,amount_off:f.amount_off?Number(f.amount_off):null,active:true,ends_at:f.ends_at||null});if(error)throw error}
  if(kind==='settings'){for(const [key,value] of Object.entries({store:{name:f.store_name||'KARIA',currency:f.currency||'USD'},shipping:{default_rate:Number(f.shipping_rate||0),free_shipping_over:Number(f.free_shipping_over||0)},legal:{returns_days:Number(f.returns_days||14)}})){const {error}=await supabase.from('settings').upsert({key,value,updated_at:new Date().toISOString()});if(error)throw error}}
  form.reset();setNotice('Saved successfully.');await load();
 }catch(err){setUploading(false);setNotice(err.message)}};
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
  if(!['pending','cancelled','canceled'].includes(status)){
    setNotice('Only pending/cancelled test orders can be deleted. Paid orders must be cancelled/refunded so the accounting history is preserved.');
    return;
  }
  if(!window.confirm(`Delete test order #${order.order_number||''}?\n\nThis will also delete its order items. Products and inventory will NOT be deleted.`))return;
  setNotice('');
  try{
    const {error:itemsError}=await supabase.from('order_items').delete().eq('order_id',order.id);
    if(itemsError)throw itemsError;
    const {error:orderError}=await supabase.from('orders').delete().eq('id',order.id);
    if(orderError)throw orderError;
    setNotice(`Order #${order.order_number||''} deleted.`);
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
 const deleteProduct=async(product)=>{
  if(!product?.id)return;
  const ok=window.confirm(`Delete "${product.name||'this product'}"?\n\nIf it already has sales or production history, KARIA will archive it instead so accounting/history are preserved.`);
  if(!ok)return;
  setNotice('');
  try{
    const [{count:orderCount,error:oe},{count:productionCount,error:pe}]=await Promise.all([
      supabase.from('order_items').select('id',{count:'exact',head:true}).eq('product_id',product.id),
      supabase.from('production_orders').select('id',{count:'exact',head:true}).eq('product_id',product.id)
    ]);
    if(oe)throw oe;if(pe)throw pe;
    if((orderCount||0)>0||(productionCount||0)>0){
      const {error}=await supabase.from('products').update({active:false}).eq('id',product.id);
      if(error)throw error;
      setNotice('Product has transaction history, so it was archived instead of permanently deleted.');
    }else{
      const {data:media,error:me}=await supabase.from('product_media').select('url').eq('product_id',product.id);
      if(me)throw me;
      const {error:ie}=await supabase.from('inventory_movements').delete().eq('product_id',product.id);
      if(ie)throw ie;
      const {error:de}=await supabase.from('products').delete().eq('id',product.id);
      if(de)throw de;
      const paths=(media||[]).map(m=>{
        const marker='/storage/v1/object/public/product-media/';
        const i=String(m.url||'').indexOf(marker);
        return i>=0?decodeURIComponent(String(m.url).slice(i+marker.length)):null;
      }).filter(Boolean);
      if(paths.length)await supabase.storage.from('product-media').remove(paths);
      setNotice('Product deleted successfully.');
    }
    await load();
  }catch(err){setNotice(err?.message||String(err))}
 };
 const cards=[["Revenue",`$${stats.revenue.toFixed(2)}`,Wallet],["Orders",String(stats.orders),ShoppingBag],["Inventory",String(stats.inventory),Boxes],["Net result",`$${stats.net.toFixed(2)}`,BarChart3]];
 const Field=({name,placeholder,type='text',required=false})=><input name={name} placeholder={placeholder} type={type} required={required}/>;
 const module=()=>{
  if(tab==='Dashboard')return <><div className="cards">{cards.map(([a,b,I])=><div key={a}><I/><small>{a}</small><strong>{b}</strong><em>Live from Supabase</em></div>)}</div><div className="adminGrid"><div className="panel"><h2>Inventory movements</h2><p>Sales, production, returns and adjustments remain auditable.</p></div><div className="panel"><h2>Accounting engine</h2><p>Order → payment → sales → tax → fees → COGS → inventory → reports.</p><div className="flow">SALE → INVENTORY → LEDGER → REPORTS</div></div></div></>;
  if(tab==='Orders')return <><div className="adminSectionHead"><div><small>ORDER HISTORY</small><h2>Orders</h2><p className="formHelp">During testing, pending orders can be deleted. Adding products to the cart or opening Checkout does not create an order; an order is created only when the checkout form is submitted.</p></div></div><DataTable rows={rows} actions={r=><button className="dangerBtn" disabled={!['pending','cancelled','canceled'].includes(String(r.status||'').toLowerCase())} onClick={()=>deleteOrder(r)}>DELETE ORDER</button>}/></>;
  if(tab==='Brands')return <><form className="adminForm" onSubmit={e=>create(e,'brand')}><h2>New brand</h2><Field name="name" placeholder="Brand name" required/><Field name="description" placeholder="Story / description"/><button>CREATE BRAND</button></form><DataTable rows={rows}/></>;
  if(tab==='Products')return <><form className="adminForm wide productForm" onSubmit={e=>create(e,'product')}><h2>New product</h2><p className="formHelp">Step 1: create the product and publish it to the Shop. Stock starts at 0. Step 2: go to Inventory to enter the real quantity available.</p><Field name="name" placeholder="Product name" required/><Field name="sku" placeholder="SKU" required/><select name="brand_id"><option value="">Select brand (optional)</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><Field name="price" placeholder="Sale price" type="number" required/><Field name="cost" placeholder="Unit cost" type="number"/><Field name="weight" placeholder="Weight" type="number"/><Field name="low_stock_threshold" placeholder="Low stock alert (default 2)" type="number"/><Field name="materials" placeholder="Materials"/><Field name="dimensions" placeholder="Dimensions"/><Field name="category" placeholder="Category (e.g. Handbags)"/><textarea name="description" placeholder="Description and story"/><label className="uploadBox"><b>PRODUCT PHOTOS / VIDEO</b><span>Choose one or several images. The first image becomes the main product photo.</span><input name="images" type="file" accept="image/*,video/mp4,video/webm" multiple required/></label><label className="checkLine"><input name="publish_shop" type="checkbox" defaultChecked/> Publish in KARIA Shop</label><label className="checkLine"><input name="featured" type="checkbox"/> Featured product</label><button disabled={uploading}>{uploading?'UPLOADING MEDIA…':'CREATE PRODUCT + UPLOAD MEDIA'}</button></form><DataTable rows={rows} actions={r=><button className="dangerBtn" onClick={()=>deleteProduct(r)}>DELETE</button>}/></>;
  if(tab==='Inventory')return <><section className="inventoryHero"><div><small>LIVE INVENTORY CONTROL</small><h2>Inventory accounting</h2><p>Every product keeps a permanent movement history. Opening stock + receipts + returns + adjustments − sales − other outputs = current stock.</p></div><div><small>INVENTORY VALUE AT COST</small><strong>${inventoryTotals.value.toFixed(2)}</strong></div></section><div className="inventoryKpis"><div><span>Opening stock</span><strong>{inventoryTotals.opening}</strong></div><div><span>Received</span><strong>+{inventoryTotals.received}</strong></div><div><span>Sales</span><strong>-{inventoryTotals.sold}</strong></div><div><span>Returns</span><strong>+{inventoryTotals.returns}</strong></div><div><span>Other OUT</span><strong>-{inventoryTotals.out}</strong></div><div className="currentKpi"><span>Current stock</span><strong>{inventoryTotals.current}</strong></div></div><section className="inventorySummary"><div className="inventorySectionTitle"><div><small>PRODUCT LEDGER</small><h3>Inventory by product</h3></div><span>{inventorySummary.length} products</span></div><div className="tableWrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>OPENING</th><th>RECEIVED</th><th>SALES</th><th>RETURNS</th><th>OTHER OUT</th><th>ADJ.</th><th>CURRENT</th><th>VALUE</th></tr></thead><tbody>{inventorySummary.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.sku||'—'}</td><td>{r.opening}</td><td className="positive">+{r.received}</td><td className="negative">-{r.sold}</td><td className="positive">+{r.returns}</td><td className="negative">-{r.out}</td><td>{r.adjustments}</td><td><span className={r.current<=0?'stockPill zero':'stockPill'}>{r.current}</span></td><td>${r.value.toFixed(2)}</td></tr>)}</tbody></table></div></section><form className="adminForm wide" onSubmit={e=>create(e,'inventory')}><h2>Add inventory movement</h2><p className="formHelp">Use OPENING STOCK only when entering the first physical count of a product. Use IN for later receipts. Sales will be recorded automatically by the order system.</p><select name="product_id" required><option value="">Select product</option>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><Field name="quantity" placeholder="Quantity" type="number" required/><select name="movement_type"><option value="OPENING_UI">OPENING STOCK</option><option value="IN">IN / RECEIVED</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select><Field name="note" placeholder="Reason / reference"/><button>POST MOVEMENT</button></form><div className="inventorySectionTitle movementHead"><div><small>INVENTORY ENTRIES</small><h3>Movement history · delete manual entries here</h3></div></div><div className="inventoryHistory tableWrap">{rows.length===0?<div className="emptyInventory">No inventory movements yet.</div>:<table><thead><tr><th>DATE</th><th>PRODUCT</th><th>SKU</th><th>MOVEMENT</th><th>QTY</th><th>REASON / REFERENCE</th><th>ACTION</th></tr></thead><tbody>{rows.map(r=>{const note=String(r.note||'');const isOpening=note.toLowerCase().includes('opening stock');const movement=isOpening?'OPENING STOCK':r.movement_type==='IN'?'RECEIVED / IN':r.movement_type==='OUT'?'OUT':r.movement_type==='RETURN'?'RETURN':r.movement_type==='PRODUCTION_IN'?'PRODUCTION IN':r.movement_type==='ADJUST'?'ADJUSTMENT':(r.movement_type||'');return <tr key={r.id}><td>{r.created_at?new Date(r.created_at).toLocaleString():''}</td><td><b>{r.products?.name||''}</b></td><td>{r.products?.sku||''}</td><td><span className="movementPill">{movement}</span></td><td><b>{r.qty??''}</b></td><td>{isOpening?note.replace(/^OPENING STOCK\s*[·-]?\s*/i,''):note}</td><td><button className="dangerBtn" onClick={()=>deleteInventoryMovement(r)}>DELETE</button></td></tr>})}</tbody></table>}</div></>;
  if(tab==='Production')return <><form className="adminForm wide" onSubmit={e=>create(e,'production')}><h2>Production order</h2><select name="product_id" required><option value="">Select product</option>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><Field name="quantity" placeholder="Quantity to make" type="number" required/><Field name="notes" placeholder="Materials / artisan notes"/><button>CREATE PRODUCTION ORDER</button></form><DataTable rows={rows}/></>;
  if(tab==='Accounting')return <><form className="adminForm wide" onSubmit={e=>create(e,'expense')}><h2>Record expense</h2><Field name="description" placeholder="Description" required/><Field name="amount" placeholder="Amount" type="number" required/><Field name="category" placeholder="Category"/><Field name="expense_date" type="date"/><button>POST EXPENSE</button></form><DataTable rows={rows}/></>;
  if(tab==='Reports')return <div className="reportGrid">{cards.map(([a,b])=><div className="panel" key={a}><small>{a}</small><h2>{b}</h2></div>)}<div className="panel"><h2>Ownership</h2><p>Partner A 50% · Partner B 50%. Capital contributions and distributions are tracked independently from ownership.</p></div></div>;
  if(tab==='Admin users')return <><form className="adminForm wide" onSubmit={createAdmin}><h2>Create administrator</h2><Field name="full_name" placeholder="Full name" required/><Field name="email" placeholder="Email" type="email" required/><select name="role"><option value="admin">Admin</option><option value="staff">Staff</option></select><button>CREATE ACCESS</button></form><div className="userCards">{rows.map(r=><div className="panel" key={r.id}><b>{r.full_name||r.email||'User'}</b><small>{r.role}</small><div><button onClick={()=>updateAdmin(r.id,r.role,!r.disabled)}>{r.disabled?'ACTIVATE':'DISABLE'}</button>{r.role!=='super_admin'&&<button onClick={()=>updateAdmin(r.id,r.role==='admin'?'staff':'admin',!!r.disabled)}>MAKE {r.role==='admin'?'STAFF':'ADMIN'}</button>}{currentAdmin?.role==='super_admin'&&r.id!==currentUserId&&<button className="passwordAdminBtn" onClick={()=>resetAdminPassword(r)}>RESET PASSWORD</button>}</div></div>)}</div></>;
  if(tab==='Materials')return <><form className="adminForm wide" onSubmit={e=>create(e,'material')}><h2>Raw material</h2><Field name="name" placeholder="Material name" required/><Field name="sku" placeholder="SKU"/><Field name="unit" placeholder="Unit (yard, spool, piece…)"/><Field name="unit_cost" placeholder="Unit cost" type="number"/><Field name="stock" placeholder="Opening stock" type="number"/><button>ADD MATERIAL</button></form><DataTable rows={rows}/></>;
  if(tab==='Coupons')return <><form className="adminForm wide" onSubmit={e=>create(e,'coupon')}><h2>New coupon</h2><Field name="code" placeholder="Code e.g. KARIA10" required/><Field name="percent_off" placeholder="Percent off" type="number"/><Field name="amount_off" placeholder="Fixed amount off" type="number"/><Field name="ends_at" type="date"/><button>CREATE COUPON</button></form><DataTable rows={rows}/></>;
  if(tab==='Settings')return <form className="adminForm wide" onSubmit={e=>create(e,'settings')}><h2>Store settings</h2><Field name="store_name" placeholder="Store name"/><Field name="currency" placeholder="Currency (USD)"/><Field name="shipping_rate" placeholder="Default shipping rate" type="number"/><Field name="free_shipping_over" placeholder="Free shipping over" type="number"/><Field name="returns_days" placeholder="Returns window (days)" type="number"/><button>SAVE SETTINGS</button><p>Stripe and Supabase secret keys never belong in the browser.</p></form>;
  return <DataTable rows={rows}/>;
 };
 return <div className="admin"><aside><div className="logo">KARIA</div><small>ADMINISTRATION</small>{nav.map(([x,I])=><button className={tab===x?'selected':''} key={x} onClick={()=>setTab(x)}><I/>{x}</button>)}<button onClick={back}>← Storefront</button></aside><section className="adminMain"><div className="adminTop"><div><small>KARIA OPERATIONS</small><h1>{tab}</h1></div><div className="owners"><b>Ownership</b><span>Partner A 50%</span><span>Partner B 50%</span></div></div>{notice&&<div className="notice">{notice}</div>}{loading?<div className="panel">Loading…</div>:module()}</section></div>
}
function DataTable({rows,actions}){if(!rows?.length)return <div className="panel empty">No records yet.</div>;const keys=Object.keys(rows[0]).filter(k=>!['metadata','after_data','before_data'].includes(k)).slice(0,7);return <div className="tableWrap"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}{actions&&<th>ACTIONS</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{keys.map(k=><td key={k}>{typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k]??'')}</td>)}{actions&&<td className="actionsCell">{actions(r)}</td>}</tr>)}</tbody></table></div>}

createRoot(document.getElementById("root")).render(<App/>);
