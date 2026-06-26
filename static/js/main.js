/* ----------------------------------------------------
   SafeHer - Production Dynamic Logic & Map Controller
   ---------------------------------------------------- */

// Global Application Variables
let map;
let userMarker;
let policeMarkers = [];
let hospitalMarkers = [];
let routePolyline;
let activeHighlightCircle;

// Leaflet Layer Groups for Dynamic Filtering
let userMarkerGroup;
let beaconsGroup;
let unsafeZonesGroup;
let supportGroup;
let routesGroup;

let lastKnownLat = 21.1458;
let lastKnownLng = 79.0882;
let closestNode = null;

let notifications = [];
let safetyChart;
let safetyHistory = [];
let safetyTimeline = [];
let sessionStartTime = new Date().toLocaleTimeString();

// System Counter Statistics
let safetyCheckCount = 0;
let sosFiredCount = 0;
let policeCount = 0;
let hospitalCount = 0;

let isSosCountingDown = false;
let sosCountdownTimer = null;
let sosTriggered = false;

// Global settings configurations
let voiceSosEnabled = true;
let autoSosEnabled = true;
let notificationsEnabled = true;

window.onload = function() {

    // Initialize Leaflet Map
    map = L.map('map').setView([21.1458, 79.0882], 13);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '&copy; OpenStreetMap'
        }
    ).addTo(map);

    // Configure Layer Groups
    userMarkerGroup = L.layerGroup().addTo(map);
    beaconsGroup = L.layerGroup().addTo(map);
    unsafeZonesGroup = L.layerGroup().addTo(map);
    supportGroup = L.layerGroup().addTo(map);
    routesGroup = L.layerGroup().addTo(map);

    // Register Layer Controls Switcher
    L.control.layers(null, {
        "📍 User Marker": userMarkerGroup,
        "👮 Help Beacons": beaconsGroup,
        "🔥 Unsafe Areas": unsafeZonesGroup,
        "👥 Nearby Network": supportGroup,
        "🛣 Safe Route Vector": routesGroup
    }).addTo(map);

    // Add Map Legend Panel
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <h4>Map Symbols</h4>
            <div class="legend-item"><span class="legend-color" style="background: #3b82f6"></span> Police Station</div>
            <div class="legend-item"><span class="legend-color" style="background: #ef4444"></span> Hospital</div>
            <div class="legend-item"><span class="legend-color" style="background: #ef4444; opacity: 0.3;"></span> High Risk Zone</div>
            <div class="legend-item"><span class="legend-color" style="background: #f59e0b; opacity: 0.3;"></span> Medium Risk Zone</div>
            <div class="legend-item"><span class="legend-color" style="background: #10b981; border: 1.5px dashed #fff;"></span> Safe Route Vector</div>
        `;
        return div;
    };
    legend.addTo(map);

    // Initialize Chart.js Trend Visuals
    initializeSafetyChart();

    // Fetch User Profile Settings from SQLite database
    fetchUserSettings();

    // Trigger Connection Status Notification
    addNotification("SafeHer Console Online. Secure session authenticated.", "success");

    // Retrieve Geolocation Coordinates
    if (navigator.geolocation) {

        navigator.geolocation.getCurrentPosition(

            function(position) {

                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                lastKnownLat = lat;
                lastKnownLng = lng;

                const locationText = document.getElementById("location-text");
                if(locationText){
                    locationText.innerHTML = lat.toFixed(4) + ", " + lng.toFixed(4);
                }

                addActivity("📍 Location Tracking Active");

                const riskLocation = document.getElementById("risk-location");
                if(riskLocation) riskLocation.innerHTML = lat.toFixed(4) + ", " + lng.toFixed(4);

                const routeLocation = document.getElementById("route-location");
                if(routeLocation) routeLocation.innerHTML = lat.toFixed(4) + ", " + lng.toFixed(4);

                map.setView([lat, lng], 15);

                // Add to layer group
                userMarker = L.marker([lat, lng])
                    .addTo(userMarkerGroup)
                    .bindPopup("📍 You are here")
                    .openPopup();

                // Draw Nagpur Unsafe Zone Circles
                L.circle([lat + 0.004, lng + 0.004], {
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.15,
                    radius: 180
                }).addTo(unsafeZonesGroup).bindPopup("🔥 High Crime Risk Hotspot");

                L.circle([lat - 0.004, lng - 0.003], {
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.15,
                    radius: 140
                }).addTo(unsafeZonesGroup).bindPopup("⚠ Medium Crime Risk Area");

                // Fetch prediction from server (dynamic parameters based on coordinates)
                fetchPredictions(lat, lng);
                fetchNearbyOSMAmenities(lat, lng);

            },

            function(){
                // Fallback Nagpur defaults
                const locationText = document.getElementById("location-text");
                if(locationText) locationText.innerHTML = "Nagpur (Fallback center)";

                userMarker = L.marker([21.1458, 79.0882])
                    .addTo(userMarkerGroup)
                    .bindPopup("📍 Fallback Nagpur Center")
                    .openPopup();

                L.circle([21.1498, 79.0922], {
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.15,
                    radius: 180
                }).addTo(unsafeZonesGroup).bindPopup("🔥 Nagpur High Crime Zone");

                addActivity("📍 Geolocation Offline (Nagpur Default)");
                fetchPredictions(21.1458, 79.0882);
                fetchNearbyOSMAmenities(21.1458, 79.0882);
            }

        );

    } else {
        fetchPredictions(21.1458, 79.0882);
        fetchNearbyOSMAmenities(21.1458, 79.0882);
    }

    function updateTime(){
        const now = new Date();
        const timeElement = document.getElementById("live-time");
        if(timeElement) timeElement.innerHTML = now.toLocaleTimeString();

        const riskTime = document.getElementById("risk-time");
        if(riskTime) riskTime.innerHTML = now.toLocaleTimeString();
    }

    updateTime();
    setInterval(updateTime, 1000);

    // Dynamic Zone Theme toggles (Safe/Medium/Danger)
    window.updateZoneTheme = function(zone){

        const body = document.body;
        const banner = document.getElementById("zone-banner");
        const zoneStatus = document.getElementById("zone-status");    

        body.classList.remove(
            "safe-zone",
            "medium-zone",
            "danger-zone"
        );

        if(zone === "safe"){
            body.classList.add("safe-zone");
            body.style.setProperty('--accent-glow', 'rgba(16, 185, 129, 0.05)');

            if(banner){
                banner.className = "zone-banner safe-banner";
                banner.innerHTML = "🟢 SAFE ZONE ACTIVE";
            }

            updateSafetyStatus("safe");
            if(zoneStatus) zoneStatus.innerHTML = "Current Zone: Safe";
        }
        else if(zone === "medium"){
            body.classList.add("medium-zone");
            body.style.setProperty('--accent-glow', 'rgba(245, 158, 11, 0.05)');

            if(banner){
                banner.className = "zone-banner medium-banner";
                banner.innerHTML = "🟡 MEDIUM RISK WARNING";
            }

            updateSafetyStatus("medium");
            if(zoneStatus) zoneStatus.innerHTML = "Current Zone: Medium Risk";
        }
        else {
            body.classList.add("danger-zone");
            body.style.setProperty('--accent-glow', 'rgba(239, 68, 68, 0.12)');

            if(banner){
                banner.className = "zone-banner danger-banner";
                banner.innerHTML = "🔴 DANGER ZONE ALERT";
            }

            updateSafetyStatus("danger");
            if(zoneStatus) zoneStatus.innerHTML = "Current Zone: High Risk";

            // Automatically trigger SOS countdown if auto-sos configuration toggle is active
            if (autoSosEnabled && !sosTriggered && !isSosCountingDown) {
                sendSOS();
            }
        }

    };

    function updateSafetyStatus(zone){
        const status = document.getElementById("safety-status");
        if(!status) return;

        if(zone === "safe"){
            status.innerHTML = "🟢 SAFE";
            status.style.color = "var(--success)";
        }
        else if(zone === "medium"){
            status.innerHTML = "🟡 WARNING";
            status.style.color = "var(--warning)";
        }
        else{
            status.innerHTML = "🔴 DANGER";
            status.style.color = "var(--danger)";
        }
    }

};

/* -----------------------------------------
   ML Predictions API Fetches
   ----------------------------------------- */
function fetchPredictions(lat, lng) {
    
    fetch(`/predict?lat=${lat}&lng=${lng}`)
    .then(response => response.json())
    .then(data => {

        const prediction = data.safety;
        const recommendation = document.getElementById("ai-recommendation");
        const score = data.score;
        const confidence = data.confidence;

        // Update Safety Chart with real prediction values
        updateSafetyChart(score);

        const aiScore = document.getElementById("ai-score");
        if(aiScore) aiScore.innerHTML = score + "%";

        const aiScoreBar = document.getElementById("ai-score-bar");
        if(aiScoreBar) aiScoreBar.style.width = score + "%";

        const riskLevel = document.getElementById("risk-level");
        if(riskLevel){
            if(score >= 70){
                riskLevel.innerHTML = "Risk Level: <span style='color: var(--success); font-weight: 700;'>LOW</span>";
            }
            else if(score >= 40){
                riskLevel.innerHTML = "Risk Level: <span style='color: var(--warning); font-weight: 700;'>MEDIUM</span>";
            }
            else{
                riskLevel.innerHTML = "Risk Level: <span style='color: var(--danger); font-weight: 700;'>HIGH</span>";
            }
        }

        const confidenceElement = document.getElementById("confidence-score");
        if(confidenceElement) confidenceElement.innerHTML = "Confidence: " + confidence + "%";

        // Risk Analysis Cards Mapping
        const crowdLevel = document.getElementById("crowd-level");
        if(crowdLevel && data.crowd_density) {
            crowdLevel.innerHTML = `${data.crowd_density}% (${data.crowd_density > 60 ? 'High' : (data.crowd_density > 30 ? 'Moderate' : 'Low')})`;
        }

        const zoneRisk = document.getElementById("zone-risk");
        if(zoneRisk) {
            zoneRisk.innerHTML = prediction;
            if (prediction === 'SAFE') zoneRisk.className = 'risk-badge risk-low';
            else if (prediction === 'MEDIUM') zoneRisk.className = 'risk-badge risk-medium';
            else zoneRisk.className = 'risk-badge risk-high';
        }

        const aiInsight = document.getElementById("ai-insight");
        if(aiInsight && data.insight) aiInsight.innerHTML = data.insight;

        if(recommendation && data.explanation && data.insight){
            recommendation.innerHTML = `
                <div style="font-size: 14px; line-height: 1.6;">
                    <b>Model Decision Explanation:</b><br>${data.explanation}<br><br>
                    <b>AI Security Insight:</b><br>${data.insight}
                </div>
            `;
        }

        addPredictionHistory(`${prediction} - ${score}% (Conf: ${confidence}%)`);
        
        // Update Zone theme classes
        updateZoneTheme(prediction.toLowerCase());

        if (notificationsEnabled) {
            addNotification(`Safety scan completed. Status: ${prediction} (${score}%)`, prediction === 'UNSAFE' ? 'danger' : (prediction === 'MEDIUM' ? 'warning' : 'success'));
        }
        
        safetyCheckCount++;
        
        // Update profile analytics stats counts
        const statsScans = document.getElementById("stats-scans");
        if (statsScans) statsScans.innerHTML = safetyCheckCount;

    })
    .catch(error => {
        console.error("AI Prediction Error:", error);
    });

}

function addPredictionHistory(message){

    const history = document.getElementById("prediction-history");
    if(!history) return;

    if (history.innerHTML.includes("Loading...")) {
        history.innerHTML = "";
    }

    const item = document.createElement("div");
    item.className = "history-item";

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    item.innerHTML = `<span>${time}</span> <b>${message}</b>`;

    history.prepend(item);

}

/* -----------------------------------------
   OpenStreetMap Overpass Beacons Queries
   ----------------------------------------- */
function fetchNearbyOSMAmenities(lat, lng) {

    const radius = 2500; 
    const query = `[out:json];(node(around:${radius},${lat},${lng})[amenity=police];node(around:${radius},${lat},${lng})[amenity=hospital];);out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    addNotification("OSM queries initiated: Finding closest emergency beacons...", "info");

    fetch(url)
    .then(response => response.json())
    .then(data => {
        
        // Clear Layer groups markers
        beaconsGroup.clearLayers();
        policeMarkers = [];
        hospitalMarkers = [];

        const elements = data.elements || [];

        if (elements.length === 0) {
            addNotification("No OSM beacons found. Generating fallback safety points.", "warning");
            generateVirtualAmenities(lat, lng);
            return;
        }

        addNotification(`Retrieved ${elements.length} emergency landmarks from OpenStreetMap.`, "success");
        populateAmenities(elements, lat, lng);

    })
    .catch(error => {
        console.error("OSM Overpass Error:", error);
        generateVirtualAmenities(lat, lng);
    });

}

