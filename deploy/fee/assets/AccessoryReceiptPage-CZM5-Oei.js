import{o as x,a as h,r as i,s as y,j as e,B as o}from"./fee-CoONG733.js";import{A as j}from"./AccessoryReceipt-CqCeckiE.js";import{L as b}from"./loader-circle-C5VTL0O7.js";import{A as w}from"./arrow-left-9zENLjbs.js";import"./card-feHHp_kJ.js";import"./printer-5AEvV_MH.js";import"./download-idHwiYYD.js";function q(){const{id:a}=x(),r=h(),[n,l]=i.useState(null),[p,d]=i.useState(!0),m=i.useRef(null);i.useEffect(()=>{a&&f()},[a]);const f=async()=>{try{const{data:s,error:c}=await y.from("accessory_transactions").select("*").or(`id.eq.${a},receipt_no.eq.${a}`);if(c)throw c;if(!s||s.length===0)throw new Error("Receipt not found");const t=s[0];l({receiptNo:t.receipt_no,date:t.transaction_date,studentName:t.student_name,className:t.class_name,accessoryType:t.accessory_type,quantity:t.quantity,price:t.price,totalAmount:t.total_amount,amountPaid:t.amount_paid,balance:t.balance,paymentMethod:t.payment_method})}catch(s){console.error(s)}finally{d(!1)}},u=()=>{window.print()};return p?e.jsx("div",{className:"flex h-screen items-center justify-center",children:e.jsx(b,{className:"h-8 w-8 animate-spin text-primary"})}):n?e.jsxs("div",{className:"min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex flex-col items-center",children:[e.jsxs("div",{className:"w-full max-w-md mb-6 flex justify-between items-center print:hidden",children:[e.jsxs(o,{variant:"outline",onClick:()=>r(-1),children:[e.jsx(w,{className:"mr-2 h-4 w-4"})," Back"]}),e.jsxs("div",{className:"text-sm text-muted-foreground",children:["Receipt #",n.receiptNo]})]}),e.jsx("div",{className:"printable-area w-full flex justify-center",children:e.jsx(j,{ref:m,data:n,onPrint:u})}),e.jsx("style",{children:`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 2cm;
          }
          /* Hide the print button inside the component when printing */
          button {
             display: none !important;
          }
        }
      `})]}):e.jsxs("div",{className:"flex h-screen flex-col items-center justify-center gap-4",children:[e.jsx("h2",{className:"text-xl font-bold",children:"Receipt Not Found"}),e.jsx(o,{onClick:()=>r("/accessories"),children:"Go Back"})]})}export{q as default};
