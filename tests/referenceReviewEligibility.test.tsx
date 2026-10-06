import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ReferenceReview} from '../src/ReferenceReview';
import type {ReferenceRecord} from '../src/referencePracticeTypes';
afterEach(cleanup);
it.each(['ar','en'] as const)('flags saved invalid findings instead of presenting missing points (%s)',lang=>{
 const record:ReferenceRecord={id:'r',language:lang,question:{id:'5df09cbb8ae4433656d7',tradition:'atheism',status:'draft_requires_human_review',question:{ar:'سؤال',en:'Question'},answer:{ar:'مرجع',en:'Reference'},points:[{id:'p',text:{ar:'نقطة غير صالحة',en:'Invalid criterion'}}],source:{title:'Source',author:'Author',url:'https://example.com',pages:'1',excerpt:'Excerpt'}},attempts:[{id:'a',at:1,answer:'صدقت، شكراً لك.',assessment:{verdict:'partial',spokenFeedback:'Obsolete coaching',points:[{id:'p',status:'missing',answerQuote:'',explanation:'Obsolete finding'}]}}]};
 render(<ReferenceReview record={record} lang={lang} disabled={false} onRetry={vi.fn()}/>);
 expect(screen.getByRole('heading')).toHaveTextContent(lang==='ar'?'هذه الملاحظة لا تُستخدم لتقييمك':'This finding is excluded');
 expect(screen.queryByText('Obsolete coaching')).not.toBeInTheDocument();expect(screen.queryByText('Obsolete finding')).not.toBeInTheDocument();expect(screen.getByText('صدقت، شكراً لك.')).toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
