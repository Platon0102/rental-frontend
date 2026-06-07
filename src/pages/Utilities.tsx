import { useEffect, useState } from 'react';
import { utilitiesApi, roomsApi, contractsApi, tenantsApi, paymentsApi } from '../api';
import type { UtilityReading, Payment, Room, Contract, Tenant } from '../api';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export default function Utilities() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [rooms, setRooms] = useState<Room[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [utilPayments, setUtilPayments] = useState<Payment[]>([]); // платежи типа utilities

  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const [form, setForm] = useState({ prev: '', curr: '', tariff: '6.50' });
  const [payForm, setPayForm] = useState({ amount_paid: '', payment_date: now.toISOString().slice(0,10), comment: '' });

  const loadPeriod = async (m: number, y: number) => {
    const [rds, pays] = await Promise.all([
      utilitiesApi.listReadings({ period_month: m, period_year: y }),
      paymentsApi.list({ period_month: m, period_year: y }),
    ]);
    setReadings(rds.filter(x => x.utility_type === 'electricity'));
    setUtilPayments(pays.filter(p => p.payment_type === 'utilities'));
  };

  useEffect(() => {
    Promise.all([roomsApi.list(), contractsApi.list({ status: 'active' }), tenantsApi.list()])
      .then(([r, c, t]) => { setRooms(r); setContracts(c); setTenants(t); });
    loadPeriod(month, year);
  }, []);

  useEffect(() => { loadPeriod(month, year); }, [month, year]);

  const getContract = (roomId: number) => contracts.find(c => c.room_id === roomId);
  const getTenant = (roomId: number) => {
    const c = getContract(roomId);
    return c ? tenants.find(t => t.id === c.tenant_id) : undefined;
  };
  const getReading = (roomId: number) => readings.find(r => r.room_id === roomId);
  const getUtilPayment = (roomId: number) => {
    const c = getContract(roomId);
    return c ? utilPayments.find(p => p.contract_id === c.id) : undefined;
  };

  const occupiedRooms = rooms.filter(r => r.status === 'occupied');

  const openReadingModal = (room: Room) => {
    setSelectedRoom(room);
    setSuccess(false);
    const existing = getReading(room.id);
    setForm({
      prev: String(existing?.prev_reading ?? ''),
      curr: String(existing?.curr_reading ?? ''),
      tariff: String(existing?.tariff ?? '6.50'),
    });
    setShowModal(true);
  };

  const openPayModal = (room: Room) => {
    const rd = getReading(room.id);
    const existingPay = getUtilPayment(room.id);
    setSelectedRoom(room);
    setPaySuccess(false);
    setPayForm({
      amount_paid: String(rd?.amount ? Math.round(rd.amount) : ''),
      payment_date: now.toISOString().slice(0,10),
      comment: existingPay?.comment || '',
    });
    setShowPayModal(true);
  };

  const saveReading = async () => {
    if (!selectedRoom) return;
    setLoading(true);
    try {
      await utilitiesApi.addReading({
        room_id: selectedRoom.id,
        utility_type: 'electricity',
        period_month: month,
        period_year: year,
        prev_reading: Number(form.prev) || undefined,
        curr_reading: Number(form.curr) || undefined,
        tariff: Number(form.tariff) || undefined,
        is_fixed: false,
      });
      setSuccess(true);
      await loadPeriod(month, year);
      setTimeout(() => setShowModal(false), 1200);
    } catch (e: any) { alert(e.response?.data?.detail || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const savePayment = async () => {
    if (!selectedRoom) return;
    const contract = getContract(selectedRoom.id);
    if (!contract) { alert('Нет активного договора'); return; }
    const rd = getReading(selectedRoom.id);
    if (!rd?.amount) { alert('Сначала введите показания счётчика'); return; }

    setLoading(true);
    try {
      const amountDue = Math.round(rd.amount);
      const amountPaid = Number(payForm.amount_paid) || amountDue;

      // Ищем существующий платёж за этот период
      const existing = getUtilPayment(selectedRoom.id);
      if (existing) {
        // Обновляем существующий
        await paymentsApi.register(existing.id, {
          amount_paid: existing.amount_paid + amountPaid,
          payment_date: payForm.payment_date,
          comment: payForm.comment || undefined,
        });
      } else {
        // Создаём новый
        await paymentsApi.create({
          contract_id: contract.id,
          payment_type: 'utilities',
          period_month: month,
          period_year: year,
          amount_due: amountDue,
          amount_paid: amountPaid,
          payment_date: payForm.payment_date || undefined,
          comment: payForm.comment || undefined,
        });
      }
      setPaySuccess(true);
      await loadPeriod(month, year);
      setTimeout(() => setShowPayModal(false), 1200);
    } catch (e: any) {
      const d = e.response?.data?.detail;
      alert(typeof d === 'string' ? d : 'Ошибка записи платежа');
    } finally { setLoading(false); }
  };

  const consumption = Math.max(0, (Number(form.curr)||0) - (Number(form.prev)||0));
  const previewAmount = Math.round(consumption * (Number(form.tariff)||0));
  const totalReadingsAmount = readings.reduce((s,r) => s + (r.amount||0), 0);
  const totalPaid = utilPayments.reduce((s,p) => s + p.amount_paid, 0);
  const fmt = (n: number) => Math.round(n).toLocaleString('ru');

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Период</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{MONTHS[month-1].slice(0,3)} {year}</div>
          <div className="stat-sub">текущий период</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Введено показаний</div>
          <div className="stat-value" style={{ color: '#2563EB' }}>{readings.length} / {occupiedRooms.length}</div>
          <div className="stat-sub">помещений</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Начислено ⚡</div>
          <div className="stat-value" style={{ fontSize: 20, color: '#D97706' }}>{fmt(totalReadingsAmount)}</div>
          <div className="stat-sub">сом за электричество</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Оплачено</div>
          <div className="stat-value" style={{ fontSize: 20, color: '#16A34A' }}>{fmt(totalPaid)}</div>
          <div className="stat-sub">из {fmt(totalReadingsAmount)} сом · {utilPayments.length} платежей</div>
          {totalReadingsAmount > 0 && totalPaid < totalReadingsAmount && (
            <span className="stat-badge badge-warn">не всё оплачено</span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">⚡ Электроэнергия — {MONTHS[month-1]} {year}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              style={{ padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
              {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {occupiedRooms.length === 0
          ? <div className="empty-state">Нет занятых помещений</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Помещение</th>
                    <th>Арендатор</th>
                    <th>Пред.</th>
                    <th>Тек.</th>
                    <th>Расход, кВт·ч</th>
                    <th>Тариф</th>
                    <th>Начислено</th>
                    <th>Статус оплаты</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {occupiedRooms.map(room => {
                    const rd = getReading(room.id);
                    const tenant = getTenant(room.id);
                    const pay = getUtilPayment(room.id);
                    const isPaid = pay && pay.status === 'paid';
                    const isPartial = pay && pay.status === 'partial';

                    return (
                      <tr key={room.id}>
                        <td style={{ fontWeight: 600 }}>{room.name}</td>
                        <td style={{ color: '#64748B' }}>{tenant?.name || '—'}</td>
                        <td>{rd?.prev_reading ?? <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                        <td>{rd?.curr_reading ?? <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                        <td style={{ fontWeight: 600 }}>{rd?.consumption != null ? rd.consumption : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                        <td>{rd?.tariff ? `${rd.tariff} сом` : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                        <td style={{ fontWeight: 700, color: rd ? '#D97706' : '#CBD5E1', fontSize: 14 }}>
                          {rd?.amount ? `${fmt(rd.amount)} сом` : '—'}
                        </td>
                        <td>
                          {!rd ? (
                            <span style={{ color: '#CBD5E1', fontSize: 12 }}>нет данных</span>
                          ) : isPaid ? (
                            <span className="pill pill-paid"><i className="ti ti-check" /> Оплачено</span>
                          ) : isPartial ? (
                            <span className="pill pill-part">Частично · {fmt(pay!.amount_paid)} сом</span>
                          ) : (
                            <span className="pill pill-debt">Не оплачено</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '4px 10px', background: rd ? '#FFFBEB' : undefined, borderColor: rd ? '#FCD34D' : undefined }}
                              onClick={() => openReadingModal(room)}>
                              <i className={`ti ti-${rd ? 'edit' : 'plus'}`} /> {rd ? 'Показания' : 'Ввести'}
                            </button>
                            {rd && !isPaid && (
                              <button className="btn btn-secondary"
                                style={{ fontSize: 11, padding: '4px 10px', background: '#F0FDF4', borderColor: '#86EFAC', color: '#16A34A' }}
                                onClick={() => openPayModal(room)}>
                                <i className="ti ti-credit-card" /> Оплатить
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {readings.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#FFFBEB' }}>
                      <td colSpan={6} style={{ fontWeight: 700, padding: '10px 14px', color: '#92400E' }}>
                        Итого {MONTHS[month-1]} {year}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 14, color: '#D97706', padding: '10px 14px' }}>{fmt(totalReadingsAmount)} сом</td>
                      <td style={{ fontWeight: 700, fontSize: 14, color: '#16A34A', padding: '10px 14px' }}>
                        {utilPayments.length > 0 ? `${fmt(totalPaid)} сом оплачено` : '—'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
      </div>

      {/* Modal: ввод показаний */}
      <div className={`modal-overlay${showModal ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal" style={{ width: 400 }}>
          <div className="modal-header">
            <div className="modal-title"><span style={{ fontSize: 20 }}>⚡</span> Показания — {selectedRoom?.name}</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#92400E' }}>
              Период: <b>{MONTHS[month-1]} {year}</b>
            </div>
            <div className="mf-grid mf-2">
              <div className="mf-field">
                <label>Предыдущее показание</label>
                <input type="number" value={form.prev} onChange={e => setForm(f => ({ ...f, prev: e.target.value }))} placeholder="0" step="0.001" style={{ fontSize: 16 }} />
              </div>
              <div className="mf-field">
                <label>Текущее показание</label>
                <input type="number" value={form.curr} onChange={e => setForm(f => ({ ...f, curr: e.target.value }))} placeholder="0" step="0.001" style={{ fontSize: 16 }} />
              </div>
              <div className="mf-field" style={{ gridColumn: 'span 2' }}>
                <label>Тариф (сом / кВт·ч)</label>
                <input type="number" value={form.tariff} onChange={e => setForm(f => ({ ...f, tariff: e.target.value }))} step="0.01" />
              </div>
            </div>
            {form.curr && form.prev && (
              <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 10, padding: '14px 16px', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#92400E' }}>Расход: <b>{consumption.toFixed(3)} кВт·ч</b></div>
                  <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>Тариф: {form.tariff} сом/кВт·ч</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#92400E' }}>К оплате</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#D97706' }}>{fmt(previewAmount)} сом</div>
                </div>
              </div>
            )}
            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />Показания сохранены</div>
              {previewAmount > 0 && <div style={{ fontSize: 12, color: '#16A34A', marginTop: 4 }}>К оплате: {fmt(previewAmount)} сом — нажмите «Оплатить» в таблице</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={saveReading} disabled={loading || success} style={{ background: '#D97706' }}>
              <i className="ti ti-check" /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Закрыть</button>
          </div>
        </div>
      </div>

      {/* Modal: оплата */}
      <div className={`modal-overlay${showPayModal ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setShowPayModal(false)}>
        <div className="modal" style={{ width: 400 }}>
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-credit-card" /> Оплата ⚡ — {selectedRoom?.name}</div>
            <button className="modal-close" onClick={() => setShowPayModal(false)}>×</button>
          </div>
          <div className="modal-body">
            {selectedRoom && (() => {
              const rd = getReading(selectedRoom.id);
              return rd?.amount ? (
                <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#92400E' }}>
                    <div>Расход: <b>{rd.consumption} кВт·ч</b></div>
                    <div>Период: <b>{MONTHS[month-1]} {year}</b></div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>{fmt(rd.amount)} сом</div>
                </div>
              ) : null;
            })()}
            <div className="mf-grid">
              <div className="mf-field">
                <label>Сумма оплаты (сом)</label>
                <input type="number" value={payForm.amount_paid}
                  onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))}
                  style={{ fontSize: 18, fontWeight: 600 }} placeholder="0" />
                <div className="mf-hint">Оставьте пустым — спишется полная сумма</div>
              </div>
              <div className="mf-field">
                <label>Дата оплаты</label>
                <input type="date" value={payForm.payment_date}
                  onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Комментарий (необязательно)</label>
                <input value={payForm.comment} onChange={e => setPayForm(f => ({ ...f, comment: e.target.value }))} placeholder="п/п №..." />
              </div>
            </div>
            <div className={`success-banner${paySuccess ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />Платёж записан</div>
              <div style={{ fontSize: 12, color: '#16A34A', marginTop: 4 }}>Отражено в истории помещения и статистике платежей</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-green" onClick={savePayment} disabled={loading || paySuccess}>
              <i className="ti ti-check" /> {loading ? 'Запись...' : 'Записать оплату'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
}
