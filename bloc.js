(()=>{
const N=10,$=s=>document.querySelector(s);
const boardEl=$('#board'),trayEl=$('#tray'),scoreEl=$('#score'),bestEl=$('#best'),toastEl=$('#toast'),overEl=$('#over');

/* ---------- Shapes ---------- */
const BASES=[["#"],["##"],["###"],["####"],["#####"],["##","##"],["###","###","###"],["###","###"],["##","#."],["#..","#..","###"],["###",".#."],[".##","##."],["#.","#.","##"]];
const parse=b=>{const a=[];b.forEach((row,r)=>[...row].forEach((ch,c)=>{if(ch==='#')a.push([r,c])}));return a};
const norm=a=>{const mr=Math.min(...a.map(x=>x[0])),mc=Math.min(...a.map(x=>x[1]));return a.map(([r,c])=>[r-mr,c-mc]).sort((p,q)=>p[0]-q[0]||p[1]-q[1])};
const rot=a=>norm(a.map(([r,c])=>[c,-r])),flip=a=>norm(a.map(([r,c])=>[r,-c]));
const FAM=BASES.map(b=>{let a=norm(parse(b));const seen=new Set(),out=[];for(let f=0;f<2;f++){for(let k=0;k<4;k++){const key=JSON.stringify(a);if(!seen.has(key)){seen.add(key);out.push(a)}a=rot(a)}a=flip(a)}return out});

/* ---------- State ---------- */
let grid=new Array(N*N).fill(-1),pieces=[],score=0,best=0,bestAtStart=0,combo=0,over=false,busy=false;
let selected=null,pending=null,drag=null,lastKey=null,lastPT='mouse',M=null,gen=0,pid=0,rng=Math.random,seed=0,toastT=0;
const mb=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

/* ---------- Board DOM ---------- */
const cells=[];
for(let i=0;i<N*N;i++){const d=document.createElement('div');d.className='cell';d.dataset.i=i;d.setAttribute('role','gridcell');boardEl.appendChild(d);cells.push(d)}
const render=()=>{for(let i=0;i<N*N;i++)cells[i].className='cell'+(grid[i]>=0?' f c'+grid[i]:'')};

/* ---------- Pieces ---------- */
function mk(cells){let h=0,w=0;cells.forEach(([r,c])=>{h=Math.max(h,r+1);w=Math.max(w,c+1)});return{cells,h,w,color:Math.floor(rng()*8),id:++pid}}
function pickPiece(){
  const lvl=Math.min(score/1500,1);
  const w=FAM.map(f=>{const n=f[0].length;return n===1?.25:n<=3?1:n===4?1:n===5?.6+lvl:n===6?.7+.6*lvl:.4+lvl*.8});
  let t=rng()*w.reduce((a,b)=>a+b),i=0;
  while(i<w.length-1&&(t-=w[i])>0)i++;
  const f=FAM[i];return mk(f[Math.floor(rng()*f.length)]);
}
function canPlace(p,r,c){return p.cells.every(([dr,dc])=>{const y=r+dr,x=c+dc;return y>=0&&y<N&&x>=0&&x<N&&grid[y*N+x]<0})}
function anyFit(p){for(let r=0;r<=N-p.h;r++)for(let c=0;c<=N-p.w;c++)if(canPlace(p,r,c))return true;return false}
function newSet(){
  for(let t=0;t<40;t++){const s=[pickPiece(),pickPiece(),pickPiece()];if(s.some(anyFit))return s}
  return [mk(FAM[0][0]),mk(FAM[0][0]),mk(FAM[0][0])]; // fair fallback
}
function pieceEl(p,sz,gp){
  const d=document.createElement('div');d.className='pc';
  d.style.gridTemplateColumns=`repeat(${p.w},${sz})`;d.style.gridAutoRows=sz;d.style.gap=gp;
  p.cells.forEach(([r,c])=>{const b=document.createElement('div');b.className='b c'+p.color;b.style.gridArea=`${r+1}/${c+1}`;d.appendChild(b)});
  return d;
}
function renderTray(){
  trayEl.innerHTML='';
  pieces.forEach((p,i)=>{
    const s=document.createElement('div');
    s.className='slot'+(p?'':' empty')+(selected===i?' sel':'');
    s.dataset.i=i;s.setAttribute('role','img');s.setAttribute('aria-label',p?`Piece ${i+1}`:'Used piece slot');
    if(p)s.appendChild(pieceEl(p,'var(--m)','2px'));
    trayEl.appendChild(s);
  });
}

/* ---------- Lines & preview ---------- */
function full(g){
  const R=[],C=[];
  for(let r=0;r<N;r++){let ok=true;for(let c=0;c<N;c++)if(g[r*N+c]<0){ok=false;break}if(ok)R.push(r)}
  for(let c=0;c<N;c++){let ok=true;for(let r=0;r<N;r++)if(g[r*N+c]<0){ok=false;break}if(ok)C.push(c)}
  return[R,C];
}
function lineSet(R,C){const s=new Set();R.forEach(r=>{for(let j=0;j<N;j++)s.add(r*N+j)});C.forEach(c=>{for(let j=0;j<N;j++)s.add(j*N+c)});return s}
function preview(p,r,c){
  const ok=!!p&&canPlace(p,r,c),k=ok?p.id+':'+r+','+c:'';
  if(k===lastKey)return ok;
  lastKey=k;render();
  if(!ok)return false;
  const g=grid.slice();
  p.cells.forEach(([dr,dc])=>{const i=(r+dr)*N+c+dc;g[i]=p.color;cells[i].className='cell ghost c'+p.color});
  const[R,C]=full(g);lineSet(R,C).forEach(i=>cells[i].classList.add('will'));
  return true;
}
function clearPreview(){if(lastKey!==null){lastKey=null;render()}}
const anchor=(p,i)=>[Math.max(0,Math.min(N-p.h,Math.floor(i/N)-(p.h>>1))),Math.max(0,Math.min(N-p.w,i%N-(p.w>>1)))];

/* ---------- Scoring & feedback ---------- */
function addScore(n){
  score+=n;if(score>best)best=score;
  scoreEl.textContent=score;bestEl.textContent=best;
  scoreEl.classList.remove('bump');void scoreEl.offsetWidth;scoreEl.classList.add('bump');
}
function toast(msg){toastEl.textContent=msg;toastEl.classList.remove('show');void toastEl.offsetWidth;toastEl.classList.add('show')}
function shake(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake')}

/* ---------- Placement ---------- */
function place(i,r,c){
  const p=pieces[i],g=gen;
  busy=true;selected=null;pending=null;lastKey=null;
  p.cells.forEach(([dr,dc])=>{grid[(r+dr)*N+c+dc]=p.color});
  render();
  p.cells.forEach(([dr,dc])=>cells[(r+dr)*N+c+dc].classList.add('pop'));
  pieces[i]=null;renderTray();
  let pts=p.cells.length;
  const[R,C]=full(grid),n=R.length+C.length,set=lineSet(R,C);
  if(n){
    combo++;
    const bonus=n*n*10+(combo-1)*10;pts+=bonus;
    toast(`+${bonus}`+(n>1?` · ${n} lines`:'')+(combo>1?` · Combo x${combo}`:''));
    set.forEach(k=>cells[k].classList.add('clr'));
  }else combo=0;
  addScore(pts);
  const finish=()=>{
    if(g!==gen)return;
    if(n){
      set.forEach(k=>{grid[k]=-1});render();
      if(grid.every(v=>v<0)){addScore(100);toast('Perfect clear! +100')}
    }
    if(pieces.every(x=>!x))pieces=newSet();
    renderTray();busy=false;
    if(!pieces.some(x=>x&&anyFit(x)))gameOver();
  };
  n?setTimeout(finish,340):finish();
}
function gameOver(){
  over=true;
  $('#finalScore').textContent=score;
  $('#newBest').hidden=!(score>0&&score>bestAtStart);
  overEl.hidden=false;$('#again').focus();
}

/* ---------- Game control ---------- */
function startGame(s){
  gen++;seed=s;rng=mb(s);
  grid.fill(-1);score=0;combo=0;over=false;busy=false;selected=null;pending=null;lastKey=null;bestAtStart=best;
  if(drag){if(drag.fl)drag.fl.remove();drag=null}
  overEl.hidden=true;toastEl.classList.remove('show');
  scoreEl.textContent=0;bestEl.textContent=best;
  pieces=newSet();render();renderTray();
}
const fresh=()=>(Math.random()*1e9)|0;
$('#restart').onclick=()=>startGame(seed);
$('#newgame').onclick=()=>startGame(fresh());
$('#again').onclick=()=>startGame(fresh());

/* ---------- Drag & drop ---------- */
function measure(){
  const a=cells[0].getBoundingClientRect(),b=cells[1].getBoundingClientRect();
  M={x:a.left,y:a.top,px:a.width,pitch:b.left-a.left};
}
function moveDrag(e){
  const p=pieces[drag.i],W=p.w*M.pitch,H=p.h*M.pitch;
  const left=e.clientX-W/2,top=drag.touch?e.clientY-H-44:e.clientY-H/2;
  drag.fl.style.transform=`translate(${left}px,${top}px)`;
  const c=Math.round((left-M.x)/M.pitch),r=Math.round((top-M.y)/M.pitch);
  drag.pos=[r,c];
  drag.fl.classList.toggle('bad',!preview(p,r,c));
}
function endDrag(){
  const d=drag;drag=null;if(!d)return null;
  if(d.fl)d.fl.remove();
  trayEl.querySelectorAll('.drag').forEach(x=>x.classList.remove('drag'));
  return d;
}
window.addEventListener('pointerdown',e=>{lastPT=e.pointerType},true);
trayEl.addEventListener('pointerdown',e=>{
  const s=e.target.closest('.slot');if(!s||busy||over||drag)return;
  const i=+s.dataset.i;if(!pieces[i])return;
  e.preventDefault();measure();
  drag={i,x:e.clientX,y:e.clientY,moved:false,touch:e.pointerType!=='mouse',id:e.pointerId,fl:null,pos:null};
});
window.addEventListener('pointermove',e=>{
  if(drag){
    if(e.pointerId!==drag.id)return;
    if(!drag.moved){
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
      drag.moved=true;selected=drag.i;pending=null;
      const fl=pieceEl(pieces[drag.i],M.px+'px',(M.pitch-M.px)+'px');fl.classList.add('float');
      document.body.appendChild(fl);drag.fl=fl;
      trayEl.children[drag.i].classList.add('drag');
    }
    moveDrag(e);
  }else if(selected!=null&&e.pointerType==='mouse'&&!busy&&!over){
    const t=e.target.closest&&e.target.closest('.cell'),p=pieces[selected];
    if(t&&p){const[r,c]=anchor(p,+t.dataset.i);preview(p,r,c)}else clearPreview();
  }
});
window.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const d=endDrag();
  if(d.moved){
    const p=pieces[d.i];
    if(d.pos&&canPlace(p,d.pos[0],d.pos[1]))place(d.i,d.pos[0],d.pos[1]);
    else{selected=null;clearPreview();renderTray();shake(trayEl.children[d.i])}
  }else{
    selected=selected===d.i?null:d.i;pending=null;clearPreview();renderTray();
  }
});
window.addEventListener('pointercancel',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  endDrag();clearPreview();
});
document.addEventListener('touchmove',e=>{if(drag)e.preventDefault()},{passive:false});
trayEl.addEventListener('contextmenu',e=>e.preventDefault());
boardEl.addEventListener('pointerleave',()=>{if(!drag)clearPreview()});

/* Tap-to-place: tap a piece, then tap the board (touch: first tap previews, second confirms) */
boardEl.addEventListener('click',e=>{
  if(busy||over||selected==null)return;
  const t=e.target.closest('.cell'),p=pieces[selected];if(!t||!p)return;
  const[r,c]=anchor(p,+t.dataset.i),k=r+','+c;
  if(!canPlace(p,r,c)){pending=null;clearPreview();shake(boardEl);return}
  if(lastPT==='mouse'||pending===k)place(selected,r,c);
  else{pending=k;preview(p,r,c)}
});

startGame(fresh());
})();
