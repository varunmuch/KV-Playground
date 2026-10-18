# KV Playground: one container that serves the website and runs the model.

# 1. Build the website.
FROM node:22.11.0-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 2. The model server, which also serves the built website.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    # Downloaded model files go here; mount a volume so they survive restarts.
    HF_HOME=/models
WORKDIR /app
# TORCH=cuda (default) installs PyTorch with NVIDIA GPU support (several GB).
# TORCH=cpu installs the much smaller CPU-only build: use it on Macs and machines without an NVIDIA GPU.
ARG TORCH=cuda
COPY engine/requirements.txt engine/requirements.txt
RUN if [ "$TORCH" = "cpu" ]; then \
      pip install --no-cache-dir "torch==$(grep '^torch==' engine/requirements.txt | cut -d= -f3)" --index-url https://download.pytorch.org/whl/cpu; \
    fi && \
    pip install --no-cache-dir -r engine/requirements.txt
COPY engine/ engine/
COPY --from=web /web/dist web/dist
EXPOSE 8000
WORKDIR /app/engine
CMD ["python", "server.py", "--host", "0.0.0.0", "--site", "../web/dist"]
