import { useEffect, useState } from 'react';
import { dashboardApi } from '../api';

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(() => {});
    dashboardApi.occupancyByFloor().then(setFloors).catch(() => {});
    dashboardApi.revenueByMonth().then(setRevenue).catch(() => {});
  }, []);

  const totalDue = revenue.reduce((s, r) => s + r.due, 0);
  const totalPaid = revenue.reduce((s, r) => s + r.paid, 0);
  const fmt = (n: number) => n.toLocaleString('ru');

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Заполняемость по этажам</span></div>
          {floors.length === 0 ? (
            <div className="empty-state">Нет данных</div>
          ) : (
            floors.map(f => (
              <div key={f.floor} className="bar-row">
                <span className="bar-label">Этаж {f.floor}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${f.pct}%`, background: f.pct === Math.max(...floors.map(x => x.pct)) ? '#2563EB' : '#93C5FD' }} />
                </div>
                <span className="bar-val">{f.pct}%</span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Финансовые показатели</span></div>
          {revenue.length > 0 && (
            <>
              <div className="prog-wrap">
                <div className="prog-header"><span>Сбор платежей</span><span style={{ fontWeight: 600, color: '#2563EB' }}>{totalDue > 0 ? Math.round(totalPaid / totalDue * 100) : 0}%</span></div>
                <div className="prog-track"><div className="prog-fill" style={{ width: `${totalDue > 0 ? Math.round(totalPaid / totalDue * 100) : 0}%`, background: '#2563EB' }} /></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#64748B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>Начислено (всего)</span><span style={{ fontWeight: 600, color: '#0F172A' }}>{fmt(totalDue)} сом</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                  <span>Оплачено (всего)</span><span style={{ fontWeight: 600, color: '#16A34A' }}>{fmt(totalPaid)} сом</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Сводный отчёт</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Показатель</th><th>Значение</th></tr>
            </thead>
            <tbody>
              <tr><td>Заполняемость</td><td><b>{stats?.rooms.occupancy_pct ?? '—'}%</b></td></tr>
              <tr><td>Занято помещений</td><td><b>{stats?.rooms.occupied ?? '—'}</b></td></tr>
              <tr><td>Свободно помещений</td><td><b>{stats?.rooms.free ?? '—'}</b></td></tr>
              <tr><td>На резерве</td><td><b>{stats?.rooms.reserved ?? '—'}</b></td></tr>
              <tr><td>В ремонте</td><td><b>{stats?.rooms.repair ?? '—'}</b></td></tr>
              <tr><td>Общая задолженность</td><td><b style={{ color: '#DC2626' }}>{stats ? fmt(stats.finance.debt_total) + ' сом' : '—'}</b></td></tr>
              <tr><td>Договоры истекают (30 дней)</td><td><b style={{ color: '#D97706' }}>{stats?.contracts.expiring_30_days ?? '—'}</b></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
