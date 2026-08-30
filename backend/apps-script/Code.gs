const SPREADSHEET_ID = "1oMthq7zz9FZBQBc8IkO6FSvOhNaE6-kGDfqH4eecq-E";

// Kolom tiap sheet (baris 1 spreadsheet harus persis seperti ini, urut)
const SCHEMA = {
  "atlit": ["id", "nama", "tempatLahir", "tanggalLahir", "jenisKelamin", "alamat", "kk", "akte", "ktp", "cabor", "createdBy", "proyeksiPorprov"],
  "prestasi": ["id", "atlitId", "nama", "tahun", "tingkat", "piagam"],
  "pelatih": ["id", "nama", "alamat", "jenisKelamin", "lisensi", "fileLisensi", "cabor", "createdBy"],
  "jadwal_latihan": ["id", "tempat", "hari", "jam", "cabor", "createdBy"],
  "klub/dojang/perguruan": ["id", "nama", "cabang", "alamat", "createdBy"],
  "users": ["id", "nama", "username", "passwordHash", "cabor", "role"],
  "pengurus": ["id", "nama", "jabatan", "bio", "foto"],
};

// ==== SETUP: aman dijalankan ulang kapan saja ====
// - Sheet baru dibuat lengkap
// - Header lama dimigrasi ke skema terbaru; DATA DIGESER sesuai pemetaan kolom
// - Kolom tidak dikenal dari versi lama akan di-drop
function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.entries(SCHEMA).forEach(([name, cols]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      ss.insertSheet(name);
      sh = ss.getSheetByName(name);
    }
    const lastRow = sh.getLastRow();
    if (lastRow === 0) {
      // kosong: langsung tulis header
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
      Logger.log("setup: buat header " + name);
      return;
    }
    const width = Math.max(sh.getLastColumn(), 1);
    const values = sh.getRange(1, 1, lastRow, width).getValues();
    const current = values[0].map((h) => String(h).trim());
    const unchanged = JSON.stringify(current.slice(0, cols.length)) === JSON.stringify(cols) && current.every((c) => !c || cols.includes(c));
    if (unchanged && width === cols.length) return;

    // migrasi: petakan tiap baris data menurut header lama
    const migrated = values.slice(1)
      .filter((r) => String(r[0]).trim())
      .map((r) =>
        cols.map((c) => {
          const i = current.indexOf(c);
          return i >= 0 ? r[i] : "";
        })
      );
    sh.clearContents();
    sh.getRange(1, 1, migrated.length + 1, cols.length)
      .setValues([cols].concat(migrated))
      .setFontWeight("bold");
    Logger.log("setup: migrasi " + name + " → " + migrated.length + " baris data tetap utuh");
  });
}

// Jalankan sekali untuk membuat admin pertama (sheet users kosong tidak bisa login)
function setupAdmin() {
  create_("users", {
    nama: "Admin KONI",
    username: "adminkoni",
    password: "binpres2026",
    cabor: "Semua",
    role: "Super Admin",
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hash_(pw) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw) + SALT);
  return digest.map((b) => ((b & 0xff) + 0x100).toString(16).slice(1)).join("");
}
const SALT = "binpres-koni-2026"; // ponytail: salt statis, pindah ke PropertiesService kalau butuh rotasi

function sheet_(name) {
  if (!SCHEMA[name]) throw new Error("Sheet tidak dikenal: " + name);
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sh) throw new Error("Sheet belum ada, jalankan setup() dulu: " + name);
  return sh;
}

function rows_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const cols = SCHEMA[name];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    if (!String(values[i][0]).trim()) continue;
    const row = {};
    cols.forEach((c, j) => (row[c] = values[i][j]));
    out.push(row);
  }
  return out;
}

