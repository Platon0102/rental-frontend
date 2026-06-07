import { useEffect, useState } from 'react';
import { roomsApi, contractsApi, tenantsApi } from '../api';
import type { Room, RoomStatus, Contract, Tenant } from '../api';

const statusClass: Record<string, string> = {
  occupied: 's-occ', free: 's-free', reserved: 's-res', repair: 's-rep',
};
const statusLabel: Record<string, string> = {
  occupied: 'Занято', free: 'Свободно', reserved: 'Резерв', repair: 'Ремонт',
};

const contractStatusLabel: Record<string, string> = {
  active: 'Активный', expiring: 'Истекает', terminated: 'Расторгнут', expired: 'Истёк',
};
const contractStatusPill: Record<string, string> = {
  active: 'pill-act', expiring: 'pill-soon', terminated: 'pill-term', expired: 'pill-exp',
};
const paymentStatusLabel: Record<string, string> = {
  paid: 'Оплачено', partial: 'Частично', debt: 'Долг', pending: 'Предстоит',
};
const paymentStatusPill: Record<string, string> = {
  paid: 'pill-paid', partial: 'pill-part', debt: 'pill-debt', pending: 'pill-term',
};
const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

type Modal = 'create-room' | 'edit-room' | 'status' | 'contract' | 'terminate' | 'history' | null;

