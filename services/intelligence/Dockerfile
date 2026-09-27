# Build context: repo root. The service imports the ml/ package directly.
FROM python:3.12-slim
# LightGBM links against OpenMP.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/intelligence/requirements.txt services/intelligence/requirements.txt
RUN pip install --no-cache-dir -r services/intelligence/requirements.txt
COPY ml ml
COPY services/__init__.py services/__init__.py
COPY services/intelligence services/intelligence
# Trained artifacts are mounted here (see docs/intelligence.md), not baked in.
ENV MODEL_DIR=/app/ml/artifacts PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "services.intelligence.app:app", "--host", "0.0.0.0", "--port", "8000"]
