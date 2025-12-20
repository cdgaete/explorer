const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess;
let llmProcess;

// Detect if we're in development based on directory structure
const isDev = !app.isPackaged && fs.existsSync(path.join(__dirname, '..', '..', 'backend'));

console.log('[Electron] isDev:', isDev);
console.log('[Electron] __dirname:', __dirname);

// Get resource paths
function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', '..', relativePath);
  } else {
    return path.join(process.resourcesPath, relativePath);
  }
}

// Get writable data path for packaged app
function getDataPath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', '..', relativePath);
  } else {
    return path.join(app.getPath('userData'), relativePath);
  }
}

// Copy backend to writable location if needed (for packaged app)
function setupBackend() {
  if (isDev) return getResourcePath('backend');
  
  const sourceBackend = getResourcePath('backend');
  const targetBackend = getDataPath('backend');
  
  if (!fs.existsSync(targetBackend)) {
    console.log('[Electron] Copying backend to:', targetBackend);
    fs.mkdirSync(targetBackend, { recursive: true });
    
    const files = fs.readdirSync(sourceBackend);
    for (const file of files) {
      const src = path.join(sourceBackend, file);
      const dst = path.join(targetBackend, file);
      fs.copyFileSync(src, dst);
    }
  }
  
  return targetBackend;
}

// Kill processes by port
function killByPort(port) {
  const isWin = process.platform === 'win32';
  
  if (isWin) {
    try {
      // Windows: use netstat + taskkill
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = result.trim().split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }); } catch (e) {}
        }
      });
    } catch (e) {}
  } else {
    try {
      execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: 'pipe' });
    } catch (e) {}
    try {
      const result = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf8' });
      const pids = result.trim().split('\n').filter(p => p);
      pids.forEach(pid => {
        try { process.kill(parseInt(pid), 'SIGKILL'); } catch (e) {}
      });
    } catch (e) {}
  }
}

// Cleanup all server processes
function cleanup() {
  console.log('[Electron] Cleaning up processes...');
  
  // Kill by process reference
  if (pythonProcess && pythonProcess.pid) {
    try { process.kill(-pythonProcess.pid, 'SIGKILL'); } catch (e) {}
    try { pythonProcess.kill('SIGKILL'); } catch (e) {}
  }
  if (llmProcess && llmProcess.pid) {
    try { process.kill(-llmProcess.pid, 'SIGKILL'); } catch (e) {}
    try { llmProcess.kill('SIGKILL'); } catch (e) {}
  }
  
  // Also kill by port as fallback
  killByPort(8000);
  killByPort(8080);
  
  console.log('[Electron] Cleanup done');
}

function startPythonBackend() {
  const backendPath = setupBackend();
  const isWin = process.platform === 'win32';
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const pixiPath = isWin 
    ? path.join(homeDir, '.pixi', 'bin', 'pixi.exe')
    : path.join(homeDir, '.pixi', 'bin', 'pixi');
  
  console.log('[Electron] Starting FastAPI backend from:', backendPath);
  
  if (!fs.existsSync(backendPath)) {
    console.error('[Electron] Backend path does not exist:', backendPath);
    return;
  }
  
  if (!fs.existsSync(pixiPath)) {
    const installCmd = isWin 
      ? 'powershell -c "iwr -useb https://pixi.sh/install.ps1 | iex"'
      : 'curl -fsSL https://pixi.sh/install.sh | bash';
    console.error(`[Electron] Pixi not found. Please install: ${installCmd}`);
    return;
  }
  
  if (!isDev) {
    console.log('[Electron] Running pixi install...');
    try {
      execSync(`${pixiPath} install`, { cwd: backendPath, stdio: 'pipe' });
    } catch (e) {}
  }
  
  pythonProcess = spawn(pixiPath, ['run', 'serve'], {
    cwd: backendPath,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  pythonProcess.stdout.on('data', (data) => console.log(`[FastAPI] ${data}`));
  pythonProcess.stderr.on('data', (data) => console.log(`[FastAPI] ${data}`));
  pythonProcess.on('error', (err) => console.error('[Electron] Backend error:', err));
}

function startLLMServer() {
  const llmPath = getResourcePath('llm-server');
  const isWin = process.platform === 'win32';
  const startScript = path.join(llmPath, 'scripts', isWin ? 'start.bat' : 'start.sh');
  
  console.log('[Electron] Starting LLM server from:', llmPath);
  
  if (!fs.existsSync(startScript)) {
    console.error('[Electron] LLM start script not found:', startScript);
    return;
  }
  
  if (isWin) {
    llmProcess = spawn('cmd.exe', ['/c', startScript], {
      cwd: llmPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });
  } else {
    llmProcess = spawn('bash', [startScript], {
      cwd: llmPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });
  }

  llmProcess.stdout.on('data', (data) => console.log(`[LLM] ${data}`));
  llmProcess.stderr.on('data', (data) => console.log(`[LLM] ${data}`));
  llmProcess.on('error', (err) => console.error('[Electron] LLM error:', err));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'PyPSA Networks', extensions: ['nc', 'h5'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(() => {
  startPythonBackend();
  startLLMServer();
  
  const startDelay = isDev ? 4000 : 8000;
  setTimeout(createWindow, startDelay);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', cleanup);
app.on('quit', cleanup);
