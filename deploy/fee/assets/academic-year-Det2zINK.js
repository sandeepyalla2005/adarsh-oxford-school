function o(t=new Date){const n=t.getMonth()>=3?t.getFullYear():t.getFullYear()-1,a=String((n+1)%100).padStart(2,"0");return`${n}-${a}`}export{o as g};
