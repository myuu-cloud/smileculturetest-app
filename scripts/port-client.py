# One-time port of the artifact quiz (index.html) to the Vercel app client (public/app.html).
# Re-run after a Studio sync of the artifact: python3 scripts/port-client.py <artifact index.html> public/app.html
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf8').read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f'PORT FAILED ({c}x): {old[:90]!r}')
    s = s.replace(old, new)

# --- document shell (the artifact host added these)
s = ('<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
     '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + s + '\n</html>')

# --- account bar + privacy notice on the start page
R('<div class="brandrow"><span class="eyebrow" id="hBrand">smileCULTURE</span><button id="adminBtn" class="btn quiet sm" hidden>⚙ หน้า Admin สำหรับ HR</button></div>',
  '<div class="brandrow"><span class="eyebrow" id="hBrand">smileCULTURE</span><span class="row"><button id="adminBtn" class="btn quiet sm" hidden>⚙ หน้า Admin สำหรับ HR</button></span></div>\n  <div id="acct" class="acct" aria-live="polite"></div>')
R('/* admin tab: launcher grid */', '''.acct{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px 14px;border-radius:18px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);max-width:640px}
.acct img{width:40px;height:40px;border-radius:50%;object-fit:cover}.acct .who2{display:grid;line-height:1.35;min-width:0}.acct .who2 b{font-family:var(--f-display);font-size:15px}.acct .who2 small{color:var(--muted);font-size:12.5px;overflow-wrap:anywhere}
.acct .priv{flex:1 1 280px;font-size:12.5px;color:var(--muted);line-height:1.6;margin:0}.gbtn{display:inline-flex;align-items:center;gap:10px;border:0;border-radius:14px;padding:11px 16px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--line);font-family:var(--f-display);font-weight:700;font-size:14px;cursor:pointer;color:var(--ink)}
.gbtn:hover{background:var(--sunk)}.gbtn svg{width:18px;height:18px}
.att-tools{display:grid;grid-template-columns:2fr 1fr 1fr 1.2fr;gap:8px}.att-tools input,.att-tools select{width:100%;border:1.5px solid var(--line);background:var(--bg);border-radius:12px;padding:8px 10px;font-size:13.5px}
.att-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;max-height:560px}.att{width:100%;border-collapse:collapse;font-size:13px}.att th{position:sticky;top:0;background:var(--sunk);text-align:left;padding:8px 10px;white-space:nowrap;font-weight:700}
.att td{padding:8px 10px;border-top:1px solid var(--line);vertical-align:top}.att tr.u{cursor:pointer}.att tr.u:hover td{background:var(--bg)}.att tr.h td{background:var(--bg);font-size:12.5px;color:var(--muted)}.att .n{text-align:right;font-variant-numeric:tabular-nums}
.att .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:var(--c)}.share{display:grid;gap:10px}.share .ln{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.share code{flex:1 1 260px;font:12.5px var(--f-mono);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 10px;overflow-wrap:anywhere}
@media (max-width:760px){.att-tools{grid-template-columns:1fr 1fr}.att-tools .q{grid-column:1/-1}}
/* admin tab: launcher grid */''')

# --- results are tied to the Google account now, so drop the 'anonymous' chip
R('<li>ไม่ระบุตัวตน</li>', '<li>ลงชื่อด้วย Google</li>')
R('คำตอบไม่ระบุตัวตน HR เห็นเฉพาะภาพรวมขององค์กร', 'ชื่อ อีเมล และผลของคุณ เห็นได้เฉพาะผู้ดูแลที่ได้รับอนุญาต')

# --- attempt ids (idempotent submit) and server submit
R("const swap={};QS.forEach(q=>swap[q.id]=Math.random()<.5);return{order,swap,ans:{},part:0}}",
  "const swap={};QS.forEach(q=>swap[q.id]=Math.random()<.5);return{id:crypto.randomUUID(),startedAt:new Date().toISOString(),order,swap,ans:{},part:0}}")
R("function loadAttempt(){const a=ls.get(attemptKey());if(a&&a.order&&a.order.length===QS.length&&a.order.every(id=>QS.some(q=>q.id===id)))return a;return null}",
  "function loadAttempt(){const a=ls.get(attemptKey());if(a&&a.order&&a.order.length===QS.length&&a.order.every(id=>QS.some(q=>q.id===id))){if(!a.id){a.id=crypto.randomUUID();a.startedAt=new Date().toISOString()}return a}return null}")
R("async function finishQuiz(){const sc=computeScores(attempt);ls.set('cq-last',{v:CFG.version,scores:sc,at:Date.now()});ls.del(attemptKey());attempt=null;",
  "async function finishQuiz(){const sc=computeScores(attempt);ls.set('cq-last',{v:CFG.version,scores:sc,at:Date.now()});ls.set('cq-pending',{att:attempt,v:CFG.version});ls.del(attemptKey());attempt=null;")
a = s.index("async function submitResult(sc){"); b = s.index("async function renderOrg(main){")
s = s[:a] + r"""// the same attempt id is resent on every retry, so the server records it once
let submitting=false;
async function submitResult(){const p=ls.get('cq-pending');if(!p||submitting)return;const note=$('rNote');submitting=true;if(note)note.textContent='กำลังบันทึกผล…';
 try{const r=await API('/api/quiz/submit',{attemptId:p.att.id,startedAt:p.att.startedAt,version:p.v,answers:{order:p.att.order,swap:p.att.swap,ans:p.att.ans}});ls.del('cq-pending');if(note)note.textContent=`บันทึกผลแล้ว · การทำแบบทดสอบครั้งที่ ${r.attemptNumber} ของคุณ`}
 catch(e){if(e.status===409&&e.code==='stale'){ls.del('cq-pending');if(note)note.textContent='HR เผยแพร่ชุดคำถามใหม่ระหว่างที่คุณทำ ผลนี้จึงไม่ถูกบันทึก กด "ทำแบบทดสอบใหม่" เพื่อทำชุดล่าสุด'}
  else if(e.status===401){if(note)note.innerHTML='เข้าสู่ระบบก่อน ผลจึงจะถูกบันทึก <button class="link" id="retrySubmit">เข้าสู่ระบบด้วย Google</button>';const b=$('retrySubmit');if(b)b.onclick=()=>signIn('/result')}
  else if(note){note.innerHTML='บันทึกผลไม่สำเร็จ <button class="link" id="retrySubmit">ลองส่งอีกครั้ง</button>';$('retrySubmit').onclick=submitResult}}
 finally{submitting=false}}
async function fetchResults(){try{const j=await API('/api/org-summary');return j.mains.map(m=>({main:m}))}catch(e){return null}}
""" + s[b:]
R("$('retake').onclick=()=>{", "$('retake').onclick=()=>{if(ls.get('cq-pending')){submitResult();toast('กำลังบันทึกผลครั้งก่อนให้ก่อน');return}")

# --- start needs a Google sign-in
R("$('startBtn').onclick=()=>{if(!attempt){attempt=newAttempt();saveAttempt()}startQuiz()};",
  "$('startBtn').onclick=()=>{if(!ME.signedIn){signIn('/quiz');return}if(!attempt){attempt=newAttempt();saveAttempt()}startQuiz()};")

# --- admin: data from the server instead of the artifact database
R("if(db&&!ADM.unsub){ADM.unsub=db.collection('results').limit(1000).onSnapshot(s=>{ADM.results=s.docs.map(d=>d.data());if(ADM.tab==='results')renderAdmin()},()=>{})}",
  "if(!ADM.att)loadAttempts();")
R("function admResults(){const cs=CFG.cultures,ids=new Set(cs.map(c=>c.id));",
  r"""async function loadAttempts(){try{ADM.att=await API('/api/admin/attempts');ADM.attErr='';ADM.results=ADM.att.users.map(u=>{const last=ADM.att.attempts.filter(a=>a.userId===u.user_id).pop();return{main:u.latest_result,pct:last?last.pct:{},at:u.latest_attempt_at}})}
 catch(e){ADM.attErr=e.status===403?'บัญชีนี้ไม่มีสิทธิ์ดูผล':'โหลดผลไม่สำเร็จ ('+(e.message||'')+')'}if(ADM.tab==='results'&&!$('vAdmin').hidden)renderAdmin()}
const fmtDT=x=>x?new Date(x).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'';
function attFiltered(){const f=ADM.f||{},q=(f.q||'').trim().toLowerCase();return(ADM.att?ADM.att.attempts:[]).filter(a=>(!q||(a.name+' '+a.email).toLowerCase().includes(q))&&(!f.from||a.completedAt.slice(0,10)>=f.from)&&(!f.to||a.completedAt.slice(0,10)<=f.to)&&(!f.res||a.main===f.res))}
function attTable(){const L=attFiltered(),by=new Map();L.forEach(a=>by.set(a.userId,[...(by.get(a.userId)||[]),a]));const nm=id=>{const c=cu(id);return c?esc(c.short||c.name):esc(id)},col=id=>{const c=cu(id);return c?esc(c.color):'#999'};
 const users=[...by.values()].map(x=>x.sort((p,q)=>p.completedAt.localeCompare(q.completedAt))).sort((x,y)=>y[y.length-1].completedAt.localeCompare(x[x.length-1].completedAt));
 if(!users.length)return'<p class="empty">ไม่พบผลที่ตรงกับตัวกรอง</p>';
 return`<p class="note" style="margin:0 0 8px">${L.length} ครั้ง · ${users.length} คน (ตามตัวกรอง) · กดที่ชื่อเพื่อดูประวัติทุกครั้ง</p><div class="att-wrap"><table class="att"><thead><tr><th>ชื่อ / อีเมล</th><th class="n">ทำกี่ครั้ง</th><th>ผลล่าสุด</th><th>ทำล่าสุด</th></tr></thead><tbody>${users.map(x=>{const last=x[x.length-1],open=(ADM.openU||'')===last.userId;
  return`<tr class="u" data-u="${esc(last.userId)}" aria-expanded="${open}"><td><b>${esc(last.name)}</b><br><small>${esc(last.email)}</small></td><td class="n">${x.length}</td><td style="--c:${col(last.main)}"><i class="dot"></i>${nm(last.main)}</td><td>${fmtDT(last.completedAt)}</td></tr>`+
  (open?x.slice().reverse().map(a=>`<tr class="h"><td>ครั้งที่ ${a.attemptNumber} · ${fmtDT(a.completedAt)} · ใช้เวลา ${Math.round(a.durationSeconds/60)} นาที</td><td class="n">${a.score}/${a.maxScore}</td><td style="--c:${col(a.main)}"><i class="dot"></i>${nm(a.main)} · รอง ${nm(a.sub)}</td><td>ชุด ${a.version?fmtDT(+a.version):'เริ่มต้น'}</td></tr>`).join(''):'')}).join('')}</tbody></table></div>`}
function wireAttempts(){const body=$('admBody'),F=ADM.f=ADM.f||{},redraw=()=>{$('attTable').innerHTML=attTable();wireRows()};
 const wireRows=()=>$('attTable')?.querySelectorAll('tr.u').forEach(r=>r.onclick=()=>{ADM.openU=ADM.openU===r.dataset.u?'':r.dataset.u;redraw()});
 body.querySelectorAll('[data-f-att]').forEach(i=>i.oninput=()=>{F[i.dataset.fAtt]=i.value;redraw()});wireRows();
 const ex=body.querySelector('[data-act=attCsv]');if(ex)ex.onclick=async()=>{const L=attFiltered(),q=v=>{v=String(v??'');return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const rows=[['attempt_id','email','display_name','attempt_number','started_at','completed_at','duration_seconds','total_score','maximum_score','main_result','secondary_result','quiz_version'],...L.map(a=>[a.attemptId,a.email,a.name,a.attemptNumber,a.startedAt,a.completedAt,a.durationSeconds,a.score,a.maxScore,a.main,a.sub,a.version])];
  await downloads.save({filename:'culture-quiz-attempts.csv',data:'﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n')})};
 const rf=body.querySelector('[data-act=attReload]');if(rf)rf.onclick=()=>{ADM.att=null;renderAdmin();loadAttempts()}}
function admResults(){if(ADM.attErr)return`<p class="empty">${esc(ADM.attErr)} <button class="link" data-act="attReload">ลองใหม่</button></p>`;if(!ADM.att)return'<p class="empty">กำลังโหลดผล…</p>';
 const S=ADM.att.summary,top=cu(S.mostCommonResult),F=ADM.f||{};
 return`<div class="adm-sec"><div class="kpis"><div class="kpi"><b>${S.totalAttempts}</b><span>ครั้งที่ทำเสร็จทั้งหมด</span></div><div class="kpi"><b>${S.uniqueUsers}</b><span>คน (ไม่นับซ้ำ)</span></div><div class="kpi"><b>${S.repeatUsers}</b><span>คนที่ทำซ้ำ · ${S.repeatPct}%</span></div>
  <div class="kpi"><b>${S.avgAttemptsPerUser}</b><span>ครั้งต่อคนโดยเฉลี่ย</span></div><div class="kpi"><b>${S.avgScorePct}%</b><span>คะแนนเฉลี่ยของ Culture หลัก</span></div><div class="kpi"><b style="color:${top?esc(top.color):'inherit'}">${top?esc(top.short||top.name):'–'}</b><span>ผลที่พบบ่อยที่สุด</span></div></div>
 <section class="panel"><h2>ใครทำแบบทดสอบแล้วบ้าง</h2><div class="att-tools"><input class="q" data-f-att="q" placeholder="ค้นหาชื่อหรืออีเมล" value="${esc(F.q||'')}" aria-label="ค้นหาชื่อหรืออีเมล"><input type="date" data-f-att="from" value="${esc(F.from||'')}" aria-label="ตั้งแต่วันที่"><input type="date" data-f-att="to" value="${esc(F.to||'')}" aria-label="ถึงวันที่">
  <select data-f-att="res" aria-label="กรองตามผล"><option value="">ทุกผล</option>${CFG.cultures.map(c=>`<option value="${esc(c.id)}" ${F.res===c.id?'selected':''}>${esc(c.short||c.name)}</option>`).join('')}</select></div>
  <div class="row" style="margin:10px 0"><button class="btn quiet sm" data-act="attCsv">⇩ ส่งออก CSV</button>${ADM.att.sheetUrl?`<a class="btn quiet sm" href="${esc(ADM.att.sheetUrl)}" target="_blank" rel="noopener">เปิด Google Sheet</a>`:''}<button class="link" data-act="attReload">↻ โหลดใหม่</button></div>
  <div id="attTable">${attTable()}</div></section>
 ${admOrgCharts()}</div>`}
function admOrgCharts(){const cs=CFG.cultures,ids=new Set(cs.map(c=>c.id));""")
R(" if(!db)return'<p class=\"empty\">ภาพรวมผลจะแสดงเมื่อระบบบันทึกข้อมูลพร้อม</p>';\n if(!ADM.results)return'<p class=\"empty\">กำลังโหลดผล…</p>';", " if(!ADM.results)return'';")
R("if(ADM.tab==='chars'){body.innerHTML=admChars();wireChars();return}", "if(ADM.tab==='chars'){body.innerHTML=admChars();wireChars();return}\n if(ADM.tab==='results'){body.innerHTML=admResults();wireAdmin();wireAttempts();return}")

# --- share links replace the artifact sharing notes
a = s.index('<section class="panel"><h2>แชร์ให้พนักงานและ HR</h2>'); b = s.index('</ul></section>', a) + len('</ul></section>')
s = s[:a] + '''<section class="panel share"><h2>ลิงก์สำหรับแชร์</h2>
 <p class="note">พนักงานต้องเข้าสู่ระบบด้วย Google ก่อนทำแบบทดสอบ หน้า Admin เปิดได้เฉพาะอีเมลที่อยู่ในรายชื่อผู้ดูแล ที่ตั้งไว้บนเซิร์ฟเวอร์</p>
 <div><b>ลิงก์สำหรับพนักงาน</b><div class="ln"><code>${esc(location.origin)}/quiz</code><button class="btn quiet sm" data-copy="/quiz">คัดลอกลิงก์พนักงาน</button><a class="btn quiet sm" href="/quiz" target="_blank" rel="noopener">เปิดแบบทดสอบ</a></div></div>
 <div><b>ลิงก์สำหรับผู้ดูแล</b><div class="ln"><code>${esc(location.origin)}/admin</code><button class="btn quiet sm" data-copy="/admin">คัดลอกลิงก์ Admin</button><a class="btn quiet sm" href="/admin" target="_blank" rel="noopener">เปิดหน้า Admin</a></div></div>
 <p class="note">เมื่อกดเผยแพร่ชุดใหม่ คนที่ทำค้างไว้จะเริ่มชุดใหม่ ส่วนผลที่ส่งไปแล้วยังนับอยู่ ผลทุกครั้งเก็บใน Google Sheet แท็บ Attempts</p></section>''' + s[b:]
R(" const af=body.querySelector('[data-act=aiFill]');", " body.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const u=location.origin+b.dataset.copy;try{await navigator.clipboard.writeText(u);toast('คัดลอกแล้ว: '+u)}catch(e){prompt('คัดลอกลิงก์นี้',u)}});\n const af=body.querySelector('[data-act=aiFill]');")

# --- wording that pointed at artifact permissions
s = s.replace('ตรวจสิทธิ์ Editor ของคุณ', 'ลองอีกครั้ง')

# --- URLs <-> views
R("function show(v){VIEWS.forEach(x=>$(x).hidden=x!==v);", "function show(v){VIEWS.forEach(x=>$(x).hidden=x!==v);setPath(v==='vQuiz'?'/quiz':v==='vResult'?'/result':v==='vAdmin'?adminPath(ADM.tab):'/');")
R("function goTab(t){ADM.tab=t;", "function goTab(t){ADM.tab=t;setPath(adminPath(t));")
R("$('admTabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;ADM.tab=b.dataset.tab;", "$('admTabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;ADM.tab=b.dataset.tab;setPath(adminPath(ADM.tab));if(ADM.tab==='results'&&!ADM.att)loadAttempts();")

# --- boot: the server replaces window.claude (user, db, sample, downloads)
a = s.index("renderHome();\n(async()=>{\n [db,user,sample,downloads]"); b = s.index("})();\n</script>", a) + len("})();")
s = s[:a] + r"""// ---------- server bridge (stands in for the artifact runtime: identity, data, AI, downloads)
async function API(path,body,method){const r=await fetch(path,{method:method||(body?'POST':'GET'),headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||String(r.status)),{status:r.status,code:j.code});return j}
let ME={signedIn:false};
const dbBridge={doc:p=>({async get(){const j=await API(p==='cfg/live'?'/api/config':'/api/admin/config');return{exists:!!j.config,data:()=>j.config}},
 async set(d){if(p==='cfg/live')return API('/api/admin/publish',{config:d});if(p==='cfg/draft')return API('/api/admin/config',{config:d},'PUT');throw new Error('unsupported '+p)}})};
const sampleBridge={async json(prompt){let t;try{t=(await API('/api/admin/ai',{prompt})).text||''}catch(e){throw Object.assign(e,{code:e.status===429?'rate_limited':'unavailable'})}
 const m=t.match(/[\[{][\s\S]*[\]}]/);try{return JSON.parse(m?m[0]:t)}catch(e){throw{code:'invalid_json'}}},async limits(){return{}}};
const downloadsBridge={async save({filename,data}){const b=data instanceof Blob?data:new Blob([data]),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);return{status:'saved'}}};
// Auth.js endpoints need a POST with its CSRF token
async function authPost(path,cb){const{csrfToken}=await(await fetch('/api/auth/csrf')).json();const f=document.createElement('form');f.method='POST';f.action=path;f.hidden=true;
 f.innerHTML=`<input name="csrfToken" value="${esc(csrfToken)}"><input name="callbackUrl" value="${esc(cb)}">`;document.body.appendChild(f);f.submit()}
const signIn=(cb='/')=>authPost('/api/auth/signin/google',cb),signOutNow=()=>authPost('/api/auth/signout','/');
const PRIVACY='ระบบจะใช้ชื่อและอีเมลจากบัญชี Google เพื่อระบุการทำแบบทดสอบ ตรวจสอบจำนวนครั้ง และสรุปการเข้าร่วม ข้อมูลจะปรากฏเฉพาะต่อผู้ดูแลที่ได้รับอนุญาตเท่านั้น',
 PRIVACY_EN='We use your Google account name and email to identify your quiz attempts, count repeat participation, and summarize results. Your information will only be visible to authorized administrators.';
const GICON='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function renderAccount(){const el=$('acct');if(!el)return;
 el.innerHTML=ME.signedIn?`${ME.image?`<img src="${esc(ME.image)}" alt="" referrerpolicy="no-referrer">`:''}<span class="who2"><b>${esc(ME.name)}</b><small>${esc(ME.email)}</small></span><button class="link" id="signOutBtn">ออกจากระบบ</button>`
  :`<p class="priv" lang="th">${PRIVACY}<br><span lang="en">${PRIVACY_EN}</span></p><button class="gbtn" id="signInBtn">${GICON}เข้าสู่ระบบด้วย Google</button>`;
 const o=$('signOutBtn');if(o)o.onclick=signOutNow;const i=$('signInBtn');if(i)i.onclick=()=>signIn(new URLSearchParams(location.search).get('signin')||'/quiz')}
const adminPath=t=>t==='results'?'/admin/results':t==='settings'?'/admin/settings':'/admin';
function setPath(p){if(location.pathname!==p)history.pushState(null,'',p)}
async function route(){const p=location.pathname;
 if(p==='/quiz'){if(!ME.signedIn){show('vHome');renderHome();return}attempt=attempt||loadAttempt()||newAttempt();saveAttempt();startQuiz()}
 else if(p==='/result'){const last=ls.get('cq-last');if(last&&last.scores)return showResult(last.scores,false);
  try{const j=await API('/api/quiz/mine'),a=j.attempts[j.attempts.length-1];if(a&&a.result&&a.result.rank)return showResult(a.result,false)}catch(e){}show('vHome');renderHome();toast('ยังไม่มีผลของคุณ เริ่มทำแบบทดสอบได้เลย')}
 else if(p.startsWith('/admin')){if(!canEdit){show('vHome');renderHome();return}ADM.tab=p==='/admin/results'?'results':p==='/admin/settings'?'settings':(ADM.tab==='results'||ADM.tab==='settings'?'cultures':ADM.tab||'cultures');
  $('admTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.tab===ADM.tab));await openAdmin()}
 else{if($('vHome').hidden){show('vHome');renderHome()}}}
addEventListener('popstate',route);
renderHome();
(async()=>{
 db=dbBridge;downloads=downloadsBridge;
 try{ME=await API('/api/me')}catch(e){}
 uid=ME.signedIn?ME.email:null;canEdit=!!ME.isAdmin;isOwner=false;sample=ME.isAdmin&&ME.ai?sampleBridge:null;
 $('adminBtn').hidden=!canEdit;renderAccount();
 const qs=new URLSearchParams(location.search);if(qs.has('denied'))toast('บัญชีนี้ไม่มีสิทธิ์เข้าหน้า Admin');if(qs.has('signin'))toast('เข้าสู่ระบบด้วย Google ก่อนเริ่มทำแบบทดสอบ');
 try{const s=await db.doc('cfg/live').get();if(s.exists){const d=s.data();if(d&&Array.isArray(d.cultures)&&d.cultures.length>=2){applyCfg(clone(d));if(!$('vHome').hidden)renderHome()}}}catch(e){}
 await route();
 if(ME.signedIn&&ls.get('cq-pending')&&location.pathname!=='/result')submitResult();
 if(!$('vResult').hidden)$('saveCard').hidden=!downloads;
})();""" + s[b:]

open(dst, 'w', encoding='utf8').write(s)
print('ported', len(s))
