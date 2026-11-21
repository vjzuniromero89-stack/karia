// KARIA admin panel (moved out of main.jsx in V7.49 so the store loads it only when an admin opens it).
import React,{useEffect,useMemo,useRef,useState} from "react";
import {ShoppingBag,Package,Wallet,Users,Boxes,BarChart3,Settings,Tag,LayoutGrid,UserCog,Mail,Star,Send} from "lucide-react";
import {supabase} from "./supabase";
import {Stars,mainPhoto} from "./storefront";
import {CustomizeAdmin,CustomizationSheet,CUSTOM_SKU} from "./customize";
import "./admin.css";

// With a label the input gets a visible caption (placeholders vanish while typing).
const Field=({name,placeholder,type='text',required=false,step,min,max,label,defaultValue})=>{const input=<input name={name} placeholder={placeholder} type={type} required={required} step={step??(type==='number'?'any':undefined)} min={min} max={max} defaultValue={defaultValue}/>;return label?<label className="caField">{label}{input}</label>:input};
const ORDER_STATUSES=['pending','paid','processing','shipped','delivered','cancelled','refunded'];
const PAID_STATUSES=['paid','processing','shipped','delivered'];
// Status changes that make sense from each status (cancelled/refunded are final: stock already went back).
const NEXT_STATUSES={pending:['pending','cancelled'],paid:['paid','processing','shipped','delivered','cancelled','refunded'],processing:['processing','shipped','delivered','cancelled','refunded'],shipped:['shipped','delivered','refunded'],delivered:['delivered','refunded'],cancelled:['cancelled'],refunded:['refunded']};
const money=n=>{const v=Number(n||0);return `${v<0?'−':''}$${Math.abs(v).toFixed(2)}`};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const shortDay=v=>v?new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
// Menu in the order of the owners' day. Badges are added for Orders, Messages and Products.
const NAV=[['Today',[['Dashboard',BarChart3]]],['Sales',[['Orders',ShoppingBag],['Customers',Users],['Messages',Mail],['Reviews',Star]]],['Catalog',[['Products',Package],['Inventory',Boxes],['Categories & brands',LayoutGrid]]],['Marketing',[['Coupons',Tag],['Newsletter',Send]]],['Money',[['Accounting',Wallet]]],['Store',[['Settings',Settings],['Team',UserCog]]]];
const STATUS_TONE={paid:'green',processing:'green',shipped:'blue',delivered:'violet',pending:'amber',cancelled:'red',refunded:'red'};
const StatusPill=({s})=>{const k=String(s||'pending').toLowerCase();return <span className={`kPill ${STATUS_TONE[k]||'grey'}`}>{k[0].toUpperCase()+k.slice(1)}</span>};
const StockPill=({n})=><span className={`kStock ${n<=0?'s0':n<=2?'slow':'sok'}`}>{n<=0?'Sold out':`${n} left`}</span>;
const Head=({eyebrow,title,children})=><div className="kTop"><div><small>{eyebrow}</small><h1>{title}</h1></div>{children&&<div className="kRow">{children}</div>}</div>;
const Kpi=({label,value,sub,tone})=><div className="kCard kKpi"><small>{label}</small><b className={tone||undefined}>{value}</b>{sub&&<span>{sub}</span>}</div>;
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const autoSku=name=>`KARIA-${String(name||'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,14)||'ITEM'}-${1000+Math.floor(Math.random()*9000)}`;
const dbError=e=>e?.code==='23505'&&!/slug/i.test(e?.message||'')?'That SKU is already used by another product.':(e?.message||String(e));
const isOpeningNote=n=>String(n||'').toLowerCase().includes('opening stock');
const localDay=v=>v?new Date(v).toLocaleDateString('en-CA'):'';
// Profit = products after discount + shipping charged − product cost (COGS) − Stripe fee. Sales tax is passed through: not income, not cost.
const orderProfit=o=>Number(o.subtotal||0)-Number(o.discount_total??o.discount??0)+Number(o.shipping_total??o.shipping??0)-Number(o.processor_fee||0)-(o.order_items||[]).reduce((s,it)=>s+Number(it.qty||0)*Number(it.unit_cost||0),0);
const MEDIA_BUCKET='product-media';
const mediaPath=url=>{const k=`/${MEDIA_BUCKET}/`,i=String(url||'').indexOf('/storage/v1/object/public'+k);return i<0?null:decodeURIComponent(String(url).slice(i+('/storage/v1/object/public'+k).length).split('?')[0])};
// Photos over 1600px on the long side are redrawn and sent as JPEG 0.85; videos, GIFs and small photos go as they are.
async function shrinkImage(file){
 if(!file.type.startsWith('image/')||/gif|svg/.test(file.type))return file;
 try{const img=await createImageBitmap(file);const big=Math.max(img.width,img.height);if(big<=1600){img.close?.();return file}
  const k=1600/big,c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);img.close?.();
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.85));return blob?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):file}
 catch{return file}
}
// Uploads files to the bucket and adds product_media rows from sort_order `start`. `done` collects what was saved so a caller can undo it.
async function uploadMedia(productId,files,start,onStep,done={paths:[],ids:[]}){
 for(let i=0;i<files.length;i++){onStep?.(`Uploading ${i+1} of ${files.length}…`);
  const file=await shrinkImage(files[i]);const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${productId}/${Date.now()}-${i}.${ext}`;
  const {error:ue}=await supabase.storage.from(MEDIA_BUCKET).upload(path,file,{upsert:false,contentType:file.type});if(ue)throw new Error(`"${files[i].name}" could not be uploaded: ${ue.message}`);done.paths.push(path);
  const {data:pub}=supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const {data:row,error:me}=await supabase.from('product_media').insert({product_id:productId,url:pub.publicUrl,media_type:file.type.startsWith('video/')?'video':'image',sort_order:start+i}).select('id').single();if(me)throw new Error(`"${files[i].name}" could not be saved: ${me.message}`);done.ids.push(row.id);
 }
 return done;
}
function FilePreview({files}){
 const urls=useMemo(()=>files.map(f=>({name:f.name,video:f.type.startsWith('video/'),url:URL.createObjectURL(f)})),[files]);
 useEffect(()=>()=>urls.forEach(u=>URL.revokeObjectURL(u.url)),[urls]);
 if(!urls.length)return null;
 return <div className="filePreview">{urls.map((u,i)=><figure key={u.url}>{u.video?<video src={u.url} muted/>:<img src={u.url} alt={u.name}/>}<figcaption>{i===0?'MAIN · ':''}{u.name}</figcaption></figure>)}</div>;
}

function Admin({back}){
 const [tab,setTab]=useState('Dashboard'),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState('');
 const [brands,setBrands]=useState([]),[categories,setCategories]=useState([]),[productsList,setProductsList]=useState([]),[uploading,setUploading]=useState(false),[editingProduct,setEditingProduct]=useState(null),[editingMovement,setEditingMovement]=useState(null),[viewingOrder,setViewingOrder]=useState(null);
 const [brandRows,setBrandRows]=useState([]),[activeProducts,setActiveProducts]=useState([]),[recentMessages,setRecentMessages]=useState([]),[newOpen,setNewOpen]=useState(false),[formOpen,setFormOpen]=useState(false);
 const [inventorySummary,setInventorySummary]=useState([]),[inventoryTotals,setInventoryTotals]=useState({opening:0,received:0,sold:0,out:0,returns:0,adjustments:0,current:0,value:0});
 const [currentAdmin,setCurrentAdmin]=useState(null),[currentUserId,setCurrentUserId]=useState(null);
 const [accountingSales,setAccountingSales]=useState([]),[accountingExpenses,setAccountingExpenses]=useState([]),[period,setPeriod]=useState('30');
 const [settingsValues,setSettingsValues]=useState({}),[customerOrders,setCustomerOrders]=useState([]),[subscribers,setSubscribers]=useState([]);
 const [stockById,setStockById]=useState({}),[couponUses,setCouponUses]=useState({}),[productDraft,setProductDraft]=useState(null),[pickedFiles,setPickedFiles]=useState([]),[uploadStep,setUploadStep]=useState(''),[openingQty,setOpeningQty]=useState(''),[ask,setAsk]=useState(null);
 const photosDirty=useRef(false),productFormRef=useRef(null);
 // Inline confirmation bar instead of window.confirm: ask({text,yes,run}).
 const confirmBar=ask&&<div className="adminConfirm" role="alertdialog"><p>{ask.text}</p><div><button type="button" onClick={()=>setAsk(null)}>CANCEL</button><button type="button" className="dangerBtn" onClick={()=>{const run=ask.run;setAsk(null);run()}}>{ask.yes||'YES'}</button></div></div>;
 const loadInventoryAccounting=async()=>{
  if(!supabase)return;
  const [{data:prods,error:pe},{data:moves,error:me}]=await Promise.all([
    supabase.from('products').select('id,name,sku,unit_cost,price,active').order('name'),
    supabase.from('inventory_movements').select('*').order('created_at',{ascending:true})
  ]);
  if(pe)throw pe;if(me)throw me;
  const summary=(prods||[]).map(product=>{
    let opening=0,received=0,sold=0,out=0,returns=0,adjustments=0,current=0;
    // Same signs as the product_stock view; a sale is an OUT written by an order (reference_type 'order'), never guessed from the note.
    (moves||[]).filter(m=>m.product_id===product.id).forEach(m=>{
      const q=Number(m.qty??m.quantity??0);
      const type=String(m.movement_type||'').toUpperCase();
      if(type==='ADJUST'&&isOpeningNote(m.note)){opening+=q;current+=q}
      else if(type==='IN'||type==='PRODUCTION_IN'){received+=q;current+=q}
      else if(type==='RETURN'){returns+=q;current+=q}
      else if(type==='OUT'&&m.reference_type==='order'){sold+=Math.abs(q);current-=Math.abs(q)}
      else if(type==='OUT'){out+=Math.abs(q);current-=Math.abs(q)}
      else if(type==='ADJUST'){adjustments+=q;current+=q}
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
    // Shipping is charged to the customer (income); tax is passed through (neither income nor cost). Same formula as orderProfit.
    const deductions=totalCost+processorFee;
    const profit=netSale+shipping-totalCost-processorFee;
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
 // load() keeps the current notice so "Saved…" messages survive the reload; switching tabs clears it.
 const load=async()=>{if(!supabase)return;setLoading(true);try{
  const table={Orders:'orders',Products:'products','Categories & brands':'categories',Inventory:'inventory_movements',Customers:'profiles',Accounting:'expenses',Team:'profiles',Coupons:'coupons',Messages:'contact_messages',Reviews:'product_reviews'}[tab];
  if(table){let q=tab==='Orders'?supabase.from('orders').select('id,order_number,email,status,subtotal,discount,discount_total,shipping,shipping_total,coupon_code,tax,total,processor_fee,shipping_address,tracking_number,carrier,created_at,stripe_session_id,stripe_payment_intent,order_items(id,product_id,qty,unit_price,unit_cost,customization,products(id,name,sku,description,weight,product_media(url,media_type,sort_order)))').order('created_at',{ascending:false}).limit(1000):tab==='Inventory'?supabase.from('inventory_movements').select('*, products(name,sku)').order('created_at',{ascending:false}).limit(100):tab==='Categories & brands'?supabase.from('categories').select('*').order('name',{ascending:true}).limit(100):tab==='Products'?supabase.from('products').select('id,name,sku,description,price,compare_at_price,unit_cost,category,brand_id,materials,dimensions,weight,low_stock_threshold,featured,active,created_at,product_media(url,media_type,sort_order)').order('created_at',{ascending:false}).limit(100):supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100);if(tab==='Team')q=q.in('role',['staff','admin','super_admin']);const {data,error}=await q;if(error)throw error;setRows(data||[])}
  // Orders, stock and this week's messages feed the dashboard and the menu badges on every tab.
  const [{data:o},{data:ps},{data:st,error:se},{data:cm}]=await Promise.all([supabase.from('orders').select('id,order_number,email,customer_id,total,status,created_at,coupon_code,subtotal,discount,discount_total,shipping,shipping_total,processor_fee,tracking_number,shipping_address,order_items(product_id,qty,unit_cost)').order('created_at',{ascending:false}),supabase.from('products').select('id,name,sku,low_stock_threshold,product_media(url,media_type,sort_order)').eq('active',true),supabase.from('product_stock').select('*'),supabase.from('contact_messages').select('id,name,message,created_at').gte('created_at',new Date(Date.now()-7*864e5).toISOString()).order('created_at',{ascending:false})]);
  if(se)throw se;
  const stock=Object.fromEntries((st||[]).map(r=>[r.product_id,Number(r.stock??r.quantity??r.qty??0)]));
  setCustomerOrders(o||[]);setStockById(stock);setRecentMessages(cm||[]);setActiveProducts((ps||[]).filter(p=>p.sku!==CUSTOM_SKU).map(p=>({...p,stock:stock[p.id]||0})));
  if(tab==='Categories & brands'){const {data,error}=await supabase.from('brands').select('*').order('name');if(error)throw error;setBrandRows(data||[])}
  if(tab==='Coupons'){const uses={};(o||[]).forEach(x=>{if(x.coupon_code&&PAID_STATUSES.includes(String(x.status).toLowerCase()))uses[String(x.coupon_code).toUpperCase()]=(uses[String(x.coupon_code).toUpperCase()]||0)+1});setCouponUses(uses)}
  if(tab==='Settings'){const {data,error}=await supabase.from('settings').select('key,value');if(error)throw error;setSettingsValues(Object.fromEntries((data||[]).map(r=>[r.key,r.value||{}])))}
  if(tab==='Customers'||tab==='Newsletter'){const {data,error}=await supabase.from('newsletter_subscribers').select('email,created_at').order('created_at',{ascending:false}).limit(5000);if(error&&tab==='Newsletter')throw error;setSubscribers(data||[])}
  if(tab==='Inventory')await loadInventoryAccounting();
  if(tab==='Accounting')await loadAccounting();
 }catch(e){setNotice(e.message)}finally{setLoading(false)}};
 useEffect(()=>{setNotice('');setAsk(null);setFormOpen(false);load();document.querySelector('.kNav[aria-current="page"]')?.scrollIntoView({block:'nearest',inline:'nearest'})},[tab]);
 useEffect(()=>{if(!supabase)return;(async()=>{const {data:{user}}=await supabase.auth.getUser();setCurrentUserId(user?.id||null);if(user?.id){const {data}=await supabase.from('profiles').select('id,role,full_name').eq('id',user.id).single();setCurrentAdmin(data||null)}})()},[]);
 useEffect(()=>{if(!supabase)return;(async()=>{const [{data:b},{data:c},{data:p}]=await Promise.all([supabase.from('brands').select('id,name,active').order('name'),supabase.from('categories').select('id,name,slug,active').order('name'),supabase.from('products').select('id,name,sku,category,brand_id').eq('active',true).order('name')]);setBrands(b||[]);setCategories(c||[]);setProductsList(p||[])})()},[tab,notice]);
 // brands/categories hold inactive ones too, so an edit can still show a product's current value; new choices use only active ones.
 const activeBrands=brands.filter(b=>b.active!==false),activeCategories=categories.filter(c=>c.active!==false);
 const create=async(e,kind)=>{e.preventDefault();const form=e.currentTarget;const imageFiles=kind==='product'?Array.from(form.elements?.images?.files||[]):[];const f=Object.fromEntries(new FormData(form));setNotice('');let msg='Saved successfully.';try{
  if(kind==='brand'){const {error}=await supabase.from('brands').insert({name:f.name,slug:String(f.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),story:f.description||null});if(error)throw error}
  if(kind==='category'){const name=String(f.name||'').trim();const slug=String(f.slug||name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');const {error}=await supabase.from('categories').insert({name,slug,active:true});if(error)throw error}
  if(kind==='product'){
   const opening=Number(f.opening_stock);if(f.opening_stock===''||!Number.isInteger(opening)||opening<0)throw new Error('Initial stock must be a whole number, 0 or more.');
   setUploading(true);const name=String(f.name).trim();
   const payload={name,sku:String(f.sku||'').trim()||autoSku(name),description:f.description||null,materials:f.materials||null,dimensions:f.dimensions||null,price:Number(f.price||0),compare_at_price:f.compare_at_price?Number(f.compare_at_price):null,unit_cost:Number(f.cost||0),brand_id:f.brand_id||null,weight:f.weight?Number(f.weight):null,low_stock_threshold:Number(f.low_stock_threshold||2),featured:f.featured==='on',category:(categories.find(c=>c.id===f.category_id)?.name||null),active:f.publish_shop==='on',slug:slugify(name)+'-'+Date.now().toString().slice(-5)};
   const {data,error}=await supabase.from('products').insert(payload).select().single();if(error)throw new Error(dbError(error));
   const done={paths:[],ids:[]};
   try{
    await uploadMedia(data.id,imageFiles,0,setUploadStep,done);
    if(opening>0){const {error:se}=await supabase.from('inventory_movements').insert({product_id:data.id,qty:opening,movement_type:'ADJUST',note:'OPENING STOCK'});if(se)throw new Error(`The initial stock could not be saved: ${se.message}`)}
   }catch(err){
    // Never leave a half-created product: remove the row (with its media and stock rows) and the uploaded files.
    setUploadStep('Undoing…');
    const {data:del,error:de}=await supabase.rpc('admin_delete_product',{p_product_id:data.id});const r=Array.isArray(del)?del[0]:del;
    if(done.paths.length)await supabase.storage.from(MEDIA_BUCKET).remove(done.paths);
    throw new Error(de||r?.action!=='deleted'?`${err.message}\nThe product "${name}" was created but could not be removed automatically. Find it in the list below and delete it, then try again.`:`${err.message}\nNothing was saved — the product was NOT created. Please try again.`);
   }
   setUploading(false);setUploadStep('');setPickedFiles([]);setOpeningQty('');setProductDraft(null);setNewOpen(false);
   msg=`Product "${name}" created (SKU ${payload.sku}) with ${opening} in stock.${opening===0?' It will show as SOLD OUT until you add stock.':''}${payload.active?'':' It is NOT published in the shop yet.'}`;
  }
  if(kind==='inventory'){const isOpening=f.movement_type==='OPENING_UI';const movementType=isOpening?'ADJUST':f.movement_type;const note=isOpening?`OPENING STOCK${f.note?' · '+f.note:''}`:(f.note||null);const {error}=await supabase.from('inventory_movements').insert({product_id:f.product_id,qty:Number(f.quantity),movement_type:movementType,note});if(error)throw error}
  if(kind==='production'){const {error}=await supabase.from('production_orders').insert({product_id:f.product_id,qty:Number(f.quantity),status:'pending'});if(error)throw error}
  if(kind==='expense'){const {error}=await supabase.from('expenses').insert({description:f.description,amount:Number(f.amount),category:f.category||'Operating',expense_date:f.expense_date||new Date().toISOString().slice(0,10)});if(error)throw error}
  if(kind==='material'){const {error}=await supabase.from('materials').insert({name:f.name,sku:f.sku||null,unit:f.unit||'unit',unit_cost:Number(f.unit_cost||0),stock:Number(f.stock||0)});if(error)throw error}
  if(kind==='coupon'){const {error}=await supabase.from('coupons').insert({...couponPayload(f),active:true});if(error)throw error}
  // The 'store' key (name, currency) is no longer edited here and is left untouched; other keys keep any extra fields they hold.
  if(kind==='settings'){const v=settingsValues;for(const [key,value] of Object.entries({shipping:{...v.shipping,default_rate:Number(f.shipping_rate||0),free_shipping_over:Number(f.free_shipping_over||0)},legal:{...v.legal,returns_days:Number(f.returns_days||14)},storefront:{...v.storefront,returns_days:Number(f.returns_days||14),theme:f.theme==='classic'?'classic':'noir',contact_email:String(f.contact_email||'').trim(),whatsapp:String(f.whatsapp||'').trim(),instagram:String(f.instagram||'').trim(),about:String(f.about||'').trim()}})){const {error}=await supabase.from('settings').upsert({key,value,updated_at:new Date().toISOString()});if(error)throw error}}
  form.reset();setNotice(msg);await load();
 }catch(err){setUploading(false);setUploadStep('');setNotice(err?.code==='23505'&&kind==='coupon'?'That coupon code already exists.':err.message)}};
 const couponPayload=f=>{
  const pct=f.percent_off?Number(f.percent_off):null,amt=f.amount_off?Number(f.amount_off):null;
  if(pct&&amt)throw new Error('Use a percent OR a fixed amount, not both.');
  if(!pct&&!amt)throw new Error('Enter a percent off or a fixed amount off.');
  if(pct&&(pct<0||pct>100))throw new Error('Percent off must be between 1 and 100.');
  // A date input gives a day; the coupon stays valid until the end of that day (local time).
  return {code:String(f.code||'').trim().toUpperCase(),percent_off:pct,amount_off:amt,ends_at:f.ends_at?new Date(`${f.ends_at}T23:59:59`).toISOString():null,max_uses:f.max_uses?Math.floor(Number(f.max_uses)):null};
 };
 const saveCoupon=async(r,f)=>{setNotice('');try{const {error}=await supabase.from('coupons').update(couponPayload(f)).eq('id',r.id);if(error)throw error;setNotice(`Coupon ${String(f.code).toUpperCase()} updated.`);await load();return true}catch(e){setNotice(e.code==='23505'?'That coupon code already exists.':e.message);return false}};
 const addStock=async(product,qty)=>{setNotice('');try{const n=Number(qty);if(!Number.isInteger(n)||n<1)throw new Error('Enter a whole quantity of 1 or more.');const {error}=await supabase.from('inventory_movements').insert({product_id:product.id,qty:n,movement_type:'IN',note:'Received · added from Products'});if(error)throw error;setNotice(`${n} added to "${product.name}".`);await load();return true}catch(e){setNotice(e.message);return false}};
 const duplicateProduct=r=>{setProductDraft({...r,name:`${r.name||''} (copy)`,sku:'',_key:Date.now()});setPickedFiles([]);setOpeningQty('');setNewOpen(true);setNotice(`Copy of "${r.name}" ready — add photos, check the details, then create it.`)};
 const saveExpense=async(r,f)=>{setNotice('');try{const amount=Number(f.amount);if(!String(f.description||'').trim()||!(amount>0))throw new Error('An expense needs a description and an amount above 0.');const {error}=await supabase.from('expenses').update({description:f.description.trim(),amount,category:f.category?.trim()||'Operating',expense_date:f.expense_date||r.expense_date}).eq('id',r.id);if(error)throw error;setNotice('Expense updated.');await load();return true}catch(e){setNotice(e.message);return false}};
 const deleteExpense=r=>setAsk({text:`Delete the expense "${r.description||''}" (${money(r.amount)})? This cannot be undone.`,yes:'DELETE EXPENSE',run:async()=>{setNotice('');try{const {error}=await supabase.from('expenses').delete().eq('id',r.id);if(error)throw error;setNotice('Expense deleted.');await load()}catch(e){setNotice(e.message)}}});
 const saveBrand=async(r,f)=>{setNotice('');try{const name=String(f.name||'').trim();if(!name)throw new Error('The brand needs a name.');const {error}=await supabase.from('brands').update({name,story:String(f.story||'').trim()||null}).eq('id',r.id);if(error)throw error;setNotice(`Brand "${name}" updated.`);await load();return true}catch(e){setNotice(e.code==='23505'?'Another brand already has that name.':e.message);return false}};
 const toggleBrand=async r=>{setNotice('');try{const {error}=await supabase.from('brands').update({active:r.active===false}).eq('id',r.id);if(error)throw error;setNotice(r.active===false?`Brand "${r.name}" activated.`:`Brand "${r.name}" deactivated — it no longer appears in the new-product form.`);await load()}catch(e){setNotice(e.message)}};
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
  if(!orderDeletable(order)){setNotice('Real paid orders cannot be deleted: they are part of the accounting. Change the status to CANCELLED or REFUNDED instead.');return}
  const paid=status!=='pending';
  const warning=paid
    ? `Delete Stripe TEST order #${order.order_number||''}? No real money moved. It removes the order and its items from KARIA and from Accounting, and the stock it took goes back to inventory. This cannot be undone.`
    : `Delete unpaid order #${order.order_number||''}? The customer never finished paying. This also deletes its order items. Products will NOT be deleted. This cannot be undone.`;
  setAsk({text:warning,yes:'DELETE ORDER',run:async()=>{
  setNotice('');
  try{
    // Stock movements written for this order go too, so the pieces return to inventory.
    const {error:movesError}=await supabase.from('inventory_movements').delete().eq('reference_type','order').eq('reference_id',order.id);
    if(movesError)throw movesError;
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
  }});
 };
 const saveOrder=async(order,patch)=>{
  setNotice('');
  try{
    const {data,error}=await supabase.from('orders').update(patch).eq('id',order.id).select('id');
    if(error)throw error;
    if(!data?.length)throw new Error('The order was not updated. Check the Orders update policy in Supabase.');
    setViewingOrder(null);
    setNotice(`Order #${order.order_number||''} updated.`);
    await load();
  }catch(err){setNotice(`Order update failed: ${err?.message||String(err)}`)}
 };
 const toggleCoupon=async(r)=>{setNotice('');try{const {error}=await supabase.from('coupons').update({active:!r.active}).eq('id',r.id);if(error)throw error;setNotice(r.active?`Coupon ${r.code} deactivated.`:`Coupon ${r.code} activated.`);await load()}catch(e){setNotice(e.message)}};
 const deleteCoupon=r=>setAsk({text:`Delete coupon "${r.code}"? Past orders keep their discount.`,yes:'DELETE COUPON',run:async()=>{setNotice('');try{const {error}=await supabase.from('coupons').delete().eq('id',r.id);if(error)throw error;setNotice(`Coupon ${r.code} deleted.`);await load()}catch(e){setNotice(e.message)}}});
 const toggleReview=async(r)=>{setNotice('');try{const {error}=await supabase.from('product_reviews').update({approved:!r.approved}).eq('id',r.id);if(error)throw error;setNotice(r.approved?'Review hidden from the store.':'Review published.');await load()}catch(e){setNotice(e.message)}};
 const deleteReview=async(r)=>{if(!window.confirm('Delete this review? This cannot be undone.'))return;setNotice('');try{const {error}=await supabase.from('product_reviews').delete().eq('id',r.id);if(error)throw error;setNotice('Review deleted.');await load()}catch(e){setNotice(e.message)}};
 const deleteMessage=async(r)=>{if(!window.confirm('Delete this message? This cannot be undone.'))return;setNotice('');try{const {error}=await supabase.from('contact_messages').delete().eq('id',r.id);if(error)throw error;setNotice('Message deleted.');await load()}catch(e){setNotice(e.message)}};
 const ORDER_MOVE_MSG='This movement was written automatically by an order, so it cannot be edited or deleted. To give the stock back, change the order to CANCELLED or REFUNDED (stock returns automatically), or post an IN movement.';
 const deleteInventoryMovement=(movement)=>{
  if(!movement?.id)return;
  if(movement.reference_type==='order'){setNotice(ORDER_MOVE_MSG);return}
  setAsk({text:'Delete this inventory entry? The product stock is recalculated without it.',yes:'DELETE ENTRY',run:async()=>{
    const {error}=await supabase.from('inventory_movements').delete().eq('id',movement.id);
    if(error){setNotice(error.message);return}
    setNotice('Inventory entry deleted. Stock recalculated.');
    await load();
  }});
 };
 const editProduct=(product)=>{photosDirty.current=false;setEditingProduct(product)};
 const closeProductEdit=()=>{setEditingProduct(null);if(photosDirty.current){photosDirty.current=false;load()}};
 const saveProductEdit=async(e)=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));setNotice('Saving product…');
  try{
    if(f.stock_now!==undefined&&f.stock_now!==''&&(!Number.isInteger(Number(f.stock_now))||Number(f.stock_now)<0))throw new Error('Bags in stock must be a whole number, 0 or more.');
    const payload={name:f.name.trim(),sku:f.sku.trim(),brand_id:f.brand_id||null,category:f.category||null,description:f.description.trim()||null,materials:f.materials.trim()||null,dimensions:f.dimensions.trim()||null,price:Number(f.price||0),compare_at_price:f.compare_at_price?Number(f.compare_at_price):null,unit_cost:Number(f.unit_cost||0),weight:f.weight?Number(f.weight):null,low_stock_threshold:Number(f.low_stock_threshold||2),active:f.active==='true',featured:f.featured==='on'};
    const {data,error}=await supabase.from('products').update(payload).eq('id',editingProduct.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Product update affected no rows.');
    // stock: the edit form sets the real count; only the difference is written, as an ADJUST movement
    if(f.stock_now!==undefined&&f.stock_now!==''){const now=Number(f.stock_now),was=Number(stockById[editingProduct.id]??0);if(now!==was){const {error:se}=await supabase.from('inventory_movements').insert({product_id:editingProduct.id,qty:now-was,movement_type:'ADJUST',note:'Stock count set in Edit product'});if(se)throw new Error(`Product saved, but the stock could not be updated: ${dbError(se)}`)}}
    photosDirty.current=false;setEditingProduct(null);setNotice('Product updated successfully.');await load();
  }catch(err){setNotice(`Edit failed: ${dbError(err)}`)}
 };
 const editInventoryMovement=(movement)=>movement.reference_type==='order'?setNotice(ORDER_MOVE_MSG):setEditingMovement(movement);
 const saveMovementEdit=async(e)=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));setNotice('Saving inventory movement…');
  try{
    const isOpening=String(editingMovement.note||'').toLowerCase().includes('opening stock');
    const note=isOpening?`OPENING STOCK${f.note?.trim()?' · '+f.note.trim():''}`:(f.note?.trim()||null);
    const {data,error}=await supabase.from('inventory_movements').update({product_id:f.product_id,qty:Number(f.qty),movement_type:f.movement_type,note}).eq('id',editingMovement.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Inventory movement update affected no rows.');
    setEditingMovement(null);setNotice('Inventory movement updated successfully.');await load();
  }catch(err){setNotice(`Edit failed: ${err?.message||String(err)}`)}
 };
 const deleteProduct=(product)=>{
  if(!product?.id)return;
  setAsk({text:`Delete "${product.name||'this product'}"? Products that already sold should be ARCHIVED instead (Edit → Status) — if it has sales, KARIA archives it automatically to keep the accounting. Otherwise it is deleted for good, with its photos and stock entries.`,yes:'DELETE PRODUCT',run:async()=>{
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
  }});
 };
 const go=t=>{if(t===tab)return;setRows([]);setTab(t)};
 const openNewProduct=()=>{setProductDraft(null);setPickedFiles([]);setOpeningQty('');setNewOpen(true)};
 const stOf=o=>String(o.status||'pending').toLowerCase();
 // Sidebar badges: paid orders still without tracking, contact messages of the last 7 days (there is no read flag), active bags at 0.
 const toShip=customerOrders.filter(o=>['paid','processing'].includes(stOf(o))&&!o.tracking_number);
 const soldOut=activeProducts.filter(p=>p.stock<=0);
 const badges={Orders:toShip.length,Messages:recentMessages.length,Products:soldOut.length};
 const who=o=>o.shipping_address?.full_name||o.email||'Customer';
 const copyEmails=async()=>{
  const text=subscribers.map(s=>s.email).join(', '),done=`Copied ${plural(subscribers.length,'email')}. Paste them in the BCC field of your email.`;
  try{await navigator.clipboard.writeText(text);setNotice(done)}
  catch{const t=Object.assign(document.createElement('textarea'),{value:text});document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy')}catch{}t.remove();setNotice(ok?done:`Your browser blocked copying. Select and copy these emails:\n${text}`)}
 };
 const module=()=>{
  if(tab==='Dashboard'){
   const since=new Date(Date.now()-30*864e5),paid=customerOrders.filter(o=>PAID_STATUSES.includes(stOf(o))),paid30=paid.filter(o=>new Date(o.created_at)>=since);
   const sales30=paid30.reduce((s,o)=>s+Number(o.total||0),0),profit30=paid30.reduce((s,o)=>s+orderProfit(o),0),bags30=paid30.reduce((s,o)=>s+(o.order_items||[]).reduce((a,i)=>a+Number(i.qty||0),0),0);
   const inStock=activeProducts.reduce((s,p)=>s+Math.max(0,p.stock),0),avail=activeProducts.filter(p=>p.stock>0).length;
   const days=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return localDay(d)}),byDay=Object.fromEntries(days.map(d=>[d,0]));
   paid.forEach(o=>{const k=localDay(o.created_at);if(k in byDay)byDay[k]+=Number(o.total||0)});
   const top=Math.max(1,...Object.values(byDay)),sold={};
   paid30.forEach(o=>(o.order_items||[]).forEach(i=>{if(i.product_id)sold[i.product_id]=(sold[i.product_id]||0)+Number(i.qty||0)}));
   const best=Object.entries(sold).sort((a,b)=>b[1]-a[1]).map(([id,q])=>({p:activeProducts.find(p=>p.id===id),q})).filter(x=>x.p).slice(0,5);
   const h=new Date().getHours(),first=String(currentAdmin?.full_name||'').trim().split(/\s+/)[0];
   const todos=[toShip.length&&{tone:'green',I:ShoppingBag,title:`${plural(toShip.length,'order')} ready to ship`,sub:toShip.slice(0,3).map(o=>`#${o.order_number} ${who(o)}`).join(' · ')+(toShip.length>3?' …':''),btn:'Ship with Pirate Ship',to:'Orders',pri:true},
    soldOut.length&&{tone:'red',I:Package,title:`${soldOut.length} bag${soldOut.length===1?' is':'s are'} sold out`,sub:'Customers see SOLD OUT. Add the real stock.',btn:'Add stock',to:'Products'},
    recentMessages.length&&{tone:'blue',I:Mail,title:`${plural(recentMessages.length,'message')} this week`,sub:`${recentMessages[0].name||'Someone'}: ${String(recentMessages[0].message||'').slice(0,90)}`,btn:'Reply',to:'Messages'}].filter(Boolean);
   return <><Head eyebrow={new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} title={`Good ${h<12?'morning':h<18?'afternoon':'evening'}${first?', '+first:''}`}/>
    <h2 className="kH2">To do today</h2>
    <div className="kTodos">{todos.length?todos.map(t=><div className="kTodo" key={t.to}><div className={`kDot ${t.tone}`}><t.I aria-hidden="true"/></div><div className="grow"><b>{t.title}</b><span>{t.sub}</span></div><button type="button" className={t.pri?'kBtn pri':'kBtn'} onClick={()=>go(t.to)}>{t.btn}</button></div>):<div className="kTodo"><div className="kDot green" aria-hidden="true">✓</div><div className="grow"><b>All caught up</b><span>No orders to ship, no sold-out bags and no new messages.</span></div></div>}</div>
    <div className="kGrid g4"><Kpi label="Sales · 30 days" value={money(sales30)} sub={`${plural(paid30.length,'paid order')} · what customers paid`}/><Kpi label="Net profit · 30 days" value={money(profit30)} tone={profit30<0?'red':''} sub="after bag cost and Stripe fees"/><Kpi label="Bags in stock" value={inStock} sub={`${avail} of ${activeProducts.length} products available`}/><Kpi label="Average order" value={money(paid30.length?sales30/paid30.length:0)} sub={paid30.length?`${(bags30/paid30.length).toFixed(1)} bags per order`:'No orders yet'}/></div>
    <div className="kGrid g2"><div className="kCard"><h2>Sales by day</h2><p className="kSub">Last 14 days, paid orders</p><div className="kChart">{days.map(d=><i key={d} style={{height:`${Math.max(2,byDay[d]/top*100)}%`}} title={`${shortDay(`${d}T12:00:00`)} · ${money(byDay[d])}`}/>)}</div><div className="kAxis"><span>{shortDay(`${days[0]}T12:00:00`)}</span><span>Today</span></div></div>
     <div className="kCard"><h2>Best sellers</h2><p className="kSub">Bags sold, last 30 days</p>{best.length?best.map(({p,q})=><div className="kLine" key={p.id}>{mainPhoto(p.product_media)?<img className="kThumb" src={mainPhoto(p.product_media)} alt=""/>:<span className="kThumb"/>}<b className="grow">{p.name}</b><span className="kNote">{q} sold</span><StockPill n={p.stock}/></div>):<p className="kNote">No sales in the last 30 days.</p>}</div></div></>;
  }
  if(tab==='Orders')return <><Head eyebrow="Sales" title="Orders"><div className="kExport"><button type="button" className="kBtn pri" onClick={()=>setNotice(exportPirateShip(rows))}>⇩ Export for Pirate Ship</button><small>Paid orders without tracking. Upload the file in Pirate Ship → Ship → Upload a spreadsheet.</small></div></Head><OrderAdminTable rows={rows} onView={setViewingOrder} onDelete={deleteOrder}/></>;
  if(tab==='Customers')return <><Head eyebrow="Sales" title="Customers"/><CustomerTable profiles={rows} orders={customerOrders} subscribers={subscribers}/></>;
  if(tab==='Messages'){const week=Date.now()-7*864e5;return <><Head eyebrow="Sales" title="Messages"/><p className="kSub">Messages customers send from the Contact page. Reply opens your email app.</p>{rows.length?<div className="kCard">{rows.map(r=><div className="kMsg" key={r.id}><div className="kAv" aria-hidden="true">{String(r.name||'?').trim().charAt(0).toUpperCase()}</div><div className="grow"><b>{new Date(r.created_at)>=week&&<span className="kNew" title="This week"/>}{r.name}</b> <span className="kNote">{r.email} · {r.created_at?new Date(r.created_at).toLocaleString():''}</span><p>{r.message}</p></div><div className="kRow"><a className="kBtn sm" href={'mailto:'+r.email+'?subject='+encodeURIComponent('KARIA — your message')}>Reply by email</a><button type="button" className="kBtn sm danger" onClick={()=>deleteMessage(r)}>Delete</button></div></div>)}</div>:<div className="kCard kEmpty">No messages yet.</div>}</>}
  if(tab==='Reviews')return <><Head eyebrow="Sales" title="Reviews"/><p className="kSub">Reviews are published as soon as a customer sends them. Hide one to take it off the store without deleting it.</p><ReviewList rows={rows} products={productsList} onToggle={toggleReview} onDelete={deleteReview}/></>;
  if(tab==='Products')return <><Head eyebrow="Catalog" title="Products"><button type="button" className="kBtn pri" onClick={openNewProduct}>+ New product</button></Head><ProductAdminTable rows={rows} stock={stockById} onEdit={editProduct} onDelete={deleteProduct} onDuplicate={duplicateProduct} onAddStock={addStock}/></>;
  if(tab==='Inventory'){const t=inventoryTotals,out=inventorySummary.filter(r=>r.active!==false&&r.sku!==CUSTOM_SKU&&r.current<=0).length;return <><Head eyebrow="Catalog" title="Inventory"><button type="button" className="kBtn pri" onClick={()=>setFormOpen(v=>!v)}>{formOpen?'Close':'+ Receive stock'}</button></Head>
   <div className="kGrid g4"><Kpi label="Bags in stock" value={t.current} sub={`${t.opening} opening · ${t.received} received · ${t.returns} returned`}/><Kpi label="Stock value at cost" value={money(t.value)}/><Kpi label="Sold · all time" value={t.sold} sub={t.out?`${t.out} other OUT`:'Written by orders'}/><Kpi label="Sold-out products" value={out} tone={out?'red':''}/></div>
   {formOpen&&<form className="kCard kForm" onSubmit={e=>create(e,'inventory')}><h2>Add inventory movement</h2><p className="kSub">Use OPENING STOCK only for the first physical count of a product. Use IN for later receipts. Sales are recorded automatically by orders.</p><div className="kFields"><label className="caField">Product *<select name="product_id" required><option value="">Select product</option>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><Field label="Quantity *" name="quantity" type="number" step="1" min="1" required/><label className="caField">Movement<select name="movement_type" defaultValue="IN"><option value="IN">IN / RECEIVED</option><option value="OPENING_UI">OPENING STOCK</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select></label><Field label="Reason / reference" name="note"/></div><div><button className="kBtn pri">Post movement</button></div></form>}
   <h2 className="kH2">Movement history</h2><p className="kSub">Sales are written by orders and locked. To give stock back, change the order to CANCELLED or REFUNDED.</p>
   {rows.length===0?<div className="kCard kEmpty">No inventory movements yet.</div>:<div className="kTable"><table><thead><tr><th>Date</th><th>Bag</th><th>Movement</th><th className="num">Qty</th><th>Reason / reference</th><th>Actions</th></tr></thead><tbody>{rows.map(r=>{const note=String(r.note||''),type=r.movement_type,isOpening=type==='ADJUST'&&isOpeningNote(note),fromOrder=r.reference_type==='order',q=Number(r.qty??0);
    const [label,tone]=isOpening?['Opening stock','grey']:type==='IN'?['Received','green']:type==='OUT'?(fromOrder?['Sale','amber']:['Out','red']):type==='RETURN'?[fromOrder?'Sale return':'Return','blue']:type==='PRODUCTION_IN'?['Production in','green']:type==='ADJUST'?['Adjustment','grey']:[type||'—','grey'];
    return <tr key={r.id}><td>{shortDay(r.created_at)}</td><td><b>{r.products?.name||''}</b><div className="kNote">{r.products?.sku||''}</div></td><td><span className={`kPill ${tone}`}>{label}</span></td><td className="num"><b>{type==='OUT'?`−${Math.abs(q)}`:q>0?`+${q}`:q}</b></td><td className="kNote">{isOpening?note.replace(/^OPENING STOCK\s*[·-]?\s*/i,''):note}</td><td>{fromOrder?<span className="kNote" title={ORDER_MOVE_MSG}>Automatic · from order</span>:<div className="kRow"><button type="button" className="kBtn sm" onClick={()=>editInventoryMovement(r)}>Edit</button><button type="button" className="kBtn sm danger" onClick={()=>deleteInventoryMovement(r)}>Delete</button></div>}</td></tr>})}</tbody></table></div>}
   <h2 className="kH2">Stock by product</h2><p className="kSub">Opening + received + returns + adjustments − sales − other OUT = current stock.</p>
   <div className="kTable"><table><thead><tr><th>Product</th><th>SKU</th><th className="num">Opening</th><th className="num">Received</th><th className="num">Sales</th><th className="num">Returns</th><th className="num">Other OUT</th><th className="num">Adj.</th><th>Current</th><th className="num">Value</th></tr></thead><tbody>{inventorySummary.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td className="kNote">{r.sku||'—'}</td><td className="num">{r.opening}</td><td className="num">+{r.received}</td><td className="num">−{r.sold}</td><td className="num">+{r.returns}</td><td className="num">−{r.out}</td><td className="num">{r.adjustments}</td><td><span className={`kStock ${r.current<=0?'s0':r.current<=2?'slow':'sok'}`}>{r.current}</span></td><td className="num">{money(r.value)}</td></tr>)}</tbody></table></div></>}
  if(tab==='Categories & brands')return <><Head eyebrow="Catalog" title="Categories & brands"/><div className="kGrid g2">
   <div className="kCard"><h2>Categories</h2><p className="kSub">The departments customers use to browse KARIA. Products can only be assigned to active categories.</p><form className="kInline" onSubmit={e=>create(e,'category')}><input name="name" placeholder="New category" aria-label="Category name" required/><input name="slug" placeholder="URL slug (optional)" aria-label="URL slug"/><button className="kBtn pri">Add</button></form>
    {rows.length?rows.map(r=>{const n=productsList.filter(p=>p.category===r.name).length;return <div className="kLine" key={r.id}><div className="grow"><b>{r.name}</b><span className="kNote">/{r.slug} · {plural(n,'active product')}</span></div>{r.active===false?<span className="kPill grey">Hidden</span>:<span className="kPill green">Visible</span>}<div className="kRow"><button type="button" className="kBtn sm" onClick={()=>editCategory(r)}>Edit</button><button type="button" className="kBtn sm" onClick={()=>toggleCategory(r)}>{r.active===false?'Activate':'Deactivate'}</button><button type="button" className="kBtn sm danger" onClick={()=>deleteCategory(r)}>Delete</button></div></div>}):<p className="kNote">No categories yet.</p>}</div>
   <div className="kCard"><h2>Brands</h2><p className="kSub">Optional label on products. Inactive brands leave the new-product form.</p><form className="kInline" onSubmit={e=>create(e,'brand')}><input name="name" placeholder="New brand" aria-label="Brand name" required/><input name="description" placeholder="Story (optional)" aria-label="Brand story"/><button className="kBtn pri">Add</button></form><BrandTable rows={brandRows} products={productsList} onSave={saveBrand} onToggle={toggleBrand}/></div></div></>;
  if(tab==='Coupons')return <><Head eyebrow="Marketing" title="Coupons"><button type="button" className="kBtn pri" onClick={()=>setFormOpen(v=>!v)}>{formOpen?'Close':'+ New coupon'}</button></Head>{formOpen&&<form className="kCard kForm" onSubmit={e=>create(e,'coupon')}><h2>New coupon</h2><p className="kSub">Fill in a percent OR a fixed amount, not both. The coupon works until the end of its last day. Max uses counts paid orders; leave it empty for unlimited.</p><div className="kFields"><CouponFields/></div><div><button className="kBtn pri">Create coupon</button></div></form>}<CouponTable rows={rows} uses={couponUses} onSave={saveCoupon} onToggle={toggleCoupon} onDelete={deleteCoupon}/></>;
  if(tab==='Newsletter')return <><Head eyebrow="Marketing" title="Newsletter"><button type="button" className="kBtn pri" disabled={!subscribers.length} onClick={copyEmails}>Copy all emails</button></Head><p className="kSub">{plural(subscribers.length,'subscriber')} from the store's newsletter form. Copy the list and paste it in the BCC field of your email.</p>{subscribers.length?<div className="kTable"><table><thead><tr><th>Email</th><th>Joined</th></tr></thead><tbody>{subscribers.map(r=><tr key={r.email}><td>{r.email}</td><td>{shortDay(r.created_at)}</td></tr>)}</tbody></table></div>:<div className="kCard kEmpty">No subscribers yet.</div>}</>;
  if(tab==='Accounting'){const T=acct.totals,sales=T.grossSales??T.sales,bags=acct.sales.reduce((s,x)=>s+x.qty,0),margin=sales?T.net/sales*100:0;const byOrder={};acct.sales.forEach(r=>{const k=r.order_id;if(!byOrder[k])byOrder[k]={order:r.orders,lines:[],total:0,fee:0,profit:0};byOrder[k].lines.push(r);byOrder[k].total+=r.customerTotal;byOrder[k].fee+=r.processorFee;byOrder[k].profit+=r.profit});const recent=Object.values(byOrder).slice(0,8);
   return <><Head eyebrow="Money" title="Accounting"><select className="kSelect" value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Period"><option value="30">Last 30 days</option><option value="month">This month</option><option value="year">This year</option><option value="all">All time</option></select></Head>
   <div className="kGrid g4"><Kpi label="Sales" value={money(sales)} sub={plural(T.orders||0,'paid order')}/><Kpi label="Bag cost" value={money(T.cogs)} sub={`${plural(bags,'bag')} sold`}/><Kpi label="Fees + expenses" value={money(T.fees+T.expenses)} sub={`Stripe ${money(T.fees)} · expenses ${money(T.expenses)}`}/><Kpi label="Net profit" value={money(T.net)} tone={T.net<0?'red':'green'} sub={`${margin.toFixed(1)}% margin`}/></div>
   <div className="kGrid g2"><div className="kCard"><h2>Partner split 50/50</h2><p className="kSub">Net profit of this period, per the operating agreement.</p><div className="kSplit" aria-hidden="true"><i/><i/></div><div className="kRow between"><span><b>Karen</b> · {money(T.net/2)}</span><span><b>María Fernanda</b> · {money(T.net/2)}</span></div></div>
    <div className="kCard"><h2>Profit summary</h2>{[['Gross sales',money(sales)],['Discounts','−'+money(T.discounts)],['Shipping charged','+'+money(T.shipping)],['Bag cost (COGS)','−'+money(T.cogs)],['Stripe fees','−'+money(T.fees)],['Operating expenses','−'+money(T.expenses)],['Net profit',money(T.net),1],['Sales tax collected (passed on, not income)',money(T.tax)]].map(([a,b,strong])=><div className={strong?'kLine kStrong':'kLine'} key={a}><span className="grow">{a}</span><b className={strong?(T.net<0?'kRed':'kGreen'):undefined}>{b}</b></div>)}</div></div>
   <div className="kCard"><h2>Expenses</h2><p className="kSub">Materials, packaging, ads… They lower the net profit.</p><form className="kInline" onSubmit={e=>create(e,'expense')}><Field name="description" placeholder="Description" required/><Field name="amount" placeholder="Amount ($)" type="number" step="0.01" min="0.01" required/><Field name="category" placeholder="Category"/><Field name="expense_date" type="date"/><button className="kBtn pri">+ Add expense</button></form><ExpenseTable rows={acct.expenses} onSave={saveExpense} onDelete={deleteExpense}/></div>
   <div className="kCard"><h2>Recent sales</h2><p className="kSub">Paid orders in this period, newest first.</p>{recent.length?<div className="kTable flat"><table><thead><tr><th>Date</th><th>Order</th><th>Customer</th><th className="num">Items</th><th className="num">Total</th><th className="num">Discount</th><th className="num">Shipping</th><th className="num">Tax</th><th className="num">Stripe fee</th><th className="num">Bag cost</th><th className="num">Profit</th></tr></thead><tbody>{recent.map((g,i)=>{const first=g.lines[0],o=g.order||{},sum=f=>g.lines.reduce((a,x)=>a+x[f],0);return <tr key={first.order_id||i}><td>{shortDay(o.created_at)}</td><td><b>#{o.order_number||''}</b></td><td>{o.email||'Customer'}</td><td className="num">{g.lines.length}</td><td className="num">{money(g.total)}</td><td className="num">−{money(sum('discount'))}</td><td className="num">+{money(sum('shipping'))}</td><td className="num">{money(sum('tax'))}</td><td className="num">−{money(g.fee)}</td><td className="num">−{money(sum('totalCost'))}</td><td className="num"><b className={g.profit<0?'kRed':'kGreen'}>{money(g.profit)}</b></td></tr>})}</tbody></table></div>:<p className="kNote">No paid sales in this period.</p>}</div></>}
  if(tab==='Settings'){const v=settingsValues;return <form key={JSON.stringify(v)} onSubmit={e=>create(e,'settings')}><Head eyebrow="Store" title="Settings"><button className="kBtn pri">Save changes</button></Head><div className="kGrid g2">
   <div className="kCard kForm"><h2>Shipping</h2><p className="kSub">Checkout charges the flat rate on every order, and nothing when the order reaches the free-shipping amount.</p><div className="kTwo"><label className="caField">Flat rate ($)<input name="shipping_rate" type="number" step="0.01" min="0" defaultValue={v.shipping?.default_rate??0}/></label><label className="caField">Free shipping from ($)<input name="free_shipping_over" type="number" step="0.01" min="0" defaultValue={v.shipping?.free_shipping_over??0}/><small>0 = never free</small></label></div><label className="caField">Returns window (days)<input name="returns_days" type="number" min="0" defaultValue={v.legal?.returns_days??14}/><small>Shown on the Returns page.</small></label></div>
   <div className="kCard kForm"><h2>Store look</h2><p className="kSub">Changes the look of the public store. Classic is the original design.</p><label className="caField">Look<select name="theme" defaultValue={v.storefront?.theme==='classic'?'classic':'noir'}><option value="noir">Noir (new)</option><option value="classic">Classic (original)</option></select></label></div>
   <div className="kCard kForm"><h2>Contact</h2><p className="kSub">Shown on the Contact and About pages. Leave a field empty to hide it.</p><label className="caField">Contact email<input name="contact_email" type="email" defaultValue={v.storefront?.contact_email??''}/></label><div className="kTwo"><label className="caField">WhatsApp (with country code)<input name="whatsapp" defaultValue={v.storefront?.whatsapp??''} placeholder="+1 555 123 4567"/></label><label className="caField">Instagram user<input name="instagram" defaultValue={v.storefront?.instagram??''} placeholder="@karia"/></label></div></div>
   <div className="kCard kForm"><h2>About text</h2><p className="kSub">The story on the About page. One paragraph per line.</p><label className="caField">Text<textarea name="about" rows={6} defaultValue={v.storefront?.about??''}/></label></div></div>
   <div className="kRow end"><button className="kBtn pri">Save changes</button></div></form>}
  if(tab==='Team'){const roles={super_admin:'Super admin',admin:'Admin',staff:'Staff'};return <><Head eyebrow="Store" title="Team"><button type="button" className="kBtn pri" onClick={()=>setFormOpen(v=>!v)}>{formOpen?'Close':'+ Invite admin'}</button></Head>
   {formOpen&&<form className="kCard kForm" onSubmit={createAdmin}><h2>Create administrator</h2><p className="kSub">They get a temporary password and must create their own at first login.</p><div className="kFields"><Field label="Full name *" name="full_name" required/><Field label="Email *" name="email" type="email" required/><label className="caField">Role<select name="role"><option value="admin">Admin</option><option value="staff">Staff</option></select></label></div><div><button className="kBtn pri">Create access</button></div></form>}
   {rows.length?<div className="kTable"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td className="kWho"><b>{r.full_name||r.email||'User'}</b>{r.full_name&&r.email&&<span>{r.email}</span>}</td><td><span className="kPill violet">{roles[r.role]||r.role}</span></td><td>{r.disabled?<span className="kPill red">Disabled</span>:<span className="kPill green">Active</span>}</td><td><div className="kRow">{r.id!==currentUserId&&<button type="button" className="kBtn sm" onClick={()=>updateAdmin(r.id,r.role,!r.disabled)}>{r.disabled?'Activate':'Disable'}</button>}{r.role!=='super_admin'&&<button type="button" className="kBtn sm" onClick={()=>updateAdmin(r.id,r.role==='admin'?'staff':'admin',!!r.disabled)}>Make {r.role==='admin'?'staff':'admin'}</button>}{currentAdmin?.role==='super_admin'&&r.id!==currentUserId&&<button type="button" className="kBtn sm" onClick={()=>resetAdminPassword(r)}>Reset password</button>}</div></td></tr>)}</tbody></table></div>:<div className="kCard kEmpty">No administrators found.</div>}</>}
  // Customize is switched off: kept here but no longer in the menu.
  if(tab==='Customize')return <CustomizeAdmin setNotice={setNotice}/>;
  return <DataTable rows={rows}/>;
 };
 const d=productDraft||{},draftCat=categories.find(c=>c.name===d.category)?.id||'';
 return <div className="admin kAdmin"><aside className="kSide" aria-label="Admin sections"><div className="kBrand">KARIA</div><small className="kBrandSub">Administration</small>{NAV.map(([g,list])=><React.Fragment key={g}><em className="kGrp">{g}</em>{list.map(([x,I])=><button type="button" key={x} className="kNav" aria-current={tab===x?'page':undefined} onClick={()=>go(x)}><I aria-hidden="true"/>{x}{badges[x]>0&&<span className="kCnt" title="Needs attention">{badges[x]}</span>}</button>)}</React.Fragment>)}<button type="button" className="kNav kBack" onClick={back}>← Storefront</button></aside><section className="kMain">{loading&&!rows.length?<div className="kCard kEmpty">Loading…</div>:module()}</section>
{notice&&<div className="notice adminToast" role="status"><span>{notice}</span><button type="button" aria-label="Close message" onClick={()=>setNotice('')}>×</button></div>}{confirmBar}
{newOpen&&<div className="kDrawer" onMouseDown={e=>{if(e.target===e.currentTarget)setNewOpen(false)}} onKeyDown={e=>{if(e.key==='Escape')setNewOpen(false)}}><div className="kPanel" role="dialog" aria-modal="true" aria-label="New product"><form ref={productFormRef} key={d._key||'new'} onSubmit={e=>create(e,'product')}>
 <div className="kRow between"><h2>{productDraft?'New product (copy)':'New product'}</h2><button type="button" className="kBtn sm" aria-label="Close" autoFocus onClick={()=>setNewOpen(false)}>✕</button></div>
 <p className="kNote">Four short steps. Nothing is saved until you press Create. Fields marked * are required.{productDraft&&<> <button type="button" className="linkBtn" onClick={()=>{setProductDraft(null);setPickedFiles([])}}>Clear the copy</button></>}</p>
 <section className="kStep"><h3><span>1</span>Photos</h3><label className="kDrop"><b>Choose photos / video *</b><span>The first one becomes the main photo. Big phone photos are made smaller automatically.</span><input name="images" type="file" accept="image/*,video/mp4,video/webm" multiple required onChange={e=>setPickedFiles(Array.from(e.target.files||[]))}/></label><FilePreview files={pickedFiles}/></section>
 <section className="kStep"><h3><span>2</span>Details</h3><Field label="Product name *" name="name" defaultValue={d.name} required/><div className="kTwo"><label className="caField">Category *<select name="category_id" required defaultValue={draftCat}><option value="">Select category</option>{activeCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="SKU" name="sku" placeholder="Automatic if empty"/></div><label className="caField">Brand (optional)<select name="brand_id" defaultValue={d.brand_id||''}><option value="">No brand</option>{activeBrands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="caField">Description<textarea name="description" rows={5} defaultValue={d.description||''} placeholder={"First line: short description.\nThen one feature per line — Color: Brown\n\nAfter an empty line: the long description."}/></label><div className="kTwo"><Field label="Materials" name="materials" defaultValue={d.materials||''}/><Field label="Dimensions" name="dimensions" defaultValue={d.dimensions||''}/></div></section>
 <section className="kStep"><h3><span>3</span>Price & stock</h3><div className="kTwo"><Field label="Price the customer pays ($) *" name="price" type="number" step="0.01" min="0" defaultValue={d.price??''} required/><Field label="Original price, crossed out ($)" name="compare_at_price" type="number" step="0.01" min="0" defaultValue={d.compare_at_price??''}/><Field label="Your cost per bag ($) *" name="cost" type="number" step="0.01" min="0" defaultValue={d.unit_cost??''} required/><label className="caField">Bags you have now *<input name="opening_stock" type="number" min="0" step="1" required value={openingQty} onChange={e=>setOpeningQty(e.target.value)}/>{openingQty!==''&&Number(openingQty)===0?<small className="fieldWarn">With 0 bags the product shows as SOLD OUT.</small>:<small>Saved in Inventory as OPENING STOCK.</small>}</label><Field label="Weight packed (lb)" name="weight" type="number" step="0.001" min="0" defaultValue={d.weight??''}/><Field label="Low stock alert (default 2)" name="low_stock_threshold" type="number" step="1" min="0" defaultValue={d.low_stock_threshold??''}/></div></section>
 <section className="kStep"><h3><span>4</span>Publish</h3><label className="kCheck"><input name="publish_shop" type="checkbox" defaultChecked={d.active!==false}/> Show in the shop now</label><label className="kCheck"><input name="featured" type="checkbox" defaultChecked={!!d.featured}/> Featured product</label><div><button className="kBtn pri" disabled={uploading}>{uploading?(uploadStep||'Uploading…'):'Create product + upload photos'}</button></div></section>
</form></div></div>}
{viewingOrder&&<OrderDetailModal order={viewingOrder} onClose={()=>setViewingOrder(null)} onSave={saveOrder}/>}
{editingProduct&&<div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeProductEdit()}}><div className="editModal"><div className="editModalHead"><div><small>EDIT PRODUCT</small><h2>{editingProduct.name}</h2></div><button type="button" onClick={closeProductEdit}>×</button></div><PhotoManager product={editingProduct} setNotice={setNotice} setAsk={setAsk} onChanged={()=>{photosDirty.current=true}}/><form className="editModalForm" onSubmit={saveProductEdit}><label>Product name<input name="name" defaultValue={editingProduct.name||''} required/></label><label>SKU<input name="sku" defaultValue={editingProduct.sku||''} required/></label><label>Brand<select name="brand_id" defaultValue={editingProduct.brand_id||''}><option value="">No brand</option>{brands.filter(b=>b.active!==false||b.id===editingProduct.brand_id).map(b=><option key={b.id} value={b.id}>{b.name}{b.active===false?' (inactive)':''}</option>)}</select></label><label>Category<select name="category" defaultValue={editingProduct.category||''} required><option value="">Select category</option>{categories.filter(c=>c.active!==false||c.name===editingProduct.category).map(c=><option key={c.id} value={c.name}>{c.name}{c.active===false?' (inactive)':''}</option>)}{editingProduct.category&&!categories.some(c=>c.name===editingProduct.category)&&<option value={editingProduct.category}>{editingProduct.category} (no longer a category)</option>}</select></label><label>Price the customer pays<input name="price" type="number" step="0.01" defaultValue={editingProduct.price??''}/></label><label>Original price, crossed out (only if on sale)<input name="compare_at_price" type="number" step="0.01" defaultValue={editingProduct.compare_at_price??''}/></label><label>Unit cost<input name="unit_cost" type="number" step="0.01" defaultValue={editingProduct.unit_cost??''}/></label><label>Weight (lb)<input name="weight" type="number" step="0.001" min="0" defaultValue={editingProduct.weight??''}/></label><label>Low stock alert<input name="low_stock_threshold" type="number" defaultValue={editingProduct.low_stock_threshold??2}/></label>{editingProduct.sku!==CUSTOM_SKU&&<label>Bags in stock now<input name="stock_now" type="number" min="0" step="1" defaultValue={stockById[editingProduct.id]??0}/><small className="kHint">Type the real count. The difference is saved in Inventory.</small></label>}<label>Materials<input name="materials" defaultValue={editingProduct.materials||''}/></label><label>Dimensions<input name="dimensions" defaultValue={editingProduct.dimensions||''}/></label><label className="full">Description — first line: short description · next lines: one feature each (Color: Brown) · after an empty line: long description<textarea name="description" rows={9} defaultValue={editingProduct.description||''}/></label><label>Status<select name="active" defaultValue={editingProduct.active===false?'false':'true'}><option value="true">Active / Published</option><option value="false">Archived / Hidden</option></select></label><label className="editCheck"><input name="featured" type="checkbox" defaultChecked={!!editingProduct.featured}/> Featured product</label><div className="editModalActions full"><button type="button" onClick={closeProductEdit}>CANCEL</button><button type="submit">SAVE PRODUCT</button></div></form></div></div>}
{editingMovement&&<div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingMovement(null)}}><div className="editModal inventoryEditModal"><div className="editModalHead"><div><small>EDIT INVENTORY MOVEMENT</small><h2>{editingMovement.products?.name||'Inventory entry'}</h2></div><button type="button" onClick={()=>setEditingMovement(null)}>×</button></div><form className="editModalForm" onSubmit={saveMovementEdit}><label className="full">Product<select name="product_id" defaultValue={editingMovement.product_id||''} required>{productsList.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}{editingMovement.product_id&&!productsList.some(p=>p.id===editingMovement.product_id)&&<option value={editingMovement.product_id}>{editingMovement.products?.name||'Product'} · {editingMovement.products?.sku||''} (archived)</option>}</select></label><label>Quantity<input name="qty" type="number" defaultValue={editingMovement.qty??editingMovement.quantity??''} required/></label><label>Movement type<select name="movement_type" defaultValue={editingMovement.movement_type||'ADJUST'}><option value="IN">IN / RECEIVED</option><option value="OUT">OUT</option><option value="RETURN">RETURN</option><option value="ADJUST">ADJUSTMENT</option><option value="PRODUCTION_IN">PRODUCTION IN</option></select></label><label className="full">Reason / reference<textarea name="note" defaultValue={String(editingMovement.note||'').replace(/^OPENING STOCK\s*[·-]?\s*/i,'')}/></label><div className="editModalActions full"><button type="button" onClick={()=>setEditingMovement(null)}>CANCEL</button><button type="submit">SAVE MOVEMENT</button></div></form></div></div>}
</div>
}
function orderPhoto(item){return mainPhoto(item?.products?.product_media)}
// Only orders that never moved real money can be deleted: unpaid ones, or ones paid with a Stripe test session (cs_test_…).
const orderDeletable=o=>String(o?.status||'pending').toLowerCase()==='pending'||String(o?.stripe_session_id||'').startsWith('cs_test_');
// Pirate Ship takes any spreadsheet: one CSV row per paid order still waiting for a label (no tracking number yet).
// Weight is the sum of the bags' product weight (lb); left empty if any bag has none, so Pirate Ship uses the saved package.
function exportPirateShip(rows){
 const todo=(rows||[]).filter(o=>['paid','processing'].includes(String(o.status||'').toLowerCase())&&!o.tracking_number);
 if(!todo.length)return 'No paid orders are waiting for a shipping label.';
 const cell=v=>{const s=String(v??'');return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
 const head=['Order ID','Name','Address','Address Line 2','City','State','Zipcode','Country','Phone','Email','Pounds','Items'];
 const lines=todo.map(o=>{const a=o.shipping_address||{},items=o.order_items||[];
  const lb=items.every(i=>Number(i.products?.weight)>0)?items.reduce((s,i)=>s+Number(i.qty||1)*Number(i.products.weight),0).toFixed(2):'';
  const what=items.map(i=>`${i.qty||1} x ${i.products?.name||'Bag'}`).join('; ');
  return [`KARIA-${o.order_number||''}`,a.full_name,a.address1,a.address2,a.city,a.state,a.postal_code,a.country||'US',a.phone,o.email,lb,what].map(cell).join(',')});
 const csv=[head.join(','),...lines].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=Object.assign(document.createElement('a'),{href:url,download:`karia-pirate-ship-${new Date().toISOString().slice(0,10)}.csv`});
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 return `Downloaded ${todo.length} order${todo.length===1?'':'s'} for Pirate Ship. After buying the labels, open each order and paste the tracking number.`;
}
// "To ship" = paid and no tracking yet; "All paid" hides pending orders (checkouts the customer never paid).
const ORDER_CHIPS=[['toship','To ship',o=>['paid','processing'].includes(o)],['shipped','Shipped',o=>o==='shipped'],['delivered','Delivered',o=>o==='delivered'],['problems','Refunded & cancelled',o=>o==='refunded'||o==='cancelled'],['all','All paid',o=>o!=='pending'],['pending','Abandoned checkouts',o=>o==='pending']];
function OrderAdminTable({rows,onView,onDelete}){
 const [filter,setFilter]=useState('toship'),[q,setQ]=useState('');
 if(!rows?.length)return <div className="kCard kEmpty">No orders yet.</div>;
 const st=o=>String(o.status||'pending').toLowerCase();
 const inChip=(k,o)=>{const [,,test]=ORDER_CHIPS.find(c=>c[0]===k);return test(st(o))&&(k!=='toship'||!o.tracking_number)};
 const term=q.trim().toLowerCase().replace(/^#/,'');
 const shown=rows.filter(o=>inChip(filter,o)&&(!term||[o.order_number,o.email,o.shipping_address?.full_name].some(v=>String(v??'').toLowerCase().includes(term))));
 return <><div className="kChips">{ORDER_CHIPS.map(([k,label])=><button type="button" key={k} className="kChip" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{label}<i>{rows.filter(o=>inChip(k,o)).length}</i></button>)}<input type="search" className="kSearch" placeholder="Search order #, name or email" aria-label="Search orders" value={q} onChange={e=>setQ(e.target.value)}/></div>
  {filter==='pending'&&<p className="kSub">Abandoned checkouts: the customer opened Stripe but never paid. They don't count as sales and can be deleted.</p>}
  {!shown.length?<div className="kCard kEmpty">{filter==='toship'&&!term?'Nothing to ship right now.':'No orders match.'}</div>:<div className="kTable"><table><thead><tr><th>Order</th><th>Customer</th><th>Bags</th><th>Status</th><th>Tracking</th><th className="num">Total</th><th></th></tr></thead><tbody>{shown.map(o=>{const items=o.order_items||[],a=o.shipping_address||{},s=st(o);return <tr key={o.id}>
   <td><b>#{o.order_number||'—'}</b><div className="kNote">{shortDay(o.created_at)}</div></td>
   <td className="kWho"><b>{a.full_name||a.name||o.email||'—'}</b><span>{[a.city,a.state].filter(Boolean).join(', ')||o.email||''}</span></td>
   <td><div className="kThumbs">{items.slice(0,3).map((it,i)=>{const photo=it.customization?null:orderPhoto(it),name=it.customization?`Custom bag · ${it.customization.style_name||''}`:it.products?.name||'Bag';return photo?<img className="kThumb" key={it.id||i} src={photo} alt={name} title={`${it.qty} × ${name}`}/>:<span className="kThumb" key={it.id||i} title={name}>{it.customization?'Custom':'—'}</span>})}{items.length>3&&<span className="kNote">+{items.length-3}</span>}</div></td>
   <td><StatusPill s={s}/></td>
   <td>{o.tracking_number?<span className="kTrack" title={o.tracking_number}>{o.carrier?`${o.carrier} `:''}{o.tracking_number}</span>:['paid','processing'].includes(s)?<button type="button" className="kBtn sm" onClick={()=>onView(o)}>+ Add tracking</button>:<span className="kNote">—</span>}</td>
   <td className="num"><b>{money(o.total)}</b></td>
   <td><div className="kRow nowrap"><button type="button" className="kBtn sm" onClick={()=>onView(o)}>Open</button>{orderDeletable(o)&&<button type="button" className="kBtn sm danger" onClick={()=>onDelete(o)}>Delete</button>}</div></td></tr>})}</tbody></table></div>}</>
}
function OrderDetailModal({order,onClose,onSave}){
 const items=order.order_items||[],addr=order.shipping_address||{};
 // checkout writes discount_total / shipping_total and address1 / address2; older rows used the short names
 const discount=Number(order.discount_total??order.discount??0),shipping=Number(order.shipping_total??order.shipping??0),tax=Number(order.tax||0),fee=Number(order.processor_fee||0),total=Number(order.total||0);
 const cogs=items.reduce((sum,it)=>sum+Number(it.qty||0)*Number(it.unit_cost||0),0);
 const address=[addr.address1||addr.address_line1||addr.line1,addr.address2||addr.address_line2||addr.line2,addr.city,addr.state,addr.postal_code||addr.zip,addr.country].filter(Boolean).join(', ');
 const current=String(order.status||'pending').toLowerCase(),[status,setStatus]=useState(current),[saving,setSaving]=useState(false);
 const choices=NEXT_STATUSES[current]||[current];
 const refundNote=status!==current&&['cancelled','refunded'].includes(status)&&PAID_STATUSES.includes(current);
 const save=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));setSaving(true);await onSave(order,{status,carrier:f.carrier.trim()||null,tracking_number:f.tracking_number.trim()||null});setSaving(false)};
 return <div className="editModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="editModal orderDetailModal"><div className="editModalHead"><div><small>ORDER DETAILS</small><h2>Order #{order.order_number||'—'}</h2><StatusPill s={order.status}/></div><button type="button" onClick={onClose}>×</button></div>
  <section className="orderDetailProducts">{items.map((it,i)=>{const photo=orderPhoto(it),line=<div className="orderDetailPrice"><span>{it.qty} × ${Number(it.unit_price||0).toFixed(2)}</span><strong>${(Number(it.qty||0)*Number(it.unit_price||0)).toFixed(2)}</strong></div>;if(it.customization)return <div className="orderDetailProduct orderDetailCustom" key={it.id||i}><CustomizationSheet c={it.customization}/>{line}</div>;return <div className="orderDetailProduct" key={it.id||i}>{photo?<img src={photo} alt={it.products?.name||'Product'}/>:<div className="orderDetailNoPhoto">NO PHOTO</div>}<div><h3>{it.products?.name||'Product'}</h3><span>{it.products?.sku||''}</span><p>{it.products?.description||''}</p></div>{line}</div>})}</section>
  <div className="orderDetailColumns"><section><small>CUSTOMER</small><h3>{order.email||'—'}</h3><p>{order.created_at?new Date(order.created_at).toLocaleString():''}</p></section><section><small>SHIPPING ADDRESS</small><h3>{addr.full_name||addr.name||''}</h3><p>{address||'No shipping address saved'}</p>{addr.phone&&<p>Phone: {addr.phone}</p>}</section></div>
  <form className="orderManage" onSubmit={save}><label>Order status<select name="status" value={status} onChange={e=>setStatus(e.target.value)}>{choices.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label><label>Carrier<input name="carrier" defaultValue={order.carrier||''} placeholder="e.g. USPS"/></label><label>Tracking number<input name="tracking_number" defaultValue={order.tracking_number||''}/></label><button type="submit" disabled={saving}>{saving?'SAVING…':'SAVE ORDER'}</button>{refundNote&&<p className="statusNote">Refund the customer in Stripe → Payments; stock returns automatically.</p>}</form>
  <div className="orderTotals"><div><span>Subtotal</span><b>${Number(order.subtotal||0).toFixed(2)}</b></div><div><span>Discount{order.coupon_code?` · ${order.coupon_code}`:''}</span><b>−${discount.toFixed(2)}</b></div><div><span>Shipping</span><b>${shipping.toFixed(2)}</b></div><div><span>Tax</span><b>${tax.toFixed(2)}</b></div><div><span>Stripe processing fee</span><b>−${fee.toFixed(2)}</b></div><div className="orderGrandTotal"><span>Customer paid</span><strong>${total.toFixed(2)}</strong></div><div><span>Net after Stripe</span><b>${(total-fee).toFixed(2)}</b></div><div><span>Product cost / COGS</span><b>−${cogs.toFixed(2)}</b></div><div className="orderGrandTotal"><span>Final profit (tax not counted)</span><strong>${orderProfit(order).toFixed(2)}</strong></div></div>
  <div className="orderPaymentRef"><small>PAYMENT REFERENCE</small><span>Stripe session: {order.stripe_session_id||'—'}</span><span>Payment intent: {order.stripe_payment_intent||'—'}</span></div><div className="editModalActions"><button type="button" onClick={onClose}>CLOSE</button></div></div></div>
}

const PRODUCT_CHIPS=[['all','All'],['soldout','Sold out'],['low','Low stock'],['hidden','Hidden']];
function ProductAdminTable({rows,stock={},onEdit,onDelete,onDuplicate,onAddStock}){
 const [q,setQ]=useState(''),[f,setF]=useState('all'),[adding,setAdding]=useState(null),[qty,setQty]=useState('1'),[busy,setBusy]=useState(false);
 if(!rows?.length)return <div className="kCard kEmpty">No products yet.</div>;
 const n=r=>stock[r.id]||0,custom=r=>r.sku===CUSTOM_SKU;
 const test={all:()=>true,soldout:r=>!custom(r)&&r.active!==false&&n(r)<=0,low:r=>!custom(r)&&r.active!==false&&n(r)>0&&n(r)<=Number(r.low_stock_threshold??2),hidden:r=>r.active===false};
 const term=q.trim().toLowerCase(),shown=rows.filter(r=>test[f](r)&&(!term||String(r.name||'').toLowerCase().includes(term)||String(r.sku||'').toLowerCase().includes(term)))
  // by SKU in natural order (k01, k02 … k10, k14); products without a SKU go last
  .sort((a,b)=>(!a.sku)-(!b.sku)||String(a.sku||'').localeCompare(String(b.sku||''),'en',{numeric:true,sensitivity:'base'}));
 const add=async r=>{setBusy(true);const ok=await onAddStock(r,qty);setBusy(false);if(ok)setAdding(null)};
 return <><div className="kChips">{PRODUCT_CHIPS.map(([k,label])=><button type="button" key={k} className="kChip" aria-pressed={f===k} onClick={()=>setF(k)}>{label}<i>{rows.filter(test[k]).length}</i></button>)}<input type="search" className="kSearch" placeholder="Search name or SKU" aria-label="Search products" value={q} onChange={e=>setQ(e.target.value)}/></div>
  {!shown.length?<div className="kCard kEmpty">{term?`No product matches “${q}”.`:'No products here.'}</div>:<div className="kPcards">{shown.map(r=>{const photo=mainPhoto(r.product_media);return <article className="kPcard" key={r.id}>{photo?<img src={photo} alt={r.name||'Product'}/>:<div className="kNoPhoto">No photo</div>}<div className="b">
   <h3>{r.name||''}</h3><div className="kNote">{r.sku||''}{r.category?` · ${r.category}`:''}</div>
   <div className="kMeta"><span><b>{r.price==null?'':money(r.price)}</b>{Number(r.compare_at_price||0)>Number(r.price||0)&&<s className="kNote"> {money(r.compare_at_price)}</s>}</span>{custom(r)?<span className="kPill grey">Made to order</span>:<StockPill n={n(r)}/>}</div>
   {r.active===false&&<div><span className="kPill grey">Hidden from the shop</span></div>}
   {adding===r.id?<div className="kInline"><input type="number" min="1" step="1" value={qty} autoFocus aria-label={`Bags received of ${r.name}`} onChange={e=>setQty(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add(r);if(e.key==='Escape')setAdding(null)}}/><button type="button" className="kBtn sm pri" disabled={busy} onClick={()=>add(r)}>{busy?'Adding…':'Add'}</button><button type="button" className="kBtn sm" onClick={()=>setAdding(null)}>Cancel</button></div>
   :<div className="kRow"><button type="button" className="kBtn sm" onClick={()=>onEdit(r)}>Edit</button>{!custom(r)&&<button type="button" className="kBtn sm" onClick={()=>{setQty('1');setAdding(r.id)}}>+ Stock</button>}{!custom(r)&&<button type="button" className="kBtn sm" onClick={()=>onDuplicate(r)}>Duplicate</button>}<button type="button" className="kBtn sm danger" onClick={()=>onDelete(r)}>Delete</button></div>}
  </div></article>})}</div>}</>
}

function ReviewList({rows,products,onToggle,onDelete}){
 const [f,setF]=useState('published');
 const shown=rows.filter(r=>f==='published'?r.approved:!r.approved);
 return <><div className="kChips"><button type="button" className="kChip" aria-pressed={f==='published'} onClick={()=>setF('published')}>Published<i>{rows.filter(r=>r.approved).length}</i></button><button type="button" className="kChip" aria-pressed={f==='hidden'} onClick={()=>setF('hidden')}>Hidden<i>{rows.filter(r=>!r.approved).length}</i></button></div>
  {shown.length?<div className="kCard">{shown.map(r=><div className="kMsg" key={r.id}><div className="grow"><Stars value={r.rating}/> <b>{r.author_name}</b> <span className="kNote">· {products.find(p=>p.id===r.product_id)?.name||r.products?.name||'Product'} · {shortDay(r.created_at)}</span><p>{r.body}</p></div><div className="kRow"><button type="button" className="kBtn sm" onClick={()=>onToggle(r)}>{r.approved?'Hide':'Publish'}</button><button type="button" className="kBtn sm danger" onClick={()=>onDelete(r)}>Delete</button></div></div>)}</div>:<div className="kCard kEmpty">No {f} reviews.</div>}</>
}

// One row per customer email, from paid orders; store accounts with no paid order are listed too.
function CustomerTable({profiles,orders,subscribers}){
 const [q,setQ]=useState('');
 const subs=new Set(subscribers.map(s=>String(s.email||'').toLowerCase())),by={},paidIds=new Set();
 orders.forEach(o=>{if(!PAID_STATUSES.includes(String(o.status).toLowerCase())||!o.email)return;if(o.customer_id)paidIds.add(o.customer_id);const k=o.email.toLowerCase(),c=by[k]??={email:o.email,name:'',city:'',orders:0,spent:0,last:null};c.orders++;c.spent+=Number(o.total||0);if(!c.last||new Date(o.created_at)>new Date(c.last.created_at)){const a=o.shipping_address||{};c.last=o;c.name=a.full_name||a.name||c.name;c.city=[a.city,a.state].filter(Boolean).join(', ')}});
 profiles.filter(r=>!['staff','admin','super_admin'].includes(r.role)&&!paidIds.has(r.id)).forEach(r=>{const k=String(r.email||'').toLowerCase();if(k&&by[k]){by[k].name||=r.full_name;return}by[k||'acct:'+r.id]={email:r.email||'',name:r.full_name||'',city:r.phone||'',orders:0,spent:0,last:null}});
 const term=q.trim().toLowerCase(),list=Object.values(by).filter(c=>!term||c.email.toLowerCase().includes(term)||String(c.name).toLowerCase().includes(term)).sort((a,b)=>b.spent-a.spent);
 return <><div className="kChips"><input type="search" className="kSearch" placeholder="Search name or email" aria-label="Search customers" value={q} onChange={e=>setQ(e.target.value)}/></div>
  {list.length?<div className="kTable"><table><thead><tr><th>Customer</th><th>Location</th><th className="num">Orders</th><th className="num">Spent</th><th>Last order</th><th>Newsletter</th></tr></thead><tbody>{list.map(c=><tr key={c.email||c.name}><td className="kWho"><b>{c.name||c.email||'—'}</b>{c.name&&c.email&&<span>{c.email}</span>}</td><td>{c.city||'—'}</td><td className="num">{c.orders}</td><td className="num"><b>{money(c.spent)}</b></td><td>{c.last?`#${c.last.order_number||''} · ${shortDay(c.last.created_at)}`:'—'}</td><td>{subs.has(c.email.toLowerCase())?<span className="kPill green">Subscribed</span>:<span className="kPill grey">No</span>}</td></tr>)}</tbody></table></div>:<div className="kCard kEmpty">{term?'No customer matches.':'No customers yet.'}</div>}</>
}

// Photos of one product, in shop order. Changes are saved at once (they don't wait for SAVE PRODUCT).
function PhotoManager({product,setNotice,setAsk,onChanged}){
 const [media,setMedia]=useState(null),[busy,setBusy]=useState(''),[picked,setPicked]=useState([]);const fileRef=useRef(null);
 const reload=async()=>{const {data,error}=await supabase.from('product_media').select('id,url,media_type,sort_order').eq('product_id',product.id).order('sort_order',{ascending:true});if(error){setNotice(error.message);return}setMedia(data||[])};
 useEffect(()=>{reload()},[product.id]);
 const run=async(label,fn)=>{setBusy(label);try{await fn();onChanged()}catch(e){setNotice(`Photos: ${e?.message||String(e)}`)}finally{await reload();setBusy('')}};
 // Writes sort_order 0..n-1 in the new order; only rows whose position changed are updated.
 const reorder=list=>run('Saving order…',async()=>{for(let i=0;i<list.length;i++){if(list[i].sort_order===i)continue;const {error}=await supabase.from('product_media').update({sort_order:i}).eq('id',list[i].id);if(error)throw error}});
 const move=(i,to)=>{const list=[...media];const [m]=list.splice(i,1);list.splice(to,0,m);reorder(list)};
 const remove=m=>setAsk({text:media.length===1?'Delete the only photo? The product will show without a photo until you upload one.':'Delete this photo from the product?',yes:'DELETE PHOTO',run:()=>run('Deleting…',async()=>{const {error}=await supabase.from('product_media').delete().eq('id',m.id);if(error)throw error;const path=mediaPath(m.url);if(path){const {error:se}=await supabase.storage.from(MEDIA_BUCKET).remove([path]);if(se)setNotice(`Photo removed from the product, but the file stayed in storage: ${se.message}`)}const rest=media.filter(x=>x.id!==m.id);for(let i=0;i<rest.length;i++){if(rest[i].sort_order!==i){const {error:oe}=await supabase.from('product_media').update({sort_order:i}).eq('id',rest[i].id);if(oe)throw oe}}})});
 const upload=()=>run('Uploading…',async()=>{const start=media.length?Math.max(...media.map(m=>Number(m.sort_order)||0))+1:0;await uploadMedia(product.id,picked,start,setBusy);setPicked([]);if(fileRef.current)fileRef.current.value='';setNotice(`${picked.length} file${picked.length===1?'':'s'} added to "${product.name}".`)});
 return <section className="photoManager"><div className="photoManagerHead"><small>PHOTOS · the first one is the main photo</small>{busy&&<b>{busy}</b>}</div>
  {media===null?<p>Loading photos…</p>:!media.length?<p className="fieldWarn">This product has no photos yet.</p>:<div className="photoGrid">{media.map((m,i)=><figure key={m.id} className={i===0?'isMain':''}>{String(m.media_type||'image').startsWith('video')?<video src={m.url} muted/>:<img src={m.url} alt={`Photo ${i+1}`}/>}<figcaption>{i===0?'MAIN':`#${i+1}`}</figcaption><div className="photoActions"><button type="button" disabled={!!busy||i===0} onClick={()=>move(i,i-1)} aria-label="Move left">◀</button><button type="button" disabled={!!busy||i===media.length-1} onClick={()=>move(i,i+1)} aria-label="Move right">▶</button>{i>0&&<button type="button" disabled={!!busy} onClick={()=>move(i,0)}>MAKE MAIN</button>}<button type="button" className="dangerBtn" disabled={!!busy} onClick={()=>remove(m)}>DELETE</button></div></figure>)}</div>}
  <div className="photoUpload"><label className="caField">Add photos / video<input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple onChange={e=>setPicked(Array.from(e.target.files||[]))}/></label><FilePreview files={picked}/>{picked.length>0&&<button type="button" disabled={!!busy} onClick={upload}>UPLOAD {picked.length} FILE{picked.length===1?'':'S'}</button>}</div>
 </section>;
}

function CouponFields({r={}}){
 return <><Field label="Code *" name="code" placeholder="e.g. KARIA10" defaultValue={r.code} required/><Field label="Percent off (%)" name="percent_off" type="number" step="0.01" min="0" max="100" defaultValue={r.percent_off??''}/><Field label="OR fixed amount off ($)" name="amount_off" type="number" step="0.01" min="0" defaultValue={r.amount_off??''}/><Field label="Last day (optional)" name="ends_at" type="date" defaultValue={localDay(r.ends_at)}/><Field label="Max uses (empty = unlimited)" name="max_uses" type="number" step="1" min="1" defaultValue={r.max_uses??''}/></>;
}

function BrandTable({rows,products=[],onSave,onToggle}){
 const [editing,setEditing]=useState(null);
 if(!rows?.length)return <p className="kNote">No brands yet.</p>;
 const save=async(e,r)=>{e.preventDefault();if(await onSave(r,Object.fromEntries(new FormData(e.currentTarget))))setEditing(null)};
 return <>{rows.map(r=>editing===r.id?<form className="kLine kForm" key={r.id} onSubmit={e=>save(e,r)}><Field label="Brand name *" name="name" defaultValue={r.name} required/><label className="caField">Story / description<textarea name="story" rows={3} defaultValue={r.story||''}/></label><div className="kRow"><button className="kBtn sm pri">Save</button><button type="button" className="kBtn sm" onClick={()=>setEditing(null)}>Cancel</button></div></form>
  :<div className="kLine" key={r.id}><div className="grow"><b>{r.name}</b><span className="kNote">{plural(products.filter(p=>p.brand_id===r.id).length,'active product')}{r.story?` · ${r.story}`:''}</span></div>{r.active===false?<span className="kPill grey">Inactive</span>:<span className="kPill green">Active</span>}<div className="kRow"><button type="button" className="kBtn sm" onClick={()=>setEditing(r.id)}>Edit</button><button type="button" className="kBtn sm" onClick={()=>onToggle(r)}>{r.active===false?'Activate':'Deactivate'}</button></div></div>)}</>;
}

function ExpenseTable({rows,onSave,onDelete}){
 const [editing,setEditing]=useState(null);
 if(!rows?.length)return <p className="kNote">No expenses in this period.</p>;
 const save=async(e,r)=>{e.preventDefault();if(await onSave(r,Object.fromEntries(new FormData(e.currentTarget))))setEditing(null)};
 return <div className="kTable flat"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th><th>Actions</th></tr></thead><tbody>{rows.map(r=>editing===r.id?<tr key={r.id}><td colSpan={5}><form className="inlineEdit" onSubmit={e=>save(e,r)}><Field label="Date" name="expense_date" type="date" defaultValue={r.expense_date||localDay(r.created_at)}/><Field label="Description *" name="description" defaultValue={r.description||''} required/><Field label="Category" name="category" defaultValue={r.category||''}/><Field label="Amount ($) *" name="amount" type="number" step="0.01" min="0.01" defaultValue={r.amount??''} required/><div className="kRow rowActionButtons"><button className="kBtn sm pri">Save</button><button type="button" className="kBtn sm" onClick={()=>setEditing(null)}>Cancel</button></div></form></td></tr>:<tr key={r.id}><td>{r.expense_date?shortDay(`${r.expense_date}T12:00:00`):shortDay(r.created_at)}</td><td><b>{r.description||'—'}</b>{r.vendor&&<div className="kNote">{r.vendor}</div>}</td><td>{r.category?<span className="kPill grey">{r.category}</span>:''}</td><td className="num"><b>{money(r.amount)}</b></td><td><div className="kRow"><button type="button" className="kBtn sm" onClick={()=>setEditing(r.id)}>Edit</button><button type="button" className="kBtn sm danger" onClick={()=>onDelete(r)}>Delete</button></div></td></tr>)}</tbody></table></div>;
}

function CouponTable({rows,uses={},onSave,onToggle,onDelete}){
 const [editing,setEditing]=useState(null);
 if(!rows?.length)return <div className="kCard kEmpty">No coupons yet.</div>;
 const save=async(e,r)=>{e.preventDefault();if(await onSave(r,Object.fromEntries(new FormData(e.currentTarget))))setEditing(null)};
 return <div className="kGrid g3">{rows.map((r,i)=>{const used=uses[String(r.code||'').toUpperCase()]||0,max=r.max_uses==null?null:Number(r.max_uses),full=max!=null&&used>=max,ended=r.ends_at&&new Date(r.ends_at)<new Date();
  const [state,tone]=r.active===false?['Paused','grey']:full?['Limit reached','red']:ended?['Ended','red']:['Active','green'];
  if(editing===r.id)return <form className="kCard kForm" key={r.id||i} onSubmit={e=>save(e,r)}><h2>Edit {r.code}</h2><div className="kFields"><CouponFields r={r}/></div><div className="kRow"><button className="kBtn sm pri">Save</button><button type="button" className="kBtn sm" onClick={()=>setEditing(null)}>Cancel</button></div></form>;
  return <div className="kCard" key={r.id||i}><div className="kRow"><b className="kCode">{r.code}</b><span className={`kPill ${tone}`}>{state}</span></div>
   <p className="kSub">{r.percent_off?`${Number(r.percent_off)}% off`:r.amount_off?`${money(r.amount_off)} off`:'—'}{r.starts_at?` · from ${shortDay(r.starts_at)}`:''} · {r.ends_at?`last day ${shortDay(r.ends_at)}`:'no end date'}</p>
   {max!=null&&<div className="kBar" aria-hidden="true"><i style={{width:`${Math.min(100,used/Math.max(max,1)*100)}%`}}/></div>}
   <p className="kNote">{used} used{max!=null?` of ${max}`:' · no limit'}</p>
   <div className="kRow"><button type="button" className="kBtn sm" onClick={()=>setEditing(r.id)}>Edit</button><button type="button" className="kBtn sm" onClick={()=>onToggle(r)}>{r.active===false?'Activate':'Pause'}</button><button type="button" className="kBtn sm danger" onClick={()=>onDelete(r)}>Delete</button></div></div>})}</div>
}

function DataTable({rows,actions}){if(!rows?.length)return <div className="panel empty">No records yet.</div>;const keys=Object.keys(rows[0]).filter(k=>!['metadata','after_data','before_data'].includes(k)).slice(0,7);return <div className="tableWrap"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}{actions&&<th>ACTIONS</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{keys.map(k=><td key={k}>{typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k]??'')}</td>)}{actions&&<td className="actionsCell">{actions(r)}</td>}</tr>)}</tbody></table></div>}

export default Admin;
