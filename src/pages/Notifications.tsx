import { useEffect, useState } from 'react';
import { contractsApi, paymentsApi, tenantsApi, roomsApi } from '../api';
import type { Contract, Payment, Tenant, Room } from '../api';
import { getDismissed, dismissAll, dismissOne } from '../utils/notifications';

interface NotifItem {
  id: string;
  type: 'urgent' | 'warn' | 'info' | 'ok';
  dotColor: string;
  title: string;
  text: string;
  time: string;
}

export default function Notifications() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);

  useEffect(() => {
    const today = new Date();

    Promise.all([
      contractsApi.list({ expiring_days: 90 }).catch(() => [] as Contract[]),
      paymentsApi.list().catch(() => [] as Payment[]),
      tenantsApi.list().catch(() => [] as Tenant[]),
      roomsApi.list().catch(() => [] as Room[]),
    ]).then(([expiring, allPayments]) => {
      const notifs: NotifItem[] = [];

      // Просроченные платежи (debt или pending с прошедшим месяцем)
      const overdue = allPayments.filter(p => {
        if (p.status === 'paid') return false;
        if (p.status === 'debt') return true;
        if (p.status === 'pending' || p.status === 'partial') {
          if (!p.period_year || !p.period_month) return false;
          if (p.period_year < today.getFullYear()) return true;
          if (p.period_year === today.getFullYear() && p.period_month < today.getMonth() + 1) return true;
        }
        return false;
      });

      // Частично оплаченные
      const partial = allPayments.filter(p => p.status === 'partial');

      overdue.forEach(p => {
        const debt = p.amount_due - p.amount_paid;
        const monthName = p.period_month
          ? `${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][p.period_month - 1]} ${p.period_year}`
          : '';
        notifs.push({
          id: `debt-${p.id}`,
          type: 'urgent',
          dotColor: '#EF4444',
          title: `Просрочена оплата — договор №${p.contract_id}${monthName ? ` (${monthName})` : ''}`,
          text: `Задолженность ${debt.toLocaleString('ru')} сом`,
          time: 'Сегодня',
        });
      });

      partial.forEach(p => {
        const monthName = p.period_month
          ? `${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][p.period_month - 1]} ${p.period_year}`
          : '';
        notifs.push({
          id: `partial-${p.id}`,
          type: 'warn',
          dotColor: '#F59E0B',
          title: `Частичная оплата — договор №${p.contract_id}${monthName ? ` (${monthName})` : ''}`,
          text: `Оплачено ${p.amount_paid.toLocaleString('ru')} из ${p.amount_due.toLocaleString('ru')} сом`,
          time: 'Сегодня',
        });
      });

      // Истекающие договоры
      expiring.forEach(c => {
        const endDate = new Date(c.end_date);
        const daysLeft = Math.round((endDate.getTime() - today.getTime()) / 86400000);
        if (daysLeft < 0) return; // уже истёк
        const isUrgent = daysLeft <= 30;
        notifs.push({
          id: `exp-${c.id}`,
          type: isUrgent ? 'urgent' : 'warn',
          dotColor: isUrgent ? '#EF4444' : '#F59E0B',
          title: `Договор истекает через ${daysLeft} дн. — №${c.number}`,
          text: `${c.monthly_rent.toLocaleString('ru')} сом/мес · до ${endDate.toLocaleDateString('ru')}`,
          time: 'Сегодня',
        });
      });

      setItems(notifs);
      setLoaded(true);
    });
  }, []);

  const visible = items.filter(i => !dismissed.has(i.id));
  const urgent = visible.filter(i => i.type === 'urgent');
  const other = visible.filter(i => i.type !== 'urgent');

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94A3B8', fontSize: 14 }}>
        <i className="ti ti-loader" style={{ marginRight: 8, fontSize: 18 }} /> Загрузка уведомлений...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="notif-group-title" style={{ marginBottom: 0 }}>
          Требуют внимания
          {urgent.length > 0 && (
            <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 20, marginLeft: 8 }}>
              {urgent.length}
            </span>
          )}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            const ids = items.map(i => i.id);
            dismissAll(ids);
            setDismissed(new Set(ids));
          }}
          disabled={visible.length === 0}
        >
          <i className="ti ti-checks" /> Отметить все прочитанными
        </button>
      </div>

      {urgent.length === 0 && (
        <div className="notif-item ok">
          <div className="notif-i-dot" style={{ background: '#22C55E' }} />
          <div className="notif-body">
            <div className="notif-title">Нет срочных уведомлений</div>
            <div className="notif-text">Все платежи и договоры в порядке</div>
          </div>
          <div className="notif-time">Сейчас</div>
        </div>
      )}

      {urgent.map(n => <NotifCard key={n.id} n={n} onDismiss={() => {
        dismissOne(n.id);
        setDismissed(d => new Set([...d, n.id]));
      }} />)}

      {other.length > 0 && (
        <>
          <div style={{ marginTop: 24, marginBottom: 14 }} className="notif-group-title">Информационные</div>
          {other.map(n => <NotifCard key={n.id} n={n} onDismiss={() => {
            dismissOne(n.id);
            setDismissed(d => new Set([...d, n.id]));
          }} />)}
        </>
      )}

      {visible.length === 0 && loaded && (
        <div className="notif-item info" style={{ marginTop: 16 }}>
          <div className="notif-i-dot" style={{ background: '#3B82F6' }} />
          <div className="notif-body">
            <div className="notif-title">Всё в порядке</div>
            <div className="notif-text">Просроченных платежей и истекающих договоров нет</div>
          </div>
          <div className="notif-time">Сейчас</div>
        </div>
      )}
    </div>
  );
}

function NotifCard({ n, onDismiss }: { n: NotifItem; onDismiss: () => void }) {
  return (
    <div className={`notif-item ${n.type}`} style={{ position: 'relative' }}>
      <div className="notif-i-dot" style={{ background: n.dotColor }} />
      <div className="notif-body">
        <div className="notif-title">{n.title}</div>
        <div className="notif-text">{n.text}</div>
      </div>
      <div className="notif-time">{n.time}</div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, marginLeft: 8, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
        title="Скрыть"
      >×</button>
    </div>
  );
}
