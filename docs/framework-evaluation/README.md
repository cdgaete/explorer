# Desktop Framework Evaluation: Electron vs Tauri

Comparing Electron and Tauri for our Python/FastAPI sidecar use case.

## Quick Comparison

| Aspect | Electron | Tauri |
|--------|----------|-------|
| **App Size** | 80-120 MB | 2-10 MB |
| **Memory Usage** | ~100+ MB | ~30-40 MB |
| **Startup Time** | 1-2 seconds | <500 ms |
| **Backend Language** | Node.js | Rust |
| **Python Subprocess** | `child_process` (easy) | Sidecar (built-in) |
| **WebView** | Bundled Chromium | System WebView |
| **Learning Curve** | Lower (JavaScript) | Higher (Rust) |
| **Ecosystem** | Very mature | Growing rapidly |

## For Our Use Case (FastAPI + Pixi)

### Electron Approach
```
Electron (Node.js)
    │
    ├── child_process.spawn()
    │       │
    │       └── pixi run python -m uvicorn main:app
    │
    └── React Frontend ←→ FastAPI (localhost:8000)
```

**Pros:**
- Simpler subprocess management with Node.js
- Can directly use `pixi run` command
- More examples/documentation for Python integration
- Easier debugging (Chrome DevTools)

**Cons:**
- Large bundle size (includes Chromium)
- Higher memory usage
- Need to bundle Pixi environment separately

### Tauri Approach
```
Tauri (Rust)
    │
    ├── Sidecar (built-in lifecycle management)
    │       │
    │       └── PyInstaller binary OR pixi-packed env
    │
    └── React Frontend ←→ FastAPI (localhost:8000)
```

**Pros:**
- Built-in sidecar management (start/stop/restart)
- Tiny bundle size
- Lower memory footprint
- Better for distribution

**Cons:**
- Requires PyInstaller or similar to bundle Python
- Rust knowledge helpful for customization
- System WebView can vary across platforms

## Existing Templates

### Tauri + FastAPI
- [vue-tauri-fastapi-sidecar-template](https://github.com/AlanSynn/vue-tauri-fastapi-sidecar-template) - Tauri v2 + Vue + FastAPI
- [example-tauri-v2-python-server-sidecar](https://github.com/dieharders/example-tauri-v2-python-server-sidecar) - Tauri v2 + Next.js + FastAPI

### Electron + Python
- Many examples using `python-shell` or direct `child_process`

## Recommendation

For our project, I suggest testing **both** with simple toy apps:

1. **[Electron Toy App](./electron-toy-app.md)** - Quick to set up, validate subprocess pattern
2. **[Tauri Toy App](./tauri-toy-app.md)** - Test sidecar pattern with FastAPI

Then decide based on:
- Which feels more natural for development
- Bundle size requirements
- Performance on target platforms

## Test Criteria

After building both toy apps, evaluate:

| Criteria | Electron | Tauri |
|----------|----------|-------|
| Setup complexity | | |
| FastAPI subprocess starts reliably | | |
| WebSocket works | | |
| App shutdown kills subprocess | | |
| Hot reload during development | | |
| Build size (production) | | |
| Memory usage | | |
| Startup time | | |

## Sources

- [Electron vs Tauri - DoltHub](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [Tauri vs Electron Performance Comparison](https://www.gethopp.app/blog/tauri-vs-electron)
- [Tauri Sidecar Documentation](https://v2.tauri.app/develop/sidecar/)
- [Tauri vs Electron 2025 - Codeology](https://codeology.co.nz/articles/tauri-vs-electron-2025-desktop-development.html)
