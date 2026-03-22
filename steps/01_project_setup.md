# Шаг 1: Настройка структуры проекта и Docker (Инструкция для ИИ-агента)

**КОНТЕКСТ ДЛЯ АГЕНТА:** Инициализировать монорепозиторий. Все команды — неинтерактивны. Caddy является единой точкой входа: браузер → `localhost:80`, далее Caddy проксирует `/ws` → `server:3001` (WebSocket) и всё остальное → `app:3000` (Next.js). Это решает проблему WebSocket URL в браузере и позволяет задавать единые origin-независимые URL.

## 1.1 Структура директорий
```bash
mkdir app server data caddy
```

## 1.2 Фронтенд (Next.js)
Перейди в `app/` и инициализируй:
```bash
npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --yes
```
Установи зависимости (tldraw с нативным sync, без Yjs):
```bash
npm install socket.io-client @tldraw/tldraw @tldraw/sync react-rnd lucide-react --save --legacy-peer-deps
```

Создай `app/.env.production` (встраивается во время `npm run build`):
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost
NEXT_PUBLIC_TLDRAW_WS_URL=ws://localhost/tldraw-sync
NEXT_PUBLIC_TURN_URL=turn:localhost:3478
NEXT_PUBLIC_TURN_USER=test
NEXT_PUBLIC_TURN_CRED=test
```

Создай `app/Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
# .env.production уже скопирован выше — Next.js прочтёт его при билде
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

## 1.3 Бэкенд (Node.js)
Перейди в `server/` и инициализируй:
```bash
npm init -y
npm install express socket.io cors ws @tldraw/sync-core --save
```

Создай `server/Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

## 1.4 Caddy (Reverse Proxy)
Создай `caddy/Caddyfile`:
```
:80 {
    # WebSocket для tldraw sync
    handle /tldraw-sync* {
        reverse_proxy server:3001
    }

    # Socket.io (нужен polling + WebSocket)
    handle /socket.io/* {
        reverse_proxy server:3001
    }

    # Всё остальное — Next.js
    handle {
        reverse_proxy app:3000
    }
}
```

## 1.5 Docker Compose (app + server + caddy + coturn)
Создай `docker-compose.yml` в корне:
```yaml
version: '3.8'

services:
  app:
    build:
      context: ./app
      dockerfile: Dockerfile
    expose:
      - "3000"
    depends_on:
      - server

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    expose:
      - "3001"
    volumes:
      - ./data:/usr/src/app/data

  caddy:
    image: caddy:alpine
    ports:
      - "80:80"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
    depends_on:
      - app
      - server

  turnserver:
    image: coturn/coturn
    command: >
      turnserver -a -o -v -n --no-dtls --no-tls
      -u test:test -r myrealm
      --min-port 50000 --max-port 50050
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
      - "50000-50050:50000-50050/udp"
```

Обрати внимание: `app` и `server` используют `expose` (не `ports`) — они доступны **только** внутри Docker сети, а снаружи — только через Caddy на порту 80.

## 1.6 .gitignore
Создай в корне:
```
node_modules/
.next/
data/
.env
.env.production
```
