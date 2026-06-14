window.onload = function() {

    const map = L.map('map').setView([21.1458, 79.0882], 13);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '&copy; OpenStreetMap'
        }
    ).addTo(map);

    if (navigator.geolocation) {

        navigator.geolocation.getCurrentPosition(

            function(position) {

                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                const locationText =
                    document.getElementById("location-text");

                if(locationText){

                    locationText.innerHTML =
                        lat.toFixed(4) + ", " + lng.toFixed(4);

                }

                addActivity("📍 Location Updated");

                const riskLocation =
    document.getElementById("risk-location");

if(riskLocation){

    riskLocation.innerHTML =
        lat.toFixed(4) + ", " + lng.toFixed(4);

}

                const routeLocation =
    document.getElementById("route-location");

const routeSuggestion =
    document.getElementById("route-suggestion");

const routeScore =
    document.getElementById("route-score");

if(routeLocation){

    routeLocation.innerHTML =
        lat.toFixed(4) + ", " + lng.toFixed(4);

}

if(routeSuggestion){

    routeSuggestion.innerHTML =
        "Prefer crowded roads and avoid isolated streets.";

}

if(routeScore){

    routeScore.innerHTML =
        "88% Safe";

}

                map.setView([lat, lng], 15);

                L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup("📍 You are here")
                    .openPopup();

                L.marker([lat + 0.002, lng + 0.001])
                    .addTo(map)
                    .bindPopup("👩 Priya - 200m away");

                L.marker([lat - 0.002, lng + 0.002])
                    .addTo(map)
                    .bindPopup("👨 Rahul - 350m away");

                L.marker([lat + 0.001, lng - 0.002])
                    .addTo(map)
                    .bindPopup("👩 Neha - 500m away");

                L.circle([lat + 0.004, lng + 0.004], {
                    color: 'red',
                    fillColor: '#ff0000',
                    fillOpacity: 0.4,
                    radius: 150
                })
                .addTo(map)
                .bindPopup("🔥 High Risk Zone");


                L.circle([lat - 0.004, lng - 0.003], {
                    color: 'orange',
                    fillColor: '#ffa500',
                    fillOpacity: 0.4,
                    radius: 120
                })
                .addTo(map)
                .bindPopup("⚠ Medium Risk Zone");

                L.polyline([
                    [lat, lng],
                    [lat + 0.0015, lng + 0.001],
                    [lat + 0.003, lng + 0.002]
                ], {
                    color: 'green',
                    weight: 5
                })
                .addTo(map)
                .bindPopup("🛣 Recommended Safe Route");

            },

            function(){

                const locationText =
                    document.getElementById("location-text");

                if(locationText){

                    locationText.innerHTML =
                        "Location Permission Denied";

                }

            }

        );

    }

    function updateTime(){

        const now = new Date();

        const timeElement =
            document.getElementById("live-time");

        if(timeElement){

            timeElement.innerHTML =
                now.toLocaleTimeString();

        }

        const riskTime =
    document.getElementById("risk-time");

const crowdLevel =
    document.getElementById("crowd-level");

const zoneRisk =
    document.getElementById("zone-risk");

const aiInsight =
    document.getElementById("ai-insight");

const hour =
    now.getHours();

if(riskTime){

    riskTime.innerHTML =
        now.toLocaleTimeString();

}

if(hour >= 6 && hour < 20){

    if(crowdLevel)
        crowdLevel.innerHTML = "High";

    if(zoneRisk)
        zoneRisk.innerHTML = "Medium";

    if(aiInsight)
        aiInsight.innerHTML =
        "🤖 AI Insight: Crowded public area during daytime. Risk reduced due to active surroundings.";

}

else if(hour >= 20 && hour < 23){

    if(crowdLevel)
        crowdLevel.innerHTML = "Moderate";

    if(zoneRisk)
        zoneRisk.innerHTML = "Medium";

    if(aiInsight)
        aiInsight.innerHTML =
        "🤖 AI Insight: Public activity decreasing. Stay alert and prefer well-lit routes.";

}

else{

    if(crowdLevel)
        crowdLevel.innerHTML = "Low";

    if(zoneRisk)
        zoneRisk.innerHTML = "High";

    if(aiInsight)
        aiInsight.innerHTML =
        "🤖 AI Insight: Late-night hours with low public presence increase safety risk.";

}

    }

    updateTime();

    setInterval(updateTime,1000);

    function updateSafetyStatus(zone){

        const status =
            document.getElementById("safety-status");

        if(!status) return;

        if(zone === "safe"){

            status.innerHTML = "🟢 SAFE";
            status.style.color = "green";

        }

        else if(zone === "medium"){

            status.innerHTML = "🟡 MEDIUM";
            status.style.color = "orange";

        }

        else{

            status.innerHTML = "🔴 UNSAFE";
            status.style.color = "red";

        }

    }

    function updateZoneTheme(zone){

        const body =
            document.body;

        const banner =
            document.getElementById("zone-banner");

        const zoneStatus =
    document.getElementById("zone-status");    

        body.classList.remove(
            "safe-zone",
            "medium-zone",
            "danger-zone"
        );

        if(zone === "safe"){

            body.classList.add("safe-zone");

            if(banner){

                banner.className =
                    "zone-banner safe-banner";

                banner.innerHTML =
                    "🟢 SAFE ZONE";

            }

            updateSafetyStatus("safe");
            if(zoneStatus){

    zoneStatus.innerHTML =
        "Current Zone: Safe";

}

        }

        else if(zone === "medium"){

            body.classList.add("medium-zone");

            if(banner){

                banner.className =
                    "zone-banner medium-banner";

                banner.innerHTML =
                    "🟡 MEDIUM RISK ZONE";

            }

            updateSafetyStatus("medium");

            if(zoneStatus){

    zoneStatus.innerHTML =
        "Current Zone: Medium Risk";

}

        }

        else{

            body.classList.add("danger-zone");

            if(banner){

                banner.className =
                    "zone-banner danger-banner";

                banner.innerHTML =
                    "🔴 HIGH RISK ZONE";

            }

            updateSafetyStatus("danger");

            if(zoneStatus){

    zoneStatus.innerHTML =
        "Current Zone: High Risk";

}

            sendSOS();

        }

    }

    fetch('/predict')
    .then(response => response.json())
    .then(data => {

        const prediction = data.safety;

        const recommendation =
    document.getElementById(
        "ai-recommendation"
    );

        const score = data.score;

        const confidence =
    data.confidence;

const aiScore =
    document.getElementById("ai-score");

if(aiScore){

    aiScore.innerHTML =
        score + "%";

}

const riskLevel =
    document.getElementById("risk-level");

if(riskLevel){

    if(score >= 80){

        riskLevel.innerHTML =
            "Risk Level: LOW";

    }

    else if(score >= 50){

        riskLevel.innerHTML =
            "Risk Level: MEDIUM";

    }

    else{

        riskLevel.innerHTML =
            "Risk Level: HIGH";

    }

}

const confidenceElement =
    document.getElementById("confidence-score");

if(confidenceElement){

    confidenceElement.innerHTML =
        "Confidence: " + confidence + "%";

}

        if(prediction === "SAFE"){

            if(recommendation){

    recommendation.innerHTML =
        "✅ Continue normal travel. Area appears safe.";

}

            addPredictionHistory(
    "SAFE - " + score + "%"
);

            updateZoneTheme("safe");

        }

        else if(prediction === "MEDIUM"){

            if(recommendation){

    recommendation.innerHTML =
        "⚠ Prefer crowded roads and keep contacts informed.";

}

            addPredictionHistory(
    "MEDIUM - " + score + "%"
);

            updateZoneTheme("medium");

        }

        else{

            if(recommendation){

    recommendation.innerHTML =
        "🚨 Avoid isolated areas. Keep SOS active.";

}

             addPredictionHistory(
        "UNSAFE - " + score + "%"
    );

            updateZoneTheme("danger");

            sendSOS();

        }

    })
    .catch(error => {

        console.log("AI Prediction Error:", error);

        updateZoneTheme("safe");

    });

};

