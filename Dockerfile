# Install dependencies only when needed
FROM node:current-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl && npm install -g pnpm
WORKDIR /app

# Copy package files and prisma schema
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

# Install dependencies (skip prepare script, we'll generate Prisma in builder stage)
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    pnpm install --frozen-lockfile --ignore-scripts; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM node:current-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_MOCK_USER=''

# Install pnpm and generate Prisma client before build
RUN npm install -g pnpm && \
    npx prisma generate && \
    pnpm run build

# Production image, copy all the files and run next
FROM node:current-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install runtime dependencies including OpenSSL for Prisma
RUN sed -i 's/https/http/' /etc/apk/repositories
RUN apk add --no-cache \
    curl \
    ca-certificates \
    openssl \
  && update-ca-certificates

# Copy Next.js standalone output and static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema (required for Prisma Client at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy config files
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
