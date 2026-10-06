import {setTimeout as delay} from 'node:timers/promises';
import {SPOKEN_TURN_SETTLE_MS} from '../src/conversationTiming.js';
// Tavus can cancel a pending response when the learner resumes. Do no model work during this grace period.
export async function settleSpokenTurn(signal:AbortSignal){
 await delay(SPOKEN_TURN_SETTLE_MS,undefined,{signal});
}
