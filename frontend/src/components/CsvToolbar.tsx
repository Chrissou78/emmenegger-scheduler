import { useRef, useState, useMemo } from 'react';
import { useTheme } from '../contexts/themeContext';
import {
  exportCsv,
  downloadTemplate,
  parseCsv,
  readFileAsText,
  upsertRows,
  type CsvExportOptions,
  type CsvImportResult,
  type UpsertResult,
} from '../utils/csv';

/* ─── Translations ─── */
const L: Record<string, Record<string, string>> = {
  de: {
    export: 'CSV Export', import: 'CSV Import', template: 'Vorlage herunterladen',
    importTitle: 'CSV importieren', selectFile: 'CSV-Datei auswählen',
    importing: 'Importiere...', close: 'Schliessen', confirm: 'Importieren',
    rows: 'Zeilen', errors: 'Fehler', skipped: 'Übersprungen',
    preview: 'Vorschau', success: 'Import erfolgreich', noFile: 'Keine Datei ausgewählt',
    dragDrop: 'CSV-Datei hier ablegen oder klicken',
    upsertMode: 'Upsert (ID-basiert)', toCreate: 'Neu anlegen', toUpdate: 'Aktualisieren',
    upsertResult: 'Upsert-Ergebnis', created: 'Erstellt', updated: 'Aktualisiert',
  },
  en: {
    export: 'CSV Export', import: 'CSV Import', template: 'Download Template',
    importTitle: 'Import CSV', selectFile: 'Select CSV file',
    importing: 'Importing...', close: 'Close', confirm: 'Import',
    rows: 'Rows', errors: 'Errors', skipped: 'Skipped',
    preview: 'Preview', success: 'Import successful', noFile: 'No file selected',
    dragDrop: 'Drop CSV file here or click to browse',
    upsertMode: 'Upsert (ID-based)', toCreate: 'To create', toUpdate: 'To update',
    upsertResult: 'Upsert result', created: 'Created', updated: 'Updated',
  },
  fr: {
    export: 'Export CSV', import: 'Import CSV', template: 'Télécharger le modèle',
    importTitle: 'Importer CSV', selectFile: 'Sélectionner un fichier CSV',
    importing: 'Importation...', close: 'Fermer', confirm: 'Importer',
    rows: 'Lignes', errors: 'Erreurs', skipped: 'Ignorées',
    preview: 'Aperçu', success: 'Import réussi', noFile: 'Aucun fichier sélectionné',
    dragDrop: 'Déposez un fichier CSV ici ou cliquez',
    upsertMode: 'Upsert (basé sur ID)', toCreate: 'À créer', toUpdate: 'À mettre à jour',
    upsertResult: 'Résultat upsert', created: 'Créés', updated: 'Mis à jour',
  },
  pt: {
    export: 'Exportar CSV', import: 'Importar CSV', template: 'Descarregar Modelo',
    importTitle: 'Importar CSV', selectFile: 'Selecionar ficheiro CSV',
    importing: 'A importar...', close: 'Fechar', confirm: 'Importar',
    rows: 'Linhas', errors: 'Erros', skipped: 'Ignoradas',
    preview: 'Pré-visualização', success: 'Import concluído', noFile: 'Nenhum ficheiro selecionado',
    dragDrop: 'Arraste um ficheiro CSV aqui ou clique',
    upsertMode: 'Upsert (baseado em ID)', toCreate: 'A criar', toUpdate: 'A atualizar',
    upsertResult: 'Resultado upsert', created: 'Criados', updated: 'Atualizados',
  },
};

export interface CsvColumn {
  key: string;
  label: string;
}

interface CsvToolbarProps<T extends Record<string, any>> {
  /** Column definitions for export/import mapping */
  columns: CsvColumn[];
  /** Current (filtered) data to export */
  data: T[];
  /** Base filename for downloads */
  filename: string;
  /** Optional value formatters for export */
  formatters?: Record<string, (value: any, row: T) => string>;
  /** Optional validators for import */
  validators?: Record<string, (value: string) => string | null>;
  /** Example rows for the template file */
  exampleRows?: Record<string, string>[];
  /** Called when import is confirmed (plain insert) — receives parsed rows */
  onImport: (rows: Record<string, any>[]) => Promise<void>;
  /** Whether import is allowed (e.g. manager-only) */
  canImport?: boolean;

  /* ── Upsert props ── */
  /** Enable upsert UI toggle */
  upsertEnabled?: boolean;
  /** The column key used to match existing records (usually "id") */
  upsertMatchKey?: string;
  /** Base API URL */
  apiUrl?: string;
  /** Endpoint path for upsert (POST for create, PUT/:id for update) */
  upsertEndpoint?: string;
  /** Auth headers for API calls */
  authHeaders?: HeadersInit;
  /** Set of existing IDs to distinguish create vs update */
  existingIds?: Set<string>;
  /** Transform row before sending to API */
  upsertTransform?: (row: Record<string, any>) => Record<string, any>;
  /** Called after upsert completes */
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
  const t = L[lang] || L.en;
  const fileRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<CsvImportResult<Record<string, any>> | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [useUpsert, setUseUpsert] = useState(false);

