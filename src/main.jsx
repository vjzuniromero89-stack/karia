import React,{useEffect,useMemo,useState,Suspense,lazy} from "react";
import {createRoot} from "react-dom/client";
import {ShoppingBag,ArrowRight,X,MoveDown,Package,Wallet,Users,Boxes,BarChart3,Settings,ShieldCheck,Palette,Tag,LayoutGrid,UserCog,Mail,Star} from "lucide-react";
import "./style.css";
import {supabase,configured} from "./supabase";
import "./noir.css";
import {NoirHome} from "./noir";
import {LegalPage} from "./legal";
import {useEscape,LEGAL,soldOut} from "./storefront";
import {CUSTOMIZE_ON,StoreHeader,CartDrawer,ShopPage,ProductPage,ReviewsPage,ratingOf,Stars,OrdersPage,ContactPage,AboutPage,Footer,mainPhoto,sortedMedia} from "./storefront";
import {CustomizePage,BagPhoto,BUILTIN_STYLES,CUSTOM_SKU} from "./customize";
// The admin is only downloaded when an admin opens it, so shoppers get a lighter page.
const Admin=lazy(()=>import("./admin.jsx"));

const products=[
 {id:1,name:"Terra Woven Bag",brand:"Independent Artisan",price:118,img:"/products/bag-brown.jpg",stock:4,tone:"Cocoa / Ivory"},
 {id:2,name:"Midnight Woven Bag",brand:"Independent Artisan",price:126,img:"/products/bag-blue.jpg",stock:3,tone:"Midnight Blue"},
 {id:3,name:"Signature Handwoven",brand:"Independent Artisan",price:132,img:"/products/bag-detail.jpg",stock:2,tone:"Artisan Edition"},
];

