import {retainMedia,rememberMedia,restoreMedia,deleteCloudMedia,saveMediaMetadata,type MediaReference} from './retainedMedia';
import type {ContentReport} from './contentReviewTypes';
export type StoredReport={report:ContentReport;media?:Blob;mediaRef?:MediaReference};
const DB='basira-content-review-v1';const deleted=new Set<string>();
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('reports',{keyPath:'report.id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('storage_blocked'));});}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('reports',mode),request=action(tx.objectStore('reports'));
  tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||request.error||Error('storage_failed'));};
 });
}
export async function saveReport(report:ContentReport,media?:Blob){const old=await transaction<StoredReport|undefined>('readonly',s=>s.get(report.id));if(media)rememberMedia(media,old?.mediaRef);let mediaRef=old?.mediaRef;if(deleted.has(report.id))return;await transaction('readwrite',s=>s.put({report:structuredClone(report),media,mediaRef}));try{if(media&&!mediaRef)mediaRef=await retainMedia(media,{workflow:'content',reportId:report.id})||undefined;await saveMediaMetadata(mediaRef,report);}finally{if(deleted.has(report.id)){await deleteCloudMedia(mediaRef);}else await transaction('readwrite',s=>s.put({report:structuredClone(report),media,mediaRef}));}}
export const listReports=async()=> (await transaction<StoredReport[]>('readonly',s=>s.getAll())).map(v=>v.report).sort((a,b)=>b.createdAt-a.createdAt);
export async function getReport(id:string){const row=await transaction<StoredReport|undefined>('readonly',s=>s.get(id));if(row?.media)rememberMedia(row.media,row.mediaRef);else if(row?.mediaRef&&row.mediaRef.expires>Date.now())row.media=await restoreMedia(row.mediaRef);return row;}
export async function deleteReport(id:string){deleted.add(id);const row=await transaction<StoredReport|undefined>('readonly',s=>s.get(id));await deleteCloudMedia(row?.mediaRef);return transaction('readwrite',s=>s.delete(id));}
