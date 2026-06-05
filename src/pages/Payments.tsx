import { useEffect, useState } from 'react';
import { paymentsApi, contractsApi } from '../api';
import type { Payment, PaymentStatus, Contract } from '../api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { Plus, CheckCircle } from 'lucide-react';

const paymentTypes = [
  { value: 'rent', label: 'Аренда' },
  { value: 'deposit', label: 'Депозит' },
  { value: 'utility', label: 'Коммуналка' },
  { value: 'penalty', label: 'Штраф' },
  { value: 'other', label: 'Прочее' },
];

const statusOptions: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Оплачен' },
  { value: 'partial', label: 'Частично' },
  { value: 'debt', label: 'Долг' },
];

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [filterContract, setFilterContract] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRegister, setShowRegister] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [createForm, setCreateForm] = useState({
    contract_id: '', payment_type: 'rent', period_month: now.getMonth() + 1, period_year: now.getFullYear(),
    amount_due: '', amount_paid: '0', payment_date: now.toISOString().slice(0,10), comment: '',
  });
  const [registerForm, setRegisterForm] = useState({ amount_paid: '', payment_date: now.toISOString().slice(0,10), comment: '' });

  const load = () => paymentsApi.list({ status: filterStatus || undefined, contract_id: filterContract ? Number(filterContract) : undefined }).then(setPayments);

  useEffect(() => { load(); }, [filterStatus, filterContract]);
  useEffect(() => { contractsApi.list({ status: 'active' }).then(setContracts); }, []);

  const createPayment = async () => {
    setLoading(true);
    try {
      await paymentsApi.create({
        contract_id: Number(createForm.contract_id),
        payment_type: createForm.payment_type as any,
        period_month: createForm.period_month,
        period_year: createForm.period_year,
        amount_due: Number(createForm.amount_due),
        amount_paid: Number(createForm.amount_paid),
        payment_date: createForm.payment_date || undefined,
        comment: createForm.comment || undefined,
      });
      setShowCreate(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка');
    } finally { setLoading(false); }
  };

  const register = async () => {
    if (!showRegister) return;
    setLoading(true);
    try {
      await paymentsApi.register(showRegister.id, {
        amount_paid: Number(registerForm.amount_paid),
        payment_date: registerForm.payment_date,
        comment: registerForm.comment || undefined,
      });
      setShowRegister(null);
      load();
    } finally { setLoading(false); }
  };

  const contractLabel = (id: number) => contracts.find(c => c.id === id)?.number ?? `#${id}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Платежи</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus size={16} /> Начислить
        </button>
      </div>

      <div className="flex gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Все статусы</option>
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterContract} onChange={e => setFilterContract(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Все договоры</option>
          {contracts.map(c => <option key={c.id} value={c.id}>#{c.number}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Договор', 'Период', 'Тип', 'Начислено, ₸', 'Оплачено, ₸', 'Статус', 'Дата оплаты', 'Действия'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">#{contractLabel(p.contract_id)}</td>
                <td className="px-4 py-3 text-gray-600">{MONTHS[p.period_month - 1]} {p.period_year}</td>
                <td className="px-4 py-3 text-gray-600">{paymentTypes.find(t => t.value === p.payment_type)?.label ?? p.payment_type}</td>
                <td className="px-4 py-3 text-gray-700">{p.amount_due.toLocaleString('ru')}</td>
                <td className="px-4 py-3 text-gray-700">{p.amount_paid.toLocaleString('ru')}</td>
                <td className="px-4 py-3"><Badge value={p.status} /></td>
                <td className="px-4 py-3 text-gray-600">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('ru') : '—'}</td>
                <td className="px-4 py-3">
                  {p.status !== 'paid' && (
                    <button onClick={() => { setShowRegister(p); setRegisterForm({ amount_paid: String(p.amount_due - p.amount_paid), payment_date: now.toISOString().slice(0,10), comment: '' }); }} className="text-gray-400 hover:text-green-600" title="Зафиксировать оплату">
                      <CheckCircle size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Платежи не найдены</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Новое начисление" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Договор *</label>
              <select value={createForm.contract_id} onChange={e => setCreateForm(f => ({ ...f, contract_id: e.target.value }))} className="input w-full">
                <option value="">— выберите —</option>
                {contracts.map(c => <option key={c.id} value={c.id}>#{c.number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип платежа</label>
              <select value={createForm.payment_type} onChange={e => setCreateForm(f => ({ ...f, payment_type: e.target.value }))} className="input w-full">
                {paymentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Месяц</label>
                <select value={createForm.period_month} onChange={e => setCreateForm(f => ({ ...f, period_month: Number(e.target.value) }))} className="input w-full">
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Год</label>
                <input type="number" value={createForm.period_year} onChange={e => setCreateForm(f => ({ ...f, period_year: Number(e.target.value) }))} className="input w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма начисления, ₸</label>
                <input type="number" value={createForm.amount_due} onChange={e => setCreateForm(f => ({ ...f, amount_due: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Оплачено сразу, ₸</label>
                <input type="number" value={createForm.amount_paid} onChange={e => setCreateForm(f => ({ ...f, amount_paid: e.target.value }))} className="input w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
              <input value={createForm.comment} onChange={e => setCreateForm(f => ({ ...f, comment: e.target.value }))} className="input w-full" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Отмена</button>
              <button onClick={createPayment} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Register payment modal */}
      {showRegister && (
        <Modal title="Зафиксировать оплату" onClose={() => setShowRegister(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Начислено: <b>{showRegister.amount_due.toLocaleString('ru')} ₸</b> | Оплачено: <b>{showRegister.amount_paid.toLocaleString('ru')} ₸</b></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма оплаты, ₸</label>
              <input type="number" value={registerForm.amount_paid} onChange={e => setRegisterForm(f => ({ ...f, amount_paid: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата оплаты</label>
              <input type="date" value={registerForm.payment_date} onChange={e => setRegisterForm(f => ({ ...f, payment_date: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
              <input value={registerForm.comment} onChange={e => setRegisterForm(f => ({ ...f, comment: e.target.value }))} className="input w-full" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowRegister(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Отмена</button>
              <button onClick={register} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
