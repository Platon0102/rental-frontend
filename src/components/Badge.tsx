const colors: Record<string, string> = {
  free: 'bg-green-100 text-green-800',
  occupied: 'bg-blue-100 text-blue-800',
  reserved: 'bg-yellow-100 text-yellow-800',
  repair: 'bg-red-100 text-red-800',
  active: 'bg-green-100 text-green-800',
  expiring: 'bg-orange-100 text-orange-800',
  terminated: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  debt: 'bg-red-100 text-red-800',
};

const labels: Record<string, string> = {
  free: 'Свободно',
  occupied: 'Занято',
  reserved: 'Резерв',
  repair: 'Ремонт',
  active: 'Активен',
  expiring: 'Истекает',
  terminated: 'Расторгнут',
  expired: 'Истёк',
  paid: 'Оплачен',
  partial: 'Частично',
  debt: 'Долг',
};

export default function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[value] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[value] ?? value}
    </span>
  );
}
