#!/bin/bash
set -euo pipefail

DOMAIN="bottleteach.xyz"
EMAIL="admin@bottleteach.xyz"
APP_DIR="/opt/edgone"

echo "============================================"
echo " OpenClaw 服务器部署脚本"
echo " 域名: ${DOMAIN}"
echo "============================================"

# ---------- 1. 安装 Docker ----------
if ! command -v docker &>/dev/null; then
  echo "[1/6] 安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker --now
else
  echo "[1/6] Docker 已安装，跳过"
fi

# ---------- 2. 安装 Nginx + Certbot ----------
echo "[2/6] 安装 Nginx 和 Certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

# ---------- 3. 克隆/更新项目 ----------
if [ -d "${APP_DIR}" ]; then
  echo "[3/6] 项目已存在，拉取最新代码..."
  cd "${APP_DIR}"
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
else
  echo "[3/6] 克隆项目..."
  git clone https://github.com/wusiyi110011/edgone.git "${APP_DIR}"
  cd "${APP_DIR}"
fi

# ---------- 4. 构建 Docker 镜像 ----------
echo "[4/6] 构建 Docker 镜像..."
docker build -t edgone .

# ---------- 5. 启动容器 ----------
echo "[5/6] 启动容器..."
docker stop edgone 2>/dev/null || true
docker rm edgone 2>/dev/null || true
docker run -d --name edgone \
  --restart always \
  -p 127.0.0.1:3001:80 \
  -v /opt/edgone-data:/app/apps/server/data \
  edgone

# ---------- 6. 配置 Nginx + SSL ----------
echo "[6/6] 配置 Nginx 和 SSL..."

cat > /etc/nginx/sites-available/edgone <<'NGINX'
server {
    listen 80;
    server_name bottleteach.xyz www.bottleteach.xyz;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

if [ -f /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi
ln -sf /etc/nginx/sites-available/edgone /etc/nginx/sites-enabled/edgone
nginx -t && systemctl reload nginx

# ---------- 7. 申请 SSL 证书 ----------
echo "[7/7] 申请 SSL 证书..."
certbot --nginx -d bottleteach.xyz -d www.bottleteach.xyz --non-interactive --agree-tos --email "${EMAIL}" || true

echo ""
echo "============================================"
echo " 部署完成!"
echo " 访问: https://bottleteach.xyz"
echo "============================================"
