/* ============================================================
   GSU Navigator AI — Landing page (Live Campus + hero stats)
   ============================================================ */
(function () {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function renderStat(id, value) {
    var node = el(id);
    if (node) node.textContent = value;
  }

  function renderLiveItem(listId, items, statusColor, timeFormatter) {
    var list = el(listId);
    if (!list) return;
    if (!items || items.length === 0) {
      list.innerHTML = '<div class="lp-live-empty" style="font-size:13px;color:var(--text-muted);padding:8px 0;">Nothing happening here right now.</div>';
      return;
    }
    list.innerHTML = items.map(function (item) {
      var name = "";
      var time = "";
      if (item.status === "available") {
        name = item.venue.name;
        time = "Free now";
      } else if (item.class) {
        name = item.venue.name;
        time = (item.class.code || "") + " · " + item.class.start_time + "–" + item.class.end_time;
      }
      return (
        '<div class="lp-live-item">' +
        '<span class="dot-status" style="background:' + statusColor + ';"></span>' +
        '<span class="live-name">' + name + '</span>' +
        '<span class="live-time">' + (timeFormatter ? timeFormatter(item) : time) + '</span>' +
        '</div>'
      );
    }).join("");
  }

  function formatter(fmt) {
    return function (item) {
      if (fmt === "upcoming") {
        return fmtTime(item.start_time) + " – " + fmtTime(item.end_time);
      }
      return fmtTime(item.start_time || "");
    };
  }

  function fmtTime(t) {
    if (!t) return "";
    var parts = t.split(":");
    if (parts.length < 2) return t;
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + ampm;
  }

  function loadOverview() {
    fetch("/api/overview")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderStat("lp-stat-locations", data.total_locations || "–");
        renderStat("lp-stat-venues", data.total_venues || "–");
        renderStat("lp-avail-count", data.available_venues || 0);
        renderStat("lp-occ-count", data.occupied_venues || 0);
        renderStat("lp-up-count", data.upcoming_classes ? data.upcoming_classes.length : 0);
        renderLiveItem("lp-available-list", data.available, "var(--success)");
        renderLiveItem("lp-occupied-list", data.occupied, "var(--danger)");
        renderLiveItem("lp-upcoming-list", data.upcoming_classes, "var(--warning)", formatter("upcoming"));
      })
      .catch(function () {
        renderStat("lp-avail-count", "–");
        renderStat("lp-occ-count", "–");
      });
  }

  document.addEventListener("DOMContentLoaded", loadOverview);
})();