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

function App(){
 const [cart,setCart]=useState([]),[admin,setAdmin]=useState(false),[menu,setMenu]=useState(false),[active,setActive]=useState(0);
 const [accountOpen,setAccountOpen]=useState(false),[user,setUser]=useState(null),[profile,setProfile]=useState(null),[authMode,setAuthMode]=useState("signin"),[authError,setAuthError]=useState("");
 const progress=useRef(0);
 const add=p=>setCart(c=>[...c,p]);
 const loadProfile=async(u)=>{if(!u||!supabase){setProfile(null);return} const {data}=await supabase.from("profiles").select("id,full_name,role,disabled").eq("id",u.id).single(); setProfile(data||null)};
 useEffect(()=>{if(!supabase)return; supabase.auth.getSession().then(({data})=>{const u=data.session?.user||null;setUser(u);loadProfile(u)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;setUser(u);loadProfile(u)});return()=>subscription.unsubscribe()},[]);
 const submitAuth=async(e)=>{e.preventDefault();setAuthError("");if(!supabase){setAuthError("Supabase is not configured.");return}const fd=new FormData(e.currentTarget),email=String(fd.get("email")||""),password=String(fd.get("password")||"");let r;if(authMode==="signup")r=await supabase.auth.signUp({email,password,options:{data:{full_name:String(fd.get("name")||"")}}});else r=await supabase.auth.signInWithPassword({email,password});if(r.error)setAuthError(r.error.message);else if(authMode==="signup")setAuthError("Check your email to confirm your account.");else setAccountOpen(false)};
 const signOut=async()=>{await supabase?.auth.signOut();setAccountOpen(false);setAdmin(false)};
 const canAdmin=["staff","admin","super_admin"].includes(profile?.role);
 useEffect(()=>{const fn=()=>{const max=Math.max(innerHeight,document.documentElement.scrollHeight-innerHeight);const p=scrollY/max;progress.current=p;document.documentElement.style.setProperty("--sy",scrollY+"px");document.documentElement.style.setProperty("--sp",p)};fn();addEventListener("scroll",fn,{passive:true});return()=>removeEventListener("scroll",fn)},[]);
 if(admin) return <Admin back={()=>setAdmin(false)}/>;
 return <div className="site">
  <header><button className="icon mobile" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><a className="logo" href="#top">KARIA</a>
   <nav className={menu?"open":""}><a href="#shop">SHOP</a><a href="#story">THE CRAFT</a><a href="#brands">BRANDS</a><a href="#contact">CONTACT</a></nav>
   <div className="actions"><Search/><button className="accountIcon" aria-label="Account" onClick={()=>setAccountOpen(true)}><User/></button><button className="bag"><ShoppingBag/><b>{cart.length}</b></button></div>
  </header>
  {accountOpen&&<div className="accountBackdrop" onMouseDown={()=>setAccountOpen(false)}><section className="accountPanel" onMouseDown={e=>e.stopPropagation()}><button className="accountClose" onClick={()=>setAccountOpen(false)}><X/></button><div className="accountBrand">KARIA</div>{user?<><small className="accountEyebrow">MY ACCOUNT</small><h2>{profile?.full_name||user.email?.split("@")[0]}</h2><p className="accountEmail">{user.email}</p><div className="accountRole">{profile?.role?.replace("_"," ")||"customer"}</div>{canAdmin&&<button className="accountPrimary" onClick={()=>{setAccountOpen(false);setAdmin(true)}}>OPEN ADMINISTRATION <ArrowRight/></button>}<button className="accountSecondary" onClick={signOut}>SIGN OUT</button></>:<><small className="accountEyebrow">WELCOME TO KARIA</small><h2>{authMode==="signin"?"Sign in":"Create account"}</h2><p className="accountIntro">Access your orders, saved details and KARIA account.</p><form onSubmit={submitAuth}>{authMode==="signup"&&<input name="name" placeholder="Full name" required/>}<input name="email" type="email" placeholder="Email address" required/><input name="password" type="password" placeholder="Password" minLength="6" required/>{authError&&<p className="authError">{authError}</p>}<button className="accountPrimary" type="submit">{authMode==="signin"?"SIGN IN":"CREATE ACCOUNT"}<ArrowRight/></button></form><button className="accountSwitch" onClick={()=>{setAuthError("");setAuthMode(authMode==="signin"?"signup":"signin")}}>{authMode==="signin"?"New to KARIA? Create an account":"Already have an account? Sign in"}</button></>}</section></div>}
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
  <footer id="contact"><div><div className="logo">KARIA</div><p>Handcrafted bags & accessories.<br/>Curated with intention.</p></div><div className="footLinks"><a href="#shop">Shop</a><a href="#story">Our story</a><a href="#brands">Brands</a><a href="#">Shipping & returns</a></div><div className="newsletter"><small>JOIN THE KARIA LETTER</small><div><input placeholder="Your email address"/><button>→</button></div></div>{canAdmin&&<button className="adminLink" onClick={()=>setAdmin(true)}>Admin</button>}<div className="copyright">© 2026 KARIA · HANDCRAFTED STORIES</div></footer>
 </div>
}

