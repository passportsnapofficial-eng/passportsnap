# Attribute detection service: one SigLIP model answering glasses / hat /
# religious head covering / face mask with three-state verdicts.
#
#   docker build -t passportsnap-attributes -f services/attribute_detection/Dockerfile .
#   docker run -p 8789:8789 passportsnap-attributes
#
# CPU-only on purpose: the hosts this is meant for (Railway, Render, Fly) have
# no GPU, and SigLIP base answers a 224px image in well under a second on CPU.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    ATTRIBUTE_MODEL_ID=google/siglip-base-patch16-224

WORKDIR /app

COPY services/attribute_detection/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install --no-cache-dir -r /app/requirements.txt

COPY services/__init__.py /app/services/__init__.py
COPY services/attribute_detection /app/services/attribute_detection

# Pull the weights at build time so cold starts do not depend on the Hub.
RUN python -c "from transformers import AutoModel, AutoProcessor; import os; m=os.environ['ATTRIBUTE_MODEL_ID']; AutoProcessor.from_pretrained(m); AutoModel.from_pretrained(m)"

EXPOSE 8789
CMD ["uvicorn", "services.attribute_detection.main:app", "--host", "0.0.0.0", "--port", "8789"]
