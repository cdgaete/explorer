#!/bin/bash
# Start xLAM server with OpenAI-compatible API
# Downloads model automatically from HuggingFace on first run

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$SCRIPT_DIR/../bin"
PORT=8080

LLAMA_SERVER="$BIN_DIR/llama-server"

# Check llama-server exists
if [ ! -f "$LLAMA_SERVER" ]; then
    echo "Error: llama-server not found"
    echo "Run: ./scripts/download_llamacpp.sh"
    exit 1
fi

echo "=== Starting xLAM Server ==="
echo "Model: Salesforce/xLAM-2-3b-fc-r-gguf (Q4_K_M)"
echo "Port: $PORT"
echo "API: http://localhost:$PORT/v1"
echo ""
echo "First run will download the model (~1.9GB)..."
echo ""

# Start server - downloads model automatically via -hf flag
# Uses Q4_K_M quantization (best balance)
exec "$LLAMA_SERVER" \
    -hf Salesforce/xLAM-2-3b-fc-r-gguf:Q4_K_M \
    -c 4096 \
    --port $PORT \
    --host 127.0.0.1
