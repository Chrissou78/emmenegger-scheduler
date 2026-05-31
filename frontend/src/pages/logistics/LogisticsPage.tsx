// frontend/src/pages/logistics/LogisticsPage.tsx
import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/themeContext';
import { useAuthStore } from '../../contexts/authStore';
import { resolvePermissions, type Role, type Permission } from '../../../../shared/constants/roles';
import { useRolesStore } from '../../store/rolesStore';
import { useLogisticsData } from './hooks/useLogisticsData';
import { getLogStyles } from './styles';
import { Dashboard } from './sections/Dashboard';
import { MaintenanceParts } from './sections/MaintenanceParts';
import { Consumables } from './sections/Consumables';
import { Alerts } from './sections/Alerts';
import { Transactions } from './sections/Transactions';
import { Inventory } from './sections/Inventory';
import { PricingRules } from './sections/PricingRules';
import { TransactionModal } from './components/TransactionModal';
import type { Section } from './types';

function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

/**
 * ★ Map each tab to the permission(s) required.
 *   A user sees a tab only if they have ALL listed permissions.
 *   'dashboard' requires only 'logistics.view'.
 */
const TAB_DEFS: { key: Section; labelKey: string; icon: string; requires: Permission[] }[] = [
  { key: 'dashboard',    labelKey: 'logDashboard',        icon: '📊', requires: ['logistics.view'] },
  { key: 'maintenance',  labelKey: 'logMaintenanceParts',  icon: '🔧', requires: ['logistics.view'] },
  { key: 'consumables',  labelKey: 'logConsumables',       icon: '🛒', requires: ['logistics.view'] },
  { key: 'alerts',       labelKey: 'logAlerts',            icon: '🔔', requires: ['logistics.alerts'] },
  { key: 'transactions', labelKey: 'logTransactions',      icon: '📋', requires: ['logistics.view'] },
  { key: 'inventory',    labelKey: 'logInventoryCount',    icon: '📦', requires: ['logistics.inventory'] },
  { key: 'pricing',      labelKey: 'logPricingRules',      icon: '💲', requires: ['logistics.pricing'] },
];

export function LogisticsPage() {
  const { isDark, t } = useTheme();
  const { user, token } = useAuthStore();
  const { permissionMap } = useRolesStore();
  const data = useLogisticsData(token);
  const s = getLogStyles(isDark);

  // Permissions
  const role = normalizeRole(user?.role || '');
  const perms = resolvePermissions(role, user?.custom_permissions, permissionMap);
  const canView = perms.has('logistics.view' as Permission);

  // ★ Filter visible tabs based on permissions
  const visibleTabs = useMemo(() =>
    TAB_DEFS.filter(tab =>
      tab.requires.every(p => perms.has(p))
    ),
    [perms]
  );

  if (!canView) return null;

  // Toast
  const toastEl = data.toast && (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      padding: '12px 20px', borderRadius: 10,
      background: data.toast.type === 'ok' ? '#22c55e' : '#ef4444',
      color: '#fff', fontWeight: 600, fontSize: 14,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      {data.toast.msg}
    </div>
  );

  if (data.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', background: s.bg }}>
        <div className="spinner" />
      </div>
    );
  }

  // ★ Expose permission checks to section components
  const permChecks = {
    canEdit:      perms.has('logistics.edit' as Permission),
    canDelete:    perms.has('logistics.delete' as Permission),
    canConsume:   perms.has('logistics.consume' as Permission),
    canSell:      perms.has('logistics.sell' as Permission),
    canPricing:   perms.has('logistics.pricing' as Permission),
    canAlerts:    perms.has('logistics.alerts' as Permission),
    canImport:    perms.has('logistics.import' as Permission),
    canInventory: perms.has('logistics.inventory' as Permission),
  };

  return (
    <div style={{ padding: 24, background: s.bg, minHeight: '100vh', color: s.text }}>
      {toastEl}

      {/* Header */}
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{t.logTitle || 'Logistics'}</h1>
      <p style={{ color: s.muted, marginBottom: 20 }}>{t.logMaintenanceDesc || 'Spare parts & consumables management'}</p>

      {/* Tab bar — ★ only visible tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {visibleTabs.map(tab => (
          <button key={tab.key} style={s.tabBtn(data.section === tab.key)}
                  onClick={() => data.setSection(tab.key)}>
            <span>{tab.icon}</span>
            <span>{t[tab.labelKey] || tab.labelKey}</span>
          </button>
        ))}
      </div>

      {/* Section content — pass permChecks down */}
      {data.section === 'dashboard'    && <Dashboard data={data} t={t} isDark={isDark} perms={permChecks} />}
      {data.section === 'maintenance'  && <MaintenanceParts data={data} t={t} isDark={isDark} perms={permChecks} />}
      {data.section === 'consumables'  && <Consumables data={data} t={t} isDark={isDark} perms={permChecks} />}
      {data.section === 'alerts'       && <Alerts data={data} t={t} isDark={isDark} perms={permChecks} />}
      {data.section === 'transactions' && <Transactions data={data} t={t} isDark={isDark} perms={permChecks} />}
      {data.section === 'inventory'    && <Inventory data={data} t={t} isDark={isDark} perms={permChecks} />}
      {data.section === 'pricing'      && <PricingRules data={data} t={t} isDark={isDark} perms={permChecks} />}

      {/* Transaction modal */}
      {data.txModalOpen && (
        <TransactionModal
          t={t} isDark={isDark}
          parts={data.parts} machines={data.machines} tasks={data.tasks}
          defaultType={data.txModalType}
          defaultPartId={data.selectedPart?.id}
          canSell={permChecks.canSell}
          onSubmit={async (body) => {
            await data.submitTransaction(body);
            data.showToast(t.logSaved || 'Done', 'ok');
          }}
          onClose={() => data.setTxModalOpen(false)}
        />
      )}
    </div>
  );
}
