import { useEffect, useState } from 'react';
import api from '../api';
import { useRole } from '../auth';

interface BC {
  id: number;
  name: string;
  address?: string;
  is_active: boolean;
}

interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  business_center_id?: number;
  is_active: boolean;
}

const EMPTY_BC = { name: '', address: '' };
const EMPTY_USER = { email: '', password: '', full_name: '' };

export default function BusinessCenters() {
  const { isSuperadmin } = useRole();
  const [bcs, setBcs] = useState<BC[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // BC modal
  const [showBcModal, setShowBcModal] = useState(false);
  const [bcForm, setBcForm] = useState({ ...EMPTY_BC });
  const [bcSaving, setBcSaving] = useState(false);
  const [bcError, setBcError] = useState('');

  // Admin modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedBcId, setSelectedBcId] = useState<number | null>(null);
  const [adminForm, setAdminForm] = useState({ ...EMPTY_USER });
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<BC[]>('/business-centers/'),
      api.get<User[]>('/auth/users'),
    ]).then(([bcRes, usersRes]) => {
      setBcs(bcRes.data);
      setUsers(usersRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (!isSuperadmin) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 14, color: '#64748B' }}>Только суперадмин может управлять бизнес-центрами.</div>
      </div>
    );
  }

  async function createBC(e: React.FormEvent) {
    e.preventDefault();
    setBcSaving(true);
    setBcError('');
    try {
      await api.post('/business-centers/', bcForm);
      setShowBcModal(false);
      setBcForm({ ...EMPTY_BC });
      load();
    } catch (e: any) {
      setBcError(e.response?.data?.detail || 'Ошибка');
    } finally {
      setBcSaving(false);
    }
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBcId) return;
    setAdminSaving(true);
    setAdminError('');
    setAdminSuccess('');
    try {
      await api.post('/auth/register', {
        ...adminForm,
        role: 'bc_admin',
        business_center_id: selectedBcId,
      });
      const bcName = bcs.find(b => b.id === selectedBcId)?.name || '';
      setAdminSuccess(`Администратор создан для «${bcName}»`);
      setAdminForm({ ...EMPTY_USER });
      setShowAdminModal(false);
      load();
      setTimeout(() => setAdminSuccess(''), 4000);
    } catch (e: any) {
      setAdminError(e.response?.data?.detail || 'Ошибка');
    } finally {
      setAdminSaving(false);
    }
  }

  const adminsOf = (bcId: number) =>
    users.filter(u => u.business_center_id === bcId && u.role === 'bc_admin');

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Бизнес-центры</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Управление клиентами системы</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowBcModal(true); setBcError(''); setBcForm({ ...EMPTY_BC }); }}>
          <i className="ti ti-plus" /> Новый БЦ
        </button>
      </div>

      {adminSuccess && (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#16A34A', marginBottom: 16 }}>
          ✅ {adminSuccess}
        </div>
      )}

      {/* Инструкция */}
      <div className="card" style={{ marginBottom: 16, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>
          <b>Как подключить нового клиента:</b><br />
          1. Нажми <b>«Новый БЦ»</b> — введи название и адрес<br />
          2. Нажми <b>«Добавить администратора»</b> рядом с БЦ — создай аккаунт для клиента<br />
          3. Передай клиенту логин и пароль — он войдёт и сам создаст менеджеров/бухгалтеров
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Загрузка...</div>
      ) : bcs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
          <i className="ti ti-building" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
          Нет бизнес-центров. Создайте первый.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bcs.map(bc => (
            <div key={bc.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{bc.name}</div>
                    <span className={`pill ${bc.is_active ? 'pill-paid' : 'pill-exp'}`}>
                      {bc.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>ID: {bc.id}</span>
                  </div>
                  {bc.address && (
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                      <i className="ti ti-map-pin" style={{ marginRight: 4 }} />{bc.address}
                    </div>
                  )}

                  {/* Список администраторов */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Администраторы БЦ:
                  </div>
                  {adminsOf(bc.id).length === 0 ? (
                    <div style={{ fontSize: 12, color: '#F59E0B', fontStyle: 'italic' }}>
                      ⚠ Нет администратора — клиент не может войти
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {adminsOf(bc.id).map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                            {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500, color: '#1E293B' }}>{u.full_name || '—'}</span>
                          <span style={{ color: '#94A3B8' }}>{u.email}</span>
                          <span className={`pill ${u.is_active ? 'pill-paid' : 'pill-exp'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                            {u.is_active ? 'Активен' : 'Деактивирован'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ flexShrink: 0 }}
                  onClick={() => { setSelectedBcId(bc.id); setAdminForm({ ...EMPTY_USER }); setAdminError(''); setShowAdminModal(true); }}
                >
                  <i className="ti ti-user-plus" /> Добавить администратора
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модал: новый БЦ */}
      {showBcModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, padding: '28px 28px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Новый бизнес-центр</div>
            <form onSubmit={createBC} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Название *</label>
                <input className="input" style={{ width: '100%' }} placeholder='Например: БЦ «Астана»' required
                  value={bcForm.name} onChange={e => setBcForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Адрес</label>
                <input className="input" style={{ width: '100%' }} placeholder="г. Бишкек, ул. Манаса 40"
                  value={bcForm.address} onChange={e => setBcForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              {bcError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>{bcError}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={bcSaving}>{bcSaving ? 'Создание...' : 'Создать'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBcModal(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал: добавить администратора */}
      {showAdminModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, padding: '28px 28px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Администратор БЦ</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>
              БЦ: <b>{bcs.find(b => b.id === selectedBcId)?.name}</b>
            </div>
            <form onSubmit={createAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Имя</label>
                <input className="input" style={{ width: '100%' }} placeholder="Иван Иванов"
                  value={adminForm.full_name} onChange={e => setAdminForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Email *</label>
                <input className="input" style={{ width: '100%' }} type="email" placeholder="admin@bc-name.kg" required
                  value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Пароль *</label>
                <input className="input" style={{ width: '100%' }} type="password" placeholder="Минимум 6 символов" required minLength={6}
                  value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {adminError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>{adminError}</div>
              )}
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                После создания передайте клиенту email и пароль. Он войдёт и сам создаст сотрудников.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={adminSaving}>{adminSaving ? 'Создание...' : 'Создать'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdminModal(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
