import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {useTranscriptScroll} from '../src/useTranscriptScroll';
const scroll=vi.fn();
function Transcript({count=1,visible=true}:{count?:number;visible?:boolean}){
 const {transcript,onScroll}=useTranscriptScroll(count,'listening',visible);
 return visible?<div data-testid="transcript" ref={transcript} onScroll={onScroll}/>:null;
}
beforeEach(()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 Element.prototype.scrollTo=scroll;scroll.mockClear();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps earlier messages in place until the reader returns to the bottom',()=>{
 const view=render(<Transcript/>),el=view.getByTestId('transcript');
 Object.defineProperties(el,{scrollHeight:{value:1000},clientHeight:{value:200},scrollTop:{value:100,writable:true}});
 fireEvent.scroll(el);scroll.mockClear();
 view.rerender(<Transcript count={2}/>);
 expect(scroll).not.toHaveBeenCalled();
 el.scrollTop=800;fireEvent.scroll(el);
 view.rerender(<Transcript count={3}/>);
 expect(scroll).toHaveBeenCalledWith({top:1000,behavior:'smooth'});
});
it('uses instant scrolling for reduced motion',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));
 render(<Transcript/>);
 expect(scroll).toHaveBeenCalledWith({top:0,behavior:'instant'});
});
it('resumes following when the transcript is reopened',()=>{
 const view=render(<Transcript/>),el=view.getByTestId('transcript');
 Object.defineProperties(el,{scrollHeight:{value:1000},clientHeight:{value:200}});
 fireEvent.scroll(el);
 view.rerender(<Transcript visible={false}/>);scroll.mockClear();
 view.rerender(<Transcript visible/>);
 expect(scroll).toHaveBeenCalledTimes(1);
});
