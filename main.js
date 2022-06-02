// Wettervorhersage Beispiel

// Hintergrundlayer Satellitenbild
let startLayer = L.tileLayer.provider("Esri.WorldImagery")

// Blick auf Innsbruck
const map = L.map("map", {
    center: [47.267222, 11.392778],
    zoom: 5,
    layers: [
        startLayer
    ]
});

// Overlays für Wind- und Wettervorhersage
const overlays = {
    "wind": L.featureGroup().addTo(map),
    "weather": L.featureGroup().addTo(map),
};

// Layer control mit Satellitenbild
const layerControl = L.control.layers({
    "Satellitenbild": startLayer
}).addTo(map);

// Maßstab
L.control.scale({
    imperial: false
}).addTo(map);

// Datum formatieren
let formatDate = function(date) {
    return date.toLocaleDateString("de-AT", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }) + " Uhr";
}

// Windvorhersage
async function loadWind(url) {
    const response = await fetch(url);
    const jsondata = await response.json();
    //console.log("Jsondaten", jsondata);
    //console.log("Zeitpunkt Erstellung", jsondata[0].header.refTime);
    //console.log("Zeitpunkt Vorhersage (+Stunden)", jsondata[0].header.forecastTime);

    let forecastDate = new Date(jsondata[0].header.refTime);
    //console.log("Echtes Datum Erstellung", forecastDate);
    forecastDate.setHours(forecastDate.getHours() + jsondata[0].header.forecastTime);
    //console.log("Echtes Datum Vorhersage", forecastDate);

    let forecastLabel = formatDate(forecastDate);
    //console.log("Vorhersagezeitpunkt", forecastLabel);

    layerControl.addOverlay(overlays.wind, `ECMWF Windvorhersage für ${forecastLabel}`)

    L.velocityLayer({
        data: jsondata,
        lineWidth: 2,
        displayOptions: {
            velocityType: "",
            directionString: "Windrichtung",
            speedString: "Windgeschwindigkeit",
            speedUnit: "k/h",
            emptyString: "keine Daten vorhanden",
            position: "bottomright"
        }
    }).addTo(overlays.wind);
};
loadWind("https://geographie.uibk.ac.at/webmapping/ecmwf/data/wind-10u-10v-europe.json");

// Wettervorhersage
async function loadWeather(url) {
    const response = await fetch(url);
    const jsondata = await response.json();
    //console.log("Jsondaten", jsondata);

    layerControl.addOverlay(overlays.weather, "Wettervorhersage met.no");

    let marker = L.circleMarker([
        47.267222, 11.392778
    ]).bindPopup("Wettervorhersage").addTo(overlays.weather);
};
loadWeather("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=47.267222&lon=11.392778");