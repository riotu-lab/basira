"""One-time named-volume setup. No API credentials are given to this container."""
import json
import os
from pathlib import Path
import secrets
import shutil
import sys
import tempfile
import urllib.request
sys.path.insert(0, '/service/scripts/setup')
from install_local_retrieval import URL, SHA256, ASSET, checked_extract


def initialize(data=Path('/data'), config=Path('/config')):
    data.mkdir(parents=True, exist_ok=True)
    config.mkdir(parents=True, exist_ok=True)
    marker=data/'release.json'
    if (data/'vectordb').exists():
        if not marker.exists() or json.loads(marker.read_text()).get('sha256') != SHA256:
            raise ValueError('An unrecognized database exists in this volume. It was not overwritten.')
        print('Using the previously installed reference database.', flush=True)
    else:
        if shutil.disk_usage(data).free < 3*1024**3:
            raise ValueError('Keep at least 3 GiB free in Docker storage for reference setup.')
        archive=data/ASSET
        if not archive.exists():
            partial=archive.with_suffix('.partial')
            print('Downloading the 606 MB reference archive. First startup can take several minutes.', flush=True)
            try:
                with urllib.request.urlopen(URL, timeout=60) as source, partial.open('wb') as dest:
                    shutil.copyfileobj(source, dest, length=1024**2)
                partial.replace(archive)
            finally:
                partial.unlink(missing_ok=True)
        try:
            with tempfile.TemporaryDirectory(prefix='extract-', dir=data) as folder:
                stage=Path(folder)
                checked_extract(archive,stage,SHA256)
                for name in ['NOTICE.txt','source-identities.json']:
                    shutil.copy2(stage/name,data/name)
                (stage/'vectordb').rename(data/'vectordb')
                marker.write_text(json.dumps({'sha256':SHA256,'collection':'islamthon','count':38742}))
        except ValueError:
            archive.unlink(missing_ok=True)
            raise
        archive.unlink(missing_ok=True)
        print('Reference archive verified and installed.', flush=True)
    token=config/'retrieval-token'
    if not token.exists():
        with token.open('x') as f:f.write(secrets.token_urlsafe(32))
    if len(token.read_text().strip()) < 32:
        raise ValueError('The local retrieval token is invalid; setup stopped.')
    # Only container-owned named volumes are changed, never host source directories.
    for base in [data,config]:
        for path in [base,*base.rglob('*')]:
            if path.is_symlink():raise ValueError('Unexpected symlink in a local data volume.')
            os.chown(path,10001,10001)
    os.chmod(config,0o700)
    os.chmod(token,0o600)
    print('Local reference service is ready to start. No API credits were used.', flush=True)

if __name__=='__main__':
    try:initialize()
    except Exception as error:
        print('Reference setup failed: '+str(error),file=sys.stderr)
        sys.exit(1)