function generateVirtualAmenities(lat, lng) {
    
    const elements = [
        {
            lat: lat + 0.0031,
            lon: lng + 0.0019,
            tags: { name: "Sadar Patrolling Station", amenity: "police" }
        },
        {
            lat: lat - 0.0028,
            lon: lng + 0.0042,
            tags: { name: "Nagpur Central Police HQ", amenity: "police" }
        },
        {
            lat: lat + 0.0045,
            lon: lng - 0.0028,
            tags: { name: "Orange City General Hospital", amenity: "hospital" }
        },
        {
            lat: lat - 0.0019,
            lon: lng - 0.0035,
            tags: { name: "West Nagpur Emergency Clinic", amenity: "hospital" }
        }
    ];

    populateAmenities(elements, lat, lng);

}

function populateAmenities(elements, userLat, userLng) {

    const nearbyGrid = document.getElementById("nearby-grid");
    if (!nearbyGrid) return;
    
    nearbyGrid.innerHTML = "";
    let displayCount = 0;
    
    policeCount = 0;
    hospitalCount = 0;

    elements.forEach(elem => {
        
        const lat = elem.lat;
        const lng = elem.lon;
        const name = elem.tags.name || (elem.tags.amenity === 'police' ? "Police Post" : "Hospital Center");
        const type = elem.tags.amenity;

        const dist = calculateDistanceKm(userLat, userLng, lat, lng);

        const color = type === 'police' ? '#3b82f6' : '#ef4444';
        const emoji = type === 'police' ? '👮' : '🏥';

        if (type === 'police') policeCount++;
        else hospitalCount++;

        // Add circle marker to layer group
        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(beaconsGroup)
          .bindPopup(`<b>${emoji} ${name}</b><br>${(dist * 1000).toFixed(0)}m away`);

        if (type === 'police') {
            policeMarkers.push(marker);
        } else {
            hospitalMarkers.push(marker);
        }

        // Add to Nearby grid
        if (displayCount < 5) {
            nearbyGrid.innerHTML += `
                <div class="nearby-card" style="border-left: 3px solid ${color};">
                    <div class="nearby-avatar" style="color: ${color};">
                        <i class="${type === 'police' ? 'fa-solid fa-building-shield' : 'fa-solid fa-square-h'}"></i>
                    </div>
                    <div class="nearby-details">
                        <span class="name">${name}</span>
                        <span class="tag" style="color: ${color}; font-weight:700;">${type === 'police' ? 'Police Station' : 'Hospital'} - ${(dist * 1000).toFixed(0)}m</span>
                    </div>
                </div>
            `;
            displayCount++;
        }

    });

    // Update profile statistics displays
    const statsPol = document.getElementById("stats-police");
    if (statsPol) statsPol.innerHTML = policeCount;
    
    const statsHosp = document.getElementById("stats-hospitals");
    if (statsHosp) statsHosp.innerHTML = hospitalCount;

    // Determine closest node
    closestNode = null;
    let minDistance = Infinity;

    elements.forEach(elem => {
        const dist = calculateDistanceKm(userLat, userLng, elem.lat, elem.lon);
        if (dist < minDistance) {
            minDistance = dist;
            closestNode = elem;
        }
    });

    // Update Route recommendation panel
    const routeDest = document.getElementById("route-destination-text");
    const routeTime = document.getElementById("route-time-val");
    const routeScore = document.getElementById("route-score");
    const routeStatus = document.getElementById("route-status-badge");

    if (closestNode) {
        
        const destName = closestNode.tags.name || (closestNode.tags.amenity === 'police' ? "Police Station" : "Hospital");
        if (routeDest) routeDest.innerHTML = `👮 ${destName}`;

        const mins = Math.max(2, Math.round(minDistance * 12));
        if (routeTime) routeTime.innerHTML = `${mins} mins (${(minDistance * 1000).toFixed(0)}m)`;

        const safetyScore = Math.max(50, Math.min(99, 98 - minDistance * 15));
        if (routeScore) routeScore.innerHTML = `${safetyScore.toFixed(0)}% Safe`;

        if (routeStatus) {
            if (safetyScore > 75) {
                routeStatus.innerHTML = "Optimal";
                routeStatus.className = "badge-optimal text-emerald";
                routeStatus.style.background = "rgba(16, 185, 129, 0.1)";
            } else {
                routeStatus.innerHTML = "Caution";
                routeStatus.className = "badge-optimal";
                routeStatus.style.background = "rgba(245, 158, 11, 0.1)";
                routeStatus.style.color = "var(--warning)";
            }
        }

    }

}

