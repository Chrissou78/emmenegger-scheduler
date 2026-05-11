// frontend/src/pages/settings/VatTab.tsx
import React, { useState } from 'react';
import type { SettingsData } from './useSettingsData';
import type { Styles } from './settingsStyles';
import type { VatRate, CrossBorderCountry } from './types';
import { EMPTY_VAT_RATE, EMPTY_CROSS_BORDER } from './types';

interface Props {
  data: SettingsData;
  S: Styles;
  t: Record<string, any>;
  gold: string;
}

export default function VatTab({ data, S, t, gold }: Props) {
  const { vatRates, crossBorderCountries, saving, fetchVatRates, fetchCrossBorderCountries, hdrs, showToast, setConfirmDel } = data;

  const [subTab, setSubTab] = useState<'rates' | 'countries'>('rates');
  const API = import.meta.env.VITE_API_URL ?? '';

  // VAT modal
  const [vatModal, setVatModal] = useState(false);
  const [vatEditId, setVatEditId] = useState<string | null>(null);
  const [vatForm, setVatForm] = useState<Omit<VatRate, 'id'>>(EMPTY_VAT_RATE);

  const openCreateVat = () => { setVatForm({ ...EMPTY_VAT_RATE }); setVatEditId(null); setVatModal(true); };
  const openEditVat = (v: VatRate) => {
    setVatForm({ country_code: v.country_code, country_name: v.country_name, rate_type: v.rate_type, rate_percent: v.rate_percent, description: v.description, is_active: v.is_active });
    setVatEditId(v.id); setVatModal(true);
  };
  const saveVat = async () => {
    data.setSaving(true);
    try {
      const url = vatEditId ? `${API}/api/v1/settings/vat-rates/${vatEditId}` : `${API}/api/v1/settings/vat-rates`;
      const r = await fetch(url, { method: vatEditId ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(vatForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved'); setVatModal(false); fetchVatRates();
    } catch (e) { showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false); }
    finally { data.setSaving(false); }
  };

  // CB modal
  const [cbModal, setCbModal] = useState(false);
  const [cbEditId, setCbEditId] = useState<string | null>(null);
  const [cbForm, setCbForm] = useState<Omit<CrossBorderCountry, 'id'>>(EMPTY_CROSS_BORDER);

  const openCreateCB = () => { setCbForm({ ...EMPTY_CROSS_BORDER }); setCbEditId(null); setCbModal(true); };
  const openEditCB = (c: CrossBorderCountry) => {
    setCbForm({ country_code: c.country_code, country_name: c.country_name, currency: c.currency, vat_registered: c.vat_registered, vat_number: c.vat_number, reverse_charge: c.reverse_charge, notes: c.notes, is_active: c.is_active });
    setCbEditId(c.id); setCbModal(true);
  };
  const saveCB = async () => {
    data.setSaving(true);
    try {
      const url = cbEditId ? `${API}/api/v1/settings/cross-border/${cbEditId}` : `${API}/api/v1/settings/cross-border`;
      const r = await fetch(url, { method: cbEditId ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(cbForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved'); setCbModal(false); fetchCrossBorderCountries();
    } catch (e) { showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false); }
    finally { data.setSaving(false); }
  };

  const subTabBtn = (key: 'rates' | 'countries', label: string) => (
    <button onClick={() => setSubTab(key)} style={{
      padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: subTab === key ? gold + '22' : 'transparent', color: subTab === key ? gold : 'inherit',
    }}>{label}</button>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {subTabBtn('rates', t.vatRates ?? 'VAT Rates')}
        {subTabBtn('countries', t.crossBorderCountries ?? 'Cross-Border')}
      </div>

      {/* ── VAT RATES ── */}
      {subTab === 'rates' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: gold }}>{t.vatRates ?? 'VAT Rates'}</h3>
            <button style={S.sBtn(gold)} onClick={openCreateVat}>+ {t.newVatRate ?? 'New Rate'}</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.sTh}>{t.countryCode ?? 'Code'}</th>
              <th style={S.sTh}>{t.countryName ?? 'Country'}</th>
              <th style={S.sTh}>{t.rateType ?? 'Type'}</th>
              <th style={S.sTh}>{t.ratePercent ?? 'Rate'}</th>
              <th style={S.sTh}>{t.description ?? 'Description'}</th>
              <th style={S.sTh}>{t.active ?? 'Active'}</th>
              <th style={S.sTh}></th>
            </tr></thead>
            <tbody>
              {vatRates.length === 0 && <tr><td colSpan={7} style={{ ...S.sTd, textAlign: 'center', color: S.dimText }}>{t.noResults ?? 'No results'}</td></tr>}
              {vatRates.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => openEditVat(v)}>
                  <td style={{ ...S.sTd, fontFamily: 'monospace', fontWeight: 700 }}>{v.country_code}</td>
                  <td style={S.sTd}>{v.country_name}</td>
                  <td style={S.sTd}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: v.rate_type === 'STANDARD' ? gold + '22' : v.rate_type === 'REDUCED' ? '#22c55e22' : '#3b82f622',
                      color: v.rate_type === 'STANDARD' ? gold : v.rate_type === 'REDUCED' ? '#22c55e' : '#3b82f6',
                    }}>{v.rate_type}</span>
                  </td>
                  <td style={{ ...S.sTd, fontWeight: 700 }}>{v.rate_percent}%</td>
                  <td style={S.sTd}>{v.description}</td>
                  <td style={S.sTd}><span style={{ color: v.is_active ? '#22c55e' : '#6b7280' }}>●</span></td>
                  <td style={S.sTd}>
                    <button style={{ ...S.sBtn('#ef4444'), padding: '4px 10px', fontSize: 12 }}
                      onClick={e => { e.stopPropagation(); setConfirmDel({ type: 'vat-rates', id: v.id }); }}>
                      {t.delete ?? 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── CROSS-BORDER ── */}
      {subTab === 'countries' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: gold }}>{t.crossBorderCountries ?? 'Cross-Border'}</h3>
            <button style={S.sBtn(gold)} onClick={openCreateCB}>+ {t.newCountry ?? 'New Country'}</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.sTh}>{t.countryCode ?? 'Code'}</th>
              <th style={S.sTh}>{t.countryName ?? 'Country'}</th>
              <th style={S.sTh}>{t.currency ?? 'Currency'}</th>
              <th style={S.sTh}>{t.vatRegistered ?? 'VAT Reg.'}</th>
              <th style={S.sTh}>{t.reverseCharge ?? 'Reverse Charge'}</th>
              <th style={S.sTh}>{t.notes ?? 'Notes'}</th>
              <th style={S.sTh}></th>
            </tr></thead>
            <tbody>
              {crossBorderCountries.length === 0 && <tr><td colSpan={7} style={{ ...S.sTd, textAlign: 'center', color: S.dimText }}>{t.noResults ?? 'No results'}</td></tr>}
              {crossBorderCountries.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openEditCB(c)}>
                  <td style={{ ...S.sTd, fontFamily: 'monospace', fontWeight: 700 }}>{c.country_code}</td>
                  <td style={S.sTd}>{c.country_name}</td>
                  <td style={S.sTd}>{c.currency}</td>
                  <td style={S.sTd}><span style={{ color: c.vat_registered ? '#22c55e' : '#6b7280' }}>●</span></td>
                  <td style={S.sTd}><span style={{ color: c.reverse_charge ? '#22c55e' : '#6b7280' }}>●</span></td>
                  <td style={{ ...S.sTd, fontSize: 12, color: S.dimText }}>{c.notes?.slice(0, 50)}</td>
                  <td style={S.sTd}>
                    <button style={{ ...S.sBtn('#ef4444'), padding: '4px 10px', fontSize: 12 }}
                      onClick={e => { e.stopPropagation(); setConfirmDel({ type: 'cross-border', id: c.id }); }}>
                      {t.delete ?? 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── VAT RATE MODAL ── */}
      {vatModal && (
        <div style={S.sOverlay} onClick={() => setVatModal(false)}>
          <div style={{ ...S.sModal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', color: gold }}>{vatEditId ? (t.edit ?? 'Edit') : (t.newVatRate ?? 'New Rate')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={S.sLabel}>{t.countryCode ?? 'Code'} *</label>
                <input style={S.sInput} value={vatForm.country_code} maxLength={2} onChange={e => setVatForm({ ...vatForm, country_code: e.target.value.toUpperCase() })} /></div>
              <div><label style={S.sLabel}>{t.countryName ?? 'Country'}</label>
                <input style={S.sInput} value={vatForm.country_name} onChange={e => setVatForm({ ...vatForm, country_name: e.target.value })} /></div>
              <div><label style={S.sLabel}>{t.rateType ?? 'Type'}</label>
                <select style={S.sSelect} value={vatForm.rate_type} onChange={e => setVatForm({ ...vatForm, rate_type: e.target.value })}>
                  <option value="STANDARD">Standard</option><option value="REDUCED">Reduced</option>
                  <option value="SPECIAL">Special</option><option value="ZERO">Zero</option>
                </select></div>
              <div><label style={S.sLabel}>{t.ratePercent ?? 'Rate'}</label>
                <input style={S.sInput} type="number" step="0.01" value={vatForm.rate_percent} onChange={e => setVatForm({ ...vatForm, rate_percent: parseFloat(e.target.value) || 0 })} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={S.sLabel}>{t.description ?? 'Description'}</label>
                <input style={S.sInput} value={vatForm.description} onChange={e => setVatForm({ ...vatForm, description: e.target.value })} /></div>
              <div><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={vatForm.is_active} onChange={e => setVatForm({ ...vatForm, is_active: e.target.checked })} />
                {t.active ?? 'Active'}</label></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button style={S.sBtnOutline} onClick={() => setVatModal(false)}>{t.cancel ?? 'Cancel'}</button>
              <button style={S.sBtn(gold)} disabled={saving} onClick={saveVat}>{saving ? '…' : (t.save ?? 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CROSS-BORDER MODAL ── */}
      {cbModal && (
        <div style={S.sOverlay} onClick={() => setCbModal(false)}>
          <div style={{ ...S.sModal, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', color: gold }}>{cbEditId ? (t.edit ?? 'Edit') : (t.newCountry ?? 'New Country')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={S.sLabel}>{t.countryCode ?? 'Code'} *</label>
                <input style={S.sInput} value={cbForm.country_code} maxLength={2} onChange={e => setCbForm({ ...cbForm, country_code: e.target.value.toUpperCase() })} /></div>
              <div><label style={S.sLabel}>{t.countryName ?? 'Country'} *</label>
                <input style={S.sInput} value={cbForm.country_name} onChange={e => setCbForm({ ...cbForm, country_name: e.target.value })} /></div>
              <div><label style={S.sLabel}>{t.currency ?? 'Currency'}</label>
                <input style={S.sInput} value={cbForm.currency} maxLength={3} onChange={e => setCbForm({ ...cbForm, currency: e.target.value.toUpperCase() })} /></div>
              <div><label style={S.sLabel}>{t.vatNumber ?? 'VAT Number'}</label>
                <input style={S.sInput} value={cbForm.vat_number} onChange={e => setCbForm({ ...cbForm, vat_number: e.target.value })} /></div>
              <div><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={cbForm.vat_registered} onChange={e => setCbForm({ ...cbForm, vat_registered: e.target.checked })} />
                {t.vatRegistered ?? 'VAT Registered'}</label></div>
              <div><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={cbForm.reverse_charge} onChange={e => setCbForm({ ...cbForm, reverse_charge: e.target.checked })} />
                {t.reverseCharge ?? 'Reverse Charge'}</label></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={S.sLabel}>{t.notes ?? 'Notes'}</label>
                <textarea style={{ ...S.sInput, minHeight: 80, resize: 'vertical' } as any} value={cbForm.notes} onChange={e => setCbForm({ ...cbForm, notes: e.target.value })} /></div>
              <div><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={cbForm.is_active} onChange={e => setCbForm({ ...cbForm, is_active: e.target.checked })} />
                {t.active ?? 'Active'}</label></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button style={S.sBtnOutline} onClick={() => setCbModal(false)}>{t.cancel ?? 'Cancel'}</button>
              <button style={S.sBtn(gold)} disabled={saving} onClick={saveCB}>{saving ? '…' : (t.save ?? 'Save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
