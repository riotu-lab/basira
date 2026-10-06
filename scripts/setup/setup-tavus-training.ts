// Only the explicitly selected environment is configured. Existing Echo/FULL PALs are untouched.
import 'dotenv/config';
import {configureTrainingPal,saveEnvValues} from './training-pal.js';
const index=process.argv.indexOf('--environment'),environment=index>=0?process.argv[index+1]:'development';
if(!['development','production','preview'].includes(environment))throw Error('Use --environment development, production or preview.');
try{
 const result=await configureTrainingPal({...process.env,VERCEL:undefined,BASIRA_ENV:environment},process.argv.includes('--update'));
 saveEnvValues({[result.key]:result.palId});
 console.log(`${result.environment} training PAL saved in .env. Restart that backend. No live session started and no other PAL changed.`);
}catch(e){console.error(e instanceof Error?e.message:'Training configuration failed.');process.exitCode=1;}
