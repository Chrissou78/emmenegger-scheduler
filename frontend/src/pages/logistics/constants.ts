// frontend/src/pages/logistics/constants.ts

export const MAINTENANCE_CATEGORIES = [
  'SHOVELS_BLADES', 'OIL_FLUIDS', 'FASTENERS', 'FILTERS',
  'BELTS_HOSES', 'ELECTRICAL', 'HYDRAULIC', 'WEAR_PARTS',
  'SAFETY', 'GENERAL',
] as const;

export const CONSUMABLE_CATEGORIES = [
  'AGGREGATES', 'PLANTS_GREEN', 'CHEMICALS', 'PIPES_FITTINGS',
  'GEOTEXTILE', 'CONCRETE_CEMENT', 'FUEL_LUBRICANTS', 'RENTAL', 'GENERAL',
] as const;

export const ALL_CATEGORIES = [...MAINTENANCE_CATEGORIES, ...CONSUMABLE_CATEGORIES] as const;

export const UNITS = ['pcs', 'kg', 'l', 'm', 'm²', 'm³', 't', 'set', 'box', 'roll', 'bag'] as const;

export const TX_TYPES = ['CONSUME', 'PURCHASE', 'ADJUST', 'RETURN', 'SALE'] as const;

export const ALERT_COLORS: Record<string, string> = {
  LOW_STOCK: '#f59e0b', OUT_OF_STOCK: '#ef4444', REORDER: '#3b82f6',
};
export const ALERT_ICONS: Record<string, string> = {
  LOW_STOCK: '⚠️', OUT_OF_STOCK: '🔴', REORDER: '📦',
};
export const TX_COLORS: Record<string, string> = {
  CONSUME: '#ef4444', PURCHASE: '#22c55e', ADJUST: '#a855f7',
  RETURN: '#3b82f6', SALE: '#f97316',
};
export const TX_ICONS: Record<string, string> = {
  CONSUME: '📤', PURCHASE: '📥', ADJUST: '🔧', RETURN: '↩️', SALE: '💰',
};

/* ── Category → i18n key mapping ── */
export const CATEGORY_I18N: Record<string, string> = {
  SHOVELS_BLADES: 'logCatShovels',
  OIL_FLUIDS: 'logCatOilFluids',
  FASTENERS: 'logCatFasteners',
  FILTERS: 'logCatFilters',
  BELTS_HOSES: 'logCatBelts',
  ELECTRICAL: 'logCatElectrical',
  HYDRAULIC: 'logCatHydraulic',
  WEAR_PARTS: 'logCatWearParts',
  SAFETY: 'logCatSafety',
  GENERAL: 'logCatGeneral',
  AGGREGATES: 'logCatAggregates',
  PLANTS_GREEN: 'logCatPlants',
  CHEMICALS: 'logCatChemicals',
  PIPES_FITTINGS: 'logCatPipes',
  GEOTEXTILE: 'logCatGeotextile',
  CONCRETE_CEMENT: 'logCatConcrete',
  FUEL_LUBRICANTS: 'logCatFuel',
  RENTAL: 'logCatRental',
};

