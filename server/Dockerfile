# 가조 AI 컨시어지 - NestJS API 서버 (온톨로지 엔진 포함)
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Keep the compiler layout and production command coupled. This fails the image
# build immediately if TypeScript/Nest stops emitting the intended entrypoint.
RUN test -f /app/dist/main.js

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# CopilotAuthService imports bcryptjs at runtime. Fail the production image
# build here if the final-stage dependency set ever stops providing it.
RUN node -e "require.resolve('bcryptjs')"
COPY --from=build /app/dist ./dist
RUN node -e "require.resolve('./dist/main.js')"

EXPOSE 3000
CMD ["node", "dist/main.js"]
