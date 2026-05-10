import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { useRolesStore } from '../store/rolesStore';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';

const API = import.meta.env.VITE_API_URL || '';

function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

/* ────────────────────── types ────────────────────── */
interface User { id:string; email:string; first_name:string; last_name:string; role:string; departments:string[]; is_active:boolean; manager_id?:string; }
interface Week { id:string; week_number:number; year:number; }
interface Allocation { id:string; user_id:string; task_id:string; week_id:string; day_of_week:number; time_slot:string; created_by_id?:string; }
interface Absence { id:string; user_id:string; week_id?:string; day_of_week?:number; date?:string; type:number|string; status?:string; }
interface Task { id:string; name:string; short_code?:string; status:string; color?:string; bg_color?:string; }
interface Machine { id:string; name:string; category:string; status:string; notes?:string; }
interface MachineAllocation { id:string; machine_id:string; user_id?:string; task_id?:string; date:string; start_time?:string; end_time?:string; }
type Period = 'week' | 'month' | 'quarter' | 'year';

/* ────────────────────── i18n ────────────────────── */
const LABELS: Record<string,Record<string,string>> = {
  de:{
    title:'Statistiken',period:'Zeitraum',
    week:'Woche',month:'Monat',quarter:'Quartal',year:'Jahr',
    teamOccupation:'Team-Auslastung',successRate:'Erfolgsrate',absenceRate:'Absenzenquote',machineOccupation:'Maschinen-Auslastung',
    occupied:'Belegt',free:'Frei',absent:'Abwesend',
    completed:'Abgeschlossen',pending:'Offen',cancelled:'Abgebrochen',active:'Aktiv',
    available:'Verfügbar',inUse:'In Betrieb',maintenance:'Wartung',
    totalSlots:'Gesamte Slots',filledSlots:'Belegte Slots',
    totalTasks:'Aufträge gesamt',completedTasks:'Abgeschlossen',
    totalDays:'Arbeitstage gesamt',absentDays:'Abwesende Tage',
    totalMachines:'Maschinen gesamt',usedMachines:'Eingesetzte Maschinen',
    byEmployee:'Nach Mitarbeiter',byDepartment:'Nach Abteilung',
    byDay:'Nach Wochentag',byMachine:'Nach Maschine',byType:'Nach Typ',byStatus:'Nach Status',byCategory:'Nach Kategorie',
    noData:'Keine Daten verfügbar',
    employees:'Mitarbeiter',department:'Abteilung',
    mon:'Mo',tue:'Di',wed:'Mi',thu:'Do',fri:'Fr',sat:'Sa',
    garten:'Garten',unterhalt:'Unterhalt',
    loading:'Laden…',rate:'Quote',export:'Exportieren',
    trend:'Trend',weekNum:'KW',tasks:'Aufträge',
    overview:'Übersicht',details:'Details',heatmap:'Heatmap',
    accessDenied:'Kein Zugriff',
    taskDistribution:'Auftragsverteilung',absenceBreakdown:'Absenz-Übersicht',
    weeklyTrend:'Wöchentlicher Verlauf',machineStatus:'Maschinenstatus',
    occupationHeatmap:'Auslastungs-Heatmap',hours:'Stunden',slots:'Slots',
    GARTEN_TIEFBAU:'Garten & Tiefbau', UNTERHALT:'Unterhalt',
  },
  en:{
    title:'Statistics',period:'Period',
    week:'Week',month:'Month',quarter:'Quarter',year:'Year',
    teamOccupation:'Team Occupation',successRate:'Success Rate',absenceRate:'Absence Rate',machineOccupation:'Machine Occupation',
    occupied:'Occupied',free:'Free',absent:'Absent',
    completed:'Completed',pending:'Pending',cancelled:'Cancelled',active:'Active',
    available:'Available',inUse:'In Use',maintenance:'Maintenance',
    totalSlots:'Total Slots',filledSlots:'Filled Slots',
    totalTasks:'Total Tasks',completedTasks:'Completed',
    totalDays:'Total Workdays',absentDays:'Absent Days',
    totalMachines:'Total Machines',usedMachines:'Used Machines',
    byEmployee:'By Employee',byDepartment:'By Department',
    byDay:'By Weekday',byMachine:'By Machine',byType:'By Type',byStatus:'By Status',byCategory:'By Category',
    noData:'No data available',
    employees:'Employees',department:'Department',
    mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',
    garten:'Garden',unterhalt:'Maintenance',
    loading:'Loading…',rate:'Rate',export:'Export',
    trend:'Trend',weekNum:'CW',tasks:'Tasks',
    overview:'Overview',details:'Details',heatmap:'Heatmap',
    accessDenied:'Access Denied',
    taskDistribution:'Task Distribution',absenceBreakdown:'Absence Breakdown',
    weeklyTrend:'Weekly Trend',machineStatus:'Machine Status',
    occupationHeatmap:'Occupation Heatmap',hours:'Hours',slots:'Slots',
    GARTEN_TIEFBAU:'Garden & Civil Eng.', UNTERHALT:'Maintenance',
  },
  fr:{
    title:'Statistiques',period:'Période',
    week:'Semaine',month:'Mois',quarter:'Trimestre',year:'Année',
    teamOccupation:"Taux d'occupation",successRate:'Taux de réussite',absenceRate:"Taux d'absence",machineOccupation:'Occupation machines',
    occupied:'Occupé',free:'Libre',absent:'Absent',
    completed:'Terminé',pending:'En cours',cancelled:'Annulé',active:'Actif',
    available:'Disponible',inUse:'En service',maintenance:'Maintenance',
    totalSlots:'Créneaux totaux',filledSlots:'Créneaux remplis',
    totalTasks:'Tâches totales',completedTasks:'Terminées',
    totalDays:'Jours ouvrables',absentDays:'Jours absents',
    totalMachines:'Machines totales',usedMachines:'Machines utilisées',
    byEmployee:'Par employé',byDepartment:'Par département',
    byDay:'Par jour',byMachine:'Par machine',byType:'Par type',byStatus:'Par statut',byCategory:'Par catégorie',
    noData:'Aucune donnée',
    employees:'Employés',department:'Département',
    mon:'Lun',tue:'Mar',wed:'Mer',thu:'Jeu',fri:'Ven',sat:'Sam',
    garten:'Jardin',unterhalt:'Entretien',
    loading:'Chargement…',rate:'Taux',export:'Exporter',
    trend:'Tendance',weekNum:'S',tasks:'Tâches',
    overview:'Aperçu',details:'Détails',heatmap:'Carte de chaleur',
    accessDenied:'Accès refusé',
    taskDistribution:'Répartition des tâches',absenceBreakdown:'Répartition des absences',
    weeklyTrend:'Tendance hebdomadaire',machineStatus:'État des machines',
    occupationHeatmap:"Carte d'occupation",hours:'Heures',slots:'Créneaux',
    GARTEN_TIEFBAU:'Jardin & Génie civil', UNTERHALT:'Entretien',
  },
  pt:{
    title:'Estatísticas',period:'Período',
    week:'Semana',month:'Mês',quarter:'Trimestre',year:'Ano',
    teamOccupation:'Ocupação da Equipa',successRate:'Taxa de Sucesso',absenceRate:'Taxa de Ausência',machineOccupation:'Ocupação de Máquinas',
    occupied:'Ocupado',free:'Livre',absent:'Ausente',
    completed:'Concluído',pending:'Pendente',cancelled:'Cancelado',active:'Ativo',
    available:'Disponível',inUse:'Em uso',maintenance:'Manutenção',
    totalSlots:'Slots totais',filledSlots:'Slots preenchidos',
    totalTasks:'Tarefas totais',completedTasks:'Concluídas',
    totalDays:'Dias úteis totais',absentDays:'Dias ausentes',
    totalMachines:'Máquinas totais',usedMachines:'Máquinas usadas',
    byEmployee:'Por funcionário',byDepartment:'Por departamento',
    byDay:'Por dia',byMachine:'Por máquina',byType:'Por tipo',byStatus:'Por estado',byCategory:'Por categoria',
    noData:'Sem dados',
    employees:'Funcionários',department:'Departamento',
    mon:'Seg',tue:'Ter',wed:'Qua',thu:'Qui',fri:'Sex',sat:'Sáb',
    garten:'Jardim',unterhalt:'Manutenção',
    loading:'Carregando…',rate:'Taxa',export:'Exportar',
    trend:'Tendência',weekNum:'S',tasks:'Tarefas',
    overview:'Visão geral',details:'Detalhes',heatmap:'Mapa de calor',
    accessDenied:'Acesso negado',
    taskDistribution:'Distribuição de tarefas',absenceBreakdown:'Visão de ausências',
    weeklyTrend:'Tendência semanal',machineStatus:'Estado das máquinas',
    occupationHeatmap:'Mapa de ocupação',hours:'Horas',slots:'Slots',
    GARTEN_TIEFBAU:'Jardim & Eng. Civil', UNTERHALT:'Manutenção',
  },
};

