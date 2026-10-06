import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {Landing} from '../src/Landing';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
it('opens each app workflow, switches RTL/LTR, and makes no service requests',()=>{
 const request=vi.fn();vi.stubGlobal('fetch',request);
 render(<Landing/>);
 expect(document.documentElement.dir).toBe('rtl');
 expect(screen.getAllByRole('link',{name:/ابدأ المناقشة/})[0]).toHaveAttribute('href','/?app=training&lang=ar');
 expect(screen.getAllByRole('link',{name:/راجع محتواك/})[0]).toHaveAttribute('href','/?app=content&lang=ar');
 fireEvent.click(screen.getByRole('button',{name:'لغة الواجهة'}));
 expect(document.documentElement.dir).toBe('ltr');
 expect(screen.getAllByRole('link',{name:/Start training/})[0]).toHaveAttribute('href','/?app=training&lang=en');
 expect(screen.getAllByRole('link',{name:/Review your content/})[0]).toHaveAttribute('href','/?app=content&lang=en');
 expect(request).not.toHaveBeenCalled();
});
it('honors an English landing link',()=>{
 window.history.replaceState({},'','/?lang=en');render(<Landing/>);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Thoughtful words.');
});
