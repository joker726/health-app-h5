export const contexts = {
  morning: '晨起',
  bedtime: '睡前',
  afterMed: '服药后',
  other: '其他',
};

const STORAGE_KEY = 'health-app-h5.records.v1';

export function readRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? sortRecords(parsed) : [];
  } catch {
    return [];
  }
}

export function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function sortRecords(records) {
  return [...records].sort(
    (a, b) => new Date(b.measuredAt) - new Date(a.measuredAt),
  );
}

export function dateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDate(value, options = { month: 'long', day: 'numeric' }) {
  return new Intl.DateTimeFormat('zh-CN', options).format(new Date(value));
}

export function formatTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function classify(systolic, diastolic) {
  if (systolic < 90 || diastolic < 60) return ['偏低', 'low'];
  if (systolic >= 140 || diastolic >= 90) return ['偏高', 'high'];
  if (systolic >= 120 || diastolic >= 80) return ['略高', 'elevated'];
  return ['理想范围', 'normal'];
}

export function average(records) {
  if (!records.length) return null;
  return {
    s: Math.round(records.reduce((sum, record) => sum + record.systolic, 0) / records.length),
    d: Math.round(records.reduce((sum, record) => sum + record.diastolic, 0) / records.length),
  };
}

export function groupByDay(records) {
  const groups = new Map();
  for (const record of records) {
    const key = dateKey(record.measuredAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

export function lastDays(count) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    dates.push(date);
  }
  return dates;
}

export function recordSignature(record) {
  return [
    new Date(record.measuredAt).toISOString(), record.systolic,
    record.diastolic, record.pulse ?? '', record.context, record.note || '',
  ].join('|');
}
