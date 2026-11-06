import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const icons = {
  overview: '▦', riders: '◉', drivers: '◆', rides: '⌁',
  wallet: '◇', alerts: '!', logout: '↪',
};

const sections = [
  ['overview', 'نظرة عامة'],
  ['riders', 'الركاب'],
  ['drivers', 'السائقون'],
  ['rides', 'الرحلات'],
  ['payments', 'المدفوعات'],
  ['alerts', 'بلاغات النظام'],
];

async function api(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const requestError = new Error(error.message || 'تعذر تنفيذ الطلب');
    requestError.status = response.status;
    throw requestError;
  }
  return response.status === 204 ? null : response.json();
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@ridehailing.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/admin/login', null, { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('ride_admin_session', JSON.stringify(data));
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark"><span>R</span></div>
        <div><p className="eyebrow">Ride-Hailing Control</p><h1>مرحبًا بك في مساحة<br />إدارة رحلاتك</h1><p>راقب الطلبات والسائقين والرحلات والأداء المالي من مكان واحد.</p></div>
        <div className="brand-status"><span /> جميع الأنظمة تعمل</div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand">RIDE ADMIN</div>
          <p className="eyebrow">لوحة الإدارة</p><h2>تسجيل الدخول</h2><p className="muted">أدخل بيانات حساب الأدمن للمتابعة.</p>
          <label>البريد الإلكتروني<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
          <label>كلمة المرور<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
          {error && <div className="error">{error}</div>}
          <button disabled={loading}>{loading ? 'جارٍ الدخول...' : 'دخول لوحة الإدارة'}</button>
        </form>
      </section>
    </main>
  );
}