function Admin({back}){
 const items=[["Dashboard",BarChart3],["Orders",ShoppingBag],["Products",Package],["Brands",ShieldCheck],["Inventory",Boxes],["Production",Settings],["Customers",Users],["Accounting",Wallet],["Reports",BarChart3],["Admin users",Users]];
 const [section,setSection]=useState("Dashboard"),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState("");
 const [brands,setBrands]=useState([]),[productsDb,setProductsDb]=useState([]);
 const refresh=async()=>{if(!supabase)return;setLoading(true);setNotice("");try{
  const map={"Orders":"orders","Products":"products","Brands":"brands","Inventory":"inventory_movements","Production":"production_orders","Customers":"profiles","Accounting":"expenses","Admin users":"profiles"};
  if(section==="Dashboard"||section==="Reports"){const [o,p,i,e]=await Promise.all([supabase.from("orders").select("id,total,status",{count:"exact"}),supabase.from("products").select("id",{count:"exact"}),supabase.from("product_stock").select("stock"),supabase.from("expenses").select("amount")]);setRows({orders:o.data||[],products:p.data||[],stock:(i.data||[]).reduce((a,x)=>a+(x.stock||0),0),expenses:(e.data||[]).reduce((a,x)=>a+Number(x.amount||0),0)});}
  else {let q=supabase.from(map[section]).select("*"); if(section==="Admin users")q=q.in("role",["staff","admin","super_admin"]); const {data,error}=await q.order("created_at",{ascending:false});if(error)throw error;setRows(data||[])}
  const [b,pd]=await Promise.all([supabase.from("brands").select("*").order("name"),supabase.from("products").select("id,name,sku,price,unit_cost,active").order("name")]);setBrands(b.data||[]);setProductsDb(pd.data||[]);
 }catch(e){setNotice(e.message||String(e))}finally{setLoading(false)}};
 useEffect(()=>{refresh()},[section]);
 const addBrand=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get("name")||"").trim(),story=String(f.get("story")||"");const slug=name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");const {error}=await supabase.from("brands").insert({name,slug,story,active:true});if(error)setNotice(error.message);else{e.currentTarget.reset();setNotice("Brand created.");refresh()}};
 const addProduct=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get("name")),sku=String(f.get("sku")),stock=Number(f.get("stock")||0);const slug=(name+"-"+sku).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");const {data,error}=await supabase.from("products").insert({name,sku,slug,brand_id:f.get("brand_id")||null,description:String(f.get("description")||""),materials:String(f.get("materials")||""),dimensions:String(f.get("dimensions")||""),price:Number(f.get("price")||0),unit_cost:Number(f.get("unit_cost")||0),active:true}).select().single();if(error){setNotice(error.message);return}if(stock>0)await supabase.from("inventory_movements").insert({product_id:data.id,qty:stock,movement_type:"IN",note:"Initial stock"});e.currentTarget.reset();setNotice("Product created and inventory updated.");refresh()};
 const addInventory=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.from("inventory_movements").insert({product_id:f.get("product_id"),qty:Number(f.get("qty")),movement_type:f.get("movement_type"),note:String(f.get("note")||"")});if(error)setNotice(error.message);else{e.currentTarget.reset();setNotice("Inventory movement saved.");refresh()}};
 const addProduction=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.from("production_orders").insert({product_id:f.get("product_id"),qty:Number(f.get("qty")),status:"pending"});if(error)setNotice(error.message);else{e.currentTarget.reset();setNotice("Production order created.");refresh()}};
 const addExpense=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("expenses").insert({vendor:f.get("vendor"),category:f.get("category"),description:f.get("description"),amount:Number(f.get("amount")),created_by:user?.id});if(error)setNotice(error.message);else{e.currentTarget.reset();setNotice("Expense recorded.");refresh()}};
 const createAdmin=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const {data,error}=await supabase.functions.invoke("admin-create-user",{body:{full_name:f.get("full_name"),email:f.get("email"),role:f.get("role")}});if(error||!data?.ok){setNotice(data?.error||error?.message||"Could not create user");return}setNotice(`Account created — ${data.email} — Temporary password: ${data.temporaryPassword}`);e.currentTarget.reset();refresh()};
 const changeRole=async(id,role,disabled=false)=>{const {data,error}=await supabase.functions.invoke("admin-update-user",{body:{user_id:id,role,disabled}});setNotice(data?.ok?"Access updated.":data?.error||error?.message||"Could not update access");refresh()};
 const cards=[...["Revenue","Orders","Inventory","Net result"]].map((x,i)=>[x,i===0?`$${Number((rows.orders||[]).filter(x=>x.status!=="cancelled").reduce((a,x)=>a+Number(x.total||0),0)).toFixed(2)}`:i===1?String((rows.orders||[]).length):i===2?String(rows.stock||0):`$${(Number((rows.orders||[]).reduce((a,x)=>a+Number(x.total||0),0))-Number(rows.expenses||0)).toFixed(2)}`,[Wallet,ShoppingBag,Boxes,BarChart3][i]]);
 const title=section;
 return <div className="admin"><aside><div className="logo">KARIA</div><small>ADMINISTRATION</small>{items.map(([x,I])=><button key={x} className={section===x?"selected":""} onClick={()=>setSection(x)}><I/>{x}</button>)}<button className="storeBack" onClick={back}>← Storefront</button></aside><section className="adminMain"><div className="adminTop"><div><small>KARIA CONTROL CENTER</small><h1>{title}</h1></div><div className="owners"><b>Ownership</b><span>Partner A 50%</span><span>Partner B 50%</span></div></div>{notice&&<div className="adminNotice">{notice}</div>}{loading?<div className="adminLoading">Loading KARIA data…</div>:<AdminSection section={section} rows={rows} cards={cards} brands={brands} products={productsDb} addBrand={addBrand} addProduct={addProduct} addInventory={addInventory} addProduction={addProduction} addExpense={addExpense} createAdmin={createAdmin} changeRole={changeRole} refresh={refresh}/>}</section></div>
}

