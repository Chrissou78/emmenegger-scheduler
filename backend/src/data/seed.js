import { supabase } from '../lib/supabaseClient';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('Seeding Emmenegger database...');

  // Generate password hash
  const hash = await bcrypt.hash('emmenegger2026', 12);

  // ─── USERS ───
  const usersData = [
    // Garten & Tiefbau
    { email: 'marco.cancela@emmenegger.ch', password_hash: hash, first_name: 'Marco', last_name: 'Cancela', role: 'LOCAL_MANAGER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'antonio@emmenegger.ch', password_hash: hash, first_name: 'Antonio', last_name: '', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'fabian@emmenegger.ch', password_hash: hash, first_name: 'Fabian', last_name: '', role: 'LOCAL_MANAGER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'tomek@emmenegger.ch', password_hash: hash, first_name: 'Tomek', last_name: '', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'thomas.kaeser@emmenegger.ch', password_hash: hash, first_name: 'Thomas', last_name: 'Käser', role: 'LOCAL_MANAGER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'milan@emmenegger.ch', password_hash: hash, first_name: 'Milan', last_name: '', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'martin@emmenegger.ch', password_hash: hash, first_name: 'Martin', last_name: '', role: 'LOCAL_MANAGER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'matchek@emmenegger.ch', password_hash: hash, first_name: 'Matchek', last_name: '', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'yves@emmenegger.ch', password_hash: hash, first_name: 'Yves', last_name: '', role: 'LOCAL_MANAGER', departments: ['GARTEN_TIEFBAU'] },
    { email: 'paede.appenzeller@emmenegger.ch', password_hash: hash, first_name: 'Päde', last_name: 'Appenzeller', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU'] },
    // Unterhalt
    { email: 'urs.liebi@emmenegger.ch', password_hash: hash, first_name: 'Urs', last_name: 'Liebi', role: 'LOCAL_MANAGER', departments: ['UNTERHALT'] },
    { email: 'attila.dobos@emmenegger.ch', password_hash: hash, first_name: 'Attila', last_name: 'Dobos', role: 'ARBEITER', departments: ['UNTERHALT'] },
    { email: 'slavisa.damjanovic@emmenegger.ch', password_hash: hash, first_name: 'Slavisa', last_name: 'Damjanovic', role: 'LOCAL_MANAGER', departments: ['UNTERHALT'] },
    { email: 'brigitte.naef@emmenegger.ch', password_hash: hash, first_name: 'Brigitte', last_name: 'Näf', role: 'LOCAL_MANAGER', departments: ['UNTERHALT'] },
    // Shared
    { email: 'sabrina.lehmann@emmenegger.ch', password_hash: hash, first_name: 'Sabrina', last_name: 'Lehmann', role: 'GLOBAL_MANAGER', departments: ['GARTEN_TIEFBAU', 'UNTERHALT'] },
    { email: 'luc.huber@emmenegger.ch', password_hash: hash, first_name: 'Luc', last_name: 'Huber', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU', 'UNTERHALT'] },
    { email: 'admin@emmenegger.ch', password_hash: hash, first_name: 'Admin', last_name: 'Emmenegger', role: 'GLOBAL_MANAGER', departments: ['GARTEN_TIEFBAU', 'UNTERHALT'] },
  ];

  const { data: users, error: usersError } = await supabase
    .from('users')
    .upsert(usersData, { onConflict: 'email' });

  if (usersError) {
    console.error('Error creating users:', usersError);
  } else {
    console.log(`Created ${users?.length || 0} users`);
  }

  // ─── MACHINES ───
  const machinesData = [
    { inventory_nr: '4001', name: 'Raupen Bagger Kobelco 0.8 to', category: 'RAUPEN_BAGGER', tonnage: 0.8, operator: 'EMMENEGGER' },
    { inventory_nr: '4010', name: 'Raupen Bagger TB215 alt 1.5 to', category: 'RAUPEN_BAGGER', tonnage: 1.5, operator: 'EMMENEGGER' },
    { inventory_nr: '4011', name: 'Raupen Bagger TB215 neu 1.5 to', category: 'RAUPEN_BAGGER', tonnage: 1.5, operator: 'EMMENEGGER' },
    { inventory_nr: '4012', name: 'Raupen Bagger TB016 alt 1.6 to', category: 'RAUPEN_BAGGER', tonnage: 1.6, operator: 'EMMENEGGER' },
    { inventory_nr: '4013', name: 'Raupen Bagger TB216 neu 1.6 to', category: 'RAUPEN_BAGGER', tonnage: 1.6, operator: 'EMMENEGGER' },
    { inventory_nr: '4021', name: 'Raupen Bagger Case 2.8 to', category: 'RAUPEN_BAGGER', tonnage: 2.8, operator: 'EMMENEGGER' },
    { inventory_nr: '4030', name: 'Raupen Bagger TB230 Takeuchi 2.8 to', category: 'RAUPEN_BAGGER', tonnage: 2.8, operator: 'EMMENEGGER' },
    { inventory_nr: '4031', name: 'Raupen Bagger TB240 Takeuchi 4.0 to', category: 'RAUPEN_BAGGER', tonnage: 4.0, operator: 'EMMENEGGER' },
    { inventory_nr: '4040', name: 'Raupen Bagger Cat 5.0 to', category: 'RAUPEN_BAGGER', tonnage: 5.0, operator: 'EMMENEGGER' },
    { inventory_nr: '4050', name: 'Raupen Bagger Wacker 6.0 to', category: 'RAUPEN_BAGGER', tonnage: 6.0, operator: 'EMMENEGGER' },
    { inventory_nr: '4060', name: 'Raupen Bagger TB290 Takeuchi 9.0 to', category: 'RAUPEN_BAGGER', tonnage: 9.0, operator: 'EMMENEGGER' },
    { inventory_nr: '4070', name: 'Raupen Bagger Kobelco 16.0 to', category: 'RAUPEN_BAGGER', tonnage: 16.0, operator: 'EMMENEGGER' },
    { inventory_nr: '4080', name: 'Raupen Bagger Kobelco 28.0 to', category: 'RAUPEN_BAGGER', tonnage: 28.0, operator: 'EMMENEGGER' },
    { inventory_nr: '4090', name: 'Raupen Bagger Menzi 1.8 to', category: 'RAUPEN_BAGGER', tonnage: 1.8, operator: 'EMMENEGGER' },
    { inventory_nr: '4091', name: 'Raupen Bagger Kubota 9.0 to', category: 'RAUPEN_BAGGER', tonnage: 9.0, operator: 'EMMENEGGER' },
    { inventory_nr: '5010', name: 'Pneu Bagger Takeuchi 16 to', category: 'PNEU_BAGGER', tonnage: 16.0, operator: 'EMMENEGGER' },
    { inventory_nr: '5020', name: 'Pneu Bagger Komatsu 16 to', category: 'PNEU_BAGGER', tonnage: 16.0, operator: 'EMMENEGGER' },
    { inventory_nr: '6010', name: 'Radlader Schäfer 2.5 to', category: 'RADLADER', tonnage: 2.5, operator: 'EMMENEGGER' },
    { inventory_nr: '6020', name: 'Radlader Wacker WL 32 3.5 to', category: 'RADLADER', tonnage: 3.5, operator: 'EMMENEGGER' },
    { inventory_nr: '6030', name: 'Radlader Wacker WL 60 6.0 to', category: 'RADLADER', tonnage: 6.0, operator: 'EMMENEGGER' },
    { inventory_nr: '6040', name: 'Radlader Volvo 9.0 to', category: 'RADLADER', tonnage: 9.0, operator: 'EMMENEGGER' },
    { inventory_nr: '7010', name: 'Raupen Dumper Hucki 0.4 to', category: 'RAUPEN_DUMPER', tonnage: 0.4, operator: 'EMMENEGGER' },
    { inventory_nr: '7020', name: 'Raupen Dumper Hucki 0.6 to', category: 'RAUPEN_DUMPER', tonnage: 0.6, operator: 'EMMENEGGER' },
    { inventory_nr: '7030', name: 'Raupen Dumper Hucki 1.0 to', category: 'RAUPEN_DUMPER', tonnage: 1.0, operator: 'EMMENEGGER' },
    { inventory_nr: '8010', name: 'Rad Dumper Thwaits alt 1.0 to', category: 'RAD_DUMPER', tonnage: 1.0, operator: 'EMMENEGGER' },
    { inventory_nr: '8020', name: 'Rad Dumper Thwaits neu 1000 l', category: 'RAD_DUMPER', tonnage: 1.0, operator: 'EMMENEGGER' },
    { inventory_nr: '8030', name: 'Rad Dumper Wacker neu 2500 l', category: 'RAD_DUMPER', tonnage: 2.5, operator: 'EMMENEGGER' },
    { inventory_nr: '9001', name: 'Ramax Grabenwalze', category: 'WALZE', operator: 'EMMENEGGER' },
    { inventory_nr: '3001', name: 'LKW weiss', category: 'LKW', operator: 'EMMENEGGER' },
    { inventory_nr: '3002', name: 'LKW blau', category: 'LKW', operator: 'EMMENEGGER' },
  ];

  const { data: machines, error: machinesError } = await supabase
    .from('machines')
    .upsert(machinesData, { onConflict: 'inventory_nr' });

  if (machinesError) {
    console.error('Error creating machines:', machinesError);
  } else {
    console.log(`Created ${machines?.length || 0} machines`);
  }

  // ─── CUSTOMERS ───
  const customersData = [
    { name: 'Alte Landstrasse, Männedorf' },
    { name: 'Andy Privat, Männedorf' },
    { name: 'Antonius, Egg' },
    { name: 'Bernasconi, Meilen' },
    { name: 'Born, Ebmatingen' },
    { name: 'Bost, Maur' },
    { name: 'Camenisch, Egg' },
    { name: 'Canziani, Egg' },
    { name: 'Caspar Steiger, Männedorf' },
    { name: 'Castrovinci, Egg' },
    { name: 'Cathrain, Egg' },
    { name: 'Fam. Salzmann Küsnacht' },
    { name: 'Frau Lederman Erlenbach' },
    { name: 'Heslibachstrasse 65, Küsnacht' },
    { name: 'MFH Höhestr. 60 Zollikon' },
    { name: 'MFH Lindenstr. Nänikon' },
  ];

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .insert(customersData);

  if (customersError) {
    console.error('Error creating customers:', customersError);
  } else {
    console.log(`Created ${customers?.length || 0} customers`);
  }

  // ─── SPARE PARTS (Maintenance) ───
  const maintenancePartsData = [
    { part_number: 'M-SHV-001', name: 'Excavator bucket teeth', category: 'WEAR_PARTS', unit: 'pcs', stock_qty: 24, min_qty: 10, reorder_qty: 20, location: 'Rack A1', supplier: 'Baumag AG', unit_price: 18.50, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-SHV-002', name: 'Flat shovel blade 30cm', category: 'SHOVELS_BLADES', unit: 'pcs', stock_qty: 6, min_qty: 3, reorder_qty: 6, location: 'Rack A1', supplier: 'Baumag AG', unit_price: 45.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-SHV-003', name: 'Pointed shovel replacement handle', category: 'SHOVELS_BLADES', unit: 'pcs', stock_qty: 4, min_qty: 2, reorder_qty: 5, location: 'Rack A1', supplier: 'Jumbo', unit_price: 12.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-OIL-001', name: 'Hydraulic oil ISO 46 — 20L', category: 'OIL_FLUIDS', unit: 'l', stock_qty: 60, min_qty: 40, reorder_qty: 100, location: 'Oil store', supplier: 'Motorex', unit_price: 3.80, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-OIL-002', name: 'Engine oil 10W-40 — 5L', category: 'OIL_FLUIDS', unit: 'l', stock_qty: 25, min_qty: 15, reorder_qty: 50, location: 'Oil store', supplier: 'Motorex', unit_price: 8.20, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-OIL-003', name: 'Grease cartridge EP2 400g', category: 'OIL_FLUIDS', unit: 'pcs', stock_qty: 18, min_qty: 6, reorder_qty: 12, location: 'Oil store', supplier: 'Motorex', unit_price: 5.50, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-FAS-001', name: 'Hex bolt M10×30 Grade 8.8', category: 'FASTENERS', unit: 'pcs', stock_qty: 200, min_qty: 50, reorder_qty: 200, location: 'Rack B2', supplier: 'Bossard', unit_price: 0.35, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-FAS-002', name: 'Self-lock nut M10', category: 'FASTENERS', unit: 'pcs', stock_qty: 200, min_qty: 50, reorder_qty: 200, location: 'Rack B2', supplier: 'Bossard', unit_price: 0.18, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-FIL-001', name: 'Engine air filter — Takeuchi TB230', category: 'FILTERS', unit: 'pcs', stock_qty: 3, min_qty: 2, reorder_qty: 4, location: 'Rack C1', supplier: 'Kramer AG', unit_price: 42.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-FIL-002', name: 'Hydraulic return filter — Kobelco 16t', category: 'FILTERS', unit: 'pcs', stock_qty: 2, min_qty: 1, reorder_qty: 3, location: 'Rack C1', supplier: 'Kramer AG', unit_price: 68.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-BLT-001', name: 'V-belt A68', category: 'BELTS_HOSES', unit: 'pcs', stock_qty: 3, min_qty: 1, reorder_qty: 3, location: 'Rack C2', supplier: 'Kramer AG', unit_price: 22.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-BLT-002', name: 'Hydraulic hose 1/2" — 1.5m', category: 'BELTS_HOSES', unit: 'pcs', stock_qty: 5, min_qty: 2, reorder_qty: 6, location: 'Rack C2', supplier: 'Pirtek', unit_price: 55.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-ELC-001', name: 'Beacon lamp LED amber', category: 'ELECTRICAL', unit: 'pcs', stock_qty: 4, min_qty: 2, reorder_qty: 4, location: 'Rack D1', supplier: 'Meier Tobler', unit_price: 38.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-HYD-001', name: 'Hydraulic quick coupler 1/2"', category: 'HYDRAULIC', unit: 'pcs', stock_qty: 8, min_qty: 4, reorder_qty: 8, location: 'Rack D2', supplier: 'Pirtek', unit_price: 14.50, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-SAF-001', name: 'Safety glasses clear (pack 12)', category: 'SAFETY', unit: 'box', stock_qty: 3, min_qty: 1, reorder_qty: 3, location: 'Safety cabinet', supplier: 'Jumbo', unit_price: 28.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-SAF-002', name: 'Ear muffs — Peltor X4', category: 'SAFETY', unit: 'pcs', stock_qty: 6, min_qty: 3, reorder_qty: 6, location: 'Safety cabinet', supplier: 'Jumbo', unit_price: 35.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-WER-001', name: 'Track rubber pad — TB230', category: 'WEAR_PARTS', unit: 'pcs', stock_qty: 10, min_qty: 4, reorder_qty: 10, location: 'Rack E1', supplier: 'Kramer AG', unit_price: 85.00, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
    { part_number: 'M-GEN-001', name: 'Duct tape 50mm × 50m', category: 'GENERAL', unit: 'roll', stock_qty: 8, min_qty: 3, reorder_qty: 10, location: 'Rack F1', supplier: 'Jumbo', unit_price: 6.50, part_type: 'MAINTENANCE', is_sellable: false, selling_price: 0, is_active: true },
  ];

  // ─── SPARE PARTS (Consumables) ───
  const consumablePartsData = [
    { part_number: 'C-AGG-001', name: 'Gravel 0/32 round (per ton)', category: 'AGGREGATES', unit: 't', stock_qty: 45, min_qty: 10, reorder_qty: 50, location: 'Yard silo 1', supplier: 'Kibag', unit_price: 28.00, selling_price: 42.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-AGG-002', name: 'Sand 0/4 washed (per ton)', category: 'AGGREGATES', unit: 't', stock_qty: 30, min_qty: 8, reorder_qty: 40, location: 'Yard silo 2', supplier: 'Kibag', unit_price: 22.00, selling_price: 35.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-AGG-003', name: 'Crushed stone 32/63 (per ton)', category: 'AGGREGATES', unit: 't', stock_qty: 20, min_qty: 5, reorder_qty: 30, location: 'Yard pile A', supplier: 'Kibag', unit_price: 26.00, selling_price: 40.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-PLT-001', name: 'Topsoil screened (per m³)', category: 'PLANTS_GREEN', unit: 'm³', stock_qty: 35, min_qty: 10, reorder_qty: 50, location: 'Yard pile B', supplier: 'Ricoter', unit_price: 32.00, selling_price: 55.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-PLT-002', name: 'Bark mulch (per m³)', category: 'PLANTS_GREEN', unit: 'm³', stock_qty: 15, min_qty: 5, reorder_qty: 20, location: 'Yard pile C', supplier: 'Ricoter', unit_price: 18.00, selling_price: 38.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-CHM-001', name: 'Weed control concentrate — 10L', category: 'CHEMICALS', unit: 'l', stock_qty: 20, min_qty: 5, reorder_qty: 20, location: 'Chem store', supplier: 'Landi', unit_price: 12.50, selling_price: 22.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-PIP-001', name: 'Drainage pipe DN100 — per m', category: 'PIPES_FITTINGS', unit: 'm', stock_qty: 80, min_qty: 20, reorder_qty: 100, location: 'Rack G1', supplier: 'Debrunner', unit_price: 4.50, selling_price: 9.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-PIP-002', name: 'PVC elbow DN100 45°', category: 'PIPES_FITTINGS', unit: 'pcs', stock_qty: 30, min_qty: 10, reorder_qty: 30, location: 'Rack G1', supplier: 'Debrunner', unit_price: 3.20, selling_price: 7.50, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-GEO-001', name: 'Geotextile 200g/m² — per m²', category: 'GEOTEXTILE', unit: 'm²', stock_qty: 500, min_qty: 100, reorder_qty: 500, location: 'Roll store', supplier: 'Sika', unit_price: 1.80, selling_price: 4.50, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-GEO-002', name: 'Root barrier HDPE 1mm — per m', category: 'GEOTEXTILE', unit: 'm', stock_qty: 60, min_qty: 15, reorder_qty: 50, location: 'Roll store', supplier: 'Sika', unit_price: 8.00, selling_price: 16.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-CON-001', name: 'Quick-set concrete 25kg bag', category: 'CONCRETE_CEMENT', unit: 'bag', stock_qty: 40, min_qty: 10, reorder_qty: 40, location: 'Rack H1', supplier: 'Holcim', unit_price: 8.50, selling_price: 15.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-CON-002', name: 'Lean concrete C12/15 (per m³)', category: 'CONCRETE_CEMENT', unit: 'm³', stock_qty: 0, min_qty: 0, reorder_qty: 0, location: 'Delivered', supplier: 'Holcim', unit_price: 145.00, selling_price: 210.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-FUE-001', name: 'Diesel (per litre)', category: 'FUEL_LUBRICANTS', unit: 'l', stock_qty: 2000, min_qty: 500, reorder_qty: 3000, location: 'Tank', supplier: 'Migrol', unit_price: 1.72, selling_price: 2.20, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-RNT-001', name: 'Plate compactor — day rental', category: 'RENTAL', unit: 'pcs', stock_qty: 3, min_qty: 0, reorder_qty: 0, location: 'Workshop', supplier: '', unit_price: 0, selling_price: 85.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
    { part_number: 'C-RNT-002', name: 'Jumping jack — day rental', category: 'RENTAL', unit: 'pcs', stock_qty: 2, min_qty: 0, reorder_qty: 0, location: 'Workshop', supplier: '', unit_price: 0, selling_price: 65.00, part_type: 'CONSUMABLE', is_sellable: true, is_active: true },
  ];

  const allPartsData = [...maintenancePartsData, ...consumablePartsData];

  const { data: spareParts, error: sparePartsError } = await supabase
    .from('spare_parts')
    .upsert(allPartsData, { onConflict: 'part_number' });

  if (sparePartsError) {
    console.error('Error creating spare parts:', sparePartsError);
  } else {
    console.log(`Created ${spareParts?.length || allPartsData.length} spare parts (${maintenancePartsData.length} maintenance + ${consumablePartsData.length} consumables)`);
  }

  // ─── MARGIN RULES (default) ───
  const { error: marginError } = await supabase
    .from('margin_rules')
    .upsert([
      { scope: 'DEFAULT', margin_pct: 50, is_active: true },
    ], { onConflict: 'id' });

  if (marginError) {
    console.error('Error creating margin rules:', marginError);
  } else {
    console.log('Created default margin rule (50%)');
  }

  console.log('Seed complete. Default password for all accounts: emmenegger2026');
}
