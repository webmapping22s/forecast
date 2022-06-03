# Wettervorhersage Applikation (Teil 2) - Wettervorhersage MET Norway implementieren

## Wettervorhersage MET Norway implementieren

Quelle: [MET Norway Weather API v.3](https://api.met.no/) - [Locationforecast (compact)](https://api.met.no/weatherapi/locationforecast/2.0/documentation)

### a) Die Daten asynchron in der Funktion loadWeather laden

```javascript
const response = await fetch(url);
const jsondata = await response.json();
console.log(jsondata);
```

Wir sehen ein GeoJSON Objekt vom Typ `Point` mit Koordinaten und Seehöhe in `geometry.coordinates`, Metadaten der Attribute in `properties.meta` sowie den eigentlichen Vorhersagedaten im Array `properties.timeseries`. Jeder Eintrag dieses Array besitzt einen Zeitstempel `time`, die vorhergesagten Werte in `data.instant.details` sowie Wetteraussichten mit voraussichtlichen Niederschlagsmengen für die nächsten 1, 6 und 12 Stunden in `data.next_n_hours`

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/74547a8c80208fa5f3f01b0770053ac26860e542) (dieser COMMIT enthält leider auch den, zuvor vergessenen Schritt der Plugin Konfiguration von Leaflet velocity)

### b) Einen Marker mit Popup in einem neuen Overlay vorbereiten

Bevor wir die Wettervorhersage für den Referenzpunkt visualisieren, hängen wir **außerhalb** der Funktion `loadWeather` das Overlay für die Wettervorhersage an die Layer control

```javascript
layerControl.addOverlay(overlays.weather, "Wettervorhersage met.no");
```

Gleich danach defineren wir einen neuen [L.circleMarker](https://leafletjs.com/reference.html#circlemarker), geben ihm die vorläufigen Koordinaten `[0,0]`, fügen ein Popup hinzu und hängen das Ganze an das soeben erstellte Overlay. Damit wir später auf den Marker und das Popup zugreifen können, merken wir uns den Marker in einer Variablen `marker`

```javascript
let marker = L.circleMarker([
    47.267222, 11.392778
]).bindPopup("Wettervorhersage").addTo(overlays.weather);
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/06e815b41298c1150d5d8c0c9e7de59502220d00)

Leider landeten Marker und Overlay im vorhergehenden Schritt innerhalb der Funktion, weshalb eine Verschiebung des Codes vor die Funktion nötig war

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/c2e3551b2eb32a2717a2087dfe9f13ec4fe5226d)

Marker und Overlay sind damit verfügbar und können **innerhalb**  der Funktion `loadWeather` befüllt werden

### c) Marker positionieren

Die Positionierung des Markers erledigt [.setLatLng()](https://leafletjs.com/reference.html#circlemarker-setlatlng) für uns. Die Kordinaten entnehmen wir der Geometrie des GeoJSON-Objekts

```javascript
// Marker positionieren
marker.setLatLng([
    jsondata.geometry.coordinates[1],
    jsondata.geometry.coordinates[0]
]);
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/a365629da64119526eb50c2ec626536ff8a2c8bd)

### d) Aktuelle Wetterwere in das Popup schreiben

Die aktuellen Wetterwerte finden wir im ersten Eintrag des `jsondata.properties.timeseries` Array und dort in `jsondata.properties.timeseries[0].data.instant.details` - ein *shortcut* zu diesen tief verschachtelten Details bietet sich an:

```javascript
let details = jsondata.properties.timeseries[0].data.instant.details;
```

Danach definieren wir in einer Variablen `popup` mit Template-Syntax die aktuellen Wetterwerte als ungeordnete Liste. Die Windgschwindigkeit rechnen wir in km/h um.

```javascript
let popup = `
    <ul>
        <li>Luftdruck: ${details.air_pressure_at_sea_level} (hPa)</li>
        <li>Luftemperatur: ${details.air_temperature} (°C)</li>
        <li>Bewölkung: ${details.cloud_area_fraction} (%)</li>
        <li>Niederschlag: ${details.precipitation_amount} (mm)</li>
        <li>Relative Luftfeuchtigkeit: ${details.relative_humidity} (%)</li>
        <li>Windrichtung: ${details.wind_from_direction} (°)</li>
        <li>Windgeschwindigkeit: ${details.wind_speed * 3.6} (km/h)</li>
    </ul>
`;
```

Den Popupinhalt des Markers können wir schließlich über die Methode [.setPopupContent()](https://leafletjs.com/reference.html#circlemarker-setpopupcontent) setzen und mit [.openPopup()](https://leafletjs.com/reference.html#circlemarker-openpopup) das Popup anzeigen.

```javascript
marker.setPopupContent(popup).openPopup();
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/28d668e58854f3927dbd3258a6bd7d443576a15b)

### e) Überschrift mit Datum der Wetterwerte beim Popup ergänzen

Ähnlich wie beim Vorhersagezeitpunkt der ECMWF Windvorhersage, können wir auch den Zeitpunkt der Wettervorhersage bestimmen und formatieren. Wir finden das Datum für die Details des Popups im ersten Eintrag des `timeseries` Arrays im Attribut `time`, definieren ein **echtes** Datum damit und formatieren es wieder über unsere `formatDate` Funktion.

```javascript
let forecastDate = new Date(jsondata.properties.timeseries[0].time);
let forecastLabel = formatDate(forecastDate);
```

Danach können wir beim Popup eine Überschrift mit Datum ergänzen

```javascript
let popup = `
    <strong>Wettervorhersage für ${forecastLabel}</strong>
    <!-- Liste -->
`;
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/c046ea44e736f7089bfea6c5f2f028f1417341c3)

