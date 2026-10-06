"""Start the local private retrieval service; never prints credentials."""
import os
import subprocess
from pathlib import Path
from dotenv import dotenv_values
root=Path(__file__).resolve().parents[2]
values=dotenv_values(root/'.env')
env=os.environ.copy()
for key in ['CONTENT_RAG_TOKEN','CONTENT_RAG_DB_PATH']:
    if values.get(key):env[key]=values[key]
env.setdefault('CONTENT_RAG_DB_PATH',str(root/'.local/content-rag/vectordb'))
subprocess.run([str(root/'.local/rag-venv/bin/python'),'-m','uvicorn','app:app','--app-dir',str(root/'services/content-retrieval'),'--host','127.0.0.1','--port','8010','--no-access-log'],env=env,check=True)
