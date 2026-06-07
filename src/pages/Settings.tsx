import { useEffect, useState } from 'react';
import api from '../api';

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: 'Бизнес-центр «Золотой»',
    notify30: true, notify60: true, notify90: true,
  });

  // Telegram
  const [tgStatus, setTgStatus] = useState<{ token_set: boolean; chat_id: string; connected: boolean } | null>(null);
  const [chatIdInput, setChatIdInput] = useState('');
  const [editingChatId, setEditingChatId] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgMsg, setTgMsg] = useState('');
  const [tgError, setTgError] = useState('');
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsResult, setAlertsResult] = useState<any>(null);

  const loadStatus = async () => {
    try {
      const r = await api.get('/notifications/telegram/status');
      setTgStatus(r.data);
      if (r.data.chat_id) setChatIdInput(r.data.chat_id);
    } catch {}
  };

  useEffect(() => { loadStatus(); }, []);

  const saveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const detectChatId = async () => {
    setTgLoading(true);
    setTgError('');
    setTgMsg('');
    try {
      const r = await api.post('/notifications/telegram/detect-chat');
      setChatIdInput(r.data.chat_id);
      setTgMsg(`✅ Chat ID определён: ${r.data.chat_id}`);
      await loadStatus();
    } catch (e: any) {
      setTgError(e.response?.data?.detail || 'Ошибка');
    } finally { setTgLoading(false); }
  };

  const saveChatId = async () => {
    if (!chatIdInput.trim()) return;
    setTgLoading(true);
    setTgError('');
    try {
      await api.post('/notifications/telegram/save-chat', { chat_id: chatIdInput.trim() });
      setTgMsg('✅ Chat ID сохранён');
      setEditingChatId(false);
      await loadStatus();
    } catch (e: any) {
      setTgError(e.response?.data?.detail || 'Ошибка');
    } finally { setTgLoading(false); }
  };

  const sendTest = async () => {
    setTgLoading(true);
    setTgError('');
    setTgMsg('');
    try {
      await api.post('/notifications/telegram/test');
      setTgMsg('✅ Тестовое сообщение отправлено! Проверьте Telegram.');
    } catch (e: any) {
      setTgError(e.response?.data?.detail || 'Ошибка отправки');
    } finally { setTgLoading(false); }
  };

  const sendAlerts = async () => {
    setAlertsLoading(true);
    setAlertsResult(null);
    try {
      const r = await api.post('/notifications/telegram/send-alerts');
      setAlertsResult(r.data);
    } catch (e: any) {
      setTgError(e.response?.data?.detail || 'Ошибка');
    } finally { setAlertsLoading(false); }
  };

  return (
    <div>
      {/* Основные настройки */}
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">Настройки системы</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Название объекта</div>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Уведомлять об истечении договора за</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {([30, 60, 90] as const).map(days => (
                <label key={days} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[`notify${days}` as keyof typeof form] as boolean}
                    onChange={e => setForm(f => ({ ...f, [`notify${days}`]: e.target.checked }))} />
                  {days} дней
                </label>
              ))}
            </div>
          </div>
          <div>
            <button className="btn btn-primary" onClick={saveSettings}><i className="ti ti-check" /> Сохранить</button>
            {saved && <span style={{ marginLeft: 12, fontSize: 13, color: '#16A34A', fontWeight: 500 }}>✓ Сохранено</span>}
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header">
          <span className="card-title">
            <span style={{ fontSize: 18, marginRight: 8 }}>✈️</span>Telegram-уведомления
          </span>
          {tgStatus?.connected && (
            <span className="pill pill-paid"><i className="ti ti-check" /> Подключён</span>
          )}
        </div>

        {/* Шаги подключения */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Шаг 1 */}
          <Step n={1} title="Откройте бота и напишите /start" done={tgStatus?.connected}>
            <a href="https://t.me/rentlinebot" target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#2563EB', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <i className="ti ti-brand-telegram" style={{ fontSize: 18 }} /> Открыть @rentlinebot в Telegram
            </a>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
              После открытия нажмите кнопку <b>«Старт»</b> или напишите <code style={{ background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>/start</code>
            </div>
          </Step>

          {/* Шаг 2 */}
          <Step n={2} title="Подключите ваш аккаунт" done={tgStatus?.connected}>
            {tgStatus?.connected && !editingChatId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 16, marginRight: 4 }} />
                  Подключён · Chat ID: <b>{tgStatus.chat_id}</b>
                </div>
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => { setEditingChatId(true); setChatIdInput(''); }}>
                  <i className="ti ti-edit" /> Изменить Chat ID
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                  После того как написали <b>/start</b> боту — нажмите кнопку ниже, и система автоматически найдёт ваш аккаунт:
                </div>
                <button className="btn btn-primary" onClick={detectChatId} disabled={tgLoading} style={{ marginBottom: 12 }}>
                  <i className="ti ti-scan" /> {tgLoading ? 'Ищем...' : 'Я написал /start — подключить'}
                </button>
                <div style={{ fontSize: 12, color: '#94A3B8', borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 4 }}>
                  Не работает автоматически? Узнайте свой Chat ID через{' '}
                  <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>@userinfobot</a>
                  {' '}и введите вручную:
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input value={chatIdInput} onChange={e => setChatIdInput(e.target.value)}
                    placeholder="Числовой Chat ID, например 123456789"
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
                  <button className="btn btn-secondary" onClick={saveChatId} disabled={!chatIdInput || tgLoading}>
                    <i className="ti ti-check" /> Сохранить
                  </button>
                  {editingChatId && (
                    <button className="btn btn-secondary" onClick={() => setEditingChatId(false)}>Отмена</button>
                  )}
                </div>
              </>
            )}
          </Step>

          {/* Шаг 3 */}
          <Step n={3} title="Проверьте и отправляйте уведомления" done={false}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={sendTest} disabled={tgLoading || !tgStatus?.connected}>
                <i className="ti ti-message" /> Тестовое сообщение
              </button>
              <button className="btn btn-primary" onClick={sendAlerts} disabled={alertsLoading || !tgStatus?.connected}>
                <i className="ti ti-bell-ringing" /> {alertsLoading ? 'Отправка...' : 'Отправить уведомления сейчас'}
              </button>
            </div>
            {!tgStatus?.connected && (
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>Сначала выполните шаги 1 и 2</div>
            )}
            {alertsResult && (
              <div style={{ marginTop: 12, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: '#16A34A', marginBottom: 6 }}>✅ Уведомления отправлены в Telegram</div>
                <div style={{ color: '#64748B' }}>• Просроченных платежей: <b>{alertsResult.overdue_count}</b></div>
                <div style={{ color: '#64748B' }}>• Истекающих договоров: <b>{alertsResult.expiring_count}</b></div>
              </div>
            )}
          </Step>

          {/* Сообщения */}
          {tgMsg && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#16A34A', fontWeight: 500 }}>
              {tgMsg}
            </div>
          )}
          {tgError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>
              ❌ {tgError}
            </div>
          )}
        </div>
      </div>

      {/* О системе */}

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">О системе</span></div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7 }}>
          <div><b>Версия:</b> MVP 1.0</div>
          <div><b>Бэкенд:</b> FastAPI + PostgreSQL</div>
          <div><b>Фронтенд:</b> React + Vite</div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: done ? '#16A34A' : '#1A2E4A', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
      }}>
        {done ? <i className="ti ti-check" style={{ fontSize: 14 }} /> : n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A', marginBottom: 10 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