const PAID=['paid','processing','shipped','delivered'];
function CheckoutSuccessPage({setCart,Header}){
 useEffect(()=>{setCart([]);try{localStorage.removeItem('karia_cart')}catch{}},[setCart]);
 let pending={};try{pending=JSON.parse(sessionStorage.getItem('karia_pending_order')||'{}')}catch{}
 // Ask the database (the customer can read their own orders) whether the webhook already marked this payment as paid.
 const [status,setStatus]=useState('checking');
 useEffect(()=>{const sid=new URLSearchParams(location.search).get('session_id');if(!supabase||!sid){setStatus('pending');return}let n=0,live=true;
  const look=async()=>{const {data}=await supabase.from('orders').select('status').eq('stripe_session_id',sid).maybeSingle();if(!live)return;
   if(PAID.includes(String(data?.status||'').toLowerCase()))setStatus('paid');else if(++n<6)setTimeout(look,2500);else setStatus('pending')};
  look();return()=>{live=false}},[]);
 return <div className="catalogPage">{Header}<main className="checkoutPage"><section className="checkoutSuccess"><small>{status==='paid'?'PAYMENT CONFIRMED':'THANK YOU'}</small><h1>Thank you.</h1><p>{status==='paid'?'Your payment is confirmed':'Your payment was sent to Stripe'}{pending.order_number?<> for KARIA order <b>#{pending.order_number}</b></>:null}.</p>{pending.total!=null&&<div className="checkoutSuccessTotal"><span>Total</span><b>${Number(pending.total||0).toFixed(2)}</b></div>}<p className="checkoutPending">{status==='paid'?'We are preparing your order. You can follow it in My orders.':status==='checking'?'Confirming the payment…':'Stripe is still confirming the payment. Your order will appear in My orders as soon as it is confirmed.'}</p><a className="accountPrimary checkoutLink" href="/shop">CONTINUE SHOPPING <ArrowRight/></a></section></main></div>
}
function CheckoutPage({cart,user,Header,onSignIn}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const canceled=new URLSearchParams(location.search).has('canceled');
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
 const applyCoupon=async()=>{setNotice('');const code=couponCode.trim().toUpperCase();if(!code){setCoupon(null);setNotice('Enter a coupon code.');return}if(!supabase){setNotice('Supabase is not configured.');return}setCouponBusy(true);try{const now=new Date().toISOString();// check_coupon (V7.49) hides the coupon list from the public; the direct read is a fallback until that SQL runs
  let {data,error}=await supabase.rpc('check_coupon',{p_code:code}).maybeSingle();if(error){({data,error}=await supabase.from('coupons').select('code,percent_off,amount_off,starts_at,ends_at').eq('code',code).eq('active',true).maybeSingle())}if(error)throw new Error('Coupon could not be checked right now.');if(!data)throw new Error('Coupon code is not valid.');if(data.starts_at&&new Date(data.starts_at)>new Date())throw new Error('This coupon is not active yet.');if(data.ends_at&&new Date(data.ends_at)<new Date())throw new Error('This coupon has expired.');if(!Number(data.percent_off||0)&&!Number(data.amount_off||0))throw new Error('This coupon has no discount configured.');setCoupon(data);setCouponCode(data.code);setNotice(`Coupon ${data.code} applied.`);}catch(err){setCoupon(null);setNotice(err?.message||'Coupon could not be applied.')}finally{setCouponBusy(false)}};
 const submit=async(e)=>{e.preventDefault();if(busy)return;setNotice('');if(!user){setNotice('Please sign in before continuing to payment.');return}if(!supabase){setNotice('Supabase is not configured.');return}if(!grouped.length){setNotice('Your bag is empty.');return}setBusy(true);try{const f=Object.fromEntries(new FormData(e.currentTarget));const items=grouped.map(p=>({product_id:p.id,qty:p.qty,quantity:p.qty,customization:p.customization||null}));const shipping_address={full_name:f.full_name,address1:f.address1,address2:f.address2||'',city:f.city,state:f.state,postal_code:f.postal_code,country:f.country,phone:f.phone||''};const {data,error}=await supabase.functions.invoke('create-checkout',{body:{items,shipping_address,coupon_code:coupon?.code||null}});if(error){let msg=error.message;try{const ctx=error.context;if(ctx&&typeof ctx.json==='function'){const body=await ctx.json();msg=body?.error||body?.message||msg}}catch{}throw new Error(msg)}if(data?.ok===false)throw new Error(data?.error||'Checkout could not be created.');if(!data?.checkout_url)throw new Error(data?.error||'Stripe Checkout URL was not returned.');sessionStorage.setItem('karia_pending_order',JSON.stringify({order_id:data.order_id,order_number:data.order_number,total:data.total}));window.location.assign(data.checkout_url);return;}catch(err){setNotice(err?.message||'Checkout could not be created.')}finally{setBusy(false)}};
 return <div className="catalogPage">{Header}<main className="checkoutPage"><div className="checkoutIntro"><small>SECURE CHECKOUT</small><h1>Complete your order.</h1><p>Enter your shipping details to continue with your KARIA order.</p></div>{canceled&&<p className="checkoutError checkoutTopNote">Payment canceled. Your bag is still here, you can try again whenever you are ready.</p>}{!user&&<div className="checkoutAuthNotice checkoutTopNote">Sign in or create a free account to pay. It takes a minute and your bag stays here. <button type="button" className="checkoutSignIn" onClick={onSignIn}>SIGN IN OR CREATE ACCOUNT</button></div>}<div className="checkoutGrid"><form className="checkoutForm" onSubmit={submit}><h2>Shipping details</h2><label>Full name<input name="full_name" autoComplete="name" required/></label><label>Email<input value={user?.email||''} readOnly placeholder={user?'':'Sign in to continue'}/></label><label>Address<input name="address1" required/></label><label>Apartment / suite<input name="address2"/></label><div className="checkoutTwo"><label>City<input name="city" required/></label><label>State / Province<input name="state" required/></label></div><div className="checkoutTwo"><label>ZIP / Postal code<input name="postal_code" required/></label><label>Country<select name="country" defaultValue="US"><option value="US">United States</option><option value="NI">Nicaragua</option><option value="SV">El Salvador</option></select></label></div><label>Phone<input name="phone" type="tel"/></label><div className="checkoutCoupon"><label>Coupon code<input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCoupon(null)}} placeholder="e.g. KARIA05"/></label><button type="button" onClick={applyCoupon} disabled={couponBusy}>{couponBusy?'CHECKING…':'APPLY COUPON'}</button></div>{notice&&<p className={coupon&&notice.includes('applied')?'checkoutCouponSuccess':'checkoutError'}>{notice}</p>}<button className="checkoutPay" disabled={busy||!cart.length||!user}>{busy?'CREATING ORDER…':user?'CONTINUE TO PAYMENT':'SIGN IN REQUIRED'} <ArrowRight/></button><p className="checkoutLegal">By continuing you agree to our <a href="/terms">Terms</a>. See <a href="/shipping">Shipping</a> and <a href="/returns">Returns & Refunds</a>.</p><a className="checkoutBack" href="/shop">← Return to shop</a></form><aside className="checkoutSummary"><small>YOUR ORDER</small><h2>{cart.length} piece{cart.length===1?'':'s'}</h2>{grouped.map(p=><div className="checkoutItem" key={p.cartKey||p.id}><img src={p.thumb||p.img} alt={p.name}/><div><b>{p.name}</b><span>Qty {p.qty}</span>{p.customization&&<span className="checkoutCustom">{p.tone}</span>}</div><strong>${(Number(p.price)*p.qty).toFixed(2)}</strong></div>)}<div className="checkoutLine"><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div>{coupon&&<div className="checkoutLine couponDiscount"><span>Coupon <b>{coupon.code}</b></span><b>−${discount.toFixed(2)}</b></div>}<div className="checkoutLine"><span>Shipping</span>{shipRule?<b>{shipping>0?`$${shipping.toFixed(2)}`:'Free'}</b>:<span>Confirmed at payment</span>}</div><div className="checkoutTotal"><span>{shipRule?'Total':'Total before shipping'}</span><b>${totalAfterDiscount.toFixed(2)}</b></div></aside></div></main></div>
}

