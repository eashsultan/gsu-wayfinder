(function() {
  "use strict";

  // ---------- Configuration & Constants ----------
  const CAMPUS_CENTER = [10.3042, 11.1728]; // Gombe State University Center Coordinates
  const LOCAL_STORAGE_KEY = "gsu_wayfinder_places";
  
  const CATEGORIES = [
    "Lecture Theatre",
    "Office",
    "Clinic",
    "Restaurant",
    "Hostel",
    "Library",
    "Bank/ATM",
    "Sports",
    "Other"
  ];

  const CAT_COLORS = {
    "Lecture Theatre": "#14213D",
    "Office": "#2C3A5E",
    "Clinic": "#B3261E",
    "Restaurant": "#E3A008",
    "Hostel": "#2F6E4E",
    "Library": "#7A4EA3",
    "Bank/ATM": "#0C7C92",
    "Sports": "#C4600A",
    "Other": "#64748B"
  };

  // ---------- Campus Seed Data ----------
  const SEED_PLACES = [
    {
      id: "seed-senate",
      name: "Senate Building (VC's Office)",
      category: "Office",
      description: "The primary administrative hub of Gombe State University, housing the Vice Chancellor's office, registry, and academic affairs division.",
      directions: "From the Main Gate, follow the main driveway straight for about 200 meters. The imposing Senate Building is located on your right, past the central roundabout.",
      lat: 10.304200,
      lng: 11.172800
    },
    {
      id: "seed-gate",
      name: "Main Campus Gate",
      category: "Other",
      description: "The primary vehicle and pedestrian entrance/exit point of the GSU campus.",
      directions: "Located along the main bypass highway. Security personnel are stationed here 24/7.",
      lat: 10.302500,
      lng: 11.171200
    },
    {
      id: "seed-library",
      name: "University Central Library",
      category: "Library",
      description: "The main academic resource center, offering physical books, digital library terminals, quiet study halls, and reference materials.",
      directions: "From the Senate Building roundabout, take the left path. Walk past the Faculty of Science, and the Library will be the large multi-story structure on your right.",
      lat: 10.305100,
      lng: 11.174000
    },
    {
      id: "seed-science-lt",
      name: "Faculty of Science Lecture Theatre (LT1 & LT2)",
      category: "Lecture Theatre",
      description: "Large capacity lecture halls primarily hosting introductory science classes, exams, and university-wide public events.",
      directions: "Walk 150m northeast of the Senate Building. Enter the Faculty of Science gate; the main LT building is directly adjacent to the Department of Chemistry.",
      lat: 10.304800,
      lng: 11.173100
    },
    {
      id: "seed-clinic",
      name: "University Health Clinic",
      category: "Clinic",
      description: "Campus healthcare clinic providing primary medical consultations, emergency first aid, pharmacy services, and health advice for students.",
      directions: "Located on the southern campus loop. Pass the male hostels and turn right; the clinic is the single-story building marked with a red cross sign.",
      lat: 10.303300,
      lng: 11.174500
    },
    {
      id: "seed-fass",
      name: "Faculty of Arts & Social Sciences (FASS)",
      category: "Office",
      description: "Dean's office, department offices (History, Political Science, Sociology, English), and faculty-specific classrooms.",
      directions: "Take the western campus pathway from the main gate. The FASS complex is the second block on the left side of the lane.",
      lat: 10.303800,
      lng: 11.170500
    },
    {
      id: "seed-cafeteria",
      name: "Central Student Cafeteria",
      category: "Restaurant",
      description: "Food court with local vendors serving Jollof rice, Masa, Tuwo, snacks, and refreshing drinks at student-friendly prices.",
      directions: "Situated in the central campus square, directly opposite the student center building.",
      lat: 10.304500,
      lng: 11.171800
    },
    {
      id: "seed-hostel-male",
      name: "Main Male Hostel Block",
      category: "Hostel",
      description: "Residential block providing accommodation for male students of Gombe State University.",
      directions: "Located at the south-eastern boundary of the campus, close to the sports ground.",
      lat: 10.302800,
      lng: 11.175200
    },
    {
      id: "seed-hostel-female",
      name: "Main Female Hostel Complex",
      category: "Hostel",
      description: "Secure residential compound for female students, featuring individual halls and a common room.",
      directions: "Located near the university clinic on the south side of campus. Access is gated and highly secured.",
      lat: 10.303100,
      lng: 11.173900
    },
    {
      id: "seed-sports",
      name: "University Sports Complex",
      category: "Sports",
      description: "Campus sports facilities including a football pitch, basketball court, running track, and volleyball facilities.",
      directions: "Located at the eastern edge of the university campus. Follow the signs from the male hostels.",
      lat: 10.302500,
      lng: 11.176200
    }
  ];

  // ---------- Application State ----------
  let places = [];
  let currentTab = "chat";
  let activeCategoryFilter = null;
  let map = null;
  let markersGroup = null;
  let pickModeActive = false;
  let currentMarker = null;
  let currentMapCenter = [...CAMPUS_CENTER];
  let focusedMarker = null;
  let serverHasGeminiKey = false;
  let routingLayer = null;
  let userLocationMarker = null;
  let voiceEnabled = true;

  // ---------- Initialization ----------
  window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMap();
    loadPlaces();
    setupEventListeners();
    renderChips();
    if (window.innerWidth < 900) {
      document.getElementById("map-section").style.display = "none";
    }
    switchTab("chat");
  });

  // ---------- Theme Switcher (Dark/Light) ----------
  function initTheme() {
    const isDark = localStorage.getItem("gsu_dark_theme") === "true";
    setTheme(isDark);
  }

  function setTheme(isDark) {
    const body = document.body;
    const themeBtn = document.getElementById("themeToggle");
    const sunIcon = themeBtn.querySelector(".sun-icon");
    const moonIcon = themeBtn.querySelector(".moon-icon");
    const maskColor = isDark ? "#0A140F" : "#F4F7F5";

    if (isDark) {
      body.classList.remove("light-mode");
      body.classList.add("dark-mode");
      sunIcon.style.display = "none";
      moonIcon.style.display = "block";
      localStorage.setItem("gsu_dark_theme", "true");
    } else {
      body.classList.remove("dark-mode");
      body.classList.add("light-mode");
      sunIcon.style.display = "block";
      moonIcon.style.display = "none";
      localStorage.setItem("gsu_dark_theme", "false");
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains("dark-mode");
    setTheme(!isDark);
  }

  // ---------- Storage Mechanics ----------
  async function loadPlaces() {
    try {
      const res = await fetch("/api/places");
      if (!res.ok) throw new Error("Backend response error");
      places = await res.json();

      try {
        const configRes = await fetch("/api/config");
        if (configRes.ok) {
          const config = await configRes.json();
          serverHasGeminiKey = !!config.has_gemini_key;
        }
      } catch (configErr) {
        console.warn("Could not load backend config status:", configErr);
      }

      const hasAi = serverHasGeminiKey;
      setStatus(`${places.length} GSU spots active. ${hasAi ? "🤖 Gemini AI Live" : "💡 Local NLP"}`);
    } catch (err) {
      console.warn("FastAPI load failed, using local fallback:", err);
      places = [...SEED_PLACES];
      setStatus("Offline fallback mode: running from volatile local memory.", true);
    }
    renderAll();
  }

  async function savePlaces() {
    // Deprecated for direct API calls, kept as interface compliance
    return true;
  }

  function setStatus(text, isErr = false) {
    const statusBar = document.getElementById("statusBar");
    const statusText = document.getElementById("statusMessage");
    const statusDot = statusBar.querySelector(".status-dot");

    statusText.textContent = text;
    if (isErr) {
      statusBar.style.backgroundColor = "rgba(179, 38, 30, 0.1)";
      statusDot.style.backgroundColor = "var(--danger)";
    } else {
      statusBar.style.backgroundColor = "var(--bg-solid)";
      statusDot.style.backgroundColor = "var(--success)";
    }
  }

  // ---------- Map Framework Integration ----------
  function initMap() {
    const GSU_BOUNDS = [
      [10.2940, 11.1600], // Southwest boundary (expanded safely)
      [10.3140, 11.1860]  // Northeast boundary (expanded safely)
    ];

    map = L.map("map", {
      zoomControl: true,
      attributionControl: true,
      maxBounds: GSU_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 15,
      maxZoom: 19,
      dragging: false,
      keyboard: false,
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      touchZoom: 'center'
    }).setView(CAMPUS_CENTER, 16);

    // Define Base Map Layers
    const streetMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 15,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    });

    const satelliteMap = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      minZoom: 15,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // Add default street view to map
    streetMap.addTo(map);

    // Setup Layer Control Toggle
    const baseMaps = {
      "🗺️ Street Map": streetMap,
      "🛰️ Satellite Map": satelliteMap
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    markersGroup = L.layerGroup().addTo(map);
    routingLayer = L.featureGroup().addTo(map);

    // Click event for selecting coordinates
    map.on("click", (e) => {
      if (pickModeActive) {
        const { lat, lng } = e.latlng;
        document.getElementById("pLat").value = lat.toFixed(6);
        document.getElementById("pLng").value = lng.toFixed(6);
        
        // Show temporary marker on map
        setTemporaryPickerMarker(lat, lng);
        setPickMode(false);
        setStatus(`Coordinates picked: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  }

  function setTemporaryPickerMarker(lat, lng) {
    if (currentMarker) {
      map.removeLayer(currentMarker);
    }
    
    currentMarker = L.marker([lat, lng], {
      draggable: true,
      icon: createMarkerIcon("#2F6E4E", true)
    }).addTo(map);

    currentMarker.bindPopup("<b>New Draft Spot</b><br>Drag me or fill the form to save.").openPopup();

    currentMarker.on("dragend", function(event) {
      const marker = event.target;
      const position = marker.getLatLng();
      document.getElementById("pLat").value = position.lat.toFixed(6);
      document.getElementById("pLng").value = position.lng.toFixed(6);
    });
  }

  function createMarkerIcon(color, isActive = false) {
    const html = `<div class="marker-pin ${isActive ? 'active' : ''}" style="background-color: ${color};"></div>`;
    return L.divIcon({
      html: html,
      className: 'custom-map-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -26]
    });
  }

  // Voice Assistant Speech Synthesis
  function speak(text) {
    if (!voiceEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[🧭🤖💡*(_)#]/g, ""); // Strip symbols for clean speech
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis failed:", e);
    }
  }

  // Expose route actions globally on window for Leaflet popup interaction
  window.gsuDrawRoute = (lat, lng, name, guideText) => {
    setStatus(`Fetching directions to ${name}...`);
    speak(`Routing you to ${name}.`);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        drawRoute(latitude, longitude, lat, lng, name, guideText);
      },
      (error) => {
        console.warn("Geolocation failed, routing from Main Gate:", error);
        alert("GPS location unavailable. Routing from Main Campus Gate.");
        drawRoute(10.302500, 11.171200, lat, lng, name, guideText);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  window.gsuClearRoute = () => {
    if (routingLayer) {
      routingLayer.clearLayers();
    }
    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
      userLocationMarker = null;
    }
    window.speechSynthesis.cancel();
    setStatus("Route cleared.");
  };

  function renderMapMarkers() {
    markersGroup.clearLayers();
    
    const visiblePlaces = activeCategoryFilter
      ? places.filter(p => p.category === activeCategoryFilter)
      : places;

    visiblePlaces.forEach(p => {
      const color = CAT_COLORS[p.category] || "#64748B";
      const marker = L.marker([p.lat, p.lng], {
        icon: createMarkerIcon(color)
      });

      const popupContent = `
        <div style="font-family: var(--font-body); min-width: 200px; padding: 4px;">
          <span style="font-family: var(--font-mono); font-size: 9px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${p.category}</span>
          <h4 style="margin: 3px 0; font-family: var(--font-display); font-size: 14px; font-weight: 700;">${escapeHTML(p.name)}</h4>
          <p style="margin: 4px 0 8px; font-size: 12px; color: var(--text-muted); line-height: 1.4;">${escapeHTML(p.description || "No description provided.")}</p>
          ${p.directions ? `<div style="border-top: 1px dashed var(--border-color); padding: 6px 0; font-size: 11.5px; line-height: 1.4; color: var(--text-muted);">🧭 <b>Directions:</b> ${escapeHTML(p.directions)}</div>` : ''}
          <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
            <button onclick="window.gsuDrawRoute(${p.lat}, ${p.lng}, '${escapeHTML(p.name)}', '${escapeHTML(p.directions || p.description || '')}')" style="flex: 1; border: none; background: #008751; color: white; padding: 6px; border-radius: 4px; font-family: var(--font-body); font-size: 11px; cursor: pointer; font-weight: 600; text-align: center;">🧭 Route</button>
            <button onclick="window.gsuClearRoute()" style="border: 1px solid var(--border-color); background: transparent; color: var(--text-muted); padding: 6px; border-radius: 4px; font-family: var(--font-body); font-size: 11px; cursor: pointer; font-weight: 600; text-align: center;">Clear</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(markersGroup);
      p._marker = marker;
    });
  }

  function focusLocation(place) {
    currentMapCenter = [place.lat, place.lng];
    if (window.innerWidth < 900) {
      switchTab("map");
    }

    map.flyTo([place.lat, place.lng], 18, {
      duration: 1.2,
      easeLinearity: 0.25
    });

    setTimeout(() => {
      if (place._marker) {
        place._marker.openPopup();
      }
    }, 1200);
  }

  // ---------- Navigation Panel & Tabs UI ----------
  window.switchTab = function(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".panel-view").forEach(view => view.classList.remove("active"));

    const isMobile = window.innerWidth < 900;
    if (isMobile) {
      const mapSec = document.getElementById("map-section");
      const mainPanel = document.getElementById("interaction-panel");

      if (tabName === "map") {
        mapSec.style.display = "block";
        mainPanel.style.display = "none";
        if (map) {
          setTimeout(() => { map.invalidateSize(); }, 200);
        }
      } else {
        mapSec.style.display = "none";
        mainPanel.style.display = "flex";
      }
    } else {
      document.getElementById("map-section").style.display = "block";
      document.getElementById("interaction-panel").style.display = "flex";
    }

    if (tabName === "chat") {
      document.getElementById("tabChat").classList.add("active");
      document.getElementById("viewChat").classList.add("active");
    } else if (tabName === "map") {
      document.getElementById("tabMap").classList.add("active");
    } else if (tabName === "list") {
      document.getElementById("tabList").classList.add("active");
      document.getElementById("viewList").classList.add("active");
      renderPlacesList();
    } else if (tabName === "add") {
      document.getElementById("tabAdd").classList.add("active");
      document.getElementById("viewAdd").classList.add("active");
      renderManageList();
    }
  };

  // ---------- Rendering Lists & Category Chips ----------
  function renderChips() {
    const container = document.getElementById("chipsContainer");
    container.innerHTML = "";

    // 'All' Chip
    const allChip = document.createElement("button");
    allChip.className = `chip-btn ${activeCategoryFilter === null ? 'active' : ''}`;
    allChip.textContent = "🌍 Show All";
    allChip.onclick = () => {
      activeCategoryFilter = null;
      renderAll();
    };
    container.appendChild(allChip);

    // Specific Category Chips
    CATEGORIES.forEach(cat => {
      const chip = document.createElement("button");
      chip.className = `chip-btn ${activeCategoryFilter === cat ? 'active' : ''}`;
      chip.textContent = cat;
      chip.onclick = () => {
        activeCategoryFilter = (activeCategoryFilter === cat) ? null : cat;
        renderAll();
      };
      container.appendChild(chip);
    });
  }

  function renderPlacesList() {
    const listContainer = document.getElementById("placesList");
    listContainer.innerHTML = "";

    const query = document.getElementById("listSearchInput").value.trim().toLowerCase();
    
    let filtered = activeCategoryFilter
      ? places.filter(p => p.category === activeCategoryFilter)
      : places;

    if (query) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query) || 
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-list-state">No campus spots match your criteria. Try changing category filter or search terms.</div>`;
      return;
    }

    filtered.forEach(p => {
      const card = document.createElement("div");
      card.className = "location-item-card";
      card.onclick = () => focusLocation(p);

      const color = CAT_COLORS[p.category] || "#64748B";

      card.innerHTML = `
        <div class="location-item-info">
          <h4>${escapeHTML(p.name)}</h4>
          <span class="mini-badge" style="background-color: ${color}20; color: ${color};">${escapeHTML(p.category)}</span>
          <p>${escapeHTML(p.description || "No description.")}</p>
        </div>
        <div class="location-item-meta">
          <span class="item-go-arrow">VIEW →</span>
        </div>
      `;
      listContainer.appendChild(card);
    });
  }

  function renderManageList() {
    const container = document.getElementById("manageListContainer");
    container.innerHTML = "";

    if (places.length === 0) {
      container.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">No campus spots saved yet.</p>`;
      return;
    }

    places.forEach(p => {
      const item = document.createElement("div");
      item.className = "manage-item";
      item.innerHTML = `
        <span><b>${escapeHTML(p.name)}</b> (${escapeHTML(p.category)})</span>
        <button type="button" class="del-btn">Delete</button>
      `;

      item.querySelector(".del-btn").onclick = async () => {
        if (confirm(`Are you sure you want to delete "${p.name}"? This action removes it from the shared database.`)) {
          try {
            const res = await fetch(`/api/places/${p.id}`, {
              method: "DELETE"
            });
            if (!res.ok) throw new Error("Delete request failed");
            places = places.filter(item => item.id !== p.id);
            renderAll();
            setStatus(`Removed "${p.name}" from GSU campus directory.`);
          } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete place from server.");
          }
        }
      };

      container.appendChild(item);
    });
  }

  function renderAll() {
    renderChips();
    renderMapMarkers();
    if (currentTab === "list") renderPlacesList();
    if (currentTab === "add") renderManageList();
  }

  // ---------- Form Operations (Add Location) ----------
  function setPickMode(active) {
    pickModeActive = active;
    const btn = document.getElementById("btnPickOnMap");
    if (pickModeActive) {
      btn.classList.add("active");
      btn.querySelector("span").textContent = "📍 Tap the map to select coordinates...";
      setStatus("Map coordinate picker active. Tap anywhere on the campus map.");
    } else {
      btn.classList.remove("active");
      btn.querySelector("span").textContent = "📍 Pick Location on Map";
    }
  }

  async function handleAddFormSubmit(e) {
    const name = document.getElementById("pName").value.trim();
    const category = document.getElementById("pCategory").value;
    const desc = document.getElementById("pDesc").value.trim();
    const directions = document.getElementById("pDirections").value.trim();
    const lat = parseFloat(document.getElementById("pLat").value);
    const lng = parseFloat(document.getElementById("pLng").value);

    if (!name || isNaN(lat) || isNaN(lng)) {
      alert("Please fill in all required fields (*) and specify latitude/longitude.");
      return;
    }

    const newPlace = {
      name,
      category,
      description: desc,
      directions,
      lat,
      lng
    };

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlace)
      });
      if (!res.ok) throw new Error("Failed to save on server");
      const savedPlace = await res.json();
      places.push(savedPlace);
      
      document.getElementById("addPlaceForm").reset();
      if (currentMarker) {
         map.removeLayer(currentMarker);
         currentMarker = null;
      }
      renderAll();
      setStatus(`Saved "${name}" successfully.`);
      switchTab("list");
      focusLocation(savedPlace);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save location on the backend server.");
    }
  }

  // ---------- Client-side Intelligent NLP / AI Assistant ----------
  window.sendSuggestion = function(text) {
    document.getElementById("chatInput").value = text;
    handleSendMessage();
  };

  function appendChatMessage(sender, text, place = null) {
    const chatHistory = document.getElementById("chatHistory");
    const welcome = chatHistory.querySelector(".assistant-welcome");
    if (welcome) welcome.remove();

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;

    let placeBtnHtml = "";
    if (place) {
      placeBtnHtml = `<button class="place-recommend-btn" onclick="focusOnCampusSpot('${place.id}')">📍 Show ${escapeHTML(place.name)} on Map</button>`;
    }

    messageDiv.innerHTML = `
      <div class="message-bubble">
        <div class="bubble-text">${escapeHTML(text)}</div>
        ${placeBtnHtml}
      </div>
    `;

    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  window.focusOnCampusSpot = function(id) {
    const place = places.find(p => p.id === id);
    if (place) {
      focusLocation(place);
    }
  };

  function matchPlacesNLP(query) {
    const q = query.toLowerCase().trim();
    
    // Exact/Keyword Matching weights
    const scores = places.map(p => {
      let score = 0;
      const name = p.name.toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const cat = p.category.toLowerCase();
      const dir = (p.directions || "").toLowerCase();

      // Check category synonyms
      if (q.includes("classroom") || q.includes("hall") || q.includes("lecture") || q.includes("lt") || q.includes("theatre")) {
        if (p.category === "Lecture Theatre") score += 2;
      }
      if (q.includes("eat") || q.includes("food") || q.includes("restaurant") || q.includes("canteen") || q.includes("lunch") || q.includes("cafeteria") || q.includes("masa")) {
        if (p.category === "Restaurant") score += 2;
      }
      if (q.includes("book") || q.includes("read") || q.includes("study") || q.includes("library")) {
        if (p.category === "Library") score += 2;
      }
      if (q.includes("sick") || q.includes("health") || q.includes("clinic") || q.includes("hospital") || q.includes("doctor") || q.includes("medicine")) {
        if (p.category === "Clinic") score += 2;
      }
      if (q.includes("sleep") || q.includes("hostel") || q.includes("dorm") || q.includes("hall of residence")) {
        if (p.category === "Hostel") score += 2;
      }
      if (q.includes("sport") || q.includes("football") || q.includes("play") || q.includes("gym") || q.includes("pitch")) {
        if (p.category === "Sports") score += 2;
      }

      // Individual word matching
      const words = q.split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) {
          if (name.includes(word)) score += 3;
          if (desc.includes(word)) score += 1;
          if (dir.includes(word)) score += 0.5;
        }
      });

      return { place: p, score: score };
    });

    // Filter out scores equal to 0, sort in descending order
    return scores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.place);
  }

  async function handleSendMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    appendChatMessage("user", text);

    // Loader simulation
    const chatHistory = document.getElementById("chatHistory");
    const loaderDiv = document.createElement("div");
    loaderDiv.className = "message bot loading-msg";
    loaderDiv.innerHTML = `
      <div class="message-bubble" style="opacity: 0.7; padding: 12px 16px;">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    chatHistory.appendChild(loaderDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text
        })
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const parsed = await response.json();
      loaderDiv.remove();

      if (parsed.action === "add_place") {
        await loadPlaces();
      }

      const matched = parsed.matchedId ? places.find(p => p.id === parsed.matchedId) : null;
      appendChatMessage("bot", parsed.reply || "I couldn't find that place yet.", matched);
      if (matched) {
        focusLocation(matched);
      }
    } catch (err) {
      console.error("API call failed:", err);
      loaderDiv.remove();
      appendChatMessage("bot", "Sorry, I had trouble reaching the server. Please check your backend connection.");
    }
  }

  // ---------- Event Listeners Setup ----------
  function setupEventListeners() {
    // Theme toggle
    document.getElementById("themeToggle").onclick = toggleTheme;

    // Search filters in browse tab
    document.getElementById("listSearchInput").addEventListener("input", renderPlacesList);



    // Form coordinate picker
    document.getElementById("btnPickOnMap").onclick = () => {
      setPickMode(!pickModeActive);
    };

    // Form Submit
    document.getElementById("addPlaceForm").addEventListener("submit", handleAddFormSubmit);



    // Chat interactions
    document.getElementById("chatSendBtn").onclick = handleSendMessage;
    document.getElementById("chatInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleSendMessage();
      }
    });
  }



  async function drawRoute(startLat, startLng, endLat, endLng, name = "", guideText = "") {
    if (routingLayer) {
      routingLayer.clearLayers();
    }
    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
    }

    // Place a marker representing your current location
    userLocationMarker = L.marker([startLat, startLng], {
      icon: L.divIcon({
        className: 'user-location-pulse',
        html: `<div style="width: 14px; height: 14px; background-color: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px #3b82f6; animation: pulse 1.8s infinite;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).bindPopup("<b>Your Current Location</b>").addTo(map);

    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("OSRM API error");
      const data = await res.json();
      
      if (data.routes && data.routes.length > 0) {
        const routeGeoJSON = data.routes[0].geometry;
        
        // Append exact target coordinates to route geometry to avoid "stopping on the road" gap
        if (routeGeoJSON.coordinates) {
          routeGeoJSON.coordinates.push([endLng, endLat]);
        }

        const routePoly = L.geoJSON(routeGeoJSON, {
          style: {
            color: "#008751",
            weight: 5,
            opacity: 0.85,
            dashArray: "2, 8",
            lineCap: "round"
          }
        }).addTo(routingLayer);

        // Adjust bounds to fit the route
        const bounds = routePoly.getBounds().extend([startLat, startLng]);
        map.fitBounds(bounds, { padding: [50, 50] });
        
        setStatus("Directions route drawn successfully.");
        if (guideText) {
          speak(`Walking route to ${name} is ready. ${guideText}`);
        }
      } else {
        throw new Error("No route found");
      }
    } catch (err) {
      console.warn("OSRM routing failed, drawing straight line:", err);
      // Fallback: draw straight dashed line
      const fallbackLine = L.polyline([[startLat, startLng], [endLat, endLng]], {
        color: "#EF4444",
        weight: 4,
        opacity: 0.8,
        dashArray: "6, 6"
      }).addTo(routingLayer);
      
      map.fitBounds(fallbackLine.getBounds(), { padding: [50, 50] });
      setStatus("Offline fallback: straight line path shown.", true);
      if (guideText) {
        speak(`Drawing direct line to ${name}. ${guideText}`);
      }
    }
  }

  // ---------- Helper Utilities ----------
  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

})();
