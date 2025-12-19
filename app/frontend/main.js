const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let pythonProcess;

const BACKEND_URL = 'http://127.0.0.1:8000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();
}

function startPythonBackend() {
  const backendPath = path.join(__dirname, '..', 'backend');
  const pixiPath = process.env.HOME + '/.pixi/bin/pixi';
  
  console.log('[Electron] Starting FastAPI backend...');
  pythonProcess = spawn(pixiPath, ['run', 'serve'], {
    cwd: backendPath,
    shell: true,
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data}`);
  });
  pythonProcess.stderr.on('data', (data) => {
    console.log(`[FastAPI] ${data}`);
  });
  pythonProcess.on('close', (code) => {
    console.log(`[FastAPI] Process exited with code ${code}`);
  });
}

function stopPythonBackend() {
  if (pythonProcess) {
    console.log('[Electron] Stopping FastAPI backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

async function waitForBackend(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        console.log('[Electron] Backend is ready!');
        return true;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Backend failed to start');
}

app.whenReady().then(async () => {
  startPythonBackend();
  try {
    await waitForBackend();
    createWindow();
  } catch (error) {
    console.error('[Electron] Failed to start backend:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopPythonBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopPythonBackend());

// IPC Handlers
ipcMain.handle('api-request', async (event, { method, endpoint, body }) => {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
  return response.json();
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Network Files', extensions: ['nc', 'h5'] }],
  });
  return result;
});
