import { contexts, recordSignature, sortRecords } from '../core/records.js';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (quoted) throw new Error('CSV 文件的引号格式不完整。');
  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

export function importBackupText(text, existingRecords) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('文件中没有可导入的记录。');

  const headers = rows.shift().map((value) => value.trim());
  const column = (...names) => headers.findIndex((header) => names.includes(header));
  const index = {
    date: column('日期时间', '测量时间', 'measuredAt'),
    systolic: column('收缩压', 'systolic'),
    diastolic: column('舒张压', 'diastolic'),
    pulse: column('心率', 'pulse'),
    context: column('情境', '测量情境', 'context'),
    note: column('备注', 'note'),
    id: column('记录ID', 'id'),
    demo: column('数据类型', 'isDemo'),
  };
  if ([index.date, index.systolic, index.diastolic].some((value) => value < 0)) {
    throw new Error('无法识别表头。请使用血压记导出的 CSV 备份文件。');
  }

  const signatures = new Set(existingRecords.map(recordSignature));
  const ids = new Set(existingRecords.map((record) => record.id));
  const imported = [];
  let invalid = 0;
  let duplicates = 0;

  for (const cells of rows) {
    const measuredAt = new Date((cells[index.date] || '').trim());
    const systolic = Number(cells[index.systolic]);
    const diastolic = Number(cells[index.diastolic]);
    const pulseText = index.pulse < 0 ? '' : (cells[index.pulse] || '').trim();
    const pulse = pulseText ? Number(pulseText) : null;
    const contextText = index.context < 0 ? '其他' : (cells[index.context] || '').trim();
    const context = Object.keys(contexts).find((key) => key === contextText)
      || Object.keys(contexts).find((key) => contexts[key] === contextText)
      || 'other';
    const note = index.note < 0 ? '' : (cells[index.note] || '').trim();

    if (!Number.isFinite(measuredAt.getTime()) || !Number.isInteger(systolic)
      || !Number.isInteger(diastolic) || systolic < 50 || systolic > 250
      || diastolic < 30 || diastolic > 180 || diastolic >= systolic
      || (pulse !== null && (!Number.isInteger(pulse) || pulse < 30 || pulse > 220))) {
      invalid += 1;
      continue;
    }

    const suppliedId = index.id < 0 ? '' : (cells[index.id] || '').trim();
    let id = suppliedId || `import_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    if (ids.has(id)) id = `import_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    ids.add(id);
    const record = {
      id, systolic, diastolic, pulse, measuredAt: measuredAt.toISOString(), context, note,
      createdAt: measuredAt.toISOString(), updatedAt: new Date().toISOString(),
      isDemo: index.demo >= 0 && ['示例', 'demo', 'true'].includes((cells[index.demo] || '').trim().toLowerCase()),
    };
    const signature = recordSignature(record);
    if (signatures.has(signature)) {
      duplicates += 1;
      continue;
    }
    signatures.add(signature);
    imported.push(record);
  }

  return { records: sortRecords(imported), invalid, duplicates };
}

export function downloadBackup(records) {
  const rows = [
    ['记录ID', '日期时间', '收缩压', '舒张压', '心率', '情境', '备注', '数据类型'],
    ...records.map((record) => [
      record.id, record.measuredAt, record.systolic, record.diastolic,
      record.pulse ?? '', contexts[record.context] || '其他', record.note,
      record.isDemo ? '示例' : '真实',
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'blood-pressure-records.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}
