"""Install the versioned local reference index; never downloads or displays API keys."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import sys
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'basira-retrieval-v1.tar.gz'
URL = 'https://github.com/riotu-lab/basira/releases/download/retrieval-v1/' + ASSET
SHA256 = '63e1b6761f6a7291cfb8ef6c1d84f60e57e3d00a2e06df238e3edfac2c63bcf3'


def env_value(text, name):
    found = re.search(r'^' + re.escape(name) + r'[ \t]*=[ \t]*(.*)$', text, re.M)
    return found.group(1).strip().strip('\"\'') if found else ''


def checked_extract(archive, destination, digest=SHA256):
    with archive.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != digest:
        raise ValueError('Checksum mismatch. The archive was not extracted.')
    with tarfile.open(archive, 'r:gz') as bundle:
        members = bundle.getmembers()
        if sum(m.size for m in members) > 2 * 1024**3:
            raise ValueError('Archive exceeds the expected unpacked size.')
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or not path.parts
                or path.parts[0] not in {'vectordb', 'NOTICE.txt', 'source-identities.json'}
                or not (member.isfile() or member.isdir())):
                raise ValueError('Unsafe or unexpected archive entry.')
        bundle.extractall(destination, members=members, filter='data')
    database = destination / 'vectordb/chroma.sqlite3'
    if not database.is_file():
        raise ValueError('The reference database is missing.')
    with database.open('rb') as stream:
        if stream.read(16) != b'SQLite format 3\x00':
            raise ValueError('The reference database header is invalid.')


def main():
    if sys.version_info < (3, 12):
        raise ValueError('Use Python 3.12 or newer for the installer; the retrieval lockfile targets Python 3.12.')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, help='Use a separately downloaded archive instead of downloading it.')
    args = parser.parse_args()
    target = ROOT / '.local/content-rag/vectordb'
    if target.exists():
        raise ValueError('A local index already exists. It was not overwritten.')
    env_path = ROOT / '.env'
    text = env_path.read_text() if env_path.exists() else (ROOT / '.env.example').read_text()
    if any(env_value(text, key) or os.environ.get(key) for key in ['UPSTASH_VECTOR_REST_URL', 'UPSTASH_VECTOR_REST_TOKEN']):
        raise ValueError('Upstash Vector is configured and takes precedence. Clear its two values before choosing local Chroma; no credentials were changed.')
    if env_value(text, 'BASIRA_ENV') not in ('', 'development'):
        raise ValueError('This installer is for a development checkout only. No environment values were changed.')
    private = ROOT / '.local'
    private.mkdir(exist_ok=True)
    if shutil.disk_usage(private).free < 3 * 1024**3:
        raise ValueError('Keep at least 3 GiB free for the archive and database.')
    archive = args.archive.resolve() if args.archive else private / ASSET
    if not args.archive and not archive.exists():
        partial = archive.with_suffix('.partial')
        print('Downloading the reference database (roughly 0.6 GB). No model or avatar request is made.', flush=True)
        try:
            with urllib.request.urlopen(URL, timeout=60) as source, partial.open('wb') as dest:
                shutil.copyfileobj(source, dest, length=1024**2)
            partial.replace(archive)
        finally:
            partial.unlink(missing_ok=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='retrieval-install-', dir=private) as folder:
        stage = Path(folder)
        checked_extract(archive, stage, SHA256)
        token = env_value(text, 'CONTENT_RAG_TOKEN')
        if len(token) < 32:
            token = secrets.token_urlsafe(32)
        values = {'CONTENT_RAG_URL': 'http://127.0.0.1:8010',
                  'CONTENT_RAG_DB_PATH': str(target), 'CONTENT_RAG_TOKEN': token,
                  'CONTENT_RETRIEVAL_ENABLED': 'true'}
        for key, value in values.items():
            line = key + '=' + json.dumps(value)
            pattern = r'^' + re.escape(key) + r'[ \t]*=.*$'
            if re.search(pattern, text, re.M):
                text = re.sub(pattern, lambda _: line, text, flags=re.M)
            else:
                text = text.rstrip() + '\n' + line + '\n'
        # Prepare configuration first; keep other credentials unchanged and never print them.
        with tempfile.NamedTemporaryFile(mode='w', prefix='.env.retrieval-', dir=ROOT, delete=False) as output:
            output.write(text)
            temporary_env = Path(output.name)
        try:
            os.chmod(temporary_env, 0o600)
            shutil.copy2(stage / 'NOTICE.txt', target.parent / 'NOTICE.txt')
            shutil.copy2(stage / 'source-identities.json', target.parent / 'source-identities.json')
            (stage / 'vectordb').rename(target)
            temporary_env.replace(env_path)
        finally:
            temporary_env.unlink(missing_ok=True)
    print('Local database installed and checksum verified. Retrieval settings saved in .env; secrets were not displayed.')
    print('Start retrieval: .local/rag-venv/bin/python scripts/dev/content-rag.py')
    print('Then start Basira in another terminal: npm run dev:avatar (or npm run dev for text only).')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, tarfile.TarError) as error:
        # Errors from downloads/filesystem may contain paths, never configuration contents.
        print('Local retrieval setup failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