/* -----------------------------------------
   Safe Routing Recommendations
   ----------------------------------------- */
function showSafeRoute() {

    if (!closestNode) {
        alert("Locating nearest emergency landmark...");
        return;
    }

    // Clear old lines & highlights
    routesGroup.clearLayers();
    if (activeHighlightCircle) {
        map.removeLayer(activeHighlightCircle);
    }

    const userLat = lastKnownLat;
    const userLng = lastKnownLng;
    const destLat = closestNode.lat;
    const destLng = closestNode.lon;

    const midLat = userLat + (destLat - userLat) * 0.4;
    const midLng = userLng + (destLng - userLng) * 0.85;

    // Draw route line
    routePolyline = L.polyline([
        [userLat, userLng],
        [midLat, midLng],
        [destLat, destLng]
    ], {
        color: '#10b981',
        weight: 6,
        opacity: 0.85,
        dashArray: '5, 8'
    }).addTo(routesGroup);

    // Dynamic nearest station highlight (pulsing circle)
    activeHighlightCircle = L.circle([destLat, destLng], {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.4,
        radius: 60
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    const destName = closestNode.tags.name || (closestNode.tags.amenity === 'police' ? "Police Station" : "Hospital");
    addNotification(`Route calculated. Path mapped to "${destName}".`, "success");
    addActivity(`🛣 Route drawn to nearest station`);

}

/* -----------------------------------------
   Siren Alert Web Audio API Oscillator Synthesizer
   ----------------------------------------- */
function playEmergencyAlarmSiren() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc1.type = "sawtooth";
        osc2.type = "sine";

        // Frequency sweep (police/emergency yelp siren chirp)
        osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc1.frequency.linearRampToValueAtTime(1300, audioCtx.currentTime + 0.4);
        osc1.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.8);
        osc1.frequency.linearRampToValueAtTime(1300, audioCtx.currentTime + 1.2);

        osc2.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc2.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.4);
        osc2.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.8);
        osc2.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 1.2);

        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 1.5);
        osc2.stop(audioCtx.currentTime + 1.5);
    } catch(e) {
        console.error("Browser blocked Web Audio synthesizer play:", e);
    }
}

