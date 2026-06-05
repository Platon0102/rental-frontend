import { useEffect, useState } from 'react';
import { roomsApi } from '../api';
import type { Room, RoomStatus } from '../api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';

const statusOptions: { value: RoomStatus; label: string }[] = [
  { value: 'free', label: 'Свободно' },
  { value: 'occupied', label: 'Занято' },
  { value: 'reserved', label: 'Резерв' },
  { value: 'repair', label: 'Ремонт' },
];

const emptyRoom = { name: '', floor: 1, area: 0, status: 'free' as RoomStatus, base_rate: 0, description: '' };

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filterStatus, setFilterStatus] = useState<RoomStatus | ''>('');
  const [filterFloor, setFilterFloor] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyRoom);
  const [showStatusModal, setShowStatusModal] = useState<Room | null>(null);
  const [statusForm, setStatusForm] = useState({ new_status: 'free' as RoomStatus, reason: '', repair_start: '', repair_end: '' });
  const [loading, setLoading] = useState(false);

  const load = () => {
    roomsApi.list(filterFloor ? Number(filterFloor) : undefined, filterStatus || undefined).then(setRooms);
  };

  useEffect(() => { load(); }, [filterStatus, filterFloor]);

  const openCreate = () => { setEditRoom(null); setForm(emptyRoom); setShowModal(true); };
  const openEdit = (r: Room) => { setEditRoom(r); setForm({ name: r.name, floor: r.floor, area: r.area, status: r.status, base_rate: r.base_rate, description: r.description || '' }); setShowModal(true); };

  const save = async () => {
    setLoading(true);
    try {
      if (editRoom) await roomsApi.update(editRoom.id, form);
      else await roomsApi.create(form);
      setShowModal(false);
      load();
    } finally { setLoading(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Удалить помещение?')) return;
    await roomsApi.delete(id);
    load();
  };

  const changeStatus = async () => {
    if (!showStatusModal) return;
    setLoading(true);
    try {
      await roomsApi.changeStatus(showStatusModal.id, {
        new_status: statusForm.new_status,
        reason: statusForm.reason || undefined,
        repair_start: statusForm.repair_start || undefined,
        repair_end: statusForm.repair_end || undefined,
      });
      setShowStatusModal(null);
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка');
    } finally { setLoading(false); }
  };

  const floors = [...new Set(rooms.map(r => r.floor))].sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Помещения</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus size={16} /> Добавить
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Все статусы</option>
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Все этажи</option>
          {floors.map(f => <option key={f} value={f}>{f} этаж</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Название', 'Этаж', 'Площадь, м²', 'Ставка, ₸/м²', 'Статус', 'Действия'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rooms.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-gray-600">{r.floor}</td>
                <td className="px-4 py-3 text-gray-600">{r.area}</td>
                <td className="px-4 py-3 text-gray-600">{r.base_rate.toLocaleString('ru')}</td>
                <td className="px-4 py-3"><Badge value={r.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-indigo-600" title="Редактировать"><Edit2 size={15} /></button>
                    <button onClick={() => { setShowStatusModal(r); setStatusForm({ new_status: r.status, reason: '', repair_start: '', repair_end: '' }); }} className="text-gray-400 hover:text-orange-500" title="Сменить статус"><RefreshCw size={15} /></button>
                    <button onClick={() => del(r.id)} className="text-gray-400 hover:text-red-500" title="Удалить"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Помещения не найдены</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editRoom ? 'Редактировать помещение' : 'Новое помещение'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Название">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Этаж">
                <input type="number" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: +e.target.value }))} className="input" />
              </Field>
              <Field label="Площадь, м²">
                <input type="number" value={form.area} onChange={e => setForm(f => ({ ...f, area: +e.target.value }))} className="input" />
              </Field>
            </div>
            <Field label="Базовая ставка, ₸/м²">
              <input type="number" value={form.base_rate} onChange={e => setForm(f => ({ ...f, base_rate: +e.target.value }))} className="input" />
            </Field>
            <Field label="Описание">
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input" />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Отмена</button>
              <button onClick={save} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Status change modal */}
      {showStatusModal && (
        <Modal title={`Сменить статус: ${showStatusModal.name}`} onClose={() => setShowStatusModal(null)}>
          <div className="space-y-4">
            <Field label="Новый статус">
              <select value={statusForm.new_status} onChange={e => setStatusForm(f => ({ ...f, new_status: e.target.value as RoomStatus }))} className="input">
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Причина">
              <input value={statusForm.reason} onChange={e => setStatusForm(f => ({ ...f, reason: e.target.value }))} className="input" />
            </Field>
            {statusForm.new_status === 'repair' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Начало ремонта">
                  <input type="date" value={statusForm.repair_start} onChange={e => setStatusForm(f => ({ ...f, repair_start: e.target.value }))} className="input" />
                </Field>
                <Field label="Конец ремонта">
                  <input type="date" value={statusForm.repair_end} onChange={e => setStatusForm(f => ({ ...f, repair_end: e.target.value }))} className="input" />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowStatusModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Отмена</button>
              <button onClick={changeStatus} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                Применить
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
