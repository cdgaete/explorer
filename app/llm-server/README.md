# LLM Server for Explorer

Local LLM inference using llama.cpp with Salesforce xLAM for tool calling.

## Quick Start

```bash
# 1. Download llama.cpp binary (one-time, ~20MB)
./scripts/download_llamacpp.sh

# 2. Start server (downloads model on first run, ~1.9GB)
./scripts/start.sh
```

Server runs on `http://localhost:8080` with OpenAI-compatible API.

## Why xLAM?

Salesforce xLAM-2-3b is specifically trained for function/tool calling:
- State-of-the-art on BFCL benchmark
- Small: 3B params, ~1.9GB quantized (Q4_K_M)
- Perfect for triggering actions in our app

## Model Cache

Model is downloaded automatically on first run and cached at:
`~/.cache/llama.cpp/`

## For Electron Packaging

The `bin/` folder contains platform-specific llama.cpp binaries.
Model downloads automatically on first run via `-hf` flag.
