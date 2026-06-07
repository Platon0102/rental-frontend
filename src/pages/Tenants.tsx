import { useEffect, useState } from 'react';
import { tenantsApi } from '../api';
import type { Tenant } from '../api';

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', inn: '', contact_name: '', phone: '', email: '', address: '', notes: '' });

  const load = () => tenantsApi.list(search || undefined).then(setTenants);
  useEffect(() => { load(); }, [search]);

  const openCreate = () => {
    setEditTenant(null);
    setForm({ name: '', inn: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setEditTenant(t);
    setForm({
      name: t.name,
      inn: t.inn || '',
      contact_name: t.contact_name || '',
      phone: t.phone || '',
      email: t.email || '',
      address: t.address || '',
      notes: t.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert('Укажите наименование'); return; }
    setLoading(true);
    try {
      const data = {
        name: form.name,
        inn: form.inn || undefined,
        contact_name: form.contact_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
      };
      if (editTenant) await tenantsApi.update(editTenant.id, data);
      else await tenantsApi.create(data);
      load();
      setTimeout(() => setShowModal(false), 800);
    } catch (e: any) {
      console.error('Tenants save error:', e);
      const status = e.response?.status;
      const d = e.response?.data?.detail;
      if (typeof d === 'string') alert(d);
      else if (Array.isArray(d)) alert(d.map((x: any) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join('\n'));
      else if (status === 500) alert('Ошибка сервера — возможно ИНН уже используется другим арендатором');
      else if (!e.response) alert(`Нет ответа от сервера. Проверьте что бэкенд запущен на http://localhost:8000\n\nОшибка: ${e.message}`);
      else alert(`Ошибка ${status}: ${JSON.stringify(e.response.data)}`);
    } finally { setLoading(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Удалить арендатора?')) return;
    await tenantsApi.delete(id);
    load();
  };

  const total = tenants.length;

  return (
    <div>
      <div className="stats-grid stats-grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Всего арендаторов</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">компаний и ИП</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Юридических лиц</div>
          <div className="stat-value" style={{ color: '#1D4ED8' }}>
            {tenants.filter(t => !t.name.startsWith('ИП')).length}
          </div>
          <div className="stat-sub">ООО, АО, ПАО</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Индивидуальных</div>
          <div className="stat-value" style={{ color: '#D97706' }}>
            {tenants.filter(t => t.name.startsWith('ИП')).length}
          </div>
          <div className="stat-sub">предпринимателей</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="🔍  Поиск по названию, ИНН, контакту..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={openCreate}>
            <i className="ti ti-plus" /> Добавить
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Арендатор</th>
                <th>ИНН</th>
                <th>Контактное лицо</th>
                <th>Телефон</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    {t.inn && <div style={{ fontSize: 11, color: '#94A3B8' }}>ИНН {t.inn}</div>}
                  </td>
                  <td>{t.inn || '—'}</td>
                  <td>{t.contact_name || '—'}</td>
                  <td>{t.phone || '—'}</td>
                  <td>{t.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(t)} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}>
                        <i className="ti ti-edit" /> Изменить
                      </button>
                      <button onClick={() => del(t.id)} className="btn" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 11, padding: '3px 10px' }}>
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={6} className="empty-state">Арендаторы не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal-overlay${showModal ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">
              <i className="ti ti-users" />
              {editTenant ? 'Редактировать арендатора' : 'Новый арендатор'}
            </div>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="mf-section">Реквизиты</div>
            <div className="mf-grid mf-2">
              <div className="mf-field" style={{ gridColumn: 'span 2' }}>
                <label>Наименование *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ООО «Название» или ИП Фамилия И.О."
                />
              </div>
              <div className="mf-field">
                <label>ИНН</label>
                <input value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))} placeholder="000000000000" />
              </div>
              <div className="mf-field">
                <label>Контактное лицо</label>
                <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Иванов Иван Иванович" />
              </div>
              <div className="mf-field">
                <label>Телефон</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+996 700 000 000" />
              </div>
              <div className="mf-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="mail@company.com" />
              </div>
              <div className="mf-field" style={{ gridColumn: 'span 2' }}>
                <label>Адрес</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="г. Бишкек, ул. ..." />
              </div>
              <div className="mf-field" style={{ gridColumn: 'span 2' }}>
                <label>Примечание</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Дополнительная информация..." />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              <i className="ti ti-check" /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}
