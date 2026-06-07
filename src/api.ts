import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:8000' });

export default api;

// --- Types ---

export type RoomStatus = 'free' | 'occupied' | 'reserved' | 'repair';
export type ContractStatus = 'active' | 'expiring' | 'terminated' | 'expired';
export type PaymentStatus = 'paid' | 'partial' | 'debt' | 'pending';
export type PaymentType = 'rent' | 'deposit' | 'utilities' | 'penalty' | 'other';
export type UtilityType = 'electricity' | 'water_cold' | 'water_hot' | 'heat' | 'internet' | 'other';

export interface UtilityReading {
  id: number;
  room_id: number;
  utility_type: UtilityType;
  meter_number?: string;
  period_month: number;
  period_year: number;
  prev_reading?: number;
  curr_reading?: number;
  consumption?: number;
  tariff?: number;
  amount?: number;
  is_fixed: boolean;
  fixed_amount?: number;
  created_at: string;
}

export interface UtilityBill {
  id: number;
  contract_id: number;
  period_month: number;
  period_year: number;
  electricity: number;
  water_cold: number;
  water_hot: number;
  heat: number;
  internet: number;
  other: number;
  total: number;
  is_sent: boolean;
  created_at: string;
}

export interface Room {
  id: number;
  name: string;
  floor: number;
  area: number;
  status: RoomStatus;
  base_rate: number;
  description?: string;
  repair_start?: string;
  repair_end?: string;
}

export interface Tenant {
  id: number;
  name: string;
  tenant_type?: string;
  inn?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface Contract {
  id: number;
  room_id: number;
  tenant_id: number;
  number: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit?: number;
  payment_day?: number;
  status: ContractStatus;
  file_name?: string;
  file_path?: string;
  terminated_at?: string;
  termination_reason?: string;
  termination_initiator?: string;
  penalty?: number;
}

export interface Payment {
  id: number;
  contract_id: number;
  period_month: number;
  period_year: number;
  payment_type: PaymentType;
  amount_due: number;
  amount_paid: number;
  status: PaymentStatus;
  payment_date?: string;
  comment?: string;
  created_at: string;
}

export interface UtilityReading {
  id: number;
  room_id: number;
  utility_type: UtilityType;
  period_month: number;
  period_year: number;
  prev_reading?: number;
  curr_reading?: number;
  consumption?: number;
  tariff?: number;
  amount?: number;
  is_fixed: boolean;
  fixed_amount?: number;
}

export interface UtilityBill {
  id: number;
  contract_id: number;
  period_month: number;
  period_year: number;
  electricity: number;
  water_cold: number;
  water_hot: number;
  heat: number;
  internet: number;
  other: number;
  total: number;
  is_sent: boolean;
}

export interface DashboardStats {
  rooms: {
    total: number;
    occupied: number;
    free: number;
    reserved: number;
    repair: number;
    occupancy_pct: number;
  };
  finance: { debt_total: number };
  contracts: { expiring_30_days: number };
}

// --- API calls ---

export const roomsApi = {
  list: (floor?: number, status?: RoomStatus) =>
    api.get<Room[]>('/rooms/', { params: { floor, status } }).then(r => r.data),
  get: (id: number) => api.get<Room>(`/rooms/${id}`).then(r => r.data),
  create: (data: Omit<Room, 'id'>) => api.post<Room>('/rooms/', data).then(r => r.data),
  update: (id: number, data: Partial<Room>) => api.patch<Room>(`/rooms/${id}`, data).then(r => r.data),
  changeStatus: (id: number, data: { new_status: RoomStatus; reason?: string; repair_start?: string; repair_end?: string }) =>
    api.post<Room>(`/rooms/${id}/status`, data).then(r => r.data),
  history: (id: number) => api.get(`/rooms/${id}/history`).then(r => r.data),
  fullHistory: (id: number) => api.get(`/rooms/${id}/full-history`).then(r => r.data),
  delete: (id: number) => api.delete(`/rooms/${id}`),
};

export const tenantsApi = {
  list: (search?: string) => api.get<Tenant[]>('/tenants/', { params: { search } }).then(r => r.data),
  get: (id: number) => api.get<Tenant>(`/tenants/${id}`).then(r => r.data),
  create: (data: Omit<Tenant, 'id'>) => api.post<Tenant>('/tenants/', data).then(r => r.data),
  update: (id: number, data: Partial<Tenant>) => api.patch<Tenant>(`/tenants/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/tenants/${id}`),
};

export const contractsApi = {
  list: (params?: { status?: ContractStatus; tenant_id?: number; room_id?: number; expiring_days?: number }) =>
    api.get<Contract[]>('/contracts/', { params }).then(r => r.data),
  get: (id: number) => api.get<Contract>(`/contracts/${id}`).then(r => r.data),
  create: (data: Omit<Contract, 'id' | 'status' | 'file_name' | 'file_path'>) =>
    api.post<Contract>('/contracts/', data).then(r => r.data),
  terminate: (id: number, data: { terminated_at: string; termination_reason?: string; termination_initiator?: string; penalty?: number }) =>
    api.post<Contract>(`/contracts/${id}/terminate`, data).then(r => r.data),
  upload: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<Contract>(`/contracts/${id}/upload`, fd).then(r => r.data);
  },
  delete: (id: number) => api.delete(`/contracts/${id}`),
};

export const paymentsApi = {
  list: (params?: { contract_id?: number; status?: PaymentStatus; period_month?: number; period_year?: number }) =>
    api.get<Payment[]>('/payments/', { params }).then(r => r.data),
  create: (data: Omit<Payment, 'id' | 'status' | 'created_at'>) =>
    api.post<Payment>('/payments/', data).then(r => r.data),
  register: (id: number, data: { amount_paid: number; payment_date: string; comment?: string }) =>
    api.patch<Payment>(`/payments/${id}`, data).then(r => r.data),
  debts: () => api.get<{ contract_id: number; debt: number }[]>('/payments/debts').then(r => r.data),
  schedule: (contractId: number) => api.get<Payment[]>(`/payments/schedule/${contractId}`).then(r => r.data),
};

export const utilitiesApi = {
  addReading: (data: Omit<UtilityReading, 'id' | 'consumption' | 'amount' | 'created_at'>) =>
    api.post<UtilityReading>('/utilities/readings/', data).then(r => r.data),
  listReadings: (params?: { room_id?: number; period_month?: number; period_year?: number }) =>
    api.get<UtilityReading[]>('/utilities/readings/', { params }).then(r => r.data),
  generateBills: (period_month: number, period_year: number) =>
    api.post('/utilities/bills/generate', null, { params: { period_month, period_year } }).then(r => r.data),
  listBills: (params?: { contract_id?: number; period_month?: number; period_year?: number }) =>
    api.get<UtilityBill[]>('/utilities/bills/', { params }).then(r => r.data),
  markSent: (bill_id: number) => api.patch(`/utilities/bills/${bill_id}/send`).then(r => r.data),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
  expiringContracts: (days = 90) =>
    api.get<Contract[]>('/dashboard/expiring-contracts', { params: { days } }).then(r => r.data),
  occupancyByFloor: () => api.get<{ floor: number; total: number; occupied: number; pct: number }[]>('/dashboard/occupancy-by-floor').then(r => r.data),
  revenueByMonth: (year?: number) =>
    api.get<{ month: number; paid: number; due: number }[]>('/dashboard/revenue-by-month', { params: { year } }).then(r => r.data),
};
