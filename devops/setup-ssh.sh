#!/usr/bin/env bash
set -euo pipefail

echo "=== Pakistan Tax AI — SSH Key Setup ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_config.sh" 2>/dev/null || true

SSH_KEY_PATH="${HOME}/.ssh/pakistan_tax_ai_vps"

if [ ! -f "$SSH_KEY_PATH" ]; then
    echo "Generating new SSH key pair..."
    ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "pakistan-tax-ai-deploy"
    echo ""
    echo "✅ SSH key generated at: $SSH_KEY_PATH"
else
    echo "SSH key already exists at: $SSH_KEY_PATH"
fi

echo ""
echo "=== Public Key (copy this to VPS authorized_keys) ==="
echo ""
cat "${SSH_KEY_PATH}.pub"
echo ""
echo "=== To copy to VPS ==="
echo "ssh-copy-id -i $SSH_KEY_PATH ${VPS_USER:-root}@${VPS_HOST:-YOUR_VPS_IP}"
echo ""
echo "=== Add to SSH config ==="
echo ""
echo "Add this to ~/.ssh/config:"
echo ""
echo "Host pakistan-tax-ai"
echo "    HostName ${VPS_HOST:-YOUR_VPS_IP}"
echo "    User ${VPS_USER:-root}"
echo "    IdentityFile $SSH_KEY_PATH"
echo "    StrictHostKeyChecking no"
echo ""