// ==== GET: list semua baris ?sheet=atlit  (atlit otomatis menyertakan prestasi) ====
function doGet(e) {
  try {
    const name = e.parameter.sheet;
    if (!name) return json_({ ok: true, sheets: Object.keys(SCHEMA) });
    if (name === "all") {
      const data = {};
      Object.keys(SCHEMA).forEach((s) => (data[s] = rows_(s)));
      data.atlit.forEach((a) => (a.prestasi = data.prestasi.filter((p) => p.atlitId === a.id)));
      data.users.forEach((u) => delete u.passwordHash);
      return json_({ ok: true, data });
    }
    let data = rows_(name);
    if (name === "atlit") {
      const all = rows_("prestasi");
      data.forEach((a) => (a.prestasi = all.filter((p) => p.atlitId === a.id)));
    }
    if (name === "users") data.forEach((u) => delete u.passwordHash); // jangan pernah kirim hash ke client
    return json_({ ok: true, data });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ==== POST: { action: "create"|"update"|"delete", sheet, id?, data? } ====
// create atlit: data boleh menyertakan prestasi: [{nama, tahun, tingkat, piagam}]
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const req = JSON.parse(e.postData.contents);
    const { action, sheet, id, data } = req;
    if (action === "create") return json_(create_(sheet, data, req.actor));
    if (action === "update") return json_(update_(sheet, id, data));
    if (action === "delete") return json_(delete_(sheet, id));
    if (action === "login") return json_(login_(data.username, data.password));
    return json_({ ok: false, error: "action harus create|update|delete|login" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function toRow_(sheet, data) {
  return SCHEMA[sheet].map((c) => (data[c] !== undefined && data[c] !== null ? data[c] : ""));
}

// semua "upload" = link Google Drive (site statis tidak bisa menerima berkas fisik)
const DRIVE_RE = /^https?:\/\/(drive|docs)\.google\.com\//i;
const UPLOAD_FIELDS = { atlit: ["kk", "akte", "ktp"], pelatih: ["fileLisensi"], pengurus: ["foto"] };

function checkDrive_(sheet, data) {
  (UPLOAD_FIELDS[sheet] || []).forEach((f) => {
    const v = String(data[f] ?? "").trim();
    if (v && !DRIVE_RE.test(v)) throw new Error(f + " harus link Google Drive (https://drive.google.com/...)");
  });
  if (sheet === "atlit" && Array.isArray(data.prestasi)) {
    data.prestasi.forEach((p, i) => {
      const v = String((p && p.piagam) ?? "").trim();
      if (v && !DRIVE_RE.test(v)) throw new Error("prestasi ke-" + (i + 1) + ": piagam harus link Google Drive");
    });
  }
}

// sheet yang mencatat pembuatnya (RBAC: operator hanya melihat data buatannya sendiri)
const OWNERED = ['atlit', 'pelatih', 'jadwal_latihan', 'klub/dojang/perguruan'];

function create_(sheet, data, actor) {
  checkDrive_(sheet, data);
  // ponytail: actor dikirim client jadi bisa dipalsukan; enforcement server butuh token auth beneran
  if (OWNERED.includes(sheet) && actor) data.createdBy = String(actor);
  const id = Utilities.getUuid();
  const prestasi = sheet === "atlit" ? data.prestasi || [] : null;
  if (sheet === "users") {
    if (!data.password) throw new Error("password wajib diisi");
    data.passwordHash = hash_(data.password);
    delete data.password;
  }
  const row = toRow_(sheet, { ...data, id, prestasi: undefined });
  sheet_(sheet).appendRow(row);
  if (prestasi && prestasi.length) {
    const sh = sheet_("prestasi");
    const rows = prestasi.map((p) => toRow_("prestasi", { ...p, id: Utilities.getUuid(), atlitId: id }));
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, SCHEMA.prestasi.length).setValues(rows);
  }
  return { ok: true, id };
}

function findRow_(sheet, id) {
  const values = sheet_(sheet).getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1;
  }
  throw new Error("ID tidak ditemukan: " + id);
}

function update_(sheet, id, data) {
  checkDrive_(sheet, data);
  delete data.createdBy; // pembuat tidak boleh berubah saat edit
  const r = findRow_(sheet, id);
  const old = Object.fromEntries(
    SCHEMA[sheet].map((c, i) => [c, sheet_(sheet).getRange(r, i + 1).getValue()])
  );
  if (sheet === "users") {
    if (data.password) data.passwordHash = hash_(data.password);
    delete data.password;
  }
  // sinkronisasi prestasi atlit: hapus semua lalu insert ulang by atlitId
  let prestasi = null;
  if (sheet === "atlit" && Array.isArray(data.prestasi)) {
    prestasi = data.prestasi;
    delete data.prestasi;
    syncPrestasi_(id, prestasi);
  }
  sheet_(sheet).getRange(r, 1, 1, SCHEMA[sheet].length).setValues([
    toRow_(sheet, { ...old, ...data, id }),
  ]);
  return { ok: true };
}

function syncPrestasi_(atlitId, list) {
  const sh = sheet_("prestasi");
  const values = sh.getDataRange().getValues();
  // hapus dari baris terakhir agar indeks tidak geser
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][1] === atlitId) sh.deleteRow(i + 1);
  }
  if (list.length) {
    const rows = list.map((p) => toRow_("prestasi", { ...p, id: Utilities.getUuid(), atlitId }));
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, SCHEMA.prestasi.length).setValues(rows);
  }
}

// {action:"login", data:{username, password}} → user tanpa hash, atau error
function login_(username, password) {
  const user = rows_("users").find((u) => String(u.username).toLowerCase() === String(username).toLowerCase());
  if (!user || user.passwordHash !== hash_(password)) {
    return { ok: false, error: "Username atau password salah" };
  }
  delete user.passwordHash;
  return { ok: true, user };
}

function delete_(sheet, id) {
  sheet_(sheet).deleteRow(findRow_(sheet, id));
  if (sheet === "atlit") {
    rows_("prestasi").filter((p) => p.atlitId === id).forEach((p) => delete_("prestasi", p.id));
  }
  return { ok: true };
}
