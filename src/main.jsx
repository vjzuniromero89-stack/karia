import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {ShoppingBag,ArrowRight,X,MoveDown,Package,Wallet,Users,Boxes,BarChart3,Settings,ShieldCheck,Palette,Tag,LayoutGrid,UserCog,Mail,Star} from "lucide-react";
import "./style.css";
import {supabase,configured} from "./supabase";
import {CUSTOMIZE_ON,StoreHeader,CartDrawer,ShopPage,ProductPage,ReviewsPage,ratingOf,Stars,OrdersPage,ContactPage,AboutPage,Footer,mainPhoto,sortedMedia} from "./storefront";
import {CustomizePage,CustomizeAdmin,CustomizationSheet,BagPhoto,BUILTIN_STYLES,CUSTOM_SKU} from "./customize";

const products=[
 {id:1,name:"Terra Woven Bag",brand:"Independent Artisan",price:118,img:"/products/bag-brown.jpg",stock:4,tone:"Cocoa / Ivory"},
 {id:2,name:"Midnight Woven Bag",brand:"Independent Artisan",price:126,img:"/products/bag-blue.jpg",stock:3,tone:"Midnight Blue"},
 {id:3,name:"Signature Handwoven",brand:"Independent Artisan",price:132,img:"/products/bag-detail.jpg",stock:2,tone:"Artisan Edition"},
];

