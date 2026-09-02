import { db, sql } from '../src/db';
import { cabor } from '../src/db/schema';

// 46 cabang olahraga binaan KONI Kota Probolinggo (dipindah dari daftar statis frontend).
// Idempotent: dijalankan berulang tetap aman (duplikat dilewati).
const CABOR_AWAL = [
  'AKUATIK (AI)', 'ANGGAR (IKASI)', 'ANGKAT BERAT (PABERSI)', 'ANGKAT BESI (PABSI)',
  'ATLETIK (PASI)', 'BALAP SEPEDA (ISSI)', 'BERKUDA (PORDASI)', 'BERMOTOR (IMI)',
  'BILIARD (POBSI)', 'BINARAGA (PBFI)', 'BOLA TANGAN (ABTI)',
  'BOLA VOLI (PBVSI)', 'BRIDGE (GABSI)', 'BULU TANGKIS (PBSI)', 'CATUR (PERCASI)',
  'DANCESPORT (IODI)', 'DAYUNG (PODSI)', 'DOMINO (ORADO)', 'DRUMBAND (PDBI)',
  'FUTSAL (AFI)', 'HAPKIDO (HI)', 'KARATE (FORKI)', 'KURASH (FERKUSHI)',
  'MENEMBAK (PERBAKIN)', 'MUATHAY (MI)', 'PANAHAN (PERPANI)', 'PANJAT TEBING (FPTI)',
  'PENCAK SILAT (IPSI)', 'PETANQUE (FOPI)', 'SELAM (POSSI)', 'SENAM (PERSANI)',
  'SEPAK BOLA (PSSI)', 'SEPAK TAKRAW (PSTI)', 'SEPATU RODA (PERSEROSI)', 'SKY AIR (PSAWI)',
  'TAE KWON DO (TI)', 'TARUNG DRAJAT (KODRAT)', 'TENIS (PELTI)', 'TENIS MEJA (PTMSI)',
  'TINJU (PERTINA)', 'TRIATHLON (FTI)', 'WUSHU (WI)', 'ARUNG JERAM (FAJI)',
  'GATEBALL (PERGATSI)', 'IBCA MMA', 'PARAMOTOR (FASI)',
];

const rows = CABOR_AWAL.map((nama) => ({ nama }));
await db.insert(cabor).values(rows).onConflictDoNothing();
const [{ n }] = await sql`select count(*)::int as n from cabor`;
console.log(`Seed cabor selesai — total ${n} cabang di database.`);
process.exit(0);