/* -----------------------------------------
   Emergency SOS Countdown Modal logic
   ----------------------------------------- */
function sendSOS(){

    const btnText = document.getElementById("sos-btn-text");
    const btn = document.querySelector(".sos-btn");

    if (isSosCountingDown) {
        clearTimeout(sosCountdownTimer);
        isSosCountingDown = false;
        
        if (btnText) btnText.innerHTML = "SEND SOS";
        if (btn) btn.style.background = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";
        
        addNotification("SOS transmission aborted.", "info");
        return;
    }

    isSosCountingDown = true;
    let seconds = 3;

    if (btnText) btnText.innerHTML = `CANCEL SOS (${seconds}s)`;
    if (btn) btn.style.background = "#d97706";

    addNotification(`EMERGENCY: Distress countdown active. Sending alert in 3s.`, "warning");

    function executeCountdown() {
        seconds--;
        if (seconds <= 0) {
            
            isSosCountingDown = false;
            sosTriggered = true;
            sosFiredCount++;

            // Update stats
            const statsSos = document.getElementById("stats-sos");
            if (statsSos) statsSos.innerHTML = sosFiredCount;

            if (btnText) btnText.innerHTML = "SOS ACTIVE";
            if (btn) btn.style.background = "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)";

            // Trigger actual modal
            const modal = document.getElementById("sos-modal");
            if (modal) {
                
                modal.style.display = "flex";
                
                const sosList = document.getElementById("sos-contact-list");
                
                // Fetch contacts from SQLite synced state
                fetch('/contacts')
                .then(res => res.json())
                .then(contacts => {
                    if (sosList) {
                        sosList.innerHTML = "<li><i class='fa-solid fa-circle-check' style='color: var(--success)'></i> Current Location Coordinates Sent</li>";
                        contacts.forEach(contact => {
                            sosList.innerHTML += `<li><i class='fa-solid fa-circle-check' style='color: var(--success)'></i> SMS Alert shared with ${contact.name} (${contact.phone})</li>`;
                        });
                    }
                })
                .catch(err => {
                    console.error("Error loading contacts for SOS:", err);
                });

            }

            // Synthesize Web Audio Alarm Siren
            playEmergencyAlarmSiren();

            // SQL Logging Event Route trigger
            fetch('/sos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: lastKnownLat, lng: lastKnownLng })
            })
            .then(res => res.json())
            .then(data => {
                console.log("SOS registered in SQLite database.");
            })
            .catch(err => console.error("Error logging SOS to DB:", err));

            addNotification("🚨 SOS DISTRESS SIGNALS ACTIVE. TRUSTED NETWORK NOTIFIED.", "danger");
            addActivity("🚨 SOS Distress Signals Fired");

        } else {
            
            if (btnText) btnText.innerHTML = `CANCEL SOS (${seconds}s)`;
            sosCountdownTimer = setTimeout(executeCountdown, 1000);

        }
    }

    sosCountdownTimer = setTimeout(executeCountdown, 1000);

}

