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
- **Python** for energy modeling and optimization
- **SQLite3** databases (`.db` files) to store network data, queried by the frontend
- Support for loading external Python packages dynamically
- Long-running optimization processes with progress tracking

### Desktop Framework
> **To investigate:** Electron, Tauri, or other modern alternatives for optimal Python + React integration

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
│    Explorer   │    (nodes, transmission lines)  │               │
│  - Instance   │  - Data Tables                  │               │
│    Registry   │  - Dispatch Timeseries Plots    │               │
│               │  - Model Inspector              │               │
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

### AI Assistant
- Integrated chat interface
- Context-aware help and guidance
- Analysis support

## Technical Challenges

1. **Python Integration**: Seamlessly load and execute Python packages from the desktop app
2. **Long-running Processes**: Run optimizations asynchronously without blocking the UI
3. **Data Persistence**: Use SQLite3 to store and query network data efficiently
4. **Real-time Updates**: Stream logs and progress from backend to frontend
5. **Cross-platform**: Support Windows, macOS, and Linux

## Technology Stack (Proposed)

| Layer | Technology | Notes |
|-------|------------|-------|
| UI Framework | React 18+ | Modern React with hooks |
| UI Components | shadcn/ui | Tailwind-based, accessible |
| State Management | TBD | Zustand, Jotai, or Redux Toolkit |
| Desktop Runtime | TBD | Electron, Tauri, or Neutralino |
| Backend | Python 3.10+ | Optimization and data processing |
| Database | SQLite3 | Local network data storage |
| IPC | TBD | WebSocket, HTTP, or native bindings |

## Framework Evaluation

### Candidates to Investigate

| Framework | Pros | Cons |
|-----------|------|------|
| **Electron** | Mature, large ecosystem, easy Python subprocess | Large bundle size, high memory |
| **Tauri** | Small bundle, Rust backend, secure | Python requires subprocess/sidecar |
| **Neutralino** | Lightweight, simple | Less mature ecosystem |
| **PyWebView** | Native Python integration | Less React-friendly |
| **Wails** | Go backend, small size | No native Python support |

### Key Evaluation Criteria
- Python package loading and execution
- Long-running process management
- SQLite3 integration
- Bundle size and performance
- Cross-platform support
- Developer experience

## Getting Started

> Coming soon - project setup instructions

## License

TBD
