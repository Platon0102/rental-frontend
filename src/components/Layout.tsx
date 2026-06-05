import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { contractsApi, paymentsApi } from '../api';
import { isDismissed } from '../utils/notifications';

const now = new Date();
const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const currentMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

function useNotifCount() {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const today = new Date();
    Promise.all([
      contractsApi.list({ expiring_days: 90 }).catch(() => []),
      paymentsApi.list().catch(() => []),
    ]).then(([expiring, payments]) => {
      let n = 0;

      // Просроченные платежи
      payments.forEach((p: any) => {
        if (p.status === 'paid') return;
        const id = `debt-${p.id}`;
        if (isDismissed(id)) return;
        if (p.status === 'debt') { n++; return; }
        if (p.period_year && p.period_month) {
          if (p.period_year < today.getFullYear()) { n++; return; }
          if (p.period_year === today.getFullYear() && p.period_month < today.getMonth() + 1) { n++; return; }
        }
      });

      // Истекающие договоры
      expiring.forEach((c: any) => {
        const id = `exp-${c.id}`;
        if (isDismissed(id)) return;
        const daysLeft = Math.round((new Date(c.end_date).getTime() - today.getTime()) / 86400000);
        if (daysLeft >= 0) n++;
      });

      setCount(n);
    });
  }, [location.pathname]); // обновляем при переходе между страницами

  return count;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const notifCount = useNotifCount();

  const titles: Record<string, string> = {
    '/': 'Дашборд',
    '/floors': 'Планировка этажей',
    '/contracts': 'Договоры аренды',
    '/tenants': 'Арендаторы',
    '/finance': 'Финансы и платежи',
    '/reports': 'Отчёты',
    '/notifications': 'Уведомления',
    '/settings': 'Настройки',
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="name">БЦ «Золотой»</div>
          <div className="sub">Система учёта аренды · MVP</div>
        </div>

        <div className="nav-section">Главное</div>
        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-layout-dashboard" />Дашборд
        </NavLink>
        <NavLink to="/floors" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-building" />Планировка
        </NavLink>

        <div className="nav-section">Управление</div>
        <NavLink to="/contracts" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-file-text" />Договоры
        </NavLink>
        <NavLink to="/tenants" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-users" />Арендаторы
        </NavLink>

        <div className="nav-section">Финансы</div>
        <NavLink to="/finance" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-credit-card" />Платежи
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-chart-bar" />Отчёты
        </NavLink>

        <div className="nav-section">Система</div>
        <NavLink to="/notifications" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-bell" />Уведомления
          {notifCount > 0 && <span className="nav-badge">{notifCount}</span>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <i className="ti ti-settings" />Настройки
        </NavLink>

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">АД</div>
            <div>
              <div className="user-name">Администратор</div>
              <div className="user-role">Управляющий</div>
            </div>
          </div>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{titles[location.pathname] || 'БЦ «Золотой»'}</span>
          </div>
          <div className="topbar-right">
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>{currentMonth}</span>
            <button className="btn-icon notif-btn" onClick={() => navigate('/notifications')}>
              <i className="ti ti-bell" />
              {notifCount > 0 && <span className="notif-dot" />}
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
