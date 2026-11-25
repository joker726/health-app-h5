import { average, contexts, dateKey, escapeHtml, formatDate, formatTime, groupByDay, lastDays } from '../core/records.js';

const $ = (selector) => document.querySelector(selector);
let points = [];
let geometry = { pad: 44, width: 720, height: 260, min: 50, max: 160 };
let focusIndex = 0;
let lastHapticAt = 0;

export function renderTrendChart(records, range) {
  const groups = groupByDay(records);
  points = lastDays(range)
    .map((date) => ({ date, items: groups.get(dateKey(date)) || [] }))
    .filter((point) => point.items.length)
    .map((point) => ({ ...point, ...average(point.items) }));

  const periodAverage = average(points.flatMap((point) => point.items));
  const previousDates = lastDays(range * 2).slice(0, range);
  const previousAverage = average(previousDates.flatMap((date) => groups.get(dateKey(date)) || []));
  const contextAverage = (context) => average(points.flatMap((point) => point.items.filter((item) => item.context === context)));
  const morningAverage = contextAverage('morning');
  const bedtimeAverage = contextAverage('bedtime');
  const delta = (current, previous, key) => current && previous ? current[key] - previous[key] : null;
  const changeText = (value) => value === null ? '暂无对比数据' : value === 0 ? '与前周期持平' : `较前周期 ${value > 0 ? '↑' : '↓'} ${Math.abs(value)} mmHg`;
  const { width, height } = geometry;
  const pad = geometry.pad;
  geometry.max = points.length ? Math.ceil((Math.max(...points.map((point) => point.s)) + 10) / 10) * 10 : 160;
  geometry.min = points.length ? Math.max(40, Math.floor((Math.min(...points.map((point) => point.d)) - 10) / 10) * 10) : 50;
  const { min, max } = geometry;
  const y = (value) => height - pad - ((value - min) / (max - min)) * (height - pad * 2);
  const x = (index) => pad + (points.length < 2 ? (width - pad * 2) / 2 : index * ((width - pad * 2) / (points.length - 1)));
  const line = (key) => points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point[key])}`).join(' ');
  const dots = (key, color) => points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point[key])}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`).join('');
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  const dateLabels = points.map((point, index) => ({ point, index })).filter(({ index }) => index === 0 || index === points.length - 1 || index % labelStep === 0).map(({ point, index }) => `<text x="${x(index)}" y="${height - 8}" class="date-tick" text-anchor="middle">${point.date.getMonth() + 1}/${point.date.getDate()}</text>`).join('');
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(min + ((max - min) * index) / 4));
  focusIndex = Math.max(0, points.length - 1);
  const focused = points[focusIndex];
  const overlay = focused ? `<g><line id="trendFocusLine" x1="${x(focusIndex)}" x2="${x(focusIndex)}" y1="${pad}" y2="${height - pad}" class="focus-line"/><circle id="trendFocusSys" cx="${x(focusIndex)}" cy="${y(focused.s)}" r="7" class="focus-dot sys-focus"/><circle id="trendFocusDia" cx="${x(focusIndex)}" cy="${y(focused.d)}" r="7" class="focus-dot dia-focus"/></g>` : '';
  const readout = focused ? `<div class="focus-readout" id="trendReadout"><div class="focus-date"><small>当前聚焦</small><b id="focusDate">${formatDate(focused.date, { month: 'long', day: 'numeric', weekday: 'short' })}</b></div><div><small><i class="legend-sys"></i>收缩压</small><b><span id="focusSys">${focused.s}</span><em>mmHg</em></b></div><div><small><i class="legend-dia"></i>舒张压</small><b><span id="focusDia">${focused.d}</span><em>mmHg</em></b></div><div><small>测量次数</small><b><span id="focusCount">${focused.items.length}</span><em>次</em></b></div></div><div class="day-detail" id="dayDetail">${renderDayDetail(focused)}</div>` : '';

  return `<section class="page-heading"><div><span class="eyebrow">PATTERNS & PROGRESS</span><h1>血压趋势</h1><p>按日均值观察变化，了解近期整体走势。</p></div><div class="segmented"><button data-range="7" class="${range === 7 ? 'selected' : ''}">近 7 天</button><button data-range="30" class="${range === 30 ? 'selected' : ''}">近 30 天</button></div></section><section class="section-card trend-card"><div class="section-heading"><div><h2>收缩压与舒张压</h2><p>点按图表选择日期，也可左右滑动查看</p></div><div class="chart-legend"><span><i class="legend-sys"></i>收缩压</span><span><i class="legend-dia"></i>舒张压</span></div></div>${points.length ? `<div class="chart-wrap"><svg class="trend-plot" viewBox="0 0 ${width} ${height}" role="slider" tabindex="0" aria-label="血压趋势图，左右滑动或点按选择日期" aria-valuemin="1" aria-valuemax="${points.length}" aria-valuenow="${focusIndex + 1}" aria-valuetext="${formatDate(focused.date, { month: 'long', day: 'numeric' })}，${focused.s}/${focused.d} mmHg">${ticks.map((tick) => `<line x1="${pad}" x2="${width - pad}" y1="${y(tick)}" y2="${y(tick)}" class="grid-line"/><text x="${pad - 8}" y="${y(tick) + 3}" class="axis-value" text-anchor="end">${tick}</text>`).join('')}<path d="${line('s')}" class="chart-line sys-line"/><path d="${line('d')}" class="chart-line dia-line"/>${dots('s', '#176f65')}${dots('d', '#d59b6b')}${overlay}<rect class="plot-hit-area" x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}"/>${dateLabels}</svg></div>${readout}` : `<div class="chart-empty"><span>⌁</span><b>这段时间还没有数据</b><p>记录几次测量后，这里会出现趋势图。</p><button class="button primary" data-add>记录血压</button></div>`}<div class="trend-stats"><div><small>期间平均</small><b>${periodAverage ? `${periodAverage.s} / ${periodAverage.d}` : '—'}</b><i>${changeText(delta(periodAverage, previousAverage, 's'))}（收缩压）</i><i>${changeText(delta(periodAverage, previousAverage, 'd'))}（舒张压）</i></div><div><small>晨起平均</small><b>${morningAverage ? `${morningAverage.s} / ${morningAverage.d}` : '—'}</b><i>${morningAverage ? '按“晨起”情境记录计算' : '暂无晨起情境记录'}</i></div><div><small>睡前平均</small><b>${bedtimeAverage ? `${bedtimeAverage.s} / ${bedtimeAverage.d}` : '—'}</b><i>${bedtimeAverage ? '按“睡前”情境记录计算' : '暂无睡前情境记录'}</i></div><div><small>有效测量日</small><b>${points.length}<i> 天 · ${points.reduce((total, point) => total + point.items.length, 0)} 次测量</i></b></div></div></section><p class="disclaimer">图表与均值用于记录观察，不能替代专业医疗评估。前周期对比仅统计已有记录。</p>`;
}

