import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {CameraPreview} from '../src/CameraPreview';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('requests only video and stops camera tracks on toggle and unmount (mocked media)',async()=>{
 const stop=vi.fn(),stream={getTracks:()=>[{stop}]};const getUserMedia=vi.fn(async()=>stream);
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
 const view=render(<CameraPreview lang="en"/>);
 fireEvent.click(screen.getByRole('button',{name:'Turn camera on'}));
 await screen.findByText('Camera preview only · not sent to the conversation');
 expect(getUserMedia).toHaveBeenCalledWith({video:{facingMode:'user'},audio:false});
 fireEvent.click(screen.getByRole('button',{name:'Turn camera off'}));expect(stop).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Turn camera on'}));await screen.findByText('Camera preview only · not sent to the conversation');
 view.unmount();expect(stop).toHaveBeenCalledTimes(2);
});
it('stops a delayed permission result after the control is unmounted',async()=>{
 const stop=vi.fn();let resolve!:(value:any)=>void;
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r;})}});
 const view=render(<CameraPreview lang="en"/>);fireEvent.click(screen.getByRole('button',{name:'Turn camera on'}));view.unmount();
 resolve({getTracks:()=>[{stop}]});await waitFor(()=>expect(stop).toHaveBeenCalled());
});
