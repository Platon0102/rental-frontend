import { useEffect, useState } from 'react';
import { paymentsApi, contractsApi, tenantsApi, roomsApi } from '../api';
import type { Payment, Contract, Tenant, Room } from '../api';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const statusConfig: Record<string, { label: string; pill: string; color: string; bg: string }> = {
  paid:    { label: 'Оплачено',  pill: 'pill-paid', color: '#16A34A', bg: '#F0FDF4' },
  partial: { label: 'Частично', pill: 'pill-part', color: '#D97706', bg: '#FFFBEB' },
  debt:    { label: 'Долг',     pill: 'pill-debt', color: '#DC2626', bg: '#FEF2F2' },
  pending: { label: 'Предстоит',pill: 'pill-term', color: '#64748B', bg: '#F8FAFC' },
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
  const [selected, setSelected] = useState<ContractInfo | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState('');
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});

  const loadAll = async () => {
    const [cs, ts, rs] = await Promise.all([
      contractsApi.list({ status: 'active' }),
      tenantsApi.list(),
      roomsApi.list(),
    ]);
    setContracts(cs);
    setTenants(ts);
    setRooms(rs);

    const infos: ContractInfo[] = await Promise.all(
      cs.map(async c => ({
        contract: c,
        tenant: ts.find(t => t.id === c.tenant_id),
        room: rs.find(r => r.id === c.room_id),
        schedule: await paymentsApi.schedule(c.id).catch(() => [] as Payment[]),
      }))
    );
    setContractInfos(infos);

    if (selected) {
      const upd = infos.find(i => i.contract.id === selected.contract.id);
      if (upd) setSelected(upd);
    } else if (infos.length > 0) {
      setSelected(infos[0]);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Платежи для выбранного договора (только аренда)
  const rentSchedule = (selected?.schedule ?? []).filter(p => p.payment_type !== 'utilities');
  const unpaid = rentSchedule.filter(p => p.status !== 'paid');
  const checkedPayments = rentSchedule.filter(p => checked.has(p.id));

  // Сумма к оплате по выбранным
  const totalSelected = checkedPayments.reduce((s, p) => {
    const custom = customAmounts[p.id];
    return s + (custom !== undefined ? Number(custom) : p.amount_due - p.amount_paid);
  }, 0);

  const toggleCheck = (p: Payment) => {
    if (p.status === 'paid') return;
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
  };

  const selectAll = () => {
    setChecked(new Set(unpaid.map(p => p.id)));
  };

  const clearAll = () => setChecked(new Set());

  const openPayModal = () => {
    if (checked.size === 0) return;
    setSuccess(false);
    setPayDate(new Date().toISOString().slice(0, 10));
    setComment('');
    // инициализируем суммы остатков
    const init: Record<number, string> = {};
    checkedPayments.forEach(p => {
      init[p.id] = String(p.amount_due - p.amount_paid);
    });
    setCustomAmounts(init);
    setShowModal(true);
  };

  const registerPayments = async () => {
    setLoading(true);
    try {
      await Promise.all(checkedPayments.map(p => {
        const addAmount = Number(customAmounts[p.id] ?? (p.amount_due - p.amount_paid));
        const newTotal = p.amount_paid + addAmount;
        return paymentsApi.register(p.id, {
          amount_paid: newTotal,
          payment_date: payDate,
          comment: comment || undefined,
        });
      }));
      setSuccess(true);
      setChecked(new Set());
      await loadAll();
      setTimeout(() => setShowModal(false), 1500);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка');
    } finally { setLoading(false); }
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('ru');
  const fmtShort = (n: number) => n >= 1000000 ? `${(n/1000000).toFixed(1)}М` : n >= 1000 ? `${Math.round(n/1000)}тыс` : String(Math.round(n));

  // Статистика по выбранному
  const totalDue  = rentSchedule.reduce((s, p) => s + p.amount_due, 0);
  const totalPaid = rentSchedule.reduce((s, p) => s + p.amount_paid, 0);
  const totalDebt = rentSchedule.filter(p => p.status === 'debt').reduce((s, p) => s + (p.amount_due - p.amount_paid), 0);
  const paidCount = rentSchedule.filter(p => p.status === 'paid').length;
  const debtCount = rentSchedule.filter(p => p.status === 'debt').length;

  // Глобальная статистика
  const allRent = contractInfos.flatMap(i => i.schedule.filter(p => p.payment_type !== 'utilities'));
  const globalDebt = allRent.filter(p => p.status === 'debt').reduce((s,p) => s + (p.amount_due - p.amount_paid), 0);
  const globalPaid = allRent.filter(p => p.status === 'paid').reduce((s,p) => s + p.amount_paid, 0);

  return (
    <div>
      {/* Глобальные KPI */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Активных договоров</div>
          <div className="stat-value">{contracts.length}</div>
          <div className="stat-sub">с планом платежей</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Получено (всего)</div>
          <div className="stat-value" style={{ fontSize: 22, color: '#16A34A' }}>{fmtShort(globalPaid)}</div>
          <div className="stat-sub">сом по всем договорам</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Общий долг</div>
          <div className="stat-value" style={{ fontSize: 22, color: globalDebt > 0 ? '#DC2626' : '#16A34A' }}>
            {globalDebt > 0 ? fmtShort(globalDebt) : '0'}
          </div>
          <div className="stat-sub">{globalDebt > 0 ? 'сом не оплачено' : 'долгов нет'}</div>
          {globalDebt > 0 && <span className="stat-badge badge-down">требует внимания</span>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Договоров с долгом</div>
          <div className="stat-value" style={{ color: '#DC2626' }}>
            {contractInfos.filter(i => i.schedule.some(p => p.status === 'debt')).length}
          </div>
          <div className="stat-sub">из {contracts.length}</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Список договоров */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><span className="card-title">Договоры</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contractInfos.map(info => {
              const sch = info.schedule.filter(p => p.payment_type !== 'utilities');
              const debt = sch.filter(p => p.status === 'debt').length;
              const paid = sch.filter(p => p.status === 'paid').length;
              const isSelected = selected?.contract.id === info.contract.id;
              return (
                <div key={info.contract.id} onClick={() => { setSelected(info); setChecked(new Set()); }}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${isSelected ? '#2563EB' : debt > 0 ? '#FECACA' : '#E2E8F0'}`,
                    background: isSelected ? '#EFF6FF' : debt > 0 ? '#FEF2F2' : '#fff',
                    transition: 'all .15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{info.tenant?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{info.room?.name} · № {info.contract.number}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {debt > 0
                        ? <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>⚠ {debt} мес. долг</div>
                        : <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ Без долгов</div>}
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{paid}/{sch.length} мес. оплачено</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sch.length > 0 ? Math.round(paid/sch.length*100) : 0}%`, background: debt > 0 ? '#EF4444' : '#22C55E', borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
            {contractInfos.length === 0 && <div className="empty-state">Нет активных договоров</div>}
          </div>
        </div>

        {/* Детали договора */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Статистика */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{selected.tenant?.name}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {selected.room?.name} · № {selected.contract.number} · {selected.contract.monthly_rent.toLocaleString('ru')} сом/мес
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { label: 'Оплачено месяцев', value: paidCount, color: '#16A34A' },
                  { label: 'Долг (месяцев)', value: debtCount, color: '#DC2626' },
                  { label: 'Получено', value: `${fmtShort(totalPaid)} сом`, color: '#2563EB' },
                  { label: 'Долг (сумма)', value: `${fmtShort(totalDebt)} сом`, color: totalDebt > 0 ? '#DC2626' : '#16A34A' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                  <span>Выполнение плана</span>
                  <span style={{ fontWeight: 600 }}>{totalDue > 0 ? Math.round(totalPaid/totalDue*100) : 0}%</span>
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${totalDue > 0 ? Math.round(totalPaid/totalDue*100) : 0}%`, background: '#2563EB' }} />
                </div>
              </div>
            </div>

            {/* Таблица месяцев */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <span className="card-title">График платежей</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {checked.size > 0 && (
                    <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>
                      Выбрано: {checked.size} мес. · {fmt(totalSelected)} сом
                    </span>
                  )}
                  {unpaid.length > 0 && (
                    checked.size === unpaid.length
                      ? <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={clearAll}>Снять всё</button>
                      : <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={selectAll}>Выбрать все долги</button>
                  )}
                  {checked.size > 0 && (
                    <button className="btn btn-primary" onClick={openPayModal}>
                      <i className="ti ti-credit-card" /> Оплатить выбранные ({checked.size})
                    </button>
                  )}
                </div>
              </div>

              {/* Подсказка */}
              {unpaid.length > 0 && checked.size === 0 && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1D4ED8' }}>
                  <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
                  Отметьте галочками месяцы которые хотите оплатить — можно выбрать сразу несколько
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rentSchedule.map(p => {
                  const cfg = statusConfig[p.status] || statusConfig.pending;
                  const remainder = p.amount_due - p.amount_paid;
                  const isChecked = checked.has(p.id);
                  const isPaid = p.status === 'paid';
                  return (
                    <div key={p.id}
                      onClick={() => toggleCheck(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        border: `1.5px solid ${isChecked ? '#2563EB' : isPaid ? '#E2E8F0' : cfg.color + '55'}`,
                        background: isChecked ? '#EFF6FF' : cfg.bg,
                        cursor: isPaid ? 'default' : 'pointer',
                        transition: 'all .15s',
                      }}>
                      {/* Чекбокс */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${isPaid ? '#CBD5E1' : isChecked ? '#2563EB' : '#CBD5E1'}`,
                        background: isChecked ? '#2563EB' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {(isChecked || isPaid) && (
                          <i className="ti ti-check" style={{ fontSize: 12, color: isPaid ? '#16A34A' : '#fff' }} />
                        )}
                      </div>

                      {/* Месяц */}
                      <div style={{ minWidth: 100, fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                        {MONTHS[p.period_month! - 1]} {p.period_year}
                      </div>

                      {/* Начислено */}
                      <div style={{ flex: 1, fontSize: 12, color: '#64748B' }}>
                        Начислено: <b style={{ color: '#0F172A' }}>{fmt(p.amount_due)} сом</b>
                        {p.amount_paid > 0 && !isPaid && (
                          <span style={{ marginLeft: 8, color: '#16A34A' }}>· оплачено {fmt(p.amount_paid)} сом</span>
                        )}
                      </div>

                      {/* Остаток */}
                      <div style={{ textAlign: 'right', minWidth: 120 }}>
                        {isPaid ? (
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>✓ Оплачено</div>
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>
                            {fmt(remainder)} сом
                          </div>
                        )}
                        {p.payment_date && (
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>
                            {new Date(p.payment_date).toLocaleDateString('ru')}
                          </div>
                        )}
                      </div>

                      {/* Статус */}
                      <span className={`pill ${cfg.pill}`} style={{ minWidth: 80, justifyContent: 'center' }}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
                {rentSchedule.length === 0 && <div className="empty-state">Нет данных о платежах</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="empty-state">Выберите договор слева</div>
          </div>
        )}
      </div>

      {/* Modal: Оплата выбранных месяцев */}
      <div className={`modal-overlay${showModal ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal" style={{ width: 500 }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="ti ti-credit-card" /> Оплата — {selected?.tenant?.name}
            </div>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          </div>
          <div className="modal-body">
            {/* Список выбранных месяцев */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {checkedPayments.map(p => {
                const remainder = p.amount_due - p.amount_paid;
                return (
                  <div key={p.id} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {MONTHS[p.period_month! - 1]} {p.period_year}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>
                        Долг: <b style={{ color: '#DC2626' }}>{fmt(remainder)} сом</b>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>Вносим:</span>
                      <input
                        type="number"
                        value={customAmounts[p.id] ?? remainder}
                        onChange={e => setCustomAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={{ flex: 1, padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
                      />
                      <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>сом</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Итого */}
            <div style={{ background: '#EFF6FF', border: '1.5px solid #93C5FD', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>Итого к зачислению</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#2563EB' }}>{fmt(totalSelected)} сом</span>
            </div>

            <div className="mf-grid mf-2">
              <div className="mf-field">
                <label>Дата поступления</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div className="mf-field">
                <label>Комментарий (необязательно)</label>
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="п/п №, банк..." />
              </div>
            </div>

            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title">
                <i className="ti ti-circle-check" style={{ fontSize: 20 }} />
                Платежи зафиксированы — {checkedPayments.length} мес.
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={registerPayments} disabled={loading || success || totalSelected <= 0}>
              <i className="ti ti-check" /> {loading ? 'Сохранение...' : `Зафиксировать ${fmt(totalSelected)} сом`}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}