const ABS_LABELS: Record<string,Record<string,string>> = {
  de:{'1':'Krankheit','2':'Urlaub','3':'Fortbildung','4':'Dienstreise','5':'Homeoffice','6':'Sonstiges'},
  en:{'1':'Illness','2':'Vacation','3':'Training','4':'Business Trip','5':'Home Office','6':'Other'},
  fr:{'1':'Maladie','2':'Vacances','3':'Formation','4':'Déplacement','5':'Télétravail','6':'Autre'},
  pt:{'1':'Doença','2':'Férias','3':'Formação','4':'Viagem','5':'Home Office','6':'Outro'},
};

const ABS_COLORS: Record<string,string> = {
  '1':'#ff6b9d','2':'#4ecdc4','3':'#ffa726','4':'#42a5f5','5':'#b388ff','6':'#78909c',
};

/* ────────────────────── helpers ────────────────────── */
function getISOWeek(d:Date):number{
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  t.setUTCDate(t.getUTCDate()+4-(t.getUTCDay()||7));
  const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return Math.ceil(((t.getTime()-y.getTime())/86400000+1)/7);
}
function getCurrentWeekNumber():number{return getISOWeek(new Date());}

function getWeeksForPeriod(period:Period,allWeeks:Week[]):Week[]{
  const now=new Date();const cy=now.getFullYear();const cw=getCurrentWeekNumber();
  switch(period){
    case 'week':return allWeeks.filter(w=>w.year===cy&&w.week_number===cw);
    case 'month':{const s=Math.max(1,cw-3);return allWeeks.filter(w=>w.year===cy&&w.week_number>=s&&w.week_number<=cw);}
    case 'quarter':{const s=Math.max(1,cw-12);return allWeeks.filter(w=>w.year===cy&&w.week_number>=s&&w.week_number<=cw);}
    case 'year':return allWeeks.filter(w=>w.year===cy&&w.week_number<=cw);
  }
}

function pct(n:number,d:number):number{return d===0?0:Math.round((n/d)*100);}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}

/* ══════════════════════════════════════════════════════
   SVG CHART COMPONENTS
   ══════════════════════════════════════════════════════ */

/* ────── Animated Gauge Donut ────── */
function GaugeDonut({value,size=130,strokeWidth=16,color,trackColor,label,sublabel,innerLabel}:{
  value:number;size?:number;strokeWidth?:number;
  color:string;trackColor:string;label:string;sublabel?:string;innerLabel?:string;
}){
  const r=(size-strokeWidth)/2;
  const circ=2*Math.PI*r;
  const offset=circ-(clamp(value,0,100)/100)*circ;
  // gradient id unique per instance
  const gid=useRef(`gauge-${Math.random().toString(36).slice(2,8)}`).current;
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.6}/>
            <stop offset="100%" stopColor={color} stopOpacity={1}/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} opacity={0.4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition:'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)'}}/>
        <text x={size/2} y={size/2-6} textAnchor="middle" dominantBaseline="central"
          style={{transform:'rotate(90deg)',transformOrigin:'center',fontSize:size*0.2,fontWeight:800,fill:color,fontFamily:"'Inter',sans-serif"}}>
          {value}%
        </text>
        {innerLabel&&(
          <text x={size/2} y={size/2+12} textAnchor="middle" dominantBaseline="central"
            style={{transform:'rotate(90deg)',transformOrigin:'center',fontSize:size*0.08,fontWeight:500,fill:color,opacity:.7,fontFamily:"'Inter',sans-serif"}}>
            {innerLabel}
          </text>
        )}
      </svg>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:13,fontWeight:700}}>{label}</div>
        {sublabel&&<div style={{fontSize:11,opacity:0.55}}>{sublabel}</div>}
      </div>
    </div>
  );
}

