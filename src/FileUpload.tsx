import {useEffect,useRef,useState,type DragEvent} from 'react';
import {Upload} from 'lucide-react';
import type {Lang} from './content';

export function FileUpload({label,lang,accept,disabled,media=false,onFiles}:{
 label:string;lang:Lang;accept:string;disabled:boolean;media?:boolean;onFiles:(files:File[])=>void;
}){
 const [dragging,setDragging]=useState(false),depth=useRef(0);
 useEffect(()=>{if(disabled){depth.current=0;setDragging(false);}},[disabled]);
 const isFile=(event:DragEvent)=>Array.from(event.dataTransfer.types).includes('Files');
 return <label className={`upload-zone ${media?'media-upload':''} ${dragging?'dragging':''}`}
  onDragEnter={event=>{event.preventDefault();if(disabled||!isFile(event))return;depth.current++;setDragging(true);}}
  onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect=disabled||!isFile(event)?'none':'copy';}}
  onDragLeave={event=>{event.preventDefault();depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);}}
  onDrop={event=>{event.preventDefault();event.stopPropagation();depth.current=0;setDragging(false);if(!disabled)onFiles(Array.from(event.dataTransfer.files));}}>
   <Upload size={media?26:20}/><span>{label}</span>
   <small className="upload-hint">{dragging?(lang==='ar'?'أفلت الملف هنا':'Drop your file here'):(lang==='ar'?'اسحب ملفًا هنا أو اضغط للاختيار':'Drag a file here or click to browse')}</small>
   <input className="upload-input" type="file" aria-label={label} accept={accept} disabled={disabled}
    onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';onFiles(files);}}/>
 </label>;
}
