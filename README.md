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
- **PyPSA** (Python for Power System Analysis) for energy network modeling
- **Linopy** for building and solving linear optimization problems
- **SQLite3** databases (`.db` files) to store network data, queried by the frontend
- Long-running optimization processes with progress tracking

### Optimization Solvers
- **HiGHS** (default) - Open-source, high-performance LP/MIP solver
- **Commercial solvers** (optional) - Gurobi, CPLEX, etc. with license file support
- Solver selection via configuration menu

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

### Dual Interface Design

Every feature is accessible through **two equivalent interfaces**:

| Interface | Best For | Examples |
|-----------|----------|----------|
| **AI Chat** | Complex queries, exploration, multi-step workflows | "Show me nodes with capacity > 100MW", "Run optimization and plot results" |
| **GUI** | Quick actions, visual navigation, precise control | Click buttons, use menus, drag sliders |

**Key Principle**: The AI chat can perform any action available in the GUI, and vice versa.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Same Backend Services                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Endpoints                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│         ▲                                        ▲               │
│         │                                        │               │
│    ┌────┴────┐                             ┌────┴────┐          │
│    │   GUI   │                             │   AI    │          │
│    │ Buttons │                             │  Chat   │          │
│    │  Menus  │                             │ (Tools) │          │
│    └─────────┘                             └─────────┘          │
│    User clicks                           User types             │
│    "Run Optimization"                    "Run the optimization" │
└─────────────────────────────────────────────────────────────────┘
```

### Example: Same Action, Two Ways

| Action | GUI Way | AI Chat Way |
|--------|---------|-------------|
| Run optimization | Click "Run" button in bottom panel | "Run the optimization" |
| View results | Click Results tab, select table | "Show me the optimization results" |
| Filter nodes | Use filter dropdown, select criteria | "Show nodes in region North with capacity > 50MW" |
| Change plot parameter | Adjust slider, click refresh | "Change the time range to January and refresh the plot" |
| Export data | File menu → Export → CSV | "Export the dispatch data as CSV" |
| Check status | View status bar / progress indicator | "What's the optimization status?" |

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
- **Query capabilities** (read data):
  - Explore network topology, nodes, transmission lines
  - Inspect model variables, constraints, objective function
  - Fetch results, time-series data, configuration parameters
- **Action capabilities** (perform operations):
  - Run/cancel optimization jobs
  - Modify plot parameters and refresh visualizations
  - Export data in various formats
  - Navigate to specific tabs or views
- **UI synchronization**: When AI performs actions, the GUI updates automatically
- Context-aware responses based on current tab and selection
- Natural language for complex multi-step workflows

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

#### Query Tools (Read Data)

| Tool Category | Tools | Description |
|---------------|-------|-------------|
| **Network** | `get_nodes`, `get_lines`, `get_topology`, `search_network` | Query network structure |
| **Model** | `list_variables`, `list_constraints`, `get_objective`, `get_parameters` | Inspect mathematical model |
| **Data** | `query_table`, `get_timeseries`, `aggregate_data` | Data retrieval and analysis |
| **Context** | `get_current_tab`, `get_selection`, `get_active_instance` | Application state awareness |

#### Action Tools (Perform Operations)

| Tool Category | Tools | Description |
|---------------|-------|-------------|
| **Optimization** | `run_optimization`, `cancel_run`, `get_opt_status`, `get_results` | Control optimization jobs |
| **Visualization** | `update_plot_params`, `refresh_plot`, `set_time_range`, `compare_scenarios` | Modify and refresh visualizations |
| **Export** | `export_csv`, `export_plot`, `export_report` | Export data and visualizations |
| **Navigation** | `open_tab`, `select_node`, `focus_panel`, `set_filter` | Control UI navigation and state |

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

## Configuration

The application provides configuration menus for both optimization solvers and AI providers.

### Solver Configuration

| Solver | Type | License | Notes |
|--------|------|---------|-------|
| **HiGHS** | LP/MIP | Open Source (MIT) | Default, bundled with app |
| **Gurobi** | LP/MIP/QP | Commercial | Requires license file |
| **CPLEX** | LP/MIP/QP | Commercial | Requires license file |
| **GLPK** | LP/MIP | Open Source (GPL) | Alternative open-source |
| **SCIP** | MIP | Open Source (Apache) | Academic/research use |

**License file management**: Users can configure paths to solver license files via Settings menu.

### LLM Provider Configuration

| Provider | Type | Notes |
|----------|------|-------|
| **OpenAI** | Cloud API | Standard OpenAI SDK, requires API key |
| **OpenRouter** | Cloud API | Access to multiple models (Claude, GPT, Llama, etc.) |
| **Ollama** | Local | Run models locally, no API key needed |
| **Azure OpenAI** | Cloud API | Enterprise deployments |
| **Custom** | OpenAI-compatible | Any OpenAI SDK-compatible endpoint |

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings Menu                                                   │
│  ├── Optimization                                                │
│  │   ├── Solver: [HiGHS ▼]                                      │
│  │   ├── License Path: [Browse...]                              │
│  │   └── Solver Options: threads, gap tolerance, time limit     │
│  │                                                               │
│  └── AI Assistant                                                │
│      ├── Provider: [OpenRouter ▼]                               │
│      ├── API Key: [••••••••]                                    │
│      ├── Model: [claude-3-sonnet ▼]                             │
│      └── Ollama URL: http://localhost:11434 (if local)          │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack (Proposed)

| Layer | Technology | Notes |
|-------|------------|-------|
| UI Framework | React 18+ | Modern React with hooks |
| UI Components | shadcn/ui | Tailwind-based, accessible |
| State Management | TBD | Zustand, Jotai, or Redux Toolkit |
| Desktop Runtime | TBD | Electron or Tauri |
| Backend Server | FastAPI | Async Python web framework |
| Energy Modeling | PyPSA | Power system analysis and components |
| Optimization | Linopy | Linear optimization problem modeling |
| Default Solver | HiGHS | Open-source LP/MIP solver |
| Package Manager | Pixi | Fast, cross-platform with lockfiles |
| Distribution | Pixi Pack | Bundle Python env for end users |
| AI Agent | LangGraph | Tool-using agent for chat interface |
| LLM Provider | OpenRouter / Ollama / OpenAI | Configurable via settings |
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
│                                      │  │  PyPSA + Linopy          │  │ │
│                                      │  │  └─► HiGHS / Gurobi      │  │ │
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
