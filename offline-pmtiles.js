/* BoatGPS prototype: locally stored PMTiles backed by IndexedDB + HTTP Range fetch adapter. */
(() => {
 const status = () => document.getElementById('map-import-status');
 const DB_NAME='boatgps-offline-v1', STORE='files', KEY='Chicago.pmtiles';
 const openDB=()=>new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,1);
   req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
   req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
 });
 const getFile=async()=>{
   const db=await openDB();
   return new Promise((resolve,reject)=>{
     const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(KEY);
     req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
     tx.oncomplete=()=>db.close();
   });
 };
 const saveFile=async(file)=>{
   const db=await openDB();
   return new Promise((resolve,reject)=>{
     const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(file,KEY);
     tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);
     tx.onabort=()=>reject(tx.error||new Error('Storage transaction aborted'));
   });
 };
 const removeFile=async()=>{
   const db=await openDB();
   return new Promise((resolve,reject)=>{
     const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(KEY);
     tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);
   });
 };
 let selected=null;
 let resolveReady,rejectReady;
 window.boatMapReady=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async function(resource,init={}){
   const raw=(typeof resource==='string')?resource:resource.url;
   const path=new URL(raw,location.href).pathname;
   if(!path.endsWith('/Chicago.pmtiles')) return nativeFetch(resource,init);
   if(!selected) throw new Error('Offline PMTiles map not imported');
   const headers=new Headers((init&&init.headers)||(resource instanceof Request?resource.headers:undefined));
   const range=headers.get('range');
   const size=selected.size;
   if(!range) return new Response(selected,{status:200,headers:{'Content-Length':String(size),'Accept-Ranges':'bytes','Content-Type':'application/octet-stream'}});
   const m=/^bytes=(\d+)-(\d*)$/i.exec(range);
   if(!m) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
   const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),size-1):size-1;
   if(start>=size||end<start) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
   const blob=selected.slice(start,end+1);
   return new Response(blob,{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(blob.size),'Accept-Ranges':'bytes','Content-Type':'application/octet-stream'}});
 };
 document.addEventListener('DOMContentLoaded',async()=>{
   const picker=document.getElementById('pmtiles-file');
   const clear=document.getElementById('map-clear');
   try {
     selected=await getFile();
     if(selected){status().textContent=`Saved map found (${(selected.size/1048576).toFixed(1)} MB). Loading…`;resolveReady();}
     else status().textContent='Choose Chicago.pmtiles to import it. Import may take time.';
   } catch(e){status().textContent='Safari storage unavailable: '+e.message;rejectReady(e);}
   picker.addEventListener('change',async()=>{
     const file=picker.files[0];if(!file)return;
     if(!file.name.toLowerCase().endsWith('.pmtiles')){status().textContent='Please choose a .pmtiles file.';return;}
     status().textContent=`Saving ${(file.size/1048576).toFixed(1)} MB to Safari storage…`;
     try {await saveFile(file);selected=file;status().textContent='Map saved. Loading…';resolveReady();}
     catch(e){status().textContent='Could not save map: '+e.message;}
   });
   clear.addEventListener('click',async()=>{if(!confirm('Remove the offline map from Safari storage?'))return;await removeFile();location.reload()});
 });
 if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline shell installation:',e));
})();
