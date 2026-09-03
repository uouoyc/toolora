# 部署

## 前置条件

- 一台 Linux 云服务器，并且已安装 Docker Engine(含 buildx 插件)与 Docker Compose。
- 域名 A 记录已指向服务器 IP。
- 已持有该域名的 HTTPS 证书(`cert.pem` 与 `privkey.pem`)。

## 部署 Toolora

### 1. 拉取代码

```bash
cd /data

git clone https://github.com/uouoyc/toolora.git
```

### 2. 配置环境变量

根目录 `.env.example` 的默认值面向本地开发：

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
```

复制为 `.env` 并编辑：

```bash
cd /data/toolora

cp .env.example .env

vim .env
```

生产环境三个变量都填站点域名：

```env
NEXT_PUBLIC_SERVER_URL=https://toolora.tools
NEXT_PUBLIC_SITE_URL=https://toolora.tools
CORS_ORIGIN=https://toolora.tools
```

### 3. 构建并启动

先校验 Compose 配置：

```bash
docker compose config -q
```

构建并启动：

```bash
docker compose up -d --build
```

web 与 server 分别发布在宿主机的 3001 与 3000，容器健康检查通过后即可配置 Nginx。

## 部署 Nginx

### 1. 创建目录

```bash
mkdir -p /data/nginx/cert

cd /data/nginx
```

最终目录结构：

```text
/data/nginx/
├── docker-compose.yml
├── nginx.conf
└── cert/
    ├── cert.pem
    └── privkey.pem
```

### 2. 放置 HTTPS 证书

将证书放到以下路径，并收紧私钥权限：

```text
/data/nginx/cert/cert.pem
/data/nginx/cert/privkey.pem
```

```bash
chmod 644 /data/nginx/cert/cert.pem
chmod 600 /data/nginx/cert/privkey.pem
```

### 3. 编写 nginx.conf

```bash
vim /data/nginx/nginx.conf
```

完整配置：

```nginx
user nginx;

worker_processes auto;

error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
}

http {
    # ---------- Basic ----------
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server_tokens off;

    sendfile on;
    tcp_nopush on;

    keepalive_timeout 65;

    # ---------- Logging ----------
    log_format main
    '$remote_addr - $remote_user [$time_local] "$request" '
    '$status $body_bytes_sent "$http_referer" '
    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # ---------- TLS ----------
    ssl_protocols TLSv1.2 TLSv1.3;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    ssl_certificate /etc/nginx/cert/cert.pem;
    ssl_certificate_key /etc/nginx/cert/privkey.pem;

    # ---------- Proxy ----------
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;

    # ---------- Upstreams ----------
    upstream toolora_web {
        server host.docker.internal:3001;
    }

    upstream toolora_api {
        server host.docker.internal:3000;
    }

    # ---------- HTTP ----------
    server {
        listen 80;
        listen [::]:80;

        server_name toolora.tools www.toolora.tools;

        return 301 https://toolora.tools$request_uri;
    }

    # ---------- HTTPS: www redirect ----------
    server {
        listen 443 ssl;
        listen [::]:443 ssl;

        http2 on;

        server_name www.toolora.tools;

        return 301 https://toolora.tools$request_uri;
    }

    # ---------- HTTPS: main ----------
    server {
        listen 443 ssl;
        listen [::]:443 ssl;

        http2 on;

        server_name toolora.tools;

        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;

        location /rpc/ {
            proxy_pass http://toolora_api;
        }

        location / {
            proxy_pass http://toolora_web;
        }
    }
}
```

### 4. 编写 docker-compose.yml

```bash
vim /data/nginx/docker-compose.yml
```

完整配置：

```yaml
name: nginx

services:
  nginx:
    image: nginx:1.30.4
    restart: unless-stopped

    security_opt:
      - no-new-privileges:true

    ports:
      - "80:80"
      - "443:443"

    extra_hosts:
      - "host.docker.internal:host-gateway"

    volumes:
      - type: bind
        source: ./nginx.conf
        target: /etc/nginx/nginx.conf
        read_only: true
        bind:
          create_host_path: false

      - type: bind
        source: ./cert
        target: /etc/nginx/cert
        read_only: true
        bind:
          create_host_path: false

    logging:
      driver: local
      options:
        max-size: "20m"
        max-file: "5"
```

### 5. 校验并启动

```bash
cd /data/nginx

docker compose config -q
docker compose pull
docker compose up -d
```

状态与日志：

```bash
docker compose ps
docker compose logs -f nginx
```

## 日常运维

### 更新版本

```bash
cd /data/toolora

git pull

docker compose up -d --build
```

### 更换证书

替换 `/data/nginx/cert/` 下的 `cert.pem` 与 `privkey.pem` 后，热加载 Nginx：

```bash
cd /data/nginx

docker compose exec nginx nginx -s reload
```
