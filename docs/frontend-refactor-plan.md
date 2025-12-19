# Frontend Refactor: React + shadcn/ui

## Current State
- Vanilla HTML/CSS/JS (857 lines in single file)
- Custom styling
- No component reuse
- No state management

## Target Architecture

```
app/frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useNetwork.ts          # Network state & API
│   │   ├── useWebSocket.ts        # WebSocket connection
│   │   └── useOptimization.ts     # Optimization state
│   ├── components/
│   │   ├── ui/                    # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── resizable.tsx      # For panel resizing
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── PanelLayout.tsx    # Resizable panels
│   │   ├── network/
│   │   │   ├── NetworkList.tsx
│   │   │   ├── NetworkCard.tsx
│   │   │   └── NetworkMap.tsx
│   │   ├── data/
│   │   │   ├── DataTable.tsx      # TanStack Table
│   │   │   ├── BusesTable.tsx
│   │   │   ├── GeneratorsTable.tsx
│   │   │   └── ...
│   │   ├── optimization/
│   │   │   ├── OptimizationPanel.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── ResultsView.tsx
│   │   └── chat/                  # Future: AI chat
│   │       └── ChatPanel.tsx
│   └── api/
│       └── client.ts              # API functions
```

## Panel Layout Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (fixed)                                      [Settings] │
├─────────────┬───────────────────────────────────┬───────────────┤
│             │                                   │               │
│  Sidebar    │        Main Content               │   Right Panel │
│  (resize)   │                                   │   (collapse)  │
│             │  ┌─────────────────────────────┐  │               │
│  Networks   │  │ Tabs: Map|Data|Results|...  │  │   AI Chat     │
│  List       │  └─────────────────────────────┘  │   (Phase 4)   │
│             │                                   │               │
│  [collapse] │                                   │               │
│             │                                   │               │
├─────────────┴───────────────────────────────────┴───────────────┤
│  Bottom Panel (collapse): Logs | Optimization Progress          │
├─────────────────────────────────────────────────────────────────┤
│  Status Bar                                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| **Vite** | Fast dev server & bundler |
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Utility styling |
| **shadcn/ui** | Component library |
| **TanStack Table** | Data tables |
| **react-resizable-panels** | Resizable layout |
| **Zustand** | State management |
| **react-map-gl** + deck.gl | Maps (Phase 5) |

## Layout Efficiency Improvements

### 1. Resizable Panels
- Users can resize sidebar, right panel, bottom panel
- Panels can collapse to maximize workspace
- Layout persists in localStorage

### 2. Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+J` | Toggle bottom panel |
| `Ctrl+/` | Toggle AI chat |
| `Ctrl+O` | Open network file |
| `Ctrl+R` | Run optimization |

### 3. Better Tab Management
- Closable tabs for multiple networks
- Tab overflow menu for many tabs
- Drag to reorder

### 4. Context Menus
- Right-click on network → Optimize, Export, Remove
- Right-click on table → Copy, Filter, Export

## Migration Steps

### Step 1: Setup Project
```bash
cd app/frontend
npm create vite@latest . -- --template react-ts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init
```

### Step 2: Install Dependencies
```bash
# shadcn components
npx shadcn-ui@latest add button tabs card table resizable

# Additional
npm install zustand react-resizable-panels @tanstack/react-table
npm install leaflet react-leaflet  # Keep leaflet for now
```

### Step 3: Create Core Components
1. PanelLayout with resizable regions
2. Header with actions
3. Sidebar with network list
4. StatusBar with connection state

### Step 4: Migrate Features
1. Network loading
2. Data tables
3. Map view
4. Optimization

### Step 5: Add Enhancements
1. Keyboard shortcuts
2. Panel collapse/expand
3. Layout persistence

## Estimated Effort

| Task | Estimate |
|------|----------|
| Project setup | 30 min |
| Layout components | 2 hrs |
| Migrate network list | 1 hr |
| Migrate data tables | 2 hrs |
| Migrate map | 1 hr |
| State management | 1 hr |
| Polish & testing | 2 hrs |
| **Total** | ~10 hrs |

## Questions

1. **Keep Leaflet or switch to MapLibre now?**
   - Leaflet works, MapLibre is better for large networks
   - Suggest: Keep Leaflet for now, upgrade in Phase 5

2. **Bottom panel content?**
   - Logs only? Or also include optimization controls?
   - Suggest: Logs + mini optimization status

3. **Right panel for AI chat?**
   - Reserve space now with placeholder?
   - Suggest: Add collapsible right panel, populate in Phase 4

Ready to start the refactor?
