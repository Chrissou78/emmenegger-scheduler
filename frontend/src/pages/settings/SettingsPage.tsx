// frontend/src/pages/settings/SettingsPage.tsx
import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/themeContext';
import { useAuthStore } from '../../contexts/authStore';
import { useRolesStore } from '../../store/rolesStore';
import { getTranslations, type LangCode } from '../../i18n';
import {
  getNavAccess, resolvePermissions,
  type Role, type Permission,
} from '../../../../shared/constants/roles';
import { useSettingsData } from './useSettingsData';
import { makeStyles } from './settingsStyles';
import type { MainTab } from './types';

import RolesTab from './RolesTab';
import ConfigTab from './ConfigTab';
import CompanyTab from './CompanyTab';
import VatTab from './VatTab';
import HierarchyTab from './HierarchyTab';
import LanguagesTab from './LanguagesTab';

export default function SettingsPage() {
  const { th, isDark, lang } = useTheme();
  const { user } = useAuthStore();
  const t = getTranslations(lang as LangCode);
  const gold = th.gold;
  const data = useSettingsData();
  const S = makeStyles(th, isDark, gold);

  const { permissionMap } = useRolesStore();
  const perms = useMemo(() => {
    const role: Role = user?.role || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const navAccess = useMemo(
    () => getNavAccess(user?.role || 'EMPLOYEE', user?.departments || []),
    [user]
  );

  const [mainTab, setMainTab] = useState<MainTab>('roles');

  /* ── Access guard ── */
  if (!navAccess.admin && !navAccess.settings) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: th.text }}>
        <h2>{t.accessDenied ?? 'Access Denied'}</h2>
        <p style={{ color: S.dimText }}>{t.noAccessPage ?? "You don't have access to this page"}</p>
      </div>
    );
  }

  const sTab = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: '10px 10px 0 0', cursor: 'pointer',
    fontWeight: 600, fontSize: 14, border: 'none',
    background: active ? gold : 'transparent',
    color: active ? '#fff' : th.text,
  });

  const tabs: { key: MainTab; label: string }[] = [
    { key: 'roles',     label: t.roles ?? 'Roles' },
    { key: 'config',    label: t.configLists ?? 'Config' },
    { key: 'company',   label: t.company ?? 'Company' },
    { key: 'vat',       label: t.vatCrossBorder ?? 'VAT & Cross-Border' },
    { key: 'hierarchy', label: t.hierarchy ?? 'Hierarchy' },
    { key: 'languages', label: t.languages ?? 'Languages' },
  ];

  return (
    <div style={{ padding: 24, color: th.text, minHeight: '100vh' }}>
      {/* Toast */}
      {data.toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          padding: '12px 24px', borderRadius: 8, color: '#fff',
          background: data.toast.ok ? '#22c55e' : '#ef4444', fontWeight: 600,
        }}>
          {data.toast.msg}
        </div>
      )}

      <h1 style={{ margin: '0 0 20px', color: gold }}>{t.settings ?? 'Settings'}</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.key} style={sTab(mainTab === tab.key)} onClick={() => setMainTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: `2px solid ${gold}`, paddingTop: 20 }}>
        {mainTab === 'roles'     && <RolesTab data={data} S={S} t={t} gold={gold} lang={lang} />}
        {mainTab === 'config'    && <ConfigTab data={data} S={S} t={t} gold={gold} />}
        {mainTab === 'company'   && <CompanyTab data={data} S={S} t={t} gold={gold} />}
        {mainTab === 'vat'       && <VatTab data={data} S={S} t={t} gold={gold} />}
        {mainTab === 'hierarchy' && <HierarchyTab data={data} S={S} t={t} gold={gold} />}
        {mainTab === 'languages' && <LanguagesTab data={data} S={S} t={t} gold={gold} />}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {data.confirmDel && (
        <div style={S.sOverlay} onClick={() => data.setConfirmDel(null)}>
          <div style={{ ...S.sModal, maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#ef4444', marginBottom: 16 }}>{t.confirmDelete ?? 'Delete this item?'}</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button style={S.sBtnOutline} onClick={() => data.setConfirmDel(null)}>{t.no ?? 'No'}</button>
              <button style={S.sBtn('#ef4444')} onClick={() => data.deleteItem(t)}>{t.yes ?? 'Yes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
