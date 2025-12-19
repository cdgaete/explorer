# Tauri + FastAPI Toy App

A minimal Tauri app that spawns a FastAPI sidecar and communicates via HTTP/WebSocket.

## Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustc --version

# Node.js 18+
node --version

# Tauri CLI
cargo install tauri-cli

# Pixi (for Python environment)
curl -fsSL https://pixi.sh/install.sh | sh
pixi --version

# PyInstaller (to create Python binary)
pip install pyinstaller
```

## Project Structure

```
tauri-fastapi-toy/
├── package.json
├── src/
│   └── main.tsx         # React frontend
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   └── main.rs      # Tauri main (Rust)
│   └── binaries/        # Sidecar binaries go here
└── backend/
    ├── pixi.toml
    └── main.py          # FastAPI server
```

## Step 1: Create the Backend (same as Electron)

```bash
mkdir -p tauri-fastapi-toy/backend
cd tauri-fastapi-toy/backend
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
pyinstaller = ">=6.0"

[tasks]
serve = "uvicorn main:app --host 127.0.0.1 --port 8000"
build = "pyinstaller --onefile --name api-server main.py"
```

**backend/main.py:**
```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import uvicorn
import sys

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "FastAPI sidecar is running!"}

@app.get("/health")
def health_check():
    return {"healthy": True}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        for i in range(1, 11):
            await websocket.send_json({"progress": i * 10})
            await asyncio.sleep(0.5)
        await websocket.send_json({"status": "complete"})
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()

if __name__ == "__main__":
    # For running as sidecar binary
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

Build the sidecar binary:
```bash
cd backend
pixi install
pixi run build
# Creates: backend/dist/api-server (or api-server.exe on Windows)
```

## Step 2: Create the Tauri App

```bash
cd ..  # Back to tauri-fastapi-toy
npm create tauri-app@latest . -- --template react-ts
```

Or manually:
```bash
npm init -y
npm install react react-dom
npm install -D @tauri-apps/cli @vitejs/plugin-react vite typescript
```

## Step 3: Configure Tauri for Sidecar

**src-tauri/tauri.conf.json:**
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "tauri-fastapi-toy",
  "version": "0.1.0",
  "identifier": "com.example.tauri-fastapi-toy",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Tauri + FastAPI Toy",
        "width": 800,
        "height": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [
      "binaries/api-server"
    ],
    "icon": [
      "icons/icon.png"
    ]
  },
  "plugins": {
    "shell": {
      "sidecar": true,
      "scope": [
        {
          "name": "binaries/api-server",
          "sidecar": true
        }
      ]
    }
  }
}
```

Copy the sidecar binary:
```bash
mkdir -p src-tauri/binaries

# On macOS/Linux:
cp backend/dist/api-server src-tauri/binaries/api-server-$(rustc -vV | grep host | cut -d' ' -f2)

# On Windows:
# cp backend/dist/api-server.exe src-tauri/binaries/api-server-x86_64-pc-windows-msvc.exe
```

**Note:** Tauri requires platform-specific binary names:
- `api-server-x86_64-unknown-linux-gnu` (Linux)
- `api-server-x86_64-apple-darwin` (macOS Intel)
- `api-server-aarch64-apple-darwin` (macOS Apple Silicon)
- `api-server-x86_64-pc-windows-msvc.exe` (Windows)

## Step 4: Rust Main Process

**src-tauri/Cargo.toml** (add dependencies):
```toml
[dependencies]
tauri = { version = "2", features = ["shell-sidecar"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

**src-tauri/src/main.rs:**
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

struct AppState {
    sidecar: Mutex<Option<CommandChild>>,
}

#[tauri::command]
async fn start_backend(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let sidecar_command = app.shell().sidecar("api-server").map_err(|e| e.to_string())?;

    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    // Store the child process
    *state.sidecar.lock().unwrap() = Some(child);

    // Log sidecar output
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    println!("[Sidecar] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    eprintln!("[Sidecar Error] {}", String::from_utf8_lossy(&line));
                }
                _ => {}
            }
        }
    });

    Ok("Backend started".to_string())
}