/* ────── Pie / Donut Chart (multi-segment) ────── */
function PieChart({segments,size=160,strokeWidth=24,trackColor,centerLabel}:{
  segments:{value:number;color:string;label:string}[];
  size?:number;strokeWidth?:number;trackColor:string;centerLabel?:string;
}){
  const r=(size-strokeWidth)/2;
  const circ=2*Math.PI*r;
  const total=segments.reduce((s,seg)=>s+seg.value,0);
  let accumulated=0;
  return(
    <div style={{position:'relative',width:size,height:size}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} opacity={0.3}/>
        {total>0&&segments.map((seg,i)=>{
          const pctVal=seg.value/total;
          const dashLen=pctVal*circ;
          const dashOffset=-(accumulated/total)*circ;
          accumulated+=seg.value;
          return(
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circ-dashLen}`}
              strokeDashoffset={dashOffset}
              style={{transition:'stroke-dasharray .8s ease, stroke-dashoffset .8s ease'}}/>
          );
        })}
        {centerLabel&&(
          <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
            style={{transform:'rotate(90deg)',transformOrigin:'center',fontSize:14,fontWeight:800,fill:'currentColor',fontFamily:"'Inter',sans-serif"}}>
            {centerLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ────── Horizontal Bar Chart (enhanced) ────── */
function BarChart({data,color,maxVal,th,showPctLabel=true}:{
  data:{label:string;value:number;max:number;color?:string}[];
  color:string;maxVal:number;th:Record<string,string>;showPctLabel?:boolean;
}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {data.map((d,i)=>{
        const p=pct(d.value,d.max);
        const barColor=d.color||color;
        return(
          <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:100,fontSize:12,fontWeight:500,color:th.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={d.label}>
              {d.label}
            </div>
            <div style={{flex:1,height:24,background:`${barColor}15`,borderRadius:6,overflow:'hidden',position:'relative'}}>
              <div style={{
                width:`${maxVal===0?0:(d.value/maxVal)*100}%`,
                height:'100%',background:`linear-gradient(90deg,${barColor}88,${barColor})`,borderRadius:6,
                transition:'width .8s cubic-bezier(.4,0,.2,1)',minWidth:d.value>0?4:0,
              }}/>
              {d.value>0&&(
                <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:700,color:'#fff',
                  textShadow:'0 1px 2px rgba(0,0,0,.4)',opacity:pct(d.value,maxVal)>15?1:0}}>
                  {d.value}
                </span>
              )}
            </div>
            {showPctLabel&&<div style={{width:45,fontSize:12,fontWeight:700,color:barColor,textAlign:'right'}}>{p}%</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ────── Grouped Vertical Bar Chart ────── */
function VerticalBarChart({groups,height=180,th}:{
  groups:{label:string;bars:{value:number;color:string;label:string}[]}[];
  height?:number;th:Record<string,string>;
}){
  const allVals=groups.flatMap(g=>g.bars.map(b=>b.value));
  const maxV=Math.max(...allVals,1);
  const barW=24;
  const groupGap=16;
  const barGap=3;
  return(
    <div style={{overflowX:'auto',paddingBottom:8}}>
      <svg width={groups.length*(groups[0]?.bars.length||1)*(barW+barGap)+groups.length*groupGap+40} height={height+40}>
        {/* grid lines */}
        {[0,.25,.5,.75,1].map((f,i)=>{
          const y=height-(f*height);
          return <g key={i}>
            <line x1={30} y1={y} x2="100%" y2={y} stroke={th.borderFaint} strokeDasharray="4,4" opacity={0.5}/>
            <text x={26} y={y+4} textAnchor="end" style={{fontSize:9,fill:th.textDim}}>{Math.round(f*maxV)}</text>
          </g>;
        })}
        {groups.map((g,gi)=>{
          const groupX=40+gi*((g.bars.length*(barW+barGap))+groupGap);
          return <g key={gi}>
            {g.bars.map((b,bi)=>{
              const barH=(b.value/maxV)*height;
              const x=groupX+bi*(barW+barGap);
              return <g key={bi}>
                <rect x={x} y={height-barH} width={barW} height={barH} rx={4} fill={b.color}
                  opacity={0.85} style={{transition:'height .6s ease, y .6s ease'}}>
                  <title>{b.label}: {b.value}</title>
                </rect>
                {barH>20&&(
                  <text x={x+barW/2} y={height-barH+14} textAnchor="middle"
                    style={{fontSize:9,fontWeight:700,fill:'#fff'}}>{b.value}</text>
                )}
              </g>;
            })}
            <text x={groupX+(g.bars.length*(barW+barGap))/2} y={height+16} textAnchor="middle"
              style={{fontSize:10,fontWeight:600,fill:th.textMuted}}>{g.label}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

/* ────── Area Sparkline (filled) ────── */
function AreaSparkline({data,color,width=220,height=55,labels}:{
  data:number[];color:string;width?:number;height?:number;labels?:string[];
}){
  const uid = useRef(`area-${Math.random().toString(36).slice(2,8)}`).current;
  if(data.length<2) return null;
  const pad=4;const max=Math.max(...data,1);const min=Math.min(...data,0);const range=max-min||1;
  const pts=data.map((v,i)=>{
    const x=pad+(i/(data.length-1))*(width-2*pad);
    const y=height-pad-((v-min)/range)*(height-2*pad);
    return{x,y};
  });
  const line=pts.map(p=>`${p.x},${p.y}`).join(' ');
  const area=`${pts[0].x},${height-pad} `+line+` ${pts[pts.length-1].x},${height-pad}`;
  return(
    <div>
      <svg width={width} height={height+20} style={{display:'block'}}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
            <stop offset="100%" stopColor={color} stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${uid})`}/>
        <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i)=>(
          <circle key={i} cx={p.x} cy={p.y} r={i===pts.length-1?4:2.5} fill={color} stroke="#fff" strokeWidth={1}/>
        ))}
        {labels&&labels.map((lb,i)=>(
          <text key={i} x={pts[i]?.x||0} y={height+12} textAnchor="middle" style={{fontSize:8,fill:color,opacity:.7}}>{lb}</text>
        ))}
      </svg>
    </div>
  );
}