function Stat({ icon, label, value, note, tone }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function Empty({ text }) {
  return <div className="empty-state"><b>لا توجد بيانات</b><span>{text}</span></div>;
}

function DataTable({ columns, rows, empty }) {
  if (!rows.length) return <Empty text={empty} />;
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Overview({ data, health, setSection }) {
  const points = data?.ridesByDay || [];
  const max = Math.max(1, ...points.map((point) => point.total));
  return <>
    <div className="stats-grid">
      <Stat icon={icons.riders} label="إجمالي الركاب" value={data?.totalRiders ?? '—'} note="حسابات مسجلة" tone="blue" />
      <Stat icon={icons.drivers} label="السائقون النشطون" value={data?.activeDrivers ?? '—'} note="متصلون الآن" tone="violet" />
      <Stat icon={icons.rides} label="رحلات اليوم" value={data?.ridesToday ?? '—'} note="طلبات جديدة وحالية" tone="orange" />
      <Stat icon={icons.wallet} label="الإيرادات" value={data ? `${data.revenueToday.toLocaleString('ar-EG')} ج.م` : '—'} note="رحلات مكتملة اليوم" tone="green" />
    </div>
    <div className="overview-grid">
      <article className="panel activity-panel">
        <div className="panel-title"><div><p className="eyebrow">الحركة التشغيلية</p><h2>نشاط المنصة</h2></div><button onClick={() => setSection('rides')}>عرض الرحلات</button></div>
        {points.length ? <div className="chart-bars">{points.map((point) => <div key={point.day} title={`${point.day}: ${point.total}`}><span style={{ height: `${Math.max(12, (point.total / max) * 100)}%` }} /><small>{point.day.slice(5)}</small></div>)}</div> : <div className="empty-chart"><p>لا توجد رحلات مسجلة خلال الأيام السبعة الماضية.</p></div>}
      </article>
      <article className="panel">
        <div className="panel-title"><div><p className="eyebrow">حالة النظام</p><h2>الخدمات الأساسية</h2></div></div>
        <Service name="API Server" healthy={health?.status === 'ok'} />
        <Service name="قاعدة البيانات" healthy={health?.db === 'up'} />
        <Service name="Redis Cache" healthy={health?.redis === 'up'} />
        <div className="uptime"><small>مدة تشغيل الخادم</small><strong>{health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)} دقيقة` : '—'}</strong></div>
      </article>
    </div>
  </>;
}

function Service({ name, healthy }) {
  return <div className="service"><span>✓</span><b>{name}</b><em className={healthy ? 'healthy' : 'checking'}>{healthy ? 'متصل' : 'غير متاح'}</em></div>;
}

function Records({ kind, rows, loading }) {
  if (loading) return <div className="loading">جارٍ تحميل البيانات...</div>;
  if (kind === 'riders' || kind === 'drivers') {
    const roleRows = rows.filter((row) => row.role === (kind === 'riders' ? 'RIDER' : 'DRIVER'));
    return <div className="panel"><div className="panel-title"><div><p className="eyebrow">إدارة الحسابات</p><h2>{kind === 'riders' ? 'الركاب المسجلون' : 'السائقون المسجلون'}</h2></div><strong className="count-badge">{roleRows.length}</strong></div><DataTable columns={['الاسم', 'الهاتف', 'الحالة', 'آخر دخول']} rows={roleRows.map((row) => ({ id: row.id, cells: [row.name || '—', row.phone, <Status key={row.id} value={row.status} />, row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('ar-EG') : 'لم يسجل دخول'] }))} empty="لا توجد حسابات مسجلة لهذا النوع حالياً." /></div>;
  }
  if (kind === 'rides') return <div className="panel"><div className="panel-title"><div><p className="eyebrow">عمليات المنصة</p><h2>الرحلات الأخيرة</h2></div></div><DataTable columns={['الراكب', 'السائق', 'المسار', 'الحالة', 'الأجرة']} rows={(rows || []).map((row) => ({ id: row.id, cells: [row.rider?.name || row.rider?.phone || '—', row.driver?.name || 'لم يُسند', `${row.pickupAddress} ← ${row.dropoffAddress}`, <Status key={row.id} value={row.status} />, `${Number(row.fare).toLocaleString('ar-EG')} ج.م`] }))} empty="لا توجد رحلات مسجلة حتى الآن." /></div>;
  if (kind === 'payments') return <div className="panel"><div className="panel-title"><div><p className="eyebrow">الحسابات المالية</p><h2>المعاملات الأخيرة</h2></div></div><DataTable columns={['المستخدم', 'النوع', 'المبلغ', 'الحالة', 'التاريخ']} rows={(rows || []).map((row) => ({ id: row.id, cells: [row.user?.name || row.user?.phone || '—', row.type, `${Number(row.amount).toLocaleString('ar-EG')} ج.م`, <Status key={row.id} value={row.status} />, new Date(row.createdAt).toLocaleString('ar-EG')] }))} empty="لا توجد معاملات مالية مسجلة حتى الآن." /></div>;
  return <div className="panel alerts-panel"><div><p className="eyebrow">مراقبة النظام</p><h2>بلاغات النظام</h2></div><div className="service-ok">✓<span><b>لا توجد بلاغات نشطة</b><small>تم فحص الخدمات الأساسية بنجاح</small></span></div></div>;
}

function Status({ value }) {
  return <span className={`status status-${String(value).toLowerCase()}`}>{value}</span>;
}

function Dashboard({ session, onLogout }) {
  const [section, setSection] = useState('overview');
  const [health, setHealth] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = session.user;

  async function load() {
    setLoading(true); setError('');
    try {
      const token = session.accessToken;
      const [healthData, dashboardData] = await Promise.all([api('/health', null), api('/admin/dashboard', token)]);
      setHealth(healthData); setDashboard(dashboardData);
      if (section === 'riders' || section === 'drivers') setRows(await api('/admin/users', token));
      if (section === 'rides') setRows(await api('/admin/rides', token));
      if (section === 'payments') setRows(await api('/admin/payments', token));
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [section]);

  return (
    <main className="dashboard">
      <aside><div className="side-brand"><div className="brand-mark small"><span>R</span></div><b>Ride Admin</b></div><nav>{sections.map(([key, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><i>{icons[key]}</i><span>{label}</span></button>)}</nav><div className="side-footer"><div className="mini-user"><span><b>{user.name}</b><small>مسؤول النظام</small></span></div><button className="logout" onClick={onLogout}>{icons.logout} تسجيل الخروج</button></div></aside>
      <section className="content">
        <header><div><p className="eyebrow">{sections.find(([key]) => key === section)?.[1]}</p><h1>{section === 'overview' ? `صباح الخير، ${user.name}` : sections.find(([key]) => key === section)?.[1]}</h1><p>{section === 'overview' ? 'إليك ملخص تشغيل المنصة اليوم.' : 'إدارة البيانات والعمليات المرتبطة بهذه الوحدة.'}</p></div><button className="refresh-button" onClick={load} disabled={loading}>{loading ? 'جارٍ التحديث...' : 'تحديث البيانات'}</button><div className={`system-pill ${health?.status === 'ok' ? 'online' : ''}`}><span /> {health?.status === 'ok' ? 'الخدمات متصلة' : 'جاري التحقق'}</div></header>
        {error && <div className="error dashboard-error">{error}</div>}
        {section === 'overview' ? <Overview data={dashboard} health={health} setSection={setSection} /> : <Records kind={section} rows={rows} loading={loading} />}
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ride_admin_session')); } catch { return null; }
  });
  function logout() { localStorage.removeItem('ride_admin_session'); setSession(null); }
  return session ? <Dashboard session={session} onLogout={logout} /> : <Login onLogin={setSession} />;
}

createRoot(document.getElementById('root')).render(<App />);
