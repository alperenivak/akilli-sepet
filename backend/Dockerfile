# =====================================================
# Akıllı Sepet Backend — Production Docker Image
# =====================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma query engine (Alpine + OpenSSL)
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Production image ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health/live" || exit 1'

# Root user: start'ta prisma/node_modules yazma hatasi olmasin
CMD ["node", "dist/main.js"]
