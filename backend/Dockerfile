# Node API + Python ML sidecar (recommended for Render when native Node runtime lacks Python).
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN pip3 install --no-cache-dir --break-system-packages -r ml/requirements.txt

ENV NODE_ENV=production
ENV ML_HOST=127.0.0.1
ENV ML_PORT=5001

EXPOSE 4000

CMD ["bash", "start.sh"]