  /* Compute create vs update counts for upsert preview */
  const upsertCounts = useMemo(() => {
    if (!preview || !existingIds || !useUpsert) return { toCreate: 0, toUpdate: 0 };
    let toCreate = 0;
    let toUpdate = 0;
    for (const row of preview.data) {
      const key = row[upsertMatchKey];
      if (key && existingIds.has(String(key))) {
        toUpdate++;
      } else {
        toCreate++;
      }
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
        // Upsert mode
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
        // Plain insert mode
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
        {/* Export button */}
        <button onClick={handleExport}
          style={{ ...btnStyle, border: `1px solid ${th.border}`, background: 'transparent', color: th.textMuted }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = th.gold; e.currentTarget.style.color = th.gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.color = th.textMuted; }}
        >
          <span style={{ fontSize: 13 }}>↓</span> {t.export}
        </button>

        {/* Import button (managers only) */}
        {canImport && (
          <button onClick={() => { setModalOpen(true); setPreview(null); setUseUpsert(false); }}
            style={{ ...btnStyle, border: `1px solid ${th.border}`, background: 'transparent', color: th.textMuted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = th.gold; e.currentTarget.style.color = th.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.color = th.textMuted; }}
          >
            <span style={{ fontSize: 13 }}>↑</span> {t.import}
          </button>
        )}

        {/* Template button */}
        {canImport && (
          <button onClick={handleTemplate}
            style={{ ...btnStyle, border: `1px solid ${th.borderFaint}`, background: 'transparent', color: th.textDim, fontSize: 10 }}
            onMouseEnter={e => { e.currentTarget.style.color = th.textMuted; }}
            onMouseLeave={e => { e.currentTarget.style.color = th.textDim; }}
          >
            📄 {t.template}
          </button>
        )}
      </div>

      {/* ─── Import Modal ─── */}
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
              {t.importTitle}
            </h3>

            {/* Upsert toggle */}
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
                {t.upsertMode}
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

            {/* Drop zone */}
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
              <div style={{ fontSize: 13, color: th.textMuted }}>{t.dragDrop}</div>
              <div style={{ fontSize: 11, color: th.textDim, marginTop: 4 }}>.csv (UTF-8)</div>
            </div>

            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect}
              style={{ display: 'none' }} />

            {/* Preview */}
            {preview && (
              <div style={{ marginTop: 20 }}>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(76,175,80,.12)' : 'rgba(76,175,80,.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#4caf50' }}>{preview.data.length}</div>
                    <div style={{ fontSize: 10, color: th.textDim }}>{t.rows}</div>
                  </div>
                  {preview.errors.length > 0 && (
                    <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(244,67,54,.12)' : 'rgba(244,67,54,.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#f44336' }}>{preview.errors.length}</div>
                      <div style={{ fontSize: 10, color: th.textDim }}>{t.errors}</div>
                    </div>
                  )}
                  {preview.skipped > 0 && (
                    <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(255,152,0,.12)' : 'rgba(255,152,0,.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#ff9800' }}>{preview.skipped}</div>
                      <div style={{ fontSize: 10, color: th.textDim }}>{t.skipped}</div>
                    </div>
                  )}
                  {/* Upsert counts */}
                  {useUpsert && upsertEnabled && (
                    <>
                      <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(33,150,243,.12)' : 'rgba(33,150,243,.08)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#2196f3' }}>{upsertCounts.toCreate}</div>
                        <div style={{ fontSize: 10, color: th.textDim }}>{t.toCreate}</div>
                      </div>
                      <div style={{ padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(156,39,176,.12)' : 'rgba(156,39,176,.08)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#9c27b0' }}>{upsertCounts.toUpdate}</div>
                        <div style={{ fontSize: 10, color: th.textDim }}>{t.toUpdate}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Error list */}
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
                        ...+{preview.errors.length - 20} more
                      </div>
                    )}
                  </div>
                )}

                {/* Data preview table */}
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
                              +{preview.data.length - 5} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => { setModalOpen(false); setPreview(null); }}
                style={{ padding: '10px 20px', borderRadius: 6, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {t.close}
              </button>
              {preview && preview.data.length > 0 && (
                <button onClick={handleConfirmImport} disabled={importing}
                  style={{
                    padding: '10px 20px', borderRadius: 6, border: 'none',
                    background: th.gold, color: '#fff', cursor: importing ? 'wait' : 'pointer',
                    fontWeight: 700, fontSize: 13, opacity: importing ? .7 : 1,
                  }}>
                  {importing
                    ? t.importing
                    : useUpsert
                      ? `${t.confirm} — ${upsertCounts.toCreate} new / ${upsertCounts.toUpdate} upd`
                      : `${t.confirm} (${preview.data.length})`
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
