import { average, classify, contexts, dateKey, escapeHtml as esc, formatDate as fmtDate, formatTime as fmtTime, groupByDay as groupDays, readRecords, saveRecords, sortRecords } from './core/records.js';
import { downloadBackup, importBackupText } from './features/csv-backup.js';
import { renderTrendChart, stepTrendFocus, updateTrendFocus } from './features/trend-chart.js';

const $ = (s) => document.querySelector(s);
let records = readRecords(); let page = 'today'; let range = 7; let historyQuery=''; let trendDragging=false;
let pendingImport = null;
function setPage(next){page=next;document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));render();window.scrollTo({top:0,behavior:'smooth'});}

function render(){const todayKey=dateKey(Date.now()), today=records.filter(r=>dateKey(r.measuredAt)===todayKey), avg=average(today), latest=records[0];$('#todayDate').textContent=new Intl.DateTimeFormat('zh-CN',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());
 if(page==='today') renderToday(today,avg,latest,todayKey); if(page==='trends') $('#view').innerHTML=renderTrendChart(records,range); if(page==='history')renderHistory();if(page==='settings')renderSettings();}
function recordRows(items){if(!items.length)return '<div class="empty-row">暂无记录</div>';return items.map(r=>{const [label,level]=classify(r.systolic,r.diastolic);return `<button class="record-row" data-edit="${esc(r.id)}"><span class="row-time">${fmtTime(r.measuredAt)}</span><span class="row-reading"><b>${r.systolic}<i>/</i>${r.diastolic}</b><small>mmHg</small></span><span class="row-pulse">${r.pulse?`♥ ${r.pulse} bpm`:'—'}</span><span class="context-tag">${contexts[r.context]||'其他'}</span><span class="status-pill ${level}">${label}</span><span class="row-chevron">›</span></button>`}).join('');}
function renderToday(today,avg,latest,todayKey){const latestClass=latest?classify(latest.systolic,latest.diastolic):['暂无数据','normal'];const dayMap=groupDays(records);let streak=0;for(let d=new Date();;d.setDate(d.getDate()-1)){if(dayMap.has(dateKey(d)))streak++;else if(streak===0&&dateKey(d)===todayKey)continue;else break;}
 $('#view').innerHTML=`<section class="page-heading"><div><span class="eyebrow">YOUR DAILY HEALTH</span><h1>今天，感觉怎么样？</h1><p>记录每一次测量，慢慢看见身体的变化。</p></div></section><section class="hero-grid"><article class="hero-card"><div class="card-kicker">今日平均血压 <span class="live-dot">●</span></div>${avg?`<div class="hero-reading">${avg.s}<span>/</span>${avg.d}<small>mmHg</small></div><div class="reading-caption"><span class="status-pill ${classify(avg.s,avg.d)[1]}">${classify(avg.s,avg.d)[0]}</span><span>基于今日 ${today.length} 次测量</span></div>`:`<div class="hero-empty"><b>还没有今天的记录</b><span>测量后添加记录，开始追踪变化。</span></div>`}<div class="hero-footer"><span>最近一次</span><b>${latest?`${fmtDate(latest.measuredAt,{month:'numeric',day:'numeric'})} ${fmtTime(latest.measuredAt)} · ${latest.systolic}/${latest.diastolic}`:'等待第一次测量'}</b></div></article><div class="metric-stack"><article class="metric-card"><div class="metric-icon mint">⌁</div><div><small>连续记录</small><b>${streak}<i>天</i></b><span>${streak?'保持节奏，继续记录':'从今天开始建立习惯'}</span></div></article><article class="metric-card"><div class="metric-icon peach">↗</div><div><small>近 7 天偏高</small><b>${elevatedCount()}<i>天</i></b><span>按每日平均值估算</span></div></article><article class="metric-card"><div class="metric-icon sand">♥</div><div><small>今日测量</small><b>${today.length}<i>次</i></b><span>${today.length?'已保存在此设备':'记录会自动保存'}</span></div></article></div></section><section class="section-card"><div class="section-heading"><div><h2>今日测量</h2><p>记录时间与测量情境</p></div><button class="link-button" data-page="history">查看全部 <span>→</span></button></div><div class="record-table">${recordRows(today)}</div></section><p class="disclaimer">血压分级仅作记录参考，不构成医疗诊断。若读数异常或感到不适，请咨询专业医护人员。</p>`;}
