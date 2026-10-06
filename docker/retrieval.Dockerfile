FROM python:3.12-slim
WORKDIR /service
COPY services/content-retrieval/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && groupadd --gid 10001 basira && useradd --uid 10001 --gid 10001 --create-home basira
COPY services/content-retrieval/app.py ./app.py
COPY scripts/setup/install-local-retrieval.py ./scripts/setup/install_local_retrieval.py
COPY docker ./docker
RUN mkdir /data /config && chown 10001:10001 /data /config
USER 10001:10001
CMD ["python", "/service/docker/retrieval_entry.py"]
