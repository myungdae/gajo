# 가조 AI 컨시어지 - NestJS API 서버 (온톨로지 엔진 포함)
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
