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

  console.log('Seed complete. Default password for all accounts: emmenegger2026');
}
