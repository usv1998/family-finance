#!/bin/bash
# ─────────────────────────────────────────────
#  Family Finance Tracker — Setup & Run
#  Run once: bash setup.sh
# ─────────────────────────────────────────────

set -e

echo ""
echo "  Family Finance Tracker"
echo "  ─────────────────────────────────────"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found."
  echo "  Install from https://nodejs.org (LTS version)"
  echo ""
  exit 1
fi

NODE_VER=$(node -v)
echo "  ✓ Node.js $NODE_VER found"
echo ""

# Install
echo "  Installing dependencies..."
npm install --silent
echo "  ✓ Dependencies installed"
echo ""

# Get local IP for phone access
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "your-mac-ip")

echo "  ─────────────────────────────────────"
echo "  Starting app..."
echo ""
echo "  MacBook:  http://localhost:5173"
echo "  iPhone:   http://$LOCAL_IP:5173"
echo "            (must be on same WiFi)"
echo ""
echo "  iPhone install: open in Safari → Share → Add to Home Screen"
echo "  ─────────────────────────────────────"
echo ""

npm run dev
