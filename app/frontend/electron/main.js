const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;
let llmProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Get resource paths (different in dev vs packaged)
function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', '..', relativePath);
  } else {
    return path.join(process.resourcesPath, relativePath);
  }
}

function startPythonBackend() {
  const backendPath = getResourcePath('backend');
  
  // In packaged app, we need to use bundled Python or system Python
  // For now, assume pixi is installed on the system
  const pixiPath = process.env.HOME + '/.pixi/bin/pixi';
  
  console.log('[Electron] Starting FastAPI backend from:', backendPath);
  
  pythonProcess = spawn(pixiPath, ['run', 'serve'], {
    cwd: backendPath,
    shell: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.log(`[FastAPI] ${data}`);
  });

  pythonProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend:', err);
  });
}

function startLLMServer() {
  const llmPath = getResourcePath('llm-server');
  const startScript = path.join(llmPath, 'scripts', 'start.sh');
  
  console.log('[Electron] Starting LLM server from:', llmPath);
  
  llmProcess = spawn('bash', [startScript], {
    cwd: llmPath,
    shell: true,
    env: { ...process.env }
  });

  llmProcess.stdout.on('data', (data) => {
    console.log(`[LLM] ${data}`);
  });

  llmProcess.stderr.on('data', (data) => {
    console.log(`[LLM] ${data}`);
  });

  llmProcess.on('error', (err) => {
    console.error('[Electron] Failed to start LLM server:', err);
  });
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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
  
  // Wait for servers to start
  setTimeout(createWindow, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
  }
  if (llmProcess) {
    llmProcess.kill('SIGTERM');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
  }
  if (llmProcess) {
    llmProcess.kill('SIGTERM');
  }
});
