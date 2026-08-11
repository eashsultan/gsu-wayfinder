/* ============================================================
   GSU Navigator AI — Map engine abstraction (Phase 4)
   Mapbox GL JS is the primary engine; Leaflet is the automatic
   fallback when no valid Mapbox token is configured or the
   Mapbox style fails to load.
   ============================================================ */
(function () {
  "use strict";

  var DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";
  var ROUTE_SOURCE = "gsu-route";

  // The public demo token shipped in older examples only works on
  // mapbox.com domains, so treat it as "no token".
  function isDemoToken(token) {
    if (!token) return true;
    try {
      var parts = token.split(".");
      if (parts.length < 2) return true;
      var payload = JSON.parse(atob(parts[1]));
      return !!payload && payload.u === "mapbox";
    } catch (e) {
      return false;
    }
  }

  function markerPinElement(color, active) {
    var wrap = document.createElement("div");
    wrap.className = "custom-map-marker";
    var pin = document.createElement("div");
    pin.className = "marker-pin" + (active ? " active" : "");
    pin.style.backgroundColor = color;
    wrap.appendChild(pin);
    return wrap;
  }

  function markerPinHTML(color, active) {
    return (
      '<div class="custom-map-marker">' +
      '<div class="marker-pin' + (active ? " active" : "") + '" style="background-color:' + color + ';"></div>' +
      "</div>"
    );
  }

  function userPulseElement() {
    var wrap = document.createElement("div");
    wrap.className = "user-location-pulse";
    var dot = document.createElement("div");
    dot.className = "user-location-dot";
    wrap.appendChild(dot);
    return wrap;
  }

  function userPulseHTML() {
    return '<div class="user-location-pulse"><div class="user-location-dot"></div></div>';
  }

  function geoJSONToBounds(coords) {
    // coords are [lng, lat] GeoJSON pairs -> [[swLat, swLng], [neLat, neLng]]
    var swLat = Infinity, swLng = Infinity, neLat = -Infinity, neLng = -Infinity;
    coords.forEach(function (c) {
      if (c[1] < swLat) swLat = c[1];
      if (c[0] < swLng) swLng = c[0];
      if (c[1] > neLat) neLat = c[1];
      if (c[0] > neLng) neLng = c[0];
    });
    return [[swLat, swLng], [neLat, neLng]];
  }

  // Leaflet bounds [[swLat, swLng], [neLat, neLng]] -> Mapbox [[west, south], [east, north]]
  function toMapboxBounds(bounds) {
    return [[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]];
  }

  // ==================================================================
  // Leaflet backend
  // ==================================================================
  function createLeafletEngine(containerId, opts) {
    var GSU_BOUNDS = opts.bounds;

    var map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true,
      maxBounds: GSU_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: opts.minZoom || 15,
      maxZoom: opts.maxZoom || 19,
      dragging: false,
      keyboard: false,
      scrollWheelZoom: "center",
      doubleClickZoom: "center",
      touchZoom: "center"
    }).setView(opts.center, opts.zoom);

    var streetMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: opts.maxZoom || 19,
      minZoom: opts.minZoom || 15,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(map);

    var satelliteMap = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: opts.maxZoom || 19,
      minZoom: opts.minZoom || 15,
      attribution: "Tiles &copy; Esri"
    });

    L.control.layers(
      { "🗺️ Street Map": streetMap, "🛰️ Satellite Map": satelliteMap },
      null,
      { position: "topright" }
    ).addTo(map);

    var markersGroup = L.layerGroup().addTo(map);
    var routingGroup = L.featureGroup().addTo(map);
    var pickerMarker = null;
    var userMarker = null;

    var engine = {
      backend: "leaflet",

      on: function (event, handler) {
        map.on(event, handler);
        return this;
      },

      flyTo: function (center, zoom, opts2) {
        map.flyTo(center, zoom, opts2 || {});
        return this;
      },

      fitBounds: function (bounds, opts2) {
        map.fitBounds(bounds, opts2 || {});
        return this;
      },

      invalidateSize: function () {
        map.invalidateSize();
        return this;
      },

      clearMarkers: function () {
        markersGroup.clearLayers();
        return this;
      },

      addMarker: function (mOpts) {
        var marker = L.marker([mOpts.lat, mOpts.lng], {
          icon: L.divIcon({
            html: markerPinHTML(mOpts.color, mOpts.active),
            className: "custom-map-marker",
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -26]
          })
        });
        if (mOpts.popupHTML) marker.bindPopup(mOpts.popupHTML);
        marker.addTo(markersGroup);
        return {
          openPopup: function () { marker.openPopup(); },
          closePopup: function () { marker.closePopup(); }
        };
      },

      setPicker: function (lat, lng, pOpts) {
        this.clearPicker();
        pOpts = pOpts || {};
        pickerMarker = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
            html: markerPinHTML(pOpts.color || "#2F6E4E", true),
            className: "custom-map-marker",
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -26]
          })
        }).addTo(map);
        if (pOpts.popupHTML) pickerMarker.bindPopup(pOpts.popupHTML).openPopup();
        if (pOpts.onDrag) {
          pickerMarker.on("dragend", function (event) {
            var ll = event.target.getLatLng();
            pOpts.onDrag(ll.lat, ll.lng);
          });
        }
        return this;
      },

      clearPicker: function () {
        if (pickerMarker) {
          map.removeLayer(pickerMarker);
          pickerMarker = null;
        }
        return this;
      },

      setUser: function (lat, lng) {
        this.clearUser();
        userMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "user-location-pulse",
            html: userPulseHTML(),
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          })
        }).bindPopup("<b>Your Current Location</b>").addTo(map);
        return this;
      },

      clearUser: function () {
        if (userMarker) {
          map.removeLayer(userMarker);
          userMarker = null;
        }
        return this;
      },

      clearRoute: function () {
        routingGroup.clearLayers();
        return this;
      },

      drawRouteGeoJSON: function (geojson) {
        L.geoJSON(geojson, {
          style: {
            color: "#008751",
            weight: 5,
            opacity: 0.85,
            dashArray: "2, 8",
            lineCap: "round"
          }
        }).addTo(routingGroup);
        return this;
      },

      drawRouteLine: function (coords, color) {
        L.polyline(coords, {
          color: color || "#EF4444",
          weight: 4,
          opacity: 0.8,
          dashArray: "6, 6"
        }).addTo(routingGroup);
        return this;
      },

      fitRoute: function (coords) {
        if (coords && coords.length) {
          map.fitBounds(geoJSONToBounds(coords), { padding: [50, 50] });
        }
        return this;
      }
    };

    return Promise.resolve(engine);
  }

  // ==================================================================
  // Mapbox GL backend
  // ==================================================================
  function createMapboxEngine(containerId, token, style, opts) {
    mapboxgl.accessToken = token;
    var map = new mapboxgl.Map({
      container: containerId,
      style: style,
      center: [opts.center[1], opts.center[0]],
      zoom: opts.zoom,
      minZoom: opts.minZoom || 15,
      maxZoom: opts.maxZoom || 19,
      maxBounds: opts.bounds ? toMapboxBounds(opts.bounds) : undefined,
      attributionControl: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      doubleClickZoom: false,
      keyboard: false
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    var markersGroup = [];
    var pickerMarker = null;
    var userMarker = null;

    var engine = {
      backend: "mapboxgl",

      on: function (event, handler) {
        if (event === "click") {
          map.on("click", function (e) {
            handler({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng }, originalEvent: e });
          });
        } else {
          map.on(event, handler);
        }
        return this;
      },

      flyTo: function (center, zoom, opts2) {
        map.flyTo({ center: [center[1], center[0]], zoom: zoom, duration: (opts2 && opts2.duration) || 1200 });
        return this;
      },

      fitBounds: function (bounds, opts2) {
        map.fitBounds(toMapboxBounds(bounds), opts2 || {});
        return this;
      },

      invalidateSize: function () {
        setTimeout(function () { map.resize(); }, 60);
        return this;
      },

      clearMarkers: function () {
        markersGroup.forEach(function (m) { m.remove(); });
        markersGroup = [];
        return this;
      },

      addMarker: function (mOpts) {
        var el = markerPinElement(mOpts.color, mOpts.active);
        var marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([mOpts.lng, mOpts.lat])
          .addTo(map);
        var popup = null;
        if (mOpts.popupHTML) {
          // sanitize:false so inline action buttons (Route/Clear) keep working.
          // Content is pre-escaped by the app before being passed in.
          popup = new mapboxgl.Popup({ offset: 26, closeButton: true, sanitize: false })
            .setHTML(mOpts.popupHTML);
        }
        markersGroup.push(marker);
        return {
          openPopup: function () {
            if (popup) popup.setLngLat(marker.getLngLat()).addTo(map);
          },
          closePopup: function () {
            if (popup) popup.remove();
          }
        };
      },

      setPicker: function (lat, lng, pOpts) {
        this.clearPicker();
        pOpts = pOpts || {};
        var el = markerPinElement(pOpts.color || "#2F6E4E", true);
        pickerMarker = new mapboxgl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        var popup = null;
        if (pOpts.popupHTML) {
          popup = new mapboxgl.Popup({ offset: 26, sanitize: false }).setHTML(pOpts.popupHTML);
          popup.setLngLat([lng, lat]).addTo(map);
        }
        if (pOpts.onDrag) {
          pickerMarker.on("dragend", function () {
            var ll = pickerMarker.getLngLat();
            pOpts.onDrag(ll.lat, ll.lng);
          });
        }
        return this;
      },

      clearPicker: function () {
        if (pickerMarker) {
          pickerMarker.remove();
          pickerMarker = null;
        }
        return this;
      },

      setUser: function (lat, lng) {
        this.clearUser();
        userMarker = new mapboxgl.Marker({
          element: userPulseElement(),
          anchor: "center"
        }).setLngLat([lng, lat]).addTo(map);
        return this;
      },

      clearUser: function () {
        if (userMarker) {
          userMarker.remove();
          userMarker = null;
        }
        return this;
      },

      clearRoute: function () {
        if (map.getSource(ROUTE_SOURCE)) {
          map.removeLayer(ROUTE_SOURCE);
          map.removeSource(ROUTE_SOURCE);
        }
        return this;
      },

      drawRouteGeoJSON: function (geojson) {
        this.clearRoute();
        map.addSource(ROUTE_SOURCE, { type: "geojson", data: geojson });
        map.addLayer({
          id: ROUTE_SOURCE,
          type: "line",
          source: ROUTE_SOURCE,
          paint: {
            "line-color": "#008751",
            "line-width": 5,
            "line-opacity": 0.85,
            "line-dasharray": [2, 8]
          }
        });
        return this;
      },

      drawRouteLine: function (coords, color) {
        this.clearRoute();
        map.addSource(ROUTE_SOURCE, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } });
        map.addLayer({
          id: ROUTE_SOURCE,
          type: "line",
          source: ROUTE_SOURCE,
          paint: {
            "line-color": color || "#EF4444",
            "line-width": 4,
            "line-opacity": 0.8,
            "line-dasharray": [6, 6]
          }
        });
        return this;
      },

      fitRoute: function (coords) {
        if (coords && coords.length) {
          map.fitBounds(geoJSONToBounds(coords), { padding: 50 });
        }
        return this;
      }
    };

    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; reject(new Error("Mapbox style load timeout")); }
      }, 10000);

      map.once("error", function (e) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("Mapbox style failed: " + (e && e.error && e.error.message ? e.error.message : "unknown")));
        }
      });
      map.once("load", function () {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          // Ensure the canvas matches the (now visible) container
          try { map.resize(); } catch (e) {}
          resolve(engine);
        }
      });
    });
  }

  // ==================================================================
  // Public API
  // ==================================================================
  function waitForSize(containerId, timeoutMs) {
    return new Promise(function (resolve) {
      var el = document.getElementById(containerId);
      if (!el) { resolve(); return; }
      if (el.clientWidth > 0 && el.clientHeight > 0) { resolve(); return; }
      var start = Date.now();
      var iv = setInterval(function () {
        if ((el.clientWidth > 0 && el.clientHeight > 0) || Date.now() - start > timeoutMs) {
          clearInterval(iv);
          resolve();
        }
      }, 120);
    });
  }

  function mapboxUsable(token) {
    return (
      typeof window.mapboxgl !== "undefined" &&
      token &&
      !isDemoToken(token) &&
      (!window.mapboxgl.supported || window.mapboxgl.supported())
    );
  }

  window.MapEngine = {
    /*
     * opts: { bounds, center, zoom, minZoom, maxZoom }
     * Returns a Promise that resolves with the engine facade.
     */
    init: function (containerId, opts) {
      opts = opts || {};
      return fetch("/api/config")
        .then(function (res) { return res.json(); })
        .then(function (config) {
          var token = (config && config.mapbox_token) || "";
          var style = (config && config.mapbox_style) || DEFAULT_STYLE;
          if (mapboxUsable(token)) {
            return waitForSize(containerId, 8000).then(function () {
              return createMapboxEngine(containerId, token, style, opts).catch(function (err) {
                console.warn("Mapbox init failed, falling back to Leaflet:", err);
                return createLeafletEngine(containerId, opts);
              });
            });
          }
          return createLeafletEngine(containerId, opts);
        })
        .catch(function () {
          return createLeafletEngine(containerId, opts);
        });
    }
  };
})();