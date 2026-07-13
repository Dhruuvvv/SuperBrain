# Use standard slim Python image
FROM python:3.10-slim

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory to /app
WORKDIR /app

# Set PYTHONPATH so ai_server package can be imported correctly
ENV PYTHONPATH=/app

# Configure Hugging Face and Sentence Transformers cache directories
ENV HF_HOME=/app/cache/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/app/cache/sentence_transformers

# Install system dependencies (needed for audio loading, Git, building wheels, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage Docker cache
COPY requirements.txt /app/requirements.txt

# Install PyTorch CPU version first to keep Docker image size small (saves ~2GB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install other requirements
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directories
RUN mkdir -p $HF_HOME $SENTENCE_TRANSFORMERS_HOME

# Copy the rest of the application files to /app/ai_server
COPY . /app/ai_server

# Expose port (Railway binds dynamically via PORT env var)
EXPOSE 8000

# Start FastAPI server using uvicorn cli and bind to the dynamic PORT env var
CMD ["sh", "-c", "uvicorn ai_server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
