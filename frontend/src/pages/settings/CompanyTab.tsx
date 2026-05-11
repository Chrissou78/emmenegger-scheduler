// frontend/src/pages/settings/CompanyTab.tsx
import React, { useState } from 'react';
import type { SettingsData } from './useSettingsData';
import type { Styles } from './settingsStyles';
import { SWISS_CANTONS, LEGAL_FORMS } from './types';

interface Props {
  data: SettingsData;
  S: Styles;
  t: Record<string, any>;
  gold: string;
}

export default function CompanyTab({ data, S, t, gold }: Props) {
  const { companyInfo, companyForm, setCompanyForm, saving, hdrs, showToast } = data;
  const [editing, setEditing] = useState(false);

  const API = import.meta.env.VITE_API_URL ?? '';

  const save = async () => {
    data.setSaving(true);
    try {
      const r = await fetch(`${API}/api/v1/settings/company`, {
        method: 'PUT', headers: hdrs(), body: JSON.stringify(companyForm),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const saved = j.data ?? j;
      data.setCompanyInfo(saved);
      data.setCompanyForm(saved);
      setEditing(false);
      showToast(t.saved ?? 'Saved');
    } catch (e) {
      showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false);
    } finally { data.setSaving(false); }
  };

  const field = (label: string, key: keyof typeof companyForm, opts?: { placeholder?: string; mono?: boolean; type?: string; step?: string }) => (
    <div>
      <label style={S.sLabel}>{label}</label>
      {editing ? (
        opts?.type === 'number' ? (
          <input style={S.sInput} type="number" step={opts.step ?? '0.1'}
            value={companyForm[key] as number}
            onChange={e => setCompanyForm({ ...companyForm, [key]: parseFloat(e.target.value) || 0 })} />
        ) : (
          <input style={S.sInput} value={companyForm[key] as string} placeholder={opts?.placeholder}
            onChange={e => setCompanyForm({ ...companyForm, [key]: e.target.value })} />
        )
      ) : (
        <div style={{ fontSize: 14, padding: '8px 0', ...(opts?.mono ? { fontFamily: 'monospace' } : {}) }}>
          {(companyInfo[key] as string | number) || '—'}{opts?.type === 'number' ? '%' : ''}
        </div>
      )}
    </div>
  );

  return (
    <div style={S.sCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: gold }}>{t.company ?? 'Company'}</h2>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.sBtn(gold)} disabled={saving} onClick={save}>{saving ? '…' : (t.save ?? 'Save')}</button>
            <button style={S.sBtnOutline} onClick={() => { setEditing(false); setCompanyForm(companyInfo); }}>{t.cancel ?? 'Cancel'}</button>
          </div>
        ) : (
          <button style={S.sBtn(gold)} onClick={() => setEditing(true)}>{t.edit ?? 'Edit'}</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {field(t.companyName ?? 'Company Name', 'company_name')}
        <div>
          <label style={S.sLabel}>{t.legalForm ?? 'Legal Form'}</label>
          {editing ? (
            <select style={S.sSelect} value={companyForm.legal_form}
              onChange={e => setCompanyForm({ ...companyForm, legal_form: e.target.value })}>
              {LEGAL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 14, padding: '8px 0' }}>{companyInfo.legal_form || '—'}</div>
          )}
        </div>
        {field(t.uidNumber ?? 'UID Number', 'uid_number', { placeholder: 'CHE-xxx.xxx.xxx', mono: true })}
        {field(t.vatNumber ?? 'VAT Number', 'vat_number', { placeholder: 'CHE-xxx.xxx.xxx MWST', mono: true })}
        {field(t.commercialRegister ?? 'Commercial Register', 'commercial_register')}

        <div style={{ gridColumn: '1 / -1' }}><hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0 16px' }} /></div>
        {field(t.street ?? 'Street', 'street')}
        <div>
          <label style={S.sLabel}>{t.postalCode ?? 'PLZ'} / {t.city ?? 'City'}</label>
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...S.sInput, maxWidth: 100 }} value={companyForm.postal_code}
                onChange={e => setCompanyForm({ ...companyForm, postal_code: e.target.value })} />
              <input style={S.sInput} value={companyForm.city}
                onChange={e => setCompanyForm({ ...companyForm, city: e.target.value })} />
            </div>
          ) : (
            <div style={{ fontSize: 14, padding: '8px 0' }}>{companyInfo.postal_code} {companyInfo.city}</div>
          )}
        </div>
        <div>
          <label style={S.sLabel}>{t.canton ?? 'Canton'}</label>
          {editing ? (
            <select style={S.sSelect} value={companyForm.canton}
              onChange={e => setCompanyForm({ ...companyForm, canton: e.target.value })}>
              <option value="">—</option>
              {SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 14, padding: '8px 0' }}>{companyInfo.canton || '—'}</div>
          )}
        </div>
        {field(t.country ?? 'Country', 'country')}

        <div style={{ gridColumn: '1 / -1' }}><hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0 16px' }} /></div>
        {field(t.phone ?? 'Phone', 'phone')}
        {field(t.email ?? 'Email', 'email')}
        {field(t.website ?? 'Website', 'website')}
        {field(t.logoUrl ?? 'Logo URL', 'logo_url')}

        <div style={{ gridColumn: '1 / -1' }}><hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0 16px' }} /></div>
        {field(t.bankName ?? 'Bank', 'bank_name')}
        {field(t.bankIban ?? 'IBAN', 'bank_iban', { placeholder: 'CH00 0000 0000 0000 0000 0', mono: true })}
        {field(t.bankBic ?? 'BIC', 'bank_bic', { mono: true })}

        <div style={{ gridColumn: '1 / -1' }}><hr style={{ border: 'none', borderTop: '1px solid #333', margin: '8px 0 16px' }} /></div>
        <div>
          <label style={S.sLabel}>{t.vatMethod ?? 'VAT Method'}</label>
          {editing ? (
            <select style={S.sSelect} value={companyForm.vat_method}
              onChange={e => setCompanyForm({ ...companyForm, vat_method: e.target.value })}>
              <option value="EFFECTIVE">{t.effective ?? 'Effective'}</option>
              <option value="NET_RATE">{t.netRate ?? 'Net Rate'}</option>
              <option value="FLAT_RATE">{t.flatRate ?? 'Flat Rate'}</option>
            </select>
          ) : (
            <div style={{ fontSize: 14, padding: '8px 0' }}>
              {companyInfo.vat_method === 'EFFECTIVE' ? (t.effective ?? 'Effective') : companyInfo.vat_method === 'NET_RATE' ? (t.netRate ?? 'Net Rate') : (t.flatRate ?? 'Flat Rate')}
            </div>
          )}
        </div>
        <div>
          <label style={S.sLabel}>{t.vatPeriod ?? 'VAT Period'}</label>
          {editing ? (
            <select style={S.sSelect} value={companyForm.vat_period}
              onChange={e => setCompanyForm({ ...companyForm, vat_period: e.target.value })}>
              <option value="QUARTERLY">{t.quarterly ?? 'Quarterly'}</option>
              <option value="SEMI_ANNUAL">{t.semiAnnual ?? 'Semi-Annual'}</option>
              <option value="ANNUAL">{t.annual ?? 'Annual'}</option>
            </select>
          ) : (
            <div style={{ fontSize: 14, padding: '8px 0' }}>
              {companyInfo.vat_period === 'QUARTERLY' ? (t.quarterly ?? 'Quarterly') : companyInfo.vat_period === 'SEMI_ANNUAL' ? (t.semiAnnual ?? 'Semi-Annual') : (t.annual ?? 'Annual')}
            </div>
          )}
        </div>
        {field((t.vatStandard ?? 'Standard') + ' (%)', 'vat_standard_rate', { type: 'number', step: '0.1' })}
        {field((t.vatReduced ?? 'Reduced') + ' (%)', 'vat_reduced_rate', { type: 'number', step: '0.1' })}
        {field((t.vatSpecial ?? 'Special') + ' (%)', 'vat_special_rate', { type: 'number', step: '0.1' })}
        {field(t.fiscalYearStart ?? 'Fiscal Year Start', 'fiscal_year_start', { placeholder: '01-01' })}
      </div>
    </div>
  );
}