/* ── Seed data ── */
export const SEED_MAINTENANCE_PARTS = [
  { part_number: 'M-SHV-001', name: 'Excavator bucket teeth', category: 'WEAR_PARTS', unit: 'pcs', stock_qty: 24, min_qty: 10, reorder_qty: 20, location: 'Rack A1', supplier: 'Baumag AG', unit_price: 18.50 },
  { part_number: 'M-SHV-002', name: 'Flat shovel blade 30cm', category: 'SHOVELS_BLADES', unit: 'pcs', stock_qty: 6, min_qty: 3, reorder_qty: 6, location: 'Rack A1', supplier: 'Baumag AG', unit_price: 45.00 },
  { part_number: 'M-SHV-003', name: 'Pointed shovel replacement handle', category: 'SHOVELS_BLADES', unit: 'pcs', stock_qty: 4, min_qty: 2, reorder_qty: 5, location: 'Rack A1', supplier: 'Jumbo', unit_price: 12.00 },
  { part_number: 'M-OIL-001', name: 'Hydraulic oil ISO 46 — 20L', category: 'OIL_FLUIDS', unit: 'l', stock_qty: 60, min_qty: 40, reorder_qty: 100, location: 'Oil store', supplier: 'Motorex', unit_price: 3.80 },
  { part_number: 'M-OIL-002', name: 'Engine oil 10W-40 — 5L', category: 'OIL_FLUIDS', unit: 'l', stock_qty: 25, min_qty: 15, reorder_qty: 50, location: 'Oil store', supplier: 'Motorex', unit_price: 8.20 },
  { part_number: 'M-OIL-003', name: 'Grease cartridge EP2 400g', category: 'OIL_FLUIDS', unit: 'pcs', stock_qty: 18, min_qty: 6, reorder_qty: 12, location: 'Oil store', supplier: 'Motorex', unit_price: 5.50 },
  { part_number: 'M-FAS-001', name: 'Hex bolt M10×30 Grade 8.8', category: 'FASTENERS', unit: 'pcs', stock_qty: 200, min_qty: 50, reorder_qty: 200, location: 'Rack B2', supplier: 'Bossard', unit_price: 0.35 },
  { part_number: 'M-FAS-002', name: 'Self-lock nut M10', category: 'FASTENERS', unit: 'pcs', stock_qty: 200, min_qty: 50, reorder_qty: 200, location: 'Rack B2', supplier: 'Bossard', unit_price: 0.18 },
  { part_number: 'M-FAS-003', name: 'Split pin 4×40mm', category: 'FASTENERS', unit: 'pcs', stock_qty: 100, min_qty: 30, reorder_qty: 100, location: 'Rack B2', supplier: 'Bossard', unit_price: 0.08 },
  { part_number: 'M-FIL-001', name: 'Engine air filter — Takeuchi TB230', category: 'FILTERS', unit: 'pcs', stock_qty: 3, min_qty: 2, reorder_qty: 4, location: 'Rack C1', supplier: 'Kramer AG', unit_price: 42.00 },
  { part_number: 'M-FIL-002', name: 'Hydraulic return filter — Kobelco 16t', category: 'FILTERS', unit: 'pcs', stock_qty: 2, min_qty: 1, reorder_qty: 3, location: 'Rack C1', supplier: 'Kramer AG', unit_price: 68.00 },
  { part_number: 'M-FIL-003', name: 'Fuel filter — Cat 5t', category: 'FILTERS', unit: 'pcs', stock_qty: 4, min_qty: 2, reorder_qty: 4, location: 'Rack C1', supplier: 'Avesco Cat', unit_price: 32.00 },
  { part_number: 'M-BLT-001', name: 'V-belt A68', category: 'BELTS_HOSES', unit: 'pcs', stock_qty: 3, min_qty: 1, reorder_qty: 3, location: 'Rack C2', supplier: 'Kramer AG', unit_price: 22.00 },
  { part_number: 'M-BLT-002', name: 'Hydraulic hose 1/2" — 1.5m', category: 'BELTS_HOSES', unit: 'pcs', stock_qty: 5, min_qty: 2, reorder_qty: 6, location: 'Rack C2', supplier: 'Pirtek', unit_price: 55.00 },
  { part_number: 'M-ELC-001', name: 'Beacon lamp LED amber', category: 'ELECTRICAL', unit: 'pcs', stock_qty: 4, min_qty: 2, reorder_qty: 4, location: 'Rack D1', supplier: 'Meier Tobler', unit_price: 38.00 },
  { part_number: 'M-HYD-001', name: 'Hydraulic quick coupler 1/2"', category: 'HYDRAULIC', unit: 'pcs', stock_qty: 8, min_qty: 4, reorder_qty: 8, location: 'Rack D2', supplier: 'Pirtek', unit_price: 14.50 },
  { part_number: 'M-SAF-001', name: 'Safety glasses clear (pack 12)', category: 'SAFETY', unit: 'box', stock_qty: 3, min_qty: 1, reorder_qty: 3, location: 'Safety cabinet', supplier: 'Jumbo', unit_price: 28.00 },
  { part_number: 'M-SAF-002', name: 'Ear muffs — Peltor X4', category: 'SAFETY', unit: 'pcs', stock_qty: 6, min_qty: 3, reorder_qty: 6, location: 'Safety cabinet', supplier: 'Jumbo', unit_price: 35.00 },
  { part_number: 'M-WER-001', name: 'Track rubber pad — TB230', category: 'WEAR_PARTS', unit: 'pcs', stock_qty: 10, min_qty: 4, reorder_qty: 10, location: 'Rack E1', supplier: 'Kramer AG', unit_price: 85.00 },
  { part_number: 'M-GEN-001', name: 'Duct tape 50mm × 50m', category: 'GENERAL', unit: 'roll', stock_qty: 8, min_qty: 3, reorder_qty: 10, location: 'Rack F1', supplier: 'Jumbo', unit_price: 6.50 },
];

