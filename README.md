# Energy Network Explorer

A desktop application for energy network modeling, optimization, and visualization.

## Project Aim

Build a modern desktop application that enables users to:

- Load and explore energy network files
- Configure and run optimization models
- Visualize network infrastructure, results, and time-series data
- Interact with an AI assistant for guidance and analysis

## Architecture

### Frontend
- **React** with **shadcn/ui** for a modern, accessible component library
- Responsive panel-based layout with collapsible sections

### Backend
- **FastAPI** server running as subprocess for API and WebSocket communication
- **Python 3.10+** for energy modeling and optimization
- **SQLite3** databases (`.db` files) to store network data, queried by the frontend
- Support for loading external Python packages dynamically
- Long-running optimization processes with progress tracking

### Python Environment & Distribution
- **Pixi** for package management (10x faster than Conda, with lockfiles)
- **Pixi Pack** for bundling Python environment into distributable archives
- Self-extracting executables for end-user distribution (no Python/Conda install required)
- Cross-platform builds from single manifest (`pixi.toml`)

### Desktop Framework
> **To investigate:** Electron or Tauri for optimal Python subprocess + React integration

## Application Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP PANEL (Header)                                             │
│  ├── Main Menu                                                  │
│  └── Tabs Navigation                                            │
├───────────────┬─────────────────────────────────┬───────────────┤
│               │                                 │               │
│  LEFT PANEL   │       CENTER CONTENT            │  RIGHT PANEL  │
│  (collapsible)│                                 │  (collapsible)│
│               │  - Network Maps                 │               │
│  - Network    │  - Infrastructure View          │  - AI Chat    │
│    Explorer   │    (nodes, transmission lines)  │    (LangGraph │
│  - Instance   │  - Data Tables                  │     Agent)    │
│    Registry   │  - Dispatch Timeseries Plots    │               │
│               │  - Model Inspector              │  ↔ Tools ↔    │
│               │                                 │               │
├───────────────┴─────────────────────────────────┴───────────────┤
│  BOTTOM PANEL (collapsible)                                     │
│  - Logging Console                                              │
│  - Task Pooling / Queue                                         │
│  - Run Optimization Controls                                    │
└─────────────────────────────────────────────────────────────────┘
```

All side panels are **collapsible** to maximize workspace.

## Core Features

### Network Management
- Import network files (various formats)
- Browse network topology in explorer view
- Manage multiple network instances in registry

### Optimization Engine
- Pre-optimization validation checks
- Configure and launch optimization runs
- Background execution with progress monitoring
- Queue multiple optimization jobs

### Model Inspection
- View mathematical model components:
  - Variables
  - Constraints
  - Objective function
  - Parameters and inputs

### Visualization
- Interactive network maps
- Infrastructure diagrams (nodes, transmission lines)
- Data tables with filtering and sorting
- Energy dispatch time-series charts

### AI Assistant (LangGraph Agent)
- Integrated chat interface powered by **LangGraph**
- Agent with tools connected to each tab's backend:
  - **Network Tools**: Query network topology, nodes, transmission lines
  - **Optimization Tools**: Check status, start/stop runs, get results
  - **Model Tools**: Inspect variables, constraints, objective function
  - **Data Tools**: Query tables, fetch time-series data
  - **Visualization Tools**: Generate plots, export charts
- Context-aware responses based on current tab and selection
- Natural language queries for complex data analysis

## LangGraph Agent Architecture

The AI chat panel is powered by a LangGraph agent that can interact with all application backends through tools.

```
┌─────────────────────────────────────────────────────────────────┐
│                      LangGraph Agent                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Router    │→ │   Planner   │→ │  Executor   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Tool Registry                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ↓              ↓              ↓              ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Network    │ │Optimization │ │   Model     │ │    Data     │
│  Backend    │ │   Backend   │ │  Backend    │ │   Backend   │
│             │ │             │ │             │ │             │
│ - Topology  │ │ - Run jobs  │ │ - Variables │ │ - Tables    │
│ - Nodes     │ │ - Status    │ │ - Constr.   │ │ - Timeseries│
│ - Lines     │ │ - Results   │ │ - Objective │ │ - Queries   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
      ↓              ↓              ↓              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        SQLite3 Database                         │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Tools

| Tool Category | Tools | Description |
|---------------|-------|-------------|
| **Network** | `get_nodes`, `get_lines`, `get_topology`, `search_network` | Query network structure |
| **Optimization** | `run_optimization`, `get_opt_status`, `cancel_run`, `get_results` | Control optimization jobs |
| **Model** | `list_variables`, `list_constraints`, `get_objective`, `get_parameters` | Inspect mathematical model |
| **Data** | `query_table`, `get_timeseries`, `aggregate_data`, `export_csv` | Data retrieval and export |
| **Visualization** | `plot_dispatch`, `plot_network`, `compare_scenarios` | Generate visualizations |
| **Context** | `get_current_tab`, `get_selection`, `get_active_instance` | Application state awareness |

### Agent Capabilities

