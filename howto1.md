
# Wettervorhersage Applikation (Teil 1) - ECMWF Windvorhersage mit Leaflet velocity

## 1. Repo vorbereiten

Repo `forecast` erstellen, lokal clonen, Template auspacken, `add` und `push` wie beim [Wienbeispiel](https://webmapping22s.github.io/wien/howto1#repo-wien-erstellen-und-online-bringen)

[🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/cfb9c15ca17178586f7a05ea25c41219747ebba8)

## 2. ECMWF Windvorhersage implementieren

Die vom Leaflet velocity Plugin benötigten Daten liegen auf dem Server der Geographie unter [wind-10u-10v-europe.json](https://geographie.uibk.ac.at/data/ecmwf/data/wind-10u-10v-europe.json) und sind das Endprodukt einer Reihe von Schritten, die aus den [Originaldaten beim ECMWF](https://confluence.ecmwf.int/display/UDOC/ECMWF+Open+Data+-+Real+Time) im Format [GRIB2](https://www.dwd.de/DE/leistungen/opendata/help/modelle/grib2_erlaeuterungen.pdf) die passende JSON-Datei erzeugt. Das HOWTO [ECMWF Windvorhersagedaten für Leaflet velocity aufbereiten](https://webmapping22s.github.io/forecast/howto_ecmwf2json) zeigt den verwendeten Workflow.

### a) Die Daten asynchron in der Funktion loadWind laden

```javascript
const response = await fetch(url);
const jsondata = await response.json();
console.log(jsondata);
```

Wir sehen einen Array bestehend aus zwei Objekten - ein Objekt für die `U-component_of_wind` und ein Objekt für die `V-component_of_wind`, jeweils in 10m Höhe. Aus diesen beiden Attributen kann später die Windrichtung und Windgeschwindigkeit berechnet werden. Jedes dieser Objekte besitzt ein `header`-  und `data`-Attribut. Im `header` stehen die Metadaten zur Erstellung der Vorhersage, die geographische Region für die die Daten gelten soll und die Art der Wind-Komponente. Im `data`-Attribut stehen die Werte von West nach Ost und Nord nach Süd.

[🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/e19bcba6c5d8574024b7e15d5397c93c2cb05343)

### b) Den Zeitpunkt der Vorhersage ermitteln

Rechnen mit Datumsangaben ist immer kompliziert :(

Wir haben die Zeit der Berechnung der Vorhersage (`refTime`) und den Zeitpunkt der Gültigkeit in Stunden (`forecastTime`) ab der Berechnung.

```javascript
console.log("Zeitpunkt Erstellung", jsondata[0].header.refTime);
console.log("Zeitpunkt Vorhersage (+Stunden)", jsondata[0].header.forecastTime);
```

Zur Berechnung des Vorhersagezeitpunkts müssen wir die Stunden zum Datum hinzufügen indem wir:

1. mit [new Date()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date) ein **echtes** Datum aus dem Attribut `refTime` erstellen

    ```javascript
    let forecastDate = new Date(jsondata[0].header.refTime);
    ```

    **Hinweis**: wir haben Glück, denn `new Date()` erkennt unseren String in `refTime` als gültiges Datum und erzeugt daraus ein echtes Datumsobjekt

2. die Zahl der Stunden in `forecastTime` dazu zählen. Dazu kommen die Methoden [Date.setHours()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setHours) und [Date.getHours()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getHours) zum Einsatz. Sollte die aus der Addition resultierende Stundenkomponente größer als 23 sein, wird das Datum entsprechend auf den nächsten Tag erweitert.

    ```javascript
    let forecastDate = new Date(jsondata[0].header.refTime);
    console.log("Echtes Datum Erstellung", forecastDate);
    forecastDate.setHours(forecastDate.getHours() + jsondata[0].header.forecastTime);
    console.log("Echtes Datum Vorhersage", forecastDate);
    ```

    [🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/1b3392c2edd4b59e520f8ed8901e94e7afad8187)

3. das Datum des Vorhersagezeitpunkts mit [Date.toLocaleDateString()](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString) formatieren

    Nachdem wir später im Skript noch andere Datumsangaben ähnlich formatieren werden, schreiben wir (gleich nach dem Maßstabszeichnen) eine Funktion `formatDate`, die das für uns erledigt. Sie erwartet ein **echtes** Datum und gibt einen lesbaren Datumsstring (in Deutsch) zurück.

    ```javascript
    let formatDate = function(date) {
        return date.toLocaleDateString("de-AT", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }) + " Uhr";
    }
    ```

    Das formatierte Datum für den Vorhersagezeitpunkt speichern wir in der Variablen `forecastLabel`

    ```javascript
    let forecastLabel = formatDate(forecastDate);
    console.log("Vorhersagezeitpunkt", forecastLabel);
    ```

    [🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/b0163291c8b9dc590bc3211926b5d1fc833fee7b)

    Bevor wir weiter machen, kommentieren wir die `console.log` Nachrichten aus - wir brauchen sie nicht mehr

    [🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/ae6a4bb1c0d8d09d10cf9495bd052f0c22bda4d6)

4. Den Vorhersagezeitpunkt können wir jetzt im neuen Overlay für die Windvorhersage verwenden

    ```javascript
    layerControl.addOverlay(overlays.wind, `ECMWF Windvorhersage für ${forecastLabel}`);
    ```

    [🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/294f541191fbe147d4b27db482d02a85bf6fd63e)

### c) Leaflet.velocity Plugin downloaden und einbinden

* lokales `lib/` Verzeichnis erstellen
* die Pluginseite von [Leaflet.velocity](https://github.com/onaci/leaflet-velocity) ansteuern
* unter [Releases v2.1.2](https://github.com/onaci/leaflet-velocity/releases/tag/2.1.2) den **Source code (zip) *** öffnen
* im **dist**-Ordner des Source codes die beiden Dateien `leaflet-velocity.css` und `leaflet-velocity.js` im neuen `lib/`-Verzeichnis entpacken
* in `index.html` dieses Stylesheet und Javascript einbinden

```html
<!-- Leaflet velocity -->
<link rel="stylesheet" href="lib/leaflet-velocity.css">
<script src="lib/leaflet-velocity.js"></script>
```

[🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/2c5d0d17a0e079984882e3dac30b3440e923aa0e)

### d) Das Plugin konfigurieren

* Wir initialisieren das Plugin, übergeben die Daten und hängen den animierten Layer an das Overlay

    ```javascript
    // Velocity Plugin konfigurieren
    L.velocityLayer({
        data: jsondata
    }).addTo(overlays.wind);
    ```

    [🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/dfc755d9df1d9111d4ecfefd2fc4979bfd57e33e)

    **Voilà**, die Animation der Windrichtung und Stärke für Europa ist sichtbar. Wie das ganze funktioniert, kann man bei [Visualizing wind using Leaflet - Wolfblog](https://wlog.viltstigen.se/articles/2021/11/08/visualizing-wind-using-leaflet/) nachlesen. Noch beeindruckender ist die 3D-Visualisierung von <https://earth.nullschool.net/>.

* Plugin weiter konfigurieren:

    * kräftigere Windlinien - ein leider undokumentiertes Attribut, das sich im Source code findet

        ```javascript
        lineWidth: 2
        ```

    * Datenanzeige übersetzen und nach rechts unten verschieben

        ```javascript
        displayOptions: {
            velocityType: "",
            directionString: "Windrichtung",
            speedString: "Windgeschwindigkeit",
            speedUnit: "k/h",
            emptyString: "keine Daten vorhanden",
            position: "bottomright"
        }        ```

    [🔗 COMMIT](https://github.com/webmapping22s/forecast/commit/74547a8c80208fa5f3f01b0770053ac26860e542) (dieser COMMIT ist leider vergessen worden und beim nächsten Implementierungsschritt gelandet ;-)
