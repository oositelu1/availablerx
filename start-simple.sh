#!/bin/bash
cd /Users/fisayoositelu/Downloads/DocumentTracker
export NODE_ENV=development
echo "Starting DocumentTracker on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""
npx tsx server/index.ts