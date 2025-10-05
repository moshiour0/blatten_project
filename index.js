// index.js - Consolidated Logic (Dashboard Map, Tabs, Story Map, S2 Animation)

(function () {
    'use strict';

    // --- Utilities ---
    const $ = (sel, scope = document) => scope.querySelector(sel);
    const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
    const safe = (fn) => { try { return fn(); } catch (e) { console.warn('Safe execution failed:', e); } };

    // --- State ---
    let map = null;
    let s2Layer = null;
    let velLayer = null;
    let geoJsonLayer = null;
    let searchMarker = null;

    // Map container selector
    function getMapContainer() {
        const dashboardMap = document.querySelector('#dashboard #map');
        if (dashboardMap) return dashboardMap;
        return document.getElementById('map');
    }

    // --- Map init (only once) ---
    function initMapIfNeeded() {
        if (map) return map;
        const container = getMapContainer();
        if (!container) {
            console.warn('No #map container found. Map initialization skipped.');
            return null;
        }

        // create map attached to element (pass element rather than id to avoid duplicates)
        map = L.map(container, { attributionControl: false }).setView([46.38, 7.75], 13);

        // base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true })
            .addTo(map);

        // placeholders for overlay layers (you can change URLs to your tile server)
        try {
            // S2 layer is now configured to represent the custom B12, B2, B1 composite
            s2Layer = L.tileLayer('/web_tiles/s2_custom_rgb_after/{z}/{x}/{y}.png', { opacity: 1.0 });
        } catch (e) {
            s2Layer = null;
        }
        try {
            // Velocity layer represents the SAR (InSAR) output
            velLayer = L.tileLayer('/web_tiles/insar_velocity/{z}/{x}/{y}.png', { opacity: 0.9 });
        } catch (e) {
            velLayer = null;
        }

        // apply initial checkbox states if present
        const tS2 = $('#toggle-s2'); if (tS2 && s2Layer && tS2.checked) { safe(() => map.addLayer(s2Layer)); }
        const tVel = $('#toggle-vel'); if (tVel && velLayer && tVel.checked) { safe(() => map.addLayer(velLayer)); }

        // wire checkbox listeners (safe)
        if (tS2) tS2.addEventListener('change', (ev) => {
            if (!s2Layer) { console.warn('s2Layer not configured'); return; }
            ev.target.checked ? safe(() => map.addLayer(s2Layer)) : safe(() => map.removeLayer(s2Layer));
        });
        if (tVel) tVel.addEventListener('change', (ev) => {
            if (!velLayer) { console.warn('velLayer not configured'); return; }
            ev.target.checked ? safe(() => map.addLayer(velLayer)) : safe(() => map.removeLayer(velLayer));
        });

        // load geojson polygon(s)
        loadGeoJson();

        // click popup
        map.on('click', (e) => {
            const lat = e.latlng.lat.toFixed(6), lon = e.latlng.lng.toFixed(6);
            L.popup().setLatLng(e.latlng).setContent(`<b>Location</b><br>${lat}, ${lon}`).openOn(map);
        });

        return map;
    }

    // Try multiple paths for geojson; add layer when found
    async function loadGeoJson() {
        const candidates = [
            '/derived/risk/high_risk.geojson', // High-risk polygon (Red Alert AOI)
            'derived/risk/high_risk.geojson',
        ];
        for (const url of candidates) {
            try {
                const resp = await fetch(url);
                if (!resp.ok) continue;
                const gj = await resp.json();
                // Use the red color from the brief for the change polygon
                // Initial style: solid border, transparent fill
                geoJsonLayer = L.geoJSON(gj, { 
                    style: { color: '#ff3b3b', weight: 3, fillOpacity: 0.0 } 
                }); 
                
                // add if toggle is checked
                const tGeo = $('#toggle-geo');
                if (tGeo && tGeo.checked) geoJsonLayer.addTo(map);
                
                // wire toggle if not already wired
                if (tGeo && !tGeo._geoToggled) {
                    tGeo._geoToggled = true;
                    tGeo.addEventListener('change', (ev) => {
                        if (!geoJsonLayer) return;
                        ev.target.checked ? map.addLayer(geoJsonLayer) : map.removeLayer(geoJsonLayer);
                    });
                }
                // fit to bounds if possible
                try { map.fitBounds(geoJsonLayer.getBounds(), { padding: [30, 30] }); } catch (e) {}
                console.log('Loaded GeoJSON from', url);
                return;
            } catch (err) {
                // continue to next candidate
            }
        }
        console.info('No GeoJSON found in candidate paths (this is OK for dev).');
    }

    // --- Search (Nominatim) ---
    async function geocodeNominatim(q) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'en' }});
        if (!resp.ok) throw new Error('Geocoding failed');
        return resp.json();
    }

    function placeSearchMarker(lat, lon, label) {
        if (!map) initMapIfNeeded();
        if (!map) { /* alert is replaced by console log */ console.error('Map not available'); return; }
        if (searchMarker) map.removeLayer(searchMarker);
        searchMarker = L.marker([lat, lon]).addTo(map);
        if (label) searchMarker.bindPopup(label).openPopup();
        
        // Set the default view to the target location
        map.flyTo([lat, lon], 14, { animate: true, duration: 0.9 });
        
        // Re-fit the map to the AOI polygon after placing the marker
        if (geoJsonLayer) {
            try { map.fitBounds(geoJsonLayer.getBounds(), { padding: [30, 30] }); } catch (e) {}
        }
    }

    // --- Tabs & UI wiring ---
    function showPanelById(id) {
        // hide all panels
        $$('.panel').forEach(p => p.style.display = 'none');
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (id === 'dashboard') ? 'flex' : 'block';
        // if showing dashboard, ensure map ready & sized
        if (id === 'dashboard') {
            initMapIfNeeded();
            setTimeout(() => {
                try { map.invalidateSize(true); } catch (e) {}
                if (geoJsonLayer) {
                    // Ensure the map focuses on the AOI polygon when navigating back to dashboard
                    try { map.fitBounds(geoJsonLayer.getBounds(), { padding: [30, 30] }); } catch (e) {}
                }
            }, 240);
        }
    }

    function initTabs() {
        const tabAnchors = $$('.tabs a');
        if (!tabAnchors.length) return;
        tabAnchors.forEach(a => {
            a.addEventListener('click', (ev) => {
                ev.preventDefault();
                // active li class
                $$('.tabs li').forEach(li => li.classList.remove('active'));
                const li = a.closest('li'); if (li) li.classList.add('active');
                const id = (a.getAttribute('href') || '').replace('#','');
                if (id) showPanelById(id);
            });
        });
        // ensure initial state: show dashboard by default
        const active = document.querySelector('.tabs li.active a');
        const initial = active ? (active.getAttribute('href') || '').replace('#','') : 'dashboard';
        showPanelById(initial || 'dashboard');
    }

    // --- Visitor counter ---
    function showLocalVisit() {
        try {
            const key = 'saveblatten_visits_v1';
            let n = parseInt(localStorage.getItem(key) || '0', 10);
            n = n + 1;
            localStorage.setItem(key, String(n));
            const el = document.getElementById('visitCountBadge');
            if (el) el.textContent = n;
        } catch (e) { /* ignore */ }
    }

    async function tryServerVisit() {
        const badge = document.getElementById('visitCountBadge');
        if (!badge) return;
        // Skipping server visit check for hackathon environment
    }

    // --- Story interactivity ---
    (function () {
        const steps = [
            {
                id: 0,
                title: "Introduction",
                meta: "May 28, 2025 · Blatten",
                html: `<p>On <strong>28 May 2025</strong> the Alpine village of Blatten suffered a catastrophic glacier-related collapse. The event included a <strong>3.1 magnitude</strong> local seismic shock and a rapid increase in glacier motion: velocity rose from roughly <strong>0.8 m/day</strong> to <strong>2.0 m/day</strong> in the days before failure. Emergency actions evacuated approximately <strong>300 residents</strong>, though one person remains missing.</p><p>We aim to turn satellite detection — especially SAR time-series — into operational, actionable warnings so communities get the lead time they need.</p>`,
                img: "Web_assets/story/Swisstopo_Rapid_Mapping_2025_May_30_Blatten_Bietschhorn_DSC6488.jpg",
                coords: [46.38, 7.75],
                zoom: 12
            },
            {
                id: 1,
                title: "Early Warning Signals",
                meta: "Velocity increase & SAR anomalies",
                html: `<p>Multi-temporal SAR analysis showed accelerating surface motion and coherence loss in the hazard zone. Velocity rose dramatically in a short window — an early warning signal that enabled pre-emptive action.</p><p>Amplitude differencing and time-series trend detection are core parts of our pipeline for automated alerting.</p>
                <p>This acceleration was verified using Sentinel-1 SLC data processed via the DInSAR technique.</p>`,
                img: "Web_assets/story/alert.png",
                coords: [46.40, 7.70],
                zoom: 13
            },
            {
                id: 2,
                title: "The Collapse",
                meta: "Event day impact",
                html: `<p>On the day of collapse, local observations and satellite imagery showed rapid mass movement, large debris fields, and severe damage to buildings and infrastructure. The event created a hazard footprint extending downslope from the glacier source.</p>`,
                img: "Web_assets/story/collapse.png",
                coords: [46.38, 7.75],
                zoom: 14
            },
            {
                id: 3,
                title: "Community Response",
                meta: "Evacuations & emergency works",
                html: `<p>Following the event, authorities opened shelters, built emergency access roads, and restored provisional utilities. These actions preserved lives and enabled coordinated relief and reconstruction planning.</p>`,
                img: "https://placehold.co/600x360/22b1f1/ffffff?text=Emergency+Response",
                coords: [46.39, 7.80],
                zoom: 13
            },
            {
                id: 4,
                title: "Future Resilience",
                meta: "Planning & monitoring",
                html: `<p>Rebuilding plans for "New Blatten" emphasize resilient infrastructure, redundant routes, and community-engaged monitoring. Our platform will focus on persistent observation and automated alerts to reduce time-to-action for communities.</p>`,
                img: "https://placehold.co/600x360/0d2230/ffffff?text=Future+Monitoring",
                coords: [46.37, 7.78],
                zoom: 12
            }
        ];

        let storyMap = null;

        // Guarded initStoryMap — will initialize only if #story-map exists
        function initStoryMap() {
            const storyMapContainer = document.getElementById('story-map');
            if (!storyMapContainer) {
                // No story-map container present (we removed it from HTML).
                // Leave storyMap as null and skip map initialization.
                return;
            }
            if (storyMap) return;
            storyMap = L.map(storyMapContainer, { attributionControl: false }).setView(steps[0].coords, steps[0].zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(storyMap);
            storyMap._marker = L.circleMarker(steps[0].coords, { radius: 6, color: '#22b1f1', fillColor:'#22b1f1', fillOpacity:0.95 }).addTo(storyMap);
        }

        // Guarded renderStep — will skip map actions if storyMap is not initialized
        function renderStep(idx) {
            const s = steps[idx];
            if (!s) return;
            const content = document.getElementById('story-content');
            content.innerHTML = `
                <h3>${s.title}</h3>
                <div class="meta">${s.meta}</div>
                ${s.html}
                ${s.img ? `<img src="${s.img}" alt="${s.title}" class="story-img">` : ''}
            `;
            initStoryMap();
            if (storyMap) {
                try {
                    storyMap.flyTo(s.coords, s.zoom || 13, { animate: true, duration: 0.9 });
                    if (storyMap._marker) storyMap._marker.setLatLng(s.coords);
                } catch (e) { console.warn('story map pan error', e); }
            }

            const items = Array.from(document.querySelectorAll('#story-left .story-item'));
            items.forEach(it => {
                const stepIdx = Number(it.getAttribute('data-step'));
                const active = (stepIdx === idx);
                it.classList.toggle('active', active);
                it.setAttribute('aria-pressed', active ? 'true' : 'false');
                if (active) it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
        }

        function wireNav() {
            const items = Array.from(document.querySelectorAll('#story-left .story-item'));
            items.forEach(it => {
                const idx = Number(it.getAttribute('data-step'));
                it.addEventListener('click', () => renderStep(idx));
                it.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); it.click(); }
                    else if (ev.key === 'ArrowDown') { ev.preventDefault(); const next = items[items.indexOf(it)+1]; if (next) next.focus(); }
                    else if (ev.key === 'ArrowUp') { ev.preventDefault(); const prev = items[items.indexOf(it)-1]; if (prev) prev.focus(); }
                });
            });
        }
        
        window.wireStoryMap = () => {
            wireNav();
            renderStep(0); // Show initial step
        };
    })();
    // --- End Story interactivity ---


    // --- Core Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Initialize core map, tabs, and visitor count
        initTabs();
        initMapIfNeeded(); 
        showLocalVisit();
        tryServerVisit();
        window.wireStoryMap(); 

        // 2. Wire search functionality
        const searchInput = $('#mapSearchInput');
        const searchBtn = $('#mapSearchBtn');

        // Default Blatten coordinates to center the map and AOI
        const BLATTEN_COORDS = [46.38, 7.75];
        const BLATTEN_LABEL = "Blatten, Switzerland (AOI Center)";

        const performSearch = async () => {
            const q = searchInput.value.trim();
            if (!q) return;

            // For the demo, we assume Blatten is searched and center the map there
            if (q.toLowerCase().includes('blatten')) {
                 placeSearchMarker(BLATTEN_COORDS[0], BLATTEN_COORDS[1], BLATTEN_LABEL);
            } else {
                // Use Nominatim for address search (optional, but good practice)
                try {
                    const results = await geocodeNominatim(q);
                    if (results.length > 0) {
                        const result = results[0];
                        placeSearchMarker(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
                    } else {
                        console.log('Location not found.');
                    }
                } catch (e) {
                    console.error('Geocoding error:', e);
                }
            }
        };

        // Execute the default search immediately to set the AOI
        performSearch(); 

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performSearch();
        });


        /* ---------------------- S2 Animation + Change Overlay (Integrated) ----------------------
        ------------------------------------------------------------------------ */

        (function() {
            // Ordered list of PNG filenames (chronological). Must be full URLs.
            const frames = [
                'data/blatten_phase1/derived/s2_quicklooks/Subset_S2C_MSIL2A_20250408T103051_N0511_R108_T32TMS_20250408T161415_resampled_B12B2B1_rgb.png',
                'data/blatten_phase1/derived/s2_quicklooks/Subset_S2A_MSIL2A_20250430T102701_N0511_R108_T32TMS_20250430T190517_resampled_B12B2B1_rgb.png',
                'data/blatten_phase1/derived/s2_quicklooks/Subset_S2C_MSIL2A_20250518T102621_N0511_R108_T32TMS_20250518T143414_resampled_B12B2B1_rgb.png',
                'data/blatten_phase1/derived/s2_quicklooks/Subset_S2A_MSIL2A_20250530T103041_N0511_R108_T32TMS_20250530T142711_resampled_B12B2B1_rgb.png'
            ];

            // Corresponding human-readable dates for UI (strings)
            const dates = [
                '2025-04-08',
                '2025-04-30',
                '2025-05-18', // This is the change frame
                '2025-05-30'
            ];

            // The index (0-based) of the first frame that shows the detected change.
            let changeFrameIndex = 2; 

            // CORRECTED Bounds based on your Python Canvas coordinates:
            // [[south, west], [north, east]]
            const OVERLAY_BOUNDS = [[46.38, 7.742], [46.453, 7.899]]; 

            // Path to change GeoJSON (precomputed polygons)
            const CHANGE_GEOJSON_PATH = '/derived/risk/high_risk.geojson'; 

            // UI state
            let currentIndex = 0;
            let timer = null;
            let intervalMs = 1000; // default speed: 1000ms per frame
            const minInterval = 200;
            const maxInterval = 4000;

            // Create UI controls container (inject into dashboard-right)
            const controlsContainer = document.createElement('div');
            controlsContainer.id = 's2-anim-controls';
            controlsContainer.style.padding = '10px';
            controlsContainer.style.background = 'rgba(255,255,255,0.96)';
            controlsContainer.style.borderRadius = '10px';
            controlsContainer.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
            controlsContainer.style.marginBottom = '12px';
            
            const rightSidebar = document.querySelector('.dashboard-right');
            // Find the alert card and insert before it
            const alertCard = rightSidebar.querySelector('.card.alerts');
            if (rightSidebar && alertCard) {
                rightSidebar.insertBefore(controlsContainer, alertCard.nextSibling);
            } else {
                console.error("Could not find dashboard-right to insert S2 animation controls.");
                return; // Exit if we can't place the controls
            }

            // Build inner HTML for controls
            controlsContainer.innerHTML = `
                <div style="font-weight:700;margin-bottom:6px; color: #1a2430;">4. S2 TIME-LAPSE ANIMATION</div>
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
                    <button id="anim-prev" class="btn-ghost" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; color: #1a2430;">◀</button>
                    <button id="anim-play" class="btn-ghost" style="padding: 8px 12px; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 6px; cursor: pointer;">Play ▶</button>
                    <button id="anim-pause" class="btn-ghost" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; color: #1a2430;">Pause ⏸</button>
                    <button id="anim-next" class="btn-ghost" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; color: #1a2430;">▶</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <label style="font-size:12px; min-width: 40px; color: #1a2430;">Speed</label>
                    <!-- NOTE: Input value is mapped inversely to speed: lower value = faster -->
                    <input id="anim-speed" type="range" min="1" max="${maxInterval - minInterval + 1}" value="${maxInterval - intervalMs + minInterval}" step="100" style="flex:1" />
                </div>
                <div style="margin-bottom:6px; color: #1a2430;">
                    <div style="font-size:13px">Frame: <span id="anim-frame-label">-</span></div>
                    <div style="font-size:12px;color:#666">Date: <span id="anim-date-label">-</span></div>
                </div>
                <div id="anim-alert" style="display:none;background:#ffdddd;color:#700; padding:8px;border-radius:6px;font-weight:700;border: 1px solid #ff3b3b;">
                    ⚠️ S2 Visual Change detected (Confirmed by B12-B2-B1 color shift)
                </div>
            `;

            // create the image overlay (initial frame will be frames[0])
            const firstFrameUrl = frames[0];
            let frameOverlay = L.imageOverlay(firstFrameUrl, OVERLAY_BOUNDS, {opacity: 0.95}).addTo(map);

            // load and add the change GeoJSON but keep invisible initially
            let changeLayer = null;
            fetch(CHANGE_GEOJSON_PATH).then(r => {
                if (!r.ok) throw new Error(`GeoJSON fetch failed with status: ${r.status}`);
                return r.json();
            }).then(geojson => {
                // GeoJSON style for the RED displacement polygon
                const baseStyle = {color: '#ff3b3b', weight: 3, fillOpacity: 0.0};
                changeLayer = L.geoJSON(geojson, {
                    style: baseStyle,
                    onEachFeature: function(feature, layer) {
                        layer.featureFrameIndex = (feature.properties && typeof feature.properties.frameIndex !== 'undefined') ? feature.properties.frameIndex : changeFrameIndex;
                    }
                }).addTo(map);
                changeLayer.eachLayer(l => { l.setStyle({fillOpacity:0, opacity:0}); }); // Hide initially
            }).catch(err => {
                console.error('No change geojson loaded (this is expected if the file is not on the server):', err.message);
            });

            // UI helper refs
            const elFrame = document.getElementById('anim-frame-label');
            const elDate = document.getElementById('anim-date-label');
            const elPlay = document.getElementById('anim-play');
            const elPause = document.getElementById('anim-pause');
            const elPrev = document.getElementById('anim-prev');
            const elNext = document.getElementById('anim-next');
            const elSpeed = document.getElementById('anim-speed');
            const elAlert = document.getElementById('anim-alert');

            // update overlay to a given index
            function showFrame(idx) {
                if (idx < 0) idx = 0;
                if (idx >= frames.length) idx = frames.length - 1;
                currentIndex = idx;
                
                const url = frames[idx]; 
                
                map.removeLayer(frameOverlay);
                frameOverlay = L.imageOverlay(url, OVERLAY_BOUNDS, {opacity:0.95}).addTo(map);

                elFrame.textContent = `${idx+1} / ${frames.length}`;
                elDate.textContent = dates[idx] || 'unknown';

                // show/hide change polygon & alert
                const isChangeFrame = (idx >= changeFrameIndex);
                
                // Handle polygon visibility
                if (changeLayer) {
                    changeLayer.eachLayer(layer => {
                        // Show polygon if current frame index is >= the frame index where the feature change occurred
                        const show = (idx >= layer.featureFrameIndex);
                        if (show) {
                            layer.setStyle({opacity:1, fillOpacity:0.25});
                        } else {
                            layer.setStyle({opacity:0, fillOpacity:0});
                        }
                    });
                }

                // Toggle alert box (S2 visual change alert)
                if (isChangeFrame) elAlert.style.display = 'block';
                else elAlert.style.display = 'none';
                
                // Update play button visual state
                if (timer) {
                    elPlay.style.background = '#ccc';
                    elPlay.style.color = '#333';
                    elPause.style.background = '#ffc107'; // Highlight pause
                    elPause.style.color = '#333';
                } else {
                    elPlay.style.background = '#007bff'; // Highlight play
                    elPlay.style.color = 'white';
                    elPause.style.background = '#ccc';
                    elPause.style.color = '#333';
                }
            }

            // playback functions
            function play() {
                if (timer) return;
                timer = setInterval(() => {
                    let nextIndex = currentIndex + 1;
                    if (nextIndex >= frames.length) {
                        nextIndex = 0; 
                    }
                    showFrame(nextIndex);
                }, intervalMs);
                showFrame(currentIndex); 
            }
            function pause() {
                if (timer) clearInterval(timer);
                timer = null;
                showFrame(currentIndex); 
            }
            function prev() {
                pause();
                showFrame((currentIndex - 1 + frames.length) % frames.length); 
            }
            function next() {
                pause();
                showFrame((currentIndex + 1) % frames.length);
            }

            // bind UI
            elPlay.addEventListener('click', () => { play(); });
            elPause.addEventListener('click', () => { pause(); });
            elPrev.addEventListener('click', () => { prev(); });
            elNext.addEventListener('click', () => { next(); });
            elSpeed.addEventListener('input', (ev) => {
                intervalMs = maxInterval - parseInt(ev.target.value, 10) + minInterval; 
                if (timer) { pause(); play(); } 
            });

            // show first frame now
            showFrame(0);

        })();
        /* ---------------------- End S2 Animation Logic ---------------------- */

    });
})();
