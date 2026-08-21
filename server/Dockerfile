FROM python:3.11-slim

# 系统依赖：ffmpeg 供 faster-whisper / edge-tts 使用
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 种子场景数据放在镜像内固定路径（与持久化数据卷 /app/data 分离，避免被卷覆盖）
ENV SCENARIOS_SEED_PATH=/app/seed/scenarios.json
RUN mkdir -p /app/seed /app/data \
    && cp data/scenarios.json /app/seed/scenarios.json

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000"]
