# リポジトリのルートをビルドコンテキストにする: docker build -f apps/api/Dockerfile .
FROM node:22.23.3-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo
RUN corepack enable

# 依存の定義だけを先にコピーし、ソース変更でインストール層のキャッシュが外れないようにする。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @area-insight/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @area-insight/api... build \
  && pnpm --filter @area-insight/api deploy --prod /out

FROM node:22.23.3-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