// Photos served by the site itself (/products/<slug>.jpg) have a 640px copy for small spots like the home page cover;
// a full-size photo squeezed into a tiny tilted card looks jagged.
const smallPhoto=url=>String(url||"").startsWith("/products/")&&String(url).endsWith(".jpg")?String(url).slice(0,-4)+"-thumb.jpg":url;
const small=p=>p?.thumb||p?.img;

function App(){
 useEffect(()=>{
  if('scrollRestoration' in window.history)window.history.scrollRestoration='manual';
  const goTop=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
  goTop();
  const id=requestAnimationFrame(goTop);
  window.addEventListener('pageshow',goTop);
  return()=>{cancelAnimationFrame(id);window.removeEventListener('pageshow',goTop)};
 },[]);
 const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('karia_cart')||'[]')}catch{return []}}),[admin,setAdmin]=useState(false),[cartOpen,setCartOpen]=useState(false),[storeProducts,setStoreProducts]=useState([]),[loaded,setLoaded]=useState(false);
 // Store look: "noir" (new, default) or "classic" (the original design), chosen in Admin → Settings. Remembered so the page doesn't flash.
 const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('karia_theme')==='classic'?'classic':'noir'}catch{return 'noir'}});
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
 useEffect(()=>{if(!supabase)return;supabase.from('settings').select('value').eq('key','storefront').maybeSingle().then(({data})=>{const v=data?.value||{};setStorefront(v);if(data){const t=v.theme==='classic'?'classic':'noir';setTheme(t);try{localStorage.setItem('karia_theme',t)}catch{}}})},[]);
 useEffect(()=>{if(!supabase)return; (async()=>{const [{data},{data:stockRows}]=await Promise.all([supabase.from("products").select("id,name,price,compare_at_price,sku,materials,dimensions,description,brand_id,category,created_at,product_media(url,media_type,sort_order)").eq("active",true).order("created_at",{ascending:false}),supabase.from("product_stock").select("*")]);const stockMap=Object.fromEntries((stockRows||[]).map(r=>[r.product_id,Number(r.stock??r.quantity??r.qty??0)]));setStoreProducts((data||[]).filter(p=>p.sku!==CUSTOM_SKU).map((p,i)=>({id:p.id,name:p.name,brand:"KARIA Artisan",price:Number(p.price),compareAt:Number(p.compare_at_price||0),img:mainPhoto(p.product_media)||products[i%products.length].img,media:sortedMedia(p.product_media),thumb:smallPhoto(mainPhoto(p.product_media)),stock:stockMap[p.id]||0,tone:p.materials||p.dimensions||"Handcrafted",description:p.description||"",category:p.category||"",created_at:p.created_at||""})));setLoaded(true)})().catch(()=>setLoaded(true))},[]);
 // The bag remembers products from an earlier visit: bring prices, photos and stock up to date, and drop what can no longer be bought.
 useEffect(()=>{if(!loaded||!storeProducts.length)return;const by=Object.fromEntries(storeProducts.map(p=>[p.id,p])),seen={};let changed=false;
  const next=cart.flatMap(x=>{if(x.customization)return [x];const p=by[x.id];seen[x.id]=(seen[x.id]||0)+1;if(!p||seen[x.id]>Number(p.stock||0)){changed=true;return []}if(p.price!==x.price||p.stock!==x.stock)changed=true;return [{...x,...p}]});
  if(changed){setCart(next);setCartNotice('We updated your bag with current prices and availability.')}},[loaded,storeProducts]);
 const checkout=()=>{if(!cart.length)return;try{localStorage.setItem('karia_cart',JSON.stringify(cart))}catch{}setCartOpen(false);window.location.assign('/checkout')};
 useEffect(()=>{try{localStorage.setItem('karia_cart',JSON.stringify(cart))}catch{}},[cart]);
 const loadProfile=async(u)=>{if(!u||!supabase){setProfile(null);return} const {data}=await supabase.from("profiles").select("id,full_name,role,disabled").eq("id",u.id).single(); setProfile(data||null)};
 useEffect(()=>{if(!supabase)return; supabase.auth.getSession().then(({data})=>{const u=data.session?.user||null;setUser(u);loadProfile(u);if(u?.user_metadata?.must_change_password)setPasswordOpen(true)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;setUser(u);loadProfile(u);if(u?.user_metadata?.must_change_password||_e==="PASSWORD_RECOVERY")setPasswordOpen(true)});return()=>subscription.unsubscribe()},[]);
 const submitAuth=async(e)=>{e.preventDefault();setAuthError("");if(!supabase){setAuthError("Supabase is not configured.");return}const fd=new FormData(e.currentTarget),email=String(fd.get("email")||""),password=String(fd.get("password")||"");
  // forgotten password: Supabase emails a link that comes back here and opens "Change password"
  if(authMode==="reset"){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/"});setAuthError(error?error.message:"If that email has a KARIA account, a reset link is on its way.");return}
  let r;if(authMode==="signup")r=await supabase.auth.signUp({email,password,options:{data:{full_name:String(fd.get("name")||"")},emailRedirectTo:location.origin+(location.pathname==="/checkout"?"/checkout":"/")}});else r=await supabase.auth.signInWithPassword({email,password});if(r?.error)setAuthError(r.error.message);else if(authMode==="signup")setAuthError("Check your email to confirm your account.");else {const u=r.data?.user;if(u?.user_metadata?.must_change_password){setUser(u);setAccountOpen(false);setPasswordOpen(true)}else setAccountOpen(false)}};
 const mustChangePassword=!!user?.user_metadata?.must_change_password;
 const changePassword=async(e)=>{e.preventDefault();setPasswordNotice("");if(!supabase)return;const fd=new FormData(e.currentTarget),password=String(fd.get("new_password")||""),confirm=String(fd.get("confirm_password")||"");if(password.length<8){setPasswordNotice("Password must be at least 8 characters.");return}if(password!==confirm){setPasswordNotice("Passwords do not match.");return}const {data,error}=await supabase.auth.updateUser({password,data:{...user?.user_metadata,must_change_password:false}});if(error){setPasswordNotice(error.message);return}if(data?.user)setUser(data.user);setPasswordNotice("Password updated successfully.");e.currentTarget.reset();setTimeout(()=>setPasswordOpen(false),700)};
 const signOut=async()=>{await supabase?.auth.signOut();setAccountOpen(false);setPasswordOpen(false);setAdmin(false)};
 const canAdmin=["staff","admin","super_admin"].includes(profile?.role);
 useEffect(()=>{const fn=()=>{const max=Math.max(innerHeight,document.documentElement.scrollHeight-innerHeight);const p=scrollY/max;document.documentElement.style.setProperty("--sy",scrollY+"px");document.documentElement.style.setProperty("--sp",p)};fn();addEventListener("scroll",fn,{passive:true});return()=>removeEventListener("scroll",fn)},[]);
 useEscape(accountOpen,()=>setAccountOpen(false));
 useEscape(passwordOpen&&!mustChangePassword,()=>setPasswordOpen(false));
 useEffect(()=>{document.documentElement.classList.toggle('noir',theme==='noir'&&!admin)},[theme,admin]);
 // One title per page, so tabs, bookmarks and shared links say what they are.
 const route=location.pathname.replace(/\/+$/,'')||'/';
 const productId=route.startsWith('/product/')?decodeURIComponent(route.split('/').pop()):null;
 const pageProduct=productId&&storeProducts.find(p=>String(p.id)===productId);
 const legal=LEGAL.find(([,h])=>h===route);
 const KNOWN=['/','/shop','/new','/customize','/reviews','/orders','/contact','/about','/checkout','/checkout/success'];
 const notFound=!productId&&!legal&&!KNOWN.includes(route);
 useEffect(()=>{const names={'/shop':'Shop','/new':'New arrivals','/reviews':'Reviews','/orders':'My orders','/contact':'Contact','/about':'About','/checkout':'Checkout','/checkout/success':'Thank you'};
  const t=pageProduct?pageProduct.name:legal?legal[0]:notFound?'Page not found':names[route];document.title=t?`${t} · KARIA`:'KARIA · Handmade crochet bags'},[route,pageProduct,notFound]);
 if(admin) return <Suspense fallback={<div className="adminLoading">Loading admin…</div>}><Admin back={()=>setAdmin(false)}/></Suspense>;
 const path=location.pathname,signIn=()=>setAccountOpen(true);
 const Header=<StoreHeader cartCount={cart.length} onCart={()=>setCartOpen(true)} onAccount={signIn}/>;
 const shop={products:shopProducts,add,Header},rev={reviews,user,onSignIn:signIn,onSaved:loadReviews};
 let page;
 if(path==="/checkout/success")page=<CheckoutSuccessPage setCart={setCart} Header={Header}/>;
 else if(path==="/checkout")page=<CheckoutPage cart={cart} user={user} Header={Header} onSignIn={signIn}/>;
 else if(legal)page=<LegalPage Header={Header} kind={legal[1].slice(1)} info={storefront}/>;
 else if(notFound)page=<div className="catalogPage">{Header}<main className="catalogMain narrowMain"><div className="catalogHero"><small>404</small><h1>Page not found.</h1><p>The page you are looking for does not exist or has moved.</p><a className="cta" href="/shop">Go to the shop <ArrowRight/></a></div></main></div>;
 else if(path==="/shop"||path==="/new"||(path==="/customize"&&!CUSTOMIZE_ON))page=<ShopPage {...shop} loaded={loaded} startNew={path==="/new"}/>;
 else if(path==="/customize")page=<CustomizePage add={add} Header={Header}/>;
 else if(path==="/reviews")page=<ReviewsPage Header={Header} products={shopProducts} {...rev}/>;
 else if(path==="/orders")page=<OrdersPage user={user} Header={Header} onSignIn={signIn}/>;
 else if(path==="/contact")page=<ContactPage Header={Header} info={storefront}/>;
 else if(path==="/about")page=<AboutPage Header={Header} info={storefront}/>;
 else if(path.startsWith("/product/"))page=<ProductPage {...shop} {...rev} loaded={loaded} id={decodeURIComponent(path.split("/").pop())}/>;
 else page=theme==='noir'?<NoirHome Header={Header} products={shopProducts} add={add} loaded={loaded}/>:<HomePage Header={Header} storeProducts={storeProducts}/>;
 // Bag, account and password panels live here so they work on every page (checkout included).
 return <>{page}<Footer canAdmin={canAdmin} openAdmin={()=>setAdmin(true)}/><CartDrawer open={cartOpen} setOpen={setCartOpen} cart={cart} setCart={setCart} checkout={checkout} notice={cartNotice} add={add}/>{accountOpen&&<div className="accountBackdrop" onMouseDown={()=>setAccountOpen(false)}><section className="accountPanel" role="dialog" aria-modal="true" aria-label="Account" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" aria-label="Close" autoFocus onClick={()=>setAccountOpen(false)}><X/></button><div className="accountBrand">KARIA</div>{user?<><small className="accountEyebrow">MY ACCOUNT</small><h2>{profile?.full_name||user.email?.split("@")[0]}</h2><p className="accountEmail">{user.email}</p><div className="accountRole">{profile?.role?.replace("_"," ")||"customer"}</div><a className="accountSecondary accountLink" href="/orders">MY ORDERS</a><button className="accountSecondary passwordAction" onClick={()=>{setAccountOpen(false);setPasswordNotice("");setPasswordOpen(true)}}>CHANGE PASSWORD</button>{canAdmin&&<button className="accountPrimary" onClick={()=>{setAccountOpen(false);setAdmin(true)}}>OPEN ADMINISTRATION <ArrowRight/></button>}<button className="accountSecondary" onClick={signOut}>SIGN OUT</button></>:<><small className="accountEyebrow">WELCOME TO KARIA</small><h2>{authMode==="signin"?"Sign in":authMode==="reset"?"Reset password":"Create account"}</h2><p className="accountIntro">{authMode==="reset"?"Enter your email and we will send you a link to choose a new password.":"Access your orders, saved details and KARIA account."}</p><form onSubmit={submitAuth}>{authMode==="signup"&&<input name="name" placeholder="Full name" aria-label="Full name" autoComplete="name" required/>}<input name="email" type="email" placeholder="Email address" aria-label="Email address" autoComplete="email" required/>{authMode!=="reset"&&<input name="password" type="password" placeholder="Password" aria-label="Password" autoComplete={authMode==="signup"?"new-password":"current-password"} minLength="6" required/>}{authError&&<p className={authError.startsWith("If that email")||authError.startsWith("Check your email")?"authSuccess":"authError"}>{authError}</p>}<button className="accountPrimary" type="submit">{authMode==="signin"?"SIGN IN":authMode==="reset"?"SEND RESET LINK":"CREATE ACCOUNT"}<ArrowRight/></button></form>{authMode==="signin"&&<button className="accountSwitch" onClick={()=>{setAuthError("");setAuthMode("reset")}}>Forgot your password?</button>}<button className="accountSwitch" onClick={()=>{setAuthError("");setAuthMode(authMode==="signin"?"signup":"signin")}}>{authMode==="signin"?"New to KARIA? Create an account":"Already have an account? Sign in"}</button></>}</section></div>}{passwordOpen&&<div className="accountBackdrop" onMouseDown={()=>{if(!mustChangePassword)setPasswordOpen(false)}}><section className="accountPanel securityPanel" role="dialog" aria-modal="true" aria-label="Change password" onMouseDown={e=>e.stopPropagation()}>{!mustChangePassword&&<button className="accountClose" aria-label="Close" onClick={()=>setPasswordOpen(false)}><X/></button>}<div className="accountBrand">KARIA</div><small className="accountEyebrow">ACCOUNT SECURITY</small><h2>{mustChangePassword?"Create your new password":"Change password"}</h2><p className="accountIntro">{mustChangePassword?"Your account was created with a temporary password. Choose your private password before continuing.":"Choose a new password for your KARIA account."}</p><form onSubmit={changePassword}><input name="new_password" type="password" placeholder="New password" minLength="8" autoComplete="new-password" required/><input name="confirm_password" type="password" placeholder="Confirm new password" minLength="8" autoComplete="new-password" required/>{passwordNotice&&<p className={passwordNotice.startsWith("Password updated")?"authSuccess":"authError"}>{passwordNotice}</p>}<button className="accountPrimary" type="submit">UPDATE PASSWORD <ArrowRight/></button></form>{mustChangePassword&&<button className="accountSecondary" onClick={signOut}>SIGN OUT</button>}</section></div>}</>;
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
        {(storeProducts.length?storeProducts:products).slice(0,4).map((p,i)=><div key={p.id||i}><img src={small(p)}/></div>)}
       </div>
       <div className="phoneScreenNav"><span>HOME</span><span>DISCOVER</span><span>BAG</span></div>
      </div>
     </div>
     <div className="productOrbit orbitOne">
      <div className="orbitCard"><img src={small(storeProducts[0]||products[0])}/><span>{(storeProducts[0]||products[0]).name}</span></div>
     </div>
     <div className="productOrbit orbitTwo">
      <div className="orbitCard orbitCardWide"><img src={small(storeProducts[1]||products[1])}/><span>STYLE</span></div>
     </div>
     <div className="productOrbit orbitThree">
      <div className="orbitCard orbitCardSmall"><img src={small(storeProducts[2]||products[2])}/><span>NEW</span></div>
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
        <div className="productFloat productMain"><img src={small(storeProducts[w.a])||["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"][w.a]}/></div>
        <div className="productFloat productSide"><img src={small(storeProducts[w.b])||["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"][w.b]}/></div>
        <div className="productFloat productTiny"><img src={small(storeProducts[w.c])||["/products/bag-brown.jpg","/products/bag-blue.jpg","/products/bag-detail.jpg"][w.c]}/></div>
        <span className="floatingSphere sphereA"></span><span className="floatingSphere sphereB"></span>
       </div>
       <div className="worldMeta"><small>{w.sub}</small><h3>{w.name}</h3><span>EXPLORE <ArrowRight/></span></div>
      </a>)}
    </div>
   </section>

   <section className="newKaria" id="new">
    <div className="newKariaHead"><div><small>02 — NEW AT KARIA</small><h2>Fresh discoveries.</h2></div><a href="/shop">SHOP ALL <ArrowRight/></a></div>
    <div className="newProductRail">
     {storeProducts.slice(0,4).map((p,i)=><a className="newProductCard" href={`/product/${p.id}`} key={p.id||i}><div className="newProductImage"><img src={small(p)}/><span>0{i+1}</span></div><div><small>{p.brand||"KARIA"}</small><h3>{p.name}</h3><b>${Number(p.price||0).toFixed(2)}</b></div></a>)}
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
     <video src="/products/bag-video.mp4" poster="/products/bag-detail.jpg" muted loop playsInline controls preload="none" aria-label="KARIA production video"/>
     <span className="productionFilmBadge">KARIA · PRODUCTION FILM</span>
    </div>
   </section>
  </main>
 </div>
}

createRoot(document.getElementById("root")).render(<App/>);
