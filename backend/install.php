<?php
/**
 * Dashboard Monitoring — Web Installer
 * Akses: https://yourdomain.com/backend/install.php
 * Hapus file ini setelah instalasi berhasil!
 */

define('INSTALLER_VERSION', '1.0');
define('LOCK_FILE',   __DIR__ . '/installed.lock');
define('ENV_FILE',    __DIR__ . '/../.env');
define('SQL_FILE',    __DIR__ . '/database/install.sql');

session_start();

// ── Block re-run ─────────────────────────────────────────────────────────────
if (file_exists(LOCK_FILE) && ($_GET['action'] ?? '') !== 'cleanup') {
    die(page('Sudah Terinstal', '<div class="card success-card">
        <div class="icon">✓</div>
        <h2>Dashboard sudah terinstal</h2>
        <p>File <code>installed.lock</code> ditemukan. Instalasi sudah pernah dijalankan.</p>
        <p class="warning">Jika ingin menginstal ulang, hapus file <code>backend/installed.lock</code> terlebih dahulu.</p>
        <a href="../" class="btn btn-primary">Buka Dashboard →</a>
    </div>'));
}

// ── AJAX: test connection ─────────────────────────────────────────────────────
if (($_GET['action'] ?? '') === 'test_db') {
    header('Content-Type: application/json');
    $h = trim($_POST['db_host'] ?? 'localhost');
    $p = trim($_POST['db_port'] ?? '3306');
    $n = trim($_POST['db_name'] ?? '');
    $u = trim($_POST['db_user'] ?? '');
    $w = $_POST['db_pass'] ?? '';
    try {
        $pdo = new PDO("mysql:host={$h};port={$p};charset=utf8mb4", $u, $w, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        // Check if DB exists
        $exists = $pdo->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = " . $pdo->quote($n))->fetchColumn();
        if (!$exists) {
            echo json_encode(['ok' => false, 'msg' => "Database '{$n}' tidak ditemukan. Buat dulu via cPanel > MySQL Databases."]);
        } else {
            echo json_encode(['ok' => true, 'msg' => "Koneksi berhasil! Database '{$n}' ditemukan."]);
        }
    } catch (PDOException $e) {
        echo json_encode(['ok' => false, 'msg' => 'Gagal: ' . $e->getMessage()]);
    }
    exit;
}

// ── AJAX: run install ─────────────────────────────────────────────────────────
if (($_GET['action'] ?? '') === 'run_install') {
    header('Content-Type: application/json');

    $cfg = [
        'db_host'      => trim($_POST['db_host'] ?? 'localhost'),
        'db_port'      => trim($_POST['db_port'] ?? '3306'),
        'db_name'      => trim($_POST['db_name'] ?? ''),
        'db_user'      => trim($_POST['db_user'] ?? ''),
        'db_pass'      => $_POST['db_pass'] ?? '',
        'frontend_url' => rtrim(trim($_POST['frontend_url'] ?? ''), '/'),
        'admin_email'  => trim($_POST['admin_email'] ?? 'admin@example.com'),
        'admin_pass'   => $_POST['admin_pass'] ?? '',
    ];

    $errors = [];
    if (!$cfg['db_name']) $errors[] = 'Nama database wajib diisi.';
    if (!$cfg['db_user']) $errors[] = 'Username database wajib diisi.';
    if (!$cfg['frontend_url']) $errors[] = 'URL frontend wajib diisi.';
    if ($cfg['admin_pass'] && strlen($cfg['admin_pass']) < 8) $errors[] = 'Password admin minimal 8 karakter.';
    if ($errors) { echo json_encode(['ok' => false, 'log' => $errors]); exit; }

    $log = [];

    // 1. Connect
    try {
        $pdo = new PDO(
            "mysql:host={$cfg['db_host']};port={$cfg['db_port']};dbname={$cfg['db_name']};charset=utf8mb4",
            $cfg['db_user'], $cfg['db_pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $log[] = ['ok' => true, 'msg' => "Koneksi ke database '{$cfg['db_name']}' berhasil."];
    } catch (PDOException $e) {
        echo json_encode(['ok' => false, 'log' => [['ok' => false, 'msg' => 'Koneksi gagal: ' . $e->getMessage()]]]);
        exit;
    }

    // 2. Run SQL
    if (!file_exists(SQL_FILE)) {
        echo json_encode(['ok' => false, 'log' => [['ok' => false, 'msg' => 'File install.sql tidak ditemukan di ' . SQL_FILE]]]);
        exit;
    }
    $sql = file_get_contents(SQL_FILE);
    // Split statements on semicolons, skip SET/comments-only lines
    $statements = array_filter(
        array_map('trim', preg_split('/;\s*\n/', $sql)),
        fn($s) => $s !== '' && !preg_match('/^--/', $s)
    );
    $sqlErrors = 0;
    foreach ($statements as $stmt) {
        try {
            $pdo->exec($stmt);
        } catch (PDOException $e) {
            // Ignore "already exists" errors for idempotency
            $code = $e->getCode();
            if (in_array($code, ['42S01', '42000', '23000'])) {
                // Table exists or duplicate — might be ok
            }
            // Log but don't abort
            $log[] = ['ok' => false, 'msg' => 'SQL warning: ' . $e->getMessage()];
            $sqlErrors++;
        }
    }
    $log[] = ['ok' => true, 'msg' => "Skema database berhasil dibuat (" . count($statements) . " pernyataan, {$sqlErrors} warning)."];

    // 3. Custom admin account (if provided)
    if ($cfg['admin_email'] && $cfg['admin_pass']) {
        try {
            $hash = password_hash($cfg['admin_pass'], PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $pdo->prepare(
                "INSERT INTO users (name, email, password_hash, role, status) VALUES ('Administrator', ?, ?, 'admin', 'active')
                 ON DUPLICATE KEY UPDATE password_hash = ?, status = 'active'"
            );
            $stmt->execute([$cfg['admin_email'], $hash, $hash]);
            $log[] = ['ok' => true, 'msg' => "Akun admin '{$cfg['admin_email']}' berhasil dibuat/diperbarui."];
        } catch (PDOException $e) {
            $log[] = ['ok' => false, 'msg' => 'Gagal buat admin: ' . $e->getMessage()];
        }
    }

    // 4. Write .env
    $envContent = "# Dashboard Monitoring — generated by installer\n"
        . "# " . date('Y-m-d H:i:s') . "\n\n"
        . "DB_HOST={$cfg['db_host']}\n"
        . "DB_PORT={$cfg['db_port']}\n"
        . "DB_NAME={$cfg['db_name']}\n"
        . "DB_USER={$cfg['db_user']}\n"
        . "DB_PASS={$cfg['db_pass']}\n\n"
        . "FRONTEND_URL={$cfg['frontend_url']}\n";

    if (file_put_contents(ENV_FILE, $envContent) === false) {
        $log[] = ['ok' => false, 'msg' => 'Gagal menulis .env — cek permission folder public_html. Tulis manual:\n' . htmlspecialchars($envContent)];
    } else {
        $log[] = ['ok' => true, 'msg' => '.env berhasil dibuat di ' . realpath(ENV_FILE)];
    }

    // 5. Write lock file
    file_put_contents(LOCK_FILE, date('Y-m-d H:i:s') . "\nInstalled by web installer v" . INSTALLER_VERSION . "\n");
    $log[] = ['ok' => true, 'msg' => 'Lock file dibuat — installer tidak bisa dijalankan ulang.'];

    echo json_encode(['ok' => true, 'log' => $log]);
    exit;
}

// ── AJAX: cleanup (delete self) ───────────────────────────────────────────────
if (($_GET['action'] ?? '') === 'cleanup') {
    header('Content-Type: application/json');
    $deleted = @unlink(__FILE__);
    echo json_encode(['ok' => $deleted]);
    exit;
}

// ── Gather requirements ───────────────────────────────────────────────────────
$reqs = [
    ['name' => 'PHP ≥ 8.0',         'ok' => version_compare(PHP_VERSION, '8.0', '>='), 'val' => PHP_VERSION],
    ['name' => 'Ekstensi PDO',       'ok' => extension_loaded('pdo'),                   'val' => ''],
    ['name' => 'Ekstensi PDO_MySQL', 'ok' => extension_loaded('pdo_mysql'),             'val' => ''],
    ['name' => 'file_put_contents',  'ok' => function_exists('file_put_contents'),       'val' => ''],
    ['name' => 'install.sql tersedia','ok' => file_exists(SQL_FILE),                    'val' => SQL_FILE],
    ['name' => 'Folder .env writable','ok' => is_writable(dirname(ENV_FILE)),           'val' => dirname(ENV_FILE)],
];
$allOk = !in_array(false, array_column($reqs, 'ok'));

// ── Page render ───────────────────────────────────────────────────────────────
echo page('Installer', mainContent($reqs, $allOk));

// =============================================================================
function mainContent(array $reqs, bool $allOk): string {
    $reqRows = '';
    foreach ($reqs as $r) {
        $icon  = $r['ok'] ? '✓' : '✗';
        $cls   = $r['ok'] ? 'req-ok' : 'req-fail';
        $val   = $r['val'] ? "<span class='req-val'>{$r['val']}</span>" : '';
        $reqRows .= "<div class='req-row {$cls}'><span class='req-icon'>{$icon}</span><span class='req-name'>{$r['name']}</span>{$val}</div>";
    }
    $reqStatus = $allOk
        ? "<div class='req-summary ok'>Semua persyaratan terpenuhi — lanjutkan ke konfigurasi.</div>"
        : "<div class='req-summary fail'>Beberapa persyaratan tidak terpenuhi. Hubungi hosting support.</div>";

    $disabledAttr = $allOk ? '' : 'disabled';

    return <<<HTML
<div class="wizard">

  <!-- Step indicator -->
  <div class="steps">
    <div class="step active" id="step-dot-1"><span>1</span><label>Persyaratan</label></div>
    <div class="step-line"></div>
    <div class="step" id="step-dot-2"><span>2</span><label>Konfigurasi</label></div>
    <div class="step-line"></div>
    <div class="step" id="step-dot-3"><span>3</span><label>Instalasi</label></div>
    <div class="step-line"></div>
    <div class="step" id="step-dot-4"><span>4</span><label>Selesai</label></div>
  </div>

  <!-- Step 1: Requirements -->
  <div class="panel" id="panel-1">
    <h2>Pemeriksaan Persyaratan</h2>
    <div class="req-list">{$reqRows}</div>
    {$reqStatus}
    <div class="btn-row">
      <button class="btn btn-primary" onclick="goTo(2)" {$disabledAttr}>Lanjut →</button>
    </div>
  </div>

  <!-- Step 2: Config -->
  <div class="panel hidden" id="panel-2">
    <h2>Konfigurasi</h2>

    <fieldset>
      <legend>Database</legend>
      <div class="field-row">
        <div class="field">
          <label>Host</label>
          <input id="db_host" value="localhost" placeholder="localhost">
        </div>
        <div class="field field-sm">
          <label>Port</label>
          <input id="db_port" value="3306" placeholder="3306">
        </div>
      </div>
      <div class="field">
        <label>Nama Database <span class="req-mark">*</span></label>
        <input id="db_name" placeholder="dashboard_db">
        <p class="hint">Buat dulu via cPanel → MySQL Databases sebelum install.</p>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Username <span class="req-mark">*</span></label>
          <input id="db_user" placeholder="cpanel_dbuser">
        </div>
        <div class="field">
          <label>Password</label>
          <input id="db_pass" type="password" placeholder="(kosong jika tidak ada)">
        </div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="testDB()">Test Koneksi</button>
      <div id="db_test_result" class="test-result hidden"></div>
    </fieldset>

    <fieldset>
      <legend>Aplikasi</legend>
      <div class="field">
        <label>URL Frontend <span class="req-mark">*</span></label>
        <input id="frontend_url" placeholder="https://namadomain.com" value="<?= htmlspecialchars('https://' . ($_SERVER['HTTP_HOST'] ?? 'namadomain.com')) ?>">
        <p class="hint">URL tempat file Next.js dihosting. Dipakai untuk CORS.</p>
      </div>
    </fieldset>

    <fieldset>
      <legend>Akun Admin</legend>
      <p class="hint">Kosongkan untuk memakai akun default: <code>admin@example.com / Admin@123456</code></p>
      <div class="field">
        <label>Email Admin</label>
        <input id="admin_email" type="email" placeholder="admin@example.com">
      </div>
      <div class="field">
        <label>Password Admin</label>
        <input id="admin_pass" type="password" placeholder="Min. 8 karakter">
      </div>
    </fieldset>

    <div class="btn-row">
      <button class="btn btn-outline" onclick="goTo(1)">← Kembali</button>
      <button class="btn btn-primary" onclick="startInstall()">Mulai Instalasi →</button>
    </div>
  </div>

  <!-- Step 3: Installing -->
  <div class="panel hidden" id="panel-3">
    <h2>Menjalankan Instalasi…</h2>
    <div class="progress-wrap"><div class="progress-bar" id="progress-bar"></div></div>
    <div id="install-log" class="log"></div>
  </div>

  <!-- Step 4: Done -->
  <div class="panel hidden" id="panel-4">
    <div class="success-icon">✓</div>
    <h2>Instalasi Berhasil!</h2>
    <p>Database dan konfigurasi sudah siap. Langkah selanjutnya:</p>
    <ol class="checklist">
      <li>Upload folder <code>out/</code> (hasil build Next.js) ke <code>public_html/</code></li>
      <li>Login ke dashboard dengan akun admin yang sudah dikonfigurasi</li>
      <li><strong>Hapus installer ini</strong> demi keamanan</li>
    </ol>
    <div class="btn-row">
      <button class="btn btn-danger" onclick="deleteInstaller()">Hapus Installer Sekarang</button>
      <a href="../" class="btn btn-primary">Buka Dashboard →</a>
    </div>
    <div id="delete-result" class="test-result hidden" style="margin-top:1rem"></div>
  </div>

</div>

<script>
function goTo(n) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-' + n).classList.remove('hidden');
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.toggle('active', i < n);
    s.classList.toggle('done',   i < n - 1);
  });
  window.scrollTo(0, 0);
}

async function testDB() {
  const el = document.getElementById('db_test_result');
  el.textContent = 'Menghubungkan…';
  el.className = 'test-result info';

  const fd = new FormData();
  fd.append('db_host', document.getElementById('db_host').value);
  fd.append('db_port', document.getElementById('db_port').value);
  fd.append('db_name', document.getElementById('db_name').value);
  fd.append('db_user', document.getElementById('db_user').value);
  fd.append('db_pass', document.getElementById('db_pass').value);

  const res  = await fetch('?action=test_db', { method: 'POST', body: fd });
  const data = await res.json();
  el.textContent = data.msg;
  el.className   = 'test-result ' + (data.ok ? 'ok' : 'fail');
}

async function startInstall() {
  const fields = {
    db_name: document.getElementById('db_name').value.trim(),
    db_user: document.getElementById('db_user').value.trim(),
    frontend_url: document.getElementById('frontend_url').value.trim(),
  };
  if (!fields.db_name || !fields.db_user || !fields.frontend_url) {
    alert('Lengkapi field yang wajib diisi (*).');
    return;
  }

  goTo(3);
  const logEl = document.getElementById('install-log');
  const bar   = document.getElementById('progress-bar');

  const appendLog = (entry) => {
    const d = document.createElement('div');
    d.className = 'log-line ' + (entry.ok ? 'log-ok' : 'log-warn');
    d.textContent = (entry.ok ? '✓ ' : '⚠ ') + (typeof entry === 'string' ? entry : entry.msg);
    logEl.appendChild(d);
  };

  const fd = new FormData();
  fd.append('db_host',      document.getElementById('db_host').value);
  fd.append('db_port',      document.getElementById('db_port').value);
  fd.append('db_name',      document.getElementById('db_name').value);
  fd.append('db_user',      document.getElementById('db_user').value);
  fd.append('db_pass',      document.getElementById('db_pass').value);
  fd.append('frontend_url', document.getElementById('frontend_url').value);
  fd.append('admin_email',  document.getElementById('admin_email').value);
  fd.append('admin_pass',   document.getElementById('admin_pass').value);

  bar.style.width = '30%';
  try {
    const res  = await fetch('?action=run_install', { method: 'POST', body: fd });
    bar.style.width = '80%';
    const data = await res.json();

    if (Array.isArray(data.log)) data.log.forEach(appendLog);
    else if (Array.isArray(data.log)) data.log.forEach(e => appendLog(typeof e === 'string' ? { ok: false, msg: e } : e));

    bar.style.width = '100%';
    if (data.ok) {
      setTimeout(() => goTo(4), 800);
    } else {
      appendLog({ ok: false, msg: 'Instalasi gagal. Periksa log di atas.' });
    }
  } catch (e) {
    bar.style.width = '100%';
    bar.style.background = '#ef4444';
    appendLog({ ok: false, msg: 'Network error: ' + e.message });
  }
}

async function deleteInstaller() {
  if (!confirm('Hapus file install.php sekarang? Pastikan instalasi sudah berhasil sebelum lanjut.')) return;
  const res  = await fetch('?action=cleanup', { method: 'GET' });
  const data = await res.json();
  const el   = document.getElementById('delete-result');
  if (data.ok) {
    el.textContent = '✓ install.php berhasil dihapus. Bookmark halaman ini tidak akan bisa dibuka lagi.';
    el.className   = 'test-result ok';
  } else {
    el.textContent = '⚠ Gagal menghapus otomatis. Hapus file backend/install.php manual via File Manager cPanel.';
    el.className   = 'test-result fail';
  }
  el.classList.remove('hidden');
}
</script>
HTML;
}

// =============================================================================
function page(string $title, string $body): string {
    return <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard Monitoring — Installer</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 2rem 1rem; }
  a { color: #60a5fa; }
  .container { max-width: 640px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 2rem; }
  .header h1 { font-size: 1.5rem; font-weight: 700; color: #f1f5f9; }
  .header p  { color: #94a3b8; margin-top: .25rem; font-size: .875rem; }
  .logo { width: 48px; height: 48px; background: #3b82f6; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: .75rem; }
  .wizard { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; }

  /* Steps */
  .steps { display: flex; align-items: center; margin-bottom: 2rem; }
  .step  { display: flex; flex-direction: column; align-items: center; gap: .3rem; }
  .step span { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #475569; display: flex; align-items: center; justify-content: center; font-size: .8rem; font-weight: 700; color: #64748b; background: #0f172a; transition: all .2s; }
  .step label { font-size: .7rem; color: #64748b; white-space: nowrap; }
  .step.active span { border-color: #3b82f6; color: #3b82f6; }
  .step.active label { color: #93c5fd; }
  .step.done span { background: #3b82f6; border-color: #3b82f6; color: #fff; }
  .step.done label { color: #93c5fd; }
  .step-line { flex: 1; height: 2px; background: #334155; margin: 0 .5rem; margin-bottom: 1.2rem; }

  /* Panels */
  .panel h2 { font-size: 1.125rem; font-weight: 700; margin-bottom: 1.25rem; color: #f1f5f9; }
  .hidden   { display: none !important; }

  /* Reqs */
  .req-list { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
  .req-row  { display: flex; align-items: center; gap: .75rem; padding: .6rem .75rem; border-radius: 8px; background: #0f172a; font-size: .875rem; }
  .req-ok   { border-left: 3px solid #22c55e; }
  .req-fail { border-left: 3px solid #ef4444; }
  .req-icon { font-weight: 700; font-size: 1rem; min-width: 1rem; }
  .req-ok   .req-icon { color: #22c55e; }
  .req-fail .req-icon { color: #ef4444; }
  .req-name { flex: 1; }
  .req-val  { font-size: .75rem; color: #94a3b8; font-family: monospace; }
  .req-summary { padding: .75rem 1rem; border-radius: 8px; font-size: .875rem; margin-bottom: 1.25rem; }
  .req-summary.ok   { background: #14532d; color: #86efac; border: 1px solid #166534; }
  .req-summary.fail { background: #450a0a; color: #fca5a5; border: 1px solid #7f1d1d; }

  /* Fieldset */
  fieldset { border: 1px solid #334155; border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem; }
  legend   { font-size: .8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 0 .5rem; }
  .field   { margin-bottom: 1rem; }
  .field:last-child { margin-bottom: 0; }
  .field-row { display: flex; gap: .75rem; }
  .field-row .field { flex: 1; }
  .field-sm { flex: 0 0 90px !important; }
  label    { display: block; font-size: .8rem; font-weight: 600; color: #cbd5e1; margin-bottom: .35rem; }
  input[type=text], input[type=password], input[type=email], input:not([type]) {
    width: 100%; padding: .55rem .75rem; background: #0f172a; border: 1px solid #475569;
    border-radius: 8px; color: #e2e8f0; font-size: .875rem; outline: none; transition: border .15s;
  }
  input:focus { border-color: #3b82f6; }
  .hint    { font-size: .75rem; color: #64748b; margin-top: .3rem; }
  .req-mark { color: #ef4444; }

  /* Buttons */
  .btn-row { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1.5rem; }
  .btn     { padding: .6rem 1.25rem; border-radius: 8px; font-size: .875rem; font-weight: 600; border: none; cursor: pointer; text-decoration: none; transition: opacity .15s; display: inline-flex; align-items: center; }
  .btn:hover { opacity: .85; }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn-primary { background: #3b82f6; color: #fff; }
  .btn-outline  { background: transparent; color: #94a3b8; border: 1px solid #475569; }
  .btn-danger   { background: #dc2626; color: #fff; }
  .btn-sm  { font-size: .8rem; padding: .4rem .9rem; margin-top: .5rem; }

  /* Test result */
  .test-result { font-size: .8rem; margin-top: .6rem; padding: .5rem .75rem; border-radius: 6px; }
  .test-result.ok   { background: #14532d; color: #86efac; }
  .test-result.fail { background: #450a0a; color: #fca5a5; }
  .test-result.info { background: #1e3a5f; color: #93c5fd; }

  /* Progress */
  .progress-wrap { height: 6px; background: #334155; border-radius: 9999px; overflow: hidden; margin-bottom: 1.5rem; }
  .progress-bar  { height: 100%; background: #3b82f6; border-radius: 9999px; width: 0; transition: width .4s ease; }

  /* Log */
  .log { display: flex; flex-direction: column; gap: .35rem; }
  .log-line { font-size: .8rem; padding: .45rem .75rem; border-radius: 6px; font-family: monospace; }
  .log-ok   { background: #14532d; color: #86efac; }
  .log-warn { background: #422006; color: #fde68a; }

  /* Success panel */
  .success-icon { font-size: 3rem; color: #22c55e; text-align: center; margin-bottom: .75rem; }
  .success-card { text-align: center; }
  .success-card h2 { margin-bottom: .5rem; }
  .success-card p  { color: #94a3b8; margin-bottom: .5rem; }
  .success-card .warning { color: #fde68a; font-size: .875rem; }
  .checklist { padding-left: 1.25rem; margin: 1rem 0; color: #cbd5e1; font-size: .875rem; display: flex; flex-direction: column; gap: .5rem; }
  code { background: #0f172a; padding: .15rem .4rem; border-radius: 4px; font-size: .8rem; font-family: monospace; }
  @media (max-width: 480px) { .field-row { flex-direction: column; } .field-sm { flex: unset !important; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">📊</div>
    <h1>Dashboard Monitoring</h1>
    <p>Web Installer v{$GLOBALS['INSTALLER_VERSION']}</p>
  </div>
  {$body}
</div>
</body>
</html>
HTML;
}
