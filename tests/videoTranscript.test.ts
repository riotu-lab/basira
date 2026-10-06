import {it,expect} from 'vitest';
import {VideoTranscript} from '../src/videoTranscript';
const event=(type:string,role='pal',extra={})=>({message_type:'conversation',event_type:`conversation.${type}`,inference_id:'one',properties:{role,speech:'Hello',...extra}});
it('deduplicates legacy PAL events and retains final user utterances',()=>{
 const t=new VideoTranscript();t.handle(event('utterance'));t.handle(event('utterance','replica'));
 expect(t.turns).toHaveLength(1);expect(t.turns[0].delivery).toBe('uncertain');
 t.handle(event('utterance','user'));expect(t.turns).toHaveLength(2);
});
it('requires start and explicit uninterrupted completion; handles event order',()=>{
 const t=new VideoTranscript();t.handle(event('started_speaking'));t.handle(event('stopped_speaking','pal',{interrupted:false}));t.handle(event('utterance'));
 expect(t.turns[0].delivery).toBe('complete');
});
it('never treats manual interruption as complete even if a later event says complete',()=>{
 const t=new VideoTranscript();t.handle(event('started_speaking'));t.interrupt();t.handle(event('stopped_speaking','pal',{interrupted:false}));t.handle(event('utterance'));
 expect(t.turns[0].delivery).toBe('uncertain');
});
it('ignores partial text, perception events and malformed utterances',()=>{
 const t=new VideoTranscript();t.handle(event('utterance.streaming'));t.handle(event('utterance','pal',{speech:undefined}));t.handle(event('perception_analysis'));expect(t.turns).toHaveLength(0);
});

it('retains typed answers exactly once when the provider echoes them repeatedly',()=>{const t=new VideoTranscript();t.recordTyped('My answer');const e={message_type:'conversation',event_type:'conversation.utterance',inference_id:'echo',properties:{role:'user',speech:'My answer'}};t.handle(e);t.handle(e);expect(t.turns).toHaveLength(1);expect(t.turns[0].text).toBe('My answer');});
