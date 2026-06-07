import { useEffect, useState, useRef } from 'react';
import { contractsApi, tenantsApi, roomsApi } from '../api';
import type { Contract, ContractStatus, Tenant, Room } from '../api';

const statusPill: Record<string, string> = {
  active: 'pill-act',
  expiring: 'pill-soon',
  terminated: 'pill-term',
  expired: 'pill-exp',
};
const statusLabel: Record<string, string> = {
  active: 'Активный',
  expiring: 'Скоро истекает',
  terminated: 'Расторгнут',
  expired: 'Истёк',
};

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filterStatus, setFilterStatus] = useState<ContractStatus | ''>('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showTerminate, setShowTerminate] = useState<Contract | null>(null);
  const [showUpload, setShowUpload] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(false);
  const [successCreate, setSuccessCreate] = useState(false);
  const [successTerminate, setSuccessTerminate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const now = new Date().toISOString().slice(0, 10);
  const [cf, setCf] = useState({ room_id: '', tenant_id: '', number: '', start_date: '', end_date: '', monthly_rent: '', deposit: '' });
  const [tf, setTf] = useState({ terminated_at: now, termination_reason: '', termination_initiator: 'Арендатор', penalty: '0' });

  const load = () => contractsApi.list({ status: filterStatus || undefined }).then(setContracts);

  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => { tenantsApi.list().then(setTenants); roomsApi.list().then(setRooms); }, []);

  const tenantName = (id: number) => tenants.find(t => t.id === id)?.name ?? `#${id}`;
  const roomName = (id: number) => rooms.find(r => r.id === id)?.name ?? `#${id}`;

  const filtered = contracts.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.number.toLowerCase().includes(s) || tenantName(c.tenant_id).toLowerCase().includes(s) || roomName(c.room_id).toLowerCase().includes(s);
  });

  const active = contracts.filter(c => c.status === 'active').length;
  const expiring = contracts.filter(c => c.status === 'expiring').length;
  const reserved = rooms.filter(r => r.status === 'reserved').length;

  const createContract = async () => {
    setLoading(true);
    try {
      await contractsApi.create({
        room_id: Number(cf.room_id), tenant_id: Number(cf.tenant_id),
        number: cf.number, start_date: cf.start_date, end_date: cf.end_date,
        monthly_rent: Number(cf.monthly_rent), deposit: Number(cf.deposit),
      });
      setSuccessCreate(true);
      load();
      setTimeout(() => closeModal('create'), 1500);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : JSON.stringify(detail) || 'Ошибка при создании договора');
    } finally { setLoading(false); }
  };

  const terminate = async () => {
    if (!showTerminate) return;
    setLoading(true);
    try {
      await contractsApi.terminate(showTerminate.id, {
        terminated_at: tf.terminated_at,
        termination_reason: tf.termination_reason || undefined,
        termination_initiator: tf.termination_initiator || undefined,
        penalty: tf.penalty ? Number(tf.penalty) : undefined,
      });
      setSuccessTerminate(true);
      load();
      setTimeout(() => closeModal('terminate'), 1500);
    } catch (e: any) { alert(e.response?.data?.detail || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const upload = async () => {
    if (!showUpload || !uploadFile) return;
    setLoading(true);
    try {
      await contractsApi.upload(showUpload.id, uploadFile);
      closeModal('upload');
      load();
    } finally { setLoading(false); }
  };

  const closeModal = (which: string) => {
    if (which === 'create') { setShowCreate(false); setSuccessCreate(false); setCf({ room_id: '', tenant_id: '', number: '', start_date: '', end_date: '', monthly_rent: '', deposit: '' }); }
    if (which === 'terminate') { setShowTerminate(null); setSuccessTerminate(false); }
    if (which === 'upload') { setShowUpload(null); setUploadFile(null); }
  };

  const openTerminate = (c: Contract) => {
    setShowTerminate(c);
    setTf({ terminated_at: now, termination_reason: '', termination_initiator: 'Арендатор', penalty: '0' });
    setSuccessTerminate(false);
  };

  return (
    <div>
      <div className="stats-grid stats-grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Активных</div><div className="stat-value" style={{ color: '#1D4ED8' }}>{active}</div><div className="stat-sub">договоров</div></div>
        <div className="stat-card"><div className="stat-label">Истекают (90 дней)</div><div className="stat-value" style={{ color: '#D97706' }}>{expiring}</div><div className="stat-sub">требуют продления</div></div>
        <div className="stat-card"><div className="stat-label">На резерве</div><div className="stat-value" style={{ color: '#92400E' }}>{reserved}</div><div className="stat-sub">помещений</div></div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input type="text" placeholder="🔍  Поиск по договору, арендатору..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="">Все статусы</option>
            <option value="active">Активный</option>
            <option value="expiring">Истекает</option>
            <option value="terminated">Расторгнут</option>
            <option value="expired">Истёк</option>
          </select>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setSuccessCreate(false); }}>
            <i className="ti ti-plus" /> Новый договор
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№ договора</th><th>Арендатор</th><th>Помещение</th><th>Ставка</th>
                <th>Дата начала</th><th>Дата окончания</th><th>Статус</th><th>Файл</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="link-text">№ {c.number}</td>
                  <td style={{ fontWeight: 500 }}>{tenantName(c.tenant_id)}</td>
                  <td>{roomName(c.room_id)}</td>
                  <td>{c.monthly_rent.toLocaleString('ru')} сом</td>
                  <td>{new Date(c.start_date).toLocaleDateString('ru')}</td>
                  <td>{new Date(c.end_date).toLocaleDateString('ru')}</td>
                  <td><span className={`pill ${statusPill[c.status] || 'pill-act'}`}>{statusLabel[c.status]}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {c.file_name && (
                        <a
                          href={`http://localhost:8000/uploads/contract_${c.id}_${encodeURIComponent(c.file_name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 10px', color: '#2563EB', borderColor: '#BFDBFE', background: '#EFF6FF' }}
                          title={c.file_name}
                        >
                          <i className="ti ti-file-download" /> Открыть
                        </a>
                      )}
                      <button onClick={() => setShowUpload(c)} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}>
                        <i className="ti ti-upload" /> {c.file_name ? 'Заменить' : 'Прикрепить'}
                      </button>
                    </div>
                  </td>
                  <td>
                    {(c.status === 'active' || c.status === 'expiring') && (
                      <button onClick={() => openTerminate(c)} className="btn" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 11, padding: '4px 10px' }}>
                        Расторгнуть
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="empty-state">Договоры не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      <div className={`modal-overlay${showCreate ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && closeModal('create')}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-file-plus" />Новый договор аренды</div>
            <button className="modal-close" onClick={() => closeModal('create')}>×</button>
          </div>
          <div className="modal-body">
            <div className="mf-section">Помещение и арендатор</div>
            <div className="mf-grid mf-2">
              <div className="mf-field">
                <label>Помещение</label>
                <select value={cf.room_id} onChange={e => setCf(f => ({ ...f, room_id: e.target.value }))}>
                  <option value="">— выберите —</option>
                  {rooms.filter(r => r.status !== 'occupied').map(r => <option key={r.id} value={r.id}>{r.name} · {r.area} м²</option>)}
                </select>
              </div>
              <div className="mf-field">
                <label>Арендатор</label>
                <select value={cf.tenant_id} onChange={e => setCf(f => ({ ...f, tenant_id: e.target.value }))}>
                  <option value="">— выберите —</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mf-section">Условия</div>
            <div className="mf-grid mf-2">
              <div className="mf-field"><label>Номер договора</label><input value={cf.number} onChange={e => setCf(f => ({ ...f, number: e.target.value }))} /></div>
              <div className="mf-field"><label>Ставка (сом/мес)</label><input type="number" value={cf.monthly_rent} onChange={e => setCf(f => ({ ...f, monthly_rent: e.target.value }))} /></div>
              <div className="mf-field"><label>Дата начала</label><input type="date" value={cf.start_date} onChange={e => setCf(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="mf-field"><label>Дата окончания</label><input type="date" value={cf.end_date} onChange={e => setCf(f => ({ ...f, end_date: e.target.value }))} /></div>
              <div className="mf-field"><label>Депозит (сом)</label><input type="number" value={cf.deposit} onChange={e => setCf(f => ({ ...f, deposit: e.target.value }))} /></div>
            </div>
            <div className={`success-banner${successCreate ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />Договор добавлен успешно</div>
              <div style={{ fontSize: 12, color: '#16A34A' }}>Договор № {cf.number} создан. Помещение переведено в статус «Занято».</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={createContract} disabled={loading || successCreate}>
              <i className="ti ti-check" /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="btn btn-secondary" onClick={() => closeModal('create')}>Отмена</button>
          </div>
        </div>
      </div>

      {/* Terminate modal */}
      <div className={`modal-overlay${showTerminate ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && closeModal('terminate')}>
        <div className="modal" style={{ width: 480 }}>
          <div className="modal-header">
            <div className="modal-title" style={{ color: '#DC2626' }}><i className="ti ti-file-minus" style={{ color: '#DC2626' }} />Расторжение договора</div>
            <button className="modal-close" onClick={() => closeModal('terminate')}>×</button>
          </div>
          <div className="modal-body">
            <div className="warn-banner">
              <i className="ti ti-alert-triangle" style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }} />
              <div>После сохранения договор будет закрыт, помещение переведено в статус <b>«Свободно»</b>. Действие необратимо.</div>
            </div>
            <div className="mf-section">Договор</div>
            <div className="mf-grid mf-2">
              <div className="mf-field"><label>Помещение</label><input readOnly value={showTerminate ? roomName(showTerminate.room_id) : ''} /></div>
              <div className="mf-field"><label>Арендатор</label><input readOnly value={showTerminate ? tenantName(showTerminate.tenant_id) : ''} /></div>
              <div className="mf-field"><label>Договор</label><input readOnly value={showTerminate ? `№ ${showTerminate.number}` : ''} /></div>
              <div className="mf-field"><label>Истекал</label><input readOnly value={showTerminate ? new Date(showTerminate.end_date).toLocaleDateString('ru') : ''} /></div>
            </div>
            <div className="mf-section">Условия разрыва</div>
            <div className="mf-grid mf-2">
              <div className="mf-field"><label>Дата расторжения</label><input type="date" value={tf.terminated_at} onChange={e => setTf(f => ({ ...f, terminated_at: e.target.value }))} /></div>
              <div className="mf-field">
                <label>Инициатор</label>
                <select value={tf.termination_initiator} onChange={e => setTf(f => ({ ...f, termination_initiator: e.target.value }))}>
                  <option>Арендатор</option><option>Арендодатель</option><option>По соглашению сторон</option>
                </select>
              </div>
              <div className="mf-field"><label>Штраф (сом)</label><input type="number" value={tf.penalty} onChange={e => setTf(f => ({ ...f, penalty: e.target.value }))} /></div>
            </div>
            <div className="mf-field" style={{ marginTop: 4 }}>
              <label>Причина расторжения</label>
              <textarea value={tf.termination_reason} onChange={e => setTf(f => ({ ...f, termination_reason: e.target.value }))} placeholder="Укажите причину..." />
            </div>
            <div className={`success-banner${successTerminate ? ' show' : ''}`}>
              <div className="success-title"><i className="ti ti-circle-check" style={{ fontSize: 20 }} />Договор расторгнут</div>
              <div style={{ fontSize: 12, color: '#16A34A' }}>Помещение переведено в статус «Свободно».</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={terminate} disabled={loading || successTerminate}>
              <i className="ti ti-check" /> {loading ? 'Расторжение...' : 'Расторгнуть договор'}
            </button>
            <button className="btn btn-secondary" onClick={() => closeModal('terminate')}>Отмена</button>
          </div>
        </div>
      </div>

      {/* Upload modal */}
      <div className={`modal-overlay${showUpload ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && closeModal('upload')}>
        <div className="modal" style={{ width: 420 }}>
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-upload" />Файл договора</div>
            <button className="modal-close" onClick={() => closeModal('upload')}>×</button>
          </div>
          <div className="modal-body">
            {showUpload?.file_name && (
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Текущий файл: <b>{showUpload.file_name}</b></p>
            )}
            <div
              style={{ border: '2px dashed #CBD5E1', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => fileRef.current?.click()}
            >
              <i className="ti ti-upload" style={{ fontSize: 28, color: '#94A3B8', display: 'block', marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                {uploadFile ? uploadFile.name : 'Прикрепить файл договора'}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>PDF, JPG, PNG — до 20 МБ</div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={upload} disabled={!uploadFile || loading}>
              <i className="ti ti-check" /> {loading ? 'Загрузка...' : 'Прикрепить'}
            </button>
            <button className="btn btn-secondary" onClick={() => closeModal('upload')}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}
