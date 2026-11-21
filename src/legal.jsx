// KARIA V7.49 — Shipping, Returns & Refunds, Privacy and Terms pages.
// NOTE FOR THE OWNERS: this is a plain-English starting draft, not legal advice.
// Have it reviewed by a lawyer before relying on it, and update "Last updated" whenever you change it.

export const LEGAL_LINKS=[['Shipping','/shipping'],['Returns & Refunds','/returns'],['Privacy','/privacy'],['Terms','/terms']];

const UPDATED='November 21, 2026';

function pages(info){
 const email=info?.contact_email;
 const contact=email?<>by email at <a href={`mailto:${email}`}>{email}</a> or through our <a href="/contact">contact page</a></>:<>through our <a href="/contact">contact page</a></>;
 const days=Number(info?.returns_days)>0?Number(info.returns_days):14;
 return {
  shipping:{small:'ORDERS & DELIVERY',title:'Shipping.',sections:[
   ['Where we ship',<p>We ship within the United States only.</p>],
   ['Shipping cost',<p>A flat shipping rate is added at checkout and shown before you pay. Any free-shipping offer is shown in your bag before you pay. All prices are in US dollars.</p>],
   ['When your order ships',<p>Every KARIA bag is handmade. Bags in stock are shipped as soon as they are packed. Custom and made-to-order bags are crocheted after you order, so they take longer; the estimated time is shown when you order.</p>],
   ['Tracking',<p>When your order ships, you can see its status and tracking number (when available) on the My orders page.</p>],
   ['Problems with delivery',<p>If your package is late, lost or arrives damaged, contact us {contact} and we will help.</p>],
  ]},
  returns:{small:'ORDERS & DELIVERY',title:'Returns & Refunds.',sections:[
   ['Return window',<p>You can return a bag within {days} days from delivery.</p>],
   ['Conditions',<ul><li>The item must be unused and in its original condition.</li><li>Custom and made-to-order bags are final sale and cannot be returned, unless they arrive damaged or wrong.</li></ul>],
   ['How to start a return',<p>Go to <a href="/orders">My orders</a> and press Request a return, or contact us {contact} with your order number. We will reply with the return label and instructions. Please do not send items back before your return is approved.</p>],
   ['Return shipping',<p>The buyer pays return shipping, unless the item arrived damaged or we sent the wrong item.</p>],
   ['Refunds',<p>Once we receive and inspect the item, we refund it to your original payment method. The refund usually appears within 5–10 business days after inspection, depending on your bank.</p>],
  ]},
  privacy:{small:'YOUR DATA',title:'Privacy Policy.',sections:[
   ['Who we are',<p>This store is run by Karia Shop LLC, a Delaware limited liability company ("KARIA", "we"). You can reach us {contact}.</p>],
   ['What we collect',<ul><li>Your name, email and shipping address when you create an account or place an order.</li><li>Your order history.</li><li>Messages you send through the contact form.</li><li>Your email if you join our newsletter.</li></ul>],
   ['Why we use it',<p>To process and ship your orders, answer your messages, show you your orders, send the newsletter you asked for, and keep the store secure. We do not sell your personal data.</p>],
   ['Payments',<p>Payments are processed by Stripe. Your full card number goes directly to Stripe; KARIA never sees or stores it.</p>],
   ['Service providers',<p>We use Stripe (payments), Supabase (accounts and order data) and Vercel (website hosting). They handle data only to provide their service to us.</p>],
   ['Cookies and local storage',<p>We use your browser's storage only to remember your bag and keep you signed in. We do not use advertising cookies.</p>],
   ['Your rights',<p>You can ask us what personal data we have about you, ask us to correct or delete it, and unsubscribe from the newsletter at any time. California residents have these rights under the CCPA, including the right not to be treated differently for using them. To make a request, contact us {contact}. We may need to keep some order records when the law requires it.</p>],
   ['Children',<p>Our store is not directed to children under 13, and we do not knowingly collect their data.</p>],
   ['Changes',<p>If we change this policy, we will update the date at the top of this page.</p>],
  ]},
  terms:{small:'THE RULES',title:'Terms of Service.',sections:[
   ['About these terms',<p>This website is operated by Karia Shop LLC, a Delaware limited liability company. By using the site or placing an order, you agree to these terms.</p>],
   ['Using the site',<p>Please use the site only for lawful purposes and do not try to interfere with it, access other people's accounts or copy its content and photos without permission.</p>],
   ['Accounts',<p>You are responsible for keeping your sign-in details safe and for activity on your account. Tell us right away if you think someone else is using it.</p>],
   ['Prices and errors',<p>Prices are in US dollars. We try to keep prices and descriptions accurate, but mistakes can happen. If an item is listed at a wrong price, we may cancel the order and refund you in full.</p>],
   ['Orders',<p>Your order is accepted when payment is confirmed. We may cancel an order (with a full refund) if an item is no longer available, if there is a pricing error or if we suspect fraud.</p>],
   ['Handmade products',<p>Every bag is crocheted by hand, so small differences in color, size and texture from the photos are normal and are not defects. Screen settings can also change how colors look.</p>],
   ['Shipping and returns',<p>See our <a href="/shipping">Shipping</a> and <a href="/returns">Returns &amp; Refunds</a> pages.</p>],
   ['Limitation of liability',<p>To the extent the law allows, KARIA is not liable for indirect or consequential damages, and our total liability for any order is limited to the amount you paid for it.</p>],
   ['Governing law',<p>These terms are governed by the laws of the State of Delaware, USA.</p>],
   ['Contact',<p>Questions about these terms? Contact us {contact}.</p>],
  ]},
 };
}

export function LegalPage({Header,kind,info={}}){
 const page=pages(info||{})[kind]||pages(info||{}).terms;
 return <div className="catalogPage">{Header}<main className="catalogMain narrowMain">
  <div className="catalogHero"><small>{page.small}</small><h1>{page.title}</h1><p>Last updated: {UPDATED}</p></div>
  {/* a div, not <nav>: style.css turns every <nav> into the phone menu */}
  <div className="legalNav" role="navigation" aria-label="Store policies">{LEGAL_LINKS.map(([t,h])=><a key={h} href={h} aria-current={h==='/'+kind?'page':undefined}>{t}</a>)}</div>
  <div className="aboutText legalText">{page.sections.map(([h,body])=><section key={h}><h2>{h}</h2>{body}</section>)}</div>
  <div className="legalHelp"><p>Still have a question? We are happy to help.</p><a className="cta" href="/contact">Contact us</a></div>
 </main></div>;
}