function CheckoutSuccessPage({setCart,Header}){
 useEffect(()=>{setCart([]);try{localStorage.removeItem('karia_cart')}catch{}},[setCart]);
 let pending={};try{pending=JSON.parse(sessionStorage.getItem('karia_pending_order')||'{}')}catch{}
 return <div className="catalogPage">{Header}<main className="checkoutPage"><section className="checkoutSuccess"><small>PAYMENT RECEIVED</small><h1>Thank you.</h1><p>Your Stripe payment was submitted successfully{pending.order_number?<> for KARIA order <b>#{pending.order_number}</b></>:null}.</p>{pending.total!=null&&<div className="checkoutSuccessTotal"><span>Total</span><b>${Number(pending.total||0).toFixed(2)}</b></div>}<p className="checkoutPending">Stripe is confirming the payment with KARIA. Your order will update automatically through the secure webhook.</p><a className="accountPrimary checkoutLink" href="/shop">CONTINUE SHOPPING <ArrowRight/></a></section></main></div>
}
function CheckoutPage({cart,user,Header,onSignIn}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [couponCode,setCouponCode]=useState(''),[coupon,setCoupon]=useState(null),[couponBusy,setCouponBusy]=useState(false);
 const grouped=useMemo(()=>Object.values(cart.reduce((a,p)=>{const k=p.cartKey||p.id;a[k]??={...p,qty:0};a[k].qty++;return a},{})),[cart]);
 const subtotal=grouped.reduce((sum,p)=>sum+Number(p.price||0)*p.qty,0);
 const discount=useMemo(()=>{if(!coupon)return 0;const pct=Number(coupon.percent_off||0);const fixed=Number(coupon.amount_off||0);return Math.min(subtotal,Math.max(0,pct?subtotal*pct/100:fixed));},[coupon,subtotal]);
 const [shipRule,setShipRule]=useState(null);
 useEffect(()=>{if(!supabase)return;supabase.from('settings').select('value').eq('key','shipping').maybeSingle().then(({data})=>setShipRule(data?.value||null))},[]);
 const afterDiscount=Math.max(0,subtotal-discount);
 // same rule the server applies: flat rate, free above the threshold
 const shipping=!shipRule||!grouped.length?0:(Number(shipRule.free_shipping_over||0)>0&&afterDiscount>=Number(shipRule.free_shipping_over))?0:Number(shipRule.default_rate||0);
 const totalAfterDiscount=afterDiscount+shipping;
 const applyCoupon=async()=>{setNotice('');const code=couponCode.trim().toUpperCase();if(!code){setCoupon(null);setNotice('Enter a coupon code.');return}if(!supabase){setNotice('Supabase is not configured.');return}setCouponBusy(true);try{const now=new Date().toISOString();const {data,error}=await supabase.from('coupons').select('id,code,percent_off,amount_off,active,starts_at,ends_at').eq('code',code).eq('active',true).maybeSingle();if(error)throw error;if(!data)throw new Error('Coupon code is not valid.');if(data.starts_at&&new Date(data.starts_at)>new Date())throw new Error('This coupon is not active yet.');if(data.ends_at&&new Date(data.ends_at)<new Date())throw new Error('This coupon has expired.');if(!Number(data.percent_off||0)&&!Number(data.amount_off||0))throw new Error('This coupon has no discount configured.');setCoupon(data);setCouponCode(data.code);setNotice(`Coupon ${data.code} applied.`);}catch(err){setCoupon(null);setNotice(err?.message||'Coupon could not be applied.')}finally{setCouponBusy(false)}};
 const submit=async(e)=>{e.preventDefault();if(busy)return;setNotice('');if(!user){setNotice('Please sign in before continuing to payment.');return}if(!supabase){setNotice('Supabase is not configured.');return}if(!grouped.length){setNotice('Your bag is empty.');return}setBusy(true);try{const f=Object.fromEntries(new FormData(e.currentTarget));const items=grouped.map(p=>({product_id:p.id,qty:p.qty,quantity:p.qty,customization:p.customization||null}));const shipping_address={full_name:f.full_name,address1:f.address1,address2:f.address2||'',city:f.city,state:f.state,postal_code:f.postal_code,country:f.country,phone:f.phone||''};const {data,error}=await supabase.functions.invoke('create-checkout',{body:{items,shipping_address,coupon_code:coupon?.code||null}});if(error){let msg=error.message;try{const ctx=error.context;if(ctx&&typeof ctx.json==='function'){const body=await ctx.json();msg=body?.error||body?.message||msg}}catch{}throw new Error(msg)}if(data?.ok===false)throw new Error(data?.error||'Checkout could not be created.');if(!data?.checkout_url)throw new Error(data?.error||'Stripe Checkout URL was not returned.');sessionStorage.setItem('karia_pending_order',JSON.stringify({order_id:data.order_id,order_number:data.order_number,total:data.total}));window.location.assign(data.checkout_url);return;}catch(err){setNotice(err?.message||'Checkout could not be created.')}finally{setBusy(false)}};
 return <div className="catalogPage">{Header}<main className="checkoutPage"><div className="checkoutIntro"><small>SECURE CHECKOUT</small><h1>Complete your order.</h1><p>Enter your shipping details to continue with your KARIA order.</p></div><div className="checkoutGrid"><form className="checkoutForm" onSubmit={submit}><h2>Shipping details</h2><label>Full name<input name="full_name" required/></label><label>Email<input value={user?.email||''} readOnly placeholder={user?'':'Sign in to continue'}/></label>{!user&&<div className="checkoutAuthNotice">Please sign in to your KARIA account before submitting the order. <button type="button" className="checkoutSignIn" onClick={onSignIn}>SIGN IN OR CREATE ACCOUNT</button></div>}<label>Address<input name="address1" required/></label><label>Apartment / suite<input name="address2"/></label><div className="checkoutTwo"><label>City<input name="city" required/></label><label>State / Province<input name="state" required/></label></div><div className="checkoutTwo"><label>ZIP / Postal code<input name="postal_code" required/></label><label>Country<select name="country" defaultValue="US"><option value="US">United States</option><option value="NI">Nicaragua</option><option value="SV">El Salvador</option><option value="OTHER">Other</option></select></label></div><label>Phone<input name="phone" type="tel"/></label><div className="checkoutCoupon"><label>Coupon code<input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCoupon(null)}} placeholder="e.g. KARIA05"/></label><button type="button" onClick={applyCoupon} disabled={couponBusy}>{couponBusy?'CHECKING…':'APPLY COUPON'}</button></div>{notice&&<p className={coupon&&notice.includes('applied')?'checkoutCouponSuccess':'checkoutError'}>{notice}</p>}<button className="checkoutPay" disabled={busy||!cart.length||!user}>{busy?'CREATING ORDER…':user?'CONTINUE TO PAYMENT':'SIGN IN REQUIRED'} <ArrowRight/></button><a className="checkoutBack" href="/shop">← Return to shop</a></form><aside className="checkoutSummary"><small>YOUR ORDER</small><h2>{cart.length} piece{cart.length===1?'':'s'}</h2>{grouped.map(p=><div className="checkoutItem" key={p.cartKey||p.id}><img src={p.img}/><div><b>{p.name}</b><span>Qty {p.qty}</span>{p.customization&&<span className="checkoutCustom">{p.tone}</span>}</div><strong>${(Number(p.price)*p.qty).toFixed(2)}</strong></div>)}<div className="checkoutLine"><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div>{coupon&&<div className="checkoutLine couponDiscount"><span>Coupon <b>{coupon.code}</b></span><b>−${discount.toFixed(2)}</b></div>}<div className="checkoutLine"><span>Shipping</span>{shipRule?<b>{shipping>0?`$${shipping.toFixed(2)}`:'Free'}</b>:<span>Confirmed at payment</span>}</div><div className="checkoutTotal"><span>Total</span><b>${totalAfterDiscount.toFixed(2)}</b></div></aside></div></main></div>
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
 const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('karia_cart')||'[]')}catch{return []}}),[admin,setAdmin]=useState(false),[cartOpen,setCartOpen]=useState(false),[storeProducts,setStoreProducts]=useState(products);
 const [accountOpen,setAccountOpen]=useState(false),[user,setUser]=useState(null),[profile,setProfile]=useState(null),[authMode,setAuthMode]=useState("signin"),[authError,setAuthError]=useState(""),[passwordOpen,setPasswordOpen]=useState(false),[passwordNotice,setPasswordNotice]=useState("");
 const [cartNotice,setCartNotice]=useState('');
 // The bag holds one entry per piece. Stock is capped here; the server checks it again at checkout.
 const add=(p,qty=1)=>{const key=p.cartKey||p.id,have=cart.filter(x=>(x.cartKey||x.id)===key).length;let n=Math.max(1,qty);if(!p.customization){const stock=Number(p.stock||0),left=stock-have;if(left<=0){setCartNotice(stock>0?`Only ${stock} of ${p.name} available.`:`${p.name} is sold out.`);setCartOpen(true);return}n=Math.min(n,left)}setCartNotice('');setCart(c=>[...c,...Array(n).fill(p)]);setCartOpen(true)};
 // Published reviews: loaded once, then every product carries its average and count.
 const [reviews,setReviews]=useState([]);
 const loadReviews=()=>{if(!supabase)return;supabase.from('product_reviews').select('id,product_id,author_name,rating,body,created_at').eq('approved',true).order('created_at',{ascending:false}).limit(500).then(({data})=>setReviews(data||[]))};
 useEffect(()=>{loadReviews()},[]);
 const shopProducts=useMemo(()=>storeProducts.map(p=>{const mine=reviews.filter(r=>r.product_id===p.id);return {...p,rating:ratingOf(mine),reviewCount:mine.length}}),[storeProducts,reviews]);
 // Contact details and About text, edited in Admin → Settings.
 const [storefront,setStorefront]=useState({});
 useEffect(()=>{if(!supabase)return;supabase.from('settings').select('value').eq('key','storefront').maybeSingle().then(({data})=>setStorefront(data?.value||{}))},[]);
 useEffect(()=>{if(!supabase)return; (async()=>{const [{data},{data:stockRows}]=await Promise.all([supabase.from("products").select("id,name,price,sku,materials,dimensions,description,brand_id,category,created_at,product_media(url,media_type,sort_order)").eq("active",true).order("created_at",{ascending:false}),supabase.from("product_stock").select("*")]);const stockMap=Object.fromEntries((stockRows||[]).map(r=>[r.product_id,Number(r.stock??r.quantity??r.qty??0)]));setStoreProducts((data||[]).filter(p=>p.sku!==CUSTOM_SKU).map((p,i)=>({id:p.id,name:p.name,brand:"KARIA Artisan",price:Number(p.price),img:mainPhoto(p.product_media)||products[i%products.length].img,media:sortedMedia(p.product_media),stock:stockMap[p.id]||0,tone:p.materials||p.dimensions||"Handcrafted",description:p.description||"",category:p.category||"",created_at:p.created_at||""})))})()},[]);
 const checkout=()=>{if(!cart.length)return;try{localStorage.setItem('karia_cart',JSON.stringify(cart))}catch{}setCartOpen(false);window.location.assign('/checkout')};
 useEffect(()=>{try{localStorage.setItem('karia_cart',JSON.stringify(cart))}catch{}},[cart]);
 const loadProfile=async(u)=>{if(!u||!supabase){setProfile(null);return} const {data}=await supabase.from("profiles").select("id,full_name,role,disabled").eq("id",u.id).single(); setProfile(data||null)};
 useEffect(()=>{if(!supabase)return; supabase.auth.getSession().then(({data})=>{const u=data.session?.user||null;setUser(u);loadProfile(u);if(u?.user_metadata?.must_change_password)setPasswordOpen(true)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;setUser(u);loadProfile(u);if(u?.user_metadata?.must_change_password)setPasswordOpen(true)});return()=>subscription.unsubscribe()},[]);
 const submitAuth=async(e)=>{e.preventDefault();setAuthError("");if(!supabase){setAuthError("Supabase is not configured.");return}const fd=new FormData(e.currentTarget),email=String(fd.get("email")||""),password=String(fd.get("password")||"");let r;if(authMode==="signup")r=await supabase.auth.signUp({email,password,options:{data:{full_name:String(fd.get("name")||"")}}});else r=await supabase.auth.signInWithPassword({email,password});if(r.error)setAuthError(r.error.message);else if(authMode==="signup")setAuthError("Check your email to confirm your account.");else {const u=r.data?.user;if(u?.user_metadata?.must_change_password){setUser(u);setAccountOpen(false);setPasswordOpen(true)}else setAccountOpen(false)}};
 const mustChangePassword=!!user?.user_metadata?.must_change_password;
 const changePassword=async(e)=>{e.preventDefault();setPasswordNotice("");if(!supabase)return;const fd=new FormData(e.currentTarget),password=String(fd.get("new_password")||""),confirm=String(fd.get("confirm_password")||"");if(password.length<8){setPasswordNotice("Password must be at least 8 characters.");return}if(password!==confirm){setPasswordNotice("Passwords do not match.");return}const {data,error}=await supabase.auth.updateUser({password,data:{...user?.user_metadata,must_change_password:false}});if(error){setPasswordNotice(error.message);return}if(data?.user)setUser(data.user);setPasswordNotice("Password updated successfully.");e.currentTarget.reset();setTimeout(()=>setPasswordOpen(false),700)};
 const signOut=async()=>{await supabase?.auth.signOut();setAccountOpen(false);setPasswordOpen(false);setAdmin(false)};
 const canAdmin=["staff","admin","super_admin"].includes(profile?.role);
 useEffect(()=>{const fn=()=>{const max=Math.max(innerHeight,document.documentElement.scrollHeight-innerHeight);const p=scrollY/max;document.documentElement.style.setProperty("--sy",scrollY+"px");document.documentElement.style.setProperty("--sp",p)};fn();addEventListener("scroll",fn,{passive:true});return()=>removeEventListener("scroll",fn)},[]);
 if(admin) return <Admin back={()=>setAdmin(false)}/>;
 const path=location.pathname,signIn=()=>setAccountOpen(true);
 const Header=<StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)} onAccount={signIn}/>;
 const shop={products:shopProducts,add,Header},rev={reviews,user,onSignIn:signIn,onSaved:loadReviews};
 let page;
 if(path==="/checkout/success")page=<CheckoutSuccessPage setCart={setCart} Header={Header}/>;
 else if(path==="/checkout")page=<CheckoutPage cart={cart} user={user} Header={Header} onSignIn={signIn}/>;
 else if(path==="/shop"||path==="/new"||(path==="/customize"&&!CUSTOMIZE_ON))page=<ShopPage {...shop} startNew={path==="/new"}/>;
 else if(path==="/customize")page=<CustomizePage add={add} Header={Header}/>;
 else if(path==="/reviews")page=<ReviewsPage Header={Header} products={shopProducts} {...rev}/>;
 else if(path==="/orders")page=<OrdersPage user={user} Header={Header} onSignIn={signIn}/>;
 else if(path==="/contact")page=<ContactPage Header={Header} info={storefront}/>;
 else if(path==="/about")page=<AboutPage Header={Header} info={storefront}/>;
 else if(path.startsWith("/product/"))page=<ProductPage {...shop} {...rev} id={decodeURIComponent(path.split("/").pop())}/>;
 else page=<HomePage Header={Header} storeProducts={storeProducts}/>;
 // Bag, account and password panels live here so they work on every page (checkout included).
 return <>{page}<Footer canAdmin={canAdmin} openAdmin={()=>setAdmin(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout} notice={cartNotice} add={add}/>{accountOpen&&<div className="accountBackdrop" onMouseDown={()=>setAccountOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setAccountOpen(false)}><X/></button><div className="accountBrand">KARIA</div>{user?<><small className="accountEyebrow">MY ACCOUNT</small><h2>{profile?.full_name||user.email?.split("@")[0]}</h2><p className="accountEmail">{user.email}</p><div className="accountRole">{profile?.role?.replace("_"," ")||"customer"}</div><a className="accountSecondary accountLink" href="/orders">MY ORDERS</a><button className="accountSecondary passwordAction" onClick={()=>{setAccountOpen(false);setPasswordNotice("");setPasswordOpen(true)}}>CHANGE PASSWORD</button>{canAdmin&&<button className="accountPrimary" onClick={()=>{setAccountOpen(false);setAdmin(true)}}>OPEN ADMINISTRATION <ArrowRight/></button>}<button className="accountSecondary" onClick={signOut}>SIGN OUT</button></>:<><small className="accountEyebrow">WELCOME TO KARIA</small><h2>{authMode==="signin"?"Sign in":"Create account"}</h2><p className="accountIntro">Access your orders, saved details and KARIA account.</p><form onSubmit={submitAuth}>{authMode==="signup"&&<input name="name" placeholder="Full name" required/>}<input name="email" type="email" placeholder="Email address" required/><input name="password" type="password" placeholder="Password" minLength="6" required/>{authError&&<p className="authError">{authError}</p>}<button className="accountPrimary" type="submit">{authMode==="signin"?"SIGN IN":"CREATE ACCOUNT"}<ArrowRight/></button></form><button className="accountSwitch" onClick={()=>{setAuthError("");setAuthMode(authMode==="signin"?"signup":"signin")}}>{authMode==="signin"?"New to KARIA? Create an account":"Already have an account? Sign in"}</button></>}</section></div>}{passwordOpen&&<div className="accountBackdrop" onMouseDown={()=>{if(!mustChangePassword)setPasswordOpen(false)}}><section className="accountPanel securityPanel" onMouseDown={e=>e.stopPropagation()}>{!mustChangePassword&&<button className="accountClose" onClick={()=>setPasswordOpen(false)}><X/></button>}<div className="accountBrand">KARIA</div><small className="accountEyebrow">ACCOUNT SECURITY</small><h2>{mustChangePassword?"Create your new password":"Change password"}</h2><p className="accountIntro">{mustChangePassword?"Your account was created with a temporary password. Choose your private password before continuing.":"Choose a new password for your KARIA account."}</p><form onSubmit={changePassword}><input name="new_password" type="password" placeholder="New password" minLength="8" autoComplete="new-password" required/><input name="confirm_password" type="password" placeholder="Confirm new password" minLength="8" autoComplete="new-password" required/>{passwordNotice&&<p className={passwordNotice.startsWith("Password updated")?"authSuccess":"authError"}>{passwordNotice}</p>}<button className="accountPrimary" type="submit">UPDATE PASSWORD <ArrowRight/></button></form>{mustChangePassword&&<button className="accountSecondary" onClick={signOut}>SIGN OUT</button>}</section></div>}</>;
}

