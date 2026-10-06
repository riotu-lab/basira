// @vitest-environment node
import {it,expect} from 'vitest';
import {settleSpokenTurn} from '../server/spokenTurn';
it('cancels the grace period without waiting or invoking a model',async()=>{
 const controller=new AbortController();const wait=settleSpokenTurn(controller.signal);controller.abort();
 await expect(wait).rejects.toMatchObject({name:'AbortError'});
});
