export const itemClasses={quran:{ar:'قرآن',en:'Quran'},hadith:{ar:'حديث',en:'Hadith'},fiqh:{ar:'فقه',en:'Fiqh'},other:{ar:'أخرى',en:'Other'}};
export type ContentTuple={id:string;unitId:string;passage:string;start:number;end:number;evidence:string;reasoning:string;conclusion:string;class:keyof typeof itemClasses};
export type ContentStructure={items:ContentTuple[];morePossible:boolean};
