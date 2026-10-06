// Mocked Web Animations API lifecycle checks, not visual browser tests.
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,cleanup} from '@testing-library/react';
import {useSwitchMotion} from '../src/useSwitchMotion';
function Preview({mode,enabled=true}:{mode:string;enabled?:boolean}){
 const ref=useSwitchMotion(mode,enabled,true);
 return <div ref={ref}><button>Mode</button><video/><span>{mode}</span></div>;
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();delete (Element.prototype as any).animate;});
it('animates switches without remounting media or losing control focus and cancels on rapid switching',()=>{
 const cancel=vi.fn(),animate=vi.fn(()=>({cancel}));
 Element.prototype.animate=animate as any;
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 const view=render(<Preview mode="ai"/>);
 const video=view.container.querySelector('video'),button=view.getByRole('button');
 button.focus();expect(animate).not.toHaveBeenCalled();
 view.rerender(<Preview mode="demo"/>);
 expect(animate).toHaveBeenCalledTimes(1);
 expect(document.activeElement).toBe(button);
 expect(view.container.querySelector('video')).toBe(video);
 view.rerender(<Preview mode="text"/>);
 expect(cancel).toHaveBeenCalledTimes(1);
 view.rerender(<Preview mode="text" enabled={false}/>);
 expect(cancel).toHaveBeenCalledTimes(2);
 expect(animate).toHaveBeenCalledTimes(2);
});
it('does not animate when reduced motion is requested',()=>{
 const animate=vi.fn();Element.prototype.animate=animate;
 vi.stubGlobal('matchMedia',()=>({matches:true}));
 const view=render(<Preview mode="ai"/>);
 view.rerender(<Preview mode="demo"/>);
 expect(animate).not.toHaveBeenCalled();
});
it('interpolates a change in settings height',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 const animate=vi.fn((_frames:Keyframe[],_options:KeyframeAnimationOptions)=>({cancel:vi.fn()}));Element.prototype.animate=animate as any;
 let height=240;
 vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(()=>({height} as DOMRect));
 const view=render(<Preview mode="ai"/>);
 height=100;view.rerender(<Preview mode="demo"/>);
 expect(animate.mock.calls[1]?.[0]).toEqual([
  {height:'240px',overflow:'clip'},{height:'100px',overflow:'clip'},
 ]);
});