#[tauri::command]
async fn stop_backend(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut sidecar = state.sidecar.lock().unwrap();
    if let Some(child) = sidecar.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok("Backend stopped".to_string())
}

#[tauri::command]
async fn check_backend() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://127.0.0.1:8000/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            sidecar: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![start_backend, stop_backend, check_backend])
        .setup(|app| {
            // Auto-start backend on app launch
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Give the app a moment to initialize
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                // Start the sidecar
                if let Err(e) = handle.emit("backend-starting", ()) {
                    eprintln!("Failed to emit event: {}", e);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Stop backend when window closes
                let state = window.state::<AppState>();
                let mut sidecar = state.sidecar.lock().unwrap();
                if let Some(child) = sidecar.take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add reqwest to Cargo.toml:
```toml
reqwest = { version = "0.11", features = ["json"] }
```

## Step 5: React Frontend

**src/App.tsx:**
```tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Starting...');
  const [progress, setProgress] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<string>('');

  useEffect(() => {
    // Start backend on mount
    startBackend();
  }, []);

  const startBackend = async () => {
    try {
      await invoke('start_backend');
      // Wait a moment for server to start
      setTimeout(checkBackend, 2000);
    } catch (error) {
      setBackendStatus(`Error: ${error}`);
    }
  };

  const checkBackend = async () => {
    try {
      const result = await invoke<{ message: string }>('check_backend');
      setBackendStatus(result.message || 'Connected');
    } catch (error) {
      setBackendStatus(`Error: ${error}`);
    }
  };

  const testWebSocket = () => {
    setProgress(0);
    setWsStatus('Connecting...');

    const ws = new WebSocket('ws://127.0.0.1:8000/ws');

    ws.onopen = () => setWsStatus('Connected! Receiving progress...');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress) {
        setProgress(data.progress);
        setWsStatus(`Progress: ${data.progress}%`);
      }
      if (data.status === 'complete') {
        setWsStatus('Complete!');
      }
    };

    ws.onerror = () => setWsStatus('WebSocket error');
  };

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', background: '#1a1a2e', color: '#eee', minHeight: '100vh' }}>
      <h1>Tauri + FastAPI Toy App</h1>

      <div style={{ padding: 20, background: '#16213e', borderRadius: 8, margin: '20px 0' }}>
        <p>Backend Status: <span style={{ color: backendStatus.includes('Error') ? '#ff4444' : '#00ff88' }}>{backendStatus}</span></p>
      </div>

      <button onClick={checkBackend} style={{ padding: '10px 20px', margin: 5 }}>Check Backend</button>
      <button onClick={testWebSocket} style={{ padding: '10px 20px', margin: 5 }}>Test WebSocket</button>

      <h3>WebSocket Progress:</h3>
      <div style={{ width: '100%', height: 30, background: '#0f3460', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#e94560', width: `${progress}%`, transition: 'width 0.3s' }} />
      </div>
      <p>{wsStatus}</p>
    </div>
  );
}

export default App;
```

## Step 6: Run the App

```bash
# Development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## What to Test

1. **Sidecar starts automatically** - Check terminal for "[Sidecar]" logs
2. **HTTP works** - Click "Check Backend" button
3. **WebSocket works** - Click "Test WebSocket" and watch progress bar
4. **Clean shutdown** - Close window, verify Python process stops

## Measuring Performance

Compare with Electron:
- App bundle size in `src-tauri/target/release/bundle/`
- Memory usage (should be ~50% less than Electron)
- Startup time

## Troubleshooting

### Sidecar not found
Ensure binary name matches your platform:
```bash
# Check your platform
rustc -vV | grep host

# Rename binary accordingly
mv api-server api-server-<your-platform-triple>
```

### Permission denied (macOS)
```bash
chmod +x src-tauri/binaries/api-server-*
xattr -cr src-tauri/binaries/
```

## Alternative: Use Pixi Directly (Without PyInstaller)

Instead of PyInstaller, you can bundle the entire Pixi environment:

1. Use `pixi-pack` to create a self-extracting archive
2. Include the archive as a resource
3. Extract on first run
4. Run with `./pixi run serve`

This approach is more complex but avoids PyInstaller's limitations.