function closeSOS(){

    const modal = document.getElementById("sos-modal");
    if(modal) modal.style.display = "none";

    sosTriggered = false;

    const btnText = document.getElementById("sos-btn-text");
    const btn = document.querySelector(".sos-btn");

    if (btnText) btnText.innerHTML = "SEND SOS";
    if (btn) btn.style.background = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";

    addNotification("Emergency alert state reset.", "info");

}

/* -----------------------------------------
   Voice SOS Activation
   ----------------------------------------- */
function startVoiceSOS(){

    if (!voiceSosEnabled) {
        addNotification("Voice SOS is disabled in settings.", "warning");
        return;
    }

    const status = document.getElementById("voice-status");
    const voiceBtn = document.querySelector(".voice-btn");

    if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)){
        alert("Voice recognition is not supported in this browser.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";

    recognition.onstart = function() {
        if(voiceBtn) voiceBtn.classList.add("listening");
        if(status) status.innerHTML = "🎤 Listening for keywords...";
        addNotification("Voice activation active. Say 'HELP ME' or 'SOS'.", "info");
    };

    recognition.onend = function() {
        if(voiceBtn) voiceBtn.classList.remove("listening");
        if(status && status.innerHTML === "🎤 Listening for keywords...") {
            status.innerHTML = "Status: Waiting...";
        }
    };

    recognition.onerror = function(event) {
        if(voiceBtn) voiceBtn.classList.remove("listening");
        if(status) status.innerHTML = "Status: Offline";
    };

    recognition.onresult = function(event){

        const speech = event.results[0][0].transcript.toLowerCase();
        console.log("Voice Detected:", speech);

        if(status) status.innerHTML = "🎤 Heard: \"" + speech + "\"";

        if(
            speech.includes("help") ||
            speech.includes("help me") ||
            speech.includes("emergency") ||
            speech.includes("sos")
        ) {
            addNotification(`Voice triggers recognized: "${speech}". Firing Emergency alerts.`, "danger");
            sendSOS();
        }

    };

    recognition.start();

}

/* -----------------------------------------
   Database-Synced Trusted Contacts CRUD Actions
   ----------------------------------------- */
function addContact(){

    const name = document.getElementById("contact-name").value.trim();
    const phone = document.getElementById("contact-phone").value.trim();

    if(!name || !phone){
        addNotification("Validation warning: Contact name and phone required.", "warning");
        return;
    }

    // Client-side validations
    if(!/^\d{10}$/.test(phone)) {
        addNotification("Validation warning: Phone number must be exactly 10 digits.", "warning");
        return;
    }

    // Client-side local duplicate check
    let isDuplicate = false;
    document.querySelectorAll(".contact-card .contact-phone").forEach(el => {
        if (el.innerText.replace(/\D/g, "") === phone) {
            isDuplicate = true;
        }
    });

    if (isDuplicate) {
        addNotification("Validation warning: Contact with this phone number already registered.", "warning");
        return;
    }

    // POST contact to server SQLite database
    fetch('/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'error') {
            addNotification("Server validation: " + data.message, "warning");
            return;
        }
        loadContacts();
        addNotification(`Contact "${name}" saved to database successfully.`, "success");
        addActivity("👤 Contact Added");
    })
    .catch(err => {
        console.error("Error adding contact:", err);
    });

    document.getElementById("contact-name").value = "";
    document.getElementById("contact-phone").value = "";

}

