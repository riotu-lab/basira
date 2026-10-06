import {it,expect} from 'vitest';
import {LiveUtterances,displayUtterances} from '../src/liveUtterances';
const event=(speech:string,index=0,role='user',final=false)=>({event_type:'conversation.utterance.streaming',inference_id:'turn1',properties:{speech,content_index:index,role,final}});
it('uses accumulated corrected hypotheses, strips analysis and ignores old/duplicate chunks',()=>{
 const s=new LiveUtterances();s.update(event('<user_audio_analysis>loud</user_audio_analysis>أنا أعتقد'),[]);s.update(event('أنا أرى أن',2),[]);s.update(event('قديم',1),[]);expect(s.entries).toHaveLength(1);expect(s.entries[0].text).toBe('أنا أرى أن');expect(s.entries[0].final).toBe(false);
 s.update(event('أنا أرى أن الحوار مفيد.',3,'user',true),[]);s.update(event('متأخر',4),[]);expect(s.entries[0].text).toBe('أنا أرى أن الحوار مفيد.');
 const turns:any[]=[{id:'canonical',role:'user',text:s.entries[0].text}];expect(displayUtterances(turns,s.entries)).toHaveLength(1);expect(turns[0].text).not.toContain('analysis');
});
it('merges a streamed avatar reply into its canonical turn and deduplicates legacy role aliases',()=>{
 const s=new LiveUtterances(),turns:any[]=[{id:'reply',role:'assistant',text:'A full question?'}];s.update(event('A full',0,'pal'),turns);s.update(event('A full',0,'replica'),turns);
 expect(s.entries).toHaveLength(1);expect(displayUtterances(turns,s.entries)).toHaveLength(1);expect(displayUtterances(turns,s.entries)[0].text).toBe('A full');
 s.update({...event('A full question?',0,'pal'),event_type:'conversation.utterance'},turns);expect(s.entries[0].final).toBe(false);
 s.interruptAssistant();s.update(event('A full question?',1,'pal',true),turns);expect(displayUtterances(turns,s.entries)[0].text).toBe('A full question?');expect(displayUtterances(turns,s.entries)[0].interrupted).toBe(true);
});
it('keeps partial text display-only and reconciles final user events without creating extra turns',()=>{
 const s=new LiveUtterances(),turns:any[]=[{id:'q',role:'assistant',text:'Question?'}];s.update(event('My tentative'),turns);expect(displayUtterances(turns,s.entries)).toHaveLength(2);expect(turns).toHaveLength(1);
 s.update({...event('My final answer',0),event_type:'conversation.utterance'},turns);turns.push({id:'a',role:'user',text:'My final answer'});expect(displayUtterances(turns,s.entries)).toHaveLength(2);
});
