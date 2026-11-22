FROM node:20-alpine

RUN apk add --no-cache openssl \
    && corepack enable \
    && corepack prepare pnpm@9.15.4 --activate

WORKDIR /workspace
COPY . .

RUN pnpm install --frozen-lockfile \
    && pnpm --filter @cliniccare/backend db:generate \
    && pnpm --filter @cliniccare/backend build

WORKDIR /workspace/backend
EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @cliniccare/backend db:deploy && pnpm --filter @cliniccare/backend start"]
