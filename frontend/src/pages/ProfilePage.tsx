import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { getTranslations, type LangCode } from '../i18n';

const ROLE_LABELS: Record<string, Record<string, string>> = {
  de: { GLOBAL_MANAGER: 'Global Manager', LOCAL_MANAGER: 'Lokal Manager', ARBEITER: 'Arbeiter' },
  en: { GLOBAL_MANAGER: 'Global Manager', LOCAL_MANAGER: 'Local Manager', ARBEITER: 'Worker' },
  fr: { GLOBAL_MANAGER: 'Directeur général', LOCAL_MANAGER: 'Chef de chantier', ARBEITER: 'Ouvrier' },
  pt: { GLOBAL_MANAGER: 'Gerente Global', LOCAL_MANAGER: 'Gerente Local', ARBEITER: 'Trabalhador' },
};

const DATE_LOCALES: Record<string, string> = {
  de: 'de-CH',
  en: 'en-GB',
  fr: 'fr-CH',
  pt: 'pt-BR',
};

// ─── COMPONENT ───

export function ProfilePage() {
  const { isDark, th, lang } = useTheme();
  const L = getTranslations(lang as LangCode);
  const roleLabel = (r: string) => (ROLE_LABELS[lang] || ROLE_LABELS.de)[r] || r;
  const { user, token } = useAuthStore();
  const API = import.meta.env.VITE_API_URL || '';

  /* state */
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'ok' | 'err'>('ok');
  const [stats, setStats] = useState({ tasks: 0, absences: 0, reports: 0, hours: 0 });

  const hdrs = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  };

  /* fetch profile */
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await fetch(`${API}/api/v1/users`, { headers: hdrs() });
        const { data } = await res.json();
        const me = (data || []).find((u: any) => u.id === user.id);
        if (me) {
          setProfile(me);
          setForm({ first_name: me.first_name || '', last_name: me.last_name || '', phone: me.phone || '' });
        }
      } catch { /* ignore */ }
    })();
  }, [user?.id, API, hdrs]);

  /* fetch stats for this week */
  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    const day = now.getDay() || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - day + 1);
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const sd = fmt(mon), ed = fmt(sat);

    (async () => {
      try {
        const [allocRes, absRes, repRes] = await Promise.all([
          fetch(`${API}/api/v1/allocations?startDate=${sd}&endDate=${ed}&userId=${user.id}`, { headers: hdrs() }),
          fetch(`${API}/api/v1/absences?startDate=${sd}&endDate=${ed}&userId=${user.id}`, { headers: hdrs() }),
          fetch(`${API}/api/v1/reports?startDate=${sd}&endDate=${ed}&userId=${user.id}`, { headers: hdrs() }),
        ]);
        const alloc = await allocRes.json().then(r => r.data || []).catch(() => []);
        const abs = await absRes.json().then(r => r.data || []).catch(() => []);
        const rep = await repRes.json().then(r => r.data || []).catch(() => []);
        const hours = rep.reduce((s: number, r: any) => s + (r.actual_hours || 0), 0);
        setStats({ tasks: alloc.length, absences: abs.length, reports: rep.length, hours });
      } catch { /* ignore */ }
    })();
  }, [user?.id, API, hdrs]);

  /* save profile */
  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/users/${user.id}`, {
        method: 'PUT', headers: hdrs(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      showToast(L.saved, 'ok');
    } catch { showToast(L.error, 'err'); }
    setSaving(false);
  };

  /* change password */
  const changePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { showToast(L.passwordMismatch, 'err'); return; }
    if (pwForm.newPw.length < 6) { showToast(L.passwordTooShort, 'err'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/users/${user?.id}`, {
        method: 'PUT', headers: hdrs(),
        body: JSON.stringify({ password: pwForm.newPw }),
      });
      if (!res.ok) throw new Error();
      setPwForm({ current: '', newPw: '', confirm: '' });
      showToast(L.passwordChanged, 'ok');
    } catch { showToast(L.error, 'err'); }
    setSaving(false);
  };

  /* ─── styles ─── */
  const gold = th.gold;
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';

  const cardStyle: React.CSSProperties = {
    background: th.bgCard, borderRadius: 14, padding: 28,
    border: `1px solid ${th.border}`, boxShadow: '0 4px 20px rgba(0,0,0,.08)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg, color: th.text,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block',
  };

  const initials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';
  const dateLocale = DATE_LOCALES[lang] || DATE_LOCALES.de;

  return (
    <div style={{ background: th.bg, minHeight: '100vh', padding: '24px 32px', color: th.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: toastType === 'err' ? '#6B3A3A' : (isDark ? '#2a4a2a' : '#e8f5e9'),
          color: toastType === 'err' ? '#fff' : th.text,
          padding: '12px 24px', borderRadius: 10, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>{toast}</div>
      )}

      <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 700 }}>{L.title}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
        {/* left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* avatar card */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%', margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 700, boxShadow: '0 4px 20px rgba(200,169,110,.4)',
            }}>{initials}</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{profile?.first_name} {profile?.last_name}</h2>
            <p style={{ margin: '6px 0 0', color: th.textDim, fontSize: 13 }}>{profile?.email}</p>
            <div style={{ marginTop: 12 }}>
              <span style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: 'rgba(200,169,110,.15)', color: gold,
              }}>{roleLabel(profile?.role || '')}</span>
            </div>
            {profile?.departments?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {profile.departments.map((d: string) => (
                  <span key={d} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: d === 'garten' ? 'rgba(76,175,80,.15)' : 'rgba(255,152,0,.15)',
                    color: d === 'garten' ? '#4caf50' : '#ff9800',
                  }}>{d}</span>
                ))}
              </div>
            )}
            {profile?.created_at && (
              <p style={{ margin: '14px 0 0', fontSize: 12, color: th.textDim }}>
                {L.memberSince}: {new Date(profile.created_at).toLocaleDateString(dateLocale)}
              </p>
            )}
          </div>

          {/* stats card */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: gold }}>{L.stats} – {L.thisWeek}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: L.tasks, value: stats.tasks, icon: '📋' },
                { label: L.absences, value: stats.absences, icon: '🏖' },
                { label: L.reports, value: stats.reports, icon: '📝' },
                { label: L.hoursLogged, value: stats.hours.toFixed(1) + 'h', icon: '⏱' },
              ].map(s => (
                <div key={s.label} style={{
                  background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
                  borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: th.textDim, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* personal info */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>{L.personal}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>{L.firstName}</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{L.lastName}</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.email}</label>
              <input value={profile?.email || ''} disabled
                style={{ ...inputStyle, opacity: .5, cursor: 'not-allowed' }} />
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.phone}</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveProfile} disabled={saving}
                style={{
                  padding: '10px 28px', borderRadius: 8, border: 'none',
                  background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? .7 : 1, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
                }}>{saving ? '...' : L.save}</button>
            </div>
          </div>

          {/* password */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>{L.security}</h3>
            <div>
              <label style={labelStyle}>{L.currentPassword}</label>
              <input type="password" value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.newPassword}</label>
              <input type="password" value={pwForm.newPw}
                onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.confirmPassword}</label>
              <input type="password" value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={changePassword} disabled={saving || !pwForm.newPw}
                style={{
                  padding: '10px 28px', borderRadius: 8, border: 'none',
                  background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: (saving || !pwForm.newPw) ? 'not-allowed' : 'pointer',
                  opacity: (saving || !pwForm.newPw) ? .5 : 1, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
                }}>{L.changePassword}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
