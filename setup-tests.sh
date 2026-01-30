#!/bin/bash

echo "======================================"
echo "BookApp Test Setup Script"
echo "======================================"
echo ""

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    echo "Please install Node.js and npm first"
    exit 1
fi

echo "✓ npm is installed"
echo ""

echo "Checking npm permissions..."
if [ ! -w "$HOME/.npm" ]; then
    echo "⚠️  npm permission issue detected"
    echo "Fixing npm permissions..."
    sudo chown -R $(id -u):$(id -g) "$HOME/.npm"
    
    if [ $? -eq 0 ]; then
        echo "✓ npm permissions fixed"
    else
        echo "❌ Failed to fix permissions. You may need to run manually:"
        echo "   sudo chown -R \$(whoami) \"$HOME/.npm\""
        exit 1
    fi
else
    echo "✓ npm permissions are OK"
fi

echo ""
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✓ Dependencies installed successfully"
echo ""
echo "======================================"
echo "Running Tests"
echo "======================================"
echo ""

npm test

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ All tests passed!"
    echo "======================================"
else
    echo ""
    echo "======================================"
    echo "❌ Some tests failed"
    echo "======================================"
    exit 1
fi
