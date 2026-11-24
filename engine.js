(function (root) {
  'use strict';
  const fields = {
    '课程要求': ['主题编号','主题','主题目标','指标编号','观察指标','课标整理编号','课标文件页／正文页','教材正文页'],
    '题目与材料': ['材料编号','主题编号','材料类型','题型','题干或内容','选项','参考答案','参考解析','满分','评分点','指标编号','来源或资料文件'],
    '模拟学生': ['学生编号','模拟班级编号','年级'],
    '测验节点': ['节点编号','模拟测验日期','已教及测量主题','说明','可用题目编号'],
    '作答记录': ['记录编号','学生编号','材料编号','主题编号','节点编号','作答事件编号','修订版本','模拟提交时间','评分状态','得分','满分','学生最终作答','解答过程','评分点得分']
  };
  const split = s => String(s || '').split(/[、；;]/).map(x => x.trim()).filter(Boolean);
  const integer = s => /^\d+$/.test(String(s)) ? Number(s) : null;
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else if (!quoted && cell !== '') throw new Error('CSV引号位置不合法');
        else quoted = !quoted;
      } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(x => x !== '')) rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (quoted) throw new Error('CSV存在未闭合引号');
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) throw new Error('CSV文件为空');
    const headers = rows.shift();
    if (new Set(headers).size !== headers.length) throw new Error('CSV表头重复');
    return {headers, rows: rows.map((r, i) => {
      if (r.length !== headers.length) throw new Error(`CSV第${i + 2}条逻辑记录列数不一致`);
      return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
    })};
  }
  function pointDefs(q) {
    return String(q['评分点'] || '').split(/\r?\n/).filter(Boolean).map(s => {
      const m = s.match(/^(\S+)\s+(.+)\s+(\d+)分$/);
      return m ? {id:m[1], label:m[2], max:Number(m[3])} : {id:s,label:'格式待复核',max:0};
    });
  }
  function points(s) {
    return Object.fromEntries(split(s).map(x => { const m=x.match(/^(\S+)=(\d+)$/); return m ? [m[1], Number(m[2])] : [x,null]; }));
  }
  function prepare(raw) {
    for (const [name, required] of Object.entries(fields)) {
      if (!Array.isArray(raw[name]) || !raw[name].length) throw new Error(`缺少数据表：${name}`);
      for (const key of required) if (!(key in raw[name][0])) throw new Error(`${name}缺少字段：${key}`);
    }
    const uniqueMap = (name, key) => {
      const map = new Map();
      for (const row of raw[name]) { if (!row[key] || map.has(row[key])) throw new Error(`${name}的${key}为空或重复：${row[key]}`); map.set(row[key],row); }
      return map;
    };
    const students = uniqueMap('模拟学生','学生编号'), materials = uniqueMap('题目与材料','材料编号'), nodes = uniqueMap('测验节点','节点编号'), indicators = uniqueMap('课程要求','指标编号');
    for (const q of materials.values()) if (q['材料类型']==='题目' && (!indicators.has(q['指标编号']) || indicators.get(q['指标编号'])['主题编号']!==q['主题编号'] || !integer(q['满分']) || !pointDefs(q).length || pointDefs(q).reduce((a,p)=>a+p.max,0)!==integer(q['满分']))) throw new Error(`题目映射或评分定义异常：${q['材料编号']}`);
    for (const n of nodes.values()) for (const id of split(n['可用题目编号'])) if (!materials.has(id) || materials.get(id)['材料类型']!=='题目') throw new Error(`节点引用未知题目：${id}`);
    const audit = {raw:raw['作答记录'].length, issues:[], archived:[], duplicateRows:[], conflicts:[], empty:{}, missingScore:0, missingProcess:0};
    for (const key of fields['作答记录']) audit.empty[key] = raw['作答记录'].filter(r=>r[key]==='').length;
    const events = new Map(), ids = new Map();
    const issue = (r, type, detail) => audit.issues.push({record:r['记录编号'],event:r['作答事件编号'],type,detail});
    for (const [index, r] of raw['作答记录'].entries()) {
      const source = {...r, logicalRow:index+2};
      const signature = JSON.stringify(r);
      if (ids.has(r['记录编号'])) {
        if (ids.get(r['记录编号'])===signature) { audit.duplicateRows.push(source); continue; }
        throw new Error(`记录编号冲突：${r['记录编号']}；请复核后导入`);
      }
      ids.set(r['记录编号'],signature);
      const q=materials.get(r['材料编号']), n=nodes.get(r['节点编号']);
      const invalid=[];
      if (!students.has(r['学生编号'])) invalid.push('未知学生');
      if (!q || q['材料类型']!=='题目') invalid.push('未知题目');
      if (!n) invalid.push('未知节点');
      if (q && q['主题编号']!==r['主题编号']) invalid.push('主题与题目不一致');
      if (n && !split(n['可用题目编号']).includes(r['材料编号'])) invalid.push('题目不在节点可用范围');
      if (r['作答事件编号']!==[r['学生编号'],r['节点编号'],r['材料编号']].join('-')) invalid.push('事件编号不一致');
      if (!integer(r['修订版本'])) invalid.push('版本须为正整数');
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(r['模拟提交时间']) || !Number.isFinite(Date.parse(r['模拟提交时间']))) invalid.push('提交时间格式异常');
      if (!events.has(r['作答事件编号'])) events.set(r['作答事件编号'],[]);
      events.get(r['作答事件编号']).push({...source, q, structuralErrors:invalid});
    }
    const latest=[];
    for (const group of events.values()) {
      if (group.some(r=>r.structuralErrors.length)) {
        for (const r of group) if (r.structuralErrors.length) issue(r,'结构异常',r.structuralErrors.join('；'));
        audit.conflicts.push(...group); continue;
      }
      group.sort((a,b)=>Number(b['修订版本'])-Number(a['修订版本']));
      const max=Number(group[0]['修订版本']), ties=group.filter(r=>Number(r['修订版本'])===max);
      const content = r => JSON.stringify(fields['作答记录'].filter(k=>k!=='记录编号').map(k=>r[k]));
      if (new Set(ties.map(content)).size>1) { audit.conflicts.push(...ties); issue(group[0],'同版本冲突','最高版本内容不同，不擅自选择，暂不纳入分析'); continue; }
      audit.duplicateRows.push(...ties.slice(1));
      audit.archived.push(...group.filter(r=>Number(r['修订版本'])<max).map(r=>({record:r['记录编号'],latest:group[0]['记录编号'],event:r['作答事件编号'],version:r['修订版本'],score:r['得分']})));
      const r=group[0]; r.score=integer(r['得分']); r.max=integer(r['满分']); r.pointValues=points(r['评分点得分']); r.defs=pointDefs(r.q); r.validScore=false; r.validProcess=false;
      const status=r['评分状态'];
      if (!['已评分','待评分','未作答'].includes(status)) issue(r,'评分状态异常',status);
      else if (status!=='已评分') {
        if (r['得分']!=='' || r['评分点得分']!=='') issue(r,'状态字段异常','未评分状态不应携带得分；不计入得分统计');
        if (status==='未作答' && (r['学生最终作答'] || r['解答过程'])) issue(r,'状态字段异常','未作答状态携带作答文本，待教师复核');
      } else {
        if (r.score===null) { audit.missingScore++; issue(r,'缺失评分','已评分记录缺少合法整数得分'); }
        else if (r.max!==integer(r.q['满分']) || r.score>r.max) issue(r,'分数异常','满分不匹配或得分超出范围');
        else r.validScore=true;
        const keys=Object.keys(r.pointValues);
        const validPoints=r.defs.length===keys.length && r.defs.every(p=>Number.isInteger(r.pointValues[p.id]) && r.pointValues[p.id]>=0 && r.pointValues[p.id]<=p.max);
        if (!validPoints || r.defs.reduce((a,p)=>a+(r.pointValues[p.id]||0),0)!==r.score) { issue(r,'评分点异常','分点评分缺失、越界或与总分不一致；总分与步骤诊断均暂停使用'); r.validScore=false; }
        if (!r['学生最终作答']) issue(r,'作答缺失','已评分但无最终作答，不推断具体错误原因');
        if (r.q['题型']==='解答题') {
          if (!r['解答过程']) { audit.missingProcess++; issue(r,'过程缺失','已有得分可描述，无法定位解题步骤'); }
          else r.validProcess=validPoints && r.validScore;
        }
      }
      latest.push(r);
    }
    audit.latest=latest.length; audit.scored=latest.filter(r=>r.validScore).length;
    audit.pending=latest.filter(r=>r['评分状态']==='待评分').length; audit.unanswered=latest.filter(r=>r['评分状态']==='未作答').length;
    audit.invalidScored=latest.filter(r=>r['评分状态']==='已评分'&&!r.validScore).length;
    audit.issueCount=audit.issues.length;
    const topics=[...new Set(raw['课程要求'].map(r=>r['主题编号']))].map(id=>({id,name:raw['课程要求'].find(r=>r['主题编号']===id)['主题']}));
    return {raw,students,materials,nodes,indicators,topics,records:latest,audit};
  }
  function summarize(records) {
    const scored=records.filter(r=>r.validScore), sum=scored.reduce((a,r)=>a+r.score,0), max=scored.reduce((a,r)=>a+r.max,0);
    return {events:records.length,scored:scored.length,pending:records.filter(r=>r['评分状态']==='待评分').length,unanswered:records.filter(r=>r['评分状态']==='未作答').length,score:sum,max,rate:max?sum/max:null,distinct:new Set(scored.map(r=>r['材料编号'])).size,full:scored.filter(r=>r.score===r.max).length,partial:scored.filter(r=>r.score>0&&r.score<r.max).length};
  }
  function stepSummary(records) {
    const stats=new Map();
    for (const r of records.filter(r=>r.validProcess)) {
      const first=r.defs.find(p=>r.pointValues[p.id]<p.max);
      for (const p of r.defs) {
        if (!stats.has(p.id)) stats.set(p.id,{...p,qid:r['材料编号'],count:0,earned:0,total:0,firstLoss:0,students:new Set(),firstStudents:new Set()});
        const s=stats.get(p.id); s.count++; s.earned+=r.pointValues[p.id]; s.total+=p.max;
        if (r.pointValues[p.id]<p.max) s.students.add(r['学生编号']);
        if (first && first.id===p.id) {s.firstLoss++;s.firstStudents.add(r['学生编号']);}
      }
    }
    return [...stats.values()].map(s=>({...s,students:[...s.students],firstStudents:[...s.firstStudents],rate:s.total?s.earned/s.total:null})).sort((a,b)=>b.firstLoss-a.firstLoss || a.rate-b.rate);
  }
  function studentReport(db,id,node='all') {
    const rows=db.records.filter(r=>r['学生编号']===id && (node==='all'||r['节点编号']===node));
    return {id,student:db.students.get(id),summary:summarize(rows),records:rows,topics:db.topics.map(t=>({...t,...summarize(rows.filter(r=>r['主题编号']===t.id))})),indicators:[...db.indicators.values()].map(i=>({...i,...summarize(rows.filter(r=>r.q['指标编号']===i['指标编号']))})),nodes:[...db.nodes.keys()].map(n=>({id:n,...summarize(db.records.filter(r=>r['学生编号']===id && r['节点编号']===n))})),steps:stepSummary(rows)};
  }
  function classReport(db,id,node='all') {
    const ids=new Set([...db.students.values()].filter(s=>id==='all'||s['模拟班级编号']===id).map(s=>s['学生编号']));
    const rows=db.records.filter(r=>ids.has(r['学生编号'])&&(node==='all'||r['节点编号']===node));
    const individual=[...ids].map(s=>studentReport(db,s,node));
    const validRates=individual.map(s=>s.summary.rate).filter(x=>x!==null);
    return {id,count:ids.size,summary:summarize(rows),studentMean:validRates.length?validRates.reduce((a,b)=>a+b,0)/validRates.length:null,measuredStudents:validRates.length,topics:db.topics.map(t=>({...t,...summarize(rows.filter(r=>r['主题编号']===t.id)),coveredStudents:new Set(rows.filter(r=>r['主题编号']===t.id&&r.validScore).map(r=>r['学生编号'])).size})),indicators:[...db.indicators.values()].map(i=>({...i,...summarize(rows.filter(r=>r.q['指标编号']===i['指标编号'])),coveredStudents:new Set(rows.filter(r=>r.q['指标编号']===i['指标编号']&&r.validScore).map(r=>r['学生编号'])).size})),steps:stepSummary(rows),students:individual,questions:[...db.materials.values()].filter(q=>q['材料类型']==='题目').map(q=>({q,...summarize(rows.filter(r=>r['材料编号']===q['材料编号']))})).filter(q=>q.events)};
  }
  function comparison(db,id,nodeA='N01',nodeB='N02',classId=null) {
    const rows=db.records.filter(r=>classId==='all'||(classId ? db.students.get(r['学生编号'])['模拟班级编号']===classId : r['学生编号']===id));
    const a=new Map(rows.filter(r=>r['节点编号']===nodeA&&r.validScore).map(r=>[[r['学生编号'],r['材料编号']].join('|'),r]));
    const pairs=rows.filter(r=>r['节点编号']===nodeB&&r.validScore&&a.has([r['学生编号'],r['材料编号']].join('|'))).map(r=>({before:a.get([r['学生编号'],r['材料编号']].join('|')),after:r}));
    const before=summarize(pairs.map(p=>p.before)), after=summarize(pairs.map(p=>p.after));
    return {pairs:pairs.length,students:new Set(pairs.map(p=>p.after['学生编号'])).size,questions:new Set(pairs.map(p=>p.after['材料编号'])).size,before,after,delta:pairs.length?after.rate-before.rate:null};
  }
  const hints={
    T01I1:['先圈出题目中的数量以及单位，哪些量是已知，哪个用字母表示？','把“倍数”和“多／少”分开，分别写出每个量，再组合。','代入负数时，用括号保留负号；检查最终结论和单位。'],
    T01I2:['按字母及指数给各项分类，哪些项能合并？','逐项标出括号外因数的符号，检查每一项是否都被乘到。','先写去括号的一行，再只合并同类项；核对过程末行与最终答案。'],
    T01I3:['这道题要你计算，还是还要解释结论为什么成立？','化简后还含不含字母？题目对字母的取值有什么限制？','用一句完整的话说明化简结果与题目中的性质有什么联系。'],
    T02I1:['这一步对等式两边做了同一个什么运算？','若有分母，找到公分母并逐项检查；若有括号，先展开再合并。','把你求出的数代回原方程，看左右两边是否相等。'],
    T02I2:['选择消掉哪个未知数？观察两式的系数及符号。','写出代入或加减后的单个方程，确认消去的项确实为零。','求出一个未知数后回代，再分别检验两条原方程。'],
    T02I3:['先设未知数并写单位，题目里有几个独立的等量关系？','分别把总数量与总费用等关系写成式子，逐项对应原题。','求解后解释每个量，代回所有现实条件，检查是否合理。'],
    T03I1:['这一步两边同做什么运算？乘数或除数是什么符号？','用一对具体数比较同时乘负数前后的大小，判断不等号方向。','从你得到的范围选一个数代回原式；在数轴上检查端点与方向。'],
    T03I2:['先分别求解两个不等式，不要急着写公共范围。','在同一数轴上标出两个解集，找同时满足两者的部分。','逐个检查边界值能否代入两个条件，决定开闭端点或是否无解。'],
    T03I3:['圈出“至少”“不超过”等限制词，它们分别对应哪个符号？','先列限制再求范围，最后区分连续量与人数等整数数量。','把端点与一个邻近值代回情境，检查单位、整数限制和可行性。']
  };
  const DEFAULT_RULES=Object.freeze({minScored:3,minDistinct:2,consolidate:0.75});
  const MODES=['补充观察','针对性巩固','变式迁移'];
  const feedbackFields=['反馈编号','学生编号','指标编号','材料编号','反馈类型','结果','使用提示级数','与原失分同类','首个失分点','说明','复核状态','记录时间'];
  const overrideFields=['改判编号','学生编号','指标编号','规则结果','调整为','理由','记录时间'];
  const timeOK=s=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(s)&&Number.isFinite(Date.parse(s));
  function normalizeRules(input) {
    const r={...DEFAULT_RULES,...(input||{})};
    if(!Number.isInteger(r.minScored)||r.minScored<1||r.minScored>10) throw new Error('有效评分条数阈值须为1—10的整数');
    if(!Number.isInteger(r.minDistinct)||r.minDistinct<1||r.minDistinct>r.minScored) throw new Error('不同题目数阈值须为1到有效评分条数阈值之间的整数');
    if(typeof r.consolidate!=='number'||!(r.consolidate>=0.5&&r.consolidate<=0.95)) throw new Error('巩固线须在50%—95%之间');
    return {minScored:r.minScored,minDistinct:r.minDistinct,consolidate:Math.round(r.consolidate*100)/100};
  }
  function checkFeedback(db,rows) {
    const items=[], issues=[], seen=new Map();
    for (const [index,row] of (rows||[]).entries()) {
      const f=Object.fromEntries(feedbackFields.map(k=>[k,String(row[k]??'').trim()])), bad=[], type=f['反馈类型'], ind=db.indicators.get(f['指标编号']);
      const missing=feedbackFields.filter(k=>!(k in row)); if(missing.length) bad.push('缺少字段：'+missing.join('、'));
      if(!f['反馈编号']) bad.push('反馈编号为空');
      if(!db.students.has(f['学生编号'])) bad.push('未知学生');
      if(!ind) bad.push('未知指标');
      if(!['练习复核','学生反馈','课堂观察'].includes(type)) bad.push('反馈类型须为练习复核、学生反馈或课堂观察');
      if(!timeOK(f['记录时间'])) bad.push('记录时间格式异常');
      if(type==='练习复核') {
        const q=db.materials.get(f['材料编号']);
        if(!q||q['材料类型']!=='题目') bad.push('练习复核须对应登记题目');
        else if(ind&&q['指标编号']!==f['指标编号']) bad.push('题目与指标不一致');
        if(!['已复核','待复核'].includes(f['复核状态'])) bad.push('练习复核的状态须为已复核或待复核');
        if(f['复核状态']==='已复核') {
          if(!['正确','部分正确','错误'].includes(f['结果'])) bad.push('已复核练习须给出结果：正确、部分正确或错误');
          if(!/^[0-3]$/.test(f['使用提示级数'])) bad.push('使用提示级数须为0—3');
          if(!['是','否'].includes(f['与原失分同类'])) bad.push('与原失分同类须填是或否');
          if(f['结果']==='正确'&&f['与原失分同类']==='是') bad.push('结果正确时不应标记同类错误');
          if(f['首个失分点']&&q&&!pointDefs(q).some(p=>p.id===f['首个失分点'])) bad.push('首个失分点不是该题评分点');
        }
      } else {
        if(f['复核状态']!=='已记录') bad.push(`${type||'该类'}反馈只作记录，状态应为已记录`);
        if(!f['说明']) bad.push('学生反馈与课堂观察须填写说明');
      }
      const sig=JSON.stringify(f);
      if(seen.has(f['反馈编号'])) { if(seen.get(f['反馈编号'])===sig) { issues.push({id:f['反馈编号'],row:index+2,type:'完全重复',detail:'与已采用反馈相同，只计一次'}); continue; } bad.push('反馈编号重复且内容不同，保留首条'); }
      if(bad.length) { issues.push({id:f['反馈编号']||`第${index+2}行`,row:index+2,type:'反馈未采用',detail:bad.join('；')}); continue; }
      seen.set(f['反馈编号'],sig); items.push(f);
    }
    return {items,issues};
  }
  function checkOverride(db,o) {
    const bad=[];
    if(!db.students.has(o['学生编号'])) bad.push('未知学生');
    if(!db.indicators.has(o['指标编号'])) bad.push('未知指标');
    if(!MODES.includes(o['调整为'])) bad.push('调整为须是补充观察、针对性巩固或变式迁移');
    if(String(o['理由']||'').trim().length<6) bad.push('请填写不少于6个字的改判理由');
    if(!timeOK(o['记录时间'])) bad.push('记录时间格式异常');
    if(bad.length) throw new Error(bad.join('；'));
    return Object.fromEntries(overrideFields.map(k=>[k,String(o[k]??'').trim()]));
  }
  const pctText=x=>(x*100).toFixed(1)+'%';
  function recommend(db,id,node='all',opts={}) {
    const rules=normalizeRules(opts.rules), report=studentReport(db,id,node);
    const fb=(opts.feedback||[]).filter(f=>f['学生编号']===id), ov=(opts.overrides||[]).filter(o=>o['学生编号']===id);
    return report.indicators.map(i=> {
      const iid=i['指标编号'], t=i['主题编号'];
      const available=[...db.materials.values()].filter(q=>q['材料类型']==='题目'&&q['指标编号']===iid && (node==='all'||split(db.nodes.get(node)['可用题目编号']).includes(q['材料编号'])));
      const observed=report.records.filter(r=>r.q['指标编号']===iid&&r.validScore);
      const mine=fb.filter(f=>f['指标编号']===iid), reviewed=mine.filter(f=>f['反馈类型']==='练习复核'&&f['复核状态']==='已复核');
      const practiced=new Set(reviewed.map(f=>f['材料编号']));
      const unscored=report.records.filter(r=>r.q['指标编号']===iid&&!r.validScore&&r['评分状态']!=='未作答'), awaiting=new Set(unscored.map(r=>r['材料编号']));
      const unseen=available.filter(q=>!observed.some(r=>r['材料编号']===q['材料编号'])&&!practiced.has(q['材料编号'])&&!awaiting.has(q['材料编号'])).sort((a,b)=>Number(b['题型']==='解答题')-Number(a['题型']==='解答题'));
      const weak=observed.filter(r=>r.score<r.max).sort((a,b)=>(a.score/a.max)-(b.score/b.max));
      const unmeasured=available.length===0, trace=[];
      let baseMode;
      if(unmeasured) { baseMode='未教学／未测量'; trace.push({kind:'rule',label:'可用题目',value:0,threshold:'≥1',pass:false,text:'当前节点范围没有该指标的登记题目，不形成能力结论'}); }
      else {
        const okS=i.scored>=rules.minScored, okD=i.distinct>=rules.minDistinct;
        trace.push({kind:'rule',label:'可用题目',value:available.length,threshold:'≥1',pass:true,text:''});
        const invalid=unscored.length-i.pending, excluded=[i.pending&&`待评分${i.pending}条`,invalid&&`评分异常${invalid}条`,i.unanswered&&`未作答${i.unanswered}条`].filter(Boolean);
        trace.push({kind:'rule',label:'有效评分条数',value:i.scored,threshold:'≥'+rules.minScored,pass:okS,text:excluded.length?excluded.join('、')+'不计入'+(awaiting.size?`；${[...awaiting].join('、')}已提交，完成评分或复核后重算，暂不作为新题推荐`:''):''});
        trace.push({kind:'rule',label:'不同题目数',value:i.distinct,threshold:'≥'+rules.minDistinct,pass:okD,text:''});
        if(!okS||!okD) { baseMode='补充观察'; trace.push({kind:'result',text:'证据条数或题目覆盖未达阈值 → 补充观察，不判为未掌握'}); }
        else { const okR=i.rate>=rules.consolidate; baseMode=okR?'变式迁移':'针对性巩固'; trace.push({kind:'rule',label:'已评分题目加权得分率',value:`${pctText(i.rate)}（${i.score}/${i.max}）`,threshold:'≥'+Math.round(rules.consolidate*100)+'%',pass:okR,text:''}); trace.push({kind:'result',text:okR?'证据充足且达到巩固线 → 变式迁移':'证据充足但低于巩固线 → 针对性巩固'}); }
      }
      let mode=baseMode, prereq=false, hintCap=null;
      const ids=list=>list.map(f=>f['反馈编号']).join('、');
      if(!unmeasured) {
        const clean=reviewed.filter(f=>f['结果']==='正确'&&f['使用提示级数']==='0'), cleanQ=[...new Set(clean.map(f=>f['材料编号']))];
        const hinted=reviewed.filter(f=>f['结果']==='正确'&&f['使用提示级数']!=='0'), recurring=reviewed.filter(f=>f['结果']!=='正确'&&f['与原失分同类']==='是'), otherWrong=reviewed.filter(f=>f['结果']!=='正确'&&f['与原失分同类']!=='是');
        for(const f of reviewed) trace.push({kind:'feedback',ref:f['反馈编号'],text:`${f['反馈编号']} · ${f['材料编号']}练习复核：${f['结果']}，用提示${f['使用提示级数']}级${f['与原失分同类']==='是'?'，教师判定与原失分同类':''}${f['首个失分点']?'，首个失分'+f['首个失分点']:''}${f['说明']?'。'+f['说明']:''}`});
        if(recurring.length) { mode='针对性巩固'; prereq=true; trace.push({kind:'adjust',text:`同类错误再次出现（${ids(recurring)}）→ 回到对应先修再练，暂不进阶`}); }
        else if(cleanQ.length>=2&&mode!=='变式迁移') { mode='变式迁移'; trace.push({kind:'adjust',text:`${cleanQ.join('、')}两道不同题无提示正确（${ids(clean)}）→ 由“${baseMode}”进阶到变式迁移`}); }
        else if(reviewed.length) {
          if(hinted.length) hintCap=Math.max(0,Math.min(...hinted.map(f=>Number(f['使用提示级数'])))-1);
          trace.push({kind:'adjust',text:cleanQ.length>=2?`已有${cleanQ.length}道不同题无提示正确，维持变式迁移`:`进阶需两道不同题无提示正确，当前${cleanQ.length}道 → 维持“${mode}”${hintCap!==null?(hintCap?`；下次最多先给${hintCap}级提示，逐步撤除`:'；下次先不给提示，独立尝试后再按需给一级提示'):''}${otherWrong.length?`；${otherWrong.map(f=>f['反馈编号']+(f['首个失分点']?`（${f['首个失分点']}）`:'')).join('、')}出现与原失分不同的新失分点，作为新线索在下次练习中重点观察`:''}`});
        }
      }
      for(const f of mine.filter(f=>f['反馈类型']==='练习复核'&&f['复核状态']!=='已复核')) trace.push({kind:'pending',ref:f['反馈编号'],text:`${f['反馈编号']} · ${f['材料编号']}待教师复核，不据此调整`});
      for(const f of mine.filter(f=>f['反馈类型']!=='练习复核')) trace.push({kind:'note',ref:f['反馈编号'],text:`${f['反馈编号']} · ${f['反馈类型']}：${f['说明']}（只作参考，不改变分流）`});
      const ruleMode=mode, o=unmeasured?null:ov.filter(o=>o['指标编号']===iid).at(-1);
      if(o) {
        if(o['规则结果']&&o['规则结果']!==ruleMode) trace.push({kind:'warn',text:`改判时规则结果为“${o['规则结果']}”，现在为“${ruleMode}”，请教师复核该改判是否仍适用`});
        mode=o['调整为']; if(mode!=='针对性巩固') prereq=false;
        trace.push({kind:'override',ref:o['改判编号'],text:`教师改判${o['改判编号']}：规则结果“${ruleMode}” → “${mode}”；理由：${o['理由']}`});
      }
      const solved=new Set(reviewed.filter(f=>f['结果']==='正确').map(f=>f['材料编号']));
      const redo=[...new Map(weak.filter(r=>!solved.has(r['材料编号'])).map(r=>[r['材料编号'],r.q])).values()];
      const practice= mode==='补充观察' ? [...unseen.slice(0,2),...redo,...unseen.slice(2),...available] : mode==='针对性巩固' ? [...redo.slice(0,2),...unseen,...redo.slice(2),...available] : [...unseen,...redo,...available.filter(q=>q['题型']==='解答题'),...available];
      const selected=[...new Map(practice.map(q=>[q['材料编号'],q])).values()].slice(0,3);
      const role=q=>redo.includes(q)?'原题重做':practiced.has(q['材料编号'])?'练习已做':awaiting.has(q['材料编号'])?'评分待完成':!unseen.includes(q)?'回看已做题':mode==='针对性巩固'?'新题检验':mode==='变式迁移'?'迁移观察':'补充观察';
      const firstLoss=report.steps.find(s=>s.firstLoss>0&&db.materials.get(s.qid)['指标编号']===iid);
      const changes=trace.filter(x=>x.kind==='adjust'||x.kind==='override').map(x=>x.text);
      const basis=(unmeasured?'该节点的可用题目未覆盖此指标，不形成能力结论。':`${i.scored}条有效评分、${i.distinct}道不同题，得分${i.score}/${i.max}；${baseMode==='补充观察'?'证据不足，不判为未掌握。':baseMode==='针对性巩固'?'已有失分表现需复核。':'已有题目表现较好，迁移能力仍需新情境观察。'}${awaiting.size?`${[...awaiting].join('、')}已提交但评分未完成或待复核，完成后重算。`:''}`)+(changes.length?' 调整：'+changes.map(t=>t.replace(/[。；]+$/,'')).join('；')+'。':'');
      const sequence=unmeasured?'本节点尚未教学或未测量该指标：按教学进度学习后，用本指标题目收集证据，再重新分流':mode==='补充观察'?'先无提示完成2道不同题并口述理由 → 教师复核 → 再决定是否讲解':mode==='针对性巩固'?(prereq?'先回看先修页，逐项写出每一步的依据 → 带一级提示重做原题 → 学习卡与教材短讲 → 新题无提示检验':'回看原作答定位首个失分点 → 学习卡与教材短讲 → 逐级提示重做原题 → 新题无提示检验'):'先解释已做题的依据 → 另一道同指标题独立完成 → 比较方法与现实约束';
      return {id:iid,topic:t,label:i['观察指标'],mode,baseMode,ruleMode,prereq,hintCap,basis,firstLoss,records:weak.map(r=>r['记录编号']).slice(0,3),card:'L0'+Number(t.slice(1)),practice:selected.map(q=>q['材料编号']),roles:Object.fromEntries(selected.map(q=>[q['材料编号'],role(q)])),hints:hints[iid]||[],sequence,adjust:'教学调整规则（可由教师修改）：两道不同题无提示完成且关键步骤、解释均正确，再进阶；若同类错误再次出现，回到对应先修；评分未完成先复核，不据空分调整。',trace,rules,evidence:{scored:i.scored,distinct:i.distinct,score:i.score,max:i.max,rate:i.rate,pending:i.pending,unanswered:i.unanswered,records:report.records.filter(r=>r.q['指标编号']===iid).map(r=>r['记录编号'])},feedback:mine.map(f=>f['反馈编号']),override:o?o['改判编号']:null};
    });
  }
  const traceLine=x=>x.kind==='rule'?`${x.label}：${x.value}（阈值${x.threshold}，${x.pass?'达到':'未达到'}）${x.text?'；'+x.text:''}`:x.text;
  function mergeSupplement(raw,batches=[]) {
    if(!batches.length) return raw;
    const order=Object.keys(raw['作答记录'][0]), out={...raw,'作答记录':[...raw['作答记录']],'测验节点':[...raw['测验节点']]};
    for (const b of batches) {
      for (const n of b.nodes||[]) {
        const miss=fields['测验节点'].filter(k=>!(k in n)); if(miss.length) throw new Error(`补充测验节点缺少字段：${miss.join('、')}`);
        const old=out['测验节点'].find(x=>x['节点编号']===n['节点编号']);
        if(old) { if(fields['测验节点'].some(k=>old[k]!==n[k])) throw new Error(`节点${n['节点编号']}已存在且内容不同，不覆盖原节点`); continue; }
        out['测验节点'].push(Object.fromEntries(Object.keys(raw['测验节点'][0]).map(k=>[k,n[k]??''])));
      }
      for (const row of b.records||[]) {
        const miss=fields['作答记录'].filter(k=>!(k in row)); if(miss.length) throw new Error(`补充作答记录缺少字段：${miss.join('、')}`);
        out['作答记录'].push(Object.fromEntries(order.map(k=>[k,row[k]??''])));
      }
    }
    return out;
  }
  function planSnapshot(db,opts={}) {
    const out={};
    for (const id of db.students.keys()) for (const p of recommend(db,id,'all',opts)) out[id+'|'+p.id]={student:id,indicator:p.id,label:p.label,mode:p.mode,baseMode:p.baseMode,prereq:p.prereq,scored:p.evidence.scored,distinct:p.evidence.distinct,score:p.evidence.score,max:p.evidence.max,rate:p.evidence.rate,pending:p.evidence.pending,records:p.evidence.records,firstLoss:p.firstLoss?`${p.firstLoss.id} ${p.firstLoss.label}`:'',practice:p.practice.join('、'),feedback:p.feedback,override:p.override,why:p.trace.filter(x=>['result','adjust','override','warn','pending','note'].includes(x.kind)).map(x=>x.text)};
    return out;
  }
  function diffSnapshots(a,b) {
    const list=[];
    for (const key of Object.keys(b)) {
      const x=a[key], y=b[key]; if(!x) continue;
      const changed=['mode','prereq','scored','distinct','score','max','pending','firstLoss','practice'].filter(k=>x[k]!==y[k]);
      const addedRecords=y.records.filter(r=>!x.records.includes(r)), removedRecords=x.records.filter(r=>!y.records.includes(r));
      const addedFeedback=y.feedback.filter(f=>!x.feedback.includes(f)), removedFeedback=x.feedback.filter(f=>!y.feedback.includes(f));
      if(changed.length||addedRecords.length||removedRecords.length||addedFeedback.length||removedFeedback.length||x.override!==y.override) list.push({student:y.student,indicator:y.indicator,label:y.label,changed,before:x,after:y,addedRecords,removedRecords,addedFeedback,removedFeedback,override:x.override!==y.override?{before:x.override,after:y.override}:null});
    }
    return list;
  }
  function auditDelta(a,b) {
    const n=x=>Array.isArray(x)?x.length:x;
    return Object.fromEntries(['raw','archived','duplicateRows','conflicts','latest','scored','pending','unanswered','invalidScored','issueCount'].map(k=>[k,[n(a[k]),n(b[k])]]));
  }
  function changeFields(d) {
    const b=d.before,a=d.after,c=d.changed,f=[];
    if(c.includes('scored'))f.push(`有效评分 ${b.scored} → ${a.scored}`);
    if(c.includes('distinct'))f.push(`不同题目 ${b.distinct} → ${a.distinct}`);
    if(c.includes('score')||c.includes('max'))f.push(`得分 ${b.score}/${b.max} → ${a.score}/${a.max}`);
    if(c.includes('pending'))f.push(`待评分 ${b.pending} → ${a.pending}`);
    if(c.includes('firstLoss'))f.push(`首个失分 ${b.firstLoss||'无'} → ${a.firstLoss||'无'}`);
    if(c.includes('prereq'))f.push(a.prereq?'改为先回到先修':'不再要求回到先修');
    if(c.includes('practice'))f.push(`推荐练习 ${b.practice||'无'} → ${a.practice||'无'}`);
    return f;
  }
  const evidenceText=(a,r)=>a.mode.includes('未教')?'当前节点范围没有该指标的登记题目，不形成能力结论':`当前证据：${a.scored}条有效评分（阈值≥${r.minScored}）、${a.distinct}道不同题（阈值≥${r.minDistinct}）${a.max?`，得分${a.score}/${a.max}＝${pctText(a.rate)}（巩固线${Math.round(r.consolidate*100)}%）`:''}${a.pending?`；另有待评分${a.pending}条不计入，评分完成后重算`:''}`;
  function selectCases(db) {
    const reports=[...db.students.keys()].map(id=>studentReport(db,id));
    const covered=r=>[r.nodes.filter(n=>n.scored).length,r.topics.filter(t=>t.scored).length,r.indicators.filter(i=>i.scored).length];
    const sparse=[...reports].sort((a,b)=>a.summary.scored-b.summary.scored || covered(a).reduce((d,x,i)=>d||x-covered(b)[i],0))[0];
    const strong=[...reports].filter(r=>r.id!==sparse.id&&r.summary.scored>=10).sort((a,b)=>b.summary.rate-a.summary.rate || b.summary.scored-a.summary.scored)[0] || reports.find(r=>r.id!==sparse.id);
    const partialCount=r=>r.records.filter(x=>x.validProcess&&x.score>0&&x.score<x.max).length;
    const partial=[...reports].filter(r=>r.id!==sparse.id&&r.id!==strong.id).sort((a,b)=>partialCount(b)-partialCount(a))[0];
    const [sn,st]=covered(sparse);
    return [
      {id:partial.id,type:'部分得分',subtitle:'从首个失分步骤，找到巩固起点',rule:`有过程的部分得分记录最多（${partialCount(partial)}条）`},
      {id:strong.id,type:'表现较好',subtitle:'从正确作答，走向解释与迁移',rule:`至少10条有效评分的学生中得分率最高（${strong.summary.score}/${strong.summary.max}）`},
      {id:sparse.id,type:'记录不足',subtitle:'先补充观察，再作学习判断',rule:`有效评分最少（${sparse.summary.scored}条），仅覆盖${sn}个测验节点、${st}个主题`}
    ];
  }
  function ask(db,text,activeId,bookRef=()=>'',opts={}) {
    const id=(text.match(/D\d{2,}/i)||[])[0]?.toUpperCase() || activeId;
    const classId=(text.match(/DC\d{2,}/i)||[])[0]?.toUpperCase();
    const qid=(text.match(/Q\d{3,}/i)||[])[0]?.toUpperCase();
    const iid=(text.match(/T0\dI\d/i)||[])[0]?.toUpperCase();
    const topic=/不等/.test(text)?'T03':/方程/.test(text)?'T02':/代数|整式/.test(text)?'T01':null;
    if (/质量|清洗|缺失|重复|修订/.test(text)) return `数据质量审计\n原始${db.audit.raw}条 → 归并后${db.audit.latest}个事件；历史版本${db.audit.archived.length}条，完全重复${db.audit.duplicateRows.length}条，冲突隔离${db.audit.conflicts.length}条。有效评分${db.audit.scored}条、待评分${db.audit.pending}条、未作答${db.audit.unanswered}条；质量问题${db.audit.issueCount}项。\n按同一事件最高修订版本取当前证据；同版本内容冲突不选取。缺分不补零、未测不判不会。详见数据质量页。`;
    if (classId || /班级|两个班|全班/.test(text)) {
      const classes=classId?[classId]:[...new Set([...db.students.values()].map(s=>s['模拟班级编号']))];
      if(classes.some(c=>![...db.students.values()].some(s=>s['模拟班级编号']===c))) return '没有找到该班级，请使用数据中的班级编号。';
      return classes.map(c=>{const r=classReport(db,c);const steps=r.steps.filter(s=>s.firstLoss).slice(0,3);return `${c}：${r.count}名学生，${r.summary.scored}条有效评分，已记录题目加权得分${r.summary.score}/${r.summary.max}。${r.topics.map(t=>`\n${t.name}：${t.score}/${t.max}，${t.scored}条，覆盖${t.coveredStudents}人`).join('')}\n优先讲解：${steps.map(s=>{const b=bookRef(db.materials.get(s.qid)?.['指标编号'],s.label);return `${s.id}“${s.label}”（${s.firstLoss}/${s.count}条在此首次失分${b?`；教材${b}`:''}）`;}).join('；')}。先展示匿名原过程，再用对应教材和同指标题复核；后续零分可能依赖上游错误，不能算成多个独立困难。不同题本、覆盖和题目难度不等，不能据此判班级能力高低。`;}).join('\n\n');
    }
    if (qid && !db.materials.has(qid)) return '没有找到该题目，请使用资料中的题号。';
    if (!db.students.has(id)) return '没有找到该学生，请使用数据中的学生编号。';
    if (iid && !db.indicators.has(iid)) return '没有找到该观察指标，请使用课程要求中的指标编号（如T01I2）。';
    const r=studentReport(db,id), plans=recommend(db,id,'all',opts).filter(p=>(!topic||p.topic===topic)&&(!iid||p.id===iid));
    if (!qid && /为什么|依据|理由|怎么判断|如何得出/.test(text)) {
      const rules=normalizeRules(opts.rules), custom=JSON.stringify(rules)!==JSON.stringify(DEFAULT_RULES);
      return `${id} · 建议是怎样得出的\n分流规则：有效评分≥${rules.minScored}条且不同题目≥${rules.minDistinct}道才作判断，否则补充观察；已评分题目加权得分率<${Math.round(rules.consolidate*100)}%为针对性巩固，否则变式迁移。${custom?'（教师已调整阈值；默认3条、2道、75%）':''}\n`+plans.map(p=>`${p.id} ${p.label}｜${p.mode}${p.mode!==p.baseMode?`（规则初判：${p.baseMode}）`:''}\n`+p.trace.map(x=>'· '+traceLine(x)).join('\n')+(p.evidence.records.length?`\n证据记录（${p.evidence.records.length}条）：${p.evidence.records.join('、')}`:'')).join('\n\n')+'\n\n说明：只有教师已复核的练习复核才参与调整；学生反馈与课堂观察只作参考；教师改判覆盖规则结果，并保留理由与原规则结果。';
    }
    if(qid){const rows=r.records.filter(x=>x['材料编号']===qid);return `${id} · ${qid}\n${db.materials.get(qid)['题干或内容']}\n${rows.length?rows.map(x=>`${x['记录编号']} · ${x['节点编号']} · v${x['修订版本']} · ${x['评分状态']} ${x.validScore?x.score+'/'+x.max:'不纳入得分'}\n实际作答：${x['学生最终作答']||'空'}\n过程：${x['解答过程']||'未提供'}\n评分点：${x['评分点得分']||'空'}`).join('\n\n'):'没有该题作答事件；未观测不等于未掌握。'}${bookRef(db.materials.get(qid)['指标编号'])?`\n对应教材：${bookRef(db.materials.get(qid)['指标编号'])}`:''}\n教师应将首个失分点评分与原文共同核对；最终答案与过程矛盾时先请学生复述，不擅自修改原分。`;}
    return `${id} · 证据驱动学习建议\n${r.summary.scored}条有效评分，已记录题目得分${r.summary.score}/${r.summary.max}（不代表整份试卷分数）。\n`+plans.map(p=>`${p.id} ${p.label}｜${p.mode}\n依据：${p.basis}${p.records.length?' 记录：'+p.records.join('、'):''}\n安排：${p.sequence}。材料：${p.card} → ${p.practice.map(q=>`${q}（${p.roles[q]}）`).join(' → ')||'待后续教学'}。${bookRef(p.id)?`\n教材：${bookRef(p.id)}`:''}\n提示：${p.hints[0]||'先补充记录'}\n调整：${p.adjust}`).join('\n\n')+'\n\n边界：本地规则与检索生成，不是通用大模型推理；所有结论仅限模拟数据，可由教师复核。';
  }
  const api={fields,parseCSV,prepare,summarize,studentReport,classReport,comparison,recommend,selectCases,ask,pointDefs,split,DEFAULT_RULES,MODES,feedbackFields,overrideFields,normalizeRules,checkFeedback,checkOverride,traceLine,mergeSupplement,planSnapshot,diffSnapshots,auditDelta,changeFields,evidenceText};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScholarEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
