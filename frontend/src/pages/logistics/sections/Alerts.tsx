// frontend/src/pages/logistics/sections/Alerts.tsx
import React from 'react';
import type { LogisticsData } from '../hooks/useLogisticsData';
import { ALERT_COLORS, ALERT_ICONS } from '../constants';
import { getLogStyles } from '../styles';

interface Props { data: LogisticsData; t: Record<string, any>; isDark: boolean }

export function Alerts({ data, t, isDark }: Props) {
  const s = getLogStyles(isDark);
  const { alerts, updateAlert, showToast } = data;

  const handleAck = async (id: string) => {
    try { await updateAlert(id, 'ACKNOWLEDGED'); showToast('Acknowledged', 'ok'); }
    catch { showToast('Error', 'err'); }
  };
  const handleResolve = async (id: string) => {
    try { await updateAlert(id, 'RESOLVED'); showToast('Resolved', 'ok'); }
    catch { showToast('Error', 'err'); }
  };

  const open = alerts.filter(a => a.status === 'OPEN');
  const ackd = alerts.filter(a => a.status === 'ACKNOWLEDGED');
  const resolved = alerts.filter(a => a.status === 'RESOLVED');

  const renderTable = (list: typeof alerts, showActions: boolean) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
      <thead>
        <tr>
          <th style={s.thStyle}></th>
          <th style={s.thStyle}>{t.logPartNumber || 'Part'}</th>
          <th style={s.thStyle}>{t.logAlertType || 'Type'}</th>
          <th style={s.thStyle}>{t.logMessage || 'Message'}</th>
          <th style={s.thStyle}>{t.logDate || 'Date'}</th>
          {showActions && <th style={s.thStyle}>{t.logActions || 'Actions'}</th>}
        </tr>
      </thead>
      <tbody>
        {list.map(a => (
          <tr key={a.id}>
            <td style={s.tdStyle}>{ALERT_ICONS[a.alert_type] || '⚠️'}</td>
            <td style={s.tdStyle}>{a.part?.part_number} — {a.part?.name}</td>
            <td style={s.tdStyle}><span style={s.badge(ALERT_COLORS[a.alert_type] || '#f59e0b')}>{a.alert_type}</span></td>
            <td style={s.tdStyle}>{a.message}</td>
            <td style={s.tdStyle}>{new Date(a.created_at).toLocaleDateString('de-CH')}</td>
            {showActions && (
              <td style={s.tdStyle}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {a.status === 'OPEN' && <button style={{ ...s.btnSecondary, padding: '4px 8px', fontSize: 12 }} onClick={() => handleAck(a.id)}>{t.logAcknowledge || 'Ack'}</button>}
                  {a.status !== 'RESOLVED' && <button style={{ ...s.btnPrimary, padding: '4px 8px', fontSize: 12 }} onClick={() => handleResolve(a.id)}>{t.logResolve || 'Resolve'}</button>}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>🔔 {t.logAlerts || 'Alerts'}</h2>

      {open.length > 0 && (<><h3 style={{ color: '#ef4444' }}>{t.logOpen || 'Open'} ({open.length})</h3>{renderTable(open, true)}</>)}
      {ackd.length > 0 && (<><h3 style={{ color: '#f59e0b' }}>{t.logAcknowledged || 'Acknowledged'} ({ackd.length})</h3>{renderTable(ackd, true)}</>)}
      {resolved.length > 0 && (<><h3 style={{ color: '#22c55e' }}>{t.logResolved || 'Resolved'} ({resolved.length})</h3>{renderTable(resolved, false)}</>)}
      {alerts.length === 0 && <div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>{t.logNoAlerts || 'No alerts'}</div>}
    </div>
  );
}
