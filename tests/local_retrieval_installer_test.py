"""Offline tests for archive integrity and local-only setup; no religious source fixtures."""
import contextlib,hashlib,importlib.util,io,os,sys,tarfile,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('installer',Path(__file__).resolve().parents[1]/'scripts/setup/install-local-retrieval.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class InstallerTests(unittest.TestCase):
    def archive(self,folder,unsafe=False):
        archive=folder/'fixture.tar.gz'
        with tarfile.open(archive,'w:gz') as bundle:
            entries={'vectordb/chroma.sqlite3':b'SQLite format 3\x00fixture','NOTICE.txt':b'fixture','source-identities.json':b'{}'}
            if unsafe:entries['../outside']=b'no'
            for name,data in entries.items():
                member=tarfile.TarInfo(name);member.size=len(data);bundle.addfile(member,io.BytesIO(data))
        with archive.open('rb') as stream:
            return archive,hashlib.file_digest(stream,'sha256').hexdigest()
    def test_blank_env_values_do_not_consume_next_line(self):
        self.assertEqual(m.env_value('UPSTASH_VECTOR_REST_URL=\n# next line\nTOKEN=other','UPSTASH_VECTOR_REST_URL'),'')
    def test_checksum_failure_does_not_extract(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);archive,_=self.archive(root);dest=root/'output';dest.mkdir()
            with self.assertRaises(ValueError):m.checked_extract(archive,dest,'0'*64)
            self.assertEqual(list(dest.iterdir()),[])
    def test_unsafe_paths_rejected_even_with_matching_digest(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);archive,digest=self.archive(root,True);dest=root/'output';dest.mkdir()
            with self.assertRaises(ValueError):m.checked_extract(archive,dest,digest)
            self.assertFalse((root/'outside').exists())
    def test_install_preserves_credentials_and_existing_index(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);archive,digest=self.archive(root)
            (root/'.env').write_text('OPENAI_API_KEY=fixture-private-key\nTAVUS_API_KEY=other-fixture\nBASIRA_ENV=development\nUPSTASH_VECTOR_REST_URL=\nUPSTASH_VECTOR_REST_TOKEN=\nCONTENT_RAG_TOKEN=\n')
            stdout=io.StringIO()
            with patch.object(m,'ROOT',root),patch.object(m,'SHA256',digest),patch.object(sys,'argv',['setup','--archive',str(archive)]),patch.dict(os.environ,{},clear=True),contextlib.redirect_stdout(stdout):
                m.main()
                with self.assertRaises(ValueError):m.main()
            saved=(root/'.env').read_text();self.assertIn('OPENAI_API_KEY=fixture-private-key',saved);self.assertIn('TAVUS_API_KEY=other-fixture',saved)
            self.assertGreaterEqual(len(m.env_value(saved,'CONTENT_RAG_TOKEN')),32)
            self.assertNotIn('fixture-private-key',stdout.getvalue());self.assertTrue((root/'.local/content-rag/vectordb/chroma.sqlite3').exists())
    def test_configured_managed_vector_is_not_silently_replaced(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);original='UPSTASH_VECTOR_REST_URL=https://fixture.example\n';(root/'.env').write_text(original)
            with patch.object(m,'ROOT',root),patch.object(sys,'argv',['setup']),patch.dict(os.environ,{},clear=True),self.assertRaises(ValueError):m.main()
            self.assertEqual((root/'.env').read_text(),original)

if __name__=='__main__':unittest.main()