function elevatedCount(){const map=groupDays(records);return [...map].filter(([k,items])=>{const days=(Date.now()-new Date(`${k}T00:00:00`).getTime())/86400000;if(days>6.5)return false;const a=average(items);return a&&(classify(a.s,a.d)[1]==='high'||classify(a.s,a.d)[1]==='elevated')}).length;}
function renderHistory(){const map=groupDays(records);const groups=[...map].filter(([k])=>!historyQuery||k.includes(historyQuery)).sort(([a],[b])=>b.localeCompare(a));$('#view').innerHTML=`<section class="page-heading"><div><span class="eyebrow">YOUR MEASUREMENTS</span><h1>历史记录</h1><p>按日期整理的所有测量数据。</p></div><button class="button primary add-button" data-add>＋ <span>记录血压</span></button></section><section class="section-card"><div class="history-toolbar"><div><h2>全部记录 <span class="count-chip">${records.length}</span></h2></div><div class="history-filter"><label class="search-box"><span>⌕</span><input id="historySearch" type="date" value="${esc(historyQuery)}" aria-label="按日期筛选"></label>${historyQuery?'<button class="clear-filter" id="clearHistoryFilter" type="button">清除</button>':''}</div></div>${groups.length?groups.map(([k,items])=>`<div class="history-day"><div class="day-heading"><b>${fmtDate(`${k}T12:00:00`,{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</b><span>${items.length} 次测量 · 平均 ${average(items).s}/${average(items).d}</span></div><div class="record-table">${recordRows(items)}</div></div>`).join(''):`<div class="chart-empty"><span>▦</span><b>${records.length?'没有找到这一天的记录':'还没有历史记录'}</b><p>${records.length?'换一个日期再试试。':'保存一条测量数据后，会显示在这里。'}</p></div>`}</section>`;}
function renderSettings(){const demoCount=records.filter(r=>r.isDemo).length;$('#view').innerHTML=`<section class="page-heading"><div><span class="eyebrow">PREFERENCES</span><h1>设置</h1><p>管理这台设备上的数据和提醒。</p></div></section><section class="section-card settings-card"><div class="section-heading"><div><h2>示例数据</h2><p>生成最近 30 天的模拟记录，用于预览趋势和历史。</p></div></div><div class="setting-row"><span><b>模拟测量记录</b><small>会保留真实记录${demoCount?` · 当前有 ${demoCount} 条示例数据`:''}</small></span><button class="button secondary" id="seedDemo">${demoCount?'重新生成示例数据':'生成 30 天示例数据'}</button></div><div class="settings-divider"></div><div class="section-heading"><div><h2>测量提醒</h2><p>定时提醒暂未支持；可在设备系统中设置提醒。</p></div></div><div class="setting-row"><span><b>晨起 / 睡前提醒</b><small>当前版本暂不发送定时浏览器通知</small></span><span class="context-tag">暂未支持</span></div><div class="settings-divider"></div><div class="setting-row"><span><b>本地记录数量</b><small>只保存在此浏览器</small></span><strong>${records.length} 条</strong></div><div class="settings-actions"><input class="hidden" id="importCsvFile" type="file" accept=".csv,text/csv"><button class="button secondary" id="importCsv">导入备份</button><button class="button secondary" id="exportCsv">导出 CSV</button><button class="button danger-button" id="clearRecords" ${records.length?'':'disabled'}>清空全部记录</button></div></section><div class="privacy-card"><span>◈</span><div><b>你的健康数据留在本机</b><p>记录仅保存在当前浏览器的本地存储中。清除浏览器数据或更换设备前，请先导出备份。</p></div></div><p class="disclaimer">示例记录为虚构数据，仅用于界面预览，不代表真实测量或医疗建议。</p>`;}
function openForm(id){const r=records.find(x=>x.id===id);$('#recordForm').reset();$('#recordId').value=r?.id||'';$('#dialogTitle').textContent=r?'编辑记录':'记录血压';$('#sys').value=r?.systolic||'';$('#dia').value=r?.diastolic||'';$('#pulse').value=r?.pulse||'';$('#note').value=r?.note||'';$('#measuredAt').value=localInput(r?.measuredAt||new Date());const lastContext=localStorage.getItem('health-app-h5.last-context')||'morning';document.querySelector(`input[name=context][value="${r?.context||lastContext}"]`).checked=true;$('#deleteRecord').classList.toggle('hidden',!r);$('#saveAndContinue').classList.toggle('hidden',Boolean(r));$('#formError').textContent='';$('#formError').classList.remove('success');$('#recordDialog').showModal();requestAnimationFrame(()=>$('#sys').focus({preventScroll:true}));}
function localInput(v){const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}
$('#view').addEventListener('pointerdown',e=>{const svg=e.target.closest('.trend-plot');if(!svg)return;trendDragging=true;svg.setPointerCapture(e.pointerId);updateTrendFocus(e.clientX,svg);});
$('#view').addEventListener('pointermove',e=>{if(!trendDragging)return;const svg=e.target.closest('.trend-plot')||$('#view .trend-plot');if(svg)updateTrendFocus(e.clientX,svg);});
$('#view').addEventListener('pointerup',()=>{trendDragging=false;});
$('#view').addEventListener('pointercancel',()=>{trendDragging=false;});
$('#view').addEventListener('keydown',e=>{if(!e.target.matches('.trend-plot'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stepTrendFocus(e.key==='ArrowLeft'?-1:1,e.target);}});
document.addEventListener('click',e=>{const pageBtn=e.target.closest('[data-page]');if(pageBtn){setPage(pageBtn.dataset.page);return;}if(e.target.closest('[data-add]')){openForm();return;}const edit=e.target.closest('[data-edit]');if(edit){openForm(edit.dataset.edit);return;}const rangeBtn=e.target.closest('[data-range]');if(rangeBtn){range=Number(rangeBtn.dataset.range);render();return;}});
$('#closeDialog').onclick=$('#cancelDialog').onclick=()=>$('#recordDialog').close();
$('#recordForm').addEventListener('submit',e=>{e.preventDefault();const systolic=Number($('#sys').value),diastolic=Number($('#dia').value),pulse=$('#pulse').value?Number($('#pulse').value):null;let error='';if(systolic<50||systolic>250||diastolic<30||diastolic>180)error='请检查血压数值范围（收缩压 50–250，舒张压 30–180）。';else if(diastolic>=systolic)error='舒张压应低于收缩压。';else if(pulse!==null&&(pulse<30||pulse>220))error='心率应在 30–220 之间。';if(error){$('#formError').textContent=error;$('#formError').classList.remove('success');return;}const id=$('#recordId').value, old=records.find(x=>x.id===id),context=$('input[name=context]:checked').value,rec={id:id||`bp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,systolic,diastolic,pulse,measuredAt:new Date($('#measuredAt').value).toISOString(),context,note:$('#note').value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};records=records.filter(x=>x.id!==id);records.push(rec);records.sort((a,b)=>new Date(b.measuredAt)-new Date(a.measuredAt));saveRecords(records);localStorage.setItem('health-app-h5.last-context',context);if(e.submitter?.id==='saveAndContinue'){render();openForm();$('#formError').textContent='上一条已保存，可以继续记录。';$('#formError').classList.add('success');}else{$('#recordDialog').close();render();toast(id?'记录已更新':'已保存到本地');}});
$('#deleteRecord').onclick=()=>{const id=$('#recordId').value;if(id&&confirm('确定删除这条血压记录吗？')){records=records.filter(r=>r.id!==id);saveRecords(records);$('#recordDialog').close();render();toast('记录已删除');}};
$('#view').addEventListener('input',e=>{if(e.target.id==='historySearch'&&!e.target.value){historyQuery='';renderHistory();}});
$('#view').addEventListener('change',async e=>{if(e.target.id==='importCsvFile'){const file=e.target.files?.[0];e.target.value='';if(file)await handleBackupImport(file);return;}if(e.target.id==='historySearch'){historyQuery=e.target.value;renderHistory();return;}const key=e.target.dataset.reminder;if(key){if(e.target.checked&&'Notification'in window){const permission=await Notification.requestPermission();if(permission!=='granted'){e.target.checked=false;toast('请在浏览器设置中允许通知');return;}}const p=JSON.parse(localStorage.getItem('health-app-h5.reminders')||'{"morning":false,"bedtime":false}');p[key]=e.target.checked;localStorage.setItem('health-app-h5.reminders',JSON.stringify(p));toast(e.target.checked?'提醒已开启':'提醒已关闭');}});
$('#view').addEventListener('click', (event) => {
  const target = event.target;
  if (target.id === 'importCsv') {
    $('#importCsvFile').click();
    return;
  }
  if (target.id === 'clearHistoryFilter') {
    historyQuery = '';
    renderHistory();
    return;
  }
  if (target.id === 'seedDemo') {
    const previousDemoCount = records.filter((record) => record.isDemo).length;
    if (previousDemoCount && !confirm(`将替换现有 ${previousDemoCount} 条示例数据，真实记录会保留。继续吗？`)) return;
    records = records.filter((record) => !record.isDemo);
    const now = new Date();
    for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
      const count = daysAgo % 4 === 0 ? 1 : 2;
      for (let index = 0; index < count; index += 1) {
        const measuredAt = new Date(now);
        measuredAt.setDate(measuredAt.getDate() - daysAgo);
        measuredAt.setHours(index === 0 ? 7 + Math.floor(Math.random() * 2) : 20 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
        const systolic = 116 + Math.floor(Math.random() * 24) + (daysAgo % 9 === 0 ? 8 : 0);
        const diastolic = 72 + Math.floor(Math.random() * 15) + (daysAgo % 9 === 0 ? 4 : 0);
        records.push({ id: `demo_${measuredAt.getTime()}_${index}`, systolic, diastolic, pulse: 62 + Math.floor(Math.random() * 28), measuredAt: measuredAt.toISOString(), context: index === 0 ? 'morning' : 'bedtime', note: '示例数据', createdAt: measuredAt.toISOString(), updatedAt: measuredAt.toISOString(), isDemo: true });
      }
    }
    records = sortRecords(records);
    saveRecords(records);
    render();
    toast('已生成近 30 天示例数据');
    return;
  }
  if (target.id === 'clearRecords' && confirm('将删除本浏览器保存的全部记录，且无法恢复。确定继续吗？')) {
    records = [];
    saveRecords(records);
    render();
    toast('记录已清空');
    return;
  }
  if (target.id === 'exportCsv') {
    downloadBackup(records);
    toast('CSV 已导出');
  }
});

async function handleBackupImport(file) {
  try {
    const result = importBackupText(await file.text(), records);
    pendingImport = result;
    const dates = result.records.map((record) => new Date(record.measuredAt)).sort((a, b) => a - b);
    $('#importPreviewFile').textContent = file.name;
    $('#importPreviewRange').textContent = dates.length
      ? `${fmtDate(dates[0], { year: 'numeric', month: 'long', day: 'numeric' })} 至 ${fmtDate(dates.at(-1), { year: 'numeric', month: 'long', day: 'numeric' })}`
      : '没有可导入记录';
    $('#importPreviewNew').textContent = result.records.length;
    $('#importPreviewDuplicates').textContent = result.duplicates;
    $('#importPreviewInvalid').textContent = result.invalid;
    $('#applyImport').disabled = !result.records.length;
    $('#applyImport').textContent = result.records.length ? `导入 ${result.records.length} 条` : '没有可导入记录';
    $('#importPreviewDialog').showModal();
  } catch (error) {
    alert(error instanceof Error ? error.message : '读取 CSV 失败。');
  }
}

$('#cancelImport').onclick = $('#cancelImportText').onclick = () => {
  pendingImport = null;
  $('#importPreviewDialog').close();
};
$('#applyImport').onclick = () => {
  if (!pendingImport?.records.length) return;
  const { records: imported, duplicates, invalid } = pendingImport;
  records = sortRecords([...records, ...imported]);
  saveRecords(records);
  pendingImport = null;
  $('#importPreviewDialog').close();
  render();
  toast(`恢复完成：新增 ${imported.length} 条，跳过重复 ${duplicates} 条、无效 ${invalid} 条`);
};

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
