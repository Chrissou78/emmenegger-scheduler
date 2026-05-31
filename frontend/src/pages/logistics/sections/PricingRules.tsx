// frontend/src/pages/logistics/sections/PricingRules.tsx
import React, { useState } from 'react';
import type { LogisticsData } from '../hooks/useLogisticsData';
import { CONSUMABLE_CATEGORIES, CATEGORY_I18N } from '../constants';
import { getLogStyles } from '../styles';

interface Props { data: LogisticsData; t: Record<string, any>; isDark: boolean }

export function PricingRules({ data, t, isDark }: Props) {
  const s = getLogStyles(isDark);
  const { marginRules, consumableParts } = data;

  // For now, local state — when the backend has margin_rules CRUD, wire it up
  const [defaultMargin, setDefaultMargin] = useState(50);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, number>>({});

  const updateCatMargin = (cat: string, val: string) => {
    setCategoryOverrides(prev => ({ ...prev, [cat]: Number(val) || 0 }));
  };

  const usedCategories = [...new Set(consumableParts.map(p => p.category))];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>💲 {t.logPricingRules || 'Pricing Rules'}</h2>
      <p style={{ color: s.muted, marginBottom: 24 }}>{t.logMarginRuleDesc || 'Set default or per-category margin rules for consumable pricing'}</p>

      {/* Default margin */}
      <div style={{ ...s.card, marginBottom: 24 }}>
        <h3>{t.logDefaultMargin || 'Default Margin'}</h3>
        <p style={{ fontSize: 13, color: s.muted, marginBottom: 12 }}>
          Applied to all consumables unless overridden by category or part-level rules.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="number" style={{ ...s.input, width: 100 }} value={defaultMargin}
                 onChange={e => setDefaultMargin(Number(e.target.value))} min={0} max={500} />
          <span style={{ fontSize: 14 }}>%</span>
          <button style={s.btnPrimary}>{t.save || 'Save'}</button>
        </div>
      </div>

      {/* Category overrides */}
      <div style={{ ...s.card, marginBottom: 24 }}>
        <h3>{t.logCategoryMargin || 'Category Margins'}</h3>
        <p style={{ fontSize: 13, color: s.muted, marginBottom: 12 }}>
          Override the default margin for specific categories.
        </p>
        {usedCategories.length === 0 ? (
          <div style={{ opacity: 0.6, padding: 16, textAlign: 'center' }}>{t.logNoMarginRules || 'No consumables yet'}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={s.thStyle}>{t.logCategory || 'Category'}</th>
                <th style={s.thStyle}>{t.logPartsCol || 'Parts'}</th>
                <th style={s.thStyle}>{t.logMarginPct || 'Margin %'}</th>
              </tr>
            </thead>
            <tbody>
              {usedCategories.map(cat => {
                const count = consumableParts.filter(p => p.category === cat).length;
                return (
                  <tr key={cat}>
                    <td style={s.tdStyle}>{t[CATEGORY_I18N[cat]] || cat}</td>
                    <td style={s.tdStyle}>{count}</td>
                    <td style={s.tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="number" style={{ ...s.input, width: 80 }}
                               value={categoryOverrides[cat] ?? ''}
                               placeholder={`${defaultMargin}`}
                               onChange={e => updateCatMargin(cat, e.target.value)} />
                        <span style={{ fontSize: 13 }}>%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