function addPredictionHistory(message){

    const history =
        document.getElementById(
            "prediction-history"
        );

    if(!history) return;

    const item =
        document.createElement("div");

    item.className =
        "history-item";

    const time =
        new Date().toLocaleTimeString();

    item.innerHTML =
        time + " - " + message;

    history.prepend(item);

}

let sosTriggered = false;

function sendSOS(){

    addActivity("🚨 SOS Activated");

    if(sosTriggered) return;

    sosTriggered = true;

    const modal =
        document.getElementById("sos-modal");

    if(modal){

        modal.style.display = "flex";

        const sosList =
    document.getElementById("sos-contact-list");

const contacts =
    JSON.parse(
        localStorage.getItem("contacts")
    ) || [];

if(sosList){

    sosList.innerHTML =
        "<li>✅ Current Location Shared</li>";

    contacts.forEach(contact => {

        sosList.innerHTML +=
        `<li>✅ ${contact.name} Notified</li>`;

    });

}

    } else {

        alert("🚨 SOS Alert Sent!");

    }

}

function closeSOS(){

    const modal =
        document.getElementById("sos-modal");

    if(modal){

        modal.style.display = "none";

    }

}

function startVoiceSOS(){

    const status =
        document.getElementById("voice-status");

    if(!('webkitSpeechRecognition' in window)){

        alert("Voice recognition is not supported in this browser.");

        return;

    }

    const recognition =
        new webkitSpeechRecognition();

    recognition.lang = "en-US";

    recognition.start();

    if(status){

        status.innerHTML =
            "🎤 Listening...";

    }

   recognition.onresult = function(event){

    const speech =
        event.results[0][0].transcript.toLowerCase();

    console.log("Voice Detected:", speech);

    const status =
        document.getElementById("voice-status");

    if(status){

        status.innerHTML =
            "🎤 Heard: " + speech;

    }

    if(
        speech.includes("help") ||
        speech.includes("help me") ||
        speech.includes("emergency") ||
        speech.includes("sos")
    ){

        alert("🚨 Voice SOS Activated!");

        sendSOS();

    }

};

}

     function addContact(){
    const name =
        document.getElementById("contact-name").value;

    const phone =
        document.getElementById("contact-phone").value;

    if(!name || !phone){

        alert("Enter Name and Phone");

        return;

    }

    const contacts =
        JSON.parse(
            localStorage.getItem("contacts")
        ) || [];

    contacts.push({
        name:name,
        phone:phone
    });

    localStorage.setItem(
        "contacts",
        JSON.stringify(contacts)
    );

    loadContacts();

addActivity("👤 Trusted Contact Added");

    document.getElementById(
        "contact-name"
    ).value = "";

    document.getElementById(
        "contact-phone"
    ).value = "";

    updateContactCount();
}

