BoatGPS iPad OFFLINE MAP PROTOTYPE (not yet a fully working boat navigation app)

Files included: Boat_map_iPad.html, offline-pmtiles.js, leaflet.js, protomaps-leaflet.js, sw.js, manifest.webmanifest.

REQUIRED ADDITIONAL FILE: Copy leaflet.css from your existing BoatGPS/leaflet folder into this folder. Leaflet icon images (marker-icon.png, marker-shadow.png) may also be needed for the marker; place those in an images/ folder or adjust CSS paths.

IMPORTANT: This prototype must initially be served from HTTPS to install as a Home Screen web app and cache its shell. Opening from Files/file:// will not install a service worker. Hosting details still need to be arranged.

After first launch on iPad Safari, use the file chooser to import Chicago.pmtiles from Files. The file is stored in Safari IndexedDB, and byte-range requests are served by an in-page adapter rather than Python. Storage may be limited or evicted by iPadOS. Test offline restart and zoom thoroughly.

KNOWN BLOCKER: Safari HTTPS pages generally cannot fetch http://192.168.4.1/gps and /log because of mixed-content restrictions. This prototype is a MAP-ONLY architecture test; live GPS/recorded trip are not yet guaranteed to work. We will address GPS transport separately after proving local PMTiles rendering.

No ESP32 firmware changes have been made. Keep original Split View system as fallback.