function renderDayDetail(point) {
  return `<div class="day-detail-heading"><b>当天测量明细</b><span>${point.items.length} 次</span></div><div class="day-detail-list">${point.items.slice().sort((a,b) => new Date(a.measuredAt)-new Date(b.measuredAt)).map((item) => `<div class="day-detail-row"><span>${formatTime(item.measuredAt)}</span><b>${item.systolic} / ${item.diastolic}<small> mmHg</small></b><span>${escapeHtml(contexts[item.context] || '其他')}</span>${item.pulse ? `<span>♥ ${item.pulse}</span>` : '<span>—</span>'}${item.note ? `<span class="day-note">${escapeHtml(item.note)}</span>` : ''}</div>`).join('')}</div>`;
}

export function updateTrendFocus(clientX, svg) {
  if (!points.length) return;
  const previousIndex = focusIndex;
  const { pad, width, height, min, max } = geometry;
  const bounds = svg.getBoundingClientRect();
  const scaledX = ((clientX - bounds.left) / bounds.width) * width;
  const ratio = Math.max(0, Math.min(1, (scaledX - pad) / (width - pad * 2)));
  focusIndex = points.length < 2 ? 0 : Math.round(ratio * (points.length - 1));
  if (focusIndex !== previousIndex) triggerHaptic();
  const point = points[focusIndex];
  const x = pad + (points.length < 2 ? (width - pad * 2) / 2 : focusIndex * ((width - pad * 2) / (points.length - 1)));
  const y = (value) => height - pad - ((value - min) / (max - min)) * (height - pad * 2);
  const cursor = $('#trendFocusLine');
  if (cursor) {
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
    $('#trendFocusSys').setAttribute('cx', x);
    $('#trendFocusSys').setAttribute('cy', y(point.s));
    $('#trendFocusDia').setAttribute('cx', x);
    $('#trendFocusDia').setAttribute('cy', y(point.d));
  }
  $('#focusDate').textContent = formatDate(point.date, { month: 'long', day: 'numeric', weekday: 'short' });
  $('#focusSys').textContent = point.s;
  $('#focusDia').textContent = point.d;
  $('#focusCount').textContent = point.items.length;
  svg.setAttribute('aria-valuenow', focusIndex + 1);
  svg.setAttribute('aria-valuetext', `${formatDate(point.date, { month: 'long', day: 'numeric' })}，${point.s}/${point.d} mmHg`);
  const detail = $('#dayDetail');
  if (detail) detail.innerHTML = renderDayDetail(point);
}

function triggerHaptic() {
  if (typeof navigator.vibrate !== 'function') return;
  const now = Date.now();
  if (now - lastHapticAt < 55) return;
  lastHapticAt = now;
  navigator.vibrate(10);
}

export function stepTrendFocus(step, svg) {
  if (!points.length) return;
  const nextIndex = Math.max(0, Math.min(points.length - 1, focusIndex + step));
  const { pad, width } = geometry;
  const x = pad + (points.length < 2 ? (width - pad * 2) / 2 : nextIndex * ((width - pad * 2) / (points.length - 1)));
  const bounds = svg.getBoundingClientRect();
  updateTrendFocus(bounds.left + (x / width) * bounds.width, svg);
}
