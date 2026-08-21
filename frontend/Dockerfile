# ===== 构建阶段 =====
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# 后端地址：浏览器可访问的后端地址（构建时写入前端包）
ARG VITE_LOCAL_BACKEND_URL=http://localhost:8000
ENV VITE_LOCAL_BACKEND_URL=$VITE_LOCAL_BACKEND_URL

RUN npm run build

# ===== 运行阶段 =====
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
