/* Commercial configuration. Prices and payment details are the founder's to set;
   change them here and nowhere else.

   Why an annual licence key rather than card subscriptions: card-on-file recurring
   billing is not a realistic default for this audience. Easypaisa, JazzCash, Raast
   and plain bank transfer are. A key issued after payment keeps the product
   local-first, needs no customer-data backend, and no card details ever reach us. */
export type PlanId='free'|'pro'|'accountant';
export type Plan={
 id:PlanId;name:string;priceAnnual:number;priceLabel:string;sub:string;
 points:string[];cta:string;
};
export const PLANS:Plan[]=[
 {id:'free',name:'Free',priceAnnual:0,priceLabel:'PKR 0',sub:'Keep records, see an estimate',
  cta:'Included',
  points:['One account, one statement import a month (up to 60 rows)','Income, expense and invoice records','Tax estimate with every rule and source shown','CSV exports of your own records, always']},
 {id:'pro',name:'Pro',priceAnnual:2400,priceLabel:'PKR 2,400 / year',sub:'PKR 200 a month, billed once a year',
  cta:'Get a Pro key',
  points:['Unlimited statement imports, up to 10 accounts','Duplicate and own-transfer detection','Balance reconciliation that shows what is unexplained','Filing Pack: a source-linked package for your accountant or for IRIS','A year of rule updates for the tax years you file']},
 {id:'accountant',name:'Accountant',priceAnnual:14400,priceLabel:'PKR 14,400 / year',sub:'For practices filing on behalf of clients',
  cta:'Talk to us',
  points:['Everything in Pro, 40 accounts','A separate encrypted workspace per client','Filing Pack built for review, with the unresolved list on the front page','Named support channel during filing season']}
];
/** First-year launch price, honouring the original PKR 1,500 hypothesis.
    Set to 0 to withdraw the offer. */
export const LAUNCH_PRICE=1500;
export const LAUNCH_NOTE='Launch price for the first 200 keys: PKR 1,500 for the first year, then PKR 2,400 on renewal.';

/* Fill these in before taking money. Leave a line as an empty string to hide it. */
export const PAYMENT_RAILS=[
 {label:'Easypaisa',value:''},
 {label:'JazzCash',value:''},
 {label:'Raast / IBAN',value:''},
 {label:'Bank account',value:''}
];
export const SUPPORT_EMAIL='';
export const BUY_URL='';
/** Working days we promise ourselves to turn a payment into a key. */
export const KEY_TURNAROUND='one working day';
export const REFUND_WINDOW_DAYS=14;
