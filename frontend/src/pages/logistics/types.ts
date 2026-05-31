// frontend/src/pages/logistics/types.ts

export type PartType = 'MAINTENANCE' | 'CONSUMABLE';

export interface SparePart {
  id: string;
  part_number: string;
  name: string;
  description?: string;
  part_type: PartType;
  category: string;
  unit: string;
  stock_qty: number;
  min_qty: number;
  reorder_qty: number;
  location?: string;
  supplier?: string;
  supplier_ref?: string;
  unit_price: number;
  selling_price?: number;
  margin_pct?: number;
  is_sellable: boolean;
  machine_id?: string;
  machine?: { id: string; name: string; inventory_nr: string };
  qr_code?: string;
  image_url?: string;
  auto_reorder: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PermChecks {
  canEdit:      boolean;
  canDelete:    boolean;
  canConsume:   boolean;
  canSell:      boolean;
  canPricing:   boolean;
  canAlerts:    boolean;
  canImport:    boolean;
  canInventory: boolean;
}

export interface Transaction {
  id: string;
  part_id: string;
  type: 'CONSUME' | 'PURCHASE' | 'ADJUST' | 'RETURN' | 'SALE';
  qty: number;
  unit_price?: number;
  selling_price?: number;
  reference?: string;
  machine_id?: string;
  task_id?: string;
  customer_id?: string;
  job_id?: string;
  user_id: string;
  notes?: string;
  created_at: string;
  part?: { id: string; part_number: string; name: string };
  machine?: { id: string; name: string };
  task?: { id: string; code: string; name: string };
  user?: { id: string; first_name: string; last_name: string };
  customer?: { id: string; name: string };
}

export interface Alert {
  id: string;
  part_id: string;
  alert_type: string;
  message: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  part?: Pick<SparePart, 'id' | 'part_number' | 'name' | 'stock_qty' | 'min_qty' | 'reorder_qty' | 'supplier' | 'auto_reorder'>;
}

export interface Stats {
  totalParts: number;
  maintenanceParts: number;
  consumableParts: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  maintenanceValue: number;
  consumablesValue: number;
  potentialRevenue: number;
  openAlerts: number;
  consumed30d: number;
  purchased30d: number;
  sold30d: number;
  spentValue30d: number;
  revenueValue30d: number;
}

export interface MarginRule {
  id: string;
  scope: 'DEFAULT' | 'CATEGORY' | 'PART';
  category?: string;
  part_id?: string;
  margin_pct: number;
  is_active: boolean;
}

export interface InventoryLine {
  part: SparePart;
  systemQty: number;
  countedQty: number | null;
  difference: number;
  touched: boolean;
  notes: string;
}

export type Section = 'dashboard' | 'maintenance' | 'consumables' | 'alerts' | 'transactions' | 'inventory' | 'pricing';
export type PartView = 'list' | 'detail';

export interface Machine {
  id: string;
  name: string;
  inventory_nr: string;
}

export interface Task {
  id: string;
  code: string;
  name: string;
}