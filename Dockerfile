# ---- Stage 1 ----
    FROM node:20-alpine AS deps
    RUN apk add --no-cache openssl
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY prisma ./prisma
    RUN npx prisma generate

# ---- Stage 2 ----
    FROM node:20-alpine AS runner
    RUN apk add --no-cache openssl
    WORKDIR /app
    ENV NODE_ENV=production
    COPY package*.json ./
    RUN npm ci --omit=dev
    COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
    COPY prisma ./prisma
    COPY src ./src
    USER node
    EXPOSE 3001
    CMD ["node", "src/server.js"]