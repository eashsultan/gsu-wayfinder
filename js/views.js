/* ============================================================
   GSU Navigator AI — Student view renderers (Phase 3)
   Home next-class card, Classes timetable, Venues list + sheet
   ============================================================ */
(function () {
  "use strict";

  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  var classesData = null;
  var venuesData = null;
  var venueFilter = "all";
  var venueQuery = "";

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtTime(t) {
    if (!t) return "";
    var parts = String(t).split(":");
    var hour = parseInt(parts[0], 10);
    var min = parts[1] || "00";
    var ampm = hour >= 12 ? "PM" : "AM";
    return ((hour % 12) || 12) + ":" + min + " " + ampm;
  }

  function statusBadge(status) {
    if (status === "ongoing") return '<span class="state-badge live">● In Progress</span>';
    if (status === "upcoming") return '<span class="state-badge upcoming">Upcoming</span>';
    if (status === "done") return '<span class="state-badge done">Completed</span>';
    if (status === "occupied") return '<span class="state-badge occupied">● Occupied</span>';
    if (status === "available") return '<span class="state-badge available">● Available</span>';
    return "";
  }

  // ------------------------------------------------------------------
  // Data loading (called from app.js once the user enters the app)
  // ------------------------------------------------------------------
  function init() {
    var classesPromise = GSU.api("/api/me/classes");
    var venuesPromise = GSU.api("/api/venues");

    Promise.all([classesPromise, venuesPromise])
      .then(function (results) {
        classesData = results[0];
        venuesData = results[1];
        renderNextClass();
        renderClasses();
        renderVenues();
      })
      .catch(function (err) {
        console.error("StudentViews.init failed:", err);
        var el = $("homeNextClass");
        if (el) {
          el.innerHTML =
            '<div class="next-class-card"><div>' +
            '<p class="next-class-title">Unavailable</p>' +
            '<p class="next-class-meta">Could not load your schedule. Please check your connection.</p>' +
            "</div></div>";
        }
        var list = $("venuesList");
        if (list) list.innerHTML = '<div class="empty-state">Venue data is temporarily unavailable.</div>';
      });
  }

  // ------------------------------------------------------------------
  // Home — next class card
  // ------------------------------------------------------------------
  function renderNextClass() {
    var container = $("homeNextClass");
    if (!container) return;

    var next = classesData && classesData.next;
    if (!next) {
      container.innerHTML =
        '<div><p class="next-class-title">No upcoming classes 🎉</p>' +
        '<p class="next-class-meta">Nothing scheduled for you right now. Enjoy your free time!</p></div>';
      return;
    }

    var isToday = next.day === new Date().getDay();
    var dayLabel = isToday ? "Today" : DAY_NAMES[next.day] || "";
    var schedule = fmtTime(next.start_time) + " – " + fmtTime(next.end_time);
    if (dayLabel) schedule += " · " + dayLabel;

    container.innerHTML =
        '<div class="next-class-side">' +
          '<span class="next-class-code">' + esc(next.course_code) + "</span>" +
          statusBadge(next.today_status || next.slot_status) +
        "</div>" +
        '<div class="next-class-body">' +
          '<p class="next-class-title">' + esc(next.course_title) + "</p>" +
          '<p class="next-class-meta"><span class="pin-ico">🕐</span> ' + schedule + "</p>" +
          '<p class="next-class-meta"><span class="pin-ico">📍</span> ' + esc(next.venue_name) + "</p>" +
        "</div>" +
        '<button class="next-class-route" onclick="StudentViews.routeVenue(' + next.venue_id + ')">' +
          "Route" +
        "</button>";
  }

  // ------------------------------------------------------------------
  // Classes — today + weekly timetable
  // ------------------------------------------------------------------
  function renderClasses() {
    if (!classesData) return;

    var dateLabel = $("classesDateLabel");
    if (dateLabel) dateLabel.textContent = DAY_NAMES[new Date().getDay()] + "'s schedule, updated live.";

    var todayCont = $("classesTodayList");
    if (todayCont) {
      var todays = classesData.today || [];
      if (todays.length === 0) {
        todayCont.innerHTML = '<div class="empty-state">🎉 No classes today.</div>';
      } else {
        todayCont.innerHTML = todays.map(classCard).join("");
      }
    }

    var weekCont = $("classesWeekList");
    if (weekCont) {
      var week = classesData.week || [];
      if (week.length === 0) {
        weekCont.innerHTML = '<div class="empty-state">No classes in your timetable yet.</div>';
      } else {
        var html = "";
        var currentDay = -1;
        week.forEach(function (c) {
          if (c.day !== currentDay) {
            currentDay = c.day;
            html += '<div class="day-divider"><span>' + DAY_NAMES[currentDay] + "</span></div>";
          }
          html += classCard(c);
        });
        weekCont.innerHTML = html;
      }
    }
  }

  function classCard(c) {
    return (
      '<div class="class-card">' +
        '<div class="class-card-time">' +
          "<span class=\"class-card-start\">" + fmtTime(c.start_time) + "</span>" +
          "<span class=\"class-card-end\">" + fmtTime(c.end_time) + "</span>" +
        "</div>" +
        '<div class="class-card-body">' +
          '<p class="class-card-code">' + esc(c.course_code) + "</p>" +
          '<p class="class-card-title">' + esc(c.course_title) + "</p>" +
          '<p class="class-card-meta"><span class="pin-ico">📍</span> ' + esc(c.venue_name) + "</p>" +
          statusBadge(c.today_status || c.slot_status) +
        "</div>" +
      "</div>"
    );
  }

  // ------------------------------------------------------------------
  // Venues — searchable + filterable live list
  // ------------------------------------------------------------------
  function renderVenues() {
    var list = $("venuesList");
    if (!list) return;
    if (!venuesData) {
      list.innerHTML = '<div class="skeleton" style="height:110px;"></div>';
      return;
    }

    var rows = venuesData.filter(function (v) {
      if (venueQuery) {
        var hay = ((v.name || "") + " " + (v.building || "") + " " + (v.code || "")).toLowerCase();
        if (hay.indexOf(venueQuery) === -1) return false;
      }
      if (venueFilter === "available") return v.status === "available";
      if (venueFilter === "occupied") return v.status === "occupied";
      if (venueFilter === "upcoming") {
        if (v.next_class) return true;
        return (v.today_classes || []).some(function (c) { return c.slot_status === "upcoming"; });
      }
      return true;
    });

    if (rows.length === 0) {
      list.innerHTML = '<div class="empty-state">No venues match your search.</div>';
      return;
    }
    list.innerHTML = rows.map(venueCard).join("");
  }

  function venueCard(v) {
    var meta = "";
    if (v.current_class) {
      meta =
        '<p class="venue-card-class"><span class="live-dot"></span> ' +
        esc(v.current_class.course_code) +
        " · " + fmtTime(v.current_class.start_time) + " – " + fmtTime(v.current_class.end_time) + "</p>";
    } else if (v.next_class) {
      meta =
        '<p class="venue-card-class">Next: ' +
        esc(v.next_class.course_code) +
        " · " + fmtTime(v.next_class.start_time) + " – " + fmtTime(v.next_class.end_time) + "</p>";
    } else {
      var anyDone = (v.today_classes || []).some(function (c) { return c.slot_status === "done"; });
      meta = '<p class="venue-card-class muted">' + (anyDone ? "No more sessions today" : "Free all day") + "</p>";
    }

    var stateCls = v.status === "occupied" ? "occupied" : "available";
    var extras = [];
    if (v.building) extras.push(esc(v.building));
    if (v.capacity) extras.push(esc(v.capacity) + " seats");
    if (v.category) extras.push(esc(v.category));

    return (
      '<div class="venue-card">' +
        '<button class="venue-card-main" onclick="StudentViews.openVenue(' + v.id + ')">' +
          '<div class="venue-card-top">' +
            '<span class="venue-card-name">' + esc(v.name) + "</span>" +
            '<span class="state-badge ' + stateCls + '">' + (v.status === "occupied" ? "● Occupied" : "● Available") + "</span>" +
          "</div>" +
          meta +
          '<p class="venue-card-sub">' + extras.join(" · ") + "</p>" +
        "</button>" +
        '<button class="venue-card-route" onclick="StudentViews.routeVenue(' + v.id + ')">🗺️ Route</button>' +
      "</div>"
    );
  }

  // ------------------------------------------------------------------
  // Venue detail sheet
  // ------------------------------------------------------------------
  function openVenue(venueId) {
    var v = (venuesData || []).find(function (x) { return x.id === venueId; });
    if (!v) return;
    var overlay = $("venueDetailOverlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    if (document.body) document.body.classList.add("sheet-open");

    $("venueDetailName").textContent = v.name;

    var statusElClass = "venue-detail-status-badge " + (v.status === "occupied" ? "occupied" : "available");
    var statusText = v.status === "occupied" ? "● Occupied now" : "● Available now";

    var subText = [v.building, v.category, v.capacity ? v.capacity + " seats" : ""]
      .filter(Boolean)
      .join(" · ");

    var today = v.today_classes || [];
    var schedHtml;
    if (today.length === 0) {
      schedHtml = '<div class="empty-state">No classes scheduled here today.</div>';
    } else {
      schedHtml =
        '<div class="venue-schedule-list">' +
        today
          .map(function (c) {
            return (
              '<div class="venue-slot">' +
                '<div class="venue-slot-time">' + fmtTime(c.start_time) + " – " + fmtTime(c.end_time) + "</div>" +
                '<div class="venue-slot-body">' +
                  "<strong>" + esc(c.course_code) + "</strong> " + esc(c.course_title) +
                  '<span class="venue-slot-sub">' + esc(c.department || "General") + " · Level " + esc(c.level) + "</span>" +
                "</div>" +
                statusBadge(c.slot_status) +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }

    var body = $("venueDetailBody");
    if (body) {
      body.innerHTML =
        '<div class="venue-detail-info">' +
          '<span class="' + statusElClass + '">' + statusText + "</span>" +
          '<p class="venue-detail-sub">' + esc(subText) + "</p>" +
        "</div>" +
        '<h4 class="venue-detail-section-title">Today’s Schedule</h4>' +
        schedHtml +
        '<button class="venue-route-btn" id="venueDetailRouteBtn">🗺️ Get Directions</button>';
      var routeBtn = $("venueDetailRouteBtn");
      if (routeBtn) routeBtn.onclick = function () { routeVenue(v.id); };
    }
  }

  function routeVenue(venueId) {
    var v = (venuesData || []).find(function (x) { return x.id === venueId; });
    if (!v) return;
    if (window.App && window.App.closeVenueDetail) window.App.closeVenueDetail();
    if (window.App && window.App.switchTab) window.App.switchTab("map");
    if (window.App && window.App.drawRoute) {
      window.App.drawRoute(v.lat, v.lng, v.name, "Walk to " + v.name + " at GSU.");
    }
  }

  // ------------------------------------------------------------------
  // Wire-up static controls
  // ------------------------------------------------------------------
  function initControls() {
    var chips = $("venueFilterChips");
    if (chips) {
      chips.querySelectorAll(".chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          chips.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
          venueFilter = chip.getAttribute("data-filter") || "all";
          renderVenues();
        });
      });
    }
    var search = $("venueSearchInput");
    if (search) {
      search.addEventListener("input", function () {
        venueQuery = search.value.trim().toLowerCase();
        renderVenues();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initControls);
  } else {
    initControls();
  }

  window.StudentViews = {
    init: init,
    renderNextClass: renderNextClass,
    renderClasses: renderClasses,
    renderVenues: renderVenues,
    openVenue: openVenue,
    routeVenue: routeVenue
  };
})();