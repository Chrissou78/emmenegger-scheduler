// backend/src/data/migrate-excel.ts
// Emmenegger Migration v6 — strict employee filtering
import XLSX from 'xlsx';
import path from 'path';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';

const SOURCE = path.resolve(__dirname, '../../../Source');

function readWb(f: string) {
  console.log(`  📖 ${f}`);
  return XLSX.readFile(path.join(SOURCE, f), { type: 'file', cellDates: true });
}
function raw(wb: XLSX.WorkBook, sn: string): any[][] {
  const ws = wb.Sheets[sn];
  return ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]) : [];
}
function cl(v: any): string { return String(v ?? '').trim(); }
function kw(sn: string): number | null {
  const m = sn.match(/KW\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

async function ups(table: string, data: any[], conflict: string) {
  if (!data.length) return 0;
  let t = 0;
  for (let i = 0; i < data.length; i += 200) {
    const { error, data: r } = await supabase.from(table).upsert(data.slice(i, i + 200), { onConflict: conflict }).select();
    if (error) console.error(`  ❌ upsert ${table}:`, error.message);
    else t += r?.length || 0;
  }
  return t;
}
async function ins(table: string, data: any[]) {
  if (!data.length) return 0;
  let t = 0;
  for (let i = 0; i < data.length; i += 200) {
    const { error, data: r } = await supabase.from(table).insert(data.slice(i, i + 200)).select();
    if (error) console.error(`  ❌ insert ${table}:`, error.message);
    else t += r?.length || 0;
  }
  return t;
}

// ─── Valid role letters (col 0 of employee rows) ───
const ROLE_LETTERS = new Set(['M', 'V', 'L', 'T', 'U', 'XTB']);

// ─── Non-person entries to skip even if they have a role letter ───
const SKIP_NAMES = new Set([
  'magazin', 'magazin / werkstatt', 'bau', 'unterhalt', 'werkstatt',
  'div.transporte', 'div. transporte', 'diverses', 'winterdienst',
  'winterdienstroute', 'schlechtwetter', 'inventar/auto', 'kurs',
  'lerntag', 'reservearbeiten', 'weihnachtsessen', 'sichtschutz chef',
  'neubau emmenegger', 'filippe unterhalt', 'uterhalt',
  'pizol winter', 'schnuppi mathieus', 'schnuppi jasmin',
]);

function isRealEmployee(col0: string, col1: string): boolean {
  if (!ROLE_LETTERS.has(col0)) return false;
  if (!col1 || col1.length < 2) return false;
  const low = col1.toLowerCase();
  if (SKIP_NAMES.has(low)) return false;
  // Skip if it looks like an address (contains comma + town, or street number)
  if (/\d{2,},/.test(col1)) return false;
  if (/strasse|straße|weg\s+\d/i.test(col1) && /,/.test(col1)) return false;
  // Must contain at least one letter
  return /[a-zA-ZäöüÄÖÜéèà]/.test(col1);
}

async function migrate() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Emmenegger Migration v6');
  console.log('══════════════════════════════════════════');

  // CLEANUP
  console.log('\n🧹 Cleaning...');
  await supabase.from('allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('machine_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('weeks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('machines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  ✅ Done');

  // READ
  console.log('\n📂 Reading...');
  const wb01 = readWb('01-Monatsplan 2026 Garten- Tiefbau (1).xlsx');
  const wb01a = readWb('01a-Monatsplan 2026 Unterhalt (1).xlsx');
  const wb02 = readWb('02-Maschinen Dispo (1).xlsx');

  // ═════════════════════════════════════════
  // PHASE 1: USERS — strict role-letter filter
  // ═════════════════════════════════════════
  console.log('\n👤 Phase 1: Employees...');

  const empMap = new Map<string, { name: string; role: string }>(); // key=lowercase → {original, roleLetter}
  const gtEmps = new Set<string>();
  const uhEmps = new Set<string>();

  function scanEmps(wb: XLSX.WorkBook, dept: Set<string>) {
    for (const sn of wb.SheetNames) {
      if (!kw(sn) && sn !== '2026') continue;
      const rows = raw(wb, sn);
      for (let r = 4; r < rows.length; r++) {
        const c0 = cl(rows[r][0]);
        const c1 = cl(rows[r][1]);
        if (c0.toLowerCase() === 'objekt' || c1.toLowerCase() === 'objekt') break;
        if (!isRealEmployee(c0, c1)) continue;
        const key = c1.toLowerCase();
        dept.add(key);
        if (!empMap.has(key)) {
          empMap.set(key, { name: c1, role: c0 });
        }
      }
    }
  }

  scanEmps(wb01, gtEmps);
  scanEmps(wb01a, uhEmps);
  console.log(`  Found ${empMap.size} unique employees`);

  // Known email overrides
  const knownEmails: Record<string, string> = {
    'marco cancela': 'marco.cancela@emmenegger.ch',
    'thomas käser': 'thomas.kaeser@emmenegger.ch',
    'käser thomas': 'thomas.kaeser@emmenegger.ch',
    'päde appenzeller': 'paede.appenzeller@emmenegger.ch',
    'urs liebi': 'urs.liebi@emmenegger.ch',
    'attila dobos': 'attila.dobos@emmenegger.ch',
    'slavisa damjanovic': 'slavisa.damjanovic@emmenegger.ch',
    'salvisa damjanovic': 'slavisa.damjanovic@emmenegger.ch',
    'brigitte näf': 'brigitte.naef@emmenegger.ch',
    'sabrina lehmann': 'sabrina.lehmann@emmenegger.ch',
    'luc huber': 'luc.huber@emmenegger.ch',
    'cyrill bachofen': 'cyrill.bachofen@emmenegger.ch',
    'fabian bollier': 'fabian.bollier@emmenegger.ch',
    'yves kalt': 'yves.kalt@emmenegger.ch',
  };

  const roleToDb: Record<string, string> = {
    'V': 'LOCAL_MANAGER', 'L': 'LOCAL_MANAGER',
    'M': 'ARBEITER', 'T': 'ARBEITER', 'U': 'ARBEITER', 'XTB': 'ARBEITER',
  };

  const globalManagers = new Set(['sabrina lehmann']);

  const hash = await bcrypt.hash('emmenegger2026', 12);
  const adminHash = await bcrypt.hash('admin', 12);

  const userRecords: any[] = [
    { email: 'admin@emmenegger.ch', password_hash: adminHash, first_name: 'Admin', last_name: 'Emmenegger', role: 'GLOBAL_MANAGER', departments: ['GARTEN_TIEFBAU', 'UNTERHALT'], is_active: true },
    { email: 'worker@emmenegger.ch', password_hash: hash, first_name: 'Worker', last_name: 'Demo', role: 'ARBEITER', departments: ['GARTEN_TIEFBAU'], is_active: true },
  ];
  const usedEmails = new Set(['admin@emmenegger.ch', 'worker@emmenegger.ch']);

  // Also track name aliases → same email (for typos)
  const nameToEmail: Record<string, string> = {};

  for (const [key, { name, role }] of empMap) {
    let email = knownEmails[key];
    if (!email) {
      const slug = name.toLowerCase()
        .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue')
        .replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[ï]/g, 'i')
        .replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      email = `${slug}@emmenegger.ch`;
    }
    nameToEmail[key] = email;
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);

    const parts = name.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    const depts: string[] = [];
    if (gtEmps.has(key)) depts.push('GARTEN_TIEFBAU');
    if (uhEmps.has(key)) depts.push('UNTERHALT');
    if (!depts.length) depts.push('GARTEN_TIEFBAU');

    const dbRole = globalManagers.has(key) ? 'GLOBAL_MANAGER' : (roleToDb[role] || 'ARBEITER');

    userRecords.push({
      email, password_hash: hash,
      first_name: firstName, last_name: lastName,
      role: dbRole, departments: depts, is_active: true,
    });
  }

  // Add known employees not in Excel
  const extraKnown = [
    { email: 'brigitte.naef@emmenegger.ch', first_name: 'Brigitte', last_name: 'Näf', role: 'LOCAL_MANAGER', departments: ['UNTERHALT'] },
  ];
  for (const ek of extraKnown) {
    if (!usedEmails.has(ek.email)) {
      usedEmails.add(ek.email);
      userRecords.push({ ...ek, password_hash: hash, is_active: true });
    }
  }

  const userCount = await ups('users', userRecords, 'email');
  console.log(`  ✅ Users: ${userCount}`);

  // Build user lookup
  const { data: allUsers } = await supabase.from('users').select('id, email, first_name, last_name');
  const userLookup: Record<string, string> = {};
  for (const u of allUsers || []) {
    const full = `${u.first_name} ${u.last_name}`.trim().toLowerCase();
    userLookup[full] = u.id;
    userLookup[u.first_name.toLowerCase()] = u.id;
  }
  // Add aliases for typos
  if (userLookup['slavisa damjanovic']) userLookup['salvisa damjanovic'] = userLookup['slavisa damjanovic'];
  if (userLookup['thomas käser']) userLookup['käser thomas'] = userLookup['thomas käser'];
  if (userLookup['milan damjanovic']) userLookup['milan damjanivic'] = userLookup['milan damjanovic'];
  if (userLookup['krzystof kwasniewski']) userLookup['krystof kwasnievski'] = userLookup['krzystof kwasniewski'];
  if (userLookup['erno vizi']) userLookup['erne vizi'] = userLookup['erno vizi'];
  // Also map via nameToEmail for duplicates
  for (const [key] of empMap) {
    const email = nameToEmail[key];
    if (email) {
      const user = allUsers?.find(u => u.email === email);
      if (user) userLookup[key] = user.id;
    }
  }

  const adminId = allUsers?.find(u => u.email === 'admin@emmenegger.ch')?.id;

  // ═════════════════════════════════════════
  // PHASE 2: MACHINES
  // ═════════════════════════════════════════
  console.log('\n🚜 Phase 2: Machines...');

  const machinesData = [
    { inventory_nr: '4001', name: 'Raupen Bagger Kobelco 0.8 to', category: 'RAUPEN_BAGGER', tonnage: 0.8, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4002', name: 'Raupen Bagger TB215 alt 1.5 to', category: 'RAUPEN_BAGGER', tonnage: 1.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4003', name: 'Raupen Bagger TB215 neu 1.5 to', category: 'RAUPEN_BAGGER', tonnage: 1.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4004', name: 'Raupen Bagger TB016 alt 1.6 to', category: 'RAUPEN_BAGGER', tonnage: 1.6, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4005', name: 'Raupen Bagger TB216 neu 1.6 to', category: 'RAUPEN_BAGGER', tonnage: 1.6, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4006', name: 'Raupen Bagger Case 2.8 to', category: 'RAUPEN_BAGGER', tonnage: 2.8, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4007', name: 'Raupen Bagger TB230 Takeuchi 2.8 to', category: 'RAUPEN_BAGGER', tonnage: 2.8, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4008', name: 'Raupen Bagger TB240 Takeuchi 4.0 to', category: 'RAUPEN_BAGGER', tonnage: 4.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4010', name: 'Raupen Bagger Wacker 6.0 to', category: 'RAUPEN_BAGGER', tonnage: 6.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4011', name: 'Raupen Bagger TB290 Takeuchi 9.0 to', category: 'RAUPEN_BAGGER', tonnage: 9.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4012', name: 'Raupen Bagger Kobelco 16.0 to', category: 'RAUPEN_BAGGER', tonnage: 16.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4013', name: 'Raupen Bagger Kobelco 28.0 to', category: 'RAUPEN_BAGGER', tonnage: 28.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '4014', name: 'Raupen Bagger Menzi 1.8 to', category: 'RAUPEN_BAGGER', tonnage: 1.8, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '4015', name: 'Raupen Bagger Kubota 9.0 to', category: 'RAUPEN_BAGGER', tonnage: 9.0, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '5001', name: 'Pneu Bagger Takeuchi 16 to', category: 'PNEU_BAGGER', tonnage: 16.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '5002', name: 'Pneu Bagger Komatsu 16 to', category: 'PNEU_BAGGER', tonnage: 16.0, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '6001', name: 'Radlader Schäfer 2.5 to', category: 'RADLADER', tonnage: 2.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '6002', name: 'Radlader Wacker WL 32 3.5 to', category: 'RADLADER', tonnage: 3.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '6003', name: 'Radlader Wacker WL 60 6.0 to', category: 'RADLADER', tonnage: 6.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '6004', name: 'Radlader Volvo 9.0 to', category: 'RADLADER', tonnage: 9.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '7001', name: 'Raupen Dumper Hucki 0.4 to', category: 'RAUPEN_DUMPER', tonnage: 0.4, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '7002', name: 'Raupen Dumper Hucki 0.6 to', category: 'RAUPEN_DUMPER', tonnage: 0.6, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '7003', name: 'Raupen Dumper Hucki 1.0 to', category: 'RAUPEN_DUMPER', tonnage: 1.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '7010', name: 'Rad Dumper Thwaits alt 1.0 to', category: 'RAD_DUMPER', tonnage: 1.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '7011', name: 'Rad Dumper Thwaits neu 1000 l', category: 'RAD_DUMPER', tonnage: 1.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '7012', name: 'Rad Dumper Wacker neu 2500 l', category: 'RAD_DUMPER', tonnage: 2.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '8001', name: 'Ramax Grabenwalze', category: 'WALZE', operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '3001', name: 'LKW weiss', category: 'LKW', operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '3002', name: 'LKW blau', category: 'LKW', operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9001', name: 'Spitzhammer an Bagger 1.9 to', category: 'ANBAUGERAET', tonnage: 1.9, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '9002', name: 'Spitzhammer an Bagger 1.5 to', category: 'ANBAUGERAET', tonnage: 1.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9003', name: 'Spitzhammer an Bagger 3.5 to', category: 'ANBAUGERAET', tonnage: 3.5, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9004', name: 'Spitzhammer an Bagger 6.0 to', category: 'ANBAUGERAET', tonnage: 6.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9005', name: 'Spitzhammer an Bagger 15.0 to', category: 'ANBAUGERAET', tonnage: 15.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9006', name: 'Spitzhammer an Bagger 15.0 to (2)', category: 'ANBAUGERAET', tonnage: 15.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9007', name: 'Spitzhammer an Bagger 30.0 to', category: 'ANBAUGERAET', tonnage: 30.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9008', name: 'Vibroplatten an Bagger 30.0 to', category: 'ANBAUGERAET', tonnage: 30.0, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '9009', name: 'Holzgreifer an Bagger 9.0 to', category: 'ANBAUGERAET', tonnage: 9.0, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '9010', name: 'Beton Beisser an Bagger 30.0 to', category: 'ANBAUGERAET', tonnage: 30.0, operator: 'APPENZELLER', is_active: true },
    { inventory_nr: '9011', name: 'Steingreifer', category: 'ANBAUGERAET', operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9012', name: 'Beton Beisser an Bagger 30.0 to (2)', category: 'ANBAUGERAET', tonnage: 30.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9013', name: 'Vibroplatten an Bagger 30.0 to (2)', category: 'ANBAUGERAET', tonnage: 30.0, operator: 'EMMENEGGER', is_active: true },
    { inventory_nr: '9014', name: 'Felsfräse an Bagger', category: 'ANBAUGERAET', operator: 'EMMENEGGER', is_active: true },
  ];

  const machineCount = await ups('machines', machinesData, 'inventory_nr');
  console.log(`  ✅ Machines: ${machineCount}`);

  const { data: allMachDb } = await supabase.from('machines').select('id, inventory_nr, name');
  const machLookup: Record<string, string> = {};
  for (const m of allMachDb || []) {
    machLookup[m.name.toLowerCase().trim()] = m.id;
    machLookup[m.inventory_nr] = m.id;
  }

  // ═════════════════════════════════════════
  // PHASE 3: CUSTOMERS & TASKS from Objekt sections
  // Only scan rows AFTER the "Objekt" header
  // col 0 = code (a-z or 1-9), col 1 = customer name
  // ═════════════════════════════════════════
  console.log('\n🏗️  Phase 3: Customers & Tasks...');

  const custNames = new Set<string>();
  type TaskDef = { name: string; description: string };
  const gtTasks: Record<string, Record<string, TaskDef>> = {};
  const uhTasks: Record<string, Record<string, TaskDef>> = {};

  function scanObjs(wb: XLSX.WorkBook, target: Record<string, Record<string, TaskDef>>) {
    for (const sn of wb.SheetNames) {
      if (!kw(sn) && sn !== '2026') continue;
      const rows = raw(wb, sn);
      let inObj = false;
      const map: Record<string, TaskDef> = {};

      for (let r = 0; r < rows.length; r++) {
        const c0 = cl(rows[r][0]).toLowerCase();
        if (c0 === 'objekt') { inObj = true; continue; }
        if (!inObj) continue;

        const code = cl(rows[r][0]);
        const name = cl(rows[r][1]);
        // Valid task code: single letter a-z or single digit 1-9
        if (/^[a-z]$/i.test(code) || /^[1-9]$/.test(code)) {
          const desc = cl(rows[r][10] || '') || cl(rows[r][2] || '');
          map[code.toLowerCase()] = { name: name || `Auftrag ${code.toUpperCase()}`, description: desc };
          if (name) custNames.add(name);
        }
      }
      target[sn] = map;
    }
  }

  scanObjs(wb01, gtTasks);
  scanObjs(wb01a, uhTasks);
  console.log(`  Found ${custNames.size} unique customers`);

  const custRecords = Array.from(custNames).map(n => ({ name: n, is_active: true }));
  const custCount = await ins('customers', custRecords);
  console.log(`  ✅ Customers: ${custCount}`);

  const { data: allCust } = await supabase.from('customers').select('id, name');
  const custLookup: Record<string, string> = {};
  for (const c of allCust || []) custLookup[c.name.toLowerCase()] = c.id;

  // Create tasks: unique (name, scheduleType)
  const taskKeys = new Set<string>();
  const taskRecs: any[] = [];
  let si = 0;

  function addTask(code: string, name: string, st: string, desc: string) {
    const dk = `${name.toLowerCase()}|${st}`;
    if (taskKeys.has(dk) && name) return;
    if (name) taskKeys.add(dk);
    taskRecs.push({
      customer_id: custLookup[name.toLowerCase()] || null,
      code: code.toUpperCase(), name: name || `Auftrag ${code.toUpperCase()}`,
      schedule_type: st, status: 'ACTIVE', description: desc || null,
      color: '#8B7355', sort_order: si++,
    });
  }

  for (const [, m] of Object.entries(gtTasks)) for (const [c, d] of Object.entries(m)) addTask(c, d.name, 'GARTEN_TIEFBAU', d.description);
  for (const [, m] of Object.entries(uhTasks)) for (const [c, d] of Object.entries(m)) addTask(c, d.name, 'UNTERHALT', d.description);

  // Also add numbered tasks (1-9) for both types if not yet created
  for (let n = 1; n <= 9; n++) {
    const code = String(n);
    if (!taskKeys.has(`auftrag ${code}|GARTEN_TIEFBAU`)) {
      addTask(code, `Auftrag ${code}`, 'GARTEN_TIEFBAU', '');
    }
    if (!taskKeys.has(`auftrag ${code}|UNTERHALT`)) {
      addTask(code, `Auftrag ${code}`, 'UNTERHALT', '');
    }
  }

  const taskCount = await ins('tasks', taskRecs);
  console.log(`  ✅ Tasks: ${taskCount}`);

  const { data: allTasks } = await supabase.from('tasks').select('id, code, name, schedule_type');
  const taskByName: Record<string, string> = {};
  for (const t of allTasks || []) taskByName[`${t.name.toLowerCase()}|${t.schedule_type}`] = t.id;
  // Also by code+type (first match)
  const taskByCode: Record<string, string> = {};
  for (const t of allTasks || []) {
    const k = `${t.code.toLowerCase()}|${t.schedule_type}`;
    if (!taskByCode[k]) taskByCode[k] = t.id;
  }

  // Per-sheet resolver
  function resolveTask(sheetMap: Record<string, TaskDef>, code: string, st: string): string | null {
    const def = sheetMap[code.toLowerCase()];
    if (def?.name) {
      const id = taskByName[`${def.name.toLowerCase()}|${st}`];
      if (id) return id;
    }
    return taskByCode[`${code.toLowerCase()}|${st}`] || null;
  }

  // ═════════════════════════════════════════
  // PHASE 4: WEEKS
  // ═════════════════════════════════════════
  console.log('\n📅 Phase 4: Weeks...');
  let wc = 0;
  for (let w = 1; w <= 52; w++) {
    for (const st of ['GARTEN_TIEFBAU', 'UNTERHALT']) {
      const status = w < 19 ? 'LOCKED' : w === 19 ? 'PUBLISHED' : 'DRAFT';
      const { data: ex } = await supabase.from('weeks').select('id')
        .eq('year', 2026).eq('week_number', w).eq('schedule_type', st).maybeSingle();
      if (!ex) {
        const { error } = await supabase.from('weeks').insert({ year: 2026, week_number: w, schedule_type: st, status, created_by_id: adminId });
        if (!error) wc++;
      } else wc++;
    }
  }
  console.log(`  ✅ Weeks: ${wc}`);

  const { data: allWeeks } = await supabase.from('weeks').select('id, week_number, schedule_type');
  const weekMap: Record<string, string> = {};
  for (const w of allWeeks || []) weekMap[`${w.week_number}-${w.schedule_type}`] = w.id;

  // ═════════════════════════════════════════
  // PHASE 5: ALLOCATIONS
  // ═════════════════════════════════════════
  console.log('\n📋 Phase 5: Allocations...');

  const dayCols: Record<number, number> = { 0: 2, 1: 6, 2: 10, 3: 14, 4: 18, 5: 22 };
  const SLOTS = 4;
  const absences = new Set(['ferien', 'schule', 'ük', 'uek', 'unfall', 'krank', 'militär', 'mil', 'feiertag']);

  const allocs: any[] = [];
  const allocSet = new Set<string>();
  let absCount = 0;

  function parseAllocs(wb: XLSX.WorkBook, st: string, sheetDefs: Record<string, Record<string, TaskDef>>) {
    let matched = 0, unm = 0, noTask = 0;
    for (const sn of wb.SheetNames) {
      const kwn = kw(sn);
      if (!kwn) continue;
      const weekId = weekMap[`${kwn}-${st}`];
      if (!weekId) continue;
      const sDef = sheetDefs[sn] || {};
      const rows = raw(wb, sn);

      for (let r = 4; r < rows.length; r++) {
        const c0 = cl(rows[r][0]);
        const c1 = cl(rows[r][1]);
        if (c0.toLowerCase() === 'objekt' || c1.toLowerCase() === 'objekt') break;
        // STRICT: only process real employees
        if (!ROLE_LETTERS.has(c0)) continue;
        if (!c1 || c1.length < 2) continue;
        if (SKIP_NAMES.has(c1.toLowerCase())) continue;

        const uid = userLookup[c1.toLowerCase()];
        if (!uid) { unm++; continue; }

        for (let day = 0; day < 6; day++) {
          for (let slot = 0; slot < SLOTS; slot++) {
            const ci = dayCols[day] + slot;
            const val = cl(rows[r][ci]);
            if (!val) continue;
            if (absences.has(val.toLowerCase())) { absCount++; continue; }
            if (val.toLowerCase() === 'x') continue;

            const tid = resolveTask(sDef, val, st);
            if (!tid) { noTask++; continue; }

            const dk = `${uid}-${weekId}-${day}-${slot + 1}`;
            if (allocSet.has(dk)) continue;
            allocSet.add(dk);
            allocs.push({ user_id: uid, task_id: tid, week_id: weekId, day_of_week: day, time_slot: slot + 1, created_by_id: adminId });
            matched++;
          }
        }
      }
    }
    console.log(`    → ${st}: ${matched} matched, ${unm} unmatched users, ${noTask} unresolved codes`);
  }

  parseAllocs(wb01, 'GARTEN_TIEFBAU', gtTasks);
  parseAllocs(wb01a, 'UNTERHALT', uhTasks);

  const allocCount = await ins('allocations', allocs);
  console.log(`  ✅ Allocations: ${allocCount} (${absCount} absences skipped)`);

  // ═════════════════════════════════════════
  // PHASE 6: MACHINE ALLOCATIONS
  // 02-Maschinen: left side has sites in col 1,
  // rows under each site have machine assignments.
  // The grid cells contain site references per day.
  // The machine list is on the RIGHT (col 29+).
  // The left structure: each row IS a machine row
  // with the site it's assigned to that week.
  // Actually from diagnostic: row 4 col1="Untere Heslibachstrasse 64 Küsnacht"
  // — these are SITES, not machines. The cell values
  // in the grid area would tell which machine goes where.
  // But the cells are mostly empty with some spaces.
  // Machine allocations may not be parseable from this format.
  // We'll skip for now and log what we find.
  // ═════════════════════════════════════════
  console.log('\n🔧 Phase 6: Machine allocations...');
  console.log('  ⚠️  Machine allocation parsing from 02-Maschinen requires');
  console.log('     further analysis of the grid structure. Skipping for now.');
  console.log('  ✅ Machine Allocations: 0');

  // SUMMARY
  console.log('\n══════════════════════════════════════════');
  console.log('  Migration v6 complete');
  console.log('══════════════════════════════════════════');
  console.log(`  Users:              ${userCount}`);
  console.log(`  Machines:           ${machineCount}`);
  console.log(`  Customers:          ${custCount}`);
  console.log(`  Tasks:              ${taskCount}`);
  console.log(`  Weeks:              ${wc}`);
  console.log(`  Allocations:        ${allocCount}`);
  console.log(`  Machine Allocs:     0`);
  console.log('══════════════════════════════════════════');
}

migrate().catch(e => { console.error('❌', e); process.exit(1); });
