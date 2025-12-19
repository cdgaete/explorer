# Electron + FastAPI Toy App

A minimal Electron app that spawns a FastAPI subprocess and communicates via HTTP/WebSocket.

## Prerequisites

```bash
# Node.js 18+
node --version

# Pixi (for Python environment)
curl -fsSL https://pixi.sh/install.sh | sh
pixi --version
```

## Project Structure

```
electron-fastapi-toy/
├── package.json
├── main.js              # Electron main process
├── preload.js           # Preload script
├── index.html           # Simple UI
├── renderer.js          # Frontend logic
└── backend/
    ├── pixi.toml        # Pixi config
    └── main.py          # FastAPI server
```

## Step 1: Create the Backend

```bash
mkdir -p electron-fastapi-toy/backend
cd electron-fastapi-toy/backend
```

**backend/pixi.toml:**
```toml
[project]
name = "backend"
version = "0.1.0"
channels = ["conda-forge"]
platforms = ["osx-arm64", "osx-64", "linux-64", "win-64"]

[dependencies]
python = ">=3.10"
fastapi = ">=0.100"
uvicorn = ">=0.23"
websockets = ">=11.0"

[tasks]
serve = "uvicorn main:app --host 127.0.0.1 --port 8000"
```

**backend/main.py:**
```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI()

# Allow Electron frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "FastAPI is running!"}

@app.get("/health")
def health_check():
    return {"healthy": True}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        # Send periodic updates (simulating progress)
        for i in range(1, 11):
            await websocket.send_json({"progress": i * 10})
            await asyncio.sleep(0.5)
        await websocket.send_json({"status": "complete"})
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
```

Initialize Pixi:
```bash
cd backend
pixi install
```

## Step 2: Create the Electron App

```bash
cd ..  # Back to electron-fastapi-toy
npm init -y
npm install electron --save-dev
```

**package.json** (update scripts):
```json
{
  "name": "electron-fastapi-toy",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^28.0.0"
  }
}
```

**main.js:**
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
  const backendPath = path.join(__dirname, 'backend');

  console.log('Starting FastAPI backend...');

  // Use pixi run to start the server
  pythonProcess = spawn('pixi', ['run', 'serve'], {
    cwd: backendPath,
    shell: true,
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[FastAPI Error] ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`FastAPI process exited with code ${code}`);
  });
}

function stopPythonBackend() {
  if (pythonProcess) {
    console.log('Stopping FastAPI backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// Wait for FastAPI to be ready
async function waitForBackend(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://127.0.0.1:8000/health');
      if (response.ok) {
        console.log('FastAPI backend is ready!');
        return true;
      }
    } catch (e) {
      // Not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('FastAPI backend failed to start');
}

app.whenReady().then(async () => {
  startPythonBackend();

  try {
    await waitForBackend();
    createWindow();
  } catch (error) {
    console.error('Failed to start backend:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonBackend();
});

// IPC handler for backend status
ipcMain.handle('get-backend-status', async () => {
  try {
    const response = await fetch('http://127.0.0.1:8000/');
    return await response.json();
  } catch (e) {
    return { status: 'error', message: e.message };
  }
});
```

**preload.js:**
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
});
```

**index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Electron + FastAPI Toy</title>
  <style>
    body { font-family: system-ui; padding: 20px; background: #1a1a2e; color: #eee; }
    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
    #status { padding: 20px; background: #16213e; border-radius: 8px; margin: 20px 0; }
    #progress { width: 100%; height: 30px; background: #0f3460; border-radius: 4px; overflow: hidden; }
    #progress-bar { height: 100%; background: #e94560; width: 0%; transition: width 0.3s; }
    .success { color: #00ff88; }
    .error { color: #ff4444; }
  </style>
</head>
<body>
  <h1>Electron + FastAPI Toy App</h1>

  <div id="status">
    <p>Backend Status: <span id="backend-status">Checking...</span></p>
  </div>

  <button id="check-btn">Check Backend</button>
  <button id="ws-btn">Test WebSocket</button>

  <h3>WebSocket Progress:</h3>
  <div id="progress">
    <div id="progress-bar"></div>
  </div>
  <p id="ws-status"></p>

  <script src="renderer.js"></script>
</body>
</html>
```

**renderer.js:**
```javascript
const statusSpan = document.getElementById('backend-status');
const progressBar = document.getElementById('progress-bar');
const wsStatus = document.getElementById('ws-status');

// Check backend status
async function checkBackend() {
  try {
    const result = await window.electronAPI.getBackendStatus();
    statusSpan.textContent = result.message || 'Connected';
    statusSpan.className = 'success';
  } catch (e) {
    statusSpan.textContent = 'Error: ' + e.message;
    statusSpan.className = 'error';
  }
}

// Test WebSocket
function testWebSocket() {
  progressBar.style.width = '0%';
  wsStatus.textContent = 'Connecting...';

  const ws = new WebSocket('ws://127.0.0.1:8000/ws');

  ws.onopen = () => {
    wsStatus.textContent = 'Connected! Receiving progress...';
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.progress) {
      progressBar.style.width = data.progress + '%';
      wsStatus.textContent = `Progress: ${data.progress}%`;
    }
    if (data.status === 'complete') {
      wsStatus.textContent = 'Complete!';
      wsStatus.className = 'success';
    }
  };

  ws.onerror = (error) => {
    wsStatus.textContent = 'WebSocket error';
    wsStatus.className = 'error';
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
  };
}

// Event listeners
document.getElementById('check-btn').addEventListener('click', checkBackend);
document.getElementById('ws-btn').addEventListener('click', testWebSocket);

// Initial check
setTimeout(checkBackend, 1000);
```

## Step 3: Run the App

```bash
# Make sure you're in electron-fastapi-toy directory
npm start
```

## What to Test

1. **Backend starts automatically** - Check console for "FastAPI backend is ready!"
2. **HTTP works** - Click "Check Backend" button
3. **WebSocket works** - Click "Test WebSocket" and watch progress bar
4. **Clean shutdown** - Close window, verify Python process stops

## Measuring Performance

Open Task Manager (Windows) / Activity Monitor (macOS) and note:
- Memory usage of Electron app
- Memory usage of Python process
- Total disk space of node_modules + backend

## Next Steps

If this works well, you can extend with:
- Production build (`electron-builder`)
- Bundling Pixi environment with the app
- Auto-updater
