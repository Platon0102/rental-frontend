import { useEffect, useState } from 'react';
import { paymentsApi, contractsApi, tenantsApi, roomsApi } from '../api';
import type { Payment, Contract, Tenant, Room } from '../api';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

type PaymentStatus = Payment['status'];

const statusConfig: Record<string, { pill: string; label: string; color: string; bg: string }> = {
  paid:    { pill: 'pill-paid', label: 'Оплачено',  color: '#16A34A', bg: '#DCFCE7' },
  partial: { pill: 'pill-part', label: 'Частично',  color: '#D97706', bg: '#FEF3C7' },
  debt:    { pill: 'pill-debt', label: 'Долг',      color: '#DC2626', bg: '#FEE2E2' },
  pending: { pill: 'pill-term', label: 'Предстоит', color: '#64748B', bg: '#F1F5F9' },
};

interface ContractInfo {
  contract: Contract;
  tenant?: Tenant;
  room?: Room;
  schedule: Payment[];
}

export default function Finance() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [contractInfos, setContractInfos] = useState<ContractInfo[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractInfo | null>(null);
  const [showPayModal, setShowPayModal] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: '', comment: '' });

  const today = new Date();

  const loadAll = async () => {
    const [cs, ts, rs] = await Promise.all([
      contractsApi.list({ status: 'active' }),
      tenantsApi.list(),
      roomsApi.list(),
    ]);
    setContracts(cs);
    setTenants(ts);
    setRooms(rs);

    // загружаем план по каждому договору
    const infos: ContractInfo[] = await Promise.all(
      cs.map(async c => {
        const schedule = await paymentsApi.schedule(c.id).catch(() => [] as Payment[]);
        return {
          contract: c,
          tenant: ts.find(t => t.id === c.tenant_id),
          room: rs.find(r => r.id === c.room_id),
          schedule,
        };
      })
    );
    setContractInfos(infos);
    if (infos.length > 0 && !selectedContract) {
      setSelectedContract(infos[0]);
    } else if (selectedContract) {
      const updated = infos.find(i => i.contract.id === selectedContract.contract.id);
      if (updated) setSelectedContract(updated);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Статистика по выбранному договору
  const schedule = selectedContract?.schedule ?? [];
  const totalDue = schedule.reduce((s, p) => s + p.amount_due, 0);
  const totalPaid = schedule.reduce((s, p) => s + p.amount_paid, 0);
  const paidMonths = schedule.filter(p => p.status === 'paid').length;
  const debtMonths = schedule.filter(p => p.status === 'debt').length;
  const pendingMonths = schedule.filter(p => p.status === 'pending').length;

  // Текущий месяц — ближайший не оплаченный
  const currentPeriodPayment = schedule.find(p =>
    p.status !== 'paid' &&
    p.period_year === today.getFullYear() &&
    p.period_month === today.getMonth() + 1
  );

  // Глобальная статистика по всем договорам
  const allSchedules = contractInfos.flatMap(i => i.schedule);
  const globalDebt = allSchedules.filter(p => p.status === 'debt').reduce((s, p) => s + (p.amount_due - p.amount_paid), 0);
  const globalPaid = allSchedules.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount_paid, 0);

  const isOverdue = (p: Payment) => {
    if (p.status === 'paid') return false;
    const now = new Date();
    if (p.period_year! < now.getFullYear()) return true;
    if (p.period_year! === now.getFullYear() && p.period_month! < now.getMonth() + 1) return true;
    return false;
  };

  const openPayModal = (p: Payment) => {
    setShowPayModal(p);
    setSuccess(false);
    setPayForm({
      amount: String(p.amount_due - p.amount_paid),
      payment_date: today.toISOString().slice(0, 10),
      comment: '',
    });
  };

  const registerPayment = async () => {
    if (!showPayModal) return;
    setLoading(true);
    try {
      const newTotal = showPayModal.amount_paid + Number(payForm.amount);
      await paymentsApi.register(showPayModal.id, {
        amount_paid: newTotal,
        payment_date: payForm.payment_date,
        comment: payForm.comment || undefined,
      });
      setSuccess(true);
      await loadAll();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка');
    } finally { setLoading(false); }
  };

  const fmt = (n: number) => n.toLocaleString('ru');
  const fmtShort = (n: number) => n >= 1000000
    ? `${(n / 1000000).toFixed(1)} млн`
    : n >= 1000 ? `${Math.round(n / 1000)} тыс` : String(Math.round(n));

  return (
    <div>
      {/* Глобальные KPI */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Активных договоров</div>
          <div className="stat-value">{contracts.length}</div>
          <div className="stat-sub">с планом оплат</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Получено (всего)</div>
          <div className="stat-value" style={{ fontSize: 22, color: '#16A34A' }}>{fmtShort(globalPaid)}</div>
          <div className="stat-sub">сом по всем договорам</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Задолженность</div>
          <div className="stat-value" style={{ fontSize: 22, color: globalDebt > 0 ? '#DC2626' : '#16A34A' }}>
            {globalDebt > 0 ? fmtShort(globalDebt) : '0'}
          </div>
          <div className="stat-sub">{globalDebt > 0 ? 'сом не оплачено' : 'долгов нет'}</div>
          {globalDebt > 0 && <span className="stat-badge badge-down">требует внимания</span>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Просроченных месяцев</div>
          <div className="stat-value" style={{ color: '#DC2626' }}>
            {allSchedules.filter(p => p.status === 'debt' || (p.status === 'pending' && isOverdue(p))).length}
          </div>
          <div className="stat-sub">по всем договорам</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Список договоров */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><span className="card-title">Договоры</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contractInfos.map(info => {
              const sch = info.schedule;
              const paid = sch.filter(p => p.status === 'paid').length;
              const debt = sch.filter(p => p.status === 'debt' || (p.status === 'pending' && isOverdue(p))).length;
              const isSelected = selectedContract?.contract.id === info.contract.id;
              return (
                <div
                  key={info.contract.id}
                  onClick={() => setSelectedContract(info)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
                    background: isSelected ? '#EFF6FF' : '#fff',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{info.tenant?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{info.room?.name} · № {info.contract.number}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>{paid}/{sch.length} мес.</div>
                      {debt > 0 && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>⚠ {debt} просроч.</div>}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sch.length > 0 ? Math.round(paid / sch.length * 100) : 0}%`, background: debt > 0 ? '#EF4444' : '#22C55E', borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
            {contractInfos.length === 0 && <div className="empty-state">Нет активных договоров</div>}
          </div>
        </div>

        {/* Детали выбранного договора */}
        {selectedContract ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Статистика */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{selectedContract.tenant?.name}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {selectedContract.room?.name} · № {selectedContract.contract.number} · {selectedContract.contract.monthly_rent.toLocaleString('ru')} сом/мес
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Оплачено', value: paidMonths, sub: 'месяцев', color: '#16A34A' },
                  { label: 'Долг', value: debtMonths, sub: 'месяцев', color: '#DC2626' },
                  { label: 'Предстоит', value: pendingMonths, sub: 'месяцев', color: '#64748B' },
                  { label: 'Получено', value: fmtShort(totalPaid), sub: `из ${fmtShort(totalDue)}`, color: '#2563EB' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Прогресс */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 5 }}>
                  <span>Выполнение плана</span>
                  <span style={{ fontWeight: 600, color: '#2563EB' }}>{totalDue > 0 ? Math.round(totalPaid / totalDue * 100) : 0}%</span>
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${totalDue > 0 ? Math.round(totalPaid / totalDue * 100) : 0}%`, background: '#2563EB' }} />
                </div>
              </div>
            </div>

            {/* Календарь месяцев */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header"><span className="card-title">План оплат по месяцам</span></div>

              {/* Легенда */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: cfg.bg, border: `1.5px solid ${cfg.color}` }} />
                    {cfg.label}
                  </div>
                ))}
              </div>

              {/* Группировка по годам */}
              {(() => {
                const years = [...new Set(schedule.map(p => p.period_year!))].sort();
                return years.map(year => (
                  <div key={year} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>{year}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                      {schedule.filter(p => p.period_year === year).map(p => {
                        const overdue = isOverdue(p);
                        const effectiveStatus = (p.status === 'pending' && overdue) ? 'debt' : p.status;
                        const cfg = statusConfig[effectiveStatus] || statusConfig.pending;
                        const isCurrent = p.period_year === today.getFullYear() && p.period_month === today.getMonth() + 1;
                        return (
                          <div
                            key={p.id}
                            onClick={() => effectiveStatus !== 'paid' && openPayModal(p)}
                            style={{
                              background: cfg.bg,
                              border: `1.5px solid ${isCurrent ? '#2563EB' : cfg.color}`,
                              borderRadius: 8,
                              padding: '8px 4px',
                              textAlign: 'center',
                              cursor: effectiveStatus !== 'paid' ? 'pointer' : 'default',
                              transition: 'transform .15s, box-shadow .15s',
                              position: 'relative',
                            }}
                            title={effectiveStatus !== 'paid' ? 'Нажмите чтобы внести оплату' : 'Оплачено'}
                            onMouseEnter={e => { if (effectiveStatus !== 'paid') (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>
                              {MONTHS_SHORT[p.period_month! - 1]}
                            </div>
                            <div style={{ fontSize: 10, color: cfg.color, marginTop: 2 }}>
                              {effectiveStatus === 'paid' ? '✓' : effectiveStatus === 'debt' ? '!' : '···'}
                            </div>
                            <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                              {fmtShort(p.amount_due)}
                            </div>
                            {isCurrent && (
                              <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#2563EB', borderRadius: '50%', border: '2px solid #fff' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              {schedule.length === 0 && (
                <div className="empty-state">Нет плана платежей</div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="empty-state">Выберите договор слева</div>
          </div>
        )}
      </div>

      {/* История всех платежей */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <span className="card-title">
            {selectedContract
              ? `История платежей — ${selectedContract.tenant?.name}`
              : 'История платежей'}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Период</th>
                <th>Начислено</th>
                <th>Оплачено</th>
                <th>Остаток</th>
                <th>Статус</th>
                <th>Дата оплаты</th>
                <th>Комментарий</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(selectedContract ? selectedContract.schedule : allSchedules)
                .sort((a, b) => {
                  if (a.period_year !== b.period_year) return b.period_year! - a.period_year!;
                  return b.period_month! - a.period_month!;
                })
                .map(p => {
                  const overdue = isOverdue(p);
                  const effectiveStatus = (p.status === 'pending' && overdue) ? 'debt' : p.status;
                  const cfg = statusConfig[effectiveStatus] || statusConfig.pending;
                  const remainder = p.amount_due - p.amount_paid;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>
                        {MONTHS[p.period_month! - 1]} {p.period_year}
                      </td>
                      <td>{fmt(p.amount_due)} сом</td>
                      <td style={{ color: '#16A34A', fontWeight: p.amount_paid > 0 ? 600 : undefined }}>
                        {p.amount_paid > 0 ? `${fmt(p.amount_paid)} сом` : '—'}
                      </td>
                      <td style={{ color: remainder > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                        {remainder > 0 ? `${fmt(remainder)} сом` : '✓'}
                      </td>
                      <td><span className={`pill ${cfg.pill}`}>{cfg.label}</span></td>
                      <td style={{ color: '#64748B' }}>
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('ru') : '—'}
                      </td>
                      <td style={{ color: '#94A3B8', fontSize: 12 }}>{p.comment || '—'}</td>
                      <td>
                        {effectiveStatus !== 'paid' && (
                          <button
                            className="btn"
                            style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC', fontSize: 11, padding: '4px 10px' }}
                            onClick={() => openPayModal(p)}
                          >
                            <i className="ti ti-check" /> Внести
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {(selectedContract ? selectedContract.schedule : allSchedules).length === 0 && (
                <tr><td colSpan={8} className="empty-state">Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Внести оплату */}
      <div className={`modal-overlay${showPayModal ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setShowPayModal(null)}>
        <div className="modal" style={{ width: 420 }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="ti ti-credit-card" />
              Оплата — {showPayModal ? `${MONTHS[showPayModal.period_month! - 1]} ${showPayModal.period_year}` : ''}
            </div>
            <button className="modal-close" onClick={() => setShowPayModal(null)}>×</button>
          </div>
          <div className="modal-body">
            {showPayModal && (
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#64748B' }}>Начислено</span>
                  <span style={{ fontWeight: 600 }}>{fmt(showPayModal.amount_due)} сом</span>
                </div>
                {showPayModal.amount_paid > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B' }}>Уже оплачено</span>
                    <span style={{ fontWeight: 600, color: '#16A34A' }}>{fmt(showPayModal.amount_paid)} сом</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
                  <span style={{ color: '#64748B' }}>Остаток к оплате</span>
                  <span style={{ fontWeight: 700, color: '#DC2626' }}>{fmt(showPayModal.amount_due - showPayModal.amount_paid)} сом</span>
                </div>
              </div>
            )}
            <div className="mf-grid">
              <div className="mf-field">
                <label>Сумма оплаты (сом)</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ fontSize: 18, fontWeight: 600 }}
                  placeholder="Введите сумму"
                />
                {showPayModal && payForm.amount && (
                  <div className="mf-hint">
                    Итого будет оплачено: {fmt(showPayModal.amount_paid + Number(payForm.amount))} из {fmt(showPayModal.amount_due)} сом
                  </div>
                )}
              </div>
              <div className="mf-field">
                <label>Дата поступления</label>
                <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Комментарий (необязательно)</label>
                <input value={payForm.comment} onChange={e => setPayForm(f => ({ ...f, comment: e.target.value }))} placeholder="п/п №, назначение..." />
              </div>
            </div>
            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />Платёж зафиксирован</div>
              <div style={{ fontSize: 12, color: '#16A34A' }}>Статус месяца обновлён.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-green"
              onClick={registerPayment}
              disabled={loading || success || !payForm.amount || !payForm.payment_date}
            >
              <i className="ti ti-check" /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowPayModal(null)}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}
