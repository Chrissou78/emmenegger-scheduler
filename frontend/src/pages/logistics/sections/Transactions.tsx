// frontend/src/pages/logistics/sections/Transactions.tsx
import React from 'react';
import type { LogisticsData } from '../hooks/useLogisticsData';
import type { PermChecks } from '../types';
import { TX_COLORS, TX_ICONS } from '../constants';
import { getLogStyles } from '../styles';
import { fmtCHF } from '../helpers';

interface Props { data: LogisticsData; t: Record<string, any>; isDark: boolean; perms: PermChecks }

export function Transactions({ data, t, isDark, perms }: Props) {
  const s = getLogStyles(isDark);
  const { transactions } = data;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>📋 {t.logTransactions || 'Transactions'}</h2>

      {transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>{t.logNoTransactions || 'No transactions yet'}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={s.thStyle}>{t.logDate || 'Date'}</th>
              <th style={s.thStyle}>{t.logType || 'Type'}</th>
              <th style={s.thStyle}>{t.logPartNumber || 'Part'}</th>
              <th style={s.thStyle}>{t.logQuantity || 'Qty'}</th>
              <th style={s.thStyle}>{t.logUnitPrice || 'Price'}</th>
              <th style={s.thStyle}>{t.logMachine || 'Machine'}</th>
              <th style={s.thStyle}>{t.logTask || 'Task'}</th>
              <th style={s.thStyle}>{t.logReference || 'Ref'}</th>
              <th style={s.thStyle}>{t.logUser || 'User'}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td style={s.tdStyle}>{new Date(tx.created_at).toLocaleDateString('de-CH')}</td>
                <td style={s.tdStyle}>
                  <span style={s.badge(TX_COLORS[tx.type] || '#666')}>
                    {TX_ICONS[tx.type] || ''} {tx.type}
                  </span>
                </td>
                <td style={s.tdStyle}>{tx.part?.part_number} — {tx.part?.name}</td>
                <td style={{ ...s.tdStyle, fontWeight: 700, color: tx.qty < 0 ? '#ef4444' : '#22c55e' }}>{tx.qty > 0 ? '+' : ''}{tx.qty}</td>
                <td style={s.tdStyle}>{tx.unit_price ? fmtCHF(tx.unit_price) : '—'}</td>
                <td style={s.tdStyle}>{tx.machine?.name || '—'}</td>
                <td style={s.tdStyle}>{tx.task?.name || '—'}</td>
                <td style={s.tdStyle}>{tx.reference || '—'}</td>
                <td style={s.tdStyle}>{tx.user ? `${tx.user.first_name} ${tx.user.last_name || ''}`.trim() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
