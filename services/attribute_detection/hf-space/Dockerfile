# PassportSnap attribute detection on a Hugging Face Space (free CPU tier).
#
# Spaces build this image themselves from the Space repository, listen on the
# port declared as app_port in README.md (7860), and run as a non-root user.
# Weights are pulled at build time so a cold start only has to load them.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    ATTRIBUTE_MODEL_ID=google/siglip-base-patch16-224

RUN useradd -m -u 1000 user
WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install --no-cache-dir -r /app/requirements.txt

COPY --chown=user services /app/services

# Bake the weights into the image under a path the runtime user can read.
ENV HF_HOME=/app/.hf
RUN mkdir -p /app/.hf && chown -R user:user /app/.hf
USER user
RUN python -c "from transformers import AutoModel, AutoProcessor; import os; m=os.environ['ATTRIBUTE_MODEL_ID']; AutoProcessor.from_pretrained(m); AutoModel.from_pretrained(m)"

EXPOSE 7860
CMD ["uvicorn", "services.attribute_detection.main:app", "--host", "0.0.0.0", "--port", "7860"]
