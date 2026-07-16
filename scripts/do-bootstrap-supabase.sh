#!/usr/bin/env bash
set -euo pipefail

echo "==> Updating system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw git

echo "==> Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Firewall (SSH + HTTP + HTTPS)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Cloning Supabase docker stack"
mkdir -p /opt
if [ ! -d /opt/supabase ]; then
  git clone --depth 1 https://github.com/supabase/supabase /opt/supabase
fi
cd /opt/supabase/docker
cp -n .env.example .env

echo "==> Pulling and starting full stack (this takes several minutes)"
docker compose pull
docker compose up -d

echo ""
echo "Supabase is starting."
echo "Next: open Studio when ready, then we wire domain/HTTPS and Vercel keys."
echo "Check status with: cd /opt/supabase/docker && docker compose ps"
