# Energy Network Explorer - Session Continuation

Use this prompt to continue development in a new chat session.

---

## Project Summary

Building a desktop application for energy network modeling and optimization using:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: FastAPI + PyPSA + Linopy + HiGHS solver
- **Desktop**: Electron shell

Repository: `/home/user/explorer`

## Completed Work

### Phase 1: Core Shell ✅
- Electron app launches and manages FastAPI subprocess
- React frontend with resizable panel layout
- WebSocket connection for real-time updates
- Pixi environment for Python dependencies

### Phase 2: Load & Display ✅ (90%)
- Load example PyPSA network from backend
- Network list in sidebar with status indicators
- Tabbed main content: Map, Metadata, Statistics, Data Tables, Results
- Leaflet map with buses, lines, links visualization
- TanStack Table for component data display
- **Missing**: File picker for .nc/.h5 files

### Phase 3: Run Optimization 🟡 (70%)
- Run Optimization button in bottom panel
- Progress bar with WebSocket updates
- Results displayed in Results tab
- **Solver log streaming** - Real-time HiGHS output in Logs tab:
  - Captures Python logging (pypsa, linopy)
  - Captures C-level stdout via file descriptor redirection
- **Missing**: Huey task queue, cancel optimization

### UI/UX Improvements
- Sidebar collapse/expand with centered notch toggle
- Robust connection handling:
  - All API calls guarded by `wsConnected` check
  - Validates selected network exists before rendering
  - Clears stale persisted state when network not found
- Empty state messages for all tabs

## Current Status by Phase

| Phase | Status | Notes |
|-------|--------|-------|
| **1: Core Shell** | ✅ Complete | Electron + FastAPI + WebSocket |
| **2: Load & Display** | 🟡 90% | Missing: file picker for .nc/.h5 files |
| **3: Optimization** | 🟡 70% | Done: Run, Progress, Results, Logs. Missing: Huey queue, cancel |
| **4: AI Chat** | ⬜ Not started | LangGraph agent + tools |
| **5: Visualization** | 🟡 30% | Done: panels, tabs. Missing: deck.gl, charts |
| **6: Polish** | ⬜ Not started | Settings, export, cross-platform |

## Key Files

### Frontend (`app/frontend-react/src/`)
- `components/layout/` - PanelLayout, Sidebar, BottomPanel, MainContent
- `components/network/` - MapView, MetadataView, StatisticsView
- `components/data/` - DataTableView
- `components/optimization/` - ResultsView
- `stores/networkStore.ts` - Zustand state (networks, logs, optimization)
- `hooks/useWebSocket.ts` - WebSocket with log streaming

### Backend (`app/backend/`)
- `app.py` - FastAPI server with:
  - Network CRUD endpoints
  - Optimization with stdout/logging capture
  - WebSocket broadcast for logs and progress

### Documentation
- `README.md` - Full project architecture and roadmap
- `docs/frontend-refactor-plan.md` - React migration plan

## Commands

```bash
# Start backend
cd app/backend && pixi run python app.py

# Start frontend
cd app/frontend-react && npm run dev

# Start Electron (if needed)
cd app/electron && npm start
```

## Suggested Next Steps

1. **File Picker** - Implement network file upload (.nc, .h5)
2. **Huey Task Queue** - Background optimization with proper job management
3. **Cancel Optimization** - Stop running jobs
4. **AI Chat Panel** - LangGraph agent with query/action tools
5. **deck.gl Maps** - GPU-powered visualization for large networks
6. **Charts** - shadcn/ui charts for dispatch and capacity

## Recent Commits

```
0935eb9 Fix solver log capture - use file descriptor level redirection
5bc8174 Capture logging output from pypsa/linopy solvers
c0604a7 Add solver stdout streaming to Logs tab
6622184 Validate selected network exists before rendering
2820b4c Guard all API calls with wsConnected check
```
