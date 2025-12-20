# GridAssistant

A desktop application for analyzing PyPSA energy networks with an AI assistant.

## Features

- **Load & Visualize** PyPSA networks (.nc, .h5 files)
- **Interactive Map** with buses, lines, and links
- **Run Optimizations** with HiGHS solver
- **AI Assistant** for natural language interaction
  - "Load the example network"
  - "What generators are in this network?"
  - "Run optimization" (with human approval)
- **Real-time Logs** during optimization

## Quick Start (Development)

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Pixi](https://pixi.sh/) for Python environment

```bash
# Install pixi
curl -fsSL https://pixi.sh/install.sh | bash
```

### Run in Development Mode

```bash
# Terminal 1: Start LLM server (first run downloads ~1.9GB model)
cd app/llm-server
./scripts/download_llamacpp.sh  # One-time setup
./scripts/start.sh

# Terminal 2: Start backend
cd app/backend
pixi install
pixi run serve

# Terminal 3: Start frontend
cd app/frontend
npm install
npm run dev
```

Open http://localhost:5173

### Run as Desktop App (Development)

```bash
cd app/frontend
npm start
```

## Building Packages

### Linux (AppImage)

```bash
cd app/frontend
npm install
npm run dist:linux
```

Output: `release/GridAssistant-0.1.0.AppImage`

### Windows (NSIS Installer)

Build on Windows:

```powershell
# 1. Clone repository
git clone https://github.com/cdgaete/gridassistant.git
cd gridassistant

# 2. Download llama.cpp Windows binaries
cd app\llm-server\scripts
.\download_llamacpp.bat

# 3. Build installer
cd ..\..\frontend
npm install
npm run dist:win
```

Output: `release\GridAssistant Setup 0.1.0.exe`

**User requirements:**
- Install [Pixi](https://pixi.sh/): `powershell -c "iwr -useb https://pixi.sh/install.ps1 | iex"`
- First launch downloads LLM model (~1.9GB) and Python dependencies

### macOS (DMG)

Build on macOS:

```bash
# 1. Clone repository
git clone https://github.com/cdgaete/gridassistant.git
cd gridassistant

# 2. Download llama.cpp macOS binaries
cd app/llm-server/scripts
./download_llamacpp.sh

# 3. Build DMG
cd ../../frontend
npm install
npm run dist:mac
```

Output: `release/GridAssistant-0.1.0.dmg`

**User requirements:**
- Install [Pixi](https://pixi.sh/): `curl -fsSL https://pixi.sh/install.sh | bash`
- First launch downloads LLM model (~1.9GB) and Python dependencies

## Architecture

```
app/
├── frontend/           # Electron + React + Vite
│   ├── src/            # React components
│   ├── electron/       # Electron main process
│   └── release/        # Built packages
├── backend/            # FastAPI + PyPSA
│   ├── app.py          # Main API
│   └── ai_chat.py      # AI chat service
└── llm-server/         # Local LLM
    ├── bin/            # llama.cpp binaries
    └── scripts/        # Start scripts
```

## AI Assistant

The AI assistant uses:
- **Salesforce xLAM-2-3b** - Small model optimized for tool calling
- **llama.cpp** - CPU inference, no GPU required
- **Human-in-the-loop** - Dangerous operations require approval

### Available Commands

| Command | Description |
|---------|-------------|
| Load example network | Load PyPSA demo network |
| List networks | Show loaded networks |
| Network summary | Get bus/generator/line counts |
| Generator info | Generators by carrier type |
| Run optimization | Optimize (requires approval) |
| Optimization status | Check if running |
| Get results | Show optimization results |

## Requirements for Packaged App

The packaged application requires:

1. **Pixi** installed on the system
2. **Internet connection** on first run (to download LLM model ~1.9GB)

## License

MIT