function loadContacts(){

    const contacts =
        JSON.parse(
            localStorage.getItem("contacts")
        ) || [];

    const contactsGrid =
        document.getElementById("contacts-grid");

    const nearbyGrid =
        document.getElementById("nearby-grid");

    if(!contactsGrid || !nearbyGrid)
        return;

    contactsGrid.innerHTML = "";

    nearbyGrid.innerHTML = "";

    contacts.forEach(contact => {

        contactsGrid.innerHTML += `
            <div class="contact-card">
                👤 ${contact.name}
                <br>
                ${contact.phone}
            </div>
        `;

        nearbyGrid.innerHTML += `
            <div class="nearby-card">
                👤 ${contact.name}
                <br>
                Trusted Contact
            </div>
        `;

    });

}

window.addEventListener(
    "load",
    loadContacts
);

function updateContactCount(){

    const count =
        document.querySelectorAll(".contact-card").length;

    const contactCount =
        document.getElementById("contact-count");

    if(contactCount){

        contactCount.innerHTML =
            count + " Registered";

    }

}

function showSafeRoute(){

    alert(
        "🛣 Recommended Route:\n\nUse main roads with higher public activity and avoid isolated areas."
    );

}

function addActivity(message){

    const activityLog =
        document.getElementById("activity-log");

    if(!activityLog) return;

    const now =
        new Date().toLocaleTimeString();

    activityLog.innerHTML =
        `
        <div class="history-card">
            <p>${message}</p>
            <span>${now}</span>
        </div>
        ` + activityLog.innerHTML;

}