function deleteContact(index){

    const cards = document.querySelectorAll(".contact-card");
    if (index >= 0 && index < cards.length) {
        
        const card = cards[index];
        const name = card.querySelector(".contact-name").innerText;
        const phone = card.querySelector(".contact-phone").innerText.trim().replace(/\D/g, "");

        // DELETE call to SQLite
        fetch('/contacts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, phone: phone })
        })
        .then(res => res.json())
        .then(data => {
            loadContacts();
            addNotification(`Contact "${name}" removed.`, "info");
            addActivity("👤 Contact Removed");
        })
        .catch(err => {
            console.error("Error deleting contact:", err);
        });

    }

}

function editContact(index){

    const cards = document.querySelectorAll(".contact-card");
    if (index >= 0 && index < cards.length) {
        
        const card = cards[index];
        const oldName = card.querySelector(".contact-name").innerText;
        const oldPhone = card.querySelector(".contact-phone").innerText.trim().replace(/\D/g, "");

        const newName = prompt("Edit Contact Name:", oldName);
        const newPhone = prompt("Edit Phone Number:", oldPhone);

        if(newName !== null && newPhone !== null && newName.trim() !== "" && newPhone.trim() !== ""){
            
            if(!/^\d{10}$/.test(newPhone.trim())) {
                addNotification("Validation warning: Edited phone must contain 10 digits.", "warning");
                return;
            }

            // Delete old contact and add new contact
            fetch('/contacts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: oldName, phone: oldPhone })
            })
            .then(() => {
                return fetch('/contacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() })
                });
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'error') {
                    addNotification("Server validation: " + data.message, "warning");
                    return;
                }
                loadContacts();
                addNotification(`Contact updated to: "${newName.trim()}".`, "success");
                addActivity("👤 Contact Updated");
            })
            .catch(err => {
                console.error("Error editing contact:", err);
            });

        }

    }

}

