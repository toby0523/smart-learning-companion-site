(() => {
  'use strict';
  const E=window.ScholarEngine, C=window.SCHOLAR_CURRICULUM, original=window.SCHOLAR_DATA;
  let payload=original, db=E.prepare(payload.raw), isDefault=true;
  let page='overview', student=E.selectCases(db)[0].id, node='all', classId='all', topic='T01', search='', type='all', cmpB='', cmpC='', verifyCase='', verifyCompare='';
  let practice=null, practiceHints=0, pushNext=false;
  const DEMO=window.SCHOLAR_DEMO;
  let rules={...E.DEFAULT_RULES}, feedback=[], overrides=[], supplements=[], history=[], preview=null, viewVersion=0, baseDb=db, baseCases=[], note='', noteBad=false, idSeq={};
  const labels={overview:'学情总览',cases:'学生与典型案例',group:'班级与对比',verify:'结果核对',curriculum:'学习内容与要求',plans:'个性化学习建议',adjust:'调整与反馈',library:'题目与学习材料',quality:'数据质量与边界'};
  const cst=t=>new Date(t+8*3600e3).toISOString().slice(0,19)+'+08:00', nowISO=()=>cst(Date.now());
  const newId=p=>{let id;do id=p+String(idSeq[p]=(idSeq[p]||0)+1).padStart(3,'0');while(feedback.some(f=>f['反馈编号']===id)||overrides.some(o=>o['改判编号']===id));return id;};
  const opts=()=>node==='all'?{rules,feedback,overrides}:{rules};
  const adjusted=()=>Boolean(supplements.length||feedback.length||overrides.length||JSON.stringify(rules)!==JSON.stringify({...E.DEFAULT_RULES}));
  const nodeWord=()=>db.nodes.size===2?'两次测验':db.nodes.size+'次测验';
  const $=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=x=>x===null?'未观测':(x*100).toFixed(1)+'%', score=s=>s.max?`${s.score}/${s.max}`:'—';
  const classes=()=>[...new Set([...db.students.values()].map(s=>s['模拟班级编号']))];
  const badge=(s,t='')=>`<span class="badge ${t}">${esc(s)}</span>`;
  const btn=(text,attrs='',cls='')=>`<button class="button ${cls}" ${attrs}>${text}</button>`;
  const qbtn=id=>`<button class="question-chip" data-question="${esc(id)}">${esc(id)}</button>`;
  const ref=id=>`<button class="button text record-ref" data-record="${esc(id)}">${esc(id)} ↗</button>`;
  const stat=(label,value,unit,caption)=>`<div class="stat"><div class="stat-label">${label}</div><div class="stat-value numeric">${value}<small>${unit}</small></div><div class="stat-caption">${caption}</div></div>`;
  function options(rows,current){return rows.map(([value,label])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`).join('');}
  function filters(withStudent=false,withClass=false){return `<div class="filters">${withStudent?`<label class="filter-field"><span>学生</span><select id="student-select">${options([...db.students.values()].map(s=>[s['学生编号'],s['学生编号']+' · '+s['模拟班级编号']]),student)}</select></label>`:''}${withClass?`<label class="filter-field"><span>班级</span><select id="class-select">${options([['all','两个班／全部班级'],...classes().map(c=>[c,c])],classId)}</select></label>`:''}<label class="filter-field"><span>范围</span><select id="node-select">${options([['all',nodeWord()+' · 综合观察'],...[...db.nodes.values()].map(n=>[n['节点编号'],n['节点编号']+' · '+n['模拟测验日期']])],node)}</select></label></div>`;}
  function heading(title,subtitle,controls=''){return `<div class="page-heading"><div><div class="eyebrow">EVIDENCE-BASED LEARNING</div><h1>${title}</h1><div class="subheading">${subtitle}</div></div>${controls}</div>`;}
  const online=location.protocol==='http:'||location.protocol==='https:';
  const pdfNote='线上版未附带赛题PDF原件，此页码可对照赛事资料包查阅';
  function sourceHref(id,p=1){
    const file=id==='standard'?'课程标准_2022.pdf':id+'_相关资料切片.pdf';
    if(online)return '';
    return new URL('赛题资料包/5_课程标准及相关教学资源/'+file,location.href).href+`#page=${p}`;
  }
  const regKey=r=>[r['主题编号'],r['主题'],r['观察指标']].join('|');
const baseInd=new Map(original.raw['课程要求'].map(r=>[r['指标编号'],regKey(r)])), baseTopic=new Map(original.raw['课程要求'].map(r=>[r['主题编号'],r['主题']]));
  // Page annotations describe the original registered indicators; imported data with changed wording must not inherit them.
  const spec=iid=>iid&&db.indicators.has(iid)&&regKey(db.indicators.get(iid))===baseInd.get(iid)?C.indicators[iid]:null;
  const topicSource=t=>db.topics.find(x=>x.id===t)?.name===baseTopic.get(t)?C.sources[t]:null;
  const pageLink=([book,pdf,printed,title,detail])=>online
    ? `<span class="page-link unavailable" title="${esc(pdfNote)}">${esc(book)} 正文第${printed}页${title?' · '+esc(title):''}</span>`
    : `<a class="page-link" target="_blank" rel="noopener" href="${esc(sourceHref(book,pdf))}" title="${esc(`打开${book} PDF第${pdf}页${detail?'：'+detail:''}`)}">${esc(book)} 正文第${printed}页${title?' · '+esc(title):''} ↗</a>`;
  const pageItem=(p,tag)=>`<li>${tag?badge(tag,'neutral'):''}${pageLink(p)}<span class="muted tiny">PDF第${p[1]}页${p[4]?' · '+esc(p[4]):''}</span></li>`;
  const standardLink=s=>online
    ? `<span class="page-link unavailable" title="${esc(pdfNote)}">课标 正文第${s.printedStandard}页（PDF第${s.standardPage}页）· ${esc(s.items)}</span>`
    : `<a target="_blank" rel="noopener" href="${esc(sourceHref('standard',s.standardPage))}">课标 正文第${s.printedStandard}页（PDF第${s.standardPage}页）· ${esc(s.items)} ↗</a>`;
  const stepPages=(iid,label)=>(spec(iid)&&label&&C.stepPages.find(([k,re])=>iid.startsWith(k)&&new RegExp(re).test(label))?.[2])||spec(iid)?.pages;
  const pageKey=ps=>(ps||[]).map(x=>x[0]+x[1]).join();
const bookRef=(iid,label)=>{const pages=stepPages(iid,label);if(!pages)return '';const by={};pages.forEach(([b,,n,t])=>(by[b]=by[b]||[]).push(`${n}页${t}`));return Object.entries(by).map(([b,ps])=>`${b}正文第${ps.join('、')}`).join('；');};
  function sourceLinks(t){const s=topicSource(t);if(!s)return '<span>该主题与原登记不一致，不自动生成课标与教材页码</span>';const book=online?`<span class="page-link unavailable" title="${esc(pdfNote)}">${esc(s.book)} · ${esc(s.bookRange)}</span>`:`<a target="_blank" rel="noopener" href="${esc(sourceHref(s.book,1))}">${s.book} · ${esc(s.bookRange)} ↗</a>`;return `${standardLink(s)}${book}<span>${s.verified?'页码已按PDF页面逐页核对':'页码待核验'}</span>`;}
  function bar(t,color=''){return `<div class="bar-track"><div class="bar-fill ${color}" style="width:${t.rate===null?0:Math.round(t.rate*100)}%"></div></div>`;}
  function qualityShort(){const a=db.audit;return `原始记录不等于独立作答事件。当前数据：${a.raw}条原始记录，${a.archived.length}条历史修订、${a.conflicts.length}条结构／冲突记录暂隔离${a.duplicateRows.length?`、${a.duplicateRows.length}条完全重复只计一次`:''}，${a.latest}个可分析事件；仅${a.scored}条有效评分进入得分分母。`;}
  const firstStep=s=>E.pointDefs(db.materials.get(s.qid))[0]?.id===s.id;
  const sameIds=(a,b)=>a.map(x=>x.id).join()===b.map(x=>x.id).join();
  const reveal=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  function build(next){
    const s={rules,feedback,overrides,supplements,...next};
    const d=sameIds(s.supplements,supplements)?db:s.supplements.length?E.prepare(E.mergeSupplement(payload.raw,s.supplements.map(x=>x.batch))):baseDb;
    return {s,d,snapshot:E.planSnapshot(d,{rules:s.rules,feedback:s.feedback,overrides:s.overrides})};
  }
  function resetHistory(){
    baseDb=db;baseCases=E.selectCases(db);rules={...E.DEFAULT_RULES};feedback=[];overrides=[];supplements=[];preview=null;note='';
    history=[{v:0,title:'基线 · '+payload.label,kind:'base',detail:'原始数据、默认分流阈值，无补充记录、反馈或改判',time:nowISO(),state:{rules,feedback,overrides,supplements},snapshot:E.planSnapshot(db,{rules}),audit:db.audit,diff:[],delta:null}];viewVersion=0;
    verifyCase=baseCases[0]?.id||student;verifyCompare=baseCases.find(c=>c.id!==verifyCase)?.id||[...db.students.keys()].find(x=>x!==verifyCase)||verifyCase;
  }
  function stage(title,kind,next,detail){const b=build(next),prev=history.at(-1);preview={title,kind,next,detail,b,diff:E.diffSnapshots(prev.snapshot,b.snapshot),delta:E.auditDelta(prev.audit,b.d.audit)};return preview;}
  function commit(title,kind,next,detail,b=build(next)){
    const prev=history.at(-1);
    ({rules,feedback,overrides,supplements}=b.s);db=b.d;
    const entry={v:history.length,title,kind,detail,time:nowISO(),state:{rules,feedback,overrides,supplements},snapshot:b.snapshot,audit:db.audit,diff:E.diffSnapshots(prev.snapshot,b.snapshot),delta:E.auditDelta(prev.audit,db.audit)};
    history.push(entry);viewVersion=entry.v;preview=null;practice=null;render();return entry;
  }
  const moved=e=>e.diff.filter(d=>d.changed.includes('mode')).length;
  function toastEntry(e){if(e)toast(`已生成v${e.v}：${e.diff.length}项建议变化，其中${moved(e)}项分流改变`);}
  function rollback(v){
    const t=history[v];if(!t)return;
    if(JSON.stringify([t.state.rules,t.state.feedback,t.state.overrides])===JSON.stringify([rules,feedback,overrides])&&sameIds(t.state.supplements,supplements)){toast(`当前内容已与v${v}一致`);return;}
    toastEntry(commit(`回退至v${v}`,'rollback',{...t.state},`恢复v${v}（${t.title}）时的补充记录、反馈、改判与阈值；被回退的版本仍保留，可再次回退`));
  }
  function addFeedback(rows,title,source,extra={}){
    const {items,issues}=E.checkFeedback(db,rows),fresh=[];
    for(const f of items){const old=feedback.find(x=>x['反馈编号']===f['反馈编号']);if(!old)fresh.push(f);else issues.push(JSON.stringify(old)===JSON.stringify(f)?{id:f['反馈编号'],type:'完全重复',detail:'已采用，只计一次'}:{id:f['反馈编号'],type:'反馈未采用',detail:'反馈编号已存在且内容不同；如需更正，请先撤销原反馈'});}
    return {fresh,issues,title,next:{feedback:[...feedback,...fresh],...extra},detail:`${source}：采用${fresh.length}条${issues.length?`；未采用或重复${issues.length}条（${issues.map(i=>i.id+' '+i.detail).join('；')}）`:''}`};
  }
  function applyDemo(key){
    if(!isDefault){toast('演示样例只适用于赛事公开模拟数据');return null;}
    try{
      if(key==='R2'){const r=E.normalizeRules({...rules,minScored:2,minDistinct:Math.min(rules.minDistinct,2)});if(JSON.stringify(r)===JSON.stringify(rules))throw new Error('当前有效评分阈值已是2条');stage(`阈值试算：有效评分阈值 ${rules.minScored} → 2`,'rules',{rules:r},'演示：放宽证据门槛后，原本“补充观察”的指标会有多少直接给出巩固或迁移建议；预览不生效，需教师确认。');render();reveal('preview-panel');return preview;}
      const s=DEMO.steps.find(s=>s.key===key);if(!s)return null;
      if(s.kind==='records'){if(supplements.some(x=>x.id===key))throw new Error('该样例已应用');if(key==='S2'&&!supplements.some(x=>x.id==='S1'))throw new Error('请先应用①：②是对①中待评分事件的评分修订');return commit(s.title,'records',{supplements:[...supplements,{id:key,name:s.title,source:'demo',batch:{records:s.records,nodes:s.nodes}}]},s.desc);}
      if(s.kind==='feedback'){const a=addFeedback(s.rows,s.title,'演示样例');if(!a.fresh.length)throw new Error('没有新的反馈可采用');return commit(a.title,'feedback',a.next,s.desc+' '+a.detail);}
      const ov=s.rows.map(o=>E.checkOverride(db,o));
      return commit(s.title,'override',{overrides:[...overrides.filter(o=>!ov.some(n=>n['学生编号']===o['学生编号']&&n['指标编号']===o['指标编号'])),...ov]},s.desc);
    }catch(e){toast(e.message);return null;}
  }
  const SHORT_LABEL={T01I1:'表示与求值',T01I2:'整式化简',T01I3:'整式解释',T02I1:'一元一次方程',T02I2:'消元解组',T02I3:'方程建模',T03I1:'不等式性质',T03I2:'解集交集',T03I3:'范围建模'};
  const SERIES=['#285e48','#c07a2c','#4d7f8c'];
  const shortName=i=>SHORT_LABEL[i['指标编号']]||String(i['观察指标']).slice(0,6);
  const sufficient=i=>i.scored>=rules.minScored&&i.distinct>=rules.minDistinct;
  const radarAxes=()=>[...db.indicators.values()].map(i=>({id:i['指标编号'],short:shortName(i)}));
  const indicatorValues=r=>[...db.indicators.values()].map(i=>{const x=r.indicators.find(y=>y['指标编号']===i['指标编号']);return x&&x.scored?x.rate:null;});
  function radarChart(axes,series,label='九项观察指标雷达图'){
    const w=360,h=336,cx=180,cy=160,R=102,n=axes.length;
    const pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/n,r=R*Math.max(0,Math.min(1,v));return [cx+r*Math.cos(a),cy+r*Math.sin(a)];};
    const ring=[.25,.5,.75,1].map(k=>`<polygon points="${axes.map((_,i)=>pt(i,k).map(x=>x.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#e3e8de" stroke-width="1"/>`).join('');
    const spokes=axes.map((_,i)=>{const [x,y]=pt(i,1);return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e9ede4"/>`;}).join('');
    const labels=axes.map((a,i)=>{const [x,y]=pt(i,1.22),cos=Math.cos(-Math.PI/2+i*2*Math.PI/n);const anchor=cos>.25?'start':cos<-.25?'end':'middle';return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="#5f6f66">${esc(a.short)}</text>`;}).join('');
    const shapes=series.map(s=>`<polygon points="${s.values.map((v,i)=>pt(i,v??0).map(x=>x.toFixed(1)).join(',')).join(' ')}" fill="${s.color}" fill-opacity=".12" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`).join('');
    const dots=series.map(s=>s.values.map((v,i)=>{if(v==null)return '';const [x,y]=pt(i,v);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" fill="${s.color}"/>`;}).join('')).join('');
    const legend=series.map(s=>`<span class="radar-key"><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('');
    return `<div class="radar-wrap"><svg class="radar" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${ring}${spokes}${shapes}${dots}${labels}</svg><div class="radar-legend">${legend}</div></div>`;
  }
  const itemText=i=>`<strong>${esc(i['指标编号'])} ${esc(i['观察指标'])}</strong>：${i.scored}条有效评分、${i.distinct}道不同题，${score(i)}（${pct(i.rate)}）`;
  function firstLossFor(report,iid){const s=report.steps.filter(x=>db.materials.get(x.qid)?.['指标编号']===iid&&x.firstLoss).sort((a,b)=>b.firstLoss-a.firstLoss)[0];return s?`${s.label}（${s.firstLoss}/${s.count}条过程在此首次失分）`:'';}
  function studentNarrative(r){
    const ok=r.indicators.filter(sufficient).sort((a,b)=>b.rate-a.rate), strong=ok.filter(i=>i.rate>=.75), gap=ok.filter(i=>i.rate<.6), watch=ok.filter(i=>i.rate>=.6&&i.rate<.75);
    const thin=r.indicators.filter(i=>i.scored>0&&!sufficient(i)), never=r.indicators.filter(i=>!i.scored), lines=[];
    lines.push(`<p>在${node==='all'?'当前综合范围':esc(node)}内，${esc(r.id)}有${r.summary.scored}条有效评分，覆盖${r.summary.distinct}道不同题，已记录题目得分${score(r.summary)}（${pct(r.summary.rate)}）；另有待评分${r.summary.pending}条、未作答${r.summary.unanswered}条，不计入得分率。</p>`);
    if(strong.length)lines.push(`<p><span class="tag-strong">掌握较好</span>${strong.slice(0,3).map(itemText).join('；')}。这些板块证据相对充分，可先用同指标新题独立检验，再安排同伴讲解或变式迁移。</p>`);
    else if(ok.length)lines.push(`<p><span class="tag-strong">相对较好</span>${ok.slice(0,2).map(itemText).join('；')}。尚未达到${Math.round(rules.consolidate*100)}%巩固线，但在本范围内相对稳定，可作为建立信心的起点。</p>`);
    if(gap.length)lines.push(`<p><span class="tag-gap">知识漏洞</span>${gap.slice(0,3).map(i=>{const f=firstLossFor(r,i['指标编号']);return `${itemText(i)}${f?`，首个失分点集中在“${esc(f)}”`:''}`;}).join('；')}。建议先核对失分步骤，再决定是否整体重讲。</p>`);
    if(watch.length)lines.push(`<p><span class="tag-watch">需要巩固</span>${watch.slice(0,3).map(itemText).join('；')}。已接近巩固线，宜用另一道同指标题做无提示检验，稳定后再进阶。</p>`);
    if(thin.length)lines.push(`<p><span class="tag-thin">证据有限</span>${thin.map(i=>`${esc(i['指标编号'])}（${i.scored}条／${i.distinct}道）`).join('、')}，少于${rules.minScored}条评分或${rules.minDistinct}道不同题，暂不下掌握结论。</p>`);
    if(never.length)lines.push(`<p><span class="tag-thin">尚未观测</span>${never.map(i=>esc(i['指标编号'])).join('、')}在当前范围没有评分记录；没有记录不等于没有掌握。</p>`);
    lines.push(`<p class="muted tiny">以上为规则化证据摘要，用于教学分流与观察安排，不是心理测量或学生能力定论。</p>`);
    return lines.join('');
  }
  function classNarrative(c){
    const ok=c.indicators.filter(i=>i.scored&&i.coveredStudents>=Math.max(1,Math.ceil(c.count*.5))).sort((a,b)=>b.rate-a.rate);
    const strong=ok.filter(i=>i.rate>=.75), problem=ok.filter(i=>i.rate<.6), lines=[];
    const steps=c.steps.filter(s=>s.firstLoss).slice(0,3);
    lines.push(`<p>${c.id==='all'?'全体学生':esc(c.id)}共${c.count}人，${c.summary.scored}条有效评分，已记录题目得分${score(c.summary)}（${pct(c.summary.rate)}）；${c.measuredStudents}人有可用得分证据。</p>`);
    if(strong.length)lines.push(`<p><span class="tag-strong">共同优点</span>${strong.slice(0,3).map(itemText).join('；')}。这些板块班级整体表现较稳，可减少集体讲授，转为变式与迁移任务。</p>`);
    else if(ok.length)lines.push(`<p><span class="tag-strong">相对优势</span>${ok.slice(0,2).map(itemText).join('；')}。虽未达到${Math.round(rules.consolidate*100)}%巩固线，但在本班各指标中相对较好，可先用新题验证稳定性。</p>`);
    if(problem.length)lines.push(`<p><span class="tag-gap">共性问题</span>${problem.slice(0,3).map(itemText).join('；')}。建议按首个失分步骤组织一次短讲与同类题再练，而不是重讲整个单元。</p>`);
    if(steps.length)lines.push(`<p><span class="tag-watch">步骤线索</span>${steps.map(s=>`${esc(s.label)}（${s.firstLoss}/${s.count}条，涉及${s.firstStudents.length}人）`).join('；')}。这些步骤是全班首次失分最集中的位置，优先用匿名原过程做对比讲解。</p>`);
    if(!strong.length&&!problem.length)lines.push('<p>当前范围内各指标的班级证据不足或处于中间区间，暂不归纳共同优点与共性问题，建议先补齐观察。</p>');
    lines.push(`<p class="muted tiny">按指标加权得分率归纳，覆盖人数不足半班的指标不参与“共同”判断；班级差异不等于教学效果差异。</p>`);
    return lines.join('');
  }
  function classBriefs(list){
    const pick=x=>{const ok=x.indicators.filter(i=>i.scored&&i.coveredStudents>=Math.max(1,Math.ceil(x.count*.5))).sort((a,b)=>b.rate-a.rate);return {strong:ok.filter(i=>i.rate>=.75).slice(0,2).length?ok.filter(i=>i.rate>=.75).slice(0,2):ok.slice(0,2),weak:ok.filter(i=>i.rate<.6).slice(-2).reverse()};};
    return list.map(x=>{const {strong,weak}=pick(x);return `<p><strong>${esc(x.id)}</strong>（${x.count}人 · 加权${pct(x.summary.rate)}）：相对优势 ${strong.map(i=>`${shortName(i)} ${pct(i.rate)}`).join('、')||'证据不足'}；共性问题 ${weak.map(i=>`${shortName(i)} ${pct(i.rate)}`).join('、')||'暂未出现低于60%的指标'}。</p>`;}).join('')+`<p class="muted tiny">选择单个班级可查看该班的完整共同优点与共性问题；下方保留两个班合并后的全体结论。</p>`;
  }
  function classComparison(){
    const cs=classes().map(id=>E.classReport(db,id,node));
    if(cs.length<2)return '<div class="empty">当前数据只有一个班级，无法做班级间对比。</div>';
    const [a,b]=cs, diffs=a.indicators.map((ia,k)=>{const ib=b.indicators.find(x=>x['指标编号']===ia['指标编号']);return {id:ia['指标编号'],short:shortName(ia),a:ia.rate,b:ib?ib.rate:null,ca:ia.scored,cb:ib?ib.scored:0,d:ia.rate!==null&&ib&&ib.rate!==null?ia.rate-ib.rate:null};});
    const valid=diffs.filter(x=>x.d!==null).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
    const overall=a.summary.rate-b.summary.rate;
    const point=x=>`${esc(x.id)} ${esc(x.short)}：${esc(a.id)} ${pct(x.a)} · ${esc(b.id)} ${pct(x.b)}（${x.d>0?'+':''}${Math.round(x.d*100)}个百分点）`;
    return `${radarChart(radarAxes(),[{label:a.id,color:SERIES[0],values:a.indicators.map(i=>i.scored?i.rate:null)},{label:b.id,color:SERIES[1],values:b.indicators.map(i=>i.scored?i.rate:null)}],'班级能力对比雷达图')}
      <p class="tiny">整体加权得分率：${esc(a.id)} ${pct(a.summary.rate)}（${a.summary.scored}条）· ${esc(b.id)} ${pct(b.summary.rate)}（${b.summary.scored}条），相差${Math.abs(Math.round(overall*100))}个百分点。</p>
      ${valid.length?`<p class="tiny"><span class="muted">差异最大的指标</span> ${valid.slice(0,3).map(point).join('；')}。</p>`:''}
      <div class="table-wrap"><table class="compare-table"><thead><tr><th>指标</th><th>${esc(a.id)}</th><th>${esc(b.id)}</th><th>差值</th></tr></thead><tbody>${diffs.map(x=>`<tr><td>${esc(x.id)} ${esc(x.short)}</td><td>${pct(x.a)}<span class="muted tiny"> ${x.ca}条</span></td><td>${pct(x.b)}<span class="muted tiny"> ${x.cb}条</span></td><td>${x.d===null?'—':`<span class="${x.d>=0?'up':'down'}">${x.d>0?'+':''}${Math.round(x.d*100)}pp</span>`}</td></tr>`).join('')}</tbody></table></div>
      <div class="notice">两班题目组合、记录覆盖与节点进度不同，差值只描述这些题目上的表现差异，不能解释为教学效果或能力高低。</div>`;
  }
  function independentSummary(records){
    const scored=records.filter(r=>r.validScore),score=scored.reduce((a,r)=>a+r.score,0),max=scored.reduce((a,r)=>a+r.max,0);
    return {events:records.length,scored:scored.length,score,max,rate:max?score/max:null,distinct:new Set(scored.map(r=>r['材料编号'])).size};
  }
  const fmtRate=x=>x===null||x===undefined?'未观测':(x*100).toFixed(1)+'%';
  const checkMark=ok=>`<span class="check ${ok?'pass':'fail'}">${ok?'✓ 一致':'✗ 不一致'}</span>`;
  const checkIcon=ok=>`<span class="check ${ok?'pass':'fail'}">${ok?'✓':'✗'}</span>`;
  function verifyStats(r){
    const c=independentSummary(db.records.filter(x=>x['学生编号']===r.id&&(node==='all'||x['节点编号']===node))),s=r.summary;
    return [
      {label:'已观测事件',calc:c.events,shown:s.events,note:'按事件最高修订版本归并',pass:c.events===s.events},
      {label:'有效评分',calc:c.scored,shown:s.scored,note:'仅评分完整且一致的记录',pass:c.scored===s.scored},
      {label:'已记录得分',calc:c.score,shown:s.score,note:'有效评分题目得分合计',pass:c.score===s.score},
      {label:'满分合计',calc:c.max,shown:s.max,note:'与得分同口径',pass:c.max===s.max},
      {label:'不同题目',calc:c.distinct,shown:s.distinct,note:'同题跨节点不重复计',pass:c.distinct===s.distinct},
      {label:'加权得分率',calc:fmtRate(c.rate),shown:fmtRate(s.rate),note:'得分合计 ÷ 满分合计',pass:fmtRate(c.rate)===fmtRate(s.rate)}
    ];
  }
  function verifyGlobal(){
    const recs=db.records,scored=recs.filter(x=>x.validScore),all=E.classReport(db,'all');
    const qs=[...db.materials.values()].filter(q=>q['材料类型']==='题目').length,rq=payload.raw['题目与材料'].filter(q=>q['材料类型']==='题目').length;
    const rows=[
      {label:'原始记录行',calc:payload.raw['作答记录'].length,shown:db.audit.raw,note:'CSV逻辑数据行'},
      {label:'可分析事件',calc:recs.length,shown:db.audit.latest,note:'历史修订与冲突隔离后'},
      {label:'有效评分',calc:scored.length,shown:db.audit.scored,note:'进入得分统计的记录'},
      {label:'学生名单',calc:db.students.size,shown:new Set(payload.raw['模拟学生'].map(x=>x['学生编号'])).size,note:'唯一学生编号'},
      {label:'登记指标',calc:db.indicators.size,shown:payload.raw['课程要求'].length,note:'九项观察指标'},
      {label:'登记题目',calc:qs,shown:rq,note:'不含学习卡与教材'},
      {label:'全体得分合计',calc:scored.reduce((a,x)=>a+x.score,0),shown:all.summary.score,note:'独立求和 vs 班级报告'},
      {label:'全体满分合计',calc:scored.reduce((a,x)=>a+x.max,0),shown:all.summary.max,note:'独立求和 vs 班级报告'}
    ];
    return rows.map(x=>({...x,pass:String(x.calc)===String(x.shown)}));
  }
  function verifyCites(plans){
    return plans.map(p=>{
      const sp=spec(p.id),src=topicSource(p.topic),card=db.materials.get(p.card);
      const badQ=p.practice.filter(id=>{const q=db.materials.get(id);return !q||q['材料类型']!=='题目'||q['指标编号']!==p.id||(node!=='all'&&!E.split(db.nodes.get(node)?.['可用题目编号']||'').includes(id));});
      const cardOK=Boolean(card&&card['材料类型']==='学习卡'&&card['主题编号']===p.topic);
      const pageOK=Boolean(sp?.pages?.length&&sp.pages.every(x=>Array.isArray(x)&&x.length>=3));
      const qOK=p.practice.length?!badQ.length:Boolean(p.mode.includes('未教'));
      return {p,sp,src,cardOK,pageOK,qOK,badQ,pass:Boolean(sp&&src&&cardOK&&pageOK&&qOK)};
    });
  }
  function verifyPlans(r,plans){
    return plans.map(p=>{
      const i=r.indicators.find(x=>x['指标编号']===p.id);
      const available=[...db.materials.values()].filter(q=>q['材料类型']==='题目'&&q['指标编号']===p.id&&(node==='all'||E.split(db.nodes.get(node)?.['可用题目编号']||'').includes(q['材料编号']))).length;
      const enough=i.scored>=rules.minScored&&i.distinct>=rules.minDistinct;
      const expected=available===0?'未教学／未测量':enough?(i.rate>=rules.consolidate?'变式迁移':'针对性巩固'):'补充观察';
      const evOK=p.evidence.scored===i.scored&&p.evidence.distinct===i.distinct&&p.evidence.score===i.score&&p.evidence.max===i.max&&p.evidence.rate===i.rate;
      const baseOK=p.baseMode===expected;
      const modeOK=p.mode===p.baseMode||p.trace.some(x=>x.kind==='adjust'||x.kind==='override');
      const qOK=p.practice.length?p.practice.every(id=>{const q=db.materials.get(id);return q&&q['材料类型']==='题目'&&q['指标编号']===p.id;}):Boolean(p.mode.includes('未教'));
      return {p,i,expected,enough,available,evOK,baseOK,modeOK,qOK,pass:evOK&&baseOK&&modeOK&&qOK};
    });
  }
  const verifyStatus=i=>!i.scored?'未观测':(i.scored<rules.minScored||i.distinct<rules.minDistinct)?'证据有限':i.rate<rules.consolidate?'低于巩固线':'达到巩固线';
  function verifyTable(r,plans,cites){
    return `<div class="table-wrap"><table class="verify-table three-way"><thead><tr><th>学习要求</th><th>已有表现 · 证据</th><th>学习建议 · 分流</th></tr></thead><tbody>${plans.map(p=>{
      const c=cites.find(x=>x.p===p),i=r.indicators.find(x=>x['指标编号']===p.id),st=verifyStatus(i),sp=c?.sp,src=c?.src;
      return `<tr><td class="req-cell"><strong>${esc(p.id)} · ${esc(shortName(i))}</strong><div class="tiny">${esc(p.label)}</div>${sp?`<div class="tiny muted req-text">${esc(sp.requirement)}</div>`:''}<div class="page-links">${sp?sp.pages.slice(0,2).map(pageLink).join(''):''}${src?standardLink(src):''}</div></td>
        <td><div><strong>${i.scored}条</strong>有效评分 · <strong>${i.distinct}道</strong>不同题<br><span class="rate-big">${pct(i.rate)}</span> <span class="muted tiny">${score(i)}</span> ${badge(st,st==='未观测'?'neutral':st==='达到巩固线'?'':'amber')}</div>${p.firstLoss?`<div class="tiny muted">首个失分：${esc(p.firstLoss.label)}</div>`:''}<div class="related-records">${p.records.slice(0,3).map(ref).join('')||'<span class="muted tiny">没有失分记录可引用</span>'}</div></td>
        <td><div>${modeBadge(p.mode)} ${badge('卡 '+p.card,'neutral')}</div><p class="tiny basis-text">${esc(p.basis)}</p><div class="question-chips">${p.practice.map(q=>qbtn(q)).join('')}</div>${btn('完整建议与提示 ↗',`data-plan="${esc(verifyCase)}|${esc(p.id)}"`,'text')}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function verifyCompareBlock(){
    const ids=baseCases.map(c=>c.id);
    if(!db.students.has(verifyCompare)||verifyCompare===verifyCase)verifyCompare=ids.find(x=>x!==verifyCase)||[...db.students.keys()].find(x=>x!==verifyCase);
    const A=verifyCase,B=verifyCompare;
    if(!db.students.has(A)||!db.students.has(B)||A===B)return '<div class="empty">当前数据不足以选择两个不同案例。</div>';
    const ra=E.studentReport(db,A,node),rb=E.studentReport(db,B,node),pa=E.recommend(db,A,node,opts()),pb=E.recommend(db,B,node,opts());
    const notes=id=>isDefault&&node==='all'?C.caseNotes[id]:null,type=id=>baseCases.find(c=>c.id===id)?.type||'个体分析';
    const rows=[...db.indicators.values()].map(i=>{
      const ia=ra.indicators.find(x=>x['指标编号']===i['指标编号']),ib=rb.indicators.find(x=>x['指标编号']===i['指标编号']);
      const xa=pa.find(x=>x.id===i['指标编号']),xb=pb.find(x=>x.id===i['指标编号']);
      return {id:i['指标编号'],short:shortName(i),ia,ib,xa,xb,diff:xa.mode!==xb.mode};
    });
    const diffs=rows.filter(x=>x.diff),same=rows.length-diffs.length;
    const tally={};diffs.forEach(x=>{const k=`${x.xa.mode} ↔ ${x.xb.mode}`;tally[k]=(tally[k]||0)+1;});
    const card=(id,r)=>`<div class="verify-case-card"><div class="verify-case-id"><span class="student-tag">${esc(id.slice(-2))}</span><div><strong>${esc(id)} · ${esc(type(id))}</strong><p class="tiny muted">${esc(notes(id)?.headline||`${r.summary.scored}条有效评分、${r.summary.distinct}道不同题`)}</p></div></div><div class="tiny">${r.summary.scored}条 · ${r.summary.distinct}题 · ${score(r.summary)}（${pct(r.summary.rate)}）</div></div>`;
    return `${diffs.length?`<div class="verdict"><strong>${esc(A)} 与 ${esc(B)} 在 ${diffs.length} 项指标上建议不同、${same} 项相同。</strong>同一套阈值与证据规则作用在两组不同证据上，产生了不同安排；这体现的是证据条数、题目覆盖与得分率的差异，不是给学生贴“好／差”标签。${Object.entries(tally).map(([k,n])=>badge(`${k}：${n}`,'neutral')).join(' ')}</div>`:`<div class="verdict"><strong>${esc(A)} 与 ${esc(B)} 的九项建议完全一致。</strong>若两者证据差异很大却分流相同，应检查阈值是否过宽，或补充区分度更高的题目。</div>`}
      <div class="two-equal verify-cases">${card(A,ra)}${card(B,rb)}</div>
      <div class="table-wrap"><table class="compare-table verify-compare-table"><thead><tr><th>指标</th><th>${esc(A)} 已有表现</th><th>${esc(A)} 建议</th><th>${esc(B)} 已有表现</th><th>${esc(B)} 建议</th><th>差异依据</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.diff?'row-diff':''}"><td>${esc(x.id)} ${esc(x.short)}</td><td>${x.ia.scored}条/${x.ia.distinct}题 · ${pct(x.ia.rate)}</td><td>${modeBadge(x.xa.mode)}</td><td>${x.ib.scored}条/${x.ib.distinct}题 · ${pct(x.ib.rate)}</td><td>${modeBadge(x.xb.mode)}</td><td class="tiny">${x.diff?`阈值${ruleText(rules)}：${esc(A)} ${x.ia.scored}条/${x.ia.distinct}题 ${pct(x.ia.rate)} → ${esc(x.xa.mode)}；${esc(B)} ${x.ib.scored}条/${x.ib.distinct}题 ${pct(x.ib.rate)} → ${esc(x.xb.mode)}`:'<span class="muted">分流相同</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="notice">对照用于说明“同样规则、不同证据 → 不同建议”的合理性，不用于排名。两案例的题目组合与覆盖不同，不能据此推断谁的能力更强。</div>`;
  }
  function verifyAdjustBlock(){
    const h=history.at(-1),list=history.length>1?E.diffSnapshots(history[0].snapshot,h.snapshot).filter(d=>d.student===verifyCase):[];
    const versions=history.slice(1).map(x=>`<li><span class="timeline-number">v${x.v}</span><div><strong>${esc(x.title)}</strong><p class="muted tiny">${esc(x.time)} · ${x.diff.length}项建议变化，分流改变${moved(x)}项</p></div></li>`).join('');
    return `<div class="panel-header"><h2>六、调整过程：新证据如何改变建议</h2><small>当前 v${h.v}${h.v?' · '+esc(h.title):''}</small></div>${history.length<2?
      `<div class="empty">当前为 v0 基线，尚未导入补充记录、练习复核或教师改判。导入后，这里会列出 ${esc(verifyCase)} 的每一项建议变化及依据。</div><div class="plan-actions">${btn('前往导入补充记录／反馈 ↗','data-go="adjust"','primary')}${isDefault&&verifyCase==='D04'&&!feedback.some(f=>f['反馈编号']==='FB01')?btn('应用演示反馈 S3（演示样例，非赛方数据）','data-demo="S3"','small'):''}</div>`:
      `<ol class="version-list verify-versions">${versions}</ol>${list.length?list.map(d=>changeItem(d,h.state.rules)).join(''):`<div class="notice">${esc(verifyCase)} 的建议从 v0 到 v${h.v} 没有变化；其他学生的变化与完整版本记录可在“调整与反馈”查看。</div>`}<div class="plan-actions">${btn('查看完整版本与回退 ↗','data-go="adjust"')}</div>`}`;
  }
  function verifyScope(r){
    const observed=r.indicators.filter(i=>i.scored),thin=observed.filter(i=>i.scored<rules.minScored||i.distinct<rules.minDistinct),never=r.indicators.filter(i=>!i.scored);
    return `<div class="panel-header"><h2>七、适用范围与使用边界</h2>${badge(node==='all'?'两次测验综合':node,'blue')}</div>
      <ul class="scope-list">
        <li><strong>数据身份</strong> ${esc(payload.label)}。当前共 ${db.students.size} 名学生、${db.records.length} 个可分析事件、${[...db.materials.values()].filter(q=>q['材料类型']==='题目').length} 道登记题目；为赛事模拟数据，不是真实课堂长期追踪。</li>
        <li><strong>统计口径</strong> 只对有效评分题目按得分／满分加权；待评分与未作答不补零；同一事件取最高修订版本；过程分依赖上游步骤，不把后续零分重复计为独立缺陷。</li>
        <li><strong>案例覆盖</strong> ${esc(verifyCase)} 在 9 项指标中 ${observed.length} 项有评分证据，其中 ${thin.length} 项证据有限、${never.length} 项未观测${never.length?`（${never.map(i=>esc(i['指标编号'])).join('、')}）`:''}。没有记录不等于没有掌握。</li>
        <li><strong>结论用途</strong> 适用于教师复核、教研讨论与下一次教学分流；不构成掌握等级、心理测量或学生能力定论，也不用于给学生排名。</li>
        <li><strong>不外推</strong> 不据本数据判断整式乘除、分式、一元二次方程等未测量内容；班级差异与个体差异不解释为教学效果或能力高低。</li>
        <li><strong>复核责任</strong> 每条建议都可由教师改判，改判理由与规则结果同时保留；最终教学决定由教师作出。</li>
      </ul>`;
  }
  function exportVerify(){
    const r=E.studentReport(db,verifyCase,node),plans=E.recommend(db,verifyCase,node,opts());
    const stats=verifyStats(r),global=verifyGlobal(),cites=verifyCites(plans),checks=verifyPlans(r,plans);
    const others=E.studentReport(db,verifyCompare,node),otherPlans=E.recommend(db,verifyCompare,node,opts());
    download({generatedAt:nowISO(),dataset:payload.label,version:history.at(-1).v,node,case:verifyCase,compare:verifyCompare,rules,scope:{identity:'赛事公开模拟数据副本',purpose:'教师复核与教学分流',limits:['不作为掌握等级或心理测量','不证明教学成效','不外推未测量内容','班级与个体差异不归因于教学效果']},statistics:stats,globalChecks:global,citations:cites.map(c=>({id:c.p['指标编号'],requirement:c.sp?.requirement||'',standardPage:c.src?.printedStandard||null,textbookPages:(c.sp?.pages||[]).map(x=>({book:x[0],pdf:x[1],printed:x[2],title:x[3]})),card:c.p.card,cardValid:c.cardOK,practice:c.p.practice,practiceValid:c.qOK,pass:c.pass})),planChecks:checks.map(x=>({id:x.p.id,mode:x.p.mode,ruleMode:x.p.ruleMode,expected:x.expected,evidence:{scored:x.evidence?.scored??x.i.scored,distinct:x.i.distinct,score:x.i.score,max:x.i.max,rate:x.i.rate},thresholds:rules,evidenceConsistent:x.evOK,ruleConsistent:x.baseOK,adjustmentTraced:x.modeOK,practiceValid:x.qOK,pass:x.pass})),cases:baseCases.map(c=>({id:c.id,type:c.type,rule:c.rule})),comparison:[...db.indicators.values()].map(i=>{const ia=r.indicators.find(x=>x['指标编号']===i['指标编号']),ib=others.indicators.find(x=>x['指标编号']===i['指标编号']),xa=plans.find(x=>x.id===i['指标编号']),xb=otherPlans.find(x=>x.id===i['指标编号']);return {id:i['指标编号'],a:{scored:ia.scored,distinct:ia.distinct,rate:ia.rate,mode:xa.mode},b:{scored:ib.scored,distinct:ib.distinct,rate:ib.rate,mode:xb.mode},sameMode:xa.mode===xb.mode};}),adjustment:history.length>1?E.diffSnapshots(history[0].snapshot,history.at(-1).snapshot).filter(d=>d.student===verifyCase).map(d=>({indicator:d.indicator,label:d.label,before:d.before.mode,after:d.after.mode,evidence:[evidenceText(d.after,history.at(-1).state.rules),...d.after.why]})):[]},`智慧学伴-结果核对-${verifyCase}.json`);
  }
  function renderVerify(){
    if(!db.students.has(verifyCase))verifyCase=baseCases[0]?.id||[...db.students.keys()][0];
    if(!db.students.has(verifyCompare)||verifyCompare===verifyCase)verifyCompare=baseCases.find(c=>c.id!==verifyCase)?.id||[...db.students.keys()].find(x=>x!==verifyCase);
    const r=E.studentReport(db,verifyCase,node),plans=E.recommend(db,verifyCase,node,opts());
    const stats=verifyStats(r),global=verifyGlobal(),cites=verifyCites(plans),checks=verifyPlans(r,plans);
    const statPass=stats.filter(x=>x.pass).length,globalPass=global.filter(x=>x.pass).length,citePass=cites.filter(x=>x.pass).length,planPass=checks.filter(x=>x.pass).length;
    const observed=r.indicators.filter(i=>i.scored).length,notes=isDefault&&node==='all'?C.caseNotes[verifyCase]:null;
    const caseOpts=baseCases.map(c=>[c.id,`${c.id} · ${c.type}`]);
    const nodeOpts=[['all',nodeWord()+' · 综合观察'],...[...db.nodes.values()].map(n=>[n['节点编号'],n['节点编号']+' · '+n['模拟测验日期']])];
    return heading('结果核对：要求、表现与建议逐项对得上','选择典型案例，核对关键统计、材料引用与建议依据，说明结果适用范围，并用不同学习需求的案例对照说明建议差异；不要求用模拟数据证明真实教学成效。',`<div class="filters"><label class="filter-field"><span>核对案例</span><select id="verify-case">${options(caseOpts,verifyCase)}</select></label><label class="filter-field"><span>核对范围</span><select id="verify-node">${options(nodeOpts,node)}</select></label><label class="filter-field"><span>对照案例</span><select id="verify-compare">${options(caseOpts.filter(([id])=>id!==verifyCase),verifyCompare)}</select></label>${btn('导出核对报告 JSON','id="export-verify"','primary')}</div>`)+banner('；本页所有核对项随当前版本与筛选实时复算')+
      `<div class="case-tabs">${baseCases.map(c=>`<button class="case-tab ${verifyCase===c.id?'active':''}" data-verify="${esc(c.id)}">${esc(c.id)} · ${esc(c.type)}</button>`).join('')}</div>
      <div class="stats">${stat('核对项通过',`${statPass+globalPass}/${stats.length+global.length}`,'',`案例统计 ${statPass}/${stats.length} · 数据级 ${globalPass}/${global.length}`)}${stat('材料引用可追溯',`${citePass}/${cites.length}`,'项','课标原文、教材页、学习卡与题目')}${stat('建议依据自洽',`${planPass}/${checks.length}`,'项','阈值、证据计数与实际分流一致')}${stat('案例指标覆盖',`${observed}/9`,'项',notes?'正式展示案例':`未观测 ${9-observed} 项，不作掌握结论`)}</div>
      <section class="panel verify-intro"><div class="panel-header"><h2>一、典型案例：学习要求 → 已有表现 → 学习建议</h2>${badge(notes?'正式展示案例':'个体分析','blue')}</div><div class="verify-lead"><div><strong>${esc(verifyCase)} · ${esc(r.student['模拟班级编号'])}</strong><p class="tiny muted">${esc(notes?.headline||`${r.summary.scored}条有效评分、${r.summary.distinct}道不同题，${score(r.summary)}（${pct(r.summary.rate)}）。`)}</p>${notes?`<p class="tiny muted">案例选择依据：${esc(notes.selection)}</p>`:''}</div><div class="plan-actions">${btn('查看该生完整分析 ↗',`data-student="${esc(verifyCase)}"`)}</div></div>${verifyTable(r,plans,cites)}<div class="notice">每一行把“要求 → 证据 → 建议”串起来：要求来自课程材料，表现来自有效评分记录，建议由可见阈值与证据条数触发；三者可独立复核。</div></section>
      <div class="section-title"><h2>二、关键统计核对</h2><small>独立复算 vs 页面显示</small></div><div class="two-equal"><section class="panel"><div class="panel-header"><h2>${esc(verifyCase)} · 案例统计</h2><small>${node==='all'?'两次测验综合':esc(node)}</small></div><div class="table-wrap"><table class="verify-table"><thead><tr><th>核对项</th><th>复算</th><th>显示</th><th>结果</th></tr></thead><tbody>${stats.map(x=>`<tr><td>${x.label}<div class="muted tiny">${x.note}</div></td><td class="numeric">${x.calc}</td><td class="numeric">${x.shown}</td><td>${checkMark(x.pass)}</td></tr>`).join('')}</tbody></table></div><div class="notice">复算从当前事件记录独立汇总，不读取页面摘要；用于确认展示数字没有重复计数或漏计。</div></section><section class="panel"><div class="panel-header"><h2>数据级复核</h2><small>与当前筛选无关</small></div><div class="table-wrap"><table class="verify-table"><thead><tr><th>核对项</th><th>复算</th><th>审计值</th><th>结果</th></tr></thead><tbody>${global.map(x=>`<tr><td>${x.label}<div class="muted tiny">${x.note}</div></td><td class="numeric">${x.calc}</td><td class="numeric">${x.shown}</td><td>${checkIcon(x.pass)}</td></tr>`).join('')}</tbody></table></div><div class="notice">数据级复核确认导入与清洗没有丢失或重复记录；逐项异常与处理见“数据质量与边界”。</div></section></div>
      <div class="section-title"><h2>三、材料引用核对</h2><small>每条建议都能回到登记材料</small></div><section class="panel"><div class="table-wrap"><table class="verify-table cite-table"><thead><tr><th>指标</th><th>课标原文</th><th>教材定位</th><th>学习卡</th><th>推荐题目</th><th>结果</th></tr></thead><tbody>${cites.map(c=>`<tr><td><strong>${esc(c.p.id)}</strong><div class="tiny muted">${esc(shortName(c.p))}</div></td><td>${c.src?standardLink(c.src):'<span class="check fail">✗ 无来源</span>'}</td><td>${c.sp?.pages?.length?`<div class="page-links">${c.sp.pages.map(pageLink).join('')}</div>`:'<span class="check fail">✗ 无页码</span>'}</td><td>${checkIcon(c.cardOK)} ${c.p.card}${c.cardOK?'':'<div class="tiny">未登记为同主题学习卡</div>'}</td><td>${c.p.practice.length?`<div class="question-chips">${c.p.practice.map(q=>qbtn(q)).join('')}</div>`:'<span class="muted tiny">当前无需推荐题目</span>'}${c.badQ.length?`<div class="tiny check fail">题目映射不符：${c.badQ.map(esc).join('、')}</div>`:''}</td><td>${c.pass?badge('可追溯'):badge('待补','red')}</td></tr>`).join('')}</tbody></table></div><div class="notice">课标页码与教材页来自课程材料逐页核对；线上版未附PDF原件，页码以文字说明呈现，本地资料包可跳转。学习卡与题目均使用原登记编号，不新造映射。</div></section>
      <div class="section-title"><h2>四、建议依据核对</h2><small>阈值 → 证据 → 分流</small></div><section class="panel"><div class="table-wrap"><table class="verify-table"><thead><tr><th>指标</th><th>证据与阈值</th><th>规则判定</th><th>当前建议</th><th>核对</th></tr></thead><tbody>${checks.map(x=>{const i=x.i;return `<tr><td><strong>${esc(x.p.id)}</strong><div class="tiny muted">${esc(shortName(i))}</div></td><td>${i.scored}条 / ${i.distinct}题 · ${pct(i.rate)}<div class="tiny muted">阈值 ${esc(ruleText(rules))} · 可用题目${x.available}道</div></td><td>${modeBadge(x.expected)}${x.p.mode!==x.p.baseMode?`<div class="tiny">调整后 ${modeBadge(x.p.mode)}</div>`:''}</td><td>${modeBadge(x.p.mode)}<div class="tiny muted">学习卡 ${esc(x.p.card)} · ${x.p.practice.length}道题</div></td><td>${[x.evOK?'证据计数一致':'证据计数不一致',x.baseOK?'规则判定一致':'规则判定不一致',x.modeOK?'调整有记录':'调整缺少依据',x.qOK?'题目映射正确':'题目映射异常'].map((t,k)=>`<div class="tiny">${checkIcon([x.evOK,x.baseOK,x.modeOK,x.qOK][k])} ${t}</div>`).join('')}${x.pass?badge('自洽'):badge('待核','red')}</td></tr>`;}).join('')}</tbody></table></div><div class="notice">“规则判定”按当前阈值独立重算；“当前建议”可能因已复核练习或教师改判而不同，但必须在决策过程中留下记录。改判不改写规则结果。</div></section>
      <div class="section-title"><h2>五、不同学习需求：建议差异是否合理</h2><small>同一规则，不同证据</small></div><section class="panel">${verifyCompareBlock()}</section>
      <section class="panel verify-adjust">${verifyAdjustBlock()}</section>
      <section class="panel verify-scope">${verifyScope(r)}</section>`;
  }
  const CAUSE_RULES=[
    [/方向|反向|变号/,'不等号方向'],[/移项/,'等式变形／移项'],[/去括号/,'去括号'],[/合并|化简/,'整式化简'],
    [/消元|回代/,'消元与回代'],[/交集|端点/,'解集取交与端点'],[/设未知数|列|关系|建立|建模/,'建模列式'],
    [/检验|核验|解释|说明|实际意义/,'结论检验与解释'],[/计算|求出|求值|代入/,'计算与代入'],[/答案/,'最终答案']
  ];
  const CAUSE_ADVICE={
    '未作答':'先确认是否漏答或时间不足，再补充一次独立作答观察。',
    '不等号方向':'用具体数检验两边乘除负数后的方向，再回到原不等式。',
    '等式变形／移项':'复述等式性质，逐步标注“两边同做什么”，先写中间行。',
    '去括号':'逐项乘括号外因数，先写去括号的中间行，再合并同类项。',
    '整式化简':'按字母与指数分类，先标记同类项，再逐项合并。',
    '消元与回代':'写出消元后的单个方程，求出后回代并核对两个解。',
    '解集取交与端点':'在同一数轴上标出两个解集，逐个检查端点开闭。',
    '建模列式':'圈出等量关系或限制词，先设未知数与单位，再列式。',
    '结论检验与解释':'把结果代回原情境，检查单位、整数限制与现实意义。',
    '计算与代入':'分步写算式，负数与分数加括号，核对每一步数值。',
    '最终答案':'对照参考解析逐步重做，定位第一个与参考不同的步骤。',
    '符号错误':'用括号保留负号，先定符号再算绝对值。',
    '答案表述不一致':'按题目要求整理解集或结论的表达方式，再核对方向与端点。',
    '步骤证据缺失':'该题没有可用的分点评分，只能描述总分；建议补充分步作答。',
    '未填写答案':'已评分为0但没有作答文本，先确认是否漏答，再补充观察。',
    '其他失分':'先核对原过程，再用同指标新题检验。'
  };
  function answerSignal(r){
    const a=String(r['学生最终作答']||'').replace(/\s+/g,''),ref=String(r.q['参考答案']||'').replace(/\s+/g,'');
    if(!a)return '未填写答案';
    if(a===ref)return '步骤失分';
    const num=s=>s.match(/-?\d+(?:\.\d+)?/g)||[],an=num(a),rn=num(ref);
    if(an.length&&rn.length&&an.length===rn.length&&an.some(x=>!rn.includes(x)))return '计算与代入';
    if(a.replace(/-/g,'')===ref.replace(/-/g,''))return '符号错误';
    if(/[<>≤≥]/.test(a)&&/[<>≤≥]/.test(ref))return '不等号方向';
    return '答案表述不一致';
  }
  function causeOf(r,def){
    if(r['评分状态']==='未作答')return '未作答';
    if(!def)return '步骤证据缺失';
    let name='';
    for(const [re,n] of CAUSE_RULES)if(re.test(def.label)){name=n;break;}
    if(!name||name==='最终答案'){const s=answerSignal(r);if(s!=='步骤失分')name=s;else if(!name)name='其他失分';}
    return name;
  }
  function errorAnalysis(records,limit=6){
    const items=[];
    for(const r of records){
      if(!r.validScore||r.score>=r.max)continue;
      const lost=(r.defs||[]).filter(p=>r.pointValues?.[p.id]<p.max);
      items.push({r,cause:causeOf(r,lost[0]),first:lost[0],dependent:Math.max(0,lost.length-1)});
    }
    const groups=[...items.reduce((m,x)=>{const g=m.get(x.cause)||{cause:x.cause,items:[],students:new Set()};g.items.push(x);g.students.add(x.r['学生编号']);m.set(x.cause,g);return m;},new Map()).values()].sort((a,b)=>b.items.length-a.items.length);
    const total=items.length;
    const rows=groups.map(g=>`<div class="cause-row"><span class="cause-name">${esc(g.cause)}</span><div class="cause-bar"><i style="width:${total?Math.round(g.items.length/total*100):0}%"></i></div><strong class="numeric">${g.items.length}</strong><span class="muted tiny">${g.students.size}人</span></div>`).join('');
    const cards=groups.slice(0,limit).map(g=>{const x=g.items[0],r=x.r;return `<article class="cause-card"><div class="cause-card-head"><span class="cause-chip">${esc(g.cause)}</span>${badge(g.items.length+'条','neutral')}<span class="muted tiny">${[...g.students].slice(0,6).join('、')}${g.students.size>6?'等':''}</span></div><div class="cause-q">${qbtn(r['材料编号'])}<span>${esc(r.q['指标编号']||'')} · ${esc(String(r.q['题干或内容']).slice(0,80))}</span></div><p class="tiny"><span class="muted">首个失分步骤</span> ${x.first?esc(x.first.id+' '+x.first.label):'无分点证据'}${x.dependent?` · 另有${x.dependent}个评分点零分，可能受前一步影响`:''}</p><p class="tiny"><span class="muted">学生作答</span> ${esc(String(r['学生最终作答']||'未提供').slice(0,110))}</p>${r['解答过程']?`<p class="tiny"><span class="muted">解答过程</span> ${esc(String(r['解答过程']).replace(/\s+/g,' ').slice(0,110))}</p>`:''}<p class="tiny"><span class="muted">参考解析</span> ${esc(String(r.q['参考解析']||'').slice(0,130))}</p><p class="tiny"><span class="muted">教学处理</span> ${esc(CAUSE_ADVICE[g.cause]||CAUSE_ADVICE['其他失分'])}</p></article>`;}).join('');
    return {total,groups,rows,cards};
  }
  function causePanel(records,title){
    const a=errorAnalysis(records);
    if(!a.total)return `<section class="panel"><div class="panel-header"><h2>${esc(title)}</h2></div><div class="empty">当前范围没有失分记录，暂无可分析的错因。</div></section>`;
    return `<section class="panel"><div class="panel-header"><h2>${esc(title)}</h2><small>${a.total}条失分记录 · ${a.groups.length}类原因</small></div><div class="cause-list">${a.rows}</div>${a.cards}<div class="notice">错因由“首个失分评分点＋作答文本＋参考解析”规则推断，后续零分可能由前一步错误造成，不当作独立缺陷；请结合原过程复核。</div></section>`;
  }
  function compareControls(){
    const opts=id=>`<option value="">不对比</option>${[...db.students.keys()].filter(x=>x!==student).map(x=>`<option value="${esc(x)}" ${id===x?'selected':''}>${esc(x)}</option>`).join('')}`;
    return `<div class="compare-controls"><label for="cmp-b">对比学生 B<select id="cmp-b">${opts(cmpB)}</select></label><label for="cmp-c">对比学生 C<select id="cmp-c">${opts(cmpC)}</select></label></div>`;
  }
  function compareTable(base,others){
    if(!others.length)return '<p class="muted tiny">选择 B／C 学生后，叠加雷达并列出各指标差值（pp＝百分点）。</p>';
    const val=(r,id)=>{const x=r.indicators.find(y=>y['指标编号']===id);return x?{rate:x.rate,scored:x.scored}:{rate:null,scored:0};};
    return `<div class="table-wrap"><table class="compare-table"><thead><tr><th>指标</th><th>${esc(base.id)}</th>${others.map(o=>`<th>${esc(o.id)}</th>`).join('')}</tr></thead><tbody>${base.indicators.map(i=>{const b=val(base,i['指标编号']);return `<tr><td>${esc(i['指标编号'])} ${esc(shortName(i))}</td><td>${pct(b.rate)}<span class="muted tiny"> ${b.scored}条</span></td>${others.map(o=>{const x=val(o,i['指标编号']),d=b.rate!==null&&x.rate!==null?Math.round((b.rate-x.rate)*100):null;return `<td>${pct(x.rate)}${d!==null?`<span class="${d>=0?'up':'down'}">${d>0?'+':''}${d}pp</span>`:''}<span class="muted tiny"> ${x.scored}条</span></td>`;}).join('')}</tr>`;}).join('')}</tbody></table></div>`;
  }
  function renderOverview(){
    const all=E.classReport(db,classId,node), cs=classes().filter(c=>classId==='all'||c===classId).map(c=>E.classReport(db,c,node));
    const steps=all.steps.filter(s=>s.firstLoss).slice(0,4), cases=baseCases;
    return heading('看见学习的每一步','把课程要求、题目与真实作答过程连起来，为下一次教学找到依据。',filters(false,true))+banner()+
      `<section class="hero"><div><div class="eyebrow">七年级数学 · ${db.topics.length}个主题 · ${[...db.materials.values()].filter(q=>q['材料类型']==='题目').length}道登记题目</div><h2>从一道题，读懂一次学习。</h2><p>不只看“得了几分”，还看“在哪一步、为什么失分”。区分已有表现、需要巩固与仍待观察，让每一条建议都能回到材料。</p>${btn('查看三个典型案例　↗','data-go="cases"','primary')}&nbsp;${btn('浏览学习内容','data-go="curriculum"')}</div><div class="hero-visual" aria-hidden="true"><div class="formula-sheet"><div>3(x − 2) = 2x + 5</div><div>x ≥ 2 &nbsp;∩&nbsp; x &lt; 3</div><span>COURSE → EVIDENCE → ACTION</span></div><div class="formula-bubble">学习，不止一个答案。</div></div></section>`+
      `<div class="stats">${stat('当前范围学生',all.count,'人','实际班级名单，不假定每班20人')}${stat('已观测作答事件',all.summary.events,'次','按事件最高修订版本归并后')}${stat('有效评分记录',all.summary.scored,'条',`待评分 ${all.summary.pending} · 未作答 ${all.summary.unanswered}`)}${stat('已记录题目得分',pct(all.summary.rate),'',`加权得分 ${score(all.summary)}，不代表整份试卷`)}</div>`+
      `<div class="two-col"><section class="panel"><div class="panel-header"><h2>班级主题表现</h2><div>${cs.map((c,i)=>`<span class="dot-legend ${i?'alt':''}">${esc(c.id)} · ${c.count}人</span>`).join('')}</div></div>${db.topics.map(t=>`<div class="bar-group"><div class="bar-label"><span>${esc(t.name)}</span><span class="muted tiny">已评分题目加权得分率</span></div>${cs.map((c,i)=>{const s=c.topics.find(x=>x.id===t.id);return `<div class="bar-row"><span>${esc(c.id)}</span>${bar(s,i?'alt':'')}<strong>${pct(s.rate)}</strong></div><div class="bar-detail">${esc(c.id)}：${score(s)} · ${s.scored}条评分 · 覆盖${s.coveredStudents}/${c.count}人</div>`;}).join('')}</div>`).join('')}<div class="notice">两个班题目组合与记录覆盖不同，差异不等于能力高低，也不能解释为教学效果。N01未教方程组和不等式，不能直接与N02总分比较。</div></section><section class="panel"><div class="panel-header"><h2>下一次教学，先关注什么？</h2>${badge('步骤证据','amber')}</div><ul class="insight-list">${steps.map((s,i)=>`<li><span class="insight-index">0${i+1}</span><div><strong>${esc(s.label)}</strong><p>${qbtn(s.qid)} · ${s.firstLoss}/${s.count}条过程在此首次失分，涉及${s.firstStudents.length}名学生。</p><p>${firstStep(s)?'这是该题第一步：先请学生复述题意、圈出数量关系，再用同指标新题检验。':'此前评分点均已得分，失分从这一步开始：先展示匿名原过程，再用同指标新题检验。'}</p>${(pages=>pages?`<div class="page-links">${pages.map(pageLink).join('')}</div>`:'')(stepPages(db.materials.get(s.qid)?.['指标编号'],s.label))}</div></li>`).join('')||'<li>当前没有可分析的解题过程，建议先补充观察。</li>'}</ul><div class="notice">分点评分具有依赖性：后续零分可能由前一步错误造成，不把三个零分当成三个独立知识缺陷。</div></section></div>`+
      `<div class="section-title"><h2>三种表现，三条不同的学习路径</h2><small>代表性案例 · 可查阅全部学生</small></div><div class="three-col">${cases.map((c,i)=>{const r=E.studentReport(db,c.id);return `<article class="panel case-card" data-student="${esc(c.id)}" tabindex="0" role="button" aria-label="查看${esc(c.id)}案例">${badge(c.type,i===2?'amber':i===1?'':'blue')}<div class="student-id">${esc(c.id)} <span class="muted tiny">${esc(r.student['模拟班级编号'])}</span></div><p>${esc(c.subtitle)}</p><small class="muted">${adjusted()?'选择规则（v0基线）：':'选择规则：'}${esc(c.rule)}</small><div class="case-bottom"><span>${r.summary.scored}条评分 · ${score(r.summary)}</span><span>查看证据 ↗</span></div></article>`;}).join('')}</div>${(()=>{const cc=[...new Set(cases.map(c=>db.students.get(c.id)['模拟班级编号']))];return cc.length===1&&classes().length>1?`<div class="notice">三名案例按证据类型自动选出，恰好均来自${esc(cc[0])}；不代表${esc(cc[0])}整体水平，其他班级见上方班级层面分析。</div>`:'';})()}`+
      `<div class="section-title"><h2>可比题目上的两次表现</h2><small>仅匹配同一学生、同一题目、两次均有效评分</small></div><div class="two-equal">${cs.map(c=>{const r=E.comparison(db,null,'N01','N02',c.id);return `<div class="panel"><h3>${esc(c.id)}</h3><div class="stat-value">${r.pairs?`${pct(r.before.rate)} → ${pct(r.after.rate)}`:'暂无配对证据'}</div><p class="muted tiny">${r.pairs}对记录 · ${r.students}名学生 · ${r.questions}道相同题目；N01 ${score(r.before)}，N02 ${score(r.after)}。</p><div class="notice">配对只描述这些学生在这些题上的变化，仍受重复练习、题目覆盖和记录选择影响；不能推广为整体进步或因果结论。</div></div>`;}).join('')}</div><div class="notice">${qualityShort()} ${btn('查看完整质量审计 ↗','data-go="quality"','text')}</div>`;
  }
  function indicatorRows(report){return report.indicators.map(i=>{const status=i.scored===0?'未观测':i.scored<rules.minScored||i.distinct<rules.minDistinct?'证据有限':i.rate<rules.consolidate?'巩固观察':'已有较好表现';return `<div class="indicator-row"><div class="indicator-row-head"><span>${esc(i['指标编号'])} · ${esc(i['观察指标'])}</span>${badge(status,status==='巩固观察'?'amber':status==='未观测'?'neutral':'')}</div>${bar(i)}<div class="indicator-meta">${i.scored}条有效评分 · ${i.distinct}道题 · ${score(i)}${i.pending?' · 待评分'+i.pending:''}${i.unanswered?' · 未作答'+i.unanswered:''}</div></div>`;}).join('');}
  function genericEvidence(r){const first=r.defs.find(p=>r.pointValues[p.id]<p.max);return r.validProcess?`已有过程与分点评分${first?`在“${first.label}”首次失分；需与原文核对，不把后续失分直接视为独立问题。`:'显示所有评分点满分，支持此题已有表现；迁移能力仍需另一题观察。'}`:'该题无可用步骤证据，只描述最终作答与评分状态，不推断错误原因。';}
  function evidenceCard(r,note){
    const first=r.defs?.find(p=>r.pointValues[p.id]<p.max);
    return `<article class="evidence-card"><div class="evidence-card-header"><span>${ref(r['记录编号'])} <span class="muted tiny">${esc(r['材料编号'])} · ${esc(r['节点编号'])} · v${esc(r['修订版本'])}</span></span>${badge(r.validScore?`${r.score}/${r.max}`:r['评分状态'],r.validScore&&r.score<r.max?'amber':'')}</div><p>${esc(r.q['题干或内容'])}</p><div class="muted tiny">学生最终作答</div><pre>${esc(r['学生最终作答']||'未提供')}</pre>${r['解答过程']?`<details><summary class="tiny">展开学生解答过程</summary><pre>${esc(r['解答过程'])}</pre></details>`:''}<div class="score-points">${(r.defs||[]).map(p=>`<span class="score-point ${r.pointValues[p.id]<p.max?(first&&p.id!==first.id?'dependent':'lost'):''}">${esc(p.id)} ${r.pointValues[p.id]??'—'}/${p.max}</span>`).join('')}</div><p>${esc(note?.finding||genericEvidence(r))}</p>${note?.related?.length?`<div class="related-records"><span class="muted tiny">同类记录</span>${note.related.map(([id,t])=>`<span class="related-item">${ref(id)}<span class="tiny">${esc(t)}</span></span>`).join('')}</div>`:''}${note?.uncertain?`<small>尚不能确定：${esc(note.uncertain)}</small>`:''}</article>`;
  }
  function renderCases(){
    const r=E.studentReport(db,student,node), notes=isDefault&&node==='all'?C.caseNotes[student]:null, cases=baseCases;
    const others=[cmpB,cmpC].filter((x,i,a)=>x&&x!==student&&db.students.has(x)&&a.indexOf(x)===i).map(id=>E.studentReport(db,id,node));
    const series=[{label:student,color:SERIES[0],values:indicatorValues(r)},...others.map((o,i)=>({label:o.id,color:SERIES[i+1],values:indicatorValues(o)}))];
    const ids=[...db.students.keys()],idx=ids.indexOf(student),prevStu=ids[(idx-1+ids.length)%ids.length],nextStu=ids[(idx+1)%ids.length];
    const evidence=notes?notes.evidence.map(n=>({r:r.records.find(r=>r['记录编号']===n.record),note:n})).filter(x=>x.r):[...r.records].sort((a,b)=>Number(b.validProcess)-Number(a.validProcess)||a.score/a.max-b.score/b.max).slice(0,5).map(r=>({r}));
    return heading('学生的表现，有迹可循','从评分摘要走进解答过程，再区分观察、推断和仍待确认的部分。',filters(true))+banner('；下方固定案例叙述基于v0基线数据，最新分流以“个性化学习建议”页为准')+
      `<div class="case-tabs">${cases.map(c=>`<button class="case-tab ${student===c.id?'active':''}" data-student="${esc(c.id)}">${esc(c.id)} · ${esc(c.type)}</button>`).join('')}</div><div class="student-hero"><span class="student-tag">${esc(student.slice(-2))}</span><div><h1>${esc(student)} ${badge(notes?'正式展示案例':'个体分析')}</h1><small>${esc(r.student['模拟班级编号'])} · 七年级 · 当前${node==='all'?nodeWord()+'综合':esc(node)}观察</small></div><div class="student-nav"><span class="muted tiny">第 ${idx+1} / ${ids.length} 位</span><div>${btn('‹ 上一位',`data-student="${esc(prevStu)}"`,'small')}${btn('下一位 ›',`data-student="${esc(nextStu)}"`,'small')}</div></div></div><div class="stats">${stat('有效评分',r.summary.scored,'条',`${r.summary.events}个已观测事件`)}${stat('已记录题目得分',score(r.summary),'',pct(r.summary.rate)+' · 非整份试卷成绩')}${stat('不同题目覆盖',r.summary.distinct,'道','同题跨节点不算新题目')}${stat('部分得分',r.summary.partial,'条',`待评分 ${r.summary.pending} · 未作答 ${r.summary.unanswered}`)}</div>`+
      `<div class="two-col insight-grid"><section class="panel"><div class="panel-header"><h2>学情简介</h2>${badge('规则化证据摘要','neutral')}</div><div class="narrative">${studentNarrative(r)}</div><div class="plan-actions">${btn('查看该生的巩固建议 ↗','data-go="plans"','primary')}</div></section><section class="panel"><div class="panel-header"><h2>九项能力雷达</h2><small>0—100% 加权得分率</small></div>${compareControls()}${radarChart(radarAxes(),series,'学生能力雷达图')}${compareTable(r,others)}</section></div>`+
      causePanel(r.records,'错题与错因分析')+
      `${notes?`<div class="notice green"><strong>${esc(notes.headline)}</strong><br>${esc(notes.selection)}</div>`:''}<div class="profile-grid"><div><section class="panel"><div class="panel-header"><h2>九项要求的证据覆盖</h2>${badge('观察，不贴能力标签')}</div>${indicatorRows(r)}<div class="notice">“证据有限”采用少于${rules.minScored}条评分或少于${rules.minDistinct}道不同题的展示规则${JSON.stringify(rules)!==JSON.stringify({...E.DEFAULT_RULES})?'（教师已调整阈值，默认3条、2道）':''}，不是心理测量标准；教师应结合过程、题型与课内观察判断。</div></section><section class="panel"><h2>${db.nodes.size===2?'两个':db.nodes.size+'个'}测验节点</h2>${r.nodes.map(n=>`<div class="timeline-item"><span class="timeline-number">${esc(n.id.slice(-1))}</span><div><strong>${esc(n.id)} · ${esc(db.nodes.get(n.id)['模拟测验日期'])}</strong><p>${n.scored}条评分 · ${score(n)} · ${n.events}个事件</p><p>${esc(db.nodes.get(n.id)['说明'])}</p></div></div>`).join('')}<div class="notice">无事件不等于缺考或未作答；题本不同，不能直接用总得分差推断进步。</div></section></div><div><section class="panel"><div class="panel-header"><h2>关键作答与分析</h2><small>原记录 → 首个失分点 → 观察边界</small></div>${evidence.map(x=>evidenceCard(x.r,x.note)).join('')||'<div class="empty">该范围没有记录，建议补充观察，不给掌握等级。</div>'}</section><section class="panel"><h2>下一步，怎么学？</h2>${sinceBase(student)}${notes?`<div class="timeline-item"><span class="timeline-number">1</span><div><strong>材料与顺序</strong><p>${esc(notes.plan.material)}</p></div></div><div class="timeline-item"><span class="timeline-number">2</span><div><strong>选择理由</strong><p>${esc(notes.plan.reason)}</p></div></div><div class="timeline-item"><span class="timeline-number">3</span><div><strong>实施与调整条件</strong><p>${esc(notes.plan.observe)}</p></div></div>`:`<p class="muted">根据该学生当前指标覆盖，先补充观察或定点巩固，再以另一道题验证。</p>`}${btn('查看逐级提示与练习 ↗','data-go="plans"','primary')}</section></div></div>`+
      `<div class="section-title"><h2>全部学生 · 可切换查看</h2><small>覆盖多少题，与得分一样重要</small></div><section class="panel">${studentTable()}</section>`;
  }
  function studentTable(){return `<div class="table-wrap"><table><thead><tr><th>学生</th><th>班级</th><th>有效评分</th><th>已记录得分</th><th>不同题目</th><th>不等式证据</th><th>查看</th></tr></thead><tbody>${[...db.students.keys()].map(id=>E.studentReport(db,id,node)).map(s=>{const t=s.topics.find(t=>t.id==='T03');return `<tr><td>${esc(s.id)}</td><td>${esc(s.student['模拟班级编号'])}</td><td>${s.summary.scored}</td><td>${score(s.summary)} <span class="muted">${pct(s.summary.rate)}</span></td><td>${s.summary.distinct}</td><td>${t?.scored||0}条 ${!t?.scored?badge('未观测','neutral'):''}</td><td>${btn('分析 ↗',`data-student="${esc(s.id)}"`,'text')}</td></tr>`;}).join('')}</tbody></table></div>`;}
  function renderGroup(){
    const c=E.classReport(db,classId,node), all=E.classReport(db,'all',node), cs=classes().map(id=>E.classReport(db,id,node));
    const groupRecords=db.records.filter(r=>(classId==='all'||db.students.get(r['学生编号'])?.['模拟班级编号']===classId)&&(node==='all'||r['节点编号']===node));
    const mini=x=>`<section class="panel"><div class="panel-header"><h2>${esc(x.id)} · ${x.count}人</h2><small>${x.summary.scored}条有效评分</small></div>${radarChart(radarAxes(),[{label:x.id,color:x.id===cs[0]?.id?SERIES[0]:SERIES[1],values:x.indicators.map(i=>i.scored?i.rate:null)}],x.id+'班级能力雷达图')}</section>`;
    return heading('班级与全体：把个体证据连成共性问题','按指标汇总各班加权得分率，比较班级差异，再用错因分布定位下一步教学。',filters(false,true))+banner()+
      `<div class="stats">${stat('当前范围学生',c.count,'人',classId==='all'?'两个班合看':'单个班级')}${stat('有效评分',c.summary.scored,'条',`覆盖${c.measuredStudents}人`)}${stat('加权得分率',pct(c.summary.rate),'',score(c.summary))}${stat('失分记录',errorAnalysis(groupRecords).total,'条','有失分且评分有效')}</div>`+
      `<div class="two-col"><section class="panel"><div class="panel-header"><h2>${c.id==='all'?'全体学生':esc(c.id)}能力雷达</h2><small>九项指标加权得分率</small></div>${radarChart(radarAxes(),[{label:c.id==='all'?'全体学生':c.id,color:SERIES[0],values:c.indicators.map(i=>i.scored?i.rate:null)}],'班级能力雷达图')}<div class="notice">雷达值是该指标全部已评分题目的加权得分率；记录少的指标波动大，需结合覆盖人数阅读。</div></section><section class="panel"><div class="panel-header"><h2>${c.id==='all'?'两个班并列速览':'共同优点与共性问题'}</h2>${badge(c.id==='all'?'分班':'班级','blue')}</div><div class="narrative">${c.id==='all'?classBriefs(cs):classNarrative(c)}</div></section></div>`+
      `<div class="section-title"><h2>${cs.length}个班的多边形能力图</h2><small>同一指标口径，分开呈现</small></div><div class="two-equal">${cs.map(mini).join('')}</div>`+
      `<div class="section-title"><h2>班级之间：差异在哪里</h2><small>同指标加权得分率对比</small></div><section class="panel">${classComparison()}</section>`+
      `<div class="section-title"><h2>全体学生：共同优点与共性问题</h2><small>两个班合并后的整体证据</small></div><section class="panel"><div class="narrative">${classNarrative(all)}</div></section>`+
      causePanel(groupRecords,c.id==='all'?'全体错因分布':'班级错因分布');
  }
  function topicTabs(all=false){return `<div class="topic-tabs">${(all?[{id:'all',name:'全部主题'},...db.topics]:db.topics).map(t=>`<button class="topic-tab ${topic===t.id?'active':''}" data-topic="${esc(t.id)}">${esc(t.name)}</button>`).join('')}</div>`;}
  function renderCurriculum(){
    const t=db.topics.find(t=>t.id===topic)||db.topics[0], req=[...db.indicators.values()].filter(i=>i['主题编号']===t.id), src=topicSource(t.id);
    return heading('学习内容与要求','以赛事9项观察指标组织；“对应要求”为整理表述，课标原文另行逐字引用。CR01—CR03是材料整理编号，并非课标原生条目编号。')+topicTabs()+
      `<div class="notice">${esc(C.scope)}</div><div class="link-chain"><span class="chain-node">有理数与运算性质</span><span class="chain-arrow">→</span><span class="chain-node">代数式与整式加减</span><span class="chain-arrow">→</span><span class="chain-node">等式变形／不等式性质</span><span class="chain-arrow">→</span><span class="chain-node">消元／交集／现实模型</span></div>`+
      req.map(i=>{const sp=spec(i['指标编号']),qs=[...db.materials.values()].filter(q=>q['材料类型']==='题目'&&q['指标编号']===i['指标编号']);return `<article class="panel requirement-card"><div class="panel-header"><h2>${esc(i['指标编号'])} · ${esc(i['观察指标'])}</h2>${badge(i['课标整理编号'])}</div><div class="content-row"><div><label>主要学习内容</label>${esc(sp?.content||i['观察指标'])}</div><div><label>对应要求 · 整理表述</label>${esc(sp?.requirement||i['主题目标'])}</div></div>${sp?.standard&&src?`<blockquote class="standard-quote"><label>课标原文 · 正文第${src.printedStandard}页（PDF第${src.standardPage}页）</label>${esc(sp.standard)}</blockquote>`:''}<div class="notice green">必要联系：${esc(sp?.link||'导入数据未提供先修联系，待教师补充。')}</div>${sp?.pages?`<label>教材定位 · 点击打开对应PDF页</label><ul class="page-list">${sp.pages.map(p=>pageItem(p)).join('')}${(sp.prereq||[]).map(p=>pageItem(p,'先修复核')).join('')}</ul>`:''}<label class="muted tiny">登记题目（题号即证据入口）</label><div class="question-chips">${qs.map(q=>qbtn(q['材料编号'])).join('')}</div><div class="source-line">${sourceLinks(t.id)}</div></article>`;}).join('')+
      (src?`<section class="panel"><div class="panel-header"><h2>主题之间的必要联系</h2><small>每条联系均可回到教材原页</small></div><ul class="link-list">${C.links.map(l=>`<li><div class="link-pair"><span class="chain-node">${esc(l.from)}</span><span class="chain-arrow">→</span><span class="chain-node">${esc(l.to)}</span></div><p>${esc(l.quote)}</p><div class="page-links">${l.pages.map(pageLink).join('')}</div></li>`).join('')}</ul></section>`:'')+
      `<section class="panel"><h2>材料选择、核对与范围边界</h2><p class="muted">B05对应代数式与整式加减，B06对应一元一次方程与二元一次方程组，B02对应不等式与不等式组。B07有理数运算只作先修复核资源（正文第41页乘法分配律是去括号的依据），不据整式题错误直接认定有理数运算未掌握。</p><div class="notice">${esc(C.verification)}</div><div class="notice warning">${esc(C.gaps)}</div><div class="notice">B01实数、B03数据、B04几何、B08相交线与平行线不作为本次三个主题的核心材料。教材章节以提供的切片为准，不套用其他版本章节号。</div></section>`;
  }
  function renderPlans(){
    const plans=E.recommend(db,student,node,opts()).filter(p=>topic==='all'||p.topic===topic), notes=isDefault&&node==='all'?C.caseNotes[student]:null;
    const adjustRow=p=>{const t=p.trace.filter(x=>['adjust','override','warn','pending','note'].includes(x.kind));return t.length?`<div class="plan-row adjust-row"><label>调整依据</label><div>${t.map(x=>`<p class="trace-${x.kind}">${esc(x.text)}</p>`).join('')}</div></div>`:'';};
    const base0=node==='all'&&adjusted()?history[0].snapshot:null;
    return heading('让下一步学习，具体可行','建议依次说明依据、材料、顺序、提示与调整条件；不把“记录不足”自动转换为补救教学。',filters(true))+topicTabs(true)+banner()+
      `${node!=='all'&&(feedback.length||overrides.length)?'<div class="notice warning">单个测验节点视图只应用分流阈值；练习复核与教师改判在“综合观察”视图中生效。</div>':''}${notes?`<div class="notice green"><strong>${esc(student)}的整体安排${adjusted()?'（v0基线叙述）':''}</strong><br>${esc(notes.plan.material)}<br>选择理由：${esc(notes.plan.reason)}</div>`:''}<div class="notice">以下是可由教师修改的教学分流规则，而非经标定的掌握等级。优先在已有失分步骤上复核；全对但覆盖少时，仍建议补充观察。每条建议可展开“决策过程与教师调整”，逐步核对阈值、证据与改判。</div>`+
      plans.map(p=>`<article class="panel plan-card" id="plan-${esc(p.id)}"><div class="plan-head"><h3>${esc(p.id)} · ${esc(p.label)}</h3><span class="plan-badges">${modeBadge(p.mode)}${(b=>b&&b.mode!==p.mode?badge('v0基线：'+b.mode,'neutral'):'')(base0?.[student+'|'+p.id])}${p.mode!==p.baseMode?badge('规则初判：'+p.baseMode,'neutral'):''}${p.override?badge('教师改判 '+p.override,'red'):''}${p.prereq?badge('回到先修','amber'):''}</span></div><div class="plan-row"><label>选择依据</label><p>${esc(p.basis)} ${p.records.map(ref).join(' ')}</p></div>${adjustRow(p)}${p.firstLoss?`<div class="plan-row"><label>步骤线索</label><div><p>${esc(p.firstLoss.id)}：${esc(p.firstLoss.label)}。先核对首个失分处，不把后续零分单独归因。</p>${(pages=>pages&&pageKey(pages)!==pageKey(spec(p.id)?.pages)?`<div class="page-links"><span class="muted tiny">这一步对应</span>${pages.map(pageLink).join('')}</div>`:'')(stepPages(p.id,p.firstLoss.label))}</div></div>`:''}<div class="plan-row"><label>材料顺序</label><div>${qbtn(p.card)} <span class="muted">→</span> ${p.practice.map(q=>`<span class="practice-step">${qbtn(q)}<span class="muted tiny">${esc(p.roles[q])}</span></span>`).join(' <span class="muted">→</span> ')||'等待后续教学'}<div class="source-line">${sourceLinks(p.topic)}</div></div></div>${spec(p.id)?.pages?`<div class="plan-row"><label>教材定位</label><div><p class="muted">${{'针对性巩固':'短讲时先读原页的法则或例题，再回到上方题目：','补充观察':'先独立作答，观察到困难后再定点使用：','变式迁移':'比较方法或说明依据时参考：'}[p.mode]||'后续教学时使用：'}</p><div class="page-links">${spec(p.id).pages.map(pageLink).join('')}${p.mode==='针对性巩固'?(spec(p.id).prereq||[]).map(x=>`<span class="muted tiny">先修复核</span>${pageLink(x)}`).join(''):''}</div></div></div>`:''}<div class="plan-row"><label>实施顺序</label><p>${esc(p.sequence)}</p></div><div class="plan-row"><label>调整条件</label><p>${esc(p.adjust)}</p></div>${traceBlock(p)}${!p.mode.includes('未教')?`<div class="plan-actions">${btn('展开分步提示',`data-hints="${esc(p.id)}"`)}${p.practice.length?btn('开始练习与记录',`data-practice="${esc(p.id)}"`,'primary'):''}<span class="muted tiny">提示只引导思考，不给答案；先独立作答。</span></div><div class="hint-list" id="hints-${esc(p.id)}" hidden>${p.hints.map((h,i)=>`<div class="hint-item"><span>提示${i+1}</span>${esc(h)}</div>`).join('')}</div><div id="practice-${esc(p.id)}"></div>`:''}</article>`).join('')||'<div class="empty">当前主题没有可用要求映射。</div>';
  }
  const auditLabels={raw:'原始记录',archived:'历史修订归档',duplicateRows:'完全重复',conflicts:'冲突隔离',latest:'当前事件',scored:'有效评分',pending:'待评分',unanswered:'未作答',invalidScored:'评分异常',issueCount:'质量问题'};
  const modeBadge=m=>badge(m,m==='针对性巩固'?'amber':m==='补充观察'?'blue':m.includes('未教')?'neutral':'');
  const ruleText=r=>`${r.minScored}条／${r.minDistinct}道／${Math.round(r.consolidate*100)}%`;
  const {changeFields,evidenceText}=E;
  function changeItem(d,r){
    const a=d.after,f=changeFields(d),refs=[d.addedRecords.length&&`<span class="muted tiny">新证据</span>${d.addedRecords.map(x=>ref(x)).join('')}`,d.removedRecords.length&&`<span class="muted tiny">移出当前证据</span>${d.removedRecords.map(x=>ref(x)).join('')}`,d.addedFeedback.length&&`<span class="muted tiny">新反馈</span><span class="tiny">${esc(d.addedFeedback.join('、'))}</span>`,d.removedFeedback.length&&`<span class="muted tiny">撤销反馈</span><span class="tiny">${esc(d.removedFeedback.join('、'))}</span>`,d.override&&`<span class="muted tiny">教师改判</span><span class="tiny">${esc(d.override.before||'无')} → ${esc(d.override.after||'无')}</span>`].filter(Boolean);
    return `<article class="change-item"><div class="change-head"><strong>${esc(d.student)} · ${esc(d.indicator)}</strong><span class="muted tiny">${esc(d.label)}</span><span class="mode-shift">${modeBadge(d.before.mode)}${d.before.mode!==a.mode?`<span class="chain-arrow">→</span>${modeBadge(a.mode)}`:'<span class="muted tiny">分流不变</span>'}</span></div>${f.length?`<p class="tiny">${f.map(esc).join(' · ')}</p>`:''}${refs.length?`<div class="related-records">${refs.join('')}</div>`:''}<div class="why"><span class="muted tiny">调整依据</span><p>${esc(evidenceText(a,r))}</p>${a.why.map(w=>`<p>${esc(w)}</p>`).join('')}</div>${btn('查看该条建议 ↗',`data-plan="${esc(d.student)}|${esc(d.indicator)}"`,'text')}</article>`;
  }
  function diffView(diff,delta,r){
    const chips=Object.entries(delta||{}).filter(([,[x,y]])=>x!==y).map(([k,[x,y]])=>`<span class="delta-chip">${auditLabels[k]} ${x} → ${y}</span>`).join('');
    const mv=diff.filter(d=>d.changed.includes('mode')),list=[...mv,...diff.filter(d=>!d.changed.includes('mode'))],tally=Object.entries(mv.reduce((o,d)=>{const k=d.before.mode+' → '+d.after.mode;o[k]=(o[k]||0)+1;return o;},{}));
    return `${chips?`<div class="delta-chips"><span class="muted tiny">数据审计</span>${chips}</div>`:''}<div class="delta-summary"><span><strong>${diff.length}</strong>项建议有变化</span><span>分流改变<strong>${mv.length}</strong>项</span><span>涉及<strong>${new Set(diff.map(d=>d.student)).size}</strong>名学生</span>${tally.map(([k,n])=>badge(`${k}：${n}`,'neutral')).join('')}</div>${list.slice(0,12).map(d=>changeItem(d,r)).join('')||'<div class="empty">没有建议发生变化：新证据未改变任何分流、证据计数或推荐练习。</div>'}${list.length>12?`<details class="more-changes"><summary>展开其余${list.length-12}项变化</summary>${list.slice(12).map(d=>changeItem(d,r)).join('')}</details>`:''}`;
  }
  function stateSummary(){
    const recs=supplements.reduce((n,s)=>n+s.batch.records.length,0),rv=feedback.filter(f=>f['反馈类型']==='练习复核'&&f['复核状态']==='已复核').length,pd=feedback.filter(f=>f['反馈类型']==='练习复核'&&f['复核状态']!=='已复核').length,nt=feedback.length-rv-pd;
    return [recs&&`补充作答记录${recs}条`,rv&&`练习复核${rv}条`,pd&&`待复核${pd}条`,nt&&`学生反馈／课堂观察${nt}条`,overrides.length&&`教师改判${overrides.length}条`,JSON.stringify(rules)!==JSON.stringify({...E.DEFAULT_RULES})&&`阈值${ruleText(rules)}`].filter(Boolean).join(' · ');
  }
  function banner(extra=''){if(!adjusted())return '';const h=history.at(-1);return `<div class="notice adjust-banner"><span><strong>当前为 v${h.v}</strong>（${esc(h.title)}）：${esc(stateSummary())}。统计与建议已按当前证据重算${extra}。</span>${btn('查看调整过程 ↗','data-page="adjust"','text')}</div>`;}
  function sinceBase(id){
    if(history.length<2||!adjusted())return '';
    const list=E.diffSnapshots(history[0].snapshot,history.at(-1).snapshot).filter(d=>d.student===id);
    if(!list.length)return `<div class="notice">相对v0基线，${esc(id)}的建议没有变化。</div>`;
    const fbTag=x=>{const f=feedback.find(y=>y['反馈编号']===x);return x+(!f?'':f['反馈类型']!=='练习复核'?'（参考）':f['复核状态']!=='已复核'?'（待复核）':'');};
    return `<div class="notice green since-base"><strong>相对v0基线的变化 · ${list.length}项</strong>${list.map(d=>{const f=[...changeFields(d),d.addedFeedback.length&&`新反馈 ${d.addedFeedback.map(fbTag).join('、')}`,d.override&&`教师改判 ${d.override.before||'无'} → ${d.override.after||'无'}`].filter(Boolean);return `<div class="since-item"><span>${esc(d.indicator)} ${esc(d.label)}</span><span class="mode-shift">${modeBadge(d.before.mode)}${d.before.mode!==d.after.mode?`<span class="chain-arrow">→</span>${modeBadge(d.after.mode)}`:'<span class="muted tiny">分流不变</span>'}</span>${btn('依据 ↗',`data-plan="${esc(d.student)}|${esc(d.indicator)}"`,'text')}${f.length?`<span class="since-detail tiny muted">${esc(f.join(' · '))}</span>`:''}</div>`;}).join('')}</div>`;
  }
  const kindLabel={rule:'规则',result:'初判',feedback:'复核',adjust:'调整',pending:'待复核',note:'参考',warn:'提醒',override:'改判'};
  function traceBlock(p){
    const canOverride=node==='all'&&!p.mode.includes('未教'),id=esc(p.id);
    return `<details class="trace-box"><summary>决策过程与教师调整 · ${p.trace.length}步${p.feedback.length?` · 反馈${p.feedback.length}条`:''}${p.override?' · 已改判':''}</summary><ol class="trace-list">${p.trace.map(x=>`<li class="trace-${x.kind}"><span class="trace-kind">${kindLabel[x.kind]||esc(x.kind)}</span><span>${esc(E.traceLine(x))}</span></li>`).join('')}</ol>${p.evidence.records.length?`<div class="related-records"><span class="muted tiny">证据记录 ${p.evidence.records.length}条</span>${p.evidence.records.map(x=>ref(x)).join('')}</div>`:''}${canOverride?`<div class="override-form"><label class="tiny" for="ov-mode-${id}">教师改判为</label><select id="ov-mode-${id}">${options(E.MODES.filter(m=>m!==p.ruleMode).map(m=>[m,m]),p.override?p.mode:'')}</select><label class="sr-only" for="ov-reason-${id}">改判理由</label><input id="ov-reason-${id}" maxlength="200" placeholder="改判理由，不少于6个字（如课堂观察）">${btn('保存改判',`data-override="${id}"`,'small')}${p.override?btn('撤销改判 '+esc(p.override),`data-revoke-ov="${esc(p.override)}"`,'small danger'):''}</div><p class="muted tiny">改判覆盖规则结果，同时保留原规则结果与理由；之后若新证据改变规则结果，会提示教师复核该改判。</p>`:node!=='all'?'<p class="muted tiny">单个测验节点视图只应用分流阈值；练习复核与教师改判请切换到综合观察查看和录入。</p>':''}</details>`;
  }
  function reviewForm(f){
    const id=esc(f['反馈编号']),q=db.materials.get(f['材料编号']);
    return `<div class="review-box"><div class="tiny"><strong>${id}</strong> · ${esc(f['学生编号'])} · ${esc(f['指标编号'])} · ${qbtn(f['材料编号'])} <span class="muted">${esc(f['说明'])}</span></div><div class="review-grid"><label>复核结果<select id="rv-result-${id}">${options([['正确','正确'],['部分正确','部分正确'],['错误','错误']],'')}</select></label><label>使用提示级数<select id="rv-hints-${id}">${options([0,1,2,3].map(n=>[String(n),n+'级']),f['使用提示级数']||'0')}</select></label><label>与原失分同类<select id="rv-same-${id}">${options([['否','否'],['是','是']],'否')}</select></label><label>首个失分点<select id="rv-point-${id}">${options([['','无／不适用'],...(q?E.pointDefs(q).map(p=>[p.id,p.id+' '+p.label]):[])],'')}</select></label><label class="wide">复核说明（可选）<input id="rv-note-${id}" maxlength="200" placeholder="如：独立完成，能说明每一步的依据"></label></div><div class="plan-actions">${btn('复核并更新建议',`data-review="${id}"`,'small primary')}<span class="muted tiny">复核后才参与调整；不改动测验评分</span></div></div>`;
  }
  function renderAdjust(){
    const h=history.at(-1),view=history[viewVersion]||h,pend=feedback.filter(f=>f['反馈类型']==='练习复核'&&f['复核状态']!=='已复核'),rv=feedback.filter(f=>f['反馈类型']==='练习复核'&&f['复核状态']==='已复核').length;
    const done={S1:supplements.some(s=>s.id==='S1'),S2:supplements.some(s=>s.id==='S2'),S3:feedback.some(f=>f['反馈编号']==='FB01'),S4:overrides.some(o=>o['改判编号']==='OV01')};
    const steps=[...DEMO.steps.map(s=>({key:s.key,title:s.title,desc:s.desc,done:done[s.key],off:!isDefault||(s.key==='S2'&&!done.S1)})),{key:'R2',title:'阈值试算：有效评分阈值 3 → 2',desc:'只预览不生效：看放宽证据门槛会让多少建议改变，再由教师决定是否应用。',done:false,off:!isDefault||rules.minScored===2}];
    const ledger=[...feedback.map(f=>[f['反馈编号'],`${f['学生编号']} · ${f['指标编号']}${f['材料编号']?' · '+f['材料编号']:''}`,f['反馈类型']+(f['结果']?'：'+f['结果']:'')+(f['复核状态']==='已复核'?` · 提示${f['使用提示级数']}级`:''),f['反馈类型']!=='练习复核'?'只作参考，不改变分流':f['复核状态']==='已复核'?'参与调整':'待复核，暂不调整','fb']),...overrides.map(o=>[o['改判编号'],`${o['学生编号']} · ${o['指标编号']}`,`教师改判：${o['规则结果']||'—'} → ${o['调整为']}`,o['理由'],'ov'])];
    return heading('新证据进入，建议随之调整','补充作答记录、练习复核、学生反馈、教师改判或阈值变化进入后，系统重新计算，并逐条说明“哪里变了、依据是什么”。版本只追加不覆盖，可随时回退；全部在本机会话中完成。',`<div class="filters">${btn('导出调整记录 JSON','id="export-history"')}${btn('导出变化明细 CSV','id="export-changes"')}</div>`)+
      `<div class="stats">${stat('当前版本','v'+h.v,'',esc(h.title))}${stat('补充作答记录',supplements.reduce((n,s)=>n+s.batch.records.length,0),'条',`${supplements.length}批 · 当前有效评分 ${db.audit.scored}`)}${stat('已复核练习',rv,'条',`待复核 ${pend.length} · 反馈与观察 ${feedback.length-rv-pend.length}`)}${stat('教师改判',overrides.length,'条','分流阈值 '+ruleText(rules))}</div>`+
      `<div class="two-equal"><section class="panel"><div class="panel-header"><h2>演示：建议如何随证据调整</h2>${badge('演示样例 · 非赛方数据','amber')}</div><div class="notice warning">${esc(DEMO.notice)}</div>${steps.map((s,i)=>`<div class="demo-step ${s.done?'done':''}"><span class="timeline-number">${i+1}</span><div><strong>${esc(s.title)}</strong><p>${esc(s.desc)}</p></div>${s.done?badge('已应用'):btn(s.key==='R2'?'预览影响':'应用',`data-demo="${s.key}" ${s.off?'disabled':''}`,'small'+(s.off?'':' primary'))}</div>`).join('')}</section>`+
      `<section class="panel"><div class="panel-header"><h2>导入统一提供的补充记录或反馈</h2>${badge('先预览，再应用','blue')}</div><label class="file-drop"><input id="supp-files" type="file" accept=".csv" multiple><span>补充作答记录／测验节点 CSV<br><small class="muted">字段与赛题“作答记录”“测验节点”一致；同一作答事件的新修订版本会自动归档旧版本</small></span></label><label class="file-drop"><input id="feedback-files" type="file" accept=".csv,.json" multiple><span>练习复核／学生反馈／教师改判 CSV，或学生练习 JSON<br><small class="muted">练习 JSON 进入“待复核”，教师复核后才参与调整</small></span></label><div class="plan-actions"><span class="muted tiny">下载字段模板</span>${[['records','作答记录'],['nodes','测验节点'],['feedback','反馈'],['override','改判']].map(([k,t])=>btn(t,`data-template="${k}"`,'small')).join('')}</div>${note?`<div class="notice ${noteBad?'warning':'green'}">${esc(note)}</div>`:''}<div class="divider"></div><h3>分流阈值（教师可调）</h3><div class="rule-grid"><label>有效评分 ≥<input id="rule-min-scored" type="number" min="1" max="10" step="1" value="${rules.minScored}">条</label><label>不同题目 ≥<input id="rule-min-distinct" type="number" min="1" max="10" step="1" value="${rules.minDistinct}">道</label><label>巩固线<input id="rule-consolidate" type="number" min="50" max="95" step="5" value="${Math.round(rules.consolidate*100)}">%</label></div><div class="plan-actions">${btn('预览影响','id="preview-rules"','primary')}${btn('恢复默认 3条／2道／75%','id="reset-rules"')}</div><p class="muted tiny">阈值是教学分流规则，不是掌握等级标准。修改后先预览影响范围，确认后才生效。</p></section></div>`+
      (preview?`<section class="panel preview-panel" id="preview-panel"><div class="panel-header"><h2>预览 · ${esc(preview.title)}</h2>${badge('尚未生效','amber')}</div><p class="muted">${esc(preview.detail||'')}</p>${diffView(preview.diff,preview.delta,preview.b.s.rules)}<div class="plan-actions">${btn(`确认应用，生成 v${history.length}`,'id="apply-preview"','primary')}${btn('放弃','id="discard-preview"')}</div></section>`:'')+
      `<section class="panel version-panel" id="version-diff"><div class="panel-header"><h2>v${view.v} · ${esc(view.title)}</h2><small>${esc(view.time)}${view.v?` · 与 v${view.v-1} 相比`:''}</small></div>${view.v?`<p class="muted">${esc(view.detail||'')}</p>${diffView(view.diff,view.delta,view.state.rules)}`:'<div class="empty">v0 为基线：赛事公开模拟数据、默认阈值，无补充记录、反馈或改判。可运行左侧演示，或导入统一提供的补充记录与反馈。</div>'}</section>`+
      `<div class="two-equal"><section class="panel"><div class="panel-header"><h2>版本记录</h2><small>只追加，不覆盖</small></div><ol class="version-list">${[...history].reverse().map(x=>`<li class="${x.v===view.v?'viewing':''}"><div><strong>v${x.v} · ${esc(x.title)}</strong><p class="muted tiny">${esc(x.time)} · ${x.v?`${x.diff.length}项建议变化，分流改变${moved(x)}项`:'基线'}</p></div><div class="plan-actions">${btn('查看变化',`data-version="${x.v}"`,'small')}${x.v===h.v?badge('当前'):btn('回退至此',`data-rollback="${x.v}"`,'small')}</div></li>`).join('')}</ol></section>`+
      `<section class="panel"><div class="panel-header"><h2>反馈与改判台账</h2><small>只有已复核的练习复核参与调整</small></div>${pend.length?`<h3>待复核 · ${pend.length}条</h3>${pend.map(reviewForm).join('')}`:''}<div class="table-wrap"><table><thead><tr><th>编号</th><th>学生 · 指标</th><th>类型与结果</th><th>作用</th><th></th></tr></thead><tbody>${ledger.map(([id,a,b,c,k])=>`<tr><td>${esc(id)}</td><td>${esc(a)}</td><td>${esc(b)}</td><td class="tiny">${esc(c)}</td><td>${btn('撤销',`data-revoke-${k}="${esc(id)}"`,'small danger')}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">暂无反馈或改判</td></tr>'}</tbody></table></div></section></div>`;
  }
  function renderLibrary(){
    const qs=[...db.materials.values()].filter(q=>(topic==='all'||q['主题编号']===topic||q['材料类型']==='教材')&&(type==='all'||q['材料类型']===type||q['题型']===type)&&(!search||[q['材料编号'],q['题干或内容'],q['指标编号'],q['评分点']].some(x=>String(x??'').toLowerCase().includes(search.toLowerCase()))));
    return heading('题目与学习材料','全部54道题、3张学习卡与8份教材切片可检索；题目及学习卡来自赛事新编，所有资源均使用原登记编号。',`<div class="filters"><label class="sr-only" for="material-search">搜索题号或内容</label><input id="material-search" value="${esc(search)}" placeholder="搜索题号、内容、评分点或指标"><label class="sr-only" for="type-select">筛选题型</label><select id="type-select">${options([['all','全部材料'],['选择题','选择题'],['填空题','填空题'],['解答题','解答题'],['学习卡','学习卡'],['教材','教材']],type)}</select></div>`)+topicTabs(true)+
      `<div class="section-title"><h2>找到 ${qs.length} 个材料</h2><small>教师解析与学生提示分开呈现</small></div>`+qs.map(q=>`<article class="panel material-card"><div class="panel-header"><span>${badge(q['材料编号'])} ${badge(q['题型']||q['材料类型'],'neutral')} ${q['指标编号']?badge(q['指标编号'],'blue'):''}</span>${q['材料类型']==='教材'?`<a class="button small" target="_blank" rel="noopener" href="${esc(sourceHref(q['材料编号']))}">打开原切片 ↗</a>`:btn(q['材料类型']==='题目'?'查看题目与评分点 ↗':'查看学习卡 ↗',`data-question="${esc(q['材料编号'])}"`,'small')}</div><h3>${esc(q['题干或内容'])}</h3>${q['选项']?`<pre class="process-block">${esc(q['选项'])}</pre>`:''}<small>来源：${esc(q['来源或资料文件'])}${q['满分']?' · 满分'+esc(q['满分']):''}</small></article>`).join('');
  }
  function renderQuality(){
    const a=db.audit, issues=a.issues, recs=new Set(issues.map(i=>i.record));
    const unobserved=[...db.students.keys()].map(id=>E.studentReport(db,id)).filter(s=>s.topics.some(t=>!t.events));
    const rawStates=Object.entries(db.raw['作答记录'].reduce((o,r)=>(o[r['评分状态']]=(o[r['评分状态']]||0)+1,o),{}));
    return heading('先理解数据，再理解学生','保留原始记录，公开纳入与排除口径；同一数据可复算，不自动修正异常答案或评分。',btn('导出当前分析 JSON','id="export-button"','primary'))+banner()+
      `<div class="flow-stats"><div class="flow-step"><strong>${a.raw}</strong><span>原始行</span></div><span class="flow-arrow">→</span><div class="flow-step"><strong>${a.archived.length}</strong><span>历史修订归档</span></div><span class="flow-arrow">→</span><div class="flow-step"><strong>${a.conflicts.length}</strong><span>结构／版本冲突隔离</span></div><span class="flow-arrow">→</span><div class="flow-step"><strong>${a.latest}</strong><span>可分析当前事件</span></div><span class="flow-arrow">→</span><div class="flow-step"><strong>${a.scored}</strong><span>有效评分进入统计</span></div></div>`+
      `<div class="two-equal"><section class="panel"><h2>纳入与处理规则</h2><ol class="quality-rules"><li>按学生、材料和节点关联，验证事件标识、题目主题、节点可用题范围；结构矛盾暂隔离，不自行改为“正确”主题。</li><li>同一作答事件取最高修订版本，旧版本保留在审计列表。若最高版本待评分，不回退旧评分；同版本内容冲突暂停该事件。</li><li>完全重复行只计一次，记录编号内容冲突拒绝导入。跨节点同一道题是两次观察，不作为重复记录删除。</li><li>已评分须为范围内整数，满分与题目一致，评分点完整、分值合法且和总分一致；不一致的总分与过程均暂停使用。</li><li>待评分与未作答不计入得分分母，不填补为0。没有作答事件与显式“未作答”分开；不假定可用题目就是人人必答题。</li><li>只有过程与评分点可用时才定位步骤。首次失分及下游依赖性失分分开描述，不进行自动心理归因。</li></ol></section><section class="panel"><h2>缺失与覆盖</h2><table><thead><tr><th>字段／状态</th><th>原始行数量</th><th>解释</th></tr></thead><tbody><tr><td>得分为空</td><td>${a.empty['得分']}</td><td>状态允许的空值不补零</td></tr><tr><td>最终作答为空</td><td>${a.empty['学生最终作答']}</td><td>结合评分状态解释</td></tr><tr><td>解答过程为空</td><td>${a.empty['解答过程']}</td><td>客观题不要求过程，非全为缺失</td></tr><tr><td>评分点为空</td><td>${a.empty['评分点得分']}</td><td>未评分状态允许为空</td></tr>${rawStates.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td><td>归并前状态计数</td></tr>`).join('')}</tbody></table><div class="notice">当前有效事件：待评分${a.pending}条，未作答${a.unanswered}条，已评分但异常${a.invalidScored}条。已评分解答题过程缺失${a.missingProcess}条；空过程字段总数不能直接视为学习过程缺失。</div><div class="notice warning">N01不含方程组与不等式；${unobserved.length}名学生至少一个主题没有作答事件。不计算“未覆盖题目＝错误”，也不推测缺少记录的原因。</div></section></div>`+
      `<div class="section-title"><h2>异常记录 · ${recs.size}条记录 / ${issues.length}项问题</h2><small>不改原件 · 教师复核后重新导入</small></div><section class="panel"><div class="table-wrap"><table><thead><tr><th>记录</th><th>事件</th><th>问题</th><th>处理</th></tr></thead><tbody>${issues.map(i=>`<tr><td>${ref(i.record)}</td><td>${esc(i.event)}</td><td>${esc(i.type)}</td><td>${esc(i.detail)}</td></tr>`).join('')||'<tr><td colspan="4">未发现数值或结构异常</td></tr>'}</tbody></table></div></section>`+
      `<div class="section-title"><h2>历史修订与重复审计</h2><small>旧版本${a.archived.length}条 · 完全重复${a.duplicateRows.length}条</small></div><section class="panel"><div class="table-wrap"><table><thead><tr><th>事件</th><th>旧记录</th><th>版本 / 旧分</th><th>当前记录</th><th>处理</th></tr></thead><tbody>${a.archived.map(r=>`<tr><td>${esc(r.event)}</td><td>${ref(r.record)}</td><td>v${esc(r.version)} / ${esc(r.score||'空')}</td><td>${ref(r.latest)}</td><td>旧行保留、不重复纳入</td></tr>`).join('')||'<tr><td colspan="5">没有历史修订记录</td></tr>'}</tbody></table></div>${a.duplicateRows.length?`<div class="notice">完全重复记录：${a.duplicateRows.map(r=>esc(r['记录编号'])).join('、')}</div>`:''}</section>`+
      `<div class="section-title"><h2>来源与复算</h2><small>仅本地读取 · 原件未修改</small></div><section class="panel"><div class="table-wrap"><table><thead><tr><th>数据文件</th><th>逻辑数据行</th><th>SHA-256（原始字节）</th></tr></thead><tbody>${(payload.manifest||[]).map(m=>`<tr><td>${esc(m.name)}</td><td>${m.rows}</td><td class="tiny numeric">${esc(m.sha256||'浏览器导入，未记录哈希')}</td></tr>`).join('')}${supplements.map(s=>`<tr><td>${esc(s.name)} ${badge(s.source==='demo'?'演示样例，非赛方数据':'本地导入',s.source==='demo'?'amber':'blue')}</td><td>${s.batch.records.length}条记录${s.batch.nodes?.length?` · ${s.batch.nodes.length}个节点`:''}</td><td class="tiny numeric">${esc(s.hash||'演示样例内置，无文件哈希')}</td></tr>`).join('')}</tbody></table></div><div class="notice">独立评测可通过“导入评测CSV”替换当前数据，所有统计与推荐重新计算；固定三名案例叙述只对原赛事数据展示，不套用于新数据。支持导出当前分析JSON，或在学生／建议页面使用浏览器打印保存PDF。</div></section>`;
  }
  function hashOf(){
    const p=new URLSearchParams();
    if(page!=='overview')p.set('page',page);
    if(student!==baseCases[0]?.id)p.set('student',student);
    if(node!=='all')p.set('node',node);
    if(classId!=='all')p.set('class',classId);
    if(topic!=='T01')p.set('topic',topic);
    if(page==='verify'){if(verifyCase!==baseCases[0]?.id)p.set('case',verifyCase);if(verifyCompare&&verifyCompare!==baseCases[1]?.id)p.set('compare',verifyCompare);}
    const s=p.toString();return s?'#'+s:'#overview';
  }
  function applyHash(){
    const raw=location.hash.slice(1);
    if(!raw||raw==='overview'){page='overview';return false;}
    const p=new URLSearchParams(raw.includes('=')?raw:'page='+raw),pg=p.get('page');
    if(pg&&labels[pg])page=pg;
    const s=p.get('student');if(s&&db.students.has(s))student=s;
    const n=p.get('node');if(n==='all'||db.nodes.has(n))node=n;
    const c=p.get('class');if(c==='all'||classes().includes(c))classId=c;
    const t=p.get('topic');if(t==='all'||db.topics.some(x=>x.id===t))topic=t;
    const vc=p.get('case');if(vc&&db.students.has(vc))verifyCase=vc;
    const cp=p.get('compare');if(cp&&db.students.has(cp)&&cp!==verifyCase)verifyCompare=cp;
    return true;
  }
  function render(){
    const focusId=document.activeElement?.tagName==='SELECT'?document.activeElement.id:'';
    $('#main').innerHTML=({overview:renderOverview,cases:renderCases,group:renderGroup,verify:renderVerify,curriculum:renderCurriculum,plans:renderPlans,adjust:renderAdjust,library:renderLibrary,quality:renderQuality}[page])();
    $('#page-label').textContent=labels[page];
    document.querySelectorAll('.nav-item').forEach(b=>{const on=b.dataset.page===page;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    const h=history.at(-1);
    $('#case-count').textContent=baseCases.length;$('#version-count').textContent='v'+h.v;
    $('#version-badge').textContent=`v${h.v} · ${adjusted()?'已调整':'基线'}`;$('#version-badge').className='badge '+(adjusted()?'amber':'neutral');
    $('#dataset-badge').textContent=payload.label;
    const target=hashOf();
    if(location.hash!==target)pushNext?window.history.pushState(null,'',target):window.history.replaceState(null,'',target);
    pushNext=false;
    $('#main').classList.remove('page-enter');void $('#main').offsetWidth;$('#main').classList.add('page-enter');
    if(focusId){const el=document.getElementById(focusId);if(el)el.focus({preventScroll:true});}
  }
  function navigate(p){page=p;search='';practice=null;pushNext=true;render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}
  function stepStudent(step){
    if(page==='verify'){
      const list=baseCases.map(c=>c.id);if(list.length<2)return;
      let i=list.indexOf(verifyCase);if(i<0)i=0;
      verifyCase=list[(i+step+list.length)%list.length];
      if(verifyCompare===verifyCase)verifyCompare=list[(i+step*2+list.length)%list.length]||list[(i+1)%list.length];
      render();return;
    }
    const ids=[...db.students.keys()];if(ids.length<2)return;
    const i=ids.indexOf(student);student=ids[(i+step+ids.length)%ids.length];
    if(page!=='cases'){page='cases';pushNext=true;}
    render();window.scrollTo({top:0,behavior:'instant'});
  }
  function openQuestion(id,record){
    const q=db.materials.get(id);if(!q)return;
    $('#evidence-title').textContent=(record?'作答证据 · '+record['记录编号']:'登记材料 · '+id);
    let html=`<div class="panel-header">${badge(q['材料类型'])} ${badge(q['指标编号']||'教材','neutral')}<span class="tiny muted">${esc(q['满分']?'满分 '+q['满分']:'')}</span></div><h2 class="question-title">${esc(q['题干或内容'])}</h2>${q['选项']?`<pre class="process-block">${esc(q['选项'])}</pre>`:''}`;
    if(record){const defs=E.pointDefs(q),pv=Object.fromEntries(E.split(record['评分点得分']).map(s=>s.split('='))),first=defs.find(p=>Number(pv[p.id])<p.max);html+=`<div class="notice">${esc(record['学生编号'])} · ${esc(record['节点编号'])} · v${esc(record['修订版本'])} · ${esc(record['模拟提交时间'])}<br>${esc(record['评分状态'])} · 原记录得分 ${esc(record['得分']||'空')}/${esc(record['满分'])}<br>状态：${record.validScore?'有效评分证据':record.validScore===false?'不纳入得分统计':'历史版本／异常行，保留原始内容但不纳入当前统计'}</div><h3>学生最终作答</h3><pre class="process-block">${esc(record['学生最终作答']||'未提供')}</pre><h3>学生解答过程</h3><pre class="process-block">${esc(record['解答过程']||'未提供；不能据最终答案推断步骤')}</pre><h3>分点评分（原始记录）</h3><pre class="process-block">${esc(record['评分点得分']||'未提供')}</pre>${first?`<div class="notice warning">首个失分点：${esc(first.id)} ${esc(first.label)}。后续评分可能依赖此步骤，须结合原文复核。</div>`:''}`;}
    if(q['材料类型']==='题目')html+=`<div class="divider"></div><h3>评分点定义</h3>${E.pointDefs(q).map(p=>`<div class="indicator-row"><strong class="tiny">${esc(p.id)}</strong> · ${esc(p.label)} · ${p.max}分</div>`).join('')}<details style="margin-top:18px"><summary class="record-ref">教师参考答案与解析（不作为学生提示）</summary><pre class="process-block">${esc(q['参考答案'])}\n${esc(q['参考解析'])}</pre></details>`;
    const sp=spec(q['指标编号']);
    html+=`${sp?.pages?`<div class="page-links"><span class="muted tiny">${esc(q['指标编号'])}教材定位</span>${sp.pages.map(pageLink).join('')}</div>`:''}<div class="source-line">来源：${esc(q['来源或资料文件'])}${q['主题编号']?sourceLinks(q['主题编号']):''}</div>`;
    $('#evidence-content').innerHTML=html;
    if(!$('#evidence-dialog').open)$('#evidence-dialog').showModal();
  }
  function openRecord(id){const f=r=>r['记录编号']===id,r=db.records.find(f)||db.raw['作答记录'].find(f)||history.flatMap(h=>h.state.supplements.flatMap(s=>s.batch.records)).find(f);if(r)openQuestion(r['材料编号'],r);}
  function startPractice(iid,index=0){
    const p=E.recommend(db,student,node,opts()).find(p=>p.id===iid);if(!p?.practice[index])return;
    practice={...p,index};practiceHints=0;
    const id=p.practice[index],q=db.materials.get(id),last=index===p.practice.length-1;
    document.getElementById('practice-'+iid).innerHTML=`<div class="practice-panel"><div class="tiny muted">第${index+1}/${p.practice.length}题 · ${esc(p.roles[id])}</div><h3>先独立尝试 · ${esc(id)}</h3><p>${esc(q['题干或内容'])}</p>${q['选项']?`<pre class="process-block">${esc(q['选项'])}</pre>`:''}${p.hintCap!==null?`<div class="notice green">根据已复核练习：${p.hintCap?`本题最多先给${p.hintCap}级提示，逐步撤除`:'本题先不给提示，独立尝试后再按需给一级提示'}。</div>`:''}<label class="tiny" for="practice-answer">请写下答案与过程；教师据过程复核，不自动评分</label><textarea id="practice-answer" rows="5" placeholder="写出每一步，并说明为什么可以这样做。"></textarea><div id="practice-hints"></div>`+
      `<div class="review-box"><div class="tiny"><strong>教师复核</strong> <span class="muted">复核后写入反馈台账并立即重算建议；不改动测验评分。暂不复核则进入“待复核”。</span></div><div class="review-grid"><label>复核结果<select id="review-result">${options([['','暂不复核'],['正确','正确'],['部分正确','部分正确'],['错误','错误']],'')}</select></label><label>与原失分同类<select id="review-same">${options([['否','否'],['是','是']],'否')}</select></label><label>首个失分点<select id="review-point">${options([['','无／不适用'],...E.pointDefs(q).map(x=>[x.id,x.id+' '+x.label])],'')}</select></label><label>复核说明<input id="review-note" maxlength="120" placeholder="如：去括号漏乘常数项"></label></div></div>`+
      `<div class="plan-actions">${btn('我需要一点提示','id="next-hint"')}${btn('记录复核并更新建议','id="commit-practice"','primary')}${btn('导出练习 JSON','id="save-practice"')}${last?'':btn('下一题 →','id="next-practice"')}<span class="practice-status">已用提示 0 级 · 练习不混入两次测验统计</span></div></div>`;
    document.getElementById('practice-'+iid).scrollIntoView({behavior:'smooth',block:'center'});
  }
  function download(data,name,mime='application/json'){
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:mime}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportAnalysis(){const h=history.at(-1),report={dataset:payload.label,manifest:payload.manifest,generatedAt:nowISO(),version:h.v,method:'最高版本；结构异常隔离；评分不一致暂停；仅有效评分题目加权；不将缺失补零',quality:db.audit,curriculum:{scope:C.scope,verification:C.verification,gaps:C.gaps,links:C.links,topics:db.topics.map(t=>({...t,source:topicSource(t.id)})),indicators:[...db.indicators.keys()].map(id=>({id,...(spec(id)||{note:'导入指标与原登记不一致，未附页码'})})),stepPages:{rule:'仅当指标表述与原登记一致时，按评分点名称关键词定位步骤页；未命中时使用指标页',table:C.stepPages.map(([indicatorPrefix,labelPattern,pages])=>({indicatorPrefix,labelPattern,pages}))}},classes:classes().map(c=>E.classReport(db,c)),cases:baseCases,casesNote:adjusted()?'典型案例按v0基线数据选择；当前统计与建议已按调整后的证据重算':'按当前数据选择',students:[...db.students.keys()].map(id=>({analysis:E.studentReport(db,id),recommendations:E.recommend(db,id,'all',{rules,feedback,overrides})})),adjustments:{version:h.v,title:h.title,rules,supplements:supplements.map(s=>({id:s.id,name:s.name,source:s.source==='demo'?'演示样例（非赛方数据）':'本地导入',records:s.batch.records.length,nodes:(s.batch.nodes||[]).map(n=>n['节点编号']),sha256:s.hash||null})),feedback,overrides,history:history.map(x=>({v:x.v,title:x.title,kind:x.kind,time:x.time,detail:x.detail,changes:x.diff.length,modeChanges:moved(x)}))}};download(report,'智慧学伴-学情分析.json');}
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
  const changeLine=(d,r)=>`\n· ${d.student} ${d.indicator} ${d.label}：${d.before.mode}${d.before.mode!==d.after.mode?' → '+d.after.mode:'（分流不变）'}${changeFields(d).length?'；'+changeFields(d).join('，'):''}\n  依据：${evidenceText(d.after,r)}${d.after.why.length?'；'+d.after.why.join('；'):''}`;
  function versionText(x){
    const chips=Object.entries(x.delta||{}).filter(([,[a,b]])=>a!==b).map(([k,[a,b]])=>`${auditLabels[k]}${a}→${b}`).join('，'),list=[...x.diff.filter(d=>d.changed.includes('mode')),...x.diff.filter(d=>!d.changed.includes('mode'))];
    return `v${x.v} · ${x.title}（${x.time}）\n${x.detail||''}${chips?`\n数据审计：${chips}`:''}\n共${x.diff.length}项建议变化，其中${moved(x)}项分流改变。`+list.slice(0,8).map(d=>changeLine(d,x.state.rules)).join('')+(list.length>8?`\n……其余${list.length-8}项见“调整与反馈”页。`:'');
  }
  function answer(text){
    if(!/调整|改判|版本|回退|新证据|补充记录|反馈|改变/.test(text))return E.ask(db,text,student,bookRef,{rules,feedback,overrides});
    const id=(text.match(/D\d{2,}/i)||[])[0]?.toUpperCase(),iid=(text.match(/T0\dI\d/i)||[])[0]?.toUpperCase(),tid=iid?null:/不等/.test(text)?'T03':/方程/.test(text)?'T02':/代数|整式/.test(text)?'T01':null;
    if(history.length<2)return `当前为v0基线（${history[0].title}）：尚无补充记录、练习复核、反馈或教师改判。\n可在“调整与反馈”页运行演示样例或导入统一提供的补充记录；每次调整都会生成新版本，并逐条说明哪里变了、依据是什么。`;
    if(!id)return versionText(history.at(-1))+(history.length>2?`\n\n此前版本：${history.slice(1,-1).reverse().map(x=>`v${x.v} ${x.title}`).join('；')}`:'');
    if(!db.students.has(id))return '没有找到该学生，请使用数据中的学生编号。';
    if(iid&&!db.indicators.has(iid))return '没有找到该观察指标，请使用课程要求中的指标编号（如T01I2）。';
    const scope=[id,iid||db.topics.find(t=>t.id===tid)?.name].filter(Boolean).join(' ');
    const rows=history.slice(1).flatMap(x=>x.diff.filter(d=>d.student===id&&(!iid||d.indicator===iid)&&(!tid||d.indicator.startsWith(tid))).map(d=>`v${x.v} ${x.title}`+changeLine(d,x.state.rules))).slice(-6);
    return rows.length?`${scope} 的调整过程（最近${rows.length}项）\n`+rows.join('\n\n')+'\n\n说明：只有教师已复核的练习复核参与调整；学生反馈与课堂观察只作参考；教师改判保留原规则结果与理由。':`${scope}在v1—v${history.at(-1).v}中没有建议变化。`;
  }
  function ask(text){
    const messages=$('#agent-messages'),user=document.createElement('div'),reply=document.createElement('div');
    user.className='chat-message user';user.textContent=text;reply.className='chat-message assistant';reply.textContent=answer(text);messages.append(user,reply);messages.scrollTop=messages.scrollHeight;
  }
  function focusPlan(iid){const card=document.getElementById('plan-'+iid);if(!card)return;const t=card.querySelector('.trace-box');if(t)t.open=true;card.classList.remove('flash');void card.offsetWidth;card.classList.add('flash');card.scrollIntoView({behavior:'smooth',block:'start'});}
  const csv=(head,rows)=>'\uFEFF'+[head,...rows.map(r=>head.map(k=>r[k]??''))].map(r=>r.map(v=>{v=String(v);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',')).join('\r\n')+'\r\n';
  async function readFiles(files){
    const out=[];
    for(const f of files){
      if(f.size>20*1024*1024)throw new Error(`${f.name}超过单文件20MiB导入边界`);
      const bytes=await f.arrayBuffer();let text;
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error(`${f.name}不是UTF-8编码`);}
      if(!text.replace(/^\uFEFF/,'').trim())throw new Error(`${f.name}为空文件`);
      const hash=globalThis.crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join(''):null;
      out.push({name:f.name,text,hash});
    }
    return out;
  }
  const brief=d=>({mode:d.mode,baseMode:d.baseMode,prereq:d.prereq,scored:d.scored,distinct:d.distinct,score:d.score,max:d.max,pending:d.pending,firstLoss:d.firstLoss,practice:d.practice,feedback:d.feedback,override:d.override});
  function exportHistory(){
    const supp=new Map();history.forEach(x=>x.state.supplements.forEach(s=>supp.set(s.id,{id:s.id,name:s.name,source:s.source==='demo'?'演示样例（团队按赛方字段构造，非赛方数据）':'本地导入',sha256:s.hash||null,nodes:s.batch.nodes||[],records:s.batch.records})));
    download({dataset:payload.label,exportedAt:nowISO(),current:history.at(-1).v,note:'版本只追加不覆盖，回退也生成新版本；只有已复核的练习复核参与调整，学生反馈与课堂观察只作参考；教师改判保留原规则结果与理由；所有调整不改动测验评分。',supplements:[...supp.values()],versions:history.map(x=>({v:x.v,title:x.title,kind:x.kind,time:x.time,detail:x.detail,state:{rules:x.state.rules,supplements:x.state.supplements.map(s=>s.id),feedback:x.state.feedback,overrides:x.state.overrides},audit:{raw:x.audit.raw,archived:x.audit.archived.length,conflicts:x.audit.conflicts.length,latest:x.audit.latest,scored:x.audit.scored,pending:x.audit.pending,unanswered:x.audit.unanswered,issueCount:x.audit.issueCount},delta:x.delta,changes:x.diff.map(d=>({student:d.student,indicator:d.indicator,label:d.label,changed:d.changed,before:brief(d.before),after:brief(d.after),addedRecords:d.addedRecords,removedRecords:d.removedRecords,addedFeedback:d.addedFeedback,removedFeedback:d.removedFeedback,override:d.override,basis:[evidenceText(d.after,x.state.rules),...d.after.why]}))}))},'智慧学伴-调整记录.json');
  }
  function exportChanges(){
    const head=['版本','调整','学生编号','指标编号','观察指标','原分流','新分流','变化字段','新增证据记录','移出记录','新增反馈','撤销反馈','改判','调整依据'];
    const rows=history.slice(1).flatMap(x=>x.diff.map(d=>({'版本':'v'+x.v,'调整':x.title,'学生编号':d.student,'指标编号':d.indicator,'观察指标':d.label,'原分流':d.before.mode,'新分流':d.after.mode,'变化字段':changeFields(d).join('；'),'新增证据记录':d.addedRecords.join('、'),'移出记录':d.removedRecords.join('、'),'新增反馈':d.addedFeedback.join('、'),'撤销反馈':d.removedFeedback.join('、'),'改判':d.override?`${d.override.before||'无'} → ${d.override.after||'无'}`:'','调整依据':[evidenceText(d.after,x.state.rules),...d.after.why].join('；')})));
    if(!rows.length){toast('尚无调整，没有变化明细可导出');return;}
    download(csv(head,rows),'智慧学伴-建议变化明细.csv','text/csv;charset=utf-8');
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('button,[data-student]');if(!el)return;
    if(el.dataset.page)navigate(el.dataset.page);
    if(el.dataset.go)navigate(el.dataset.go);
    if(el.dataset.student){student=el.dataset.student;navigate('cases');}
    if(el.dataset.verify){verifyCase=el.dataset.verify;if(verifyCompare===verifyCase)verifyCompare=baseCases.find(c=>c.id!==verifyCase)?.id||'';render();}
    if(el.dataset.topic){topic=el.dataset.topic;render();}
    if(el.dataset.record)openRecord(el.dataset.record);
    if(el.dataset.question)openQuestion(el.dataset.question);
    if(el.dataset.hints){const box=document.getElementById('hints-'+el.dataset.hints);box.hidden=!box.hidden;el.textContent=box.hidden?'展开分步提示':'收起分步提示';}
    if(el.dataset.practice)startPractice(el.dataset.practice);
    if(el.dataset.ask)ask(el.dataset.ask);
    if(el.id==='export-button')exportAnalysis();
    if(el.id==='next-hint'&&practice){if(practiceHints<practice.hints.length){const p=document.createElement('div');p.className='hint-item';p.textContent='提示'+(++practiceHints)+'：'+practice.hints[practiceHints-1];$('#practice-hints').appendChild(p);$('.practice-status').textContent=`已用提示 ${practiceHints} 级 · 练习不混入两次测验统计`;}if(practiceHints>=practice.hints.length){el.disabled=true;el.textContent='提示已全部展开';}}
    if(el.id==='save-practice'&&practice){const answer=$('#practice-answer').value.trim(),question=practice.practice[practice.index];if(!answer){toast('请先记录实际作答与过程');return;}download({student,question,role:practice.roles[question],indicator:practice.id,answer,hintsUsed:practiceHints,status:'待教师复核',createdAt:nowISO(),dataset:payload.label,includeInTestStatistics:false},`${student}-${question}-补充练习.json`);toast('练习记录已导出，未改动测验评分');}
    if(el.id==='next-practice'&&practice)startPractice(practice.id,practice.index+1);
    if(el.id==='commit-practice'&&practice){
      const answer=$('#practice-answer').value.trim(),q=practice.practice[practice.index],iid=practice.id,result=$('#review-result').value;
      if(!answer){toast('请先记录实际作答与过程');return;}
      const row={'反馈编号':newId('PF'),'学生编号':student,'指标编号':iid,'材料编号':q,'反馈类型':'练习复核','结果':result,'使用提示级数':String(Math.min(3,practiceHints)),'与原失分同类':result==='正确'?'否':$('#review-same').value,'首个失分点':result&&result!=='正确'?$('#review-point').value:'','说明':[$('#review-note').value.trim(),'学生作答：'+answer.slice(0,120)].filter(Boolean).join('｜'),'复核状态':result?'已复核':'待复核','记录时间':nowISO()};
      const a=addFeedback([row],`练习${result?'复核':'提交'}：${student} ${q}`,'教师在练习面板录入');
      if(!a.fresh.length){toast('未记录：'+a.issues.map(i=>i.detail).join('；'));return;}
      toastEntry(commit(a.title,'feedback',a.next,`${student} ${iid} ${q}：${result?`复核为“${result}”，使用提示${row['使用提示级数']}级${row['与原失分同类']==='是'?'，与原失分同类':''}${row['首个失分点']?'，首个失分'+row['首个失分点']:''}`:'练习已提交，待教师复核，暂不调整'}`));focusPlan(iid);
    }
    if(el.dataset.demo){const r=applyDemo(el.dataset.demo);if(r&&r.v!==undefined)toastEntry(r);}
    if(el.dataset.version!==undefined){viewVersion=Number(el.dataset.version);render();reveal('version-diff');}
    if(el.dataset.rollback!==undefined)rollback(Number(el.dataset.rollback));
    if(el.dataset.plan){const [s,iid]=el.dataset.plan.split('|');if(!db.students.has(s))return;student=s;node='all';topic=db.indicators.get(iid)?.['主题编号']||'all';if($('#evidence-dialog').open)$('#evidence-dialog').close();navigate('plans');focusPlan(iid);}
    if(el.dataset.review){
      const id=el.dataset.review,old=feedback.find(f=>f['反馈编号']===id);if(!old)return;
      const g=k=>document.getElementById(`rv-${k}-${id}`)?.value.trim()||'',result=g('result');
      const {items,issues}=E.checkFeedback(db,[{...old,'结果':result,'使用提示级数':g('hints'),'与原失分同类':result==='正确'?'否':g('same'),'首个失分点':result==='正确'?'':g('point'),'说明':`${old['说明']}｜教师复核于${nowISO()}${g('note')?'：'+g('note'):''}`.slice(0,400),'复核状态':'已复核'}]);
      if(!items.length){toast('复核未保存：'+issues.map(i=>i.detail).join('；'));return;}
      const f=items[0];toastEntry(commit(`复核练习 ${id}`,'feedback',{feedback:feedback.map(x=>x===old?f:x)},`${f['学生编号']} ${f['指标编号']} ${f['材料编号']}：待复核 → 已复核（${f['结果']}，提示${f['使用提示级数']}级${f['与原失分同类']==='是'?'，与原失分同类':''}${f['首个失分点']?'，首个失分'+f['首个失分点']:''}）`));
    }
    if(el.dataset.revokeFb){const id=el.dataset.revokeFb,f=feedback.find(x=>x['反馈编号']===id);if(f)toastEntry(commit(`撤销反馈 ${id}`,'feedback',{feedback:feedback.filter(x=>x!==f)},`${f['学生编号']} ${f['指标编号']}的${f['反馈类型']}被撤销，不再参与分析；之前的版本仍可查看和回退`));}
    if(el.dataset.revokeOv){const id=el.dataset.revokeOv,o=overrides.find(x=>x['改判编号']===id);if(o){toastEntry(commit(`撤销改判 ${id}`,'override',{overrides:overrides.filter(x=>x!==o)},`${o['学生编号']} ${o['指标编号']}恢复规则结果；原改判（${o['调整为']}，理由：${o['理由']}）保留在历史版本中`));if(page==='plans')focusPlan(o['指标编号']);}}
    if(el.dataset.override){
      const iid=el.dataset.override,p=E.recommend(db,student,'all',{rules,feedback,overrides}).find(x=>x.id===iid);if(!p)return;
      try{
        const o=E.checkOverride(db,{'改判编号':'待编号','学生编号':student,'指标编号':iid,'规则结果':p.ruleMode,'调整为':document.getElementById('ov-mode-'+iid).value,'理由':document.getElementById('ov-reason-'+iid).value.trim(),'记录时间':nowISO()});
        o['改判编号']=newId('OT');
        toastEntry(commit(`教师改判 ${o['改判编号']}：${student} ${iid}`,'override',{overrides:[...overrides.filter(x=>!(x['学生编号']===student&&x['指标编号']===iid)),o]},`规则结果“${p.ruleMode}” → “${o['调整为']}”；理由：${o['理由']}`));focusPlan(iid);
      }catch(err){toast(err.message);}
    }
    if(el.dataset.template){
      const k=el.dataset.template,st=key=>DEMO.steps.find(x=>x.key===key),head={records:Object.keys(db.raw['作答记录'][0]),nodes:Object.keys(db.raw['测验节点'][0]),feedback:E.feedbackFields,override:E.overrideFields}[k];
      const sample=isDefault?{records:st('S1').records[0],nodes:st('S1').nodes[0],feedback:st('S3').rows[0],override:st('S4').rows[0]}[k]:null;
      download(csv(head,sample?[sample]:[]),`智慧学伴-${{records:'补充作答记录',nodes:'测验节点',feedback:'反馈',override:'改判'}[k]}模板.csv`,'text/csv;charset=utf-8');toast(sample?'模板含1行演示样例（非赛方数据），可替换后导入':'模板只含表头');
    }
    if(el.id==='preview-rules'){
      try{
        const r=E.normalizeRules({minScored:Number($('#rule-min-scored').value),minDistinct:Number($('#rule-min-distinct').value),consolidate:Number($('#rule-consolidate').value)/100});
        if(JSON.stringify(r)===JSON.stringify(rules)){toast('阈值没有变化');return;}
        stage(`调整分流阈值：${ruleText(rules)} → ${ruleText(r)}`,'rules',{rules:r},'教师调整分流阈值（有效评分条数／不同题目数／巩固线）；阈值是教学分流规则，不是掌握等级标准。');render();reveal('preview-panel');
      }catch(err){toast(err.message);}
    }
    if(el.id==='reset-rules'){const r={...E.DEFAULT_RULES};if(JSON.stringify(r)===JSON.stringify(rules)){toast('当前已是默认阈值');return;}stage(`恢复默认阈值：${ruleText(rules)} → ${ruleText(r)}`,'rules',{rules:r},'恢复默认分流阈值：3条有效评分、2道不同题、巩固线75%。');render();reveal('preview-panel');}
    if(el.id==='apply-preview'&&preview){const p=preview;toastEntry(commit(p.title,p.kind,p.next,p.detail,p.b));reveal('version-diff');}
    if(el.id==='discard-preview'){preview=null;note='';render();toast('已放弃预览，当前版本未改变');}
    if(el.id==='export-history')exportHistory();
    if(el.id==='export-changes')exportChanges();
    if(el.id==='export-verify')exportVerify();
  });
  document.addEventListener('keydown',e=>{
    const typing=Boolean(e.target?.matches?.('input,textarea,select,[contenteditable="true"]'));
    if(e.altKey&&/^[1-9]$/.test(e.key)&&!typing){const p=Object.keys(labels)[Number(e.key)-1];if(p){e.preventDefault();navigate(p);}return;}
    if(!typing&&(e.key==='['||e.key===']')){e.preventDefault();stepStudent(e.key===']'?1:-1);return;}
    if(!typing&&e.key==='/'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const focus=()=>{const box=document.getElementById('material-search');if(box){box.focus();box.select();}};if(page!=='library'){navigate('library');requestAnimationFrame(focus);}else focus();return;}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('.case-card')){e.preventDefault();student=e.target.dataset.student;navigate('cases');}
  });
  document.addEventListener('change',async event=>{
    if(event.target.id==='node-select'){node=event.target.value;render();}
    if(event.target.id==='verify-node'){node=event.target.value;render();}
    if(event.target.id==='verify-case'){verifyCase=event.target.value;if(verifyCompare===verifyCase)verifyCompare=baseCases.find(c=>c.id!==verifyCase)?.id||verifyCompare;render();}
    if(event.target.id==='verify-compare'){verifyCompare=event.target.value;render();}
    if(event.target.id==='class-select'){classId=event.target.value;render();}
    if(event.target.id==='student-select'){student=event.target.value;cmpB='';cmpC='';render();}
    if(event.target.id==='cmp-b'){cmpB=event.target.value;if(cmpB===cmpC)cmpC='';render();}
    if(event.target.id==='cmp-c'){cmpC=event.target.value;if(cmpB===cmpC)cmpB='';render();}
    if(event.target.id==='type-select'){type=event.target.value;render();}
    if(event.target.id==='supp-files'){
      try{
        const files=await readFiles([...event.target.files]);if(!files.length)return;
        const batch={records:[],nodes:[]};
        for(const f of files){const {headers,rows}=E.parseCSV(f.text);if(headers.includes('记录编号')&&headers.includes('评分状态'))batch.records.push(...rows);else if(headers.includes('可用题目编号'))batch.nodes.push(...rows);else throw new Error(`${f.name}既不是作答记录也不是测验节点格式`);}
        if(!batch.records.length&&!batch.nodes.length)throw new Error('文件没有数据行');
        const s={id:'F'+Date.now().toString(36),name:files.map(f=>f.name).join('、'),source:'file',batch,hash:files.map(f=>f.hash?`${f.name}:${f.hash}`:f.name).join('；')};
        if(files.every(f=>f.hash)&&supplements.some(x=>x.hash===s.hash))throw new Error('相同文件已导入，不重复应用');
        const p=stage(`导入补充记录：${s.name}`,'records',{supplements:[...supplements,s]},`本地导入${batch.records.length}条作答记录${batch.nodes.length?`、${batch.nodes.length}个测验节点`:''}；同一作答事件取最高修订版本，结构或评分异常进入质量页隔离。`);
        note=`已读取${batch.records.length}条记录、${batch.nodes.length}个节点；预览显示${p.diff.length}项建议变化（分流改变${p.diff.filter(d=>d.changed.includes('mode')).length}项），确认后生效。`;noteBad=false;render();reveal('preview-panel');
      }catch(e){note='导入未完成，当前版本未改变：'+e.message;noteBad=true;render();}
    }
    if(event.target.id==='feedback-files'){
      try{
        const files=await readFiles([...event.target.files]);if(!files.length)return;
        const fb=[],ov=[],issues=[];
        for(const f of files){
          if(/\.json$/i.test(f.name)){
            let j;try{j=JSON.parse(f.text.replace(/^\uFEFF/,''));}catch{throw new Error(`${f.name}不是有效JSON`);}
            for(const x of [].concat(j)){
              if(!x||typeof x!=='object'||!x.student||!x.question||!x.indicator)throw new Error(`${f.name}不是本系统导出的练习JSON`);
              const t=Date.parse(x.createdAt);
              fb.push({'反馈编号':newId('PJ'),'学生编号':String(x.student),'指标编号':String(x.indicator),'材料编号':String(x.question),'反馈类型':'练习复核','结果':'','使用提示级数':String(Math.min(3,Math.max(0,Math.trunc(Number(x.hintsUsed))||0))),'与原失分同类':'','首个失分点':'','说明':'学生练习导出：'+String(x.answer||'').slice(0,200),'复核状态':'待复核','记录时间':Number.isFinite(t)?cst(t):nowISO()});
            }
            continue;
          }
          const {headers,rows}=E.parseCSV(f.text);
          if(headers.includes('反馈编号'))fb.push(...rows);
          else if(headers.includes('改判编号'))rows.forEach((o,i)=>{try{ov.push(E.checkOverride(db,o));}catch(e){issues.push({id:o['改判编号']||`${f.name}第${i+2}行`,detail:e.message});}});
          else throw new Error(`${f.name}既不是反馈也不是改判格式`);
        }
        const a=addFeedback(fb,'导入反馈与改判','本地导入反馈'),last=new Map();
        for(const o of ov){if(overrides.some(x=>x['改判编号']===o['改判编号'])){issues.push({id:o['改判编号'],detail:'改判编号已存在，未重复采用'});continue;}const k=o['学生编号']+'|'+o['指标编号'];if(last.has(k))issues.push({id:last.get(k)['改判编号'],detail:'同一学生同一指标有更晚的改判，以后者为准'});last.set(k,o);}
        const ovNew=[...last.values()];
        if(!a.fresh.length&&!ovNew.length)throw new Error('没有可采用的新反馈或改判'+([...a.issues,...issues].length?'：'+[...a.issues,...issues].map(i=>i.id+' '+i.detail).join('；'):''));
        const p=stage(`导入${a.fresh.length?'反馈':''}${a.fresh.length&&ovNew.length?'与':''}${ovNew.length?'改判':''}：${files.map(f=>f.name).join('、')}`,a.fresh.length?'feedback':'override',{...a.next,overrides:[...overrides.filter(o=>!ovNew.some(n=>n['学生编号']===o['学生编号']&&n['指标编号']===o['指标编号'])),...ovNew]},`${[fb.length&&a.detail,ovNew.length&&`教师改判${ovNew.length}条`,issues.length&&`改判未采用或被替代${issues.length}条（${issues.map(i=>i.id+' '+i.detail).join('；')}）`].filter(Boolean).join('；')}`);
        note=p.detail+`。预览显示${p.diff.length}项建议变化，确认后生效。`;noteBad=Boolean(a.issues.length||issues.length);render();reveal('preview-panel');
      }catch(e){note='导入未完成，当前版本未改变：'+e.message;noteBad=true;render();}
    }
  });
  document.addEventListener('input',event=>{if(event.target.id==='material-search'){search=event.target.value;const start=event.target.selectionStart;render();$('#material-search').focus();$('#material-search').setSelectionRange(start,start);}});
  $('#agent-toggle').addEventListener('click',()=>$('#agent-dialog').showModal());
  $('#agent-close').addEventListener('click',()=>$('#agent-dialog').close());
  $('#evidence-close').addEventListener('click',()=>$('#evidence-dialog').close());
  $('#import-button').addEventListener('click',()=>$('#import-dialog').showModal());
  $('#import-close').addEventListener('click',()=>$('#import-dialog').close());
  $('#agent-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#agent-input').value.trim();if(text){ask(text);$('#agent-input').value='';}});
  $('#agent-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();$('#agent-form').requestSubmit();}});
  $('#share-button').addEventListener('click',async()=>{const url=location.href;try{await navigator.clipboard.writeText(url);toast('已复制当前页面与筛选条件的链接');}catch(_){const box=document.createElement('textarea');box.value=url;box.setAttribute('readonly','');box.style.position='fixed';box.style.opacity='0';document.body.appendChild(box);box.select();try{document.execCommand('copy');toast('已复制当前页面与筛选条件的链接');}catch(__){toast('复制失败，请手动复制地址栏链接');}box.remove();}});
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
  $('#csv-files').addEventListener('change',async event=>{
    const result=$('#import-result');result.textContent='正在校验CSV与数据关联…';
    try{
      const files=[...event.target.files],raw={},manifest=[];
      if(files.length>8)throw new Error('请选择5个必需CSV及可选字段说明，不要选择重复文件');
      for(const f of files){if(f.size>50*1024*1024)throw new Error(`${f.name}超过单文件50MiB导入边界`);const name=f.name.replace(/\.csv$/i,'');if(![...Object.keys(E.fields),'字段说明'].includes(name))continue;if(raw[name])throw new Error(`重复数据表：${name}`);const bytes=await f.arrayBuffer(),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);raw[name]=E.parseCSV(text).rows;const hash=globalThis.crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join(''):null;manifest.push({name:f.name,rows:raw[name].length,sha256:hash});}
      const next=E.prepare(raw);if(next.students.size<3)throw new Error('展示原型需至少3名学生以生成三种案例；数据未替换');
      payload={raw,manifest,label:'独立导入数据 · 本地会话'};db=next;isDefault=false;resetHistory();student=baseCases[0].id;node='all';classId='all';topic=db.topics[0].id;search='';type='all';practice=null;result.textContent=`导入成功：${db.students.size}名学生、${db.audit.raw}条原始记录、${db.audit.scored}条有效评分。异常见质量页；固定案例叙述已停用；调整记录重置为v0基线。`;render();
    }catch(error){result.textContent='导入未完成，原数据保持不变。'+error.message;}
  });
  $('#restore-button').addEventListener('click',()=>{payload=original;db=E.prepare(original.raw);isDefault=true;resetHistory();student=baseCases[0].id;node='all';classId='all';topic='T01';search='';type='all';practice=null;$('#import-result').textContent='已恢复赛事数据；调整记录重置为v0基线';$('#csv-files').value='';render();});
  window.ScholarApp={getDB:()=>db,getState:()=>({page,student,node,topic,isDefault,version:history.at(-1).v,rules,feedback,overrides,supplements:supplements.map(s=>s.id)}),getHistory:()=>history,navigate,ask,exportAnalysis,applyDemo};
  resetHistory();
  applyHash();
  render();
  const restoreHash=()=>{const before=page;applyHash();render();if(page!==before){window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}};
  window.addEventListener('popstate',restoreHash);
  window.addEventListener('hashchange',restoreHash);
})();
