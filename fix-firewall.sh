#!/bin/bash

echo "🔧 Configuring macOS Firewall for Node.js..."

# Find Node.js location
NODE_PATH=$(which node)
echo "📍 Node.js found at: $NODE_PATH"

# Add Node.js to firewall exceptions
echo "🔓 Adding Node.js to firewall exceptions..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_PATH"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$NODE_PATH"

# Also add tsx if it exists
TSX_PATH=$(which tsx 2>/dev/null)
if [ ! -z "$TSX_PATH" ]; then
    echo "🔓 Adding tsx to firewall exceptions..."
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$TSX_PATH"
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$TSX_PATH"
fi

echo "✅ Firewall configuration complete!"
echo ""
echo "🚀 Now try running your app again:"
echo "   cd /Users/fisayoositelu/Downloads/DocumentTracker"
echo "   npm run dev"