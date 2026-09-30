#!/bin/bash
set -euo pipefail

dnf install -y nodejs22 nodejs22-npm
alternatives --set node /usr/bin/node-22
id playground >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/take-the-l --shell /sbin/nologin playground
id caddy >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/caddy --shell /sbin/nologin caddy
install -d -o playground -g playground /opt/take-the-l
install -d -o caddy -g caddy /etc/caddy
curl --fail --silent --show-error --location --retry 3 'https://caddyserver.com/api/download?os=linux&arch=arm64' --output /usr/local/bin/caddy
chmod 755 /usr/local/bin/caddy
touch /var/lib/take-the-l/bootstrap-ready
