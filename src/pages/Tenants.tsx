import { useEffect, useState } from 'react';
import { tenantsApi } from '../api';
import type { Tenant } from '../api';

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', inn: '', contact_person: '', phone: '', email: '', address: '' });

  const load = () => tenantsApi.list(search || undefined).then(setTenants);
  useEffect(() => { load(); }, [search]);

  const openCreate = () => { setEditTenant(null); setForm({ name: '', inn: '', contact_person: '', phone: '', email: '', address: '' }); setShowModal(true); };
  const openEdit = (t: Tenant) => { setEditTenant(t); setForm({ name: t.name, inn: t.inn || '', contact_person: t.contact_person || '', phone: t.phone || '', email: t.email || '', address: t.address || '' }); setShowModal(true); };

  const save = async () => {
    setLoading(true);
    try {
      if (editTenant) await tenantsApi.update(editTenant.id, form);
      else await tenantsApi.create(form);
      setShowModal(false);
      load();
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
        <div className="stat-card"><div className="stat-label">Всего арендаторов</div><div className="stat-value">{total}</div><div className="stat-sub">компаний и ИП</div></div>
        <div className="stat-card"><div className="stat-label">Юридических лиц</div><div className="stat-value" style={{ color: '#1D4ED8' }}>{tenants.filter(t => !t.name.startsWith('ИП')).length}</div><div className="stat-sub">ООО, АО, ПАО</div></div>
        <div className="stat-card"><div className="stat-label">Индивидуальных</div><div className="stat-value" style={{ color: '#D97706' }}>{tenants.filter(t => t.name.startsWith('ИП')).length}</div><div className="stat-sub">предпринимателей</div></div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input type="text" placeholder="🔍  Поиск по названию, ИНН, контакту..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={openCreate}><i className="ti ti-plus" /> Добавить</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Арендатор</th><th>ИНН</th><th>Контактное лицо</th><th>Телефон</th><th>Email</th><th></th></tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    {t.inn && <div style={{ fontSize: 11, color: '#94A3B8' }}>ИНН {t.inn}</div>}
                  </td>
                  <td>{t.inn || '—'}</td>
                  <td>{t.contact_person || '—'}</td>
                  <td>{t.phone || '—'}</td>
                  <td>{t.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(t)} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}><i className="ti ti-edit" /> Изменить</button>
                      <button onClick={() => del(t.id)} className="btn" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 11, padding: '3px 10px' }}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && <tr><td colSpan={6} className="empty-state">Арендаторы не найдены</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal-overlay${showModal ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-users" />{editTenant ? 'Редактировать арендатора' : 'Новый арендатор'}</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="mf-section">Реквизиты</div>
            <div className="mf-grid mf-2">
              <div className="mf-field" style={{ gridColumn: 'span 2' }}><label>Наименование *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="mf-field"><label>ИНН</label><input value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))} /></div>
              <div className="mf-field"><label>Контактное лицо</label><input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
              <div className="mf-field"><label>Телефон</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="mf-field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="mf-field" style={{ gridColumn: 'span 2' }}><label>Адрес</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={save} disabled={loading}><i className="ti ti-check" /> {loading ? 'Сохранение...' : 'Сохранить'}</button>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}
