import json
from pathlib import Path
import urllib.request
request=urllib.request.Request('http://127.0.0.1:8000/health',headers={'Authorization':'Bearer '+Path('/config/retrieval-token').read_text().strip()})
with urllib.request.urlopen(request,timeout=3) as response:
    result=json.load(response)
    assert result.get('ready') is True and result.get('count')==38742
