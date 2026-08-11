/* ============================================================
   GSU Navigator AI — API client + session token helpers
   ============================================================ */
(function () {
  "use strict";

  var TOKEN_KEY = "gsu_token";
  var USER_KEY = "gsu_user";

  window.GSU = window.GSU || {};

  GSU.getToken = function () {
    return localStorage.getItem(TOKEN_KEY) || "";
  };

  GSU.getStoredUser = function () {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  };

  GSU.setSession = function (token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  GSU.clearSession = function () {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  GSU.isAuthenticated = function () {
    return !!GSU.getStoredUser() && !!GSU.getToken();
  };

  /*
   * Wrapper around fetch that attaches Authorization header when available
   * and normalizes non-2xx responses into thrown Errors.
   */
  GSU.api = function (path, options) {
    options = options || {};
    options.headers = options.headers || {};
    var currentToken = GSU.getToken();
    if (options.body && typeof options.body === "object") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    if (currentToken && !options.public) {
      options.headers.Authorization = "Bearer " + currentToken;
    }
    return fetch(path, options).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error((data && (data.detail || data.message)) || "Request failed");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  };

  /* Show a transient toast notification */
  GSU.toast = function (message, type) {
    var el = document.getElementById("gsu-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "gsu-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.className = "toast show" + (type ? " toast-" + type : "");
    el.textContent = message;
    clearTimeout(GSU.toast._t);
    GSU.toast._t = setTimeout(function () {
      el.classList.remove("show");
    }, 3200);
  };
})();