/* ────── Heatmap Grid ────── */
function HeatmapGrid({data,rowLabels,colLabels,maxVal,baseColor,th}:{
  data:number[][];rowLabels:string[];colLabels:string[];maxVal:number;baseColor:string;th:Record<string,string>;
}){
  const cellSize=36;const gap=3;
  return(
    <div style={{overflowX:'auto'}}>
      <div style={{display:'inline-grid',gridTemplateColumns:`80px repeat(${colLabels.length},${cellSize}px)`,gap,alignItems:'center'}}>
        <div/>
        {colLabels.map((c,i)=>(
          <div key={i} style={{textAlign:'center',fontSize:10,fontWeight:600,color:th.textMuted}}>{c}</div>
        ))}
        {rowLabels.map((row,ri)=>(
          <>
            <div key={`r${ri}`} style={{fontSize:11,fontWeight:500,color:th.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={row}>{row}</div>
            {(data[ri]||[]).map((val,ci)=>{
              const intensity=maxVal>0?clamp(val/maxVal,0,1):0;
              return(
                <div key={`${ri}-${ci}`} style={{
                  width:cellSize,height:cellSize,borderRadius:6,
                  background:val>0?`${baseColor}${Math.round(intensity*200+55).toString(16).padStart(2,'0')}`:`${th.borderFaint}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:9,fontWeight:700,color:intensity>0.5?'#fff':th.textDim,
                  transition:'background .4s ease',cursor:'default',
                }} title={`${row} / ${colLabels[ci]}: ${val}`}>
                  {val>0?val:''}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

/* ────── Stacked Progress Bar ────── */
function StackedBar({segments,height=32,th}:{
  segments:{value:number;color:string;label:string}[];height?:number;th:Record<string,string>;
}){
  const total=segments.reduce((s,seg)=>s+seg.value,0);
  return(
    <div>
      <div style={{height,borderRadius:8,overflow:'hidden',display:'flex',background:`${th.borderFaint}`}}>
        {total>0&&segments.filter(s=>s.value>0).map((seg,i)=>(
          <div key={i} style={{width:`${(seg.value/total)*100}%`,background:seg.color,transition:'width .6s ease',position:'relative',overflow:'hidden'}} title={`${seg.label}: ${seg.value}`}>
            {(seg.value/total)>0.08&&(
              <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff',textShadow:'0 1px 2px rgba(0,0,0,.3)'}}>
                {pct(seg.value,total)}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:8}}>
        {segments.map((seg,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:seg.color}}/>
            <span style={{fontSize:11,color:th.textMuted}}>{seg.label}</span>
            <span style={{fontSize:11,fontWeight:700,color:th.text}}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────── Horizontal legend ────── */
function Legend({items,th}:{items:{color:string;label:string;value:string}[];th:Record<string,string>;}){
  return(
    <div style={{display:'flex',flexWrap:'wrap',gap:14,marginTop:8}}>
      {items.map((it,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:it.color}}/>
          <span style={{fontSize:12,color:th.textMuted}}>{it.label}:</span>
          <span style={{fontSize:12,fontWeight:700,color:th.text}}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export function StatsPage(){
  const {isDark,th,lang}=useTheme();
  const {token,user}=useAuthStore();
  const {permissionMap}=useRolesStore();
  const L=LABELS[lang||'de']||LABELS.de;

  /* ── permissions ── */
  const perms=useMemo(()=>{
    const role = normalizeRole(user?.role || '');
    return resolvePermissions(role,user?.custom_permissions,permissionMap);
  },[user,permissionMap]);
  const canView=perms.has('reports.team' as Permission)||perms.has('stats.view' as Permission);

  const authHeaders=useMemo(()=>({'Content-Type':'application/json',Authorization:`Bearer ${token}`}),[token]);

  const [period,setPeriod]=useState<Period>('month');
  const [loading,setLoading]=useState(true);
  const [users,setUsers]=useState<User[]>([]);
  const [weeks,setWeeks]=useState<Week[]>([]);
  const [allocations,setAllocations]=useState<Allocation[]>([]);
  const [absences,setAbsences]=useState<Absence[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [machines,setMachines]=useState<Machine[]>([]);
  const [machineAllocs,setMachineAllocs]=useState<MachineAllocation[]>([]);

  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

  const fetchAll=useCallback(async()=>{
    if(!token)return;
    setLoading(true);
    try{
      const [uRes,wRes,aRes,abRes,tRes,mRes,maRes]=await Promise.allSettled([
        fetch(`${API}/api/v1/users`,{headers:authHeaders}),
        fetch(`${API}/api/v1/weeks`,{headers:authHeaders}),
        fetch(`${API}/api/v1/allocations`,{headers:authHeaders}),
        fetch(`${API}/api/v1/absences`,{headers:authHeaders}),
        fetch(`${API}/api/v1/tasks`,{headers:authHeaders}),
        fetch(`${API}/api/v1/machines`,{headers:authHeaders}),
        fetch(`${API}/api/v1/machines/allocations`,{headers:authHeaders}),
      ]);
      if(!mounted.current)return;
      const json=async(r:PromiseSettledResult<Response>):Promise<any[]>=>{
        if(r.status!=='fulfilled'||!r.value.ok)return[];
        try{const data=await r.value.json();if(Array.isArray(data))return data;if(data&&Array.isArray(data.data))return data.data;return[];}catch{return[];}
      };
      setUsers(await json(uRes));setWeeks(await json(wRes));setAllocations(await json(aRes));
      setAbsences(await json(abRes));setTasks(await json(tRes));setMachines(await json(mRes));
      setMachineAllocs(await json(maRes));
    }catch(e){console.error('Stats fetch error',e);}finally{if(mounted.current)setLoading(false);}
  },[token,authHeaders]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  /* ── derived data ── */
  const periodWeeks=useMemo(()=>getWeeksForPeriod(period,weeks),[period,weeks]);
  const periodWeekIds=useMemo(()=>new Set(periodWeeks.map(w=>w.id)),[periodWeeks]);
  const activeUsers=useMemo(()=>users.filter(u=>u.is_active!==false),[users]);
  const periodAllocations=useMemo(()=>allocations.filter(a=>periodWeekIds.has(a.week_id)),[allocations,periodWeekIds]);
  const periodAbsences=useMemo(()=>absences.filter(a=>a.week_id?periodWeekIds.has(a.week_id):false),[absences,periodWeekIds]);

  /* ══════════ 1. TEAM OCCUPATION ══════════ */
  const teamOccupation=useMemo(()=>{
    const numWeeks=periodWeeks.length||1;
    const daysPerWeek=6;const slotsPerDay=2;
    const totalSlots=activeUsers.length*numWeeks*daysPerWeek*slotsPerDay;
    const filledSlots=periodAllocations.length;
    const rate=pct(filledSlots,totalSlots);

    const byEmployee=activeUsers.map(u=>{
      const userSlots=periodAllocations.filter(a=>a.user_id===u.id).length;
      const maxSlots=numWeeks*daysPerWeek*slotsPerDay;
      return{label:`${u.first_name} ${u.last_name}`,value:userSlots,max:maxSlots};
    }).sort((a,b)=>(b.value/(b.max||1))-(a.value/(a.max||1)));

    const depts=['GARTEN_TIEFBAU','UNTERHALT'];
    const byDept=depts.map(dept=>{
      const deptUsers=activeUsers.filter(u=>(u.departments||[]).includes(dept));
      const deptAllocs=periodAllocations.filter(a=>deptUsers.some(u=>u.id===a.user_id)).length;
      const maxSlots=deptUsers.length*numWeeks*daysPerWeek*slotsPerDay;
      return{label:L[dept]||dept,value:deptAllocs,max:maxSlots};
    });

    const dayNames=[L.mon,L.tue,L.wed,L.thu,L.fri,L.sat];
    const byDay=[1,2,3,4,5,6].map((d,i)=>{
      const dayAllocs=periodAllocations.filter(a=>a.day_of_week===d).length;
      const maxDay=activeUsers.length*numWeeks*slotsPerDay;
      return{label:dayNames[i],value:dayAllocs,max:maxDay};
    });

    const trend=periodWeeks.map(w=>{
      const wAllocs=periodAllocations.filter(a=>a.week_id===w.id).length;
      const wMax=activeUsers.length*daysPerWeek*slotsPerDay;
      return pct(wAllocs,wMax);
    });

    // heatmap: rows = employees, cols = days (Mon-Sat)
    const heatmapData=activeUsers.map(u=>[1,2,3,4,5,6].map(d=>
      periodAllocations.filter(a=>a.user_id===u.id&&a.day_of_week===d).length
    ));
    const heatmapRows=activeUsers.map(u=>`${u.first_name} ${u.last_name.charAt(0)}.`);

    // by day for vertical grouped chart
    const byDayGrouped=dayNames.map((dn,i)=>{
      const day=i+1;
      const bars=depts.map(dept=>{
        const deptUsers=activeUsers.filter(u=>(u.departments||[]).includes(dept));
        return{value:periodAllocations.filter(a=>a.day_of_week===day&&deptUsers.some(u=>u.id===a.user_id)).length,color:dept==='garten'?'#4ecdc4':'#ffa726',label:L[dept]||dept};
      });
      return{label:dn,bars};
    });

    return{rate,totalSlots,filledSlots,byEmployee,byDept,byDay,trend,heatmapData,heatmapRows,byDayGrouped};
  },[periodAllocations,periodWeeks,activeUsers,L]);

  /* ══════════ 2. SUCCESS RATE ══════════ */
  const successRate=useMemo(()=>{
    const total=tasks.length;
    const completed=tasks.filter(t=>(t.status||'').toUpperCase()==='COMPLETED').length;
    const cancelled=tasks.filter(t=>(t.status||'').toUpperCase()==='CANCELLED').length;
    const active=tasks.filter(t=>(t.status||'').toUpperCase()==='ACTIVE').length;
    const planned=tasks.filter(t=>(t.status||'').toUpperCase()==='PLANNED').length;
    const rate=pct(completed,total);

    // status breakdown for pie
    const statusCounts:{status:string;count:number;color:string}[]=[
      {status:'COMPLETED',count:completed,color:'#4ecdc4'},
      {status:'ACTIVE',count:active,color:'#42a5f5'},
      {status:'PLANNED',count:planned,color:'#ffa726'},
      {status:'CANCELLED',count:cancelled,color:'#ff6b6b'},
    ].filter(s=>s.count>0);

    return{rate,total,completed,cancelled,active,planned,statusCounts};
  },[tasks]);

  /* ══════════ 3. ABSENCE RATE ══════════ */
  const absenceRate=useMemo(()=>{
    const numWeeks=periodWeeks.length||1;
    const daysPerWeek=6;
    const totalDays=activeUsers.length*numWeeks*daysPerWeek;
    const absentDays=periodAbsences.length;
    const rate=pct(absentDays,totalDays);

    const byEmployee=activeUsers.map(u=>{
      const uAbs=periodAbsences.filter(a=>a.user_id===u.id).length;
      const maxDays=numWeeks*daysPerWeek;
      return{label:`${u.first_name} ${u.last_name}`,value:uAbs,max:maxDays};
    }).sort((a,b)=>(b.value/(b.max||1))-(a.value/(a.max||1)));

    const absTypes:Record<string,number>={};
    periodAbsences.forEach(a=>{const key=String(a.type);absTypes[key]=(absTypes[key]||0)+1;});

    const trend=periodWeeks.map(w=>{
      const wAbs=periodAbsences.filter(a=>a.week_id===w.id).length;
      const wMax=activeUsers.length*daysPerWeek;
      return pct(wAbs,wMax);
    });

    // type breakdown for pie
    const typeSegments=Object.entries(absTypes).map(([type,count])=>({
      value:count,
      color:ABS_COLORS[type]||'#999',
      label:(ABS_LABELS[lang||'de']||ABS_LABELS.de)[type]||`Type ${type}`,
    }));

    // by day heatmap
    const byDayEmployee=activeUsers.map(u=>[1,2,3,4,5,6].map(d=>
      periodAbsences.filter(a=>a.user_id===u.id&&a.day_of_week===d).length
    ));
    const heatmapRows=activeUsers.map(u=>`${u.first_name} ${u.last_name.charAt(0)}.`);

    return{rate,totalDays,absentDays,byEmployee,absTypes,trend,typeSegments,byDayEmployee,heatmapRows};
  },[periodAbsences,periodWeeks,activeUsers,lang]);

  /* ══════════ 4. MACHINE OCCUPATION ══════════ */
  const machineOccupation=useMemo(()=>{
    const totalMachines=machines.length;
    const available=machines.filter(m=>m.status==='AVAILABLE').length;
    const inUse=machines.filter(m=>m.status==='IN_USE').length;
    const maint=machines.filter(m=>m.status==='MAINTENANCE').length;
    const usageRate=pct(inUse,totalMachines);

    const allCounts=machines.map(mx=>machineAllocs.filter(ma=>ma.machine_id===mx.id).length);
    const globalMax=Math.max(...allCounts,1);

    const byMachine=machines.map(m=>{
      const mAllocs=machineAllocs.filter(ma=>ma.machine_id===m.id).length;
      return{label:m.name,value:mAllocs,max:globalMax};
    }).sort((a,b)=>b.value-a.value);

    const cats=[...new Set(machines.map(m=>m.category).filter(Boolean))];
    const byCategory=cats.map(cat=>{
      const catMachines=machines.filter(m=>m.category===cat);
      const catInUse=catMachines.filter(m=>m.status==='IN_USE').length;
      return{label:cat,value:catInUse,max:catMachines.length};
    });

    const statusSegments=[
      {value:available,color:'#4ecdc4',label:L.available},
      {value:inUse,color:'#42a5f5',label:L.inUse},
      {value:maint,color:'#ffa726',label:L.maintenance},
    ];

    return{totalMachines,available,inUse,maint,usageRate,byMachine,byCategory,statusSegments};
  },[machines,machineAllocs,L]);

  /* ══════════ COLORS ══════════ */
  const colors={
    occupation:th.gold||'#c8a961',
    success:'#4ecdc4',
    absence:'#ff6b9d',
    machine:'#42a5f5',
    track:isDark?'#2a2a2a':'#e8e8e8',
    green:'#4ecdc4',red:'#ff6b6b',orange:'#ffa726',blue:'#42a5f5',purple:'#b388ff',
  };

  /* ══════════ STYLES ══════════ */
  const card=(extra?:React.CSSProperties):React.CSSProperties=>({
    background:th.bgCard,border:`1px solid ${th.border}`,borderRadius:14,padding:24,...extra,
  });

  const kpiCard=():React.CSSProperties=>({
    background:th.bgCard,border:`1px solid ${th.border}`,borderRadius:14,padding:'20px 24px',
    display:'flex',alignItems:'center',gap:16,cursor:'default',
    transition:'transform .2s,box-shadow .2s',
  });

  const periodBtn=(active:boolean):React.CSSProperties=>({
    padding:'6px 18px',borderRadius:8,border:'none',cursor:'pointer',
    fontSize:13,fontWeight:600,letterSpacing:.3,
    background:active?colors.occupation:th.buttonBg,
    color:active?'#fff':th.textMuted,transition:'all .2s',
  });

  const sectionTitle:React.CSSProperties={
    fontSize:15,fontWeight:700,color:th.text,marginBottom:16,
    display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',
  };

  const subtab=(active:boolean):React.CSSProperties=>({
    fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:6,
    border:'none',cursor:'pointer',transition:'all .15s',
    background:active?colors.occupation:th.buttonBg,
    color:active?'#fff':th.textMuted,
  });

  const [teamView,setTeamView]=useState<'employee'|'department'|'day'|'heatmap'>('employee');
  const [absView,setAbsView]=useState<'employee'|'type'|'heatmap'>('type');
  const [machView,setMachView]=useState<'machine'|'category'|'status'>('status');

  /* ══════════ CSV EXPORT ══════════ */
  const exportCSV=()=>{
    const rows=[
      ['Metric','Value','Total','Percentage'],
      [L.teamOccupation,String(teamOccupation.filledSlots),String(teamOccupation.totalSlots),teamOccupation.rate+'%'],
      [L.successRate,String(successRate.completed),String(successRate.total),successRate.rate+'%'],
      [L.absenceRate,String(absenceRate.absentDays),String(absenceRate.totalDays),absenceRate.rate+'%'],
      [L.machineOccupation,String(machineOccupation.inUse),String(machineOccupation.totalMachines),machineOccupation.usageRate+'%'],
      [''],
      ['--- Team By Employee ---'],
      ['Employee','Slots','Max','%'],
      ...teamOccupation.byEmployee.map(e=>[e.label,String(e.value),String(e.max),pct(e.value,e.max)+'%']),
      [''],
      ['--- Absences By Type ---'],
      ...absenceRate.typeSegments.map(s=>[s.label,String(s.value)]),
    ];
    const csv=rows.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download=`stats-${period}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();URL.revokeObjectURL(url);
  };

  /* ══════════ RENDER ══════════ */
  if(!canView){
    return <div style={{padding:40,textAlign:'center',color:th.text}}><h2>{L.accessDenied}</h2></div>;
  }

  if(loading){
    return(
      <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'60vh',color:th.textMuted,gap:16}}>
        <div style={{width:48,height:48,border:`4px solid ${colors.track}`,borderTopColor:colors.occupation,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
        <span style={{fontSize:14}}>{L.loading}</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const dayNames=[L.mon,L.tue,L.wed,L.thu,L.fri,L.sat];
  const trendLabels=periodWeeks.map(w=>`${L.weekNum}${w.week_number}`);

  return(
    <div style={{padding:'24px 28px',maxWidth:1280,margin:'0 auto',color:th.text,fontFamily:"'Inter','Segoe UI',sans-serif"}}>

      {/* ── HEADER ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:28}}>
        <h1 style={{fontSize:24,fontWeight:300,letterSpacing:2,margin:0,color:colors.occupation}}>
          {L.title}
        </h1>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {(['week','month','quarter','year'] as Period[]).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={periodBtn(period===p)}>{L[p]}</button>
          ))}
          <button onClick={exportCSV} style={{...periodBtn(false),marginLeft:8,border:`1px solid ${th.border}`}}>
            ⬇ {L.export}
          </button>
        </div>
      </div>

      {/* ── KPI GAUGES ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginBottom:28}}>
        <div style={kpiCard()} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)';}} onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
          <GaugeDonut value={teamOccupation.rate} size={80} strokeWidth={10} color={colors.occupation} trackColor={colors.track} label="" innerLabel={L.slots}/>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:th.textMuted,textTransform:'uppercase',letterSpacing:.5}}>{L.teamOccupation}</div>
            <div style={{fontSize:28,fontWeight:800,color:colors.occupation}}>{teamOccupation.rate}%</div>
            <div style={{fontSize:11,color:th.textDim}}>{teamOccupation.filledSlots} / {teamOccupation.totalSlots}</div>
          </div>
        </div>

        <div style={kpiCard()} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)';}} onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
          <GaugeDonut value={successRate.rate} size={80} strokeWidth={10} color={colors.success} trackColor={colors.track} label="" innerLabel={L.tasks}/>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:th.textMuted,textTransform:'uppercase',letterSpacing:.5}}>{L.successRate}</div>
            <div style={{fontSize:28,fontWeight:800,color:colors.success}}>{successRate.rate}%</div>
            <div style={{fontSize:11,color:th.textDim}}>{successRate.completed} / {successRate.total}</div>
          </div>
        </div>

        <div style={kpiCard()} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)';}} onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
          <GaugeDonut value={absenceRate.rate} size={80} strokeWidth={10} color={colors.absence} trackColor={colors.track} label="" innerLabel={L.rate}/>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:th.textMuted,textTransform:'uppercase',letterSpacing:.5}}>{L.absenceRate}</div>
            <div style={{fontSize:28,fontWeight:800,color:colors.absence}}>{absenceRate.rate}%</div>
            <div style={{fontSize:11,color:th.textDim}}>{absenceRate.absentDays} / {absenceRate.totalDays}</div>
          </div>
        </div>

        <div style={kpiCard()} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)';}} onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
          <GaugeDonut value={machineOccupation.usageRate} size={80} strokeWidth={10} color={colors.machine} trackColor={colors.track} label="" innerLabel={L.rate}/>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:th.textMuted,textTransform:'uppercase',letterSpacing:.5}}>{L.machineOccupation}</div>
            <div style={{fontSize:28,fontWeight:800,color:colors.machine}}>{machineOccupation.usageRate}%</div>
            <div style={{fontSize:11,color:th.textDim}}>{machineOccupation.inUse} / {machineOccupation.totalMachines}</div>
          </div>
        </div>
      </div>

      {/* ── WEEKLY TREND AREA CHARTS ── */}
      {periodWeeks.length>1&&(
        <div style={card({marginBottom:20})}>
          <div style={sectionTitle}><span>📈</span> {L.weeklyTrend}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:24}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:th.textMuted,marginBottom:8}}>{L.teamOccupation}</div>
              <AreaSparkline data={teamOccupation.trend} color={colors.occupation} width={260} height={60} labels={trendLabels}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:th.textMuted,marginBottom:8}}>{L.absenceRate}</div>
              <AreaSparkline data={absenceRate.trend} color={colors.absence} width={260} height={60} labels={trendLabels}/>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL SECTIONS ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(480px,1fr))',gap:20}}>

        {/* ─── TEAM OCCUPATION ─── */}
        <div style={card()}>
          <div style={sectionTitle}>
            <span>👥</span> {L.teamOccupation}
            <span style={{flex:1}}/>
            {([
              {key:'employee' as const,label:L.byEmployee},
              {key:'department' as const,label:L.byDepartment},
              {key:'day' as const,label:L.byDay},
              {key:'heatmap' as const,label:L.heatmap},
            ]).map(v=>(
              <button key={v.key} onClick={()=>setTeamView(v.key)} style={subtab(teamView===v.key)}>{v.label}</button>
            ))}
          </div>

          {teamView==='employee'&&(
            <BarChart data={teamOccupation.byEmployee} color={colors.occupation}
              maxVal={Math.max(...teamOccupation.byEmployee.map(d=>d.max),1)} th={th}/>
          )}

          {teamView==='department'&&(
            <>
              <div style={{display:'flex',justifyContent:'center',gap:40,marginBottom:20}}>
                {teamOccupation.byDept.map((d,i)=>(
                  <GaugeDonut key={i} value={pct(d.value,d.max)} size={110} strokeWidth={12}
                    color={i===0?colors.green:colors.orange} trackColor={colors.track}
                    label={d.label} sublabel={`${d.value}/${d.max} ${L.slots.toLowerCase()}`}/>
                ))}
              </div>
              <StackedBar th={th} segments={teamOccupation.byDept.map((d,i)=>({
                value:d.value,
                color:i===0?colors.green:colors.orange,
                label:d.label,
              }))}/>
            </>
          )}

          {teamView==='day'&&(
            <VerticalBarChart th={th} groups={teamOccupation.byDayGrouped}/>
          )}

          {teamView==='heatmap'&&teamOccupation.heatmapData.length>0&&(
            <HeatmapGrid
              data={teamOccupation.heatmapData}
              rowLabels={teamOccupation.heatmapRows}
              colLabels={dayNames}
              maxVal={Math.max(...teamOccupation.heatmapData.flat(),1)}
              baseColor={colors.occupation}
              th={th}/>
          )}
        </div>

        {/* ─── TASK / SUCCESS RATE ─── */}
        <div style={card()}>
          <div style={sectionTitle}><span>🎯</span> {L.taskDistribution}</div>

          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:32,marginBottom:20,flexWrap:'wrap'}}>
            <PieChart
              segments={successRate.statusCounts.map(s=>({value:s.count,color:s.color,label:s.status}))}
              size={160} strokeWidth={28} trackColor={colors.track}
              centerLabel={String(successRate.total)}/>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {successRate.statusCounts.map((s,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:14,height:14,borderRadius:4,background:s.color}}/>
                  <span style={{fontSize:12,color:th.textMuted,minWidth:80}}>
                    {s.status==='COMPLETED'?L.completed:s.status==='ACTIVE'?L.active:s.status==='PLANNED'?L.pending:L.cancelled}
                  </span>
                  <span style={{fontSize:14,fontWeight:800,color:s.color}}>{s.count}</span>
                  <span style={{fontSize:11,color:th.textDim}}>({pct(s.count,successRate.total)}%)</span>
                </div>
              ))}
            </div>
          </div>

          <StackedBar th={th} height={28} segments={successRate.statusCounts.map(s=>({
            value:s.count,color:s.color,
            label:s.status==='COMPLETED'?L.completed:s.status==='ACTIVE'?L.active:s.status==='PLANNED'?L.pending:L.cancelled,
          }))}/>
        </div>

        {/* ─── ABSENCE RATE ─── */}
        <div style={card()}>
          <div style={sectionTitle}>
            <span>🏥</span> {L.absenceBreakdown}
            <span style={{flex:1}}/>
            {([
              {key:'type' as const,label:L.byType},
              {key:'employee' as const,label:L.byEmployee},
              {key:'heatmap' as const,label:L.heatmap},
            ]).map(v=>(
              <button key={v.key} onClick={()=>setAbsView(v.key)} style={subtab(absView===v.key)}>{v.label}</button>
            ))}
          </div>

          {absView==='type'&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:32,flexWrap:'wrap'}}>
              {absenceRate.typeSegments.length>0?(
                <>
                  <PieChart
                    segments={absenceRate.typeSegments}
                    size={150} strokeWidth={24} trackColor={colors.track}
                    centerLabel={String(absenceRate.absentDays)}/>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {absenceRate.typeSegments.map((s,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:12,height:12,borderRadius:'50%',background:s.color}}/>
                        <span style={{fontSize:12,color:th.textMuted,minWidth:90}}>{s.label}</span>
                        <span style={{fontSize:14,fontWeight:800,color:s.color}}>{s.value}</span>
                        <span style={{fontSize:11,color:th.textDim}}>({pct(s.value,absenceRate.absentDays)}%)</span>
                      </div>
                    ))}
                  </div>
                </>
              ):(
                <div style={{fontSize:13,color:th.textDim,padding:20}}>{L.noData}</div>
              )}
            </div>
          )}

          {absView==='employee'&&(
            <BarChart data={absenceRate.byEmployee} color={colors.absence}
              maxVal={Math.max(...absenceRate.byEmployee.map(d=>d.max),1)} th={th}/>
          )}

          {absView==='heatmap'&&absenceRate.byDayEmployee.length>0&&(
            <HeatmapGrid
              data={absenceRate.byDayEmployee}
              rowLabels={absenceRate.heatmapRows}
              colLabels={dayNames}
              maxVal={Math.max(...absenceRate.byDayEmployee.flat(),1)}
              baseColor={colors.absence}
              th={th}/>
          )}
        </div>

        {/* ─── MACHINE OCCUPATION ─── */}
        <div style={card()}>
          <div style={sectionTitle}>
            <span>🚜</span> {L.machineOccupation}
            <span style={{flex:1}}/>
            {([
              {key:'status' as const,label:L.byStatus},
              {key:'machine' as const,label:L.byMachine},
              {key:'category' as const,label:L.byCategory},
            ]).map(v=>(
              <button key={v.key} onClick={()=>setMachView(v.key)} style={subtab(machView===v.key)}>{v.label}</button>
            ))}
          </div>

          {machView==='status'&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:32,flexWrap:'wrap',marginBottom:16}}>
              <PieChart
                segments={machineOccupation.statusSegments}
                size={150} strokeWidth={26} trackColor={colors.track}
                centerLabel={String(machineOccupation.totalMachines)}/>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {machineOccupation.statusSegments.map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:14,height:14,borderRadius:4,background:s.color}}/>
                    <span style={{fontSize:12,color:th.textMuted,minWidth:90}}>{s.label}</span>
                    <span style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</span>
                    <span style={{fontSize:11,color:th.textDim}}>({pct(s.value,machineOccupation.totalMachines)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {machView==='machine'&&(
            <BarChart data={machineOccupation.byMachine} color={colors.machine}
              maxVal={Math.max(...machineOccupation.byMachine.map(d=>d.max),1)} th={th}/>
          )}

          {machView==='category'&&(
            <>
              <div style={{display:'flex',justifyContent:'center',gap:32,marginBottom:16}}>
                {machineOccupation.byCategory.map((c,i)=>(
                  <GaugeDonut key={i} value={pct(c.value,c.max)} size={100} strokeWidth={10}
                    color={[colors.blue,colors.green,colors.orange,colors.purple][i%4]}
                    trackColor={colors.track} label={c.label} sublabel={`${c.value}/${c.max}`}/>
                ))}
              </div>
              <StackedBar th={th} segments={machineOccupation.byCategory.map((c,i)=>({
                value:c.value,
                color:[colors.blue,colors.green,colors.orange,colors.purple][i%4],
                label:c.label,
              }))}/>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
