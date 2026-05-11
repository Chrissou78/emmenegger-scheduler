// frontend/src/pages/settings/LanguagesTab.tsx
import React from 'react';
import { useTheme } from '../../contexts/themeContext';
import { ALL_LANG_CODES, LANG_META, getLangName, getLangFlag } from '../../i18n';
import type { SettingsData } from './useSettingsData';
import type { Styles } from './settingsStyles';

interface Props {
  data: SettingsData;
  S: Styles;
  t: Record<string, any>;
  gold: string;
}

export default function LanguagesTab({ data, S, t, gold }: Props) {
  const { lang, enabledLangs, defaultLang } = useTheme();
  const {
    saving, langDraft, setLangDraft, langDefault, setLangDefault,
    langEditing, setLangEditing, saveLanguageSettings, toggleLangEnabled,
  } = data;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, border: '1px solid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>{t.languageManagement ?? 'Language Management'}</h3>
          <p style={{ margin: '4px 0 0', color: S.dimText, fontSize: 13 }}>
            {t.languageManagementDesc ?? 'Enable/disable languages and set the default'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {langEditing ? (
            <>
              <button style={{ ...S.sBtn('#6b7280'), padding: '8px 16px' }}
                onClick={() => { setLangDraft([...enabledLangs]); setLangDefault(defaultLang); setLangEditing(false); }}>
                {t.cancel ?? 'Cancel'}
              </button>
              <button style={{ ...S.sBtn(gold), padding: '8px 16px' }}
                onClick={() => saveLanguageSettings(t)} disabled={saving}>
                {saving ? (t.loading ?? '...') : (t.save ?? 'Save')}
              </button>
            </>
          ) : (
            <button style={{ ...S.sBtn(gold), padding: '8px 16px' }} onClick={() => setLangEditing(true)}>
              {t.edit ?? 'Edit'}
            </button>
          )}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={S.sTh}>{t.language ?? 'Language'}</th>
          <th style={S.sTh}>{t.roleName ?? 'Name'}</th>
          <th style={{ ...S.sTh, textAlign: 'center' }}>{t.status ?? 'Status'}</th>
          <th style={{ ...S.sTh, textAlign: 'center' }}>{t.defaultLanguage ?? 'Default'}</th>
        </tr></thead>
        <tbody>
          {ALL_LANG_CODES.map(code => {
            const isEnabled = langDraft.includes(code);
            const isDefault = langDefault === code;
            const meta = LANG_META.find(m => m.code === code);
            return (
              <tr key={code} style={{ borderBottom: '1px solid' }}>
                <td style={S.sTd}>
                  <span style={{ fontSize: 20, marginRight: 8 }}>{meta?.flag ?? ''}</span>
                  <span style={{ fontWeight: 600 }}>{code.toUpperCase()}</span>
                </td>
                <td style={S.sTd}>{meta?.name ?? code}</td>
                <td style={{ ...S.sTd, textAlign: 'center' }}>
                  {langEditing ? (
                    <button onClick={() => toggleLangEnabled(code)} disabled={isDefault && isEnabled}
                      style={{
                        padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                        cursor: (isDefault && isEnabled) ? 'not-allowed' : 'pointer',
                        background: isEnabled ? '#22c55e22' : '#ef444422',
                        color: isEnabled ? '#22c55e' : '#ef4444',
                      }}>
                      {isEnabled ? (t.enabled ?? 'Enabled') : (t.disabled ?? 'Disabled')}
                    </button>
                  ) : (
                    <span style={{ color: isEnabled ? '#22c55e' : '#6b7280' }}>
                      {isEnabled ? '●' : '○'} {isEnabled ? (t.enabled ?? 'Enabled') : (t.disabled ?? 'Disabled')}
                    </span>
                  )}
                </td>
                <td style={{ ...S.sTd, textAlign: 'center' }}>
                  {langEditing ? (
                    <button onClick={() => { if (isEnabled) setLangDefault(code); }} disabled={!isEnabled}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: isDefault ? `2px solid ${gold}` : '1px solid',
                        cursor: isEnabled ? 'pointer' : 'not-allowed',
                        background: isDefault ? gold + '22' : 'transparent',
                        color: isDefault ? gold : S.dimText,
                      }}>
                      {isDefault ? '★ ' + (t.defaultLanguage ?? 'Default') : (t.setAsDefault ?? 'Set as default')}
                    </button>
                  ) : (
                    isDefault && <span style={{ color: gold, fontWeight: 600, fontSize: 13 }}>★ {t.defaultLanguage ?? 'Default'}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 24, padding: 16, borderRadius: 8, border: '1px solid' }}>
        <p style={{ margin: 0, fontSize: 13, color: S.dimText }}>
          {t.language ?? 'Language'}: <strong style={{ color: gold }}>{getLangName(lang)} {getLangFlag(lang)}</strong>
        </p>
      </div>
    </div>
  );
}
