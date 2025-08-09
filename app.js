// Simple PWA with daily lessons + spaced repetition (Leitner-like)
let DB = { boxes: {}, seen: {}, today: null };

const fmtDate = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
const todayStr = fmtDate(new Date());

async function loadLessons(){
  const res = await fetch('lessons.json');
  return await res.json();
}

function getState(){
  try{ return JSON.parse(localStorage.getItem('persian_state')) || DB; }catch(e){ return DB; }
}
function saveState(state){ localStorage.setItem('persian_state', JSON.stringify(state)); }

function nextInterval(days){
  // 1 -> 2 -> 4 -> 7 -> 14
  if(days>=14) return 21;
  if(days>=7) return 14;
  if(days>=4) return 7;
  if(days>=2) return 4;
  if(days>=1) return 2;
  return 1;
}

function scheduleItem(state, key, again=false){
  const t = new Date();
  let due = fmtDate(t);
  if(!again){
    const prev = state.seen[key]?.interval || 0;
    const ni = prev ? nextInterval(prev) : 1;
    const next = new Date();
    next.setDate(next.getDate() + ni);
    due = fmtDate(next);
    state.seen[key] = { interval: ni, due };
  } else {
    const next = new Date(); next.setDate(next.getDate() + 1);
    due = fmtDate(next);
    state.seen[key] = { interval: 1, due };
  }
  saveState(state);
}

function isDue(state, key){
  const rec = state.seen[key];
  if(!rec) return true; // unseen is due
  return rec.due <= todayStr;
}

function cardHTML(item, key){
  return `<div class="card">
    <div class="fa">${item.fa}</div>
    <div><strong>${item.tr}</strong> — ${item.pl}</div>
    <div class="audio">
      <audio id="a_${key}" src="assets/${item.audio}" preload="none" controls></audio>
      <span class="muted">Plik audio: assets/${item.audio}</span>
    </div>
    <div class="row">
      <button data-key="${key}" class="good">Znam</button>
      <button data-key="${key}" class="again secondary">Jeszcze raz</button>
    </div>
  </div>`;
}

function renderLesson(lesson){
  const c = document.getElementById('lessonContainer');
  c.innerHTML = lesson.items.map((it, idx)=> cardHTML(it, `${lesson.id}_${idx}`)).join('');
  bindButtons();
}

function renderAll(lessons){
  const wrap = document.getElementById('allLessons');
  wrap.innerHTML = lessons.map(l => {
    const items = l.items.map((it, idx)=> `<div class="card"><div class="fa">${it.fa}</div><div><strong>${it.tr}</strong> — ${it.pl}</div></div>`).join('');
    return `<div class="lessonGroup"><div class="row"><strong>${l.title}</strong><span class="pill">${l.items.length} zwrotów</span></div>${items}</div>`;
  }).join('');
}

function renderReview(lessons, state){
  const due = [];
  lessons.forEach(l => l.items.forEach((it, idx)=>{
    const key = `${l.id}_${idx}`;
    if(isDue(state, key)) due.push({it, key});
  }));
  const container = document.getElementById('reviewContainer');
  if(due.length===0){
    container.innerHTML = '<p class="muted">Dzisiaj nic nie czeka na powtórkę. Zrób nową lekcję lub wróć jutro 🙂</p>';
  } else {
    container.innerHTML = due.slice(0,10).map(({it,key})=>cardHTML(it,key)).join('');
    bindButtons();
  }
}

function bindButtons(){
  document.querySelectorAll('button.good').forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.key;
      const state = getState();
      scheduleItem(state, key, false);
      btn.closest('.card').style.opacity = 0.5;
    };
  });
  document.querySelectorAll('button.again').forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.key;
      const state = getState();
      scheduleItem(state, key, true);
      btn.closest('.card').style.opacity = 0.5;
    };
  });
}

async function main(){
  if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('sw.js'); }catch(e){} }
  let lessons = await loadLessons();
  const state = getState();
  if(!state.today){ state.today = todayStr; saveState(state); }

  // Pick today's lesson by day offset from first use
  const start = new Date(state.today);
  const diffDays = Math.floor((new Date() - start) / (24*3600*1000));
  const lesson = lessons[Math.min(diffDays, lessons.length-1)];
  renderLesson(lesson);
  renderReview(lessons, state);
  renderAll(lessons);

  document.getElementById('resetBtn').onclick = ()=>{
    if(confirm('Na pewno zresetować postęp?')){
      localStorage.removeItem('persian_state');
      location.reload();
    }
  };

  // PWA install prompt
  let deferred;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); deferred = e;
    const btn = document.getElementById('installBtn');
    btn.hidden = false;
    btn.onclick = async ()=>{ deferred.prompt(); deferred = null; btn.hidden = true; };
  });
}
main();