### f) Wettervorhersage für jeden Ort der Welt implementieren

Alles was wir für unser Vorhersagepopup benötigen, bekommen wir vom [Locationforecast (compact)](https://api.met.no/weatherapi/locationforecast/2.0/documentation) indem wir die Koordinaten LAT/LNG übergeben. Leaflet kann uns `onclick` für jeden Punkt der Karte diese Werte liefern und deshalb ist es einfach, für jeden Punkt der Erde ein Popup mit der Vorhersage zu generieren. Wir müssen nur auf das Klicken auf die Karte reagieren und unsere Funktion `loadWeather` mit der passenden URL füttern. In *Leafletsprache* sieht das (ganz am Ende des Skripts) so aus:

```javascript
map.on("click", function(evt) {
    console.log(evt);
});
```

Im Klickevent finden wir in `evt.latlng.lat` und  `evt.latlng.lng` die Koordinaten des geklickten Punkts aus denen wir die URL für <https://api.met.no/> generieren können. Der Aufruf der Funktion `loadWeather` mit dieser URL platziert den Marker neu und holt sich die Vorhersage für diesen Punkt

```javascript
// auf Klick auf die Karte reagieren
map.on("click", function(evt) {
    let url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${evt.latlng.lat}&lon=${evt.latlng.lng}`;
    loadWeather(url);
});
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/2bdada71ea78fb9c8b6bd1f720e876eb5fd94f43)


### g) Wettersymbole für die nächsten 24 Stunden in 3 Stunden Abständen hinzufügen

Nachdem der `timeseries` Array aus 89 Einträge in Stunden- und 6 Stundenabständen besteht, können wir die Witterungsprognose für die nächsten 24 Stunden in 3 Stundenschritten implementieren. Wir verwenden dazu jeweils das Wettersymbol in `data.next_1_hours.summary.symbol_code`. Für alle dort möglichen Werte stellt uns der [Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation#Weather_icons) unter dem Link [WeatherIcon 2.0 service](https://api.met.no/weatherapi/weathericon/2.0/documentation) passende Icons zur Verfügung, die wir uns als erstes in einem Unterverzeichnis `icons/` speichern. Wir verwenden die *SVG-Version* da sie skalierbar ist und weniger Speicherplatz benötigt

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/e7450b21a254ea023d8931b6b3e21bfe4727abb9)

Am Beispiel des ersten Eintrags im `timeseries`Array finden wir den Dateinamen des gewünschten Symbols für die aktuelle Wetterlage im längsten verschachtelten Objekt, das wir bisher kennengelernt haben ;-) Wir speichern den Wert von `jsondata.properties.timeseries[0].data.next_1_hours.summary.symbol_code` in einer Variablen `symbol` und fügen ein &lt;img> Element mit diesem Icon über `+=` zum Popup hinzu. Ein `style`-Attribut verkleinert die Breite des Icons auf `32px` Breite. Den Code schreiben wir direkt vor `marker.setPopupContent()`

```javascript
    // Wettericon
    let symbol = jsondata.properties.timeseries[0].data.next_1_hours.summary.symbol_code;
    popup += `<img src="icons/${symbol}.svg" alt="${symbol}" style="width:32px">`;
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/f2572802c57c89e01d58aa463a63d1fe24c3f20a)

Um alle Icons der nächsten 24 Stunden in 3 Stunden Schritten anzuzeigen, können wir in einer klassischen `for-Schleife` mit einer Schleifenvariable `i` den `timeseries` Array abarbeiten. Nach jedem Schleifendurchlauf erhöhen wir die Zählervariable um `3` (Stunden) und beenden die Schleife beim Wert `24`. Wir verpacken also den Code für unser Icon der aktuellen Wetterlage in diese `for`-Schleife und ändern `timeseries[0]` auf `timeseries[i]`

```javascript
// Wettericons
for (let i=0; i <= 24; i+=3) {
    let symbol = jsondata.properties.timeseries[i].data.next_1_hours.summary.symbol_code;
    popup += `<img src="icons/${symbol}.svg" alt="${symbol}" style="width:32px">`;
}
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/6db9c33973b3e707fded27e003c67bb2adf42ba0)


Zur besseren Lesbarkeit ergänzen wir bei den Symbolen das jeweilige Datum als Tooltip über ein `title-Attribut`. Das Datum finden wir in `jsondata.properties.timeseries[i].time` - wir formatieren es analog zum Vorhersagezeitpunkt mit der `formatdate` Funktion und setzten es als `title-Attribut` beim Symbolbild ein

```javascript
let forecastDate = new Date(jsondata.properties.timeseries[i].time);
let forecastLabel = formatDate(forecastDate);
popup += `<img src="icons/${symbol}.svg" title="${forecastLabel}" alt="${symbol}" style="width:32px">`;
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/e5bbbaf2048f501c82ce37a5ef64e9ed9bae3047)

**Kosmetik**: die Windgeschwindigkeit kann noch ein `.toFixed(1)` vertragen

```javascript
<li>Windgeschwindigkeit: ${(details.wind_speed * 3.6).toFixed(1)} (km/h)</li>
```

[🔗 COMMIT](https://github.com/webmapping/forecast/commit/d04a9020fc5e74bf485ad4f1f8f41c1bbb349fab)