function loadContacts(){

    const contactsGrid = document.getElementById("contacts-grid");
    const nearbyGrid = document.getElementById("nearby-grid");

    if(!contactsGrid || !nearbyGrid) return;

    // Load from Flask SQLite API
    fetch('/contacts')
    .then(res => res.json())
    .then(contacts => {

        contactsGrid.innerHTML = "";
        
        // Clear nearby support grid only if OSM elements are not plotted
        if (policeMarkers.length === 0 && hospitalMarkers.length === 0) {
            nearbyGrid.innerHTML = "";
        }

        contacts.forEach((contact, index) => {
            
            const initial = contact.name ? contact.name.charAt(0).toUpperCase() : '👤';

            contactsGrid.innerHTML += `
                <div class="contact-card" data-index="${index}">
                    <div class="contact-avatar">${initial}</div>
                    <div class="contact-info">
                        <span class="contact-name">${contact.name}</span>
                        <span class="contact-phone"><i class="fa-solid fa-phone"></i> ${contact.phone}</span>
                    </div>
                    <div class="contact-actions">
                        <button onclick="editContact(${index})" class="contact-btn edit-btn" title="Edit Contact">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="deleteContact(${index})" class="contact-btn delete-btn" title="Delete Contact">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            if (policeMarkers.length === 0 && hospitalMarkers.length === 0) {
                nearbyGrid.innerHTML += `
                    <div class="nearby-card">
                        <div class="nearby-avatar"><i class="fa-solid fa-user-shield"></i></div>
                        <div class="nearby-details">
                            <span class="name">${contact.name}</span>
                            <span class="tag">Trusted Contact</span>
                        </div>
                    </div>
                `;
            }

        });

        updateContactCount();

    })
    .catch(err => {
        console.error("Error fetching contacts from DB:", err);
    });

}

function updateContactCount(){
    const count = document.querySelectorAll(".contact-card").length;
    const contactCount = document.getElementById("contact-count");

    if(contactCount){
        contactCount.innerHTML = count + " Registered";
    }
}

/* -----------------------------------------
   Persistent Settings & Profile Modals
   ----------------------------------------- */
function openSettings() {
    const modal = document.getElementById("settings-modal");
    if (modal) {
        modal.style.display = "flex";
        fetchUserSettings();
    }
}

// Close Settings Modal
function closeSettings() {
    const modal = document.getElementById("settings-modal");
    if (modal) modal.style.display = "none";
}

function fetchUserSettings() {
    fetch('/settings')
    .then(res => res.json())
    .then(data => {
        
        document.getElementById("profile-name").value = data.name;
        document.getElementById("profile-phone").value = data.phone;
        
        document.getElementById("setting-auto-sos").checked = data.auto_sos;
        document.getElementById("setting-voice-sos").checked = data.voice_sos;
        document.getElementById("setting-notifications").checked = data.notifications;
        document.getElementById("setting-dark-mode").checked = data.dark_mode;
        document.getElementById("setting-language").value = data.language;
        
        document.getElementById("sidebar-user-name").innerHTML = data.name;
        
        autoSosEnabled = data.auto_sos;
        voiceSosEnabled = data.voice_sos;
        notificationsEnabled = data.notifications;
        
        toggleDarkModeFilter(data.dark_mode);

    })
    .catch(err => console.error("Error reading database configurations:", err));
}

function saveSettings(event) {
    if (event) event.preventDefault();

    const name = document.getElementById("profile-name").value.trim();
    const phone = document.getElementById("profile-phone").value.trim();
    
    const auto_sos = document.getElementById("setting-auto-sos").checked;
    const voice_sos = document.getElementById("setting-voice-sos").checked;
    const notifications = document.getElementById("setting-notifications").checked;
    const dark_mode = document.getElementById("setting-dark-mode").checked;
    const language = document.getElementById("setting-language").value;

    if (!name || !phone) {
        addNotification("Validation warning: Name and phone profile updates required.", "warning");
        return;
    }

    if (!/^\d{10}$/.test(phone)) {
        addNotification("Validation warning: Phone number must be exactly 10 digits.", "warning");
        return;
    }

    fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            phone: phone,
            auto_sos: auto_sos,
            voice_sos: voice_sos,
            notifications: notifications,
            dark_mode: dark_mode,
            language: language
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'error') {
            addNotification("Server warning: " + data.message, "warning");
            return;
        }
        if (data.status === 'success') {
            addNotification("Profile settings synchronized with cloud databases.", "success");
            
            autoSosEnabled = auto_sos;
            voiceSosEnabled = voice_sos;
            notificationsEnabled = notifications;
            
            document.getElementById("sidebar-user-name").innerHTML = name;
            toggleDarkModeFilter(dark_mode);
            closeSettings();
        }
    })
    .catch(err => {
        console.error("Error updating settings:", err);
    });
}

function toggleDarkModeFilter(enabled) {
    const mapContainer = document.getElementById("map");
    if (mapContainer) {
        if (enabled) {
            mapContainer.classList.add("dark-map-filter");
        } else {
            mapContainer.classList.remove("dark-map-filter");
        }
    }
}

/* -----------------------------------------
   Floating AI Chatbot Assistant
   ----------------------------------------- */
function toggleChat() {
    const chatWidget = document.getElementById("chatbot-container");
    if (chatWidget) {
        chatWidget.classList.toggle("collapsed");
        chatWidget.classList.toggle("expanded");
    }
}

function handleChatKey(event) {
    if (event.key === "Enter") {
        sendChatMessage();
    }
}

// Send user message queries to server safety bot
function sendChatMessage() {
    const input = document.getElementById("chat-input");
    if (!input || !input.value.trim()) return;

    const message = input.value.trim();
    input.value = "";

    const chatMessages = document.getElementById("chat-messages");
    const userDiv = document.createElement("div");
    userDiv.className = "chat-message user";
    userDiv.innerHTML = message;
    chatMessages.appendChild(userDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const scoreEl = document.getElementById("ai-score");
    const score = scoreEl ? parseInt(scoreEl.innerText) || 90 : 90;

    const safetyEl = document.getElementById("safety-status");
    const safety = safetyEl ? safetyEl.innerText.replace("🟢", "").replace("🟡", "").replace("🔴", "").trim() : "SAFE";

    const routeDest = document.getElementById("route-destination-text");
    const closest = routeDest ? routeDest.innerText.replace("👮", "").trim() : "Sadar Patrolling Post";

    const contactsCount = document.querySelectorAll(".contact-card").length;

    // POST prompt message queries to server API
    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: message,
            score: score,
            safety: safety,
            closest_station: closest,
            contacts_count: contactsCount
        })
    })
    .then(res => res.json())
    .then(data => {
        const botDiv = document.createElement("div");
        botDiv.className = "chat-message bot";
        botDiv.innerHTML = data.reply;
        chatMessages.appendChild(botDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    })
    .catch(err => {
        console.error("Chatbot Error:", err);
    });
}

/* -----------------------------------------
   Safety Session Reports Export
   ----------------------------------------- */
function exportSessionReport() {

    const contacts = Array.from(document.querySelectorAll("#contacts-grid .contact-card"))
        .map(el => `<li>${el.querySelector(".contact-name").innerText} (${el.querySelector(".contact-phone").innerText})</li>`).join("") || "<li>No contacts registered</li>";

    const historyItems = Array.from(document.querySelectorAll("#prediction-history .history-item"))
        .map(el => `<li>${el.innerText}</li>`).join("") || "<li>No prediction scans performed yet</li>";

    const activityItems = Array.from(document.querySelectorAll("#activity-log .history-card"))
        .map(el => `<li>${el.innerText}</li>`).join("") || "<li>No activities logged</li>";

    const reportWindow = window.open("", "_blank");
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SafeHer Analytics Session Report</title>
            <style>
                body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 45px; background: #fafafb; color: #1f2937; }
                .report-card { max-width: 750px; margin: 0 auto; background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
                .header { border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                .logo-text { font-size: 24px; font-weight: 800; color: #4f46e5; }
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .meta-table td { padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
                .section { margin-bottom: 30px; }
                .section h3 { font-size: 16px; font-weight: 700; color: #374151; border-left: 4px solid #6366f1; padding-left: 10px; margin-bottom: 15px; }
                ul { padding-left: 20px; line-height: 1.6; font-size: 14px; color: #4b5563; }
                .btn-print { background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
                .btn-print:hover { background: #3730a3; }
                @media print { .btn-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="report-card">
                <button class="btn-print" onclick="window.print()">Print Report / Save PDF</button>
                <div class="header">
                    <div>
                        <span class="logo-text">SafeHer</span>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">AI Safety Analytics Session Logs</p>
                    </div>
                    <span style="font-weight: 700; color: #10b981; font-size: 14px;">Protected</span>
                </div>
                <table class="meta-table">
                    <tr>
                        <td><b>Session Start Time:</b> ${sessionStartTime}</td>
                        <td><b>Report Export Time:</b> ${new Date().toLocaleTimeString()}</td>
                    </tr>
                    <tr>
                        <td><b>Last Coordinates:</b> ${lastKnownLat.toFixed(6)}, ${lastKnownLng.toFixed(6)}</td>
                        <td><b>Current Status:</b> ${document.getElementById("safety-status") ? document.getElementById("safety-status").innerText : 'Safe'}</td>
                    </tr>
                </table>
                <div class="section">
                    <h3>Emergency Network</h3>
                    <ul>${contacts}</ul>
                </div>
                <div class="section">
                    <h3>AI Risk Trend Checks</h3>
                    <ul>${historyItems}</ul>
                </div>
                <div class="section">
                    <h3>Recent Event Timeline</h3>
                    <ul>${activityItems}</ul>
                </div>
            </div>
        </body>
        </html>
    `);
    reportWindow.document.close();

}

/* -----------------------------------------
   Line Chart Engine (Chart.js)
   ----------------------------------------- */
function initializeSafetyChart() {

    const ctx = document.getElementById('risk-chart');
    if (!ctx) return;

    const now = new Date();
    
    // Simulate safety trends logs for Nagpur for initial visual rendering
    for (let i = 5; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 12 * 60 * 1000);
        safetyTimeline.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        safetyHistory.push(Math.round(75 + Math.random() * 20));
    }

    safetyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: safetyTimeline,
            datasets: [{
                label: 'Safety Score %',
                data: safetyHistory,
                borderColor: '#6366f1',
                borderWidth: 2.5,
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                fill: true,
                tension: 0.35,
                pointRadius: 2.5,
                pointBackgroundColor: '#8b5cf6',
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 9 } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                }
            }
        }
    });

}

