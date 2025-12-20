#!/bin/bash
# Download llama.cpp pre-built CPU binary
# Works on any computer, no GPU required

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$SCRIPT_DIR/../bin"

mkdir -p "$BIN_DIR"
cd "$BIN_DIR"

echo "=== Downloading llama.cpp (CPU version) ==="

# Get latest version
VERSION=$(curl -sL "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)
echo "Latest version: $VERSION"

# Detect platform
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" = "Linux" ] && [ "$ARCH" = "x86_64" ]; then
    URL="https://github.com/ggml-org/llama.cpp/releases/download/$VERSION/llama-$VERSION-bin-ubuntu-x64.tar.gz"
    ARCHIVE="llama.tar.gz"
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    URL="https://github.com/ggml-org/llama.cpp/releases/download/$VERSION/llama-$VERSION-bin-macos-arm64.tar.gz"
    ARCHIVE="llama.tar.gz"
elif [ "$OS" = "Darwin" ] && [ "$ARCH" = "x86_64" ]; then
    URL="https://github.com/ggml-org/llama.cpp/releases/download/$VERSION/llama-$VERSION-bin-macos-x64.tar.gz"
    ARCHIVE="llama.tar.gz"
else
    echo "Unsupported platform: $OS $ARCH"
    echo "Download manually from: https://github.com/ggml-org/llama.cpp/releases"
    exit 1
fi

echo "Downloading: $URL"
curl -L -o "$ARCHIVE" "$URL"

echo "Extracting..."
tar -xzf "$ARCHIVE"
rm "$ARCHIVE"

# Move binaries to bin folder
if [ -d "build/bin" ]; then
    mv build/bin/* . 2>/dev/null || true
    rm -rf build
fi

chmod +x llama-server llama-cli 2>/dev/null || true

echo ""
echo "=== Done! ==="
echo "Binary: $BIN_DIR/llama-server"
ls -la "$BIN_DIR/llama-server"