function AdminSection({section,rows,cards,brands,products,addBrand,addProduct,addInventory,addProduction,addExpense,createAdmin,changeRole,refresh}){
 if(section==="Dashboard")return <><div className="cards">{cards.map(([a,b,I])=><div key={a}><I/><small>{a}</small><strong>{b}</strong><em>Live from Supabase</em></div>)}</div><div className="adminGrid"><div className="panel"><h2>Inventory movements</h2><p>Confirmed sales create stock OUT movements automatically. Production receipts, returns and adjustments remain auditable.</p></div><div className="panel"><h2>Accounting engine</h2><p>Orders → payment → sales → tax liability → fees → COGS → inventory → reports.</p><div className="flow">SALE → INVENTORY → LEDGER → REPORTS</div></div></div></>;
 if(section==="Brands")return <><AdminForm title="Create brand" onSubmit={addBrand}><input name="name" placeholder="Brand name" required/><textarea name="story" placeholder="Brand story"/><button>Create brand</button></AdminForm><DataTable cols={["name","slug","story","active"]} rows={rows}/></>;
 if(section==="Products")return <><AdminForm title="Add product" onSubmit={addProduct}><input name="name" placeholder="Product name" required/><input name="sku" placeholder="SKU" required/><select name="brand_id"><option value="">No brand</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><input name="price" type="number" step=".01" placeholder="Sale price" required/><input name="unit_cost" type="number" step=".01" placeholder="Unit cost"/><input name="stock" type="number" placeholder="Initial stock"/><input name="materials" placeholder="Materials"/><input name="dimensions" placeholder="Dimensions"/><textarea name="description" placeholder="Description"/><button>Save product</button></AdminForm><DataTable cols={["name","sku","price","unit_cost","active"]} rows={rows}/></>;
 if(section==="Inventory")return <><AdminForm title="Register inventory movement" onSubmit={addInventory}><select name="product_id" required><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><select name="movement_type"><option>IN</option><option>OUT</option><option>RETURN</option><option>ADJUST</option><option>PRODUCTION_IN</option></select><input name="qty" type="number" min="1" placeholder="Quantity" required/><input name="note" placeholder="Note"/><button>Save movement</button></AdminForm><DataTable cols={["movement_type","qty","note","created_at"]} rows={rows}/></>;
 if(section==="Production")return <><AdminForm title="New production order" onSubmit={addProduction}><select name="product_id" required><option value="">Product to make</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input name="qty" type="number" min="1" placeholder="Quantity" required/><button>Create production order</button></AdminForm><DataTable cols={["qty","status","started_at","completed_at","created_at"]} rows={rows}/></>;
 if(section==="Accounting")return <><AdminForm title="Record expense" onSubmit={addExpense}><input name="vendor" placeholder="Vendor"/><input name="category" placeholder="Category"/><input name="description" placeholder="Description"/><input name="amount" type="number" step=".01" placeholder="Amount" required/><button>Record expense</button></AdminForm><DataTable cols={["expense_date","vendor","category","description","amount"]} rows={rows}/></>;
 if(section==="Admin users")return <><AdminForm title="Create administrator" onSubmit={createAdmin}><input name="full_name" placeholder="Full name" required/><input name="email" type="email" placeholder="Email" required/><select name="role"><option value="admin">Admin</option><option value="staff">Staff</option></select><button>Create account + temporary password</button></AdminForm><div className="adminTable"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.full_name||r.id.slice(0,8)}</td><td>{r.role}</td><td>{r.disabled?"Disabled":"Active"}</td><td className="roleActions"><button onClick={()=>changeRole(r.id,"staff",false)}>Staff</button><button onClick={()=>changeRole(r.id,"admin",false)}>Admin</button><button onClick={()=>changeRole(r.id,r.role,true)}>Disable</button></td></tr>)}</tbody></table></div></>;
 if(section==="Reports"){const revenue=(rows.orders||[]).reduce((a,x)=>a+Number(x.total||0),0),expenses=Number(rows.expenses||0);return <div className="reportGrid"><div><small>SALES</small><strong>${revenue.toFixed(2)}</strong></div><div><small>EXPENSES</small><strong>${expenses.toFixed(2)}</strong></div><div><small>NET RESULT</small><strong>${(revenue-expenses).toFixed(2)}</strong></div><div><small>UNITS IN STOCK</small><strong>{rows.stock||0}</strong></div></div>}
 if(section==="Orders")return <DataTable cols={["order_number","email","status","subtotal","tax","shipping","total","created_at"]} rows={rows}/>;
 if(section==="Customers")return <DataTable cols={["full_name","phone","role","created_at"]} rows={rows}/>;
 return <DataTable cols={[]} rows={rows}/>;
}
function AdminForm({title,onSubmit,children}){return <div className="adminForm panel"><h2>{title}</h2><form onSubmit={onSubmit}>{children}</form></div>}
function DataTable({cols,rows=[]}){return <div className="adminTable"><table><thead><tr>{cols.map(c=><th key={c}>{c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{typeof r[c]==="boolean"?(r[c]?"Yes":"No"):r[c]===null||r[c]===undefined?"—":String(r[c]).slice(0,90)}</td>)}</tr>):<tr><td colSpan={Math.max(cols.length,1)}>No records yet.</td></tr>}</tbody></table></div>}
createRoot(document.getElementById("root")).render(<App/>);
