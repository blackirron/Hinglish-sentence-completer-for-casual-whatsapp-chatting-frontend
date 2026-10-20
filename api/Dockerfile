FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/home/user/.cache/huggingface
RUN useradd -m -u 1000 user
WORKDIR /home/user/app

# No torch: onnxruntime plus the tokenizers library is about 60 MB, so 512 MB of RAM is enough.
COPY requirements.txt .
RUN pip install -r requirements.txt

USER user
COPY --chown=user app ./app

# Bake the int8 ONNX package into the image so a cold start does not download 112 MB.
ARG MODEL_REPO=blackirron/hinglish-gpt2-onnx
ARG MODEL_REVISION=8357f2d52850e525f41b35d7f49e44d1dd066c19
ENV MODEL_REPO=${MODEL_REPO} MODEL_REVISION=${MODEL_REVISION}
RUN python -c "import os; from huggingface_hub import snapshot_download; from app.model import SERVING_FILES; snapshot_download(os.environ['MODEL_REPO'], revision=os.environ['MODEL_REVISION'], allow_patterns=SERVING_FILES)"

ENV APP_ENV=production
# Render sets PORT (10000 by default). One worker only, a second copy of the model would not fit.
CMD ["sh", "-c", "exec uvicorn app.main:app_factory --factory --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
