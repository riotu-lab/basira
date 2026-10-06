import {beforeEach,describe,expect,it,vi,afterEach} from 'vitest';
import {SOURCES} from '../src/domain';
import {saveSession,loadSessions,deleteSession,deleteAllSessions,type SavedSession} from '../src/sessionStore';
const record:SavedSession={id:'one',updatedAt:1,language:'ar',mode:'ai',finished:false,turns:[{id:'q',role:'assistant',text:'سؤال',at:1,delivery:'pending'}],attempt:null,practice:null,comparison:null,selected:null,sources:structuredClone(SOURCES)};
beforeEach(()=>localStorage.clear());
afterEach(()=>vi.restoreAllMocks());
describe('Browser learning record persistence (no live services)',()=>{
  it('recovers transcripts and source snapshots while treating interrupted playback as uncertain',()=>{
    saveSession(record);const restored=loadSessions()[0];
    expect(restored.turns[0]).toMatchObject({text:'سؤال',delivery:'uncertain',interrupted:true});
    expect(restored.sources).toEqual(SOURCES);
  });
  it('serializes only learning fields and preserves unrelated browser storage on deletion',()=>{
    localStorage.setItem('unrelated','keep');
    saveSession({...record,OPENAI_API_KEY:'must-not-persist',livekitToken:'must-not-persist'} as SavedSession);
    expect(localStorage.getItem('basira.sessions.v1')).not.toContain('must-not-persist');
    saveSession({...record,id:'two'});deleteSession('one');expect(loadSessions().map(s=>s.id)).toEqual(['two']);
    deleteAllSessions();expect(loadSessions()).toEqual([]);expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it('deleting an original also deletes retry copies while retaining unrelated sessions',()=>{
    const original={id:'original-attempt',language:'ar' as const,mode:'demo' as const,turns:[{id:'q',role:'assistant' as const,text:'سؤال',at:1},{id:'a',role:'user' as const,text:'إجابة',at:2}]};
    const finding={id:'demo',criterion:'respect' as const,observation:'',suggestion:'',evidence:{turnId:'a',quote:'إجابة'},questionTurnId:'q',sourceId:'quran-16-125' as const};
    saveSession({...record,mode:'demo',finished:true,attempt:original,turns:original.turns});
    saveSession({...record,id:'retry',mode:'demo',practice:{original,finding,question:original.turns[0]}});
    saveSession({...record,id:'unrelated'});
    deleteSession('one');expect(loadSessions().map(s=>s.id)).toEqual(['unrelated']);
  });
  it('surfaces quota failures instead of pretending records are saved',()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Quota exceeded','QuotaExceededError');});
    expect(()=>saveSession(record)).toThrow();
  });
  it('rejects corrupted archives and injected source URLs',()=>{
    localStorage.setItem('basira.sessions.v1','not json');expect(()=>loadSessions()).toThrow();
    localStorage.clear();
    expect(()=>saveSession({...record,sources:[{...SOURCES[0],url:'javascript:alert(1)'}]})).toThrow();
  });
});

it('preserves limited wording feedback without upgrading uncertain question delivery',()=>{
 const turns=[...record.turns,{id:'answer',role:'user' as const,text:'أحاول مساعدة الآخرين.',at:2}];
 const feedback={status:'wording_only' as const,findings:[],summary:'مراجعة الكلمات فقط',wording:{turnId:'answer',quote:'مساعدة الآخرين',suggestion:'أضف مثالًا من يومك.'}};
 saveSession({...record,turns,attempt:{id:'attempt',language:'ar',mode:'ai',turns,feedback}});
 const stored=loadSessions()[0];
 expect(stored.attempt?.feedback).toEqual(feedback);
 expect(stored.attempt?.turns[0].delivery).toBe('uncertain');
});
