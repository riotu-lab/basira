import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ArgumentReviewPanel} from '../src/ArgumentReviewPanel';
import type {ArgumentReport} from '../src/argumentReviewTypes';
afterEach(cleanup);
for(const lang of ['ar','en'] as const)it(`${lang}: shows actual retrieval status without making an outage a claim verdict`,()=>{
 const report:ArgumentReport={items:[],summary:'Fixture summary',retrieval:'local_quran_only',incomplete:true,retrievalStatuses:[{provider:'turath',status:'failed',error:'network_dns'},{provider:'islamic_content',status:'no_evidence'}]};
 render(<ArgumentReviewPanel report={report} lang={lang} onChange={vi.fn()} onSeek={vi.fn()}/>);
 expect(screen.getByText(lang==='ar'?/تعذّر استرجاع المراجع/:/Reference retrieval unavailable/)).toBeVisible();
 expect(screen.getByText(lang==='ar'?/لا يعني أن الادعاء خطأ/:/does not establish falsehood/)).toBeVisible();
 expect(screen.queryByText(/network_dns/)).not.toBeInTheDocument();
});