function HomePage({Header,storeProducts}){
 // Each "world" opens the Shop filtered by the matching category, when one exists.
 const cats=Array.from(new Set(storeProducts.map(p=>String(p.category||'').trim()).filter(Boolean)));
 const worldLink=w=>{const words=`${w.name} ${w.sub}`.toLowerCase();const c=cats.find(c=>c.toLowerCase().split(/[^a-z]+/).some(t=>t.length>3&&words.includes(t)));return c?`/shop?category=${encodeURIComponent(c)}`:'/shop'};
 return <div className="site">{Header}
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

   <section className="categoryWorlds" id="categories">
    <div className="categoryWorldsHead"><div><small>01 — EXPLORE YOUR WORLD</small><h2>Different worlds.<br/><i>One KARIA.</i></h2></div><p>Explore KARIA by category. Each world is designed like a small cinematic campaign — products floating in space, depth, light and motion.</p></div>
    <div className="worldCompositions">
     {[
      {name:"STYLE",sub:"Fashion · Bags · Accessories",cls:"styleWorld",a:0,b:1,c:2},
      {name:"BEAUTY",sub:"Beauty · Fragrance · Self care",cls:"beautyWorld",a:1,b:2,c:0},
      {name:"HOME",sub:"Home · Decor · Everyday living",cls:"homeWorld",a:2,b:0,c:1},
      {name:"LIFESTYLE",sub:"Objects · Essentials · Discoveries",cls:"lifeWorld",a:0,b:2,c:1}
     ].map((w,i)=><a href={worldLink(w)} className={`worldComposition ${w.cls}`} key={w.name}>
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
    <div className="newKariaHead"><div><small>02 — NEW AT KARIA</small><h2>Fresh discoveries.</h2></div><a href="/shop">SHOP ALL <ArrowRight/></a></div>
    <div className="newProductRail">
     {storeProducts.slice(0,4).map((p,i)=><a className="newProductCard" href={`/product/${p.id}`} key={p.id||i}><div className="newProductImage"><img src={p.img}/><span>0{i+1}</span></div><div><small>{p.brand||"KARIA"}</small><h3>{p.name}</h3><b>${Number(p.price||0).toFixed(2)}</b></div></a>)}
     {!storeProducts.length&&<>
      <a className="newProductCard" href="/shop"><div className="newProductImage"><img src="/products/bag-brown.jpg"/><span>01</span></div><div><small>KARIA</small><h3>Discover the collection</h3></div></a>
      <a className="newProductCard" href="/shop"><div className="newProductImage"><img src="/products/bag-blue.jpg"/><span>02</span></div><div><small>KARIA</small><h3>New worlds arriving</h3></div></a>
     </>}
    </div>
    <div className="newKariaClosing"><span>ONE STORE</span><b>KARIA</b><span>MANY WORLDS</span></div>
   </section>

   {CUSTOMIZE_ON&&<section className="customizeTeaser" id="customize">
    <div className="customizeTeaserCopy"><small>03 — KARIA ATELIER</small><h2>Design your own<br/><i>handmade bag.</i></h2><p>Choose one of ten stripe designs, color every stripe and the handle, and see it on the real KARIA bag. We crochet it by hand, just for you.</p><a href="/customize" className="cta">CREATE YOUR BAG <ArrowRight/></a></div>
    <a href="/customize" className="customizeTeaserArt">{BUILTIN_STYLES.slice(0,4).map((s,i)=><BagPhoto thumb key={s.id} style={s} colors={[{body:"coffee",handle:"coffee"},{body:"milky-white",handle:"coffee",s1:"rose",s2:"coffee",s3:"rose",s4:"coffee",s5:"rose"},{body:"denim-blue",stripes:"milky-white",handle:"denim-blue"},{body:"golden-yellow",wide:"milky-white",handle:"coffee"}][i]}/>)}</a>
   </section>}

   <section className="productionFilm" id="production-film">
    <div className="productionFilmHead"><div><small>{CUSTOMIZE_ON?"04":"03"} — BEHIND KARIA</small><h2>The making of<br/><i>something special.</i></h2></div><p>A closer look at the details, hands and process behind the products we bring into the KARIA world.</p></div>
    <div className="productionFilmFrame">
     <video src="/products/bag-video.mp4" autoPlay muted loop playsInline preload="metadata" aria-label="KARIA production video"/>
     <span className="productionFilmBadge">KARIA · PRODUCTION FILM</span>
    </div>
   </section>
  </main>
 </div>
}

const Field=({name,placeholder,type='text',required=false,step,min})=><input name={name} placeholder={placeholder} type={type} required={required} step={step??(type==='number'?'any':undefined)} min={min}/>;
const ORDER_STATUSES=['pending','paid','processing','shipped','delivered','cancelled','refunded'];
const PAID_STATUSES=['paid','processing','shipped','delivered'];

function Admin({back}){
 const [tab,setTab]=useState('Dashboard'),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState('');
 const [brands,setBrands]=useState([]),[categories,setCategories]=useState([]),[productsList,setProductsList]=useState([]),[uploading,setUploading]=useState(false),[editingProduct,setEditingProduct]=useState(null),[editingMovement,setEditingMovement]=useState(null),[viewingOrder,setViewingOrder]=useState(null);
 const [stats,setStats]=useState({revenue:0,orders:0,inventory:0,net:0});
 const [inventorySummary,setInventorySummary]=useState([]),[inventoryTotals,setInventoryTotals]=useState({opening:0,received:0,sold:0,out:0,returns:0,adjustments:0,current:0,value:0});
 const [currentAdmin,setCurrentAdmin]=useState(null),[currentUserId,setCurrentUserId]=useState(null);
 const [accountingSales,setAccountingSales]=useState([]),[accountingExpenses,setAccountingExpenses]=useState([]),[period,setPeriod]=useState('30');
 const [latestOrders,setLatestOrders]=useState([]),[lowStock,setLowStock]=useState([]),[settingsValues,setSettingsValues]=useState({}),[customerOrders,setCustomerOrders]=useState([]),[subscribers,setSubscribers]=useState([]);
 // Sidebar grouped by area; entries without an icon are section labels.
 const nav=[["OVERVIEW"],["Dashboard",BarChart3],["SALES"],["Orders",ShoppingBag],["Customers",Users],["Coupons",Tag],["Reviews",Star],["Messages",Mail],["CATALOG"],["Products",Package],["Categories",LayoutGrid],["Brands",ShieldCheck],["Customize",Palette],["Inventory",Boxes],["FINANCE"],["Accounting",Wallet],["SYSTEM"],["Admin users",UserCog],["Settings",Settings]];
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
    supabase.from('order_items').select('id,order_id,product_id,qty,unit_price,unit_cost,orders!inner(order_number,email,status,created_at,subtotal,discount,discount_total,shipping,shipping_total,tax,total,processor_fee),products(name,sku,description)').order('id',{ascending:false}),
    supabase.from('expenses').select('*').order('created_at',{ascending:false})
  ]);
  if(ie)throw ie;if(ee)throw ee;
  const paidItems=(items||[]).filter(x=>PAID_STATUSES.includes(String(x.orders?.status||'').toLowerCase()));
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
  setAccountingSales(sales);setAccountingExpenses(expenses||[]);
 };
 const acct=useMemo(()=>{
  const now=new Date(),start=period==='30'?new Date(now.getTime()-30*864e5):period==='month'?new Date(now.getFullYear(),now.getMonth(),1):period==='year'?new Date(now.getFullYear(),0,1):null;
  const inPeriod=d=>!start||(d&&new Date(d)>=start);
  const sales=accountingSales.filter(x=>inPeriod(x.orders?.created_at)),expenses=accountingExpenses.filter(x=>inPeriod(x.expense_date||x.created_at));
  const sum=(list,f)=>list.reduce((a,x)=>a+f(x),0);
  const revenue=sum(sales,x=>x.netSale),gross=sum(sales,x=>x.profit),expenseTotal=sum(expenses,x=>Number(x.amount||0));
  const days={};sales.forEach(x=>{const k=String(x.orders?.created_at||'').slice(0,10);if(!k)return;days[k]??={day:k,sales:0,profit:0};days[k].sales+=x.netSale;days[k].profit+=x.profit});
  const daily=Object.values(days).sort((a,b)=>a.day.localeCompare(b.day)).slice(-30);
  return {sales,expenses,daily,totals:{sales:revenue,grossSales:sum(sales,x=>x.grossProductSales),discounts:sum(sales,x=>x.discount),orders:new Set(sales.map(x=>x.order_id)).size,cogs:sum(sales,x=>x.totalCost),shipping:sum(sales,x=>x.shipping),tax:sum(sales,x=>x.tax),fees:sum(sales,x=>x.processorFee),gross,margin:revenue?gross/revenue*100:0,expenses:expenseTotal,net:gross-expenseTotal}};
 },[accountingSales,accountingExpenses,period]);
 const load=async()=>{if(!supabase)return;setLoading(true);setNotice('');try{
  const table={Orders:'orders',Products:'products',Categories:'categories',Brands:'brands',Inventory:'inventory_movements',Customers:'profiles',Accounting:'expenses','Admin users':'profiles',Coupons:'coupons',Messages:'contact_messages',Reviews:'product_reviews'}[tab];
  if(table){let q=tab==='Orders'?supabase.from('orders').select('id,order_number,email,status,subtotal,discount,discount_total,shipping,shipping_total,coupon_code,tax,total,processor_fee,shipping_address,tracking_number,carrier,created_at,stripe_session_id,stripe_payment_intent,order_items(id,product_id,qty,unit_price,unit_cost,customization,products(id,name,sku,description,product_media(url,media_type,sort_order)))').order('created_at',{ascending:false}).limit(100):tab==='Inventory'?supabase.from('inventory_movements').select('*, products(name,sku)').order('created_at',{ascending:false}).limit(100):tab==='Categories'?supabase.from('categories').select('*').order('name',{ascending:true}).limit(100):tab==='Products'?supabase.from('products').select('id,name,sku,description,price,unit_cost,category,brand_id,materials,dimensions,weight,low_stock_threshold,featured,active,created_at,product_media(url,media_type,sort_order)').order('created_at',{ascending:false}).limit(100):supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100);if(tab==='Admin users')q=q.in('role',['staff','admin','super_admin']);const {data,error}=await q;if(error)throw error;setRows(data||[])}
  const [{data:o},{data:im},{data:ex}]=await Promise.all([supabase.from('orders').select('id,order_number,email,customer_id,total,status,created_at').order('created_at',{ascending:false}),supabase.from('inventory_movements').select('qty,movement_type'),supabase.from('expenses').select('amount')]);
  setLatestOrders((o||[]).slice(0,6));setCustomerOrders(o||[]);const paid=(o||[]).filter(x=>PAID_STATUSES.includes(String(x.status).toLowerCase()));const rev=paid.reduce((s,x)=>s+Number(x.total||0),0);const inv=(im||[]).reduce((s,x)=>{const n=Number(x.quantity??x.qty??0);return s+(['out','sale','consume'].includes(String(x.movement_type).toLowerCase())?-Math.abs(n):n)},0);const expenses=(ex||[]).reduce((s,x)=>s+Number(x.amount||0),0);setStats({revenue:rev,orders:(o||[]).length,inventory:inv,net:rev-expenses});
  if(tab==='Dashboard'){const [{data:ps},{data:st}]=await Promise.all([supabase.from('products').select('id,name,sku,low_stock_threshold').eq('active',true),supabase.from('product_stock').select('*')]);const stock=Object.fromEntries((st||[]).map(r=>[r.product_id,Number(r.stock??r.quantity??r.qty??0)]));setLowStock((ps||[]).filter(p=>p.sku!==CUSTOM_SKU).map(p=>({...p,stock:stock[p.id]||0})).filter(p=>p.stock<=Number(p.low_stock_threshold??2)).sort((a,b)=>a.stock-b.stock).slice(0,6))}
  if(tab==='Settings'){const {data,error}=await supabase.from('settings').select('key,value');if(error)throw error;setSettingsValues(Object.fromEntries((data||[]).map(r=>[r.key,r.value||{}])))}
  if(tab==='Customers'){const {data}=await supabase.from('newsletter_subscribers').select('email,created_at').order('created_at',{ascending:false}).limit(200);setSubscribers(data||[])}
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
  if(kind==='settings'){for(const [key,value] of Object.entries({store:{name:f.store_name||'KARIA',currency:f.currency||'USD'},shipping:{default_rate:Number(f.shipping_rate||0),free_shipping_over:Number(f.free_shipping_over||0)},legal:{returns_days:Number(f.returns_days||14)},storefront:{contact_email:String(f.contact_email||'').trim(),whatsapp:String(f.whatsapp||'').trim(),instagram:String(f.instagram||'').trim(),about:String(f.about||'').trim()}})){const {error}=await supabase.from('settings').upsert({key,value,updated_at:new Date().toISOString()});if(error)throw error}}
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
 const saveOrder=async(order,patch)=>{
  setNotice('');
  try{
    const {data,error}=await supabase.from('orders').update(patch).eq('id',order.id).select('id');
    if(error)throw error;
    if(!data?.length)throw new Error('The order was not updated. Check the Orders update policy in Supabase.');
    setNotice(`Order #${order.order_number||''} updated.`);
    await load();
  }catch(err){setNotice(`Order update failed: ${err?.message||String(err)}`)}finally{setViewingOrder(null)}
 };
 const toggleCoupon=async(r)=>{setNotice('');try{const {error}=await supabase.from('coupons').update({active:!r.active}).eq('id',r.id);if(error)throw error;setNotice(r.active?`Coupon ${r.code} deactivated.`:`Coupon ${r.code} activated.`);await load()}catch(e){setNotice(e.message)}};
 const deleteCoupon=async(r)=>{if(!window.confirm(`Delete coupon "${r.code}"? Past orders keep their discount.`))return;setNotice('');try{const {error}=await supabase.from('coupons').delete().eq('id',r.id);if(error)throw error;setNotice(`Coupon ${r.code} deleted.`);await load()}catch(e){setNotice(e.message)}};
 const toggleReview=async(r)=>{setNotice('');try{const {error}=await supabase.from('product_reviews').update({approved:!r.approved}).eq('id',r.id);if(error)throw error;setNotice(r.approved?'Review hidden from the store.':'Review published.');await load()}catch(e){setNotice(e.message)}};
 const deleteReview=async(r)=>{if(!window.confirm('Delete this review? This cannot be undone.'))return;setNotice('');try{const {error}=await supabase.from('product_reviews').delete().eq('id',r.id);if(error)throw error;setNotice('Review deleted.');await load()}catch(e){setNotice(e.message)}};
 const deleteMessage=async(r)=>{if(!window.confirm('Delete this message? This cannot be undone.'))return;setNotice('');try{const {error}=await supabase.from('contact_messages').delete().eq('id',r.id);if(error)throw error;setNotice('Message deleted.');await load()}catch(e){setNotice(e.message)}};
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
 const module=()=>{
  if(tab==='Dashboard')return <><div className="cards">{cards.map(([a,b,I])=><div key={a}><I/><small>{a}</small><strong>{b}</strong><em>Live from Supabase</em></div>)}</div><div className="dashGrid"><div className="panel"><h2>Latest orders</h2>{latestOrders.length?<div className="dashList">{latestOrders.map(o=><button key={o.id} onClick={()=>setTab('Orders')}><span><b>#{o.order_number||'—'}</b> · {o.email||'Customer'}<small>{o.created_at?new Date(o.created_at).toLocaleString():''}</small></span><span className={`orderStatus ${String(o.status||'').toLowerCase()}`}>{String(o.status||'').toUpperCase()}</span><b>${Number(o.total||0).toFixed(2)}</b></button>)}</div>:<p>No orders yet.</p>}<button className="dashLink" onClick={()=>setTab('Orders')}>VIEW ALL ORDERS</button></div><div className="panel"><h2>Low stock</h2>{lowStock.length?<div className="dashList">{lowStock.map(p=><div key={p.id}><span><b>{p.name}</b><small>{p.sku||''}</small></span><span className={p.stock<=0?'stockPill zero':'stockPill'}>{p.stock}</span></div>)}</div>:<p>Every active product is above its low-stock alert.</p>}<button className="dashLink" onClick={()=>setTab('Inventory')}>OPEN INVENTORY</button></div></div></>;
  if(tab==='Orders')return <><div className="adminSectionHead"><div><small>ORDER HISTORY</small><h2>Orders</h2><p className="formHelp">Visual order history with products, customer, payment status and totals. TEST MODE: orders can be deleted during setup. Paid production orders will be protected when KARIA goes live.</p></div></div><OrderAdminTable rows={rows} onView={setViewingOrder} onDelete={deleteOrder}/></>;
  if(tab==='Categories')return <><section className="categoryAdminHero"><div><small>SHOP ORGANIZATION</small><h2>Categories</h2><p>Create the departments customers use to browse KARIA. Products can only be assigned to active categories.</p></div><div><strong>{rows.filter(r=>r.active!==false).length}</strong><small>ACTIVE</small></div></section><form className="adminForm categoryForm" onSubmit={e=>create(e,'category')}><h2>New category</h2><Field name="name" placeholder="Category name — e.g. Beauty" required/><Field name="slug" placeholder="URL slug (optional)"/><button>CREATE CATEGORY</button></form><div className="categoryAdminGrid">{rows.map(r=><div className={`categoryAdminCard ${r.active===false?'inactive':''}`} key={r.id}><div><small>{r.active===false?'INACTIVE':'ACTIVE'}</small><h3>{r.name}</h3><span>/{r.slug}</span></div><div className="categoryAdminActions"><button onClick={()=>editCategory(r)}>EDIT</button><button onClick={()=>toggleCategory(r)}>{r.active===false?'ACTIVATE':'DEACTIVATE'}</button><button className="dangerBtn" onClick={()=>deleteCategory(r)}>DELETE</button></div></div>)}</div></>;
  if(tab==='Brands')return <><form className="adminForm" onSubmit={e=>create(e,'brand')}><h2>New brand</h2><Field name="name" placeholder="Brand name" required/><Field name="description" placeholder="Story / description"/><button>CREATE BRAND</button></form>{rows.length?<div className="tableWrap"><table><thead><tr><th>BRAND</th><th>SLUG</th><th>STORY</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.slug||''}</td><td className="productDescCell">{r.story||''}</td><td>{r.active===false?'INACTIVE':'ACTIVE'}</td><td>{r.created_at?new Date(r.created_at).toLocaleDateString():''}</td></tr>)}</tbody></table></div>:<div className="panel empty">No brands yet.</div>}</>;
  if(tab==='Products')return <><form className="adminForm wide productForm" onSubmit={e=>create(e,'product')}><h2>New product</h2><p className="formHelp">Step 1: create the product and publish it to the Shop. Stock starts at 0. Step 2: go to Inventory to enter the real quantity available.</p><Field name="name" placeholder="Product name" required/><Field name="sku" placeholder="SKU" required/><select name="brand_id"><option value="">Select brand (optional)</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><Field name="price" placeholder="Sale price" type="number" required/><Field name="cost" placeholder="Unit cost" type="number"/><Field name="weight" placeholder="Weight" type="number"/><Field name="low_stock_threshold" placeholder="Low stock alert (default 2)" type="number"/><Field name="materials" placeholder="Materials"/><Field name="dimensions" placeholder="Dimensions"/><select name="category_id" required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea name="description" placeholder="Description and story"/><label className="uploadBox"><b>PRODUCT PHOTOS / VIDEO</b><span>Choose one or several images. The first image becomes the main product photo.</span><input name="images" type="file" accept="image/*,video/mp4,video/webm" multiple required/></label><label className="checkLine"><input name="publish_shop" type="checkbox" defaultChecked/> Publish in KARIA Shop</label><label className="checkLine"><input name="featured" type="checkbox"/> Featured product</label><button disabled={uploading}>{uploading?'UPLOADING MEDIA…':'CREATE PRODUCT + UPLOAD MEDIA'}</button></form><ProductAdminTable rows={rows} onEdit={editProduct} onDelete={deleteProduct}/></>;
  if(tab==='Inventory')return <><section className="inventoryHero"><div><small>LIVE INVENTORY CONTROL</small><h2>Inventory accounting</h2><p>Every product keeps a permanent movement history. Opening stock + receipts + returns + adjustments − sales − other outputs = current stock.</p></div><div><small>INVENTORY VALUE AT COST</small><strong>${inventoryTotals.value.toFixed(2)}</strong></div></section><div className="inventoryKpis"><div><span>Opening stock</span><strong>{inventoryTotals.opening}</strong></div><div><span>Received</span><strong>+{inventoryTotals.received}</strong></div><div><span>Sales</span><strong>-{inventoryTotals.sold}</strong></div><div><span>Returns</span><strong>+{inventoryTotals.returns}</strong></div><div><span>Other OUT</span><strong>-{inventoryTotals.out}</strong></div><div className="currentKpi"><span>Current stock</span><strong>{inventoryTotals.current}</strong></div></div><section className="inventorySummary"><div className="inventorySectionTitle"><div><small>PRODUCT LEDGER</small><h3>Inventory by product</h3></div><span>{inventorySummary.length} products</span></div><div className="tableWrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>OPENING</th><th>RECEIVED</th><th>SALES</th><th>RETURNS</th><th>OTHER OUT</th><th>ADJ.</th><th>CURRENT</th><th>VALUE</th></tr></thead><tbody>{inventorySummary.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.sku||'—'}</td><td>{r.opening}</td><td className="positive">+{r.received}</td><td className="negative">-{r.sold}</td><td className="positive">+{r.returns}</td><td className="negative">-{r.out}</td><td>{r.adjustments}</td><td><span className={r.current<=0?'stockPill zero':'stockPill'}>{r.current}</span></td><td>${r.value.toFixed(2)}</td></tr>)}</tbody></table></div></section><form className="adminForm wide" onSubmit={e=>create(e,'inventory')}><h2>Add inventory movement</h2><p className="formHelp">Use OPENING STOCK only when entering the first physical count of a product. Use IN for later receipts. Sales will be recorded automatically by the order system.</p><select name="product_id" required><option value="">Select product</option>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><Field name="quantity" placeholder="Quantity" type="number" required/><select name="movement_type"><option value="OPENING_UI">OPENING STOCK</option><option value="IN">IN / RECEIVED</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select><Field name="note" placeholder="Reason / reference"/><button>POST MOVEMENT</button></form><div className="inventorySectionTitle movementHead"><div><small>INVENTORY ENTRIES</small><h3>Movement history · delete manual entries here</h3></div></div><div className="inventoryHistory tableWrap">{rows.length===0?<div className="emptyInventory">No inventory movements yet.</div>:<table><thead><tr><th>DATE</th><th>PRODUCT</th><th>SKU</th><th>MOVEMENT</th><th>QTY</th><th>REASON / REFERENCE</th><th>ACTION</th></tr></thead><tbody>{rows.map(r=>{const note=String(r.note||'');const isOpening=note.toLowerCase().includes('opening stock');const movement=isOpening?'OPENING STOCK':r.movement_type==='IN'?'RECEIVED / IN':r.movement_type==='OUT'?'OUT':r.movement_type==='RETURN'?'RETURN':r.movement_type==='PRODUCTION_IN'?'PRODUCTION IN':r.movement_type==='ADJUST'?'ADJUSTMENT':(r.movement_type||'');return <tr key={r.id}><td>{r.created_at?new Date(r.created_at).toLocaleString():''}</td><td><b>{r.products?.name||''}</b></td><td>{r.products?.sku||''}</td><td><span className="movementPill">{movement}</span></td><td><b>{r.qty??''}</b></td><td>{isOpening?note.replace(/^OPENING STOCK\s*[·-]?\s*/i,''):note}</td><td><div className="rowActionButtons"><button onClick={()=>editInventoryMovement(r)}>EDIT</button><button className="dangerBtn" onClick={()=>deleteInventoryMovement(r)}>DELETE</button></div></td></tr>})}</tbody></table>}</div></>;
  if(tab==='Accounting'){const byOrder={};acct.sales.forEach(r=>{const k=r.order_id;if(!byOrder[k])byOrder[k]={order:r.orders,lines:[],total:0,fee:0,profit:0};byOrder[k].lines.push(r);byOrder[k].total+=r.customerTotal;byOrder[k].fee+=r.processorFee;byOrder[k].profit+=r.profit});const recent=Object.values(byOrder).slice(0,5);const byProduct={};acct.sales.forEach(r=>{const n=r.products?.name||'Product';if(!byProduct[n])byProduct[n]={name:n,sales:0,qty:0};byProduct[n].sales+=r.netSale;byProduct[n].qty+=r.qty});const topProducts=Object.values(byProduct).sort((a,b)=>b.sales-a.sales).slice(0,3);const totalSales=acct.totals.grossSales??acct.totals.sales;const profitBase=Math.max(totalSales,1);const pct=n=>Math.max(0,Math.min(100,n/profitBase*100));return <><section className="acct2Head"><div><small>ACCOUNTING</small><h2>Financial Overview</h2><p>Sales, costs, fees, taxes and real profit from every paid KARIA order.</p></div><select value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Period"><option value="30">Last 30 days</option><option value="month">This month</option><option value="year">This year</option><option value="all">All time</option></select></section><div className="acct2Kpis"><div className="green"><span>SALES</span><strong>${totalSales.toFixed(2)}</strong><small>{acct.totals.orders||0} paid orders</small></div><div className="blue"><span>ORDERS</span><strong>{acct.totals.orders||0}</strong><small>Completed payments</small></div><div className="gold"><span>GROSS PROFIT</span><strong>${acct.totals.gross.toFixed(2)}</strong><small>After direct costs</small></div><div className="purple"><span>STRIPE FEES</span><strong>−${acct.totals.fees.toFixed(2)}</strong><small>Real processor fees</small></div><div className="pink"><span>TAXES</span><strong>−${acct.totals.tax.toFixed(2)}</strong><small>Tax deducted</small></div><div className="red"><span>EXPENSES</span><strong>−${acct.totals.expenses.toFixed(2)}</strong><small>Operating expenses</small></div></div><section className="acct2Grid"><div className="acct2Card acct2Chart"><h3>Sales & Profit</h3>{acct.daily.length?<div className="miniBars">{acct.daily.map(d=><i key={d.day} title={`${d.day} · sales $${d.sales.toFixed(2)} · profit $${d.profit.toFixed(2)}`} style={{height:`${Math.max(4,d.sales/Math.max(...acct.daily.map(x=>x.sales),1)*100)}%`}}/>)}</div>:<div className="miniBarsEmpty">No paid sales in this period.</div>}<div className="chartLegend"><span>● Sales per day · total ${acct.totals.sales.toFixed(2)}</span><span>● Net profit ${acct.totals.net.toFixed(2)}</span></div></div><div className="acct2Card"><h3>Top Products</h3><div className="topProducts">{topProducts.length?topProducts.map((p,i)=><div key={p.name}><b>{i+1}</b><span>{p.name}<small>{p.qty} sold</small></span><strong>${p.sales.toFixed(2)}</strong></div>):<p>No paid products yet.</p>}</div></div><div className="acct2Card"><h3>Profit Breakdown</h3><div className="profitDonut" style={{background:`conic-gradient(#3c82f6 0 ${pct(acct.totals.cogs)}%,#9b5de5 ${pct(acct.totals.cogs)}% ${pct(acct.totals.cogs+acct.totals.fees)}%,#f59eaa ${pct(acct.totals.cogs+acct.totals.fees)}% ${pct(acct.totals.cogs+acct.totals.fees+acct.totals.expenses)}%,#25a96b ${pct(acct.totals.cogs+acct.totals.fees+acct.totals.expenses)}% 100%)`}}><div><strong>${acct.totals.net.toFixed(0)}</strong><small>Net Profit</small></div></div><div className="profitLegend"><span>COGS ${acct.totals.cogs.toFixed(2)}</span><span>Stripe ${acct.totals.fees.toFixed(2)}</span><span>Expenses ${acct.totals.expenses.toFixed(2)}</span><span>Net ${acct.totals.net.toFixed(2)}</span></div></div></section><section className="acct2Card acct2Recent"><div className="acct2Title"><div><small>PAID ORDERS</small><h2>Recent Sales</h2></div><b>Net profit ${acct.totals.net.toFixed(2)}</b></div><div className="tableWrap"><table><thead><tr><th>DATE</th><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>TOTAL</th><th>DISCOUNT</th><th>SHIPPING</th><th>TAX</th><th>STRIPE FEE</th><th>COGS</th><th>PROFIT</th></tr></thead><tbody>{recent.map((g,i)=>{const first=g.lines[0],o=g.order||{},cogs=g.lines.reduce((a,x)=>a+x.totalCost,0),discount=g.lines.reduce((a,x)=>a+x.discount,0),shipping=g.lines.reduce((a,x)=>a+x.shipping,0),tax=g.lines.reduce((a,x)=>a+x.tax,0);return <tr key={first.order_id||i}><td>{o.created_at?new Date(o.created_at).toLocaleDateString():''}</td><td><b>#{o.order_number||''}</b></td><td>{o.email||'Customer'}</td><td>{g.lines.length}</td><td>${g.total.toFixed(2)}</td><td>−${discount.toFixed(2)}</td><td>−${shipping.toFixed(2)}</td><td>−${tax.toFixed(2)}</td><td className="feeCell">−${g.fee.toFixed(2)}</td><td>−${cogs.toFixed(2)}</td><td className={g.profit>=0?'profitPositive':'profitNegative'}><b>${g.profit.toFixed(2)}</b></td></tr>})}</tbody></table></div></section><section className="acct2Bottom"><div className="acct2Card"><h3>Profit Summary</h3><div className="summaryRows"><div><span>Gross sales</span><b>${totalSales.toFixed(2)}</b></div><div><span>Discounts</span><b>−${(acct.totals.discounts||0).toFixed(2)}</b></div><div><span>COGS</span><b>−${acct.totals.cogs.toFixed(2)}</b></div><div><span>Shipping</span><b>−${acct.totals.shipping.toFixed(2)}</b></div><div><span>Taxes</span><b>−${acct.totals.tax.toFixed(2)}</b></div><div><span>Stripe fees</span><b>−${acct.totals.fees.toFixed(2)}</b></div><div><span>Operating expenses</span><b>−${acct.totals.expenses.toFixed(2)}</b></div><div className="net"><span>NET PROFIT</span><b>${acct.totals.net.toFixed(2)}</b></div></div></div><div className="acct2Card"><h3>Operating Expenses</h3><form className="acct2ExpenseForm" onSubmit={e=>create(e,'expense')}><Field name="description" placeholder="Description" required/><Field name="amount" placeholder="Amount" type="number" step="0.01" required/><Field name="category" placeholder="Category"/><Field name="expense_date" type="date"/><button>ADD EXPENSE</button></form><DataTable rows={acct.expenses.slice(0,5)}/></div></section></>}

  if(tab==='Reviews')return <><div className="adminSectionHead"><div><small>CUSTOMER REVIEWS</small><h2>{rows.length} review{rows.length===1?'':'s'}</h2><p className="formHelp">Reviews are published as soon as a customer sends them. Hide one to take it off the store without deleting it.</p></div></div>{rows.length?<div className="tableWrap"><table><thead><tr><th>DATE</th><th>PRODUCT</th><th>RATING</th><th>CUSTOMER</th><th>REVIEW</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.created_at?new Date(r.created_at).toLocaleDateString():''}</td><td>{productsList.find(p=>p.id===r.product_id)?.name||'—'}</td><td><Stars value={r.rating}/></td><td><b>{r.author_name}</b></td><td className="productDescCell messageCell">{r.body}</td><td>{r.approved?'PUBLISHED':'HIDDEN'}</td><td className="actionsCell"><div className="rowActionButtons"><button onClick={()=>toggleReview(r)}>{r.approved?'HIDE':'PUBLISH'}</button><button className="dangerBtn" onClick={()=>deleteReview(r)}>DELETE</button></div></td></tr>)}</tbody></table></div>:<div className="panel empty">No reviews yet.</div>}</>;
  if(tab==='Messages')return <><div className="adminSectionHead"><div><small>CONTACT FORM</small><h2>{rows.length} message{rows.length===1?'':'s'}</h2><p className="formHelp">Messages customers send from the Contact page. Reply opens your email app.</p></div></div>{rows.length?<div className="tableWrap"><table><thead><tr><th>DATE</th><th>NAME</th><th>EMAIL</th><th>MESSAGE</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.created_at?new Date(r.created_at).toLocaleString():''}</td><td><b>{r.name}</b></td><td>{r.email}</td><td className="productDescCell messageCell">{r.message}</td><td className="actionsCell"><div className="rowActionButtons"><a className="rowLink" href={'mailto:'+r.email+'?subject='+encodeURIComponent('KARIA — your message')}>REPLY</a><button className="dangerBtn" onClick={()=>deleteMessage(r)}>DELETE</button></div></td></tr>)}</tbody></table></div>:<div className="panel empty">No messages yet.</div>}</>;
  if(tab==='Customize')return <CustomizeAdmin setNotice={setNotice}/>;
  if(tab==='Customers'){const customers=rows.filter(r=>!['staff','admin','super_admin'].includes(r.role));const byCustomer={};customerOrders.forEach(o=>{if(!o.customer_id)return;const c=byCustomer[o.customer_id]??={email:o.email,orders:0,spent:0};c.email=c.email||o.email;if(PAID_STATUSES.includes(String(o.status).toLowerCase())){c.orders++;c.spent+=Number(o.total||0)}});return <><div className="adminSectionHead"><div><small>STORE ACCOUNTS</small><h2>{customers.length} customer{customers.length===1?'':'s'}</h2><p className="formHelp">People who created a KARIA account. Paid orders and total spent come from Orders.</p></div></div>{customers.length?<div className="tableWrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>PHONE</th><th>PAID ORDERS</th><th>SPENT</th><th>JOINED</th></tr></thead><tbody>{customers.map(r=>{const c=byCustomer[r.id]||{};return <tr key={r.id}><td><b>{r.full_name||'—'}</b></td><td>{c.email||'—'}</td><td>{r.phone||'—'}</td><td>{c.orders||0}</td><td>${Number(c.spent||0).toFixed(2)}</td><td>{r.created_at?new Date(r.created_at).toLocaleDateString():''}</td></tr>})}</tbody></table></div>:<div className="panel empty">No customers yet.</div>}{subscribers.length>0&&<><div className="adminSectionHead"><div><small>NEWSLETTER</small><h2>{subscribers.length} subscriber{subscribers.length===1?'':'s'}</h2></div></div><div className="tableWrap"><table><thead><tr><th>EMAIL</th><th>JOINED</th></tr></thead><tbody>{subscribers.map(r=><tr key={r.email}><td>{r.email}</td><td>{r.created_at?new Date(r.created_at).toLocaleDateString():''}</td></tr>)}</tbody></table></div></>}</>}
  if(tab==='Admin users')return <><form className="adminForm wide" onSubmit={createAdmin}><h2>Create administrator</h2><Field name="full_name" placeholder="Full name" required/><Field name="email" placeholder="Email" type="email" required/><select name="role"><option value="admin">Admin</option><option value="staff">Staff</option></select><button>CREATE ACCESS</button></form><div className="userCards">{rows.map(r=><div className="panel" key={r.id}><b>{r.full_name||r.email||'User'}</b><small>{r.role}</small><div>{r.id!==currentUserId&&<button onClick={()=>updateAdmin(r.id,r.role,!r.disabled)}>{r.disabled?'ACTIVATE':'DISABLE'}</button>}{r.role!=='super_admin'&&<button onClick={()=>updateAdmin(r.id,r.role==='admin'?'staff':'admin',!!r.disabled)}>MAKE {r.role==='admin'?'STAFF':'ADMIN'}</button>}{currentAdmin?.role==='super_admin'&&r.id!==currentUserId&&<button className="passwordAdminBtn" onClick={()=>resetAdminPassword(r)}>RESET PASSWORD</button>}</div></div>)}</div></>;
  if(tab==='Coupons')return <><form className="adminForm wide" onSubmit={e=>create(e,'coupon')}><h2>New coupon</h2><Field name="code" placeholder="Code e.g. KARIA10" required/><Field name="percent_off" placeholder="Percent off" type="number"/><Field name="amount_off" placeholder="Fixed amount off" type="number"/><Field name="ends_at" type="date"/><button>CREATE COUPON</button></form><CouponTable rows={rows} onToggle={toggleCoupon} onDelete={deleteCoupon}/></>;
  if(tab==='Settings'){const v=settingsValues;return <form className="adminForm wide" onSubmit={e=>create(e,'settings')}><h2>Store settings</h2><p className="formHelp">These are the values saved today. Checkout charges the default shipping rate on every order, and nothing when the order reaches the free-shipping amount (0 = never free).</p><label className="caField">Store name<input name="store_name" defaultValue={v.store?.name??'KARIA'}/></label><label className="caField">Currency<input name="currency" defaultValue={v.store?.currency??'USD'}/></label><label className="caField">Default shipping rate<input name="shipping_rate" type="number" step="0.01" min="0" defaultValue={v.shipping?.default_rate??0}/></label><label className="caField">Free shipping over<input name="free_shipping_over" type="number" step="0.01" min="0" defaultValue={v.shipping?.free_shipping_over??0}/></label><label className="caField">Returns window (days)<input name="returns_days" type="number" min="0" defaultValue={v.legal?.returns_days??14}/></label><h2>Contact & About pages</h2><p className="formHelp">Shown on the Contact and About pages. Leave a field empty to hide it.</p><label className="caField">Contact email<input name="contact_email" type="email" defaultValue={v.storefront?.contact_email??''}/></label><label className="caField">WhatsApp number (with country code)<input name="whatsapp" defaultValue={v.storefront?.whatsapp??''} placeholder="+1 555 123 4567"/></label><label className="caField">Instagram user<input name="instagram" defaultValue={v.storefront?.instagram??''} placeholder="@karia"/></label><label className="caField full">About text (one paragraph per line)<textarea name="about" rows={5} defaultValue={v.storefront?.about??''}/></label><button>SAVE SETTINGS</button></form>}
  return <DataTable rows={rows}/>;
 };
 return <div className="admin"><aside><div className="logo">KARIA</div><small>ADMINISTRATION</small>{nav.map(([x,I])=>I?<button className={tab===x?'selected':''} key={x} onClick={()=>setTab(x)}><I/>{x}</button>:<em className="navGroup" key={x}>{x}</em>)}<button onClick={back}>← Storefront</button></aside><section className="adminMain"><div className="adminTop"><div><small>KARIA OPERATIONS</small><h1>{tab}</h1></div><div className="owners"><b>Ownership</b><span>Partner A 50%</span><span>Partner B 50%</span></div></div>{notice&&<div className="notice">{notice}</div>}{loading?<div className="panel">Loading…</div>:module()}</section>
{viewingOrder&&<OrderDetailModal order={viewingOrder} onClose={()=>setViewingOrder(null)} onSave={saveOrder}/>}
{editingProduct&&<div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingProduct(null)}}><div className="editModal"><div className="editModalHead"><div><small>EDIT PRODUCT</small><h2>{editingProduct.name}</h2></div><button type="button" onClick={()=>setEditingProduct(null)}>×</button></div><form className="editModalForm" onSubmit={saveProductEdit}><label>Product name<input name="name" defaultValue={editingProduct.name||''} required/></label><label>SKU<input name="sku" defaultValue={editingProduct.sku||''} required/></label><label>Brand<select name="brand_id" defaultValue={editingProduct.brand_id||''}><option value="">No brand</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Category<select name="category" defaultValue={editingProduct.category||''} required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>Sale price<input name="price" type="number" step="0.01" defaultValue={editingProduct.price??''}/></label><label>Unit cost<input name="unit_cost" type="number" step="0.01" defaultValue={editingProduct.unit_cost??''}/></label><label>Weight<input name="weight" type="number" step="0.001" defaultValue={editingProduct.weight??''}/></label><label>Low stock alert<input name="low_stock_threshold" type="number" defaultValue={editingProduct.low_stock_threshold??2}/></label><label>Materials<input name="materials" defaultValue={editingProduct.materials||''}/></label><label>Dimensions<input name="dimensions" defaultValue={editingProduct.dimensions||''}/></label><label className="full">Description<textarea name="description" defaultValue={editingProduct.description||''}/></label><label>Status<select name="active" defaultValue={editingProduct.active===false?'false':'true'}><option value="true">Active / Published</option><option value="false">Archived / Hidden</option></select></label><label className="editCheck"><input name="featured" type="checkbox" defaultChecked={!!editingProduct.featured}/> Featured product</label><div className="editModalActions full"><button type="button" onClick={()=>setEditingProduct(null)}>CANCEL</button><button type="submit">SAVE PRODUCT</button></div></form></div></div>}
{editingMovement&&<div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingMovement(null)}}><div className="editModal inventoryEditModal"><div className="editModalHead"><div><small>EDIT INVENTORY MOVEMENT</small><h2>{editingMovement.products?.name||'Inventory entry'}</h2></div><button type="button" onClick={()=>setEditingMovement(null)}>×</button></div><form className="editModalForm" onSubmit={saveMovementEdit}><label className="full">Product<select name="product_id" defaultValue={editingMovement.product_id||''} required>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><label>Quantity<input name="qty" type="number" defaultValue={editingMovement.qty??editingMovement.quantity??''} required/></label><label>Movement type<select name="movement_type" defaultValue={editingMovement.movement_type||'ADJUST'}><option value="IN">IN / RECEIVED</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select></label><label className="full">Reason / reference<textarea name="note" defaultValue={String(editingMovement.note||'').replace(/^OPENING STOCK\s*[·-]?\s*/i,'')}/></label><div className="editModalActions full"><button type="button" onClick={()=>setEditingMovement(null)}>CANCEL</button><button type="submit">SAVE MOVEMENT</button></div></form></div></div>}
</div>
}
function orderPhoto(item){return mainPhoto(item?.products?.product_media)}
function OrderAdminTable({rows,onView,onDelete}){
 if(!rows?.length)return <div className="panel empty">No orders yet.</div>;
 return <div className="orderAdminGrid">{rows.map(o=>{const items=o.order_items||[],first=items[0],photo=first?.customization?null:orderPhoto(first),status=String(o.status||'pending').toLowerCase(),canDelete=true;return <article className="orderAdminCard" key={o.id}><div className="orderCardPhoto">{first?.customization?<div className="orderCustomArt"><CustomizationSheet c={first.customization} compact/></div>:photo?<img src={photo} alt={first?.products?.name||'Order product'}/>:<div>NO PHOTO</div>}{items.length>1&&<span>+{items.length-1}</span>}</div><div className="orderCardBody"><div className="orderCardTop"><div><small>ORDER</small><h3>#{o.order_number||'—'}</h3></div><span className={`orderStatus ${status}`}>{status.toUpperCase()}</span></div><div className="orderProductName">{first?.customization?`Custom Bag · ${first.customization.style_name||''}`:first?.products?.name||'Order'}{items.length>1?` + ${items.length-1} more`:''}</div><div className="orderMeta"><span>{o.created_at?new Date(o.created_at).toLocaleString():''}</span><span>{o.email||''}</span></div><div className="orderCardBottom"><div><small>CUSTOMER PAID</small><strong>${Number(o.total||0).toFixed(2)}</strong></div><div><small>STRIPE FEE</small><strong>−${Number(o.processor_fee||0).toFixed(2)}</strong></div><div><small>NET AFTER STRIPE</small><strong>${(Number(o.total||0)-Number(o.processor_fee||0)).toFixed(2)}</strong></div><div className="rowActionButtons"><button onClick={()=>onView(o)}>VIEW ORDER</button>{canDelete&&<button className="dangerBtn" onClick={()=>onDelete(o)}>DELETE</button>}</div></div></div></article>})}</div>
}
function OrderDetailModal({order,onClose,onSave}){
 const items=order.order_items||[],addr=order.shipping_address||{};
 // checkout writes discount_total / shipping_total and address1 / address2; older rows used the short names
 const discount=Number(order.discount_total??order.discount??0),shipping=Number(order.shipping_total??order.shipping??0),tax=Number(order.tax||0),fee=Number(order.processor_fee||0),total=Number(order.total||0);
 const cogs=items.reduce((sum,it)=>sum+Number(it.qty||0)*Number(it.unit_cost||0),0);
 const address=[addr.address1||addr.address_line1||addr.line1,addr.address2||addr.address_line2||addr.line2,addr.city,addr.state,addr.postal_code||addr.zip,addr.country].filter(Boolean).join(', ');
 const save=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));onSave(order,{status:f.status,carrier:f.carrier.trim()||null,tracking_number:f.tracking_number.trim()||null})};
 return <div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="editModal orderDetailModal"><div className="editModalHead"><div><small>ORDER DETAILS</small><h2>Order #{order.order_number||'—'}</h2><span className={`orderStatus ${String(order.status||'').toLowerCase()}`}>{String(order.status||'').toUpperCase()}</span></div><button type="button" onClick={onClose}>×</button></div>
  <section className="orderDetailProducts">{items.map((it,i)=>{const photo=orderPhoto(it),line=<div className="orderDetailPrice"><span>{it.qty} × ${Number(it.unit_price||0).toFixed(2)}</span><strong>${(Number(it.qty||0)*Number(it.unit_price||0)).toFixed(2)}</strong></div>;if(it.customization)return <div className="orderDetailProduct orderDetailCustom" key={it.id||i}><CustomizationSheet c={it.customization}/>{line}</div>;return <div className="orderDetailProduct" key={it.id||i}>{photo?<img src={photo} alt={it.products?.name||'Product'}/>:<div className="orderDetailNoPhoto">NO PHOTO</div>}<div><h3>{it.products?.name||'Product'}</h3><span>{it.products?.sku||''}</span><p>{it.products?.description||''}</p></div>{line}</div>})}</section>
  <div className="orderDetailColumns"><section><small>CUSTOMER</small><h3>{order.email||'—'}</h3><p>{order.created_at?new Date(order.created_at).toLocaleString():''}</p></section><section><small>SHIPPING ADDRESS</small><h3>{addr.full_name||addr.name||''}</h3><p>{address||'No shipping address saved'}</p>{addr.phone&&<p>Phone: {addr.phone}</p>}</section></div>
  <form className="orderManage" onSubmit={save}><label>Order status<select name="status" defaultValue={String(order.status||'pending').toLowerCase()}>{ORDER_STATUSES.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label><label>Carrier<input name="carrier" defaultValue={order.carrier||''} placeholder="e.g. USPS"/></label><label>Tracking number<input name="tracking_number" defaultValue={order.tracking_number||''}/></label><button type="submit">SAVE ORDER</button></form>
  <div className="orderTotals"><div><span>Subtotal</span><b>${Number(order.subtotal||0).toFixed(2)}</b></div><div><span>Discount{order.coupon_code?` · ${order.coupon_code}`:''}</span><b>−${discount.toFixed(2)}</b></div><div><span>Shipping</span><b>${shipping.toFixed(2)}</b></div><div><span>Tax</span><b>${tax.toFixed(2)}</b></div><div><span>Stripe processing fee</span><b>−${fee.toFixed(2)}</b></div><div className="orderGrandTotal"><span>Customer paid</span><strong>${total.toFixed(2)}</strong></div><div><span>Net after Stripe</span><b>${(total-fee).toFixed(2)}</b></div><div><span>Product cost / COGS</span><b>−${cogs.toFixed(2)}</b></div><div className="orderGrandTotal"><span>Final profit</span><strong>${(Number(order.subtotal||0)-discount-shipping-tax-fee-cogs).toFixed(2)}</strong></div></div>
  <div className="orderPaymentRef"><small>PAYMENT REFERENCE</small><span>Stripe session: {order.stripe_session_id||'—'}</span><span>Payment intent: {order.stripe_payment_intent||'—'}</span></div><div className="editModalActions"><button type="button" onClick={onClose}>CLOSE</button></div></div></div>
}

function ProductAdminTable({rows,onEdit,onDelete}){
 if(!rows?.length)return <div className="panel empty">No products yet.</div>;
 return <div className="tableWrap productAdminTable"><table><thead><tr><th>PHOTO</th><th>PRODUCT</th><th>CATEGORY</th><th>SKU</th><th>DESCRIPTION</th><th>PRICE</th><th>COST</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{rows.map((r,i)=>{
   const media=[...(r.product_media||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
   const photo=media.find(m=>String(m.media_type||'image').startsWith('image'))?.url||media[0]?.url||'';
   return <tr key={r.id||i}><td>{photo?<img className="adminProductThumb" src={photo} alt={r.name||'Product'}/>:<div className="adminProductThumb emptyThumb">NO PHOTO</div>}</td><td><b>{r.name||''}</b></td><td>{r.category||''}</td><td>{r.sku||''}</td><td className="productDescCell">{r.description||''}</td><td>{r.price==null?'':`$${Number(r.price).toFixed(2)}`}</td><td>{r.unit_cost==null?'':`$${Number(r.unit_cost).toFixed(2)}`}</td><td>{r.active===false?'ARCHIVED':'ACTIVE'}</td><td className="actionsCell"><div className="rowActionButtons"><button onClick={()=>onEdit(r)}>EDIT</button><button className="dangerBtn" onClick={()=>onDelete(r)}>DELETE</button></div></td></tr>
 })}</tbody></table></div>
}

function CouponTable({rows,onToggle,onDelete}){
 if(!rows?.length)return <div className="panel empty">No coupons yet.</div>;
 const clean=v=>v===null||v===undefined||v===''?'':v;
 const date=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'})};
 return <div className="tableWrap"><table><thead><tr><th>CODE</th><th>PERCENT OFF</th><th>AMOUNT OFF</th><th>STATUS</th><th>STARTS AT</th><th>ENDS AT</th><th>ACTIONS</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}><td><b>{clean(r.code)}</b></td><td>{r.percent_off?`${Number(r.percent_off)}%`:''}</td><td>{r.amount_off?`$${Number(r.amount_off).toFixed(2)}`:''}</td><td>{r.active===true?'Active':r.active===false?'Inactive':''}</td><td>{date(r.starts_at)}</td><td>{date(r.ends_at)}</td><td className="actionsCell"><div className="rowActionButtons"><button onClick={()=>onToggle(r)}>{r.active===false?'ACTIVATE':'DEACTIVATE'}</button><button className="dangerBtn" onClick={()=>onDelete(r)}>DELETE</button></div></td></tr>)}</tbody></table></div>
}

function DataTable({rows,actions}){if(!rows?.length)return <div className="panel empty">No records yet.</div>;const keys=Object.keys(rows[0]).filter(k=>!['metadata','after_data','before_data'].includes(k)).slice(0,7);return <div className="tableWrap"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}{actions&&<th>ACTIONS</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{keys.map(k=><td key={k}>{typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k]??'')}</td>)}{actions&&<td className="actionsCell">{actions(r)}</td>}</tr>)}</tbody></table></div>}

createRoot(document.getElementById("root")).render(<App/>);
