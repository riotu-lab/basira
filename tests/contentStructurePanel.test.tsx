import React from 'react';
import {afterEach,it,expect} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ContentStructurePanel} from '../src/ContentStructurePanel';
afterEach(cleanup);
it('lets reviewers select a passage without conflating its claim with a source',()=>{
 render(<ContentStructurePanel lang="en" value={{morePossible:false,items:[{id:'1',unitId:'a',passage:'Quran quotation.',evidence:'Quran quotation.',reasoning:'',conclusion:'',class:'quran',start:0,end:16},{id:'2',unitId:'a',passage:'An unsupported claim.',evidence:'',reasoning:'',conclusion:'An unsupported claim.',class:'other',start:17,end:38}]}}/>);
 fireEvent.click(screen.getByRole('button',{name:/2 · Other/}));
 expect(screen.getByRole('button',{name:/2 · Other/})).toHaveAttribute('aria-pressed','true');
 expect(document.querySelector('dl>div')!).toHaveTextContent('Not explicitly stated');
 expect(screen.getByText(/Sources not yet verified/)).toBeVisible();
});
