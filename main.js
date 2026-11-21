const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } }
function writeCfg(c) { try { fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(c)); } catch (e) {} }

let win = null;

function createWindow() {
  const b = readCfg().bounds || {};
  win = new BrowserWindow({
    width: b.width || 1280, height: b.height || 860, x: b.x, y: b.y,
    minWidth: 760, minHeight: 520,
    title: 'Учебный вокзал',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  win.on('close', () => { if (!win.isMaximized() && !win.isMinimized()) { const c = readCfg(); c.bounds = win.getBounds(); writeCfg(c); } });
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) createWindow(); });

/* ---------- папка с конспектами ---------- */
function folder() { const f = readCfg().folder; return f && fs.existsSync(f) ? f : null; }
function okName(n) { return typeof n === 'string' && n.length > 3 && n.length < 200 && n === path.basename(n) && /\.md$/i.test(n) && !n.startsWith('.'); }
function full(n) { const f = folder(); if (!f) throw new Error('Папка не выбрана'); if (!okName(n)) throw new Error('Недопустимое имя файла'); return path.join(f, n); }

ipcMain.handle('cfg:get', () => { const c = readCfg(); const f = folder(); return { folder: f, missing: !!c.folder && !f, savedFolder: c.folder || null }; });

ipcMain.handle('folder:pick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Папка для конспектов', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const c = readCfg(); c.folder = r.filePaths[0]; writeCfg(c); return c.folder;
});
ipcMain.handle('folder:clear', () => { const c = readCfg(); delete c.folder; writeCfg(c); return true; });
ipcMain.handle('folder:open', () => { const f = folder(); return f ? shell.openPath(f) : ''; });

ipcMain.handle('notes:list', () => {
  const f = folder(); if (!f) return [];
  return fs.readdirSync(f, { withFileTypes: true })
    .filter(d => d.isFile() && okName(d.name))
    .map(d => { const p = path.join(f, d.name); let text = ''; try { text = fs.readFileSync(p, 'utf8'); } catch (e) {} return { file: d.name, text: text.replace(/^\uFEFF/, ''), mtime: fs.statSync(p).mtimeMs }; });
});
ipcMain.handle('notes:write', (e, file, text) => {
  const p = full(file), tmp = p + '.tmp';
  fs.writeFileSync(tmp, String(text), 'utf8'); fs.renameSync(tmp, p); return fs.statSync(p).mtimeMs;
});
ipcMain.handle('notes:rename', (e, from, to) => {
  const a = full(from), b = full(to);
  if (!fs.existsSync(a)) return false;
  if (a.toLowerCase() !== b.toLowerCase() && fs.existsSync(b)) throw new Error('Файл уже существует');
  fs.renameSync(a, b); return true;
});
// удаление — в корзину, чтобы можно было вернуть
ipcMain.handle('notes:remove', async (e, file) => {
  const p = full(file); if (!fs.existsSync(p)) return true;
  try { await shell.trashItem(p); } catch (err) { fs.unlinkSync(p); } return true;
});