1. **Multi-step reasoning**: Break complex queries into tool calls
2. **Context awareness**: Know which tab/instance is active
3. **Streaming responses**: Real-time token streaming to chat UI
4. **Tool chaining**: Combine multiple tools for complex analysis
5. **Error recovery**: Handle failed tool calls gracefully

## Technical Challenges

1. **Python Integration**: Seamlessly load and execute Python packages from the desktop app
2. **Long-running Processes**: Run optimizations asynchronously without blocking the UI
3. **Data Persistence**: Use SQLite3 to store and query network data efficiently
4. **Real-time Updates**: Stream logs and progress from backend to frontend
5. **Cross-platform**: Support Windows, macOS, and Linux
6. **LangGraph Agent Integration**: Connect agent tools to backend services with proper state management
7. **Tool-Backend Binding**: Expose each tab's backend as callable tools for the agent
8. **LLM Streaming**: Stream agent responses to chat UI while tools execute

## Technology Stack (Proposed)

| Layer | Technology | Notes |
|-------|------------|-------|
| UI Framework | React 18+ | Modern React with hooks |
| UI Components | shadcn/ui | Tailwind-based, accessible |
| State Management | TBD | Zustand, Jotai, or Redux Toolkit |
| Desktop Runtime | TBD | Electron or Tauri |
| Backend Server | FastAPI | Async Python web framework |
| Backend Runtime | Python 3.10+ | Optimization and data processing |
| Package Manager | Pixi | Fast, cross-platform with lockfiles |
| Distribution | Pixi Pack | Bundle Python env for end users |
| AI Agent | LangGraph | Tool-using agent for chat interface |
| LLM Provider | TBD | OpenAI, Anthropic, or local models |
| Database | SQLite3 | Local network data storage |
| IPC | HTTP + WebSocket | REST API + streaming via FastAPI |

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Desktop Application                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │     Electron / Tauri Shell     │  │   Pixi-Packed Python Env       │ │
│  │  ┌──────────────────────────┐  │  │  ┌──────────────────────────┐  │ │
│  │  │      React Frontend      │  │  │  │     FastAPI Server       │  │ │
│  │  │      + shadcn/ui         │◄─┼──┼─►│     (subprocess)         │  │ │
│  │  │                          │  │  │  │                          │  │ │
│  │  │  - Network Maps          │  │  │  │  - REST endpoints        │  │ │
│  │  │  - Data Tables           │ WS │  │  - WebSocket streaming    │  │ │
│  │  │  - Charts                │HTTP│  │  - Background tasks       │  │ │
│  │  │  - AI Chat Panel         │  │  │  │                          │  │ │
│  │  └──────────────────────────┘  │  │  └───────────┬──────────────┘  │ │
│  └────────────────────────────────┘  │              │                  │ │
│                                      │  ┌───────────▼──────────────┐  │ │
│                                      │  │    LangGraph Agent       │  │ │
│                                      │  │    + Tool Registry       │  │ │
│                                      │  └───────────┬──────────────┘  │ │
│                                      │              │                  │ │
│                                      │  ┌───────────▼──────────────┐  │ │
│                                      │  │  Energy Modeling Packages │  │ │
│                                      │  │  (loaded dynamically)     │  │ │
│                                      │  └───────────┬──────────────┘  │ │
│                                      └──────────────┼──────────────────┘ │
└─────────────────────────────────────────────────────┼───────────────────┘
                                                      │
                                          ┌───────────▼──────────────┐
                                          │     SQLite3 Database     │
                                          │   (network_data.db)      │
                                          └──────────────────────────┘
```

### Communication Flow

1. **App Startup**: Electron/Tauri spawns FastAPI from Pixi environment
2. **API Calls**: React frontend calls REST endpoints for data operations
3. **Streaming**: WebSocket for real-time logs, optimization progress, and LLM responses
4. **Agent Tools**: LangGraph agent executes tools that query backends and database

## Distribution with Pixi Pack

```bash
# Development: manage environment with pixi
pixi install                    # Install all dependencies
pixi run dev                    # Start development servers
pixi run test                   # Run tests

# Production: create distributable package
pixi-pack --platform linux-64 --create-executable dist/explorer-linux.sh
pixi-pack --platform win-64 --create-executable dist/explorer-win.ps1
pixi-pack --platform osx-arm64 --create-executable dist/explorer-macos.sh
```

**End-user experience**: Download → Extract → Run (no Python installation needed)

## Framework Evaluation

### Desktop Runtime Candidates

| Framework | Pros | Cons |
|-----------|------|------|
| **Electron** | Mature, large ecosystem, easy subprocess management | Large bundle size (~150MB+), high memory |
| **Tauri** | Small bundle (~10MB), Rust backend, secure, sidecar pattern | Newer, smaller ecosystem |

### Key Evaluation Criteria
- Python subprocess lifecycle management
- WebSocket support for streaming
- Bundle size and performance
- Cross-platform support
- Developer experience

## Getting Started

> Coming soon - project setup instructions

## License

TBD
