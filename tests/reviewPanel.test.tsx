import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ReviewPanel} from '../src/ReviewPanel';
import {SOURCES} from '../src/domain';
afterEach(cleanup);
it.each(['ar','en'] as const)('shows a calm recovery state with an actionable next step (%s)',lang=>{
 const reset=vi.fn();
 const journey={recordSources:SOURCES,attempt:{mode:'ai',turns:[{id:'a',role:'user',text:'الإيمان يعطي معنى للحياة',at:1}],feedback:{findings:[],summary:'Playback is unconfirmed.',status:'insufficient_delivery'}},reset,latency:null};
 const view=render(<ReviewPanel lang={lang} journey={journey as any}/>);
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(view.container.querySelector('.review-error')).toBeNull();
 expect(screen.getByRole('status')).toHaveTextContent('Playback is unconfirmed.');
 fireEvent.click(screen.getByRole('button',{name:lang==='ar'?'ابدأ محاولة جديدة':'Start a new attempt'}));expect(reset).toHaveBeenCalledOnce();
});
it('retains a visible explanation and retry when evidence validation fails',()=>{
 const retryReview=vi.fn();const journey={recordSources:SOURCES,attempt:{mode:'ai',turns:[{id:'a',role:'user',text:'My answer',at:1}]},reviewError:'invalid_model_evidence',retryReview,reset:vi.fn(),latency:null};
 render(<ReviewPanel lang="en" journey={journey as any}/>);
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('could not connect');
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(retryReview).toHaveBeenCalledOnce();
});
