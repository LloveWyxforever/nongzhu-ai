# 农助 AI —— 后端 (FastAPI / uvicorn / Python 3.11)
# 保留 SQLite + FTS5：数据库与上传/媒体文件通过持久卷挂载到 /app/data、/app/knowledge，
# 不写入镜像层。db.py 中 ROOT = backend 的上一级目录（即 /app），故数据目录为 /app/data。
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 先装依赖以利用构建缓存（requirements 与代码分两层）
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt

# 再拷贝后端源码（.dockerignore 已排除 .venv / __pycache__）
COPY backend/ /app/backend/

# 数据目录（数据库/上传/媒体/知识）持久卷挂载点；预建目录并交给运行用户
RUN groupadd -r nongzhu && useradd -r -g nongzhu nongzhu \
    && mkdir -p /app/data/uploads /app/data/media /app/knowledge \
    && chown -R nongzhu:nongzhu /app

USER nongzhu
WORKDIR /app/backend

ENV NONGZHU_DB=/app/data/nongzhu.db
EXPOSE 8017

# --proxy-headers：信任 Nginx 转发的 X-Forwarded-Proto/For，使后端在 HTTPS 反代后识别真实协议
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8017", "--proxy-headers", "--forwarded-allow-ips", "*"]
