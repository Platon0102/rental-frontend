import { useEffect, useState } from 'react';
import api from '../api';
import { useRole } from '../auth';

interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  business_center_id?: number;
  is_active: boolean;
}

const roleLabel: Record<string, string> = {
  superadmin: 'Суперадмин',
  bc_admin: 'Администратор БЦ',
  manager: 'Менеджер',
  accountant: 'Бухгалтер',
};

const rolePill: Record<string, string> = {
  superadmin: 'pill-act',
  bc_admin: 'pill-paid',
  manager: 'pill-soon',
  accountant: 'pill-term',
};

const EMPTY = { email: '', password: '', full_name: '', role: 'manager', business_center_id: '' };

export default function Users() {
  const { isAdmin, isSuperadmin } = useRole();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    api.get<User[]>('/auth/users').then(r => setUsers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        email: form.email,
        password: form.password,
        full_name: form.full_name || undefined,
        role: form.role,
      };
      if (isSuperadmin && form.business_center_id) {
        payload.business_center_id = Number(form.business_center_id);
      }
      await api.post('/auth/register', payload);
      setSuccess('Пользователь создан');
      setShowModal(false);
      setForm({ ...EMPTY });
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: number) {
    if (!confirm('Деактивировать пользователя?')) return;
    await api.patch(`/auth/users/${id}/deactivate`);
    load();
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 14, color: '#64748B' }}>Недостаточно прав для просмотра пользователей.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Пользователи системы</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Управление доступом сотрудников</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(''); setForm({ ...EMPTY }); }}>
          <i className="ti ti-plus" /> Добавить пользователя
        </button>
      </div>

      {success && (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#16A34A', marginBottom: 16 }}>
          ✅ {success}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Загрузка...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Нет пользователей</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Пользователь</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Роль</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Статус</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{u.full_name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`pill ${rolePill[u.role] || 'pill-term'}`}>{roleLabel[u.role] || u.role}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`pill ${u.is_active ? 'pill-paid' : 'pill-exp'}`}>
                      {u.is_active ? 'Активен' : 'Деактивирован'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {u.is_active && u.role !== 'superadmin' && (
                      <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => deactivate(u.id)}>
                        <i className="ti ti-user-off" /> Деактивировать
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Блок ролей */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><span className="card-title">Права доступа по ролям</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Действие</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>Суперадмин</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>Админ БЦ</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>Менеджер</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>Бухгалтер</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Просмотр помещений/арендаторов', true, true, true, true],
              ['Создание помещений', true, true, false, false],
              ['Управление арендаторами', true, true, true, false],
              ['Создание договоров', true, true, true, false],
              ['Расторжение договоров', true, true, true, false],
              ['Регистрация платежей', true, true, true, true],
              ['Управление пользователями', true, true, false, false],
              ['Все БЦ системы', true, false, false, false],
            ].map(([label, ...perms]) => (
              <tr key={label as string} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '8px 12px', color: '#0F172A' }}>{label}</td>
                {(perms as boolean[]).map((p, i) => (
                  <td key={i} style={{ padding: '8px 12px', textAlign: 'center' }}>
                    {p ? <i className="ti ti-check" style={{ color: '#16A34A', fontSize: 16 }} /> : <i className="ti ti-x" style={{ color: '#CBD5E1', fontSize: 16 }} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модал создания */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, padding: '28px 28px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Новый пользователь</div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Имя</label>
                <input className="input" style={{ width: '100%' }} placeholder="Иван Иванов"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Email *</label>
                <input className="input" style={{ width: '100%' }} type="email" placeholder="user@bc.kg" required
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Пароль *</label>
                <input className="input" style={{ width: '100%' }} type="password" placeholder="Минимум 6 символов" required minLength={6}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Роль *</label>
                <select className="input" style={{ width: '100%' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {!isSuperadmin && <option value="bc_admin">Администратор БЦ</option>}
                  <option value="manager">Менеджер</option>
                  <option value="accountant">Бухгалтер</option>
                  {isSuperadmin && <option value="bc_admin">Администратор БЦ</option>}
                  {isSuperadmin && <option value="superadmin">Суперадмин</option>}
                </select>
              </div>
              {isSuperadmin && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>ID бизнес-центра</label>
                  <input className="input" style={{ width: '100%' }} type="number" placeholder="1"
                    value={form.business_center_id} onChange={e => setForm(f => ({ ...f, business_center_id: e.target.value }))} />
                </div>
              )}
              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Создание...' : 'Создать'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
