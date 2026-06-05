import { useEffect, useState } from 'react';
import { utilitiesApi, roomsApi } from '../api';
import type { UtilityReading, UtilityBill, Room } from '../api';
import Modal from '../components/Modal';
import { Plus, Send, Zap } from 'lucide-react';

const utilityTypes = [
  { value: 'electricity', label: 'Электричество' },
  { value: 'water_cold', label: 'Хол. вода' },
  { value: 'water_hot', label: 'Гор. вода' },
  { value: 'heat', label: 'Отопление' },
  { value: 'internet', label: 'Интернет' },
  { value: 'other', label: 'Прочее' },
];

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

export default function Utilities() {
  const now = new Date();
  const [tab, setTab] = useState<'readings' | 'bills'>('readings');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [showReading, setShowReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRoom, setFilterRoom] = useState('');

  const [readingForm, setReadingForm] = useState({
    room_id: '', utility_type: 'electricity', period_month: now.getMonth() + 1, period_year: now.getFullYear(),
    prev_reading: '', curr_reading: '', tariff: '', is_fixed: false, fixed_amount: '',
  });

  const loadReadings = () => utilitiesApi.listReadings({ room_id: filterRoom ? Number(filterRoom) : undefined, period_month: filterMonth, period_year: filterYear }).then(setReadings);
  const loadBills = () => utilitiesApi.listBills({ period_month: filterMonth, period_year: filterYear }).then(setBills);

  useEffect(() => { roomsApi.list().then(setRooms); }, []);
  useEffect(() => { if (tab === 'readings') loadReadings(); else loadBills(); }, [tab, filterMonth, filterYear, filterRoom]);

  const addReading = async () => {
    setLoading(true);
    try {
      await utilitiesApi.addReading({
        room_id: Number(readingForm.room_id),
        utility_type: readingForm.utility_type as any,
        period_month: readingForm.period_month,
        period_year: readingForm.period_year,
        prev_reading: readingForm.prev_reading ? Number(readingForm.prev_reading) : undefined,
        curr_reading: readingForm.curr_reading ? Number(readingForm.curr_reading) : undefined,
        tariff: readingForm.tariff ? Number(readingForm.tariff) : undefined,
        is_fixed: readingForm.is_fixed,
        fixed_amount: readingForm.fixed_amount ? Number(readingForm.fixed_amount) : undefined,
      });
      setShowReading(false);
      loadReadings();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка');
    } finally { setLoading(false); }
  };

  const generateBills = async () => {
    if (!confirm(`Сформировать счета за ${MONTHS[filterMonth - 1]} ${filterYear}?`)) return;
    setLoading(true);
    try {
      const result = await utilitiesApi.generateBills(filterMonth, filterYear);
      alert(`Создано счетов: ${result.generated}`);
      loadBills();
    } finally { setLoading(false); }
  };

  const markSent = async (id: number) => {
    await utilitiesApi.markSent(id);
    loadBills();
  };

  const roomName = (id: number) => rooms.find(r => r.id === id)?.name ?? `#${id}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Коммунальные услуги</h1>
        <div className="flex gap-2">
          {tab === 'readings' && (
            <button onClick={() => setShowReading(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus size={16} /> Показания
            </button>
          )}
          {tab === 'bills' && (
            <button onClick={generateBills} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              <Zap size={16} /> Сформировать счета
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {(['readings', 'bills'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
            {t === 'readings' ? 'Показания счётчиков' : 'Счета'}
          </button>
        ))}
      </div>

      {/* Period filters */}
      <div className="flex gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24" />
        {tab === 'readings' && (
          <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Все помещения</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {tab === 'readings' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Помещение', 'Тип', 'Пред.', 'Тек.', 'Расход', 'Тариф', 'Сумма, ₸'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {readings.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{roomName(r.room_id)}</td>
                  <td className="px-4 py-3 text-gray-600">{utilityTypes.find(t => t.value === r.utility_type)?.label ?? r.utility_type}</td>
                  <td className="px-4 py-3 text-gray-600">{r.prev_reading ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.curr_reading ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.consumption ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.tariff ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{r.amount?.toLocaleString('ru') ?? '—'}</td>
                </tr>
              ))}
              {readings.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Нет показаний за выбранный период</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Договор', 'Свет', 'Хол.вода', 'Гор.вода', 'Отопл.', 'Интернет', 'Итого, ₸', 'Статус', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{b.contract_id}</td>
                  <td className="px-4 py-3 text-gray-600">{b.electricity.toLocaleString('ru')}</td>
                  <td className="px-4 py-3 text-gray-600">{b.water_cold.toLocaleString('ru')}</td>
                  <td className="px-4 py-3 text-gray-600">{b.water_hot.toLocaleString('ru')}</td>
                  <td className="px-4 py-3 text-gray-600">{b.heat.toLocaleString('ru')}</td>
                  <td className="px-4 py-3 text-gray-600">{b.internet.toLocaleString('ru')}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{b.total.toLocaleString('ru')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${b.is_sent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {b.is_sent ? 'Отправлен' : 'Не отправлен'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!b.is_sent && (
                      <button onClick={() => markSent(b.id)} className="text-gray-400 hover:text-indigo-600" title="Отметить отправленным"><Send size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Нет счетов за выбранный период</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add reading modal */}
      {showReading && (
        <Modal title="Ввести показания счётчика" onClose={() => setShowReading(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Помещение *</label>
              <select value={readingForm.room_id} onChange={e => setReadingForm(f => ({ ...f, room_id: e.target.value }))} className="input w-full">
                <option value="">— выберите —</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип услуги</label>
              <select value={readingForm.utility_type} onChange={e => setReadingForm(f => ({ ...f, utility_type: e.target.value }))} className="input w-full">
                {utilityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Месяц</label>
                <select value={readingForm.period_month} onChange={e => setReadingForm(f => ({ ...f, period_month: Number(e.target.value) }))} className="input w-full">
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Год</label>
                <input type="number" value={readingForm.period_year} onChange={e => setReadingForm(f => ({ ...f, period_year: Number(e.target.value) }))} className="input w-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="fixed" checked={readingForm.is_fixed} onChange={e => setReadingForm(f => ({ ...f, is_fixed: e.target.checked }))} />
              <label htmlFor="fixed" className="text-sm text-gray-700">Фиксированная сумма</label>
            </div>
            {readingForm.is_fixed ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фиксированная сумма, ₸</label>
                <input type="number" value={readingForm.fixed_amount} onChange={e => setReadingForm(f => ({ ...f, fixed_amount: e.target.value }))} className="input w-full" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пред. показание</label>
                  <input type="number" value={readingForm.prev_reading} onChange={e => setReadingForm(f => ({ ...f, prev_reading: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тек. показание</label>
                  <input type="number" value={readingForm.curr_reading} onChange={e => setReadingForm(f => ({ ...f, curr_reading: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тариф</label>
                  <input type="number" value={readingForm.tariff} onChange={e => setReadingForm(f => ({ ...f, tariff: e.target.value }))} className="input w-full" />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowReading(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Отмена</button>
              <button onClick={addReading} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
