FROM python:3.12-slim
WORKDIR /service
COPY requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home retrieval
COPY app.py ./app.py
RUN mkdir /data && chown retrieval:retrieval /data
USER retrieval
ENV CONTENT_RAG_DB_PATH=/data/vectordb
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