function updateSafetyChart(newScore) {

    if (!safetyChart) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    safetyTimeline.push(timeStr);
    safetyHistory.push(newScore);

    if (safetyTimeline.length > 7) {
        safetyTimeline.shift();
        safetyHistory.shift();
    }

    safetyChart.update();

}

/* -----------------------------------------
   System Notification Center (Auto Dismiss)
   ----------------------------------------- */
function addNotification(message, type = "info") {

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const notificationId = "notif_" + Date.now() + Math.round(Math.random() * 1000);

    notifications.unshift({
        id: notificationId,
        message: message,
        type: type,
        time: timeStr
    });

    if (notifications.length > 8) {
        notifications.pop();
    }

    renderNotifications();

    // Auto dismiss notification after 5 seconds
    setTimeout(() => {
        // filter out dismissed notification
        notifications = notifications.filter(n => n.id !== notificationId);
        renderNotifications();
    }, 5000);

}

function renderNotifications() {

    const list = document.getElementById("notification-list");
    const count = document.getElementById("notification-count");

    if (!list || !count) return;

    count.innerHTML = notifications.length;
    list.innerHTML = "";
    
    if (notifications.length === 0) {
        list.innerHTML = `<div class="notification-item empty">No notifications</div>`;
        return;
    }
    
    notifications.forEach(item => {
        
        let icon = '<i class="fa-solid fa-circle-info" style="color: var(--primary)"></i>';
        if (item.type === "success") icon = '<i class="fa-solid fa-circle-check" style="color: var(--success)"></i>';
        if (item.type === "warning") icon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--warning)"></i>';
        if (item.type === "danger") icon = '<i class="fa-solid fa-circle-radiation" style="color: var(--danger)"></i>';

        list.innerHTML += `
            <div class="notification-item" id="${item.id}">
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <span style="margin-top: 1px;">${icon}</span>
                    <div>
                        <p style="margin: 0; font-size: 11px; font-weight: 500;">${item.message}</p>
                        <span class="time">${item.time}</span>
                    </div>
                </div>
            </div>
        `;

    });

}

function toggleNotifications(event) {
    
    event.stopPropagation();
    const dropdown = document.getElementById("notification-dropdown");
    if (dropdown) {
        dropdown.classList.toggle("active");
    }

}

// Close dropdown clicking anywhere else
document.addEventListener("click", function() {
    
    const dropdown = document.getElementById("notification-dropdown");
    if (dropdown) {
        dropdown.classList.remove("active");
    }

});

/* -----------------------------------------
   System Activity Timeline Log
   ----------------------------------------- */
function addActivity(message){

    const activityLog = document.getElementById("activity-log");
    if(!activityLog) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    activityLog.innerHTML =
        `
        <div class="history-card" tabindex="0">
            <p>${message}</p>
            <span>${now}</span>
        </div>
        ` + activityLog.innerHTML;

}

/* -----------------------------------------
   Helper Mathematics Formulas
   ----------------------------------------- */
function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;

}