// Explicit mapping: a developer's DEV URL, PAL or local storage can never be deployed.
export function productionTrainingValues(local){
  const url=local.BASIRA_PUBLIC_URL_PROD||local.BASIRA_PUBLIC_URL;
  const pal=local.TAVUS_TRAINING_PAL_ID_PROD||local.TAVUS_TRAINING_PAL_ID;
  if(!url&&!pal)return {};
  if(!url||!pal)throw Error('Both production training URL and PAL ID are required.');
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error('Production training URL must be an HTTPS origin.');
  if(url===local.BASIRA_PUBLIC_URL_DEV||pal===local.TAVUS_TRAINING_PAL_ID_DEV||/\.(ngrok-free\.(app|dev)|ngrok\.app|trycloudflare\.com)$/.test(parsed.hostname))throw Error('Refusing to deploy a development callback or PAL to production.');
  return {BASIRA_ENV:'production',BASIRA_PUBLIC_URL_PROD:parsed.origin,TAVUS_TRAINING_PAL_ID_PROD:pal,TRAINING_STORE:'redis'};
}
