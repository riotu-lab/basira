import {it,expect} from 'vitest';
import {spokenText} from '../src/providerSpeech';
import {VideoTranscript} from '../src/videoTranscript';
it('removes known complete or truncated analysis blocks but preserves actual words',()=>{
 expect(spokenText('<user_audio_analysis>tone</user_audio_analysis> مهما أُفسدت الفطرة.')).toBe('مهما أُفسدت الفطرة.');
 expect(spokenText('My words. <user_audio_analysis>partial')).toBe('My words.');
 expect(spokenText('I wrote <example> and 2 < 3.')).toBe('I wrote <example> and 2 < 3.');
 expect(spokenText('<user_video_analysis>appearance</user_video_analysis>Answer')).toBe('Answer');
});
it('does not render annotation-only utterances or save annotations in legacy transcripts',()=>{
 const t=new VideoTranscript();const e={message_type:'conversation',event_type:'conversation.utterance',inference_id:'1',properties:{role:'user',speech:'<user_audio_analysis>tone</user_audio_analysis>'}};
 t.handle(e);expect(t.turns).toHaveLength(0);
 t.handle({...e,properties:{...e.properties,speech:e.properties.speech+' My answer.'}});expect(t.turns[0].text).toBe('My answer.');
});
