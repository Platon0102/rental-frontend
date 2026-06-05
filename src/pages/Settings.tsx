import { useState } from 'react';

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: 'Бизнес-центр «Золотой»',
    email: 'admin@zolotoy-bc.ru',
    notify30: true,
    notify60: true,
    notify90: true,
  });

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">Настройки системы</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Название объекта</div>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email для уведомлений</div>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Уведомлять об истечении договора за</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {([30, 60, 90] as const).map(days => (
                <label key={days} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form[`notify${days}` as keyof typeof form] as boolean}
                    onChange={e => setForm(f => ({ ...f, [`notify${days}`]: e.target.checked }))}
                  />
                  {days} дней
                </label>
              ))}
            </div>
          </div>
          <div>
            <button className="btn btn-primary" onClick={save}><i className="ti ti-check" /> Сохранить настройки</button>
            {saved && <span style={{ marginLeft: 12, fontSize: 13, color: '#16A34A', fontWeight: 500 }}>✓ Сохранено</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">О системе</span></div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7 }}>
          <div><b>Версия:</b> MVP 1.0</div>
          <div><b>Бэкенд:</b> FastAPI + PostgreSQL</div>
          <div><b>Фронтенд:</b> React + Vite</div>
          <div style={{ marginTop: 8 }}>Система учёта аренды для бизнес-центров.</div>
        </div>
      </div>
    </div>
  );
}
