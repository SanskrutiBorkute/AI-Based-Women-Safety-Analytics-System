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

                setTimeout(function(){

                    const zoneStatus =
                        document.getElementById("zone-status");

                    if(zoneStatus){

                        zoneStatus.innerHTML =
                            "Current Zone: 🔴 High Risk";

                    }

                    updateZoneTheme("danger");

                },15000);

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

            sendSOS();

        }

    }

    updateZoneTheme("safe");

    setTimeout(function(){

        updateZoneTheme("medium");

    },5000);

    setTimeout(function(){

        updateZoneTheme("danger");

    },10000);

};

function sendSOS(){

    const modal =
        document.getElementById("sos-modal");

    if(modal){

        modal.style.display = "flex";

    }
    else{

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

        if(status){

            status.innerHTML =
                "Heard: " + speech;

        }

        if(
            speech.includes("help me") ||
            speech.includes("help") ||
            speech.includes("emergency")
        ){

            sendSOS();

        }

    };

}