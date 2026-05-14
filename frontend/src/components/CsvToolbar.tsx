import { useRef, useState, useMemo } from 'react';
import { useTheme } from '../contexts/themeContext';
import { getTranslations, type LangCode } from '../i18n';
import {
  exportCsv,
  downloadTemplate,
  parseCsv,
  readFileAsText,
  upsertRows,
  type CsvImportResult,
  type UpsertResult,
} from '../utils/csv';

export interface CsvColumn {
  key: string;
  label: string;
}

interface CsvToolbarProps<T extends Record<string, any>> {
  columns: CsvColumn[];
  data: T[];
  filename: string;
  formatters?: Record<string, (value: any, row: T) => string>;
  validators?: Record<string, (value: string) => string | null>;
  exampleRows?: Record<string, string>[];
  onImport: (rows: Record<string, any>[]) => Promise<void>;
  canImport?: boolean;
  upsertEnabled?: boolean;
  upsertMatchKey?: string;
  apiUrl?: string;
  upsertEndpoint?: string;
  authHeaders?: HeadersInit;
  existingIds?: Set<string>;
  upsertTransform?: (row: Record<string, any>) => Record<string, any>;
  onUpsertComplete?: (result: UpsertResult) => void;
}

export function CsvToolbar<T extends Record<string, any>>({
  columns,
  data,
  filename,
  formatters,
  validators,
  exampleRows,
  onImport,
  canImport = true,
  upsertEnabled = false,
  upsertMatchKey = 'id',
  apiUrl = '',
  upsertEndpoint = '',
  authHeaders = {},
  existingIds,
  upsertTransform,
  onUpsertComplete,
}: CsvToolbarProps<T>) {
  const { th, isDark, lang } = useTheme();
  const L = getTranslations(lang as LangCode);
  const fileRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<CsvImportResult<Record<string, any>> | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [useUpsert, setUseUpsert] = useState(false);

  const upsertCounts = useMemo(() => {
    if (!preview || !existingIds || !useUpsert) return { toCreate: 0, toUpdate: 0 };
    let toCreate = 0;
    let toUpdate = 0;
    for (const row of preview.data) {
      const key = row[upsertMatchKey];
      if (key && existingIds.has(String(key))) toUpdate++;
      else toCreate++;
    }
    return { toCreate, toUpdate };
  }, [preview, existingIds, useUpsert, upsertMatchKey]);

  const handleExport = () => {
    exportCsv({ data, columns, filename, formatters });
  };

  const handleTemplate = () => {
    downloadTemplate(columns, filename, exampleRows);
  };

  const processFile = async (file: File) => {
    const text = await readFileAsText(file);
    const result = parseCsv(text, columns, validators);
    setPreview(result);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      await processFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.data.length === 0) return;
    setImporting(true);
    try {
      if (useUpsert && upsertEnabled && upsertEndpoint) {
        const result = await upsertRows({
          rows: preview.data,
          matchKey: upsertMatchKey,
          apiUrl,
          endpoint: upsertEndpoint,
          authHeaders,
          existingIds: existingIds ?? new Set(),
          transform: upsertTransform,
        });
        setModalOpen(false);
        setPreview(null);
        onUpsertComplete?.(result);
      } else {
        await onImport(preview.data);
        setModalOpen(false);
        setPreview(null);
      }
    } catch { /* parent handles errors */ }
    setImporting(false);
  };

  const btnStyle: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Inter',sans-serif", letterSpacing: 0.3,
    transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={handleExport}
          style={{ ...btnStyle, border: `1px solid ${th.border}`, background: 'transparent', color: th.textMuted }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = th.gold; e.currentTarget.style.color = th.gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.color = th.textMuted; }}
        >
          <span style={{ fontSize: 13 }}>↓</span> {L.csvExport}
        </button>

        {canImport && (
          <button onClick={() => { setModalOpen(true); setPreview(null); setUseUpsert(false); }}
            style={{ ...btnStyle, border: `1px solid ${th.border}`, background: 'transparent', color: th.textMuted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = th.gold; e.currentTarget.style.color = th.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.color = th.textMuted; }}
          >
            <span style={{ fontSize: 13 }}>↑</span> {L.csvImport}
          </button>
        )}

        {canImport && (
          <button onClick={handleTemplate}
            style={{ ...btnStyle, border: `1px solid ${th.borderFaint}`, background: 'transparent', color: th.textDim, fontSize: 10 }}
            onMouseEnter={e => { e.currentTarget.style.color = th.textMuted; }}
            onMouseLeave={e => { e.currentTarget.style.color = th.textDim; }}
          >
            📄 {L.csvTemplate}
          </button>
        )}
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: th.modalBg, backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => { setModalOpen(false); setPreview(null); }}>
          <div style={{
            background: th.modalCard || th.bgCard, borderRadius: 12, padding: 28, width: 600,
            maxHeight: '85vh', overflowY: 'auto', border: `1px solid ${th.border}`,
            boxShadow: isDark ? '0 20px 60px rgba(0,0,0,.5)' : '0 20px 60px rgba(0,0,0,.1)',
          }} onClick={e => e.stopPropagation()}>

            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: th.gold }}>
              {L.csvImportTitle}
            </h3>

            {upsertEnabled && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                fontSize: 13, color: th.textMuted, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={useUpsert}
                  onChange={(e) => setUseUpsert(e.target.checked)}
                  style={{ accentColor: th.gold }}
                />
                {L.csvUpsertMode}
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: useUpsert ? (th.gold + '22') : 'transparent',
                  color: useUpsert ? th.gold : th.textDim,
                  border: `1px solid ${useUpsert ? th.gold : th.borderFaint}`,
                }}>
                  {upsertMatchKey.toUpperCase()}
                </span>
              </label>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? th.gold : th.border}`,
                borderRadius: 8, padding: '32px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'all .15s',
                background: dragOver ? (isDark ? 'rgba(200,169,110,.08)' : 'rgba(200,169,110,.04)') : 'transparent',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13, color: th.textMuted }}>{L.csvDragDrop}</div>
              <div style={{ fontSize: 11, color: th.textDim, marginTop: 4 }}>.csv (UTF-8)</div>
            </div>

            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect}
              style={{ display: 'none' }} />

            {preview && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(76,175,80,.12)' : 'rgba(76,175,80,.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#4caf50' }}>{preview.data.length}</div>
                    <div style={{ fontSize: 10, color: th.textDim }}>{L.csvRows}</div>
                  </div>
                  {preview.errors.length > 0 && (
                    <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(244,67,54,.12)' : 'rgba(244,67,54,.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#f44336' }}>{preview.errors.length}</div>
                      <div style={{ fontSize: 10, color: th.textDim }}>{L.csvErrors}</div>
                    </div>
                  )}
                  {preview.skipped > 0 && (
                    <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(255,152,0,.12)' : 'rgba(255,152,0,.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#ff9800' }}>{preview.skipped}</div>
                      <div style={{ fontSize: 10, color: th.textDim }}>{L.csvSkipped}</div>
                    </div>
                  )}
                  {useUpsert && upsertEnabled && (
                    <>
                      <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(33,150,243,.12)' : 'rgba(33,150,243,.08)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#2196f3' }}>{upsertCounts.toCreate}</div>
                        <div style={{ fontSize: 10, color: th.textDim }}>{L.csvToCreate}</div>
                      </div>
                      <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(156,39,176,.12)' : 'rgba(156,39,176,.08)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#9c27b0' }}>{upsertCounts.toUpdate}</div>
                        <div style={{ fontSize: 10, color: th.textDim }}>{L.csvToUpdate}</div>
                      </div>
                    </>
                  )}
                </div>

                {preview.errors.length > 0 && (
                  <div style={{
                    maxHeight: 120, overflowY: 'auto', padding: 12, borderRadius: 6,
                    background: isDark ? 'rgba(244,67,54,.08)' : '#fff3f3',
                    border: `1px solid ${isDark ? 'rgba(244,67,54,.2)' : '#ffcdd2'}`,
                    fontSize: 11, color: '#f44336', marginBottom: 12, lineHeight: 1.6,
                  }}>
                    {preview.errors.slice(0, 20).map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                    {preview.errors.length > 20 && (
                      <div style={{ fontWeight: 600, marginTop: 4 }}>
                        ...+{preview.errors.length - 20}
                      </div>
                    )}
                  </div>
                )}

                {preview.data.length > 0 && (
                  <div style={{
                    maxHeight: 200, overflowY: 'auto', borderRadius: 6,
                    border: `1px solid ${th.border}`,
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: th.bgCard }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', color: th.textDim, fontWeight: 600 }}>#</th>
                          {columns.slice(0, 5).map(col => (
                            <th key={col.key} style={{
                              padding: '6px 10px', textAlign: 'left', fontWeight: 600,
                              color: (useUpsert && col.key === upsertMatchKey) ? th.gold : th.textDim,
                            }}>
                              {col.label}
                              {useUpsert && col.key === upsertMatchKey && ' 🔑'}
                            </th>
                          ))}
                          {columns.length > 5 && (
                            <th style={{ padding: '6px 10px', color: th.textDim }}>…</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.data.slice(0, 5).map((row, i) => {
                          const isExisting = useUpsert && existingIds?.has(String(row[upsertMatchKey]));
                          return (
                            <tr key={i} style={{ borderTop: `1px solid ${th.borderFaint}` }}>
                              <td style={{ padding: '6px 10px', color: th.textDim }}>
                                {i + 1}
                                {useUpsert && (
                                  <span style={{
                                    marginLeft: 4, fontSize: 9, padding: '1px 4px', borderRadius: 3,
                                    background: isExisting ? 'rgba(156,39,176,.15)' : 'rgba(33,150,243,.15)',
                                    color: isExisting ? '#9c27b0' : '#2196f3',
                                  }}>
                                    {isExisting ? 'UPD' : 'NEW'}
                                  </span>
                                )}
                              </td>
                              {columns.slice(0, 5).map(col => (
                                <td key={col.key} style={{ padding: '6px 10px', color: th.text, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {row[col.key] || '–'}
                                </td>
                              ))}
                              {columns.length > 5 && <td style={{ padding: '6px 10px', color: th.textDim }}>…</td>}
                            </tr>
                          );
                        })}
                        {preview.data.length > 5 && (
                          <tr>
                            <td colSpan={Math.min(columns.length, 5) + 2} style={{ padding: '6px 10px', color: th.textDim, fontStyle: 'italic', textAlign: 'center' }}>
                              +{preview.data.length - 5} {L.csvRows}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => { setModalOpen(false); setPreview(null); }}
                style={{ padding: '10px 20px', borderRadius: 6, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {L.close}
              </button>
              {preview && preview.data.length > 0 && (
                <button onClick={handleConfirmImport} disabled={importing}
                  style={{
                    padding: '10px 20px', borderRadius: 6, border: 'none',
                    background: th.gold, color: '#fff', cursor: importing ? 'wait' : 'pointer',
                    fontWeight: 700, fontSize: 13, opacity: importing ? .7 : 1,
                  }}>
                  {importing
                    ? L.csvImporting
                    : useUpsert
                      ? `${L.csvConfirm} — ${upsertCounts.toCreate} ${L.csvToCreate} / ${upsertCounts.toUpdate} ${L.csvToUpdate}`
                      : `${L.csvConfirm} (${preview.data.length})`
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
