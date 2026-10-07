const { app, BrowserWindow, Menu, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const edid = require('./edid');

// Set to false to skip the monitor-size lookup entirely.
// The on-screen ruler then relies on manual calibration only.
const AUTO_DETECT_MONITOR_SIZE = true;

let win = null;

/* ---------------- monitor size lookup (Windows only) ---------------- */

// Reads the EDID block of every active monitor. Single quotes only, so no
// command-line quoting issues; read-only; no admin rights needed.
const PS_SCRIPT = String.raw`$ErrorActionPreference='SilentlyContinue'; $vot=@{}; Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorConnectionParams | ForEach-Object { $vot[$_.InstanceName]=[int64]$_.VideoOutputTechnology }; $out=@(); Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID | ForEach-Object { $n=$_.InstanceName; $p=$n -replace '_\d+$',''; $e=(Get-ItemProperty -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Enum\'+$p+'\Device Parameters')).EDID; if($e){ $out+=[pscustomobject]@{inst=$n; vot=$vot[$n]; edid=(($e | ForEach-Object { $_.ToString('x2') }) -join '')} } }; ConvertTo-Json -InputObject @($out) -Compress`;

function scanMonitors() {
  if (!AUTO_DETECT_MONITOR_SIZE || process.platform !== 'win32') return Promise.resolve([]);
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
      { windowsHide: true, timeout: 12000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) { console.log('[ruler] monitor scan failed:', err.message); return resolve([]); }
        try {
          let data = JSON.parse(String(stdout).trim() || '[]');
          if (!Array.isArray(data)) data = [data];
          const monitors = data.map(edid.parseMonitorRecord).filter(Boolean);
          console.log('[ruler] monitors found:', monitors.length);
          resolve(monitors);
        } catch (e) {
          console.log('[ruler] could not read monitor scan output:', e.message);
          resolve([]);
        }
      }
    );
  });
}

let scanPromise = null;
let scanDone = false;
function getScan(force) {
  if (force || !scanPromise) {
    scanDone = false;
    scanPromise = scanMonitors().then((m) => { scanDone = true; return m; });
  }
  return scanPromise;
}

/* ---------------- display info sent to the page ---------------- */

async function buildInfo() {
  if (!win || win.isDestroyed()) return null;
  const d = screen.getDisplayMatching(win.getBounds());
  const scan = getScan(false);
  const monitors = scanDone ? await scan : null;

  const info = {
    key: String(d.id),
    id: d.id,
    internal: !!d.internal,
    scaleFactor: d.scaleFactor,
    sizeDip: { width: d.size.width, height: d.size.height },
    autoWidthMm: null,
    autoPending: false,
    autoReason: null
  };

  if (!AUTO_DETECT_MONITOR_SIZE || process.platform !== 'win32') {
    info.autoReason = 'disabled';
  } else if (monitors === null) {
    info.autoPending = true;
  } else {
    const result = edid.matchDisplay(
      {
        sizePx: {
          w: Math.round(d.size.width * d.scaleFactor),
          h: Math.round(d.size.height * d.scaleFactor)
        },
        internal: !!d.internal
      },
      monitors
    );
    if (result.widthMm) info.autoWidthMm = result.widthMm;
    else info.autoReason = result.reason;
  }
  return info;
}

let lastSent = '';
async function pushInfo(force) {
  const info = await buildInfo();
  if (!info || !win || win.isDestroyed()) return;
  const serialized = JSON.stringify(info);
  if (!force && serialized === lastSent) return;
  lastSent = serialized;
  win.webContents.send('ruler:display-changed', info);
}

function debounce(fn, ms) {
  let t = null;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

ipcMain.handle('ruler:get-display-info', () => buildInfo());
ipcMain.handle('ruler:rescan', async () => {
  await getScan(true);
  return buildInfo();
});

/* ---------------- window ---------------- */

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');

  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 480,
    title: 'Measure.',
    backgroundColor: '#ECE7DC',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));

  // Keep the page at 100% zoom so the ruler's physical size can't drift.
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('zoom-changed', () => win.webContents.setZoomFactor(1));
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(1));

  // Tell the page when it moves to another monitor or the display setup changes.
  const debouncedPush = debounce(() => pushInfo(false), 150);
  win.on('move', debouncedPush);
  win.on('resize', debouncedPush);
  win.on('closed', () => { win = null; });

  // When the first monitor scan finishes, send the page the auto-detected size.
  getScan(false).then(() => pushInfo(false));
}

app.whenReady().then(() => {
  createWindow();

  const rescanLater = () => setTimeout(() => { getScan(true).then(() => pushInfo(false)); }, 1500);
  screen.on('display-added', rescanLater);
  screen.on('display-removed', rescanLater);
  screen.on('display-metrics-changed', debounce(() => pushInfo(false), 150));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
