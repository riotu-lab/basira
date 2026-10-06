import os
from pathlib import Path
os.environ['CONTENT_RAG_TOKEN']=Path('/config/retrieval-token').read_text().strip()
os.environ['CONTENT_RAG_DB_PATH']='/data/vectordb'
os.execvp('python',['python','-m','uvicorn','app:app','--host','0.0.0.0','--port','8000','--no-access-log'])
