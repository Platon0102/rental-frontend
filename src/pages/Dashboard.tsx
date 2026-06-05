import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api';
import type { DashboardStats, Contract } from '../api';

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<{ month: number; paid: number; due: number }[]>([]);
  const [floors, setFloors] = useState<{ floor: number; total: number; occupied: number; pct: number }[]>([]);
  const [expiring, setExpiring] = useState<Contract[]>([]);

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(() => {});
    dashboardApi.revenueByMonth().then(setRevenue).catch(() => {});
    dashboardApi.occupancyByFloor().then(setFloors).catch(() => {});
    dashboardApi.expiringContracts(30).then(setExpiring).catch(() => {});
  }, []);

  const total = stats?.rooms.total ?? 0;
  const occupied = stats?.rooms.occupied ?? 0;
  const free = stats?.rooms.free ?? 0;
  const reserved = stats?.rooms.reserved ?? 0;
  const repair = stats?.rooms.repair ?? 0;
  const pct = stats?.rooms.occupancy_pct ?? 0;
  const debt = stats?.finance.debt_total ?? 0;
  const expiringCount = stats?.contracts.expiring_30_days ?? 0;

  const maxRevenue = Math.max(...revenue.map(r => r.due), 1);

  const occ_pct = total ? Math.round(occupied / total * 100) : 0;
  const free_pct = total ? Math.round(free / total * 100) : 0;
  const res_pct = total ? Math.round(reserved / total * 100) : 0;
  const rep_pct = total ? Math.round(repair / total * 100) : 0;

  const occ_dash = (occ_pct / 100 * 100).toFixed(1);
  const free_offset = -(occ_pct / 100 * 100);
  const free_dash = (free_pct / 100 * 100).toFixed(1);
  const res_offset = -(occ_pct / 100 * 100) - (free_pct / 100 * 100);
  const res_dash = (res_pct / 100 * 100).toFixed(1);
  const rep_offset = -(occ_pct / 100 * 100) - (free_pct / 100 * 100) - (res_pct / 100 * 100);
  const rep_dash = (rep_pct / 100 * 100).toFixed(1);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Заполняемость</div>
          <div className="stat-value">{pct}%</div>
          <div className="stat-sub">{occupied} из {total} помещений</div>
          <span className="stat-badge badge-info">активных договоров</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">Свободно</div>
          <div className="stat-value" style={{ color: '#16A34A' }}>{free}</div>
          <div className="stat-sub">помещений доступно</div>
          <span className="stat-badge badge-up">для аренды</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">Задолженность</div>
          <div className="stat-value" style={{ fontSize: 22, color: '#DC2626' }}>{debt > 0 ? `${(debt / 1000).toFixed(0)} тыс` : '0'}</div>
          <div className="stat-sub">по всем договорам</div>
          {debt > 0 && <span className="stat-badge badge-down">требует внимания</span>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Истекают (30 дней)</div>
          <div className="stat-value">{expiringCount}</div>
          <div className="stat-sub">договоров</div>
          {expiringCount > 0 && <span className="stat-badge badge-warn">требуют внимания</span>}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Заполняемость по этажам</span>
            <span className="card-link" onClick={() => navigate('/floors')}>
              Планировка <i className="ti ti-arrow-right" />
            </span>
          </div>
          {floors.length === 0 ? (
            <div className="empty-state">Нет данных по этажам</div>
          ) : (
            floors.map(f => (
              <div key={f.floor} className="bar-row">
                <span className="bar-label">Этаж {f.floor}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${f.pct}%`, background: '#3B82F6' }} />
                </div>
                <span className="bar-val">{f.pct}%</span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Статус помещений</span></div>
          <div className="donut-wrap">
            <svg width="110" height="110" viewBox="0 0 42 42" style={{ flexShrink: 0 }}>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#EEF2FF" strokeWidth="4"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#3B82F6" strokeWidth="4"
                strokeDasharray={`${occ_dash} ${(100-Number(occ_dash)).toFixed(1)}`} strokeDashoffset="25" strokeLinecap="round"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#22C55E" strokeWidth="4"
                strokeDasharray={`${free_dash} ${(100-Number(free_dash)).toFixed(1)}`} strokeDashoffset={free_offset - 25} strokeLinecap="round"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#F59E0B" strokeWidth="4"
                strokeDasharray={`${res_dash} ${(100-Number(res_dash)).toFixed(1)}`} strokeDashoffset={res_offset - 25} strokeLinecap="round"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#EF4444" strokeWidth="4"
                strokeDasharray={`${rep_dash} ${(100-Number(rep_dash)).toFixed(1)}`} strokeDashoffset={rep_offset - 25} strokeLinecap="round"/>
              <text x="21" y="19.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#0F172A" fontFamily="Inter,sans-serif">{pct}%</text>
              <text x="21" y="25" textAnchor="middle" fontSize="4.5" fill="#64748B" fontFamily="Inter,sans-serif">занято</text>
            </svg>
            <div className="donut-legend">
              <div className="donut-row"><div className="donut-dot" style={{ background: '#DBEAFE', border: '2px solid #3B82F6' }} />Занято — {occupied} пом.</div>
              <div className="donut-row"><div className="donut-dot" style={{ background: '#DCFCE7', border: '2px solid #22C55E' }} />Свободно — {free} пом.</div>
              <div className="donut-row"><div className="donut-dot" style={{ background: '#FEF3C7', border: '2px solid #F59E0B' }} />Резерв — {reserved} пом.</div>
              <div className="donut-row"><div className="donut-dot" style={{ background: '#FEE2E2', border: '2px solid #EF4444' }} />Ремонт — {repair} пом.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Ближайшие истечения договоров</span></div>
          {expiring.length === 0 ? (
            <div className="empty-state">Нет истекающих договоров</div>
          ) : (
            <div className="timeline">
              {expiring.slice(0, 5).map(c => (
                <div key={c.id} className="tl-item">
                  <div className="tl-date">{new Date(c.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="tl-title">Договор № {c.number}</div>
                  <div className="tl-sub">{c.monthly_rent.toLocaleString('ru')} сом/мес</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Платежи по месяцам</span>
            <span className="card-link" onClick={() => navigate('/finance')}>Все платежи <i className="ti ti-arrow-right" /></span>
          </div>
          {revenue.length === 0 ? (
            <div className="empty-state">Нет данных о платежах</div>
          ) : (
            <div className="col-chart">
              {revenue.slice(-6).map((r, i, arr) => {
                const isLast = i === arr.length - 1;
                const h = Math.round((r.paid / maxRevenue) * 100);
                return (
                  <div key={r.month} className="col-item">
                    <div className="col-bar-wrap">
                      <div className="col-bar" style={{ height: `${h}%`, background: isLast ? '#2563EB' : '#93C5FD' }} />
                    </div>
                    <div className="col-val" style={isLast ? { color: '#2563EB' } : {}}>
                      {r.paid >= 1000000 ? `${(r.paid / 1000000).toFixed(1)}М` : `${Math.round(r.paid / 1000)}к`}
                    </div>
                    <div className="col-label" style={isLast ? { color: '#2563EB', fontWeight: 700 } : {}}>{MONTHS[r.month - 1]}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
