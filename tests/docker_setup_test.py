import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    sys.modules[name]=module
    spec.loader.exec_module(module)
    return module
installer=load('install_local_retrieval',ROOT/'scripts/setup/install-local-retrieval.py')
setup=load('docker_setup',ROOT/'docker/reference_setup.py')

class DockerSetupTests(unittest.TestCase):
    def test_install_and_reuse_preserve_token(self):
        import hashlib
        with tempfile.TemporaryDirectory() as folder:
            data=Path(folder)/'data';data.mkdir();config=Path(folder)/'config'
            archive=data/setup.ASSET
            with tarfile.open(archive,'w:gz') as tar:
                for name,body in [('vectordb/chroma.sqlite3',b'SQLite format 3\0'+b'0'*64),('NOTICE.txt',b'notice'),('source-identities.json',b'{}')]:
                    info=tarfile.TarInfo(name);info.size=len(body);tar.addfile(info,io.BytesIO(body))
            digest=hashlib.sha256(archive.read_bytes()).hexdigest()
            with patch.object(setup,'SHA256',digest),patch.object(setup.os,'chown'),patch.object(setup.urllib.request,'urlopen',side_effect=AssertionError('unexpected network')):
                setup.initialize(data,config)
                token=(config/'retrieval-token').read_text()
                setup.initialize(data,config)
                self.assertEqual(token,(config/'retrieval-token').read_text())
                self.assertGreaterEqual(len(token),32)
                self.assertEqual(json.loads((data/'release.json').read_text())['count'],38742)
                self.assertFalse(archive.exists())
    def test_never_overwrites_unrecognized_database(self):
        with tempfile.TemporaryDirectory() as folder:
            data=Path(folder)/'data';(data/'vectordb').mkdir(parents=True)
            with self.assertRaisesRegex(ValueError,'not overwritten'):
                setup.initialize(data,Path(folder)/'config')
    def test_bad_archive_is_removed_without_installing(self):
        with tempfile.TemporaryDirectory() as folder:
            data=Path(folder)/'data';data.mkdir();archive=data/setup.ASSET;archive.write_bytes(b'invalid')
            with self.assertRaises(ValueError):setup.initialize(data,Path(folder)/'config')
            self.assertFalse((data/'vectordb').exists());self.assertFalse(archive.exists())

if __name__=='__main__':unittest.main()
