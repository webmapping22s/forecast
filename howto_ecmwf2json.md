# ECMWF Windvorhersagedaten für Leaflet velocity aufbereiten

Das [European Centre for Medium-Range Weather Forecasts - ECMWF](https://www.ecmwf.int/) bietet im [ECMWF Open Data Bereich](https://www.ecmwf.int/en/forecasts/datasets/open-data) eine Vielzahl an meteorologischen Parametern als *High-resolution products* an. Die Vorhersagen liegen im Format [GRIB2](https://www.dwd.de/DE/leistungen/opendata/help/modelle/grib2_erlaeuterungen.pdf) vor und müssen für die Visualisierung mit [Leaflet velocity](https://github.com/onaci/leaflet-velocity) in ein JSON-Format konvertiert werden.

Der folgende Workflow zeigt, wie diese Konvertierung unter Linux Ubuntu erfolgen kann

## 1. GRIB2 Daten mit der ecmwf.opendata Python library downloaden

* Die [ecmwf.opendata](https://pypi.org/project/ecmwf-opendata/) Python3 library installieren wir systemweit mit `pip3`

    ```shell
    sudo -H pip3 install ecmwf-opendata
    ```

* Weltweite Vorhersagedaten für die Windkomponenten **10u** und **10v** (jeweils in 10 Metern Höhe) können wir dann im GRIB2 Format downloaden

    Wir starten Python3

    ```shell
    python3
    ```

    Und downloaden die Daten

    ```python
    from ecmwf.opendata import Client

    client = Client("ecmwf", beta=True)

    # letzten oper (00:00, 12:00) oder scda (06:00, 18:00) stream downloaden
    client.retrieve({
        "type": "fc",
        "step": 9,
        "param": ["10u", "10v"]
    }, "/tmp/wind-10u-10v.grib2")
    ```

    Die Open Data Versionen der Vorhersagen sind eine Stunde nach dem [Real-time dissemination schedule](https://confluence.ecmwf.int/display/UDOC/Dissemination+schedule) verfügbar. Von der Prozessierung bis zur Veröffentlichung vergehen damit mindestens 7 Stunden. Wir setzen deshalb den *step* für die Vorhersage auf (mindestens) 9 und speichern das Ergebniss in `/tmp/wind-10u-10v.grib2`. Die `steps` können nach der [Open data Dokumentation](https://www.ecmwf.int/en/forecasts/datasets/open-data) diese Werte annehmen:

    * For times 00z &12z: 0 to 144 by 3, 150 to 240 by 6
    * For times 06z & 18z: 0 to 90 by 3

## 2. GRIB2 Daten für Europa aus dem Originaldatensatz clippen

In unserer Applikation werden wir nur die Windvorhersage für Europa visualisieren, deshalb clippen wir die GRIB2 Daten an der *ungefähren* Boundingbox von Europa, die wir dem [Corine Land Cover (CLC) 2018 Datensatz](https://land.copernicus.eu/pan-european/corine-land-cover/clc2018?tab=metadata) von [copernicus.eu](https://land.copernicus.eu/pan-european) entnehmen. Wir runden auf ganze Gradzahlen und erweitern den Ausschnitt im Süden um das ganze Mittelmeer abzudecken. Die Region ist damit über `W=-31, E=45, S=26, N=72` definiert.

Zum Clippen verwenden wir das [Climate Data Operators (CDO) comandline tool](https://code.mpimet.mpg.de/projects/cdo)

Wir installieren das Tool mit `apt` systemweit

```shell
sudo apt install cdo
```

Dann clippen wir die Daten an unserer Boundingbox. Zusätzlich müssen wir die Achse der Latitude Werte invertieren, sonst liegt unser Ausschnitt falsch

```shell
cdo -invertlat -sellonlatbox,-31,45,26,72 /tmp/wind-10u-10v.grib2 /tmp/wind-10u-10v-europe.grib2
```

Details zur Verwendung dieses Tools finden sich im [CDO Tutorial](https://code.mpimet.mpg.de/projects/cdo/wiki/Tutorial)


## 3. Die Daten für Europa in JSON umwandeln

* Für die Konvertierung von GRIB2 nach JSON müssen wir zuerst [grib2json](https://github.com/cambecc/grib2json) installieren.

    * wir benötigen auch [Apache Maven](https://maven.apache.org/) für die Installation

        ```shell
        sudo apt install maven
        ```

    * danach können wir [grib2json](https://github.com/cambecc/grib2json.git) installieren. Wir clonen dazu das git-Repository in `/usr/local/src`, builden das Package mit Maven und entpacken grib2json

        ```shell
        sudo bash
        cd /usr/local/src
        git clone https://github.com/cambecc/grib2json.git
        cd grib2json/
        mvn package
        tar zvxf target/grib2json-0.8.0-SNAPSHOT.tar.gz
        ```
    
        Damit können wir *grib2json* verwenden und testen den Aufruf mit

        ```shell
        /usr/local/src/grib2json/grib2json-0.8.0-SNAPSHOT/bin/grib2json
        ```

        Sollten wir eine Fehler **/bin/java: not found** bekommen, müssen wir die Umgebungsvariable `JAVA_HOME` noch setzen

        ```shell
        java -version
        # openjdk version "1.8.0_312"
        export JAVA_HOME=/usr/lib/jvm/java-1.8.0-openjdk-amd64
        echo $JAVA_HOME
        ```

* Die Daten mit grib2json konvertieren

    ```shell
    /usr/local/src/grib2json/grib2json-0.8.0-SNAPSHOT/bin/grib2json \
    --names --data --compact --fp wind --fc 2 --fs 103 --fv 10.0 \
    --output /tmp/wind-10u-10v-europe.json \
    /tmp/wind-10u-10v-europe.grib2

    less /tmp/wind-10u-10v-europe.json
    ```

    Wir sehen einen Array bestehend aus zwei Objekten - ein Objekt für die `U-component_of_wind` und ein Objekt für die `V-component_of_wind`, jeweils in 10m Höhe. Aus diesen beiden Attributen kann Leaflet velocity später die Windrichtung und Windgeschwindigkeit berechnen. Jedes dieser Objekte besitzt ein `header`-  und `data`-Attribut. Im `header` stehen die Metadaten zur Erstellung der Vorhersage, die geographische Region für die die Daten gelten soll und die Art der Wind-Komponente. Im `data` Attribut stehen die Werte als Array von West nach Ost und Nord nach Süd.

Der Prozess der Konvertierung wurde am Server der Geographie über ein crontab Script automatisiert. Die aktuelle Vorhersage zur Visualisierung mit Leaflet velocity findet sich unter <https://geographie.uibk.ac.at/data/ecmwf/data/wind-10u-10v-europe.json>

**[Weiter zum HOWTO der Implementierung](https://webmapping22s.github.io/forecast/howto1)**