export const SEED_CONSUMABLE_PARTS = [
  { part_number: 'C-AGG-001', name: 'Gravel 0/32 round (per ton)', category: 'AGGREGATES', unit: 't', stock_qty: 45, min_qty: 10, reorder_qty: 50, location: 'Yard silo 1', supplier: 'Kibag', unit_price: 28.00, selling_price: 42.00 },
  { part_number: 'C-AGG-002', name: 'Sand 0/4 washed (per ton)', category: 'AGGREGATES', unit: 't', stock_qty: 30, min_qty: 8, reorder_qty: 40, location: 'Yard silo 2', supplier: 'Kibag', unit_price: 22.00, selling_price: 35.00 },
  { part_number: 'C-AGG-003', name: 'Crushed stone 32/63 (per ton)', category: 'AGGREGATES', unit: 't', stock_qty: 20, min_qty: 5, reorder_qty: 30, location: 'Yard pile A', supplier: 'Kibag', unit_price: 26.00, selling_price: 40.00 },
  { part_number: 'C-PLT-001', name: 'Topsoil screened (per m³)', category: 'PLANTS_GREEN', unit: 'm³', stock_qty: 35, min_qty: 10, reorder_qty: 50, location: 'Yard pile B', supplier: 'Ricoter', unit_price: 32.00, selling_price: 55.00 },
  { part_number: 'C-PLT-002', name: 'Bark mulch (per m³)', category: 'PLANTS_GREEN', unit: 'm³', stock_qty: 15, min_qty: 5, reorder_qty: 20, location: 'Yard pile C', supplier: 'Ricoter', unit_price: 18.00, selling_price: 38.00 },
  { part_number: 'C-CHM-001', name: 'Weed control concentrate — 10L', category: 'CHEMICALS', unit: 'l', stock_qty: 20, min_qty: 5, reorder_qty: 20, location: 'Chem store', supplier: 'Landi', unit_price: 12.50, selling_price: 22.00 },
  { part_number: 'C-PIP-001', name: 'Drainage pipe DN100 — per m', category: 'PIPES_FITTINGS', unit: 'm', stock_qty: 80, min_qty: 20, reorder_qty: 100, location: 'Rack G1', supplier: 'Debrunner', unit_price: 4.50, selling_price: 9.00 },
  { part_number: 'C-PIP-002', name: 'PVC elbow DN100 45°', category: 'PIPES_FITTINGS', unit: 'pcs', stock_qty: 30, min_qty: 10, reorder_qty: 30, location: 'Rack G1', supplier: 'Debrunner', unit_price: 3.20, selling_price: 7.50 },
  { part_number: 'C-GEO-001', name: 'Geotextile 200g/m² — per m²', category: 'GEOTEXTILE', unit: 'm²', stock_qty: 500, min_qty: 100, reorder_qty: 500, location: 'Roll store', supplier: 'Sika', unit_price: 1.80, selling_price: 4.50 },
  { part_number: 'C-GEO-002', name: 'Root barrier HDPE 1mm — per m', category: 'GEOTEXTILE', unit: 'm', stock_qty: 60, min_qty: 15, reorder_qty: 50, location: 'Roll store', supplier: 'Sika', unit_price: 8.00, selling_price: 16.00 },
  { part_number: 'C-CON-001', name: 'Quick-set concrete 25kg bag', category: 'CONCRETE_CEMENT', unit: 'bag', stock_qty: 40, min_qty: 10, reorder_qty: 40, location: 'Rack H1', supplier: 'Holcim', unit_price: 8.50, selling_price: 15.00 },
  { part_number: 'C-CON-002', name: 'Lean concrete C12/15 (per m³)', category: 'CONCRETE_CEMENT', unit: 'm³', stock_qty: 0, min_qty: 0, reorder_qty: 0, location: 'Delivered', supplier: 'Holcim', unit_price: 145.00, selling_price: 210.00 },
  { part_number: 'C-FUE-001', name: 'Diesel (per litre)', category: 'FUEL_LUBRICANTS', unit: 'l', stock_qty: 2000, min_qty: 500, reorder_qty: 3000, location: 'Tank', supplier: 'Migrol', unit_price: 1.72, selling_price: 2.20 },
  { part_number: 'C-RNT-001', name: 'Plate compactor — day rental', category: 'RENTAL', unit: 'pcs', stock_qty: 3, min_qty: 0, reorder_qty: 0, location: 'Workshop', supplier: '', unit_price: 0, selling_price: 85.00 },
  { part_number: 'C-RNT-002', name: 'Jumping jack — day rental', category: 'RENTAL', unit: 'pcs', stock_qty: 2, min_qty: 0, reorder_qty: 0, location: 'Workshop', supplier: '', unit_price: 0, selling_price: 65.00 },
];