#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 20 or newer is needed. Get it at https://nodejs.org"; read -p "Press Enter"; exit 1; }
node setup.mjs
