import React,{useState,useEffect} from "react";
import {createRoot} from "react-dom/client";
import {ShoppingBag,User,Search,ArrowRight,Menu,X,Package,Wallet,Users,Boxes,BarChart3,Settings,ShieldCheck} from "lucide-react";
import "./style.css";

const products=[
 {id:1,name:"Terra Woven Bag",brand:"Independent Artisan",price:118,img:"/products/bag-brown.jpg",stock:4},
 {id:2,name:"Midnight Woven Bag",brand:"Independent Artisan",price:126,img:"/products/bag-blue.jpg",stock:3},
 {id:3,name:"Signature Handwoven",brand:"Independent Artisan",price:132,img:"/products/bag-detail.jpg",stock:2},
];
function App(){
 const [cart,setCart]=useState([]),[admin,setAdmin]=useState(false),[menu,setMenu]=useState(false);
 const add=p=>setCart(c=>[...c,p]);
 useEffect(()=>{const fn=()=>document.documentElement.style.setProperty("--scroll",window.scrollY+"px");addEventListener("scroll",fn);return()=>removeEventListener("scroll",fn)},[]);
 if(admin) return <Admin back={()=>setAdmin(false)}/>;
 return <div>
  <header><button className="icon mobile" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><div className="logo">KARIA</div>
   <nav className={menu?"open":""}><a href="#shop">SHOP</a><a href="#story">OUR STORY</a><a href="#brands">BRANDS</a><a href="#contact">CONTACT</a></nav>
   <div className="actions"><Search/><User/><button className="bag"><ShoppingBag/><b>{cart.length}</b></button></div>
  </header>
  <main>
   <section className="hero">
    <div className="heroCopy"><div className="eyebrow">HANDCRAFTED • ONE PIECE AT A TIME</div><h1>Made by hand.<br/><i>Made to be yours.</i></h1><p>Distinctive bags shaped slowly by skilled hands, thoughtful materials and individual stories.</p><a href="#shop" className="cta">Explore the collection <ArrowRight/></a></div>
    <div className="stage"><div className="halo"></div><img src="/products/bag-brown.jpg" className="heroBag"/><span className="float f1">HANDWOVEN</span><span className="float f2">LIMITED PIECES</span></div>
    <div className="scrollHint">SCROLL TO DISCOVER ↓</div>
   </section>
   <section className="cinema" id="story"><div className="cinemaImg"><img src="/products/bag-blue.jpg"/></div><div><span>01 — THE CRAFT</span><h2>Texture tells<br/>the story.</h2><p>Every KARIA selection celebrates the identity of its maker. KARIA is the destination; each artisan brand keeps its own name, logo and story.</p></div></section>
   <section id="shop" className="shop"><div className="sectionHead"><div><span>THE COLLECTION</span><h2>Objects with a soul.</h2></div><button>View all pieces →</button></div>
    <div className="grid">{products.map(p=><article key={p.id}><div className="productImg"><img src={p.img}/><button onClick={()=>add(p)}>+ ADD TO BAG</button></div><small>{p.brand}</small><h3>{p.name}</h3><div className="price">${p.price}.00 <span>{p.stock} available</span></div></article>)}</div>
   </section>
   <section className="manifesto"><span>KARIA</span><h2>Handmade is not a trend.<br/>It is a way of making things matter.</h2><video src="/products/bag-video.mp4" muted autoPlay loop playsInline/></section>
  </main>
  <footer><div className="logo">KARIA</div><p>Handcrafted bags & accessories.</p><button className="adminLink" onClick={()=>setAdmin(true)}>Admin preview</button><small>© 2026 KARIA</small></footer>
 </div>
}
function Admin({back}){
 const cards=[["Revenue","$0.00",Wallet],["Orders","0",ShoppingBag],["Inventory","9",Boxes],["Net profit","$0.00",BarChart3]];
 return <div className="admin"><aside><div className="logo">KARIA</div><small>ADMINISTRATION</small>
 {[["Dashboard",BarChart3],["Orders",ShoppingBag],["Products",Package],["Brands",ShieldCheck],["Inventory",Boxes],["Production",Settings],["Customers",Users],["Accounting",Wallet],["Reports",BarChart3],["Admin users",Users]].map(([x,I])=><button><I/>{x}</button>)}<button onClick={back}>← Storefront</button></aside>
 <section className="adminMain"><div className="adminTop"><div><small>BUSINESS OVERVIEW</small><h1>Good morning, KARIA.</h1></div><div className="owners"><b>Ownership</b><span>Partner A 50%</span><span>Partner B 50%</span></div></div>
 <div className="cards">{cards.map(([a,b,I])=><div><I/><small>{a}</small><strong>{b}</strong><em>Live when backend is connected</em></div>)}</div>
 <div className="adminGrid"><div className="panel"><h2>Inventory movements</h2><p>Every confirmed sale will automatically create a stock OUT movement. Production receipts, returns and manual adjustments remain auditable.</p><table><tbody><tr><td>Finished goods</td><td>9 units</td></tr><tr><td>Reserved</td><td>0 units</td></tr><tr><td>Low stock</td><td>3 SKUs</td></tr></tbody></table></div>
 <div className="panel"><h2>Accounting engine</h2><p>Orders → payment → sales → tax liability → processor fee → COGS → inventory → payout reconciliation.</p><div className="flow">SALE → INVENTORY → LEDGER → REPORTS</div></div></div>
 </section></div>
}
createRoot(document.getElementById("root")).render(<App/>);
