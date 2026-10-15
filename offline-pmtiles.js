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
 // PMTiles v3 header contains bounding coordinates and a recommended center.
 // Read only 127 bytes; never load the complete map into JavaScript memory.
 async function readGeography(file) {
   const bytes=await file.slice(0,127).arrayBuffer();
   if(bytes.byteLength<127) throw new Error('PMTiles header is too short');
   const view=new DataView(bytes);
   const magic=String.fromCharCode(...new Uint8Array(bytes,0,7));
   if(magic!=='PMTiles' || view.getUint8(7)!==3)
     throw new Error('Expected a PMTiles version 3 file');
   const minLon=view.getInt32(102,true)/1e7;
   const minLat=view.getInt32(106,true)/1e7;
   const maxLon=view.getInt32(110,true)/1e7;
   const maxLat=view.getInt32(114,true)/1e7;
   const centerZoom=view.getUint8(118);
   const centerLon=view.getInt32(119,true)/1e7;
   const centerLat=view.getInt32(123,true)/1e7;
   const valid=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
   if(!valid(minLat,minLon)||!valid(maxLat,maxLon)||minLat>maxLat||minLon>maxLon)
     throw new Error('Invalid PMTiles geographic bounds');
   const lat=valid(centerLat,centerLon)?centerLat:(minLat+maxLat)/2;
   const lon=valid(centerLat,centerLon)?centerLon:(minLon+maxLon)/2;
   return {lat,lon,zoom:Math.max(0,Math.min(15,centerZoom))};
 }
 document.addEventListener('DOMContentLoaded',async()=>{
   const picker=document.getElementById('pmtiles-file');
   const clear=document.getElementById('map-clear');
   picker.addEventListener('change',async()=>{
     const file=picker.files[0];if(!file)return;
     if(!file.name.toLowerCase().endsWith('.pmtiles')){status().textContent='Please choose a .pmtiles file.';return;}
     status().textContent=`Checking and saving ${file.name} (${(file.size/1048576).toFixed(1)} MB)…`;
     try {
       await readGeography(file);
       await saveFile(file);
       // Reload so Protomaps reads the new PMTiles header and clears its tile cache.
       sessionStorage.setItem('boatgps-open-imported','1');
       location.reload();
     } catch(e){status().textContent='Could not import map: '+e.message;}
   });
   clear.addEventListener('click',async()=>{
     if(!confirm('Remove the saved offline map from browser storage?'))return;
     try {await removeFile();sessionStorage.removeItem('boatgps-open-imported');location.reload();}
     catch(e){status().textContent='Could not remove map: '+e.message;}
   });
   try {
     selected=await getFile();
     if(selected){
       window.boatMapGeography=await readGeography(selected);
       window.boatMapOpenImported=sessionStorage.getItem('boatgps-open-imported')==='1';
       sessionStorage.removeItem('boatgps-open-imported');
       status().textContent=`Saved map active (${(selected.size/1048576).toFixed(1)} MB).`;
       resolveReady();
     } else {
       status().textContent='No offline map saved. Choose a .pmtiles file to display a map.';
     }
   } catch(e){status().textContent='Offline map storage error: '+e.message;rejectReady(e);}
 });
 if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline shell installation:',e));
})();