export default function Floors() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [curFloor, setCurFloor] = useState<number | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // forms
  const [roomForm, setRoomForm] = useState({ name: '', floor: 1, area: '', base_rate: '', description: '' });
  const [statusForm, setStatusForm] = useState({ new_status: 'free' as RoomStatus, reason: '', repair_start: '', repair_end: '' });
  const [contractForm, setContractForm] = useState({ tenant_id: '', number: '', start_date: '', end_date: '', monthly_rent: '', deposit: '' });
  const [terminateForm, setTerminateForm] = useState({ terminated_at: new Date().toISOString().slice(0, 10), termination_reason: '', termination_initiator: 'Арендатор', penalty: '0' });

  const load = async () => {
    const [r, c, t] = await Promise.all([
      roomsApi.list(),
      contractsApi.list().catch(() => [] as Contract[]),
      tenantsApi.list().catch(() => [] as Tenant[]),
    ]);
    setRooms(r);
    setContracts(c);
    setTenants(t);
    if (!curFloor && r.length > 0) setCurFloor(Math.min(...r.map(x => x.floor)));
  };

  useEffect(() => { load(); }, []);

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const floorRooms = rooms.filter(r => r.floor === curFloor);

  const getContract = (roomId: number) => contracts.find(c => c.room_id === roomId && (c.status === 'active' || c.status === 'expiring'));
  const getTenant = (tenantId: number) => tenants.find(t => t.id === tenantId);

  const selContract = selected ? getContract(selected.id) : null;
  const selTenant = selContract ? getTenant(selContract.tenant_id) : null;

  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const free = rooms.filter(r => r.status === 'free').length;
  const other = rooms.filter(r => r.status === 'reserved' || r.status === 'repair').length;

  const openModal = (m: Modal, room?: Room) => {
    setSuccess('');
    if (room) setSelected(room);
    setModal(m);

    if (m === 'create-room') {
      setRoomForm({ name: '', floor: curFloor ?? 1, area: '', base_rate: '', description: '' });
    }
    if (m === 'edit-room' && room) {
      setRoomForm({ name: room.name, floor: room.floor, area: String(room.area), base_rate: String(room.base_rate), description: room.description || '' });
    }
    if (m === 'status' && room) {
      setStatusForm({ new_status: room.status, reason: '', repair_start: '', repair_end: '' });
    }
    if (m === 'contract' && room) {
      setContractForm({ tenant_id: '', number: '', start_date: '', end_date: '', monthly_rent: String(room.base_rate * room.area || ''), deposit: '' });
    }
    if (m === 'terminate') {
      setTerminateForm({ terminated_at: new Date().toISOString().slice(0, 10), termination_reason: '', termination_initiator: 'Арендатор', penalty: '0' });
    }
    if (m === 'history' && room) {
      setHistory(null);
      setHistoryLoading(true);
      roomsApi.fullHistory(room.id).then(data => {
        setHistory(data);
        setHistoryLoading(false);
      }).catch(() => setHistoryLoading(false));
    }
  };

  const closeModal = () => { setModal(null); setSuccess(''); };

  const saveRoom = async () => {
    setLoading(true);
    try {
      if (modal === 'edit-room' && selected) {
        await roomsApi.update(selected.id, { ...roomForm, area: Number(roomForm.area), base_rate: Number(roomForm.base_rate) });
      } else {
        await roomsApi.create({ ...roomForm, area: Number(roomForm.area), base_rate: Number(roomForm.base_rate), status: 'free' });
      }
      setSuccess('Помещение сохранено');
      await load();
    } catch (e: any) { alert(e.response?.data?.detail || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const changeStatus = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await roomsApi.changeStatus(selected.id, {
        new_status: statusForm.new_status,
        reason: statusForm.reason || undefined,
        repair_start: statusForm.repair_start || undefined,
        repair_end: statusForm.repair_end || undefined,
      });
      setSuccess('Статус изменён');
      setSelected(null);
      await load();
    } catch (e: any) { alert(e.response?.data?.detail || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const createContract = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await contractsApi.create({
        room_id: selected.id,
        tenant_id: Number(contractForm.tenant_id),
        number: contractForm.number,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        monthly_rent: Number(contractForm.monthly_rent),
        deposit: contractForm.deposit ? Number(contractForm.deposit) : undefined,
      });
      setSuccess('Договор создан, помещение переведено в «Занято»');
      setSelected(null);
      await load();
    } catch (e: any) {
      const d = e.response?.data?.detail;
      alert(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join(', ') : 'Ошибка');
    } finally { setLoading(false); }
  };

  const terminate = async () => {
    if (!selContract) return;
    setLoading(true);
    try {
      await contractsApi.terminate(selContract.id, {
        terminated_at: terminateForm.terminated_at,
        termination_reason: terminateForm.termination_reason || undefined,
        termination_initiator: terminateForm.termination_initiator || undefined,
        penalty: Number(terminateForm.penalty) || undefined,
      });
      setSuccess('Договор расторгнут');
      setSelected(null);
      await load();
    } catch (e: any) { alert(e.response?.data?.detail || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const deleteRoom = async (room: Room) => {
    if (!confirm(`Удалить помещение «${room.name}»?`)) return;
    await roomsApi.delete(room.id);
    setSelected(null);
    load();
  };

  return (
    <div>
      <div className="stats-grid stats-grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Свободно сейчас</div><div className="stat-value" style={{ color: '#16A34A' }}>{free}</div><div className="stat-sub">помещений</div></div>
        <div className="stat-card"><div className="stat-label">Занято</div><div className="stat-value" style={{ color: '#1D4ED8' }}>{occupied}</div><div className="stat-sub">помещений</div></div>
        <div className="stat-card"><div className="stat-label">Резерв + ремонт</div><div className="stat-value" style={{ color: '#D97706' }}>{other}</div><div className="stat-sub">помещений</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Планировка этажей</span>
          <button className="btn btn-primary" onClick={() => openModal('create-room')} title="Добавить новое помещение на текущий этаж">
            <i className="ti ti-plus" /> Добавить помещение
          </button>
        </div>

        <div className="floor-tabs">
          {floors.map(f => (
            <button key={f} className={'ftab' + (f === curFloor ? ' active' : '')}
              onClick={() => { setCurFloor(f); setSelected(null); }}>
              {f} этаж
            </button>
          ))}
        </div>

        <div className="floor-legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: '#DBEAFE', border: '2px solid #93C5FD' }} />Занято</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#DCFCE7', border: '2px solid #86EFAC' }} />Свободно</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#FEF3C7', border: '2px solid #FCD34D' }} />Резерв</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#FEE2E2', border: '2px solid #FCA5A5' }} />Ремонт</div>
        </div>

        {floorRooms.length === 0
          ? <div className="empty-state">Нет помещений на этом этаже — добавьте первое</div>
          : (
            <div className="floor-grid">
              {floorRooms.map(room => (
                <div key={room.id}
                  className={`room ${statusClass[room.status] || 's-free'}${selected?.id === room.id ? ' ring' : ''}`}
                  style={selected?.id === room.id ? { outline: '2px solid #2563EB' } : {}}
                  onClick={() => setSelected(selected?.id === room.id ? null : room)}>
                  <div className="room-name">{room.name}</div>
                  <div className="room-area">{room.area} м²</div>
                  <div className="room-status-pill">{statusLabel[room.status]}</div>
                </div>
              ))}
            </div>
          )
        }

        {/* Detail panel */}
        {selected && (
          <div className="detail-panel" style={{ marginTop: 14 }}>
            <div className="detail-top">
              <div>
                <div className="detail-title">{selected.name}</div>
                <div className="detail-sub">Этаж {selected.floor} · {selected.area} м² · {statusLabel[selected.status]}</div>
              </div>
              <button className="close-btn" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="detail-grid">
              <div className="detail-field"><div className="lbl">Арендатор</div><div className="val">{selTenant?.name || '—'}</div></div>
              <div className="detail-field"><div className="lbl">Договор</div><div className="val">{selContract ? `№ ${selContract.number}` : '—'}</div></div>
              <div className="detail-field">
                <div className="lbl">Ставка</div>
                <div className="val">{selContract ? `${selContract.monthly_rent.toLocaleString('ru')} сом/мес` : `${selected.base_rate.toLocaleString('ru')} сом/м²`}</div>
              </div>
              <div className="detail-field"><div className="lbl">Истекает</div><div className="val">{selContract ? new Date(selContract.end_date).toLocaleDateString('ru') : '—'}</div></div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {/* Свободное / Резерв — создать договор */}
              {(selected.status === 'free' || selected.status === 'reserved') && (
                <ActionCard
                  icon="ti-file-plus" iconBg="#DBEAFE" iconColor="#2563EB"
                  title="Создать договор"
                  desc="Оформить аренду и перевести помещение в статус «Занято»"
                  onClick={() => openModal('contract', selected)}
                />
              )}
              {/* Занятое — расторгнуть */}
              {selected.status === 'occupied' && selContract && (
                <ActionCard
                  icon="ti-file-minus" iconBg="#FEE2E2" iconColor="#DC2626"
                  title="Расторгнуть договор"
                  desc="Закрыть договор досрочно, помещение станет «Свободно»"
                  onClick={() => openModal('terminate', selected)}
                  danger
                />
              )}
              {/* Сменить статус */}
              {selected.status !== 'occupied' && (
                <ActionCard
                  icon="ti-refresh" iconBg="#FEF3C7" iconColor="#D97706"
                  title="Сменить статус"
                  desc="Поставить на резерв, ремонт или освободить помещение"
                  onClick={() => openModal('status', selected)}
                />
              )}
              {/* Редактировать */}
              <ActionCard
                icon="ti-edit" iconBg="#F1F5F9" iconColor="#475569"
                title="Редактировать"
                desc="Изменить название, площадь или базовую ставку"
                onClick={() => openModal('edit-room', selected)}
              />
              {/* История */}
              <ActionCard
                icon="ti-history" iconBg="#EDE9FE" iconColor="#7C3AED"
                title="История помещения"
                desc="Все арендаторы, платежи и смены статуса"
                onClick={() => openModal('history', selected)}
              />
              {/* Удалить */}
              {selected.status === 'free' && (
                <ActionCard
                  icon="ti-trash" iconBg="#FEE2E2" iconColor="#DC2626"
                  title="Удалить помещение"
                  desc="Полностью удалить из системы (только свободные)"
                  onClick={() => deleteRoom(selected)}
                  danger
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Создать / Редактировать помещение ── */}
      <div className={`modal-overlay${modal === 'create-room' || modal === 'edit-room' ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">
              <i className="ti ti-building" />{modal === 'edit-room' ? 'Редактировать помещение' : 'Новое помещение'}
            </div>
            <button className="modal-close" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            <div className="mf-section">Основные данные</div>
            <div className="mf-grid mf-2">
              <div className="mf-field" style={{ gridColumn: 'span 2' }}>
                <label>Название помещения</label>
                <input value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} placeholder="Офис 301" />
              </div>
              <div className="mf-field">
                <label>Этаж</label>
                <input type="number" value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: +e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Площадь, м²</label>
                <input type="number" value={roomForm.area} onChange={e => setRoomForm(f => ({ ...f, area: e.target.value }))} placeholder="0" />
              </div>
              <div className="mf-field">
                <label>Базовая ставка, сом/м²</label>
                <input type="number" value={roomForm.base_rate} onChange={e => setRoomForm(f => ({ ...f, base_rate: e.target.value }))} placeholder="0" />
              </div>
              <div className="mf-field">
                <label>Описание</label>
                <input value={roomForm.description} onChange={e => setRoomForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />{success}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={saveRoom} disabled={loading || !!success}>
              <i className="ti ti-check" /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="btn btn-secondary" onClick={closeModal}>Отмена</button>
          </div>
        </div>
      </div>

      {/* ── Modal: Сменить статус ── */}
      <div className={`modal-overlay${modal === 'status' ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="modal" style={{ width: 420 }}>
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-refresh" />Сменить статус — {selected?.name}</div>
            <button className="modal-close" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            <div className="mf-grid">
              <div className="mf-field">
                <label>Новый статус</label>
                <select value={statusForm.new_status} onChange={e => setStatusForm(f => ({ ...f, new_status: e.target.value as RoomStatus }))}>
                  <option value="free">Свободно</option>
                  <option value="reserved">Резерв</option>
                  <option value="repair">Ремонт</option>
                </select>
              </div>
              <div className="mf-field">
                <label>Причина / комментарий</label>
                <input value={statusForm.reason} onChange={e => setStatusForm(f => ({ ...f, reason: e.target.value }))} placeholder="Необязательно" />
              </div>
              {statusForm.new_status === 'repair' && (
                <>
                  <div className="mf-field">
                    <label>Начало ремонта</label>
                    <input type="date" value={statusForm.repair_start} onChange={e => setStatusForm(f => ({ ...f, repair_start: e.target.value }))} />
                  </div>
                  <div className="mf-field">
                    <label>Конец ремонта</label>
                    <input type="date" value={statusForm.repair_end} onChange={e => setStatusForm(f => ({ ...f, repair_end: e.target.value }))} />
                  </div>
                </>
              )}
            </div>
            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />{success}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={changeStatus} disabled={loading || !!success}>
              <i className="ti ti-check" /> {loading ? 'Применяю...' : 'Применить'}
            </button>
            <button className="btn btn-secondary" onClick={closeModal}>Отмена</button>
          </div>
        </div>
      </div>

      {/* ── Modal: Создать договор ── */}
      <div className={`modal-overlay${modal === 'contract' ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-file-plus" />Новый договор — {selected?.name}</div>
            <button className="modal-close" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            <div className="mf-section">Арендатор</div>
            <div className="mf-grid">
              <div className="mf-field">
                <label>Арендатор</label>
                <select value={contractForm.tenant_id} onChange={e => setContractForm(f => ({ ...f, tenant_id: e.target.value }))}>
                  <option value="">— выберите —</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mf-section">Условия</div>
            <div className="mf-grid mf-2">
              <div className="mf-field">
                <label>Номер договора</label>
                <input value={contractForm.number} onChange={e => setContractForm(f => ({ ...f, number: e.target.value }))} placeholder="№ 01/2026" />
              </div>
              <div className="mf-field">
                <label>Ставка (сом/мес)</label>
                <input type="number" value={contractForm.monthly_rent} onChange={e => setContractForm(f => ({ ...f, monthly_rent: e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Дата начала</label>
                <input type="date" value={contractForm.start_date} onChange={e => setContractForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Дата окончания</label>
                <input type="date" value={contractForm.end_date} onChange={e => setContractForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Депозит (сом)</label>
                <input type="number" value={contractForm.deposit} onChange={e => setContractForm(f => ({ ...f, deposit: e.target.value }))} />
              </div>
            </div>
            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />{success}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={createContract} disabled={loading || !!success}>
              <i className="ti ti-check" /> {loading ? 'Создание...' : 'Создать договор'}
            </button>
            <button className="btn btn-secondary" onClick={closeModal}>Отмена</button>
          </div>
        </div>
      </div>

      {/* ── Modal: Расторгнуть договор ── */}
      <div className={`modal-overlay${modal === 'terminate' ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="modal" style={{ width: 480 }}>
          <div className="modal-header">
            <div className="modal-title" style={{ color: '#DC2626' }}><i className="ti ti-file-minus" style={{ color: '#DC2626' }} />Расторжение договора</div>
            <button className="modal-close" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            <div className="warn-banner">
              <i className="ti ti-alert-triangle" style={{ fontSize: 18, flexShrink: 0 }} />
              <div>После сохранения договор будет закрыт, помещение переведено в статус <b>«Свободно»</b>. Действие необратимо.</div>
            </div>
            <div className="mf-section">Договор</div>
            <div className="mf-grid mf-2">
              <div className="mf-field"><label>Помещение</label><input readOnly value={selected?.name || ''} /></div>
              <div className="mf-field"><label>Арендатор</label><input readOnly value={selTenant?.name || ''} /></div>
              <div className="mf-field"><label>Договор</label><input readOnly value={selContract ? `№ ${selContract.number}` : ''} /></div>
              <div className="mf-field"><label>Истекал</label><input readOnly value={selContract ? new Date(selContract.end_date).toLocaleDateString('ru') : ''} /></div>
            </div>
            <div className="mf-section">Условия разрыва</div>
            <div className="mf-grid mf-2">
              <div className="mf-field">
                <label>Дата расторжения</label>
                <input type="date" value={terminateForm.terminated_at} onChange={e => setTerminateForm(f => ({ ...f, terminated_at: e.target.value }))} />
              </div>
              <div className="mf-field">
                <label>Инициатор</label>
                <select value={terminateForm.termination_initiator} onChange={e => setTerminateForm(f => ({ ...f, termination_initiator: e.target.value }))}>
                  <option>Арендатор</option><option>Арендодатель</option><option>По соглашению сторон</option>
                </select>
              </div>
              <div className="mf-field">
                <label>Штраф (сом)</label>
                <input type="number" value={terminateForm.penalty} onChange={e => setTerminateForm(f => ({ ...f, penalty: e.target.value }))} />
              </div>
            </div>
            <div className="mf-field" style={{ marginTop: 4 }}>
              <label>Причина расторжения</label>
              <textarea value={terminateForm.termination_reason} onChange={e => setTerminateForm(f => ({ ...f, termination_reason: e.target.value }))} placeholder="Укажите причину..." />
            </div>
            <div className={`success-banner${success ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />{success}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={terminate} disabled={loading || !!success}>
              <i className="ti ti-check" /> {loading ? 'Расторжение...' : 'Расторгнуть договор'}
            </button>
            <button className="btn btn-secondary" onClick={closeModal}>Отмена</button>
          </div>
        </div>
      </div>

      {/* ── Modal: История помещения ── */}
      <div className={`modal-overlay${modal === 'history' ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="modal" style={{ width: 720 }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="ti ti-history" style={{ color: '#7C3AED' }} />
              История — {history?.room?.name || selected?.name}
            </div>
            <button className="modal-close" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            {historyLoading && (
              <div className="empty-state">Загрузка истории...</div>
            )}

            {history && !historyLoading && (
              <>
                {/* Общая статистика */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Всего договоров', value: history.contracts.length, color: '#2563EB' },
                    { label: 'Арендаторов', value: new Set(history.contracts.map((c: any) => c.tenant.id)).size, color: '#7C3AED' },
                    { label: 'Получено всего', value: `${history.contracts.reduce((s: number, c: any) => s + c.payments_summary.total_paid, 0).toLocaleString('ru')} сом`, color: '#16A34A' },
                    { label: 'Долг', value: `${history.contracts.reduce((s: number, c: any) => s + c.payments_summary.debt, 0).toLocaleString('ru')} сом`, color: '#DC2626' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Договоры */}
                {history.contracts.length === 0 ? (
                  <div className="empty-state">По этому помещению договоров не было</div>
                ) : (
                  history.contracts.map((c: any) => (
                    <div key={c.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
                      {/* Шапка договора */}
                      <div style={{ background: '#F8FAFC', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
                            {c.tenant.name}
                            <span className={`pill ${contractStatusPill[c.status] || 'pill-term'}`} style={{ marginLeft: 8 }}>
                              {contractStatusLabel[c.status] || c.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            Договор № {c.number}
                            {c.tenant.inn && ` · ИНН ${c.tenant.inn}`}
                            {c.tenant.phone && ` · ${c.tenant.phone}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: '#64748B' }}>
                          <div>{c.start_date ? new Date(c.start_date).toLocaleDateString('ru') : '—'} — {c.end_date ? new Date(c.end_date).toLocaleDateString('ru') : '—'}</div>
                          <div style={{ fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{c.monthly_rent?.toLocaleString('ru')} сом/мес</div>
                          {c.termination_reason && <div style={{ color: '#DC2626', marginTop: 2 }}>Причина: {c.termination_reason}</div>}
                        </div>
                      </div>

                      {/* Финансовая сводка */}
                      <div style={{ padding: '10px 16px', display: 'flex', gap: 20, borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Месяцев', value: `${c.payments_summary.paid_months} / ${c.payments_summary.total_months}` },
                          { label: 'Начислено', value: `${c.payments_summary.total_due.toLocaleString('ru')} сом` },
                          { label: 'Оплачено', value: `${c.payments_summary.total_paid.toLocaleString('ru')} сом`, color: '#16A34A' },
                          { label: 'Долг', value: `${c.payments_summary.debt.toLocaleString('ru')} сом`, color: c.payments_summary.debt > 0 ? '#DC2626' : '#16A34A' },
                        ].map(f => (
                          <div key={f.label}>
                            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{f.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: f.color || '#0F172A', marginTop: 1 }}>{f.value}</div>
                          </div>
                        ))}
                        {/* Прогресс */}
                        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div className="prog-track" style={{ height: 6 }}>
                            <div className="prog-fill" style={{
                              width: `${c.payments_summary.total_due > 0 ? Math.round(c.payments_summary.total_paid / c.payments_summary.total_due * 100) : 0}%`,
                              background: c.payments_summary.debt > 0 ? '#EF4444' : '#22C55E'
                            }} />
                          </div>
                        </div>
                      </div>

                      {/* Сетка месяцев */}
                      {c.payments.length > 0 && (
                        <div style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.payments.map((p: any) => {
                              const cfg: Record<string, { bg: string; color: string; icon: string }> = {
                                paid:    { bg: '#DCFCE7', color: '#16A34A', icon: '✓' },
                                partial: { bg: '#FEF3C7', color: '#D97706', icon: '~' },
                                debt:    { bg: '#FEE2E2', color: '#DC2626', icon: '!' },
                                pending: { bg: '#F1F5F9', color: '#94A3B8', icon: '·' },
                              };
                              const s = cfg[p.status] || cfg.pending;
                              return (
                                <div key={p.id} title={`${MONTHS_SHORT[(p.period_month || 1) - 1]} ${p.period_year} · ${p.status === 'paid' ? 'Оплачено' : `Долг ${(p.amount_due - p.amount_paid).toLocaleString('ru')} сом`}`}
                                  style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '3px 6px', fontSize: 10, fontWeight: 700, cursor: 'default' }}>
                                  {MONTHS_SHORT[(p.period_month || 1) - 1]} {p.period_year} {s.icon}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* История смен статуса */}
                {history.status_history.length > 0 && (
                  <>
                    <div className="mf-section" style={{ marginTop: 8 }}>История статусов</div>
                    <div className="timeline">
                      {history.status_history.map((h: any, i: number) => (
                        <div key={i} className="tl-item">
                          <div className="tl-date">{h.changed_at ? new Date(h.changed_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
                          <div className="tl-title">
                            <span className={`pill ${statusClass[h.old_status] === 's-occ' ? 'pill-occ' : statusClass[h.old_status] === 's-free' ? 'pill-free' : statusClass[h.old_status] === 's-res' ? 'pill-res' : 'pill-rep'}`} style={{ marginRight: 6 }}>
                              {statusLabel[h.old_status] || h.old_status}
                            </span>
                            →
                            <span className={`pill ${statusClass[h.new_status] === 's-occ' ? 'pill-occ' : statusClass[h.new_status] === 's-free' ? 'pill-free' : statusClass[h.new_status] === 's-res' ? 'pill-res' : 'pill-rep'}`} style={{ marginLeft: 6 }}>
                              {statusLabel[h.new_status] || h.new_status}
                            </span>
                          </div>
                          {h.reason && <div className="tl-sub">{h.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={closeModal}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon, iconBg, iconColor, title, desc, onClick, danger }: {
  icon: string; iconBg: string; iconColor: string;
  title: string; desc: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
      background: '#fff', border: `1px solid ${danger ? '#FECACA' : '#E2E8F0'}`,
      textAlign: 'left', transition: 'box-shadow .15s, transform .15s',
      minWidth: 200, flex: '1 1 200px', maxWidth: 260,
      fontFamily: 'inherit',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.10)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.transform = ''; }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 9, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 20, color: iconColor }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: danger ? '#DC2626' : '#0F172A', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
}
