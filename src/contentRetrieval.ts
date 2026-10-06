export type RetrievedPassage={id:string;text:string;truncated:boolean;source:'aqeeda'|'fiqh'|'tafsir'|'quran';locator:string;distance:number|null;provenance:'unverified'|'identified';reference?:import('./contentReviewTypes').Reference;licenseUrl?:string};
export type ContentRetrieval={at:string;items:{itemId:string;query:string;candidates:RetrievedPassage[]}[];status:'candidates_only'};
