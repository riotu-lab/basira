import {describe,it,expect} from 'vitest';
import {validateVisualEditorial} from '../server/visualEditorial';
const frames=[{id:'frame-1',at:0,image:'data:image/png;base64,AA',text:''},{id:'frame-2',at:12,image:'data:image/png;base64,AA',text:''}];
const result=()=>({summary:'Improve the contrast before publishing.',descriptions:frames.map(f=>({frameId:f.id,description:'A pale caption over a light background.'})),findings:[{aspect:'readability',status:'attention',observation:'Low contrast caption.',reasoning:'It may be hard to read on a phone.',suggestion:'Darken the caption.',frameIds:['frame-2']}]});
describe('visual editorial evidence boundaries',()=>{
 it('binds observations to the supplied frames and initializes human decisions',()=>{const r=validateVisualEditorial(result(),frames,'video',14);expect(r.frames).toEqual(frames);expect(r.findings[0]).toMatchObject({frameIds:['frame-2'],decision:'pending',reviewerNote:''});});
 it.each(['missing','duplicate','unknown'])('rejects %s frame descriptions',kind=>{const r=result();if(kind==='missing')r.descriptions.pop();else r.descriptions[1].frameId=kind==='duplicate'?'frame-1':'invented';expect(()=>validateVisualEditorial(r,frames,'video')).toThrow();});
 it('rejects fabricated visual evidence',()=>{const r=result();r.findings[0].frameIds=['invented'];expect(()=>validateVisualEditorial(r,frames,'video')).toThrow();});
 it('requires a useful action and reasoning for a publication concern',()=>{const r=result();r.findings[0].suggestion='';expect(()=>validateVisualEditorial(r,frames,'video')).toThrow();r.findings[0].suggestion='Darken';r.findings[0].reasoning='';expect(()=>validateVisualEditorial(r,frames,'video')).toThrow();});
 it('rejects unsupported verdict categories',()=>{const r=result();r.findings[0].aspect='religious_approval';expect(()=>validateVisualEditorial(r,frames,'video')).toThrow();});
 it('allows no findings without manufacturing an issue',()=>{const r=result();r.findings=[];expect(validateVisualEditorial(r,frames,'video').findings).toEqual([]);});
});
