import 'dotenv/config';
import {readFile,writeFile} from 'node:fs/promises';
import {ModelProvider} from '../../server/model.js';
import {validateBookPages,validateBookDrafts} from '../../server/bookDrafts.js';
// Explicit local input only. Never downloads books or promotes drafts into the live bank.
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node --import tsx scripts/sources/draft-book-questions.ts INPUT.json OUTPUT.json');process.exit(1);}
try{
 const book=validateBookPages(JSON.parse(await readFile(input,'utf8')));
 const model=new ModelProvider(process.env);if(!model.ready)throw Error('Configured text model credentials are missing; set them in .env');
 // Reserve output before any paid request, and never overwrite an existing file.
 await writeFile(output,JSON.stringify({version:1,status:'draft',questions:[],completedPages:0}),{flag:'wx'});
 const questions:unknown[]=[];
 for(const [index,page] of book.pages.entries()){
  const result=await model.draftBookQuestions(page.text,AbortSignal.timeout(60000),book.tradition);
  questions.push(...validateBookDrafts(result,book,page));
  await writeFile(output,JSON.stringify({version:1,status:'draft',questions,completedPages:index+1,totalPages:book.pages.length},null,2)+'\n');
  console.log(JSON.stringify({completedPages:index+1,totalPages:book.pages.length,draftQuestions:questions.length}));
 }
}catch(error){console.error(error instanceof Error?error.message:'Draft extraction failed');process.exitCode=1;}
