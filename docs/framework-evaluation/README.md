# Desktop Framework Evaluation: Electron vs Tauri

## Conclusion: Electron ✅

After building toy apps with both frameworks, **Electron is the clear winner** for this project.

## Evaluation Results

| Criteria | Electron | Tauri |
|----------|----------|-------|
| Setup complexity | ✅ Simple | ❌ Complex |
| FastAPI subprocess starts reliably | ✅ Yes | ⚠️ Requires PyInstaller |
| WebSocket works | ✅ Yes | ✅ Yes |
| App shutdown kills subprocess | ✅ Yes | ✅ Yes |
| Hot reload during development | ✅ Yes | ✅ Yes |
| Build size (production) | ⚠️ ~120MB | ✅ ~40MB |
| Memory usage | ⚠️ ~100MB | ✅ ~40MB |
| Startup time | ⚠️ 1-2s | ✅ <500ms |
| **Time to working prototype** | ✅ **30 min** | ❌ **3+ hours** |

## Key Findings

### Electron Advantages

1. **Simple Python integration**: Just `child_process.spawn('pixi', ['run', 'serve'])` - works immediately
2. **No binary bundling needed**: Can use Pixi directly, no PyInstaller step
3. **Mature ecosystem**: Abundant examples and documentation
4. **Predictable debugging**: Chrome DevTools work exactly as expected
5. **Fast iteration**: Changes work immediately without complex configuration

### Tauri Challenges Encountered

1. **Sidecar requires binary**: Must use PyInstaller to create standalone executable
2. **Complex permissions**: Capability system requires specific JSON configuration
3. **Config syntax changes**: Tauri v2 changed config format, many outdated examples online
4. **Tailwind v4 conflicts**: PostCSS plugin moved to separate package
5. **Silent failures**: App would launch but do nothing without clear error messages

### Why Bundle Size Doesn't Matter (For This Project)

- Target users are energy analysts on workstations, not mobile devices
- 120MB vs 40MB is negligible for a desktop app with Python backend
- PyPSA + solver dependencies already add ~500MB+ to the Python environment
- Developer productivity is worth more than 80MB savings

## Final Architecture

```
Electron (Node.js)
    │
    ├── child_process.spawn()
    │       │
    │       └── pixi run serve
    │
    └── React Frontend ←→ FastAPI (localhost:8000)
```

## Recommendation

**Use Electron** for the Energy Network Explorer. The simpler integration with Pixi and faster development velocity outweigh Tauri's theoretical performance benefits.

Proceed to Phase 2 with the Electron architecture.
