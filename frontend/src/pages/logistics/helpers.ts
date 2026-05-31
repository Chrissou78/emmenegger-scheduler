// frontend/src/pages/logistics/helpers.ts
import type { SparePart, MarginRule } from './types';

export const fmtCHF = (v: number) =>
  v.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' });

export const fmtNum = (v: number, d = 0) =>
  v.toLocaleString('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });

export function computeSellingPrice(buyingPrice: number, marginPct: number): number {
  return Math.round(buyingPrice * (1 + marginPct / 100) * 100) / 100;
}

export function resolveMargin(part: SparePart, rules: MarginRule[]): number {
  const partRule = rules.find(r => r.scope === 'PART' && r.part_id === part.id && r.is_active);
  if (partRule) return partRule.margin_pct;
  const catRule = rules.find(r => r.scope === 'CATEGORY' && r.category === part.category && r.is_active);
  if (catRule) return catRule.margin_pct;
  const defaultRule = rules.find(r => r.scope === 'DEFAULT' && r.is_active);
  return defaultRule?.margin_pct ?? 50;
}

export function emptyPartForm(partType: 'MAINTENANCE' | 'CONSUMABLE') {
  return {
    part_number: '', name: '', description: '', part_type: partType,
    category: 'GENERAL', unit: 'pcs',
    stock_qty: 0, min_qty: 0, reorder_qty: 0,
    location: '', supplier: '', supplier_ref: '',
    unit_price: 0, selling_price: 0, margin_pct: 50,
    is_sellable: partType === 'CONSUMABLE',
    machine_id: '', qr_code: '', image_url: '',
    auto_reorder: false, notes: '',
  };
}

export function partToForm(p: SparePart) {
  return {
    part_number: p.part_number, name: p.name,
    description: p.description ?? '', part_type: p.part_type,
    category: p.category, unit: p.unit,
    stock_qty: p.stock_qty, min_qty: p.min_qty, reorder_qty: p.reorder_qty,
    location: p.location ?? '', supplier: p.supplier ?? '',
    supplier_ref: p.supplier_ref ?? '',
    unit_price: p.unit_price, selling_price: p.selling_price ?? 0,
    margin_pct: p.margin_pct ?? 0, is_sellable: p.is_sellable,
    machine_id: p.machine_id ?? '', qr_code: p.qr_code ?? '',
    image_url: p.image_url ?? '',
    auto_reorder: p.auto_reorder, notes: p.notes ?? '',
  };
}