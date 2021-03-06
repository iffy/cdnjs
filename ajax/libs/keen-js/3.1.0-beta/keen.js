!function(name, context, definition){if (typeof define == "function" && define.amd) {define("keen", [], function(lib){ return definition(); });}if ( typeof module === "object" && typeof module.exports === "object" ) {module.exports = definition();} else {context[name] = definition();}}("Keen", this, function(Keen) {"use strict";

/*!
* ----------------
* Keen IO Core JS
* ----------------
*/

function Keen(config) {
  if (config) {
    this.configure(config);
  }
}

Keen.version = "3.1.0-beta"; // replaced

Keen.utils = {};

Keen.canXHR = false;
if (typeof XMLHttpRequest === "object" || typeof XMLHttpRequest === "function") {
  if ("withCredentials" in new XMLHttpRequest()) {
    Keen.canXHR = true;
  }
}

Keen.urlMaxLength = 16000;
if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
  Keen.urlMaxLength = 2000;
}

Keen.loaded = true;
Keen.ready = function(callback){
  if (Keen.loaded) {
    callback();
  } else {
    Keen.on('ready', callback);
  }
};

Keen.log = function(message) {
  if (typeof console == "object") {
    console.log('[Keen IO]', message);
  }
};

var Events = Keen.Events = {
  on: function(name, callback) {
    this.listeners || (this.listeners = {});
    var events = this.listeners[name] || (this.listeners[name] = []);
    events.push({callback: callback});
    return this;
  },
  once: function(name, callback, context) {
    var self = this;
    var once = _once(function() {
      self.off(name, once);
      callback.apply(this, arguments);
    });
    once._callback = callback;
    return self.on(name, once, context);
  },
  off: function(name, callback, context) {
    if (!this.listeners) return this;

    // Remove all callbacks for all events.
    if (!name && !callback && !context) {
      this.listeners = void 0;
      return this;
    }

    var names = [];
    if (name) {
      names.push(name);
    } else {
      _each(this.listeners, function(value, key){
        names.push(key);
      });
    }

    for (var i = 0, length = names.length; i < length; i++) {
      name = names[i];

      // Bail out if there are no events stored.
      var events = this.listeners[name];
      if (!events) continue;

      // Remove all callbacks for this event.
      if (!callback && !context) {
        delete this.listeners[name];
        continue;
      }

      // Find any remaining events.
      var remaining = [];
      for (var j = 0, k = events.length; j < k; j++) {
        var event = events[j];
        if (
          callback && callback !== event.callback &&
          callback !== event.callback._callback ||
          context && context !== event.context
        ) {
          remaining.push(event);
        }
      }

      // Replace events if there are any remaining.  Otherwise, clean up.
      if (remaining.length) {
        this.listeners[name] = remaining;
      } else {
        delete this.listeners[name];
      }
    }

    return this;
  },
  trigger: function(name) {
    if (!this.listeners) return this;
    var args = Array.prototype.slice.call(arguments, 1);
    var events = this.listeners[name] || [];
    for (var i = 0; i < events.length; i++) {
      events[i]['callback'].apply(this, args);
    }
    return this;
  }
};

function _once(func) {
  var ran = false, memo;
  return function() {
    if (ran) return memo;
    ran = true;
    memo = func.apply(this, arguments);
    func = null;
    return memo;
  };
}

_extend(Keen.prototype, Events);
_extend(Keen, Events);

/*!
  * ----------------------
  * Keen IO Plugin
  * Async Loader
  * ----------------------
  */

  function _loadAsync(){
    var loaded = window['Keen'],
        cached = window['_' + 'Keen'] || {},
        clients,
        ready;

    if (loaded && cached) {
      clients = cached['clients'] || {},
      ready = cached['ready'] || [];

      for (var instance in clients) {
        if (clients.hasOwnProperty(instance)) {
          var client = clients[instance];

          // Map methods to existing instances
          for (var method in Keen.prototype) {
            if (Keen.prototype.hasOwnProperty(method)) {
              loaded.prototype[method] = Keen.prototype[method];
            }
          }

          // Map additional methods as necessary
          loaded.Query = (Keen.Query) ? Keen.Query : function(){};
          loaded.Visualization = (Keen.Visualization) ? Keen.Visualization : function(){};

          // Run Configuration
          if (client._config) {
            client.configure.call(client, client._config);
            delete client._config;
          }

          // Add Global Properties
          if (client._setGlobalProperties) {
            var globals = client._setGlobalProperties;
            for (var i = 0; i < globals.length; i++) {
              client.setGlobalProperties.apply(client, globals[i]);
            }
            delete client._setGlobalProperties;
          }

          // Send Queued Events
          if (client._addEvent) {
            var queue = client._addEvent || [];
            for (var i = 0; i < queue.length; i++) {
              client.addEvent.apply(client, queue[i]);
            }
            delete client._addEvent;
          }

          // Create "on" Events
          var callback = client._on || [];
          if (client._on) {
            for (var i = 0; i < callback.length; i++) {
              client.on.apply(client, callback[i]);
            }
            client.trigger('ready');
            delete client._on;
          }

        }
      }

      for (var i = 0; i < ready.length; i++) {
        var callback = ready[i];
        Keen.once('ready', function(){
          callback();
        });
      };
    }
  }

Keen.prototype.addEvent = function(eventCollection, payload, success, error) {
  _uploadEvent.apply(this, arguments);
};

Keen.prototype.configure = function(config){
  if (!config) {
    Keen.log("Check out our JavaScript SDK Usage Guide: https://github.com/keenlabs/keen-js/tree/master/docs");
  }

  if (!config.projectId) {
    Keen.log("Please provide a projectId");
  }

  if (!Keen.canXHR && config.requestType === "xhr") {
    config.requestType = "jsonp";
  }

  if (config["host"]) {
    config["host"].replace(/.*?:\/\//g, '');
  }

  if (config.protocol && config.protocol === "auto") {
    config["protocol"] = location.protocol.replace(/:/g, '');
  }

  this.config = {
    projectId   : config.projectId,
    writeKey    : config.writeKey,
    readKey     : config.readKey,
    masterKey   : config.masterKey,
    requestType : config.requestType || "jsonp",
    host        : config["host"]     || "api.keen.io/3.0",
    protocol    : config["protocol"] || "https",
    globalProperties: null
  };

  this.trigger('ready');
  Keen.trigger('client', this, config);
};

Keen.prototype.masterKey = function(str){
  if (!arguments.length) return this.config.masterKey;
  this.config.masterKey = (str ? String(str) : null);
  return this;
};

Keen.prototype.projectId = function(str){
  if (!arguments.length) return this.config.projectId;
  this.config.projectId = (str ? String(str) : null);
  return this;
};

Keen.prototype.readKey = function(str){
  if (!arguments.length) return this.config.readKey;
  this.config.readKey = (str ? String(str) : null);
  return this;
};

Keen.prototype.setGlobalProperties = function(newGlobalProperties) {
  if (newGlobalProperties && typeof(newGlobalProperties) == "function") {
    this.config.globalProperties = newGlobalProperties;
  } else {
    Keen.log('Invalid value for global properties: ' + newGlobalProperties);
  }
};

Keen.prototype.trackExternalLink = function(jsEvent, eventCollection, payload, timeout, timeoutCallback){

  var evt = jsEvent,
      target = (evt.currentTarget) ? evt.currentTarget : (evt.srcElement || evt.target),
      timer = timeout || 500,
      triggered = false,
      targetAttr = "",
      callback,
      win;

  if (target.getAttribute !== void 0) {
    targetAttr = target.getAttribute("target");
  } else if (target.target) {
    targetAttr = target.target;
  }

  if ((targetAttr == "_blank" || targetAttr == "blank") && !evt.metaKey) {
    win = window.open("about:blank");
    win.document.location = target.href;
  }

  if (target.nodeName === "A") {
    callback = function(){
      if(!triggered && !evt.metaKey && (targetAttr !== "_blank" && targetAttr !== "blank")){
        triggered = true;
        window.location = target.href;
      }
    };
  } else if (target.nodeName === "FORM") {
    callback = function(){
      if(!triggered){
        triggered = true;
        target.submit();
      }
    };
  } else {
    Keen.log("#trackExternalLink method not attached to an <a> or <form> DOM element");
  }

  if (timeoutCallback) {
    callback = function(){
      if(!triggered){
        triggered = true;
        timeoutCallback();
      }
    };
  }
  _uploadEvent.call(this, eventCollection, payload, callback, callback);

  setTimeout(callback, timer);

  if (!evt.metaKey) {
    return false;
  }
};

Keen.prototype.url = function(path){
  return this.config.protocol + "://" + this.config.host + path;
};

Keen.prototype.writeKey = function(str){
  if (!arguments.length) return this.config.writeKey;
  this.config.writeKey = (str ? String(str) : null);
  return this;
};

function _clone(target) {
  return JSON.parse(JSON.stringify(target));
}
function _each(o, cb, s){
  var n;
  if (!o){
    return 0;
  }
  s = !s ? o : s;
  if (o instanceof Array){
    // Indexed arrays, needed for Safari
    for (n=0; n<o.length; n++) {
      if (cb.call(s, o[n], n, o) === false){
        return 0;
      }
    }
  } else {
    // Hashtables
    for (n in o){
      if (o.hasOwnProperty(n)) {
        if (cb.call(s, o[n], n, o) === false){
          return 0;
        }
      }
    }
  }
  return 1;
}
_extend(Keen.utils, { each: _each });

function _extend(target){
  for (var i = 1; i < arguments.length; i++) {
    for (var prop in arguments[i]){
      target[prop] = arguments[i][prop];
    }
  }
  return target;
}
_extend(Keen.utils, { extend: _extend });

function _parseParams(str){
  // via: http://stackoverflow.com/a/2880929/2511985
  var urlParams = {},
      match,
      pl     = /\+/g,  // Regex for replacing addition symbol with a space
      search = /([^&=]+)=?([^&]*)/g,
      decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
      query  = str.split("?")[1];

  while (!!(match=search.exec(query))) {
    urlParams[decode(match[1])] = decode(match[2]);
  }
  return urlParams;
}
_extend(Keen.utils, { parseParams: _parseParams });

function _sendBeacon(url, params, success, error){
  var successCallback = success,
      errorCallback = error,
      loaded = false,
      img = document.createElement("img");

  success = null;
  error = null;

  img.onload = function() {
    loaded = true;
    if ('naturalHeight' in this) {
      if (this.naturalHeight + this.naturalWidth === 0) {
        this.onerror();
        return;
      }
    } else if (this.width + this.height === 0) {
      this.onerror();
      return;
    }
    if (successCallback) {
      successCallback({created: true});
      successCallback = errorCallback = null;
    }
  };
  img.onerror = function() {
    loaded = true;
    if (errorCallback) {
      errorCallback();
      successCallback = errorCallback = null;
    }
  };
  img.src = url + "&c=clv1";
}

function _sendJsonp(url, params, success, error){
  var timestamp = new Date().getTime(),
      successCallback = success,
      errorCallback = error,
      script = document.createElement("script"),
      parent = document.getElementsByTagName("head")[0],
      callbackName = "keenJSONPCallback",
      loaded = false;

  success = null;
  error = null;

  callbackName += timestamp;
  while (callbackName in window) {
    callbackName += "a";
  }
  window[callbackName] = function(response) {
    if (loaded === true) return;
    loaded = true;
    if (successCallback && response) {
      successCallback(response);
    };
    cleanup();
  };

  script.src = url + "&jsonp=" + callbackName;
  parent.appendChild(script);

  // for early IE w/ no onerror event
  script.onreadystatechange = function() {
    if (loaded === false && this.readyState === "loaded") {
      loaded = true;
      if (errorCallback) {
        errorCallback();
      }
    }
  };

  // non-ie, etc
  script.onerror = function() {
    // on IE9 both onerror and onreadystatechange are called
    if (loaded === false) {
      loaded = true;
      if (errorCallback) {
        errorCallback();
      }
      cleanup();
    }
  };

  function cleanup(){
    delete window[callbackName];
    successCallback = errorCallback = null;
    parent.removeChild(script);
  }
}

function _sendXhr(method, url, headers, body, success, error){
  var ids = ['MSXML2.XMLHTTP.3.0', 'MSXML2.XMLHTTP', 'Microsoft.XMLHTTP'],
      successCallback = success,
      errorCallback = error,
      payload,
      xhr;

  success = null;
  error = null;

  if (window.XMLHttpRequest) {
    xhr = new XMLHttpRequest();
  }
  else {
    // Legacy IE support: look up alts if XMLHttpRequest is not available
    for (var i = 0; i < ids.length; i++) {
      try {
        xhr = new ActiveXObject(ids[i]);
        break;
      } catch(e) {}
    }
  }

  xhr.onreadystatechange = function() {
    var response;
    if (xhr.readyState == 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          response = JSON.parse(xhr.responseText);
        } catch (e) {
          Keen.log("Could not parse HTTP response: " + xhr.responseText);
          if (errorCallback) {
            errorCallback(xhr, e);
            successCallback = errorCallback = null;
          }
        }
        if (successCallback && response) {
          successCallback(response);
          successCallback = errorCallback = null;
        }
      } else {
        Keen.log("HTTP request failed.");
        if (errorCallback) {
          errorCallback(xhr, null);
          successCallback = errorCallback = null;
        }
      }
    }
  };

  xhr.open(method, url, true);

  _each(headers, function(value, key){
    xhr.setRequestHeader(key, value);
  });

  if (body) {
    payload = JSON.stringify(body);
  }

  if (method && method.toUpperCase() === "GET") {
    xhr.send();
  } else if (method && method.toUpperCase() === "POST") {
    xhr.send(payload);
  }

}

function _uploadEvent(eventCollection, payload, success, error) {
  var urlBase = this.url("/projects/" + this.projectId() + "/events/" + eventCollection),
      urlQueryString = "",
      reqType = this.config.requestType,
      data = {};

  // Add properties from client.globalProperties
  if (this.config.globalProperties) {
    data = this.config.globalProperties(eventCollection);
  }

  // Add properties from user-defined event
  _each(payload, function(value, key){
    data[key] = value;
  });

  if (reqType !== "xhr") {
    urlQueryString += "?api_key="  + encodeURIComponent( this.writeKey() );
    urlQueryString += "&data="     + encodeURIComponent( Keen.Base64.encode( JSON.stringify(data) ) );
    urlQueryString += "&modified=" + encodeURIComponent( new Date().getTime() );

    if ( String(urlBase + urlQueryString).length < Keen.urlMaxLength ) {
      if (reqType === "jsonp") {
        _sendJsonp(urlBase + urlQueryString, null, success, error);
      } else {
        _sendBeacon(urlBase + urlQueryString, null, success, error);
      }
      return;
    }
  }
  if (Keen.canXHR) {
    _sendXhr("POST", urlBase, { "Authorization": this.writeKey(), "Content-Type": "application/json" }, data, success, error);
  } else {
    Keen.log("Event not sent: URL length exceeds current browser limit, and XHR (POST) is not supported.");
  }
  return;
};

/*!
  * -----------------
  * Keen IO Query JS
  * -----------------
  */


  // -------------------------------
  // Inject <client>.query Method
  // -------------------------------

  Keen.prototype.run = function(query, success, error) {
    var queries = [],
        successCallback = success,
        errorCallback = error;

    success = null;
    error = null;

    if (query instanceof Array) {
      queries = query;
    } else {
      queries.push(query);
    }
    var req = new Keen.Request(this, queries, successCallback, errorCallback);
    successCallback = errorCallback = null;
    return req;
  };


  // -------------------------------
  // Keen.Request
  // -------------------------------

  Keen.Request = function(instance, queries, success, error){
    var successCallback = success,
        errorCallback = error;

    success = null;
    error = null;

    this.configure(instance, queries, successCallback, errorCallback);
    successCallback = errorCallback = null;
  };
  _extend(Keen.Request.prototype, Events);

  Keen.Request.prototype.configure = function(instance, queries, success, error){
    this.instance = instance;
    this.queries = queries;
    this.data;

    this.success = success;
    success = null;

    this.error = error;
    error = null;

    this.refresh();
    return this;
  };

  Keen.Request.prototype.refresh = function(){

    var self = this,
        completions = 0,
        response = [];

    var handleSuccess = function(res, index){
      response[index] = res;
      self.queries[index].data = res;
      self.queries[index].trigger("complete", self.queries[index].data);

      // Increment completion count
      completions++;
      if (completions == self.queries.length) {

        // Attach response/meta data to query
        if (self.queries.length == 1) {
          self.data = response[0];
        } else {
          self.data = response;
        }

        // Trigger completion event on query
        self.trigger("complete", self.data);

        // Fire callback
        if (self.success) {
          self.success(self.data);
        }
      }

    };

    var handleFailure = function(res, req){
      var response, status;
      if (res) {
        response = JSON.parse(res.responseText);
        status = res.status + " " + res.statusText;
      } else {
        response = {
          message: "Your query could not be completed, and the exact error message could not be captured (limitation of JSONP requests)",
          error_code: "JS SDK"
        };
        status = "Error";
      }

      self.trigger("error", response);
      if (self.error) {
        self.error(response);
      }
      Keen.log(status + " (" + response.error_code + "): " + response.message);
    };

    _each(self.queries, function(query, index){
      var url;
      var successSequencer = function(res){
        handleSuccess(res, index);
      };
      var failureSequencer = function(res){
        handleFailure(res, index);
      };

      if (query instanceof Keen.Query) {
        url = self.instance.url("/projects/" + self.instance.projectId() + query.path);
        _sendQuery.call(self.instance, url, query.params, successSequencer, failureSequencer);
      }
      else if ( Object.prototype.toString.call(query) === '[object String]' ) {
        url = self.instance.url("/projects/" + self.instance.projectId() + "/saved_queries/" + encodeURIComponent(query) + "/result");
        _sendQuery.call(self.instance, url, null, successSequencer, failureSequencer);
      }
      else {
        var res = {
          statusText: 'Bad Request',
          responseText: { message: 'Error: Query ' + (+index+1) + ' of ' + self.queries.length + ' for project ' + self.instance.projectId() + ' is not a valid request' }
        };
        Keen.log(res.responseText.message);
        Keen.log('Check out our JavaScript SDK Usage Guide for Data Analysis:');
        Keen.log('https://keen.io/docs/clients/javascript/usage-guide/#analyze-and-visualize');
        if (self.error) {
          self.error(res.responseText.message);
        }
      }
    });
    return this;
  };


  // -------------------------------
  // Keen.Query
  // -------------------------------

  Keen.Query = function(){
    this.configure.apply(this, arguments);
  };
  _extend(Keen.Query.prototype, Events);

  Keen.Query.prototype.configure = function(analysisType, params) {
    this.analysis = analysisType;
    this.path = '/queries/' + analysisType;

    // Apply params w/ #set method
    this.params = this.params || {};
    this.set(params);

    // Localize timezone if none is set
    if (this.params.timezone === void 0) {
      this.params.timezone = _getTimezoneOffset();
    }
    return this;
  };

  Keen.Query.prototype.get = function(attribute) {
    var key = attribute;
    if (key.match(new RegExp("[A-Z]"))) {
      key = key.replace(/([A-Z])/g, function($1) { return "_"+$1.toLowerCase(); });
    }
    if (this.params) {
      return this.params[key] || null;
    }
  };

  Keen.Query.prototype.set = function(attributes) {
    var self = this;
    _each(attributes, function(v, k){
      var key = k, value = v;
      if (k.match(new RegExp("[A-Z]"))) {
        key = k.replace(/([A-Z])/g, function($1) { return "_"+$1.toLowerCase(); });
      }
      self.params[key] = value;
      if (value instanceof Array) {
        _each(value, function(dv, index){
          if (dv instanceof Array == false && typeof dv === "object") { //  _type(dv)==="Object"
            _each(dv, function(deepValue, deepKey){
              if (deepKey.match(new RegExp("[A-Z]"))) {
                var _deepKey = deepKey.replace(/([A-Z])/g, function($1) { return "_"+$1.toLowerCase(); });
                delete self.params[key][index][deepKey];
                self.params[key][index][_deepKey] = deepValue;
              }
            });
          }
        });
      }
    });
    return self;
  };

  Keen.Query.prototype.addFilter = function(property, operator, value) {
    this.params.filters = this.params.filters || [];
    this.params.filters.push({
      "property_name": property,
      "operator": operator,
      "property_value": value
    });
    return this;
  };


  // Private
  // --------------------------------

  function _getTimezoneOffset(){
    return new Date().getTimezoneOffset() * -60;
  };

  function _getQueryString(params){
    var query = [];
    for (var key in params) {
      if (params[key]) {
        var value = params[key];
        if (Object.prototype.toString.call(value) !== '[object String]') {
          value = JSON.stringify(value);
        }
        value = encodeURIComponent(value);
        query.push(key + '=' + value);
      }
    }
    return "&" + query.join('&');
  };


  function _sendQuery(url, params, success, error){
    var urlBase = url,
        urlQueryString = "",
        reqType = this.config.requestType,
        successCallback = success,
        errorCallback = error;

    success = null;
    error = null;

    if (urlBase.indexOf("extraction") > -1) {
      // Extractions do not currently support JSONP
      reqType = "xhr";
    }
    urlQueryString += "?api_key=" + this.readKey();
    urlQueryString += _getQueryString.call(this, params);

    if (reqType !== "xhr") {
      if ( String(urlBase + urlQueryString).length < Keen.urlMaxLength ) {
        _sendJsonp(urlBase + urlQueryString, null, successCallback, errorCallback);
        return;
      }
    }

    if (Keen.canXHR) {
      _sendXhr("GET", urlBase + urlQueryString, null, null, successCallback, errorCallback);
    } else {
      Keen.log("Event not sent: URL length exceeds current browser limit, and XHR (POST) is not supported.");
    }
    successCallback = errorCallback = null;
    return;
  }

/*!
  * ----------------------------------------
  * Keen IO Base64 Transcoding
  * ----------------------------------------
  */

  Keen.Base64 = {
    map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encode: function (n) {
      "use strict";
      var o = "", i = 0, m = this.map, i1, i2, i3, e1, e2, e3, e4;
      n = this.utf8.encode(n);
      while (i < n.length) {
        i1 = n.charCodeAt(i++); i2 = n.charCodeAt(i++); i3 = n.charCodeAt(i++);
        e1 = (i1 >> 2); e2 = (((i1 & 3) << 4) | (i2 >> 4)); e3 = (isNaN(i2) ? 64 : ((i2 & 15) << 2) | (i3 >> 6));
        e4 = (isNaN(i2) || isNaN(i3)) ? 64 : i3 & 63;
        o = o + m.charAt(e1) + m.charAt(e2) + m.charAt(e3) + m.charAt(e4);
      } return o;
    },
    decode: function (n) {
      "use strict";
      var o = "", i = 0, m = this.map, cc = String.fromCharCode, e1, e2, e3, e4, c1, c2, c3;
      n = n.replace(/[^A-Za-z0-9\+\/\=]/g, "");
      while (i < n.length) {
        e1 = m.indexOf(n.charAt(i++)); e2 = m.indexOf(n.charAt(i++));
        e3 = m.indexOf(n.charAt(i++)); e4 = m.indexOf(n.charAt(i++));
        c1 = (e1 << 2) | (e2 >> 4); c2 = ((e2 & 15) << 4) | (e3 >> 2);
        c3 = ((e3 & 3) << 6) | e4;
        o = o + (cc(c1) + ((e3 != 64) ? cc(c2) : "")) + (((e4 != 64) ? cc(c3) : ""));
      } return this.utf8.decode(o);
    },
    utf8: {
      encode: function (n) {
        "use strict";
        var o = "", i = 0, cc = String.fromCharCode, c;
        while (i < n.length) {
          c = n.charCodeAt(i++); o = o + ((c < 128) ? cc(c) : ((c > 127) && (c < 2048)) ?
          (cc((c >> 6) | 192) + cc((c & 63) | 128)) : (cc((c >> 12) | 224) + cc(((c >> 6) & 63) | 128) + cc((c & 63) | 128)));
          } return o;
      },
      decode: function (n) {
        "use strict";
        var o = "", i = 0, cc = String.fromCharCode, c2, c;
        while (i < n.length) {
          c = n.charCodeAt(i);
          o = o + ((c < 128) ? [cc(c), i++][0] : ((c > 191) && (c < 224)) ?
          [cc(((c & 31) << 6) | ((c2 = n.charCodeAt(i + 1)) & 63)), (i += 2)][0] :
          [cc(((c & 15) << 12) | (((c2 = n.charCodeAt(i + 1)) & 63) << 6) | ((c3 = n.charCodeAt(i + 2)) & 63)), (i += 3)][0]);
        } return o;
      }
    }
  };

/*! 
  * --------------------------------------------
  * JSON2.js
  * https://github.com/douglascrockford/JSON-js
  * --------------------------------------------
  */

  // Create a JSON object only if one does not already exist. We create the
  // methods in a closure to avoid creating global variables.

  if (typeof JSON !== 'object') {
    JSON = {};
  }

  (function () {
    'use strict';

    function f(n) {
      // Format integers to have at least two digits.
      return n < 10 ? '0' + n : n;
    };

    if (typeof Date.prototype.toJSON !== 'function') {
      Date.prototype.toJSON = function (key) {
        return isFinite(this.valueOf())
            ? this.getUTCFullYear()     + '-' +
            f(this.getUTCMonth() + 1) + '-' +
            f(this.getUTCDate())      + 'T' +
            f(this.getUTCHours())     + ':' +
            f(this.getUTCMinutes())   + ':' +
            f(this.getUTCSeconds())   + 'Z'
            : null;
      };
      String.prototype.toJSON =
        Number.prototype.toJSON =
          Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
          };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      gap,
      indent,
      meta = {  // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
      },
      rep;

    function quote(string) {
      // If the string contains no control characters, no quote characters, and no
      // backslash characters, then we can safely slap some quotes around it.
      // Otherwise we must also replace the offending characters with safe escape
      // sequences.
      escapable.lastIndex = 0;
      return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
        var c = meta[a];
        return typeof c === 'string'
          ? c
          : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + string + '"';
    };

    function str(key, holder) {
      // Produce a string from holder[key].
      var i, // The loop counter.
          k, // The member key.
          v, // The member value.
          length,
          mind = gap,
          partial,
          value = holder[key];

      // If the value has a toJSON method, call it to obtain a replacement value.
      if (value && typeof value === 'object' &&
        typeof value.toJSON === 'function') {
        value = value.toJSON(key);
      }

      // If we were called with a replacer function, then call the replacer to
      // obtain a replacement value.
      if (typeof rep === 'function') {
        value = rep.call(holder, key, value);
      }
    
      // What happens next depends on the value's type.
      switch (typeof value) {
        case 'string':
          return quote(value);
        case 'number':
          // JSON numbers must be finite. Encode non-finite numbers as null.
          return isFinite(value) ? String(value) : 'null';
        case 'boolean':
        case 'null':
          // If the value is a boolean or null, convert it to a string. Note:
          // typeof null does not produce 'null'. The case is included here in
          // the remote chance that this gets fixed someday.
          return String(value);
        // If the type is 'object', we might be dealing with an object or an array or null.
        case 'object':
          // Due to a specification blunder in ECMAScript, typeof null is 'object',
          // so watch out for that case.
          if (!value) {
            return 'null';
          }
          // Make an array to hold the partial results of stringifying this object value.
          gap += indent;
          partial = [];
          // Is the value an array?
          if (Object.prototype.toString.apply(value) === '[object Array]') {
            // The value is an array. Stringify every element. Use null as a placeholder
            // for non-JSON values.
            length = value.length;
            for (i = 0; i < length; i += 1) {
              partial[i] = str(i, value) || 'null';
            }
            // Join all of the elements together, separated with commas, and wrap them in brackets.
            v = partial.length === 0
              ? '[]'
              : gap
              ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
              : '[' + partial.join(',') + ']';
            gap = mind;
            return v;
          }
          // If the replacer is an array, use it to select the members to be stringified.
          if (rep && typeof rep === 'object') {
            length = rep.length;
            for (i = 0; i < length; i += 1) {
              if (typeof rep[i] === 'string') {
                k = rep[i];
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          } else {
            // Otherwise, iterate through all of the keys in the object.
            for (k in value) {
              if (Object.prototype.hasOwnProperty.call(value, k)) {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          }
          // Join all of the member texts together, separated with commas,
          // and wrap them in braces.
          v = partial.length === 0
              ? '{}'
              : gap
              ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
              : '{' + partial.join(',') + '}';
          gap = mind;
          return v;
        }
      }
    
      // If the JSON object does not yet have a stringify method, give it one.
      if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {
          // The stringify method takes a value and an optional replacer, and an optional
          // space parameter, and returns a JSON text. The replacer can be a function
          // that can replace values, or an array of strings that will select the keys.
          // A default replacer method can be provided. Use of the space parameter can
          // produce text that is more easily readable.
          var i;
          gap = '';
          indent = '';

          // If the space parameter is a number, make an indent string containing that
          // many spaces.
          if (typeof space === 'number') {
            for (i = 0; i < space; i += 1) {
              indent += ' ';
            }
            // If the space parameter is a string, it will be used as the indent string.
          } else if (typeof space === 'string') {
            indent = space;
          }

          // If there is a replacer, it must be a function or an array.
          // Otherwise, throw an error.
          rep = replacer;
          if (replacer && typeof replacer !== 'function' && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) {
            throw new Error('JSON.stringify');
          }
        
          // Make a fake root object containing our value under the key of ''.
          // Return the result of stringifying the value.
          return str('', {'': value});
        };
      }

      // If the JSON object does not yet have a parse method, give it one.
      if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {
          // The parse method takes a text and an optional reviver function, and returns
          // a JavaScript value if the text is a valid JSON text.
          var j;
          function walk(holder, key) {
            // The walk method is used to recursively walk the resulting structure so
            // that modifications can be made.
            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
              for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                  v = walk(value, k);
                  if (v !== undefined) {
                    value[k] = v;
                  } else {
                    delete value[k];
                  }
                }
              }
            }
            return reviver.call(holder, key, value);
          }

          // Parsing happens in four stages. In the first stage, we replace certain
          // Unicode characters with escape sequences. JavaScript handles many characters
          // incorrectly, either silently deleting them, or treating them as line endings.
          text = String(text);
          cx.lastIndex = 0;
          if (cx.test(text)) {
            text = text.replace(cx, function (a) {
              return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            });
          }

          // In the second stage, we run the text against regular expressions that look
          // for non-JSON patterns. We are especially concerned with '()' and 'new'
          // because they can cause invocation, and '=' because it can cause mutation.
          // But just to be safe, we want to reject all unexpected forms.

          // We split the second stage into 4 regexp operations in order to work around
          // crippling inefficiencies in IE's and Safari's regexp engines. First we
          // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
          // replace all simple value tokens with ']' characters. Third, we delete all
          // open brackets that follow a colon or comma or that begin the text. Finally,
          // we look to see that the remaining characters are only whitespace or ']' or
          // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.
          if (/^[\],:{}\s]*$/
              .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
              .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
              .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

                // In the third stage we use the eval function to compile the text into a
                // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
                // in JavaScript: it can begin a block or an object literal. We wrap the text
                // in parens to eliminate the ambiguity.
                j = eval('(' + text + ')');

                // In the optional fourth stage, we recursively walk the new structure, passing
                // each name/value pair to a reviver function for possible transformation.
                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
          }

          // If the text is not JSON parseable, then a SyntaxError is thrown.
          throw new SyntaxError('JSON.parse');
      };
    }
  }());
/*!
  * domready (c) Dustin Diaz 2012 - License MIT
  */
// Modified header to work internally w/ Keen lib
/*!
  * domready (c) Dustin Diaz 2012 - License MIT
  */
(function(root, factory) {
  root.utils.domready = factory();
}(Keen, function (ready) {

  var fns = [], fn, f = false
    , doc = document
    , testEl = doc.documentElement
    , hack = testEl.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , addEventListener = 'addEventListener'
    , onreadystatechange = 'onreadystatechange'
    , readyState = 'readyState'
    , loadedRgx = hack ? /^loaded|^c/ : /^loaded|c/
    , loaded = loadedRgx.test(doc[readyState])

  function flush(f) {
    loaded = 1
    while (f = fns.shift()) f()
  }

  doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
    doc.removeEventListener(domContentLoaded, fn, f)
    flush()
  }, f)


  hack && doc.attachEvent(onreadystatechange, fn = function () {
    if (/^c/.test(doc[readyState])) {
      doc.detachEvent(onreadystatechange, fn)
      flush()
    }
  })

  return (ready = hack ?
    function (fn) {
      self != top ?
        loaded ? fn() : fns.push(fn) :
        function () {
          try {
            testEl.doScroll('left')
          } catch (e) {
            return setTimeout(function() { ready(fn) }, 50)
          }
          fn()
        }()
    } :
    function (fn) {
      loaded ? fn() : fns.push(fn)
    })
}));

/**
 * Copyright (c) 2011-2014 Felix Gnass
 * Licensed under the MIT license
 */
// Modified to work internally with Keen lib
(function(root, factory) {
  root.Spinner = factory();
}
(Keen, function() {
  "use strict";

  var prefixes = ['webkit', 'Moz', 'ms', 'O'] /* Vendor prefixes */
    , animations = {} /* Animation rules keyed by their name */
    , useCssAnimations /* Whether to use CSS animations or setTimeout */

  /**
   * Utility function to create elements. If no tag name is given,
   * a DIV is created. Optionally properties can be passed.
   */
  function createEl(tag, prop) {
    var el = document.createElement(tag || 'div')
      , n

    for(n in prop) el[n] = prop[n]
    return el
  }

  /**
   * Appends children and returns the parent.
   */
  function ins(parent /* child1, child2, ...*/) {
    for (var i=1, n=arguments.length; i<n; i++)
      parent.appendChild(arguments[i])

    return parent
  }

  /**
   * Insert a new stylesheet to hold the @keyframe or VML rules.
   */
  var sheet = (function() {
    var el = createEl('style', {type : 'text/css'})
    ins(document.getElementsByTagName('head')[0], el)
    return el.sheet || el.styleSheet
  }())

  /**
   * Creates an opacity keyframe animation rule and returns its name.
   * Since most mobile Webkits have timing issues with animation-delay,
   * we create separate rules for each line/segment.
   */
  function addAnimation(alpha, trail, i, lines) {
    var name = ['opacity', trail, ~~(alpha*100), i, lines].join('-')
      , start = 0.01 + i/lines * 100
      , z = Math.max(1 - (1-alpha) / trail * (100-start), alpha)
      , prefix = useCssAnimations.substring(0, useCssAnimations.indexOf('Animation')).toLowerCase()
      , pre = prefix && '-' + prefix + '-' || ''

    if (!animations[name]) {
      sheet.insertRule(
        '@' + pre + 'keyframes ' + name + '{' +
        '0%{opacity:' + z + '}' +
        start + '%{opacity:' + alpha + '}' +
        (start+0.01) + '%{opacity:1}' +
        (start+trail) % 100 + '%{opacity:' + alpha + '}' +
        '100%{opacity:' + z + '}' +
        '}', sheet.cssRules.length)

      animations[name] = 1
    }

    return name
  }

  /**
   * Tries various vendor prefixes and returns the first supported property.
   */
  function vendor(el, prop) {
    var s = el.style
      , pp
      , i

    prop = prop.charAt(0).toUpperCase() + prop.slice(1)
    for(i=0; i<prefixes.length; i++) {
      pp = prefixes[i]+prop
      if(s[pp] !== undefined) return pp
    }
    if(s[prop] !== undefined) return prop
  }

  /**
   * Sets multiple style properties at once.
   */
  function css(el, prop) {
    for (var n in prop)
      el.style[vendor(el, n)||n] = prop[n]

    return el
  }

  /**
   * Fills in default values.
   */
  function merge(obj) {
    for (var i=1; i < arguments.length; i++) {
      var def = arguments[i]
      for (var n in def)
        if (obj[n] === undefined) obj[n] = def[n]
    }
    return obj
  }

  /**
   * Returns the absolute page-offset of the given element.
   */
  function pos(el) {
    var o = { x:el.offsetLeft, y:el.offsetTop }
    while((el = el.offsetParent))
      o.x+=el.offsetLeft, o.y+=el.offsetTop

    return o
  }

  /**
   * Returns the line color from the given string or array.
   */
  function getColor(color, idx) {
    return typeof color == 'string' ? color : color[idx % color.length]
  }

  // Built-in defaults

  var defaults = {
    lines: 12,            // The number of lines to draw
    length: 7,            // The length of each line
    width: 5,             // The line thickness
    radius: 10,           // The radius of the inner circle
    rotate: 0,            // Rotation offset
    corners: 1,           // Roundness (0..1)
    color: '#000',        // #rgb or #rrggbb
    direction: 1,         // 1: clockwise, -1: counterclockwise
    speed: 1,             // Rounds per second
    trail: 100,           // Afterglow percentage
    opacity: 1/4,         // Opacity of the lines
    fps: 20,              // Frames per second when using setTimeout()
    zIndex: 2e9,          // Use a high z-index by default
    className: 'spinner', // CSS class to assign to the element
    top: '50%',           // center vertically
    left: '50%',          // center horizontally
    position: 'absolute'  // element position
  }

  /** The constructor */
  function Spinner(o) {
    this.opts = merge(o || {}, Spinner.defaults, defaults)
  }

  // Global defaults that override the built-ins:
  Spinner.defaults = {}

  merge(Spinner.prototype, {

    /**
     * Adds the spinner to the given target element. If this instance is already
     * spinning, it is automatically removed from its previous target b calling
     * stop() internally.
     */
    spin: function(target) {
      this.stop()

      var self = this
        , o = self.opts
        , el = self.el = css(createEl(0, {className: o.className}), {position: o.position, width: 0, zIndex: o.zIndex})
        , mid = o.radius+o.length+o.width

      css(el, {
        left: o.left,
        top: o.top
      })

      if (target) {
        target.insertBefore(el, target.firstChild||null)
      }

      el.setAttribute('role', 'progressbar')
      self.lines(el, self.opts)

      if (!useCssAnimations) {
        // No CSS animation support, use setTimeout() instead
        var i = 0
          , start = (o.lines - 1) * (1 - o.direction) / 2
          , alpha
          , fps = o.fps
          , f = fps/o.speed
          , ostep = (1-o.opacity) / (f*o.trail / 100)
          , astep = f/o.lines

        ;(function anim() {
          i++;
          for (var j = 0; j < o.lines; j++) {
            alpha = Math.max(1 - (i + (o.lines - j) * astep) % f * ostep, o.opacity)

            self.opacity(el, j * o.direction + start, alpha, o)
          }
          self.timeout = self.el && setTimeout(anim, ~~(1000/fps))
        })()
      }
      return self
    },

    /**
     * Stops and removes the Spinner.
     */
    stop: function() {
      var el = this.el
      if (el) {
        clearTimeout(this.timeout)
        if (el.parentNode) el.parentNode.removeChild(el)
        this.el = undefined
      }
      return this
    },

    /**
     * Internal method that draws the individual lines. Will be overwritten
     * in VML fallback mode below.
     */
    lines: function(el, o) {
      var i = 0
        , start = (o.lines - 1) * (1 - o.direction) / 2
        , seg

      function fill(color, shadow) {
        return css(createEl(), {
          position: 'absolute',
          width: (o.length+o.width) + 'px',
          height: o.width + 'px',
          background: color,
          boxShadow: shadow,
          transformOrigin: 'left',
          transform: 'rotate(' + ~~(360/o.lines*i+o.rotate) + 'deg) translate(' + o.radius+'px' +',0)',
          borderRadius: (o.corners * o.width>>1) + 'px'
        })
      }

      for (; i < o.lines; i++) {
        seg = css(createEl(), {
          position: 'absolute',
          top: 1+~(o.width/2) + 'px',
          transform: o.hwaccel ? 'translate3d(0,0,0)' : '',
          opacity: o.opacity,
          animation: useCssAnimations && addAnimation(o.opacity, o.trail, start + i * o.direction, o.lines) + ' ' + 1/o.speed + 's linear infinite'
        })

        if (o.shadow) ins(seg, css(fill('#000', '0 0 4px ' + '#000'), {top: 2+'px'}))
        ins(el, ins(seg, fill(getColor(o.color, i), '0 0 1px rgba(0,0,0,.1)')))
      }
      return el
    },

    /**
     * Internal method that adjusts the opacity of a single line.
     * Will be overwritten in VML fallback mode below.
     */
    opacity: function(el, i, val) {
      if (i < el.childNodes.length) el.childNodes[i].style.opacity = val
    }

  })


  function initVML() {

    /* Utility function to create a VML tag */
    function vml(tag, attr) {
      return createEl('<' + tag + ' xmlns="urn:schemas-microsoft.com:vml" class="spin-vml">', attr)
    }

    // No CSS transforms but VML support, add a CSS rule for VML elements:
    sheet.addRule('.spin-vml', 'behavior:url(#default#VML)')

    Spinner.prototype.lines = function(el, o) {
      var r = o.length+o.width
        , s = 2*r

      function grp() {
        return css(
          vml('group', {
            coordsize: s + ' ' + s,
            coordorigin: -r + ' ' + -r
          }),
          { width: s, height: s }
        )
      }

      var margin = -(o.width+o.length)*2 + 'px'
        , g = css(grp(), {position: 'absolute', top: margin, left: margin})
        , i

      function seg(i, dx, filter) {
        ins(g,
          ins(css(grp(), {rotation: 360 / o.lines * i + 'deg', left: ~~dx}),
            ins(css(vml('roundrect', {arcsize: o.corners}), {
                width: r,
                height: o.width,
                left: o.radius,
                top: -o.width>>1,
                filter: filter
              }),
              vml('fill', {color: getColor(o.color, i), opacity: o.opacity}),
              vml('stroke', {opacity: 0}) // transparent stroke to fix color bleeding upon opacity change
            )
          )
        )
      }

      if (o.shadow)
        for (i = 1; i <= o.lines; i++)
          seg(i, -2, 'progid:DXImageTransform.Microsoft.Blur(pixelradius=2,makeshadow=1,shadowopacity=.3)')

      for (i = 1; i <= o.lines; i++) seg(i)
      return ins(el, g)
    }

    Spinner.prototype.opacity = function(el, i, val, o) {
      var c = el.firstChild
      o = o.shadow && o.lines || 0
      if (c && i+o < c.childNodes.length) {
        c = c.childNodes[i+o]; c = c && c.firstChild; c = c && c.firstChild
        if (c) c.opacity = val
      }
    }
  }

  var probe = css(createEl('group'), {behavior: 'url(#default#VML)'})

  if (!vendor(probe, 'transform') && probe.adj) initVML()
  else useCssAnimations = vendor(probe, 'animation')

  return Spinner;

}));

/*!
  * ----------------
  * Keen.Dataset
  * ----------------
  */

/*
  TODO:

  [x] import Dataset project source
  [x] import Dataset project tests
  [x] update Dataset API with new sketch
  [x] fix Dataset sort method
  [x] fix Dataset handling of metrics
  [x] write tests for new sort methods

  [x] updateRow/updateColumn func iterates
  [x] move getRow* and getColumn* into /helpers

  [ ] #min, #max, #median, #average

  [ ] #getRowAverage
  [ ] #getRowMedian
  [ ] #getRowMinimum
  [ ] #getRowMaximum

  [ ] #getColumnAverage
  [ ] #getColumnMedian
  [ ] #getColumnMinimum
  [ ] #getColumnMaximum

*/

// extend(Keen.Dataset, {
//   each: each,
//   extend: extend,
//   is: is,
//   flatten: flatten
// });

Keen.Dataset = function() {
  this.data = {
    input: {},
    output: [[]]
  };
  this.meta = {
    schema: {},
    method: undefined
  };
  // temp fwd
  if (arguments.length > 0) {
    this.parse.apply(this, arguments);
  }
};

Keen.Dataset.defaults = {
  delimeter: " -> "
};

Keen.Dataset.prototype.input = function(obj){
  if (!arguments.length) return this.data.input;
  this.data.input = (obj ? JSON.parse(JSON.stringify(obj)) : null);
  return this;
};

Keen.Dataset.prototype.output = function(arr){
  if (!arguments.length) return this.data.output;
  this.data.output = (arr instanceof Array ? arr : null);
  return this;
}

Keen.Dataset.prototype.method = function(str){
  if (!arguments.length) return this.meta.method;
  this.meta.method = (str ? String(str) : null);
  return this;
};

Keen.Dataset.prototype.schema = function(obj){
  if (!arguments.length) return this.meta.schema;
  this.meta.schema = (obj ? obj : null);
  return this;
};

Keen.Dataset.prototype.parse = function(raw, schema){
  var options;
  if (raw) this.input(raw);
  if (schema) this.schema(schema);

  // Reset output value
  this.output([[]]);

  if (this.meta.schema.select) {
    this.method("select");
    options = extend({
      records: "",
      select: true
    }, this.schema());
    _select.call(this, _optHash(options));
  }
  else if (this.meta.schema.unpack) {
    this.method("unpack");
    options = extend({
      records: "",
      unpack: {
        index: false,
        value: false,
        label: false
      }
    }, this.schema());
    _unpack.call(this, _optHash(options));
  }
  return this;
};


// Select
// --------------------------------------

function _select(cfg){

  var self = this,
      options = cfg || {},
      target_set = [],
      unique_keys = [];

  var root, records_target;
  if (options.records === "" || !options.records) {
    root = [self.input()];
  } else {
    records_target = options.records.split(Keen.Dataset.defaults.delimeter);
    root = parse.apply(self, [self.input()].concat(records_target))[0];
  }

  each(options.select, function(prop){
    target_set.push(prop.path.split(Keen.Dataset.defaults.delimeter));
  });

  // Retrieve keys found in asymmetrical collections
  if (target_set.length == 0) {
    each(root, function(record, interval){
      var flat = flatten(record);
      //console.log('flat', flat);
      for (var key in flat) {
        if (flat.hasOwnProperty(key) && unique_keys.indexOf(key) == -1) {
          unique_keys.push(key);
          target_set.push([key]);
        }
      }
    });
  }

  var test = [[]];

  // Append header row
  each(target_set, function(props, i){
    if (target_set.length == 1) {
      // Static header for single value
      test[0].push('label', 'value');
    } else {
      // Dynamic header for n-values
      test[0].push(props.join("."));
    }
  });

  // Append all rows
  each(root, function(record, i){
    var flat = flatten(record);
    if (target_set.length == 1) {
      // Static row for single value
      test.push([target_set.join("."), flat[target_set.join(".")]]);
    } else {
      // Dynamic row for n-values
      test.push([]);
      each(target_set, function(t, j){
        var target = t.join(".");
        test[i+1].push(flat[target]);
      });
    }
  });

  self.output(test);
  self.format(options.select);
  return self;
}


// Unpack
// --------------------------------------

function _unpack(options){
  //console.log('Unpacking', options);
  var self = this, discovered_labels = [];

  var value_set = (options.unpack.value) ? options.unpack.value.path.split(Keen.Dataset.defaults.delimeter) : false,
      label_set = (options.unpack.label) ? options.unpack.label.path.split(Keen.Dataset.defaults.delimeter) : false,
      index_set = (options.unpack.index) ? options.unpack.index.path.split(Keen.Dataset.defaults.delimeter) : false;
  //console.log(index_set, label_set, value_set);

  var value_desc = (value_set[value_set.length-1] !== "") ? value_set[value_set.length-1] : "Value",
      label_desc = (label_set[label_set.length-1] !== "") ? label_set[label_set.length-1] : "Label",
      index_desc = (index_set[index_set.length-1] !== "") ? index_set[index_set.length-1] : "Index";

  // Prepare root for parsing
  var root = (function(){
    var root;
    if (options.records == "") {
      root = [self.input()];
    } else {
      root = parse.apply(self, [self.input()].concat(options.records.split(Keen.Dataset.defaults.delimeter)));
    }
    return root[0];
  })();

  if (root instanceof Array == false) {
    root = [root];
  }

  // Find labels
  each(root, function(record, interval){
    var labels = (label_set) ? parse.apply(self, [record].concat(label_set)) : [];
    if (labels) {
      discovered_labels = labels;
    }
  });

  // Parse each record
  each(root, function(record, interval){
    //console.log('record', record);

    var plucked_value = (value_set) ? parse.apply(self, [record].concat(value_set)) : false,
        //plucked_label = (label_set) ? parse.apply(self, [record].concat(label_set)) : false,
        plucked_index = (index_set) ? parse.apply(self, [record].concat(index_set)) : false;
    //console.log(plucked_index, plucked_label, plucked_value);

    // Inject row for each index
    if (plucked_index) {
      each(plucked_index, function(){
        self.data.output.push([]);
      });
    } else {
      self.data.output.push([]);
    }

    // Build index column
    if (plucked_index) {

      // Build index/label on first interval
      if (interval == 0) {

        // Push last index property to 0,0
        self.data.output[0].push(index_desc);

        // Build subsequent series headers (1:N)
        if (discovered_labels.length > 0) {
          each(discovered_labels, function(value, i){
            self.data.output[0].push(value);
          });

        } else {
          self.data.output[0].push(value_desc);
        }
      }

      // Correct for odd root cases
      if (root.length < self.data.output.length-1) {
        if (interval == 0) {
          each(self.data.output, function(row, i){
            if (i > 0) {
              self.data.output[i].push(plucked_index[i-1]);
            }
          });
        }
      } else {
        self.data.output[interval+1].push(plucked_index[0]);
      }
    }

    // Build label column
    if (!plucked_index && discovered_labels.length > 0) {
      if (interval == 0) {
        self.data.output[0].push(label_desc);
        self.data.output[0].push(value_desc);
      }
      self.data.output[interval+1].push(discovered_labels[0]);
    }

    if (!plucked_index && discovered_labels.length == 0) {
      // [REVISIT]
      self.data.output[0].push('');
    }

    // Append values
    if (plucked_value) {
      // Correct for odd root cases
      if (root.length < self.data.output.length-1) {
        if (interval == 0) {
          each(self.data.output, function(row, i){
            if (i > 0) {
              self.data.output[i].push(plucked_value[i-1]);
            }
          });
        }
      } else {
        each(plucked_value, function(value){
          self.data.output[interval+1].push(value);
        });
      }
    } else {
      // append null across this row
      each(self.data.output[0], function(cell, i){
        var offset = (plucked_index) ? 0 : -1;
        if (i > offset) {
          self.data.output[interval+1].push(null);
        }
      })
    }

  });

  self.format(options.unpack);
  //self.sort(options.sort);
  return this;
}



// String configs to hash paths
// --------------------------------------

function _optHash(options){
  each(options.unpack, function(value, key, object){
    if (value && is(value, 'string')) {
      options.unpack[key] = { path: options.unpack[key] };
    }
  });
  return options;
}



// ♫♩♬ Holy Diver! ♬♩♫
// --------------------------------------

function parse() {
  var result = [];
  var loop = function() {
    var root = arguments[0];
    var args = Array.prototype.slice.call(arguments, 1);
    var target = args.pop();

    if (args.length === 0) {
      if (root instanceof Array) {
        args = root;
      } else if (typeof root === 'object') {
        args.push(root);
      }
    }

    each(args, function(el){

      // Grab the numbers and nulls
      if (target == "") {
        if (typeof el == "number" || el == null) {
          return result.push(el);
        }
      }

      if (el[target] || el[target] === 0 || el[target] !== void 0) {
        // Easy grab!
        if (el[target] === null) {
          return result.push(null);
        } else {
          return result.push(el[target]);
        }

      } else if (root[el]){
        if (root[el] instanceof Array) {
          // dive through each array item

          each(root[el], function(n, i) {
            var splinter = [root[el]].concat(root[el][i]).concat(args.slice(1)).concat(target);
            return loop.apply(this, splinter);
          });

        } else {
          if (root[el][target]) {
            // grab it!
            return result.push(root[el][target]);

          } else {
            // dive down a level!
            return loop.apply(this, [root[el]].concat(args.splice(1)).concat(target));

          }
        }

      } else if (typeof root === 'object' && root instanceof Array === false && !root[target]) {
        throw new Error("Target property does not exist", target);

      } else {
        // dive down a level!
        return loop.apply(this, [el].concat(args.splice(1)).concat(target));
      }

      return;

    });
    if (result.length > 0) {
      return result;
    }
  };
  return loop.apply(this, arguments);
}

// Utilities
// --------------------------------------

// Pure awesomeness by Will Rayner (penguinboy)
// https://gist.github.com/penguinboy/762197
function flatten(ob) {
  var toReturn = {};
  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if ((typeof ob[i]) == 'object' && ob[i] !== null) {
      var flatObject = flatten(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
  /*each(ob, function(value, i){
    if (typeof value == 'object' && value !== null) {
      var flatObject = flatten(ob[i]);
      each(flatObject, function(v2, i2){
        toReturn[i + '.' + i2] = v2;
      });
    } else {
      toReturn[i] = value;
    }
  });*/
}

// via: https://github.com/spocke/punymce
function is(o, t){
  o = typeof(o);
  if (!t){
    return o != 'undefined';
  }
  return o == t;
}

function each(o, cb, s){
  var n;
  if (!o){
    return 0;
  }
  s = !s ? o : s;
  if (is(o.length)){
    // Indexed arrays, needed for Safari
    for (n=0; n<o.length; n++) {
      if (cb.call(s, o[n], n, o) === false){
        return 0;
      }
    }
  } else {
    // Hashtables
    for (n in o){
      if (o.hasOwnProperty(n)) {
        if (cb.call(s, o[n], n, o) === false){
          return 0;
        }
      }
    }
  }
  return 1;
}

// Adapted to exclude null values
function extend(o, e){
  each(e, function(v, n){
    if (is(o[n], 'object') && is(v, 'object')){
      o[n] = extend(o[n], v);
    } else if (v !== null) {
      o[n] = v;
    }
  });
  return o;
}

// Silence moment.js if present
// if (window.moment) {
//   moment.suppressDeprecationWarnings = true;
// }

Keen.Dataset.prototype.appendColumn = function(str, input){
  var self = this,
      args = Array.prototype.slice.call(arguments, 2),
      label = (str !== undefined) ? str : null;

  if (typeof input === "function") {
    self.data.output[0].push(label);
    each(self.output(), function(row, i){
      var cell;
      if (i > 0) {
        cell = input.call(self, row, i);
        if (typeof cell === "undefined") {
          cell = null;
        }
        self.data.output[i].push(cell);
      }
    });
  }

  else if (!input || input instanceof Array) {
    self.data.output[0].push(label);
    each(self.output(), function(row, i){
      var cell;
      if (i > 0) {
        cell = (input && input[i-1] !== undefined) ? input[i-1] : null;
        self.data.output[i].push(cell);
      }
    });

  }

  return self;
};

Keen.Dataset.prototype.appendRow = function(str, input){
  var self = this,
      args = Array.prototype.slice.call(arguments, 2),
      label = (str !== undefined) ? str : null,
      newRow = [];

  newRow.push(label);

  if (typeof input === "function") {
    each(self.output()[0], function(label, i){
      var col, cell;
      if (i > 0) {
        col = self.selectColumn(i);
        cell = input.call(self, col, i);
        if (typeof cell === "undefined") {
          cell = null;
        }
        newRow.push(cell);
      }
    });
    self.data.output.push(newRow);
  }

  else if (!input || input instanceof Array) {
    each(self.output()[0], function(label, i){
      var cell;
      if (i > 0) {
        cell = (input && input[i-1] !== undefined) ? input[i-1] : null;
        newRow.push(cell);
      }
    });
    this.data.output.push(newRow);
  }

  return this;
};

Keen.Dataset.prototype.filterColumns = function(fn){
  var self = this, clone = new Array();
  each(self.data.output, function(row, i){
    clone.push([]);
  });
  each(self.data.output[0], function(col, i){
    var selectedColumn = self.selectColumn(i);
    if (i == 0 || fn.call(self, selectedColumn, i)) {
      each(selectedColumn, function(cell, ri){
        clone[ri].push(cell);
      });
    }
  });
  self.output(clone);
  return self;
};

Keen.Dataset.prototype.filterRows = function(fn){
  var self = this,
      clone = [];
  each(self.data.output, function(row, i){
    if (i == 0 || fn.call(self, row, i)) {
      clone.push(row);
    }
  });
  self.output(clone);
  return self;
};

Keen.Dataset.prototype.format = function(options){
  var self = this;

    if (this.method() === 'select') {

      each(self.output(), function(row, i){
        // Replace labels
        if (i == 0) {
          each(row, function(cell, j){
            if (options[j] && options[j].label) {
              self.data.output[i][j] = options[j].label;
            }
          });
        } else {
          each(row, function(cell, j){
            self.data.output[i][j] = _applyFormat(self.data.output[i][j], options[j]);
          });
        }
      });

    }

  if (this.method() === 'unpack') {

    if (options.index) {
      each(self.output(), function(row, i){
        if (i == 0) {
          if (options.index.label) {
            self.data.output[i][0] = options.index.label;
          }
        } else {
          self.data.output[i][0] = _applyFormat(self.data.output[i][0], options.index);
        }
      });
    }

    if (options.label) {
      if (options.index) {
        each(self.output(), function(row, i){
          each(row, function(cell, j){
            if (i == 0 && j > 0) {
              self.data.output[i][j] = _applyFormat(self.data.output[i][j], options.label);
            }
          });
        });
      } else {
        each(self.output(), function(row, i){
          if (i > 0) {
            self.data.output[i][0] = _applyFormat(self.data.output[i][0], options.label);
          }
        });
      }
    }

    if (options.value) {
      if (options.index) {
        // start > 0
        each(self.output(), function(row, i){
          each(row, function(cell, j){
            if (i > 0 && j > 0) {
              self.data.output[i][j] = _applyFormat(self.data.output[i][j], options.value);
            }
          });
        });
      } else {
        // start @ 0
        each(self.output(), function(row, i){
          each(row, function(cell, j){
            if (i > 0) {
              self.data.output[i][j] = _applyFormat(self.data.output[i][j], options.value);
            }
          });
        });
      }
    }

  }

  return self;
};

function _applyFormat(value, opts){
  var output = value,
      options = opts || {};

  if (options.replace) {
    each(options.replace, function(val, key){
      if (output == key || String(output) == String(key) || parseFloat(output) == parseFloat(key)) {
        output = val;
      }
    });
  }

  if (options.type && options.type == 'date') {
    if (options.format && moment && moment(value).isValid()) {
      output = moment(output).format(options.format);
    } else {
      output = new Date(output); //.toISOString();
    }
  }

  if (options.type && options.type == 'string') {
    output = String(output);
  }

  if (options.type && options.type == 'number' && !isNaN(parseFloat(output))) {
    output = parseFloat(output);
  }

  return output;
}

Keen.Dataset.prototype.average = function(arr, start, end){
  var set = arr.slice(start||0, (end ? end+1 : arr.length)),
      sum = 0,
      avg = null;

  // Add numeric values
  each(set, function(val, i){
    if (typeof val === "number" && !isNaN(parseFloat(val))) {
      sum += parseFloat(val);
    }
  });
  return sum / set.length;
};

Keen.Dataset.prototype.getColumnAverage = function(arr){
  return this.average(arr, 1);
};
Keen.Dataset.prototype.getRowAverage = function(arr){
  return this.average(arr, 1);
};

Keen.Dataset.prototype.maximum = function(arr, start, end){
  var set = arr.slice(start||0, (end ? end+1 : arr.length)),
      nums = [];

  // Pull numeric values
  each(set, function(val, i){
    if (typeof val === "number" && !isNaN(parseFloat(val))) {
      nums.push(parseFloat(val));
    }
  });
  return Math.max.apply(Math, nums);
};

Keen.Dataset.prototype.getColumnMaximum = function(arr){
  return this.maximum(arr, 1);
};
Keen.Dataset.prototype.getRowMaximum = function(arr){
  return this.maximum(arr, 1);
};

Keen.Dataset.prototype.minimum = function(arr, start, end){
  var set = arr.slice(start||0, (end ? end+1 : arr.length)),
      nums = [];

  // Pull numeric values
  each(set, function(val, i){
    if (typeof val === "number" && !isNaN(parseFloat(val))) {
      nums.push(parseFloat(val));
    }
  });
  return Math.min.apply(Math, nums);
};

Keen.Dataset.prototype.getColumnMinimum = function(arr){
  return this.minimum(arr, 1);
};
Keen.Dataset.prototype.getRowMinimum = function(arr){
  return this.minimum(arr, 1);
};

Keen.Dataset.prototype.pick = function(arr, i){
  return arr[i];
};

Keen.Dataset.prototype.getColumnLabel = function(arr){
  return this.pick(arr, 0);
};
Keen.Dataset.prototype.getRowIndex = function(arr){
  return this.pick(arr, 0);
};

Keen.Dataset.prototype.sum = function(arr, start, end){
  // Copy set with given range
  var set = arr.slice(start||0, (end ? end+1 : arr.length)),
      sum = 0;

  // Add numeric values
  each(set, function(val, i){
    if (typeof val === "number" && !isNaN(parseFloat(val))) {
      sum += parseFloat(val);
    }
  });
  return sum;
};


Keen.Dataset.prototype.getColumnSum = function(arr){
  return this.sum(arr, 1);
};
Keen.Dataset.prototype.getRowSum = function(arr){
  return this.sum(arr, 1);
};

Keen.Dataset.prototype.insertColumn = function(index, str, input){
  var self = this, label;

  label = (str !== undefined) ? str : null;

  if (typeof input === "function") {

    self.data.output[0].splice(index, 0, label);
    each(self.output(), function(row, i){
      var cell;
      if (i > 0) {
        cell = input.call(self, row, i);
        if (typeof cell === "undefined") {
          cell = null;
        }
        self.data.output[i].splice(index, 0, cell);
      }
    });

  }

  else if (!input || input instanceof Array) {

    self.data.output[0].splice(index, 0, label);
    each(self.output(), function(row, i){
      var cell;
      if (i > 0) {
        cell = (input && input[i-1] !== "undefined") ? input[i-1] : null;
        self.data.output[i].splice(index, 0, cell);
      }
    });

  }
  return self;
};

Keen.Dataset.prototype.insertRow = function(index, str, input){
  var self = this, label, newRow = [];

  label = (str !== undefined) ? str : null;
  newRow.push(label);

  if (typeof input === "function") {
    each(self.output()[0], function(label, i){
      var col, cell;
      if (i > 0) {
        col = self.selectColumn(i);
        cell = input.call(self, col, i);
        if (typeof cell === "undefined") {
          cell = null;
        }
        newRow.push(cell);
      }
    });
    self.data.output.splice(index, 0, newRow);
  }

  else if (!input || input instanceof Array) {
    each(self.output()[0], function(label, i){
      var cell;
      if (i > 0) {
        cell = (input && input[i-1] !== undefined) ? input[i-1] : null;
        newRow.push(cell);
      }
    });
    this.data.output.splice(index, 0, newRow);
  }

  return this;
};

Keen.Dataset.prototype.deleteColumn = function(q){
  var self = this,
      index = (!isNaN(parseInt(q))) ? q : this.output()[0].indexOf(q);

  if (index > -1) {
    each(self.data.output, function(row, i){
      self.data.output[i].splice(index, 1);
    });
  }
  return self;
};

Keen.Dataset.prototype.deleteRow = function(q){
  var index = (!isNaN(parseInt(q))) ? q : this.selectColumn(0).indexOf(q);

  if (index > -1) {
    this.data.output.splice(index, 1);
  }
  return this;
};

Keen.Dataset.prototype.selectColumn = function(q){
  var result = new Array(),
      index = (!isNaN(parseInt(q))) ? q : this.output()[0].indexOf(q);

  if (index > -1) {
    each(this.data.output, function(row, i){
      result.push(row[index]);
    });
  }
  return result;
};

Keen.Dataset.prototype.selectRow = function(q){
  var index = (!isNaN(parseInt(q))) ? q : this.selectColumn(0).indexOf(q);
  if (index > -1) {
    return this.data.output[index];
  }
};

Keen.Dataset.prototype.sortColumns = function(str, comp){
  var self = this,
      head = this.output()[0].slice(1), // minus index
      cols = [],
      clone = [],
      fn = comp || this.getColumnLabel;

  // Isolate each column (except the index)
  each(head, function(cell, i){
    cols.push(self.selectColumn(i+1).slice(0));
  });
  cols.sort(function(a,b){
    // If fn(a) > fn(b)
    var op = fn.call(self, a) > fn.call(self, b);
    if (op) {
      return (str === "asc" ? 1 : -1);
    } else if (!op) {
      return (str === "asc" ? -1 : 1);
    } else {
      return 0;
    }
  });
  each(cols, function(col, i){
    self
      .deleteColumn(i+1)
      .insertColumn(i+1, col[0], col.slice(1));
  });
  return self;
};

Keen.Dataset.prototype.sortRows = function(str, comp){
  var self = this,
      head = this.output().slice(0,1),
      body = this.output().slice(1),
      fn = comp || this.getRowIndex;

  body.sort(function(a, b){
    // If fn(a) > fn(b)
    var op = fn.call(self, a) > fn.call(self, b);
    if (op) {
      return (str === "asc" ? 1 : -1);
    } else if (!op) {
      return (str === "asc" ? -1 : 1);
    } else {
      return 0;
    }
  });
  self.output(head.concat(body));
  return self;
};

Keen.Dataset.prototype.updateColumn = function(q, input){
  var self = this, index;

  index = (!isNaN(parseInt(q))) ? q : this.output()[0].indexOf(q);

  if (index > -1) {

    if (typeof input === "function") {

      each(self.output(), function(row, i){
        var cell;
        if (i > 0) {
          cell = input.call(self, row[index], i, row);
          if (typeof cell !== "undefined") {
            self.data.output[i][index] = cell;
          }
        }
      });

    } else if (!input || input instanceof Array) {

      each(self.output(), function(row, i){
        var cell;
        if (i > 0) {
          cell = (input && typeof input[i-1] !== "undefined" ? input[i-1] : null);
          self.data.output[i][index] = cell;
        }
      });

    }

  }
  return self;
};

Keen.Dataset.prototype.updateRow = function(q, input){
  var self = this, index;

  index = (!isNaN(parseInt(q))) ? q : this.selectColumn(0).indexOf(q);

  if (index > -1) {

    if (typeof input === "function") {

      each(self.output()[index], function(value, i){
        var col = self.selectColumn(i),
            cell = input.call(self, value, i, col);
        if (typeof cell !== "undefined") {
          self.data.output[index][i] = cell;
        }
      });

    } else if (!input || input instanceof Array) {

      each(self.output()[index], function(c, i){
        var cell;
        if (i > 0) {
          cell = (input && input[i-1] !== undefined) ? input[i-1] : null;
          self.data.output[index][i] = cell;
        }
      });

    }

  }
  return self;
};

/*!
  * ----------------
  * Keen.Dataviz
  * ----------------
  */

/*
  TODO:

  [x] set up dataType capability-mapping
  [x] move google defaults into adapter
  [x] set default lib+chart combos for types

  [x] set up sortGroups and sortInterval
  [x] set up indexBy
  [x] write tests for sort/order methods
  [x] _runLabelMapping re-runs parse(), overwrites modifications
  [x] break dataviz into pieces, like dataset

  [x] update color palette
  [x] update keen-c3.js adapter w/ example page
  [x] update keen-chart.js adapter w/ example page

  [ ] manage a second "mapped" color set

*/

_extend(Keen.utils, {
  prettyNumber: _prettyNumber,
  loadScript: _loadScript,
  loadStyle: _loadStyle
});

// Set flag for script loading
Keen.loaded = false;

// ------------------------------
// Dataviz constructor
// ------------------------------

Keen.Dataviz = function(){
  this.dataset = new Keen.Dataset();
  this.view = {
    _prepared: false,
    _initialized: false,
    _rendered: false,
    _artifacts: { /* state bin */ },
    adapter: {
      library: undefined,
      chartType: undefined,
      defaultChartType: undefined,
      dataType: undefined
    },
    attributes: JSON.parse(JSON.stringify(Keen.Dataviz.defaults)),
    defaults: JSON.parse(JSON.stringify(Keen.Dataviz.defaults)),
    el: undefined,
    loader: { library: "keen-io", chartType: "spinner" }
  };

  Keen.Dataviz.visuals.push(this);
};

_extend(Keen.Dataviz.prototype, Events);
_extend(Keen.Dataviz, {
  dataTypeMap: {
    "singular":          { library: "keen-io", chartType: "metric"      },
    "categorical":       { library: "google",  chartType: "piechart"    },
    "cat-interval":      { library: "google",  chartType: "columnchart" },
    "cat-ordinal":       { library: "google",  chartType: "barchart"    },
    "chronological":     { library: "google",  chartType: "areachart"   },
    "cat-chronological": { library: "google",  chartType: "linechart"   }
  },
  defaults: {
    colors: [
    /* teal      red        yellow     purple     orange     mint       blue       green      lavender */
      "#00bbde", "#fe6672", "#eeb058", "#8a8ad6", "#ff855c", "#00cfbb", "#5a9eed", "#73d483", "#c879bb",
      "#0099b6", "#d74d58", "#cb9141", "#6b6bb6", "#d86945", "#00aa99", "#4281c9", "#57b566", "#ac5c9e",
      "#27cceb", "#ff818b", "#f6bf71", "#9b9be1", "#ff9b79", "#26dfcd", "#73aff4", "#87e096", "#d88bcb"
    ],
    indexBy: "timeframe.start"
  },
  dependencies: {
    loading: 0,
    loaded: 0,
    urls: {}
  },
  libraries: {},
  visuals: []
});

// ------------------------------
// Utility methods
// ------------------------------

Keen.Dataviz.register = function(name, methods, config){
  var self = this;
  var loadHandler = function(st) {
    st.loaded++;
    if(st.loaded === st.loading) {
      Keen.loaded = true;
      Keen.trigger('ready');
    }
  };
  Keen.Dataviz.libraries[name] = Keen.Dataviz.libraries[name] || {};

  // Add method to library hash
  _each(methods, function(method, key){
    Keen.Dataviz.libraries[name][key] = method;
  });

  // Set default capabilities hash
  if (config && config.capabilities) {
    Keen.Dataviz.libraries[name]._defaults = Keen.Dataviz.libraries[name]._defaults || {};
    _each(config.capabilities, function(typeSet, key){
      // store somewhere in library
      Keen.Dataviz.libraries[name]._defaults[key] = typeSet;
    });
  }

  // For all dependencies
  if (config && config.dependencies) {
    _each(config.dependencies, function (dependency, index, collection) {
      var status = Keen.Dataviz.dependencies;
      // If it doesn't exist in the current dependencies being loaded
      if(!status.urls[dependency.url]) {
        status.urls[dependency.url] = true;
        status.loading++;
        var method = dependency.type === 'script' ? _loadScript : _loadStyle;

        method(dependency.url, function() {
          if(dependency.cb) {
            dependency.cb.call(self, function() {
              loadHandler(status);
            });
          } else {
            loadHandler(status);
          }
        });
      }
    }); // End each
  }
};

Keen.Dataviz.find = function(target){
  if (!arguments.length) return Keen.Dataviz.visuals;
  var el = target.nodeName ? target : document.querySelector(target),
      match;

  _each(Keen.Dataviz.visuals, function(visual){
    if (el == visual.el()){
      match = visual;
      return false;
    }
  });
  if (match) return match;
  //Keen.log("Visualization not found");
};

/*!
* ----------------------
* Keen IO Plugin
* Data Visualization
* ----------------------
*/

(function(lib){
  var Keen = lib || {};

  // chartOptions:
  // -------------
  // axis: {}
  // color: {}    <-- be aware: we set values here
  // grid: {}
  // legend: {}
  // point: {}
  // regions: {}
  // size: {}     <-- be aware: we set values here
  // tooltip: {}
  // zoom: {}

  // line, pie, donut etc...

  var dataTypes = {
    // dataType            : // chartTypes
    "singular"             : ["gauge"],
    "categorical"          : ["donut", "pie"],
    "cat-interval"         : ["area-step", "step", "bar", "area", "area-spline", "spline", "line"],
    "cat-ordinal"          : ["bar", "area", "area-spline", "spline", "line", "step", "area-step"],
    "chronological"        : ["area", "area-spline", "spline", "line", "bar", "step", "area-step"],
    "cat-chronological"    : ["line", "spline", "area", "area-spline", "bar", "step", "area-step"]
    // "nominal"           : [],
    // "extraction"        : []
  };

  var charts = {};
  Keen.utils.each(["gauge", "donut", "pie", "bar", "area", "area-spline", "spline", "line", "step", "area-step"], function(type, index){
    charts[type] = {
      render: function(){
        var setup = getSetupTemplate.call(this, type);
        this.view._artifacts["c3"] = c3.generate(setup);
        this.update();
      },
      update: function(){
        var self = this, cols = [];
        if (type === "gauge") {
          self.view._artifacts["c3"].load({
            columns: [ [self.title(), self.data()[1][1]] ]
          })
        }
        else if (type === "pie" || type === "donut") {
          self.view._artifacts["c3"].load({
            columns: self.dataset.data.output.slice(1)
          });
        }
        else {
          if (this.dataType().indexOf("chron") > -1) {
            cols.push(self.dataset.selectColumn(0));
            cols[0][0] = 'x';
          }
          Keen.utils.each(self.data()[0], function(c, i){
            if (i > 0) {
              cols.push(self.dataset.selectColumn(i));
            }
          });
          // if self.chartOptions().isStacked ?
          self.view._artifacts["c3"].groups([self.data()[0].slice(1)]);
          self.view._artifacts["c3"].load({
            columns: cols
          });
        }
      },
      destroy: function(){
        _selfDestruct.call(this);
      }
    };
  });

  function getSetupTemplate(type){
    var setup = {
      bindto: this.el(),
      data: {
        columns: []
      },
      color: {
        pattern: this.colors()
      },
      size: {
        height: this.height(),
        width: this.width()
      }
    };

    // Enforce type, sorry no overrides here
    setup["data"]["type"] = type;

    if (type === "gauge") {}
    else if (type === "pie" || type === "donut") {
      setup[type] = { title: this.title() };
    }
    else {
      if (this.dataType().indexOf("chron") > -1) {
        setup["data"]["x"] = "x";
        setup["axis"] = {
          x: {
            type: 'timeseries',
            tick: {
              format: '%Y-%m-%d'
            }
          }
        };
      }
    }
    return Keen.utils.extend(setup, this.chartOptions());
  }

  function _selfDestruct(){
    if (this.view._artifacts["c3"]) {
      this.view._artifacts["c3"].destroy();
      this.view._artifacts["c3"] = null;
    }
  }

  // Register library + add dependencies + types
  // -------------------------------
  Keen.Dataviz.register('c3', charts, { capabilities: dataTypes });

})(Keen);

/*!
* ----------------------
* Keen IO Plugin
* Data Visualization
* ----------------------
*/

(function(lib){
  var Keen = lib || {};

  if (typeof Chart !== "undefined") {
    Chart.defaults.global.responsive = true;
  }

  var dataTypes = {
    // dataType            : // chartTypes
    //"singular"             : [],
    "categorical"          : ["doughnut", "pie", "polar-area", "radar"],
    "cat-interval"         : ["bar", "line"],
    "cat-ordinal"          : ["bar", "line"],
    "chronological"        : ["line", "bar"],
    "cat-chronological"    : ["line", "bar"]
    // "nominal"           : [],
    // "extraction"        : []
  };

  var ChartNameMap = {
    "radar": "Radar",
    "polar-area": "PolarArea",
    "pie": "Pie",
    "doughnut": "Doughnut",
    "line": "Line",
    "bar": "Bar"
  };
  var dataTransformers = {
    'doughnut': getCategoricalData,
    'pie': getCategoricalData,
    'polar-area': getCategoricalData,
    'radar': getSeriesData,
    'line': getSeriesData,
    'bar': getSeriesData
  };

  function getCategoricalData(){
    var self = this, result = [];
    Keen.utils.each(self.dataset.selectColumn(0).slice(1), function(label, i){
      result.push({
        value: self.dataset.selectColumn(1).slice(1)[i],
        color: self.colors()[+i],
        hightlight: self.colors()[+i+9],
        label: label
      });
    });
    return result;
  }

  function getSeriesData(){
    var self = this,
        labels,
        result = {
          labels: [],
          datasets: []
        };

    labels = this.dataset.selectColumn(0).slice(1);
    Keen.utils.each(labels, function(l,i){
      if (l instanceof Date) {
        result.labels.push((l.getMonth()+1) + "-" + l.getDate() + "-" + l.getFullYear());
      } else {
        result.labels.push(l);
      }
    })

    Keen.utils.each(self.dataset.selectRow(0).slice(1), function(label, i){
      var hex = {
        r: hexToR(self.colors()[i]),
        g: hexToG(self.colors()[i]),
        b: hexToB(self.colors()[i])
      };
      result.datasets.push({
        label: label,
        fillColor    : "rgba(" + hex.r + "," + hex.g + "," + hex.b + ",0.2)",
        strokeColor  : "rgba(" + hex.r + "," + hex.g + "," + hex.b + ",1)",
        pointColor   : "rgba(" + hex.r + "," + hex.g + "," + hex.b + ",1)",
        pointStrokeColor: "#fff",
        pointHighlightFill: "#fff",
        pointHighlightStroke: "rgba(" + hex.r + "," + hex.g + "," + hex.b + ",1)",
        data: self.dataset.selectColumn(+i+1).slice(1)
      });
    });
    return result;
  }

  var charts = {};
  Keen.utils.each(["doughnut", "pie", "polar-area", "radar", "bar", "line"], function(type, index){
    charts[type] = {
      initialize: function(){
        if (this.el().nodeName.toLowerCase() !== "canvas") {
          var canvas = document.createElement('canvas');
          this.el().innerHTML = "";
          this.el().appendChild(canvas);
          this.view._artifacts["ctx"] = canvas.getContext("2d");
        } else {
          this.view._artifacts["ctx"] = this.el().getContext("2d");
        }
        return this;
      },
      render: function(){
        var method = ChartNameMap[type],
            opts = _extend({}, this.chartOptions()),
            data = dataTransformers[type].call(this);

        if (this.view._artifacts["chartjs"]) {
          this.view._artifacts["chartjs"].destroy();
        }
        this.view._artifacts["chartjs"] = new Chart(this.view._artifacts["ctx"])[method](data, opts);
        return this;
      },
      destroy: function(){
        _selfDestruct.call(this);
      }
    };
  });

  function _selfDestruct(){
    if (this.view._artifacts["chartjs"]) {
      this.view._artifacts["chartjs"].destroy();
      this.view._artifacts["chartjs"] = null;
    }
  }


  // Based on this awesome little demo:
  // http://www.javascripter.net/faq/hextorgb.htm
  function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
  function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
  function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
  function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}

  // Register library + add dependencies + types
  // -------------------------------
  Keen.Dataviz.register("chartjs", charts, { capabilities: dataTypes });

})(Keen);

/*!
* ----------------------
* Keen IO Plugin
* Data Visualization
* ----------------------
*/

/*

  TODO:

  [ ] Build a more robust DataTable transformer
  [ ] ^Expose date parser for google charts tooltips (#70)
  [ ] ^Allow custom tooltips (#147)

*/

(function(lib){
  var Keen = lib || {};

  var errors = {
    "google-visualization-errors-0": "No results to visualize"
  };

  var chartTypes = ['AreaChart', 'BarChart', 'ColumnChart', 'LineChart', 'PieChart', 'Table'];
  var chartMap = {};

  var dataTypes = {
    // dataType           // chartTypes (namespace)
    // 'singular':        null,
    'categorical':        ['piechart', 'barchart', 'columnchart', 'table'],
    'cat-interval':       ['columnchart', 'barchart', 'table'],
    'cat-ordinal':        ['barchart', 'columnchart', 'areachart', 'linechart', 'table'],
    'chronological':      ['areachart', 'linechart', 'table'],
    'cat-chronological':  ['linechart', 'columnchart', 'barchart', 'areachart'],
    'nominal':            ['table'],
    'extraction':         ['table']
  };

  // Create chart types
  // -------------------------------
  Keen.utils.each(chartTypes, function (type) {
    var name = type.toLowerCase();
    chartMap[name] = {
      initialize: function(){
        // Nothing to do here
      },
      render: function(){
        if(typeof google === "undefined") {
          this.error("The Google Charts library could not be loaded.");
          return;
        }
        var self = this;
        if (self.view._artifacts['googlechart']) {
          this.destroy();
        }
        self.view._artifacts['googlechart'] = self.view._artifacts['googlechart'] || new google.visualization[type](self.el());
        google.visualization.events.addListener(self.view._artifacts['googlechart'], 'error', function(stack){
          _handleErrors.call(self, stack);
        });
        this.update();
      },
      update: function(){
        var options = _getDefaultAttributes.call(this, type);
        Keen.utils.extend(options, this.chartOptions(), this.attributes());
        this.view._artifacts['datatable'] = google.visualization.arrayToDataTable(this.data());
        // if (this.view._artifacts['datatable']) {}
        if (this.view._artifacts['googlechart']) {
          this.view._artifacts['googlechart'].draw(this.view._artifacts['datatable'], options);
        }
      },
      destroy: function(){
        if (this.view._artifacts['googlechart']) {
          google.visualization.events.removeAllListeners(this.view._artifacts['googlechart']);
          this.view._artifacts['googlechart'].clearChart();
          this.view._artifacts['googlechart'] = null;
          this.view._artifacts['datatable'] = null;
        }
      }
    };
  });


  // Register library + types
  // -------------------------------

  Keen.Dataviz.register('google', chartMap, {
    capabilities: dataTypes,
    dependencies: [{
      type: 'script',
      url: 'https://www.google.com/jsapi',
      cb: function(done) {
        if (typeof google === 'undefined'){
          Keen.log("Problem loading Google Charts library. Please contact us!");
          done();
        } else {
          google.load('visualization', '1.1', {
              packages: ['corechart', 'table'],
              callback: function(){
                done();
              }
          });
        }
      }
    }]
  });

  function _handleErrors(stack){
    var message = errors[stack['id']] || stack['message'] || "An error occurred";
    this.error(message);
  }

  function _getDefaultAttributes(type){
    var output = {};
    switch (type.toLowerCase()) {

      case "areachart":
        output.lineWidth = 2;
        output.hAxis = {
          baselineColor: 'transparent',
          gridlines: { color: 'transparent' }
        };
        output.vAxis = {
          viewWindow: { min: 0 }
        };
        if (this.dataType() === "chronological") {
          output.legend = {
            position: "none"
          };
          output.chartArea = {
            width: "85%"
          };
        }
        break;

      case "barchart":
        output.hAxis = {
          viewWindow: { min: 0 }
        };
        output.vAxis = {
          baselineColor: 'transparent',
          gridlines: { color: 'transparent' }
        };
        if (this.dataType() === "chronological") {
          output.legend = {
            position: "none"
          };
        }
        break;

      case "columnchart":
        output.hAxis = {
          baselineColor: 'transparent',
          gridlines: { color: 'transparent' }
        };
        output.vAxis = {
          viewWindow: { min: 0 }
        };
        if (this.dataType() === "chronological") {
          output.legend = {
            position: "none"
          };
          output.chartArea = {
            width: "85%"
          };
        }
        break;

      case "linechart":
        output.lineWidth = 2;
        output.hAxis = {
          baselineColor: 'transparent',
          gridlines: { color: 'transparent' }
        };
        output.vAxis = {
          viewWindow: { min: 0 }
        };
        if (this.dataType() === "chronological") {
          output.legend = {
            position: "none"
          };
          output.chartArea = {
            width: "85%"
          };
        }
        break;

      case "piechart":
        output.sliceVisibilityThreshold = 0.01;
        break;

      case "table":
        break;
    }
    return output;
  }

})(Keen);

/*!
  * ----------------------
  * Keen IO Plugin
  * Data Visualization
  * ----------------------
  */

  (function(lib){
    var Keen = lib || {},
        Metric, Error, Spinner;

    Keen.Error = {
      defaults: {
        backgroundColor : "",
        borderRadius    : "4px",
        color           : "#ccc",
        display         : "block",
        fontFamily      : "Helvetica Neue, Helvetica, Arial, sans-serif",
        fontSize        : "21px",
        fontWeight      : "light",
        textAlign       : "center"
      }
    };

    Keen.Spinner.defaults = {
      lines: 10,                    // The number of lines to draw
      length: 8,                    // The length of each line
      width: 3,                     // The line thickness
      radius: 10,                   // The radius of the inner circle
      corners: 1,                   // Corner roundness (0..1)
      rotate: 0,                    // The rotation offset
      direction: 1,                 // 1: clockwise, -1: counterclockwise
      color: '#4d4d4d',             // #rgb or #rrggbb or array of colors
      speed: 1.67,                  // Rounds per second
      trail: 60,                    // Afterglow percentage
      shadow: false,                // Whether to render a shadow
      hwaccel: false,               // Whether to use hardware acceleration
      className: 'keen-spinner',    // The CSS class to assign to the spinner
      zIndex: 2e9,                  // The z-index (defaults to 2000000000)
      top: '50%',                   // Top position relative to parent
      left: '50%'                   // Left position relative to parent
    };


    var dataTypes = {
      'singular': ['metric']
    };

    Metric = {
      initialize: function(){
        var css = document.createElement("style"),
            bgDefault = "#49c5b1";

        css.id = "keen-widgets";
        css.type = "text/css";
        css.innerHTML = "\
    .keen-metric { \n  background: " + bgDefault + "; \n  border-radius: 4px; \n  color: #fff; \n  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; \n  padding: 10px 0; \n  text-align: center; \n} \
    .keen-metric-value { \n  display: block; \n  font-size: 84px; \n  font-weight: 700; \n  line-height: 84px; \n} \
    .keen-metric-title { \n  display: block; \n  font-size: 24px; \n  font-weight: 200; \n}";
        if (!document.getElementById(css.id)) {
          document.body.appendChild(css);
        }
      },

      render: function(){
        var bgColor = (this.colors().length == 1) ? this.colors()[0] : "#49c5b1",
            prefix = "",
            suffix = "",
            title = this.title() || "Result",
            value = this.data()[1][1] || 0,
            width = this.width(),
            opts = this.chartOptions() || {};

        if (typeof opts.prettyNumber === 'undefined' || opts.prettyNumber == true) {
          value = Keen.utils.prettyNumber(value);
        }

        if (opts['prefix']) {
          prefix = '<span class="keen-metric-prefix">' + opts['prefix'] + '</span>';
        }
        if (opts['suffix']) {
          suffix = '<span class="keen-metric-suffix">' + opts['suffix'] + '</span>';
        }

        this.el().innerHTML = '' +
          '<div class="keen-widget keen-metric" style="background-color: ' + bgColor + '; width:' + width + 'px;">' +
            '<span class="keen-metric-value">' + prefix + value + suffix + '</span>' +
            '<span class="keen-metric-title">' + title + '</span>' +
          '</div>';
      }
    };

    Error = {
      initialize: function(){},
      render: function(text, style){
        var err, msg;

        var defaultStyle = JSON.parse(JSON.stringify(Keen.Error.defaults));
        var currentStyle = _extend(defaultStyle, style);

        err = document.createElement("div");
        err.className = "keen-error";
        _each(currentStyle, function(value, key){
          err.style[key] = value;
        });
        err.style.height = String(this.height() + "px");
        err.style.paddingTop = (this.height() / 2 - 15) + "px";
        err.style.width = String(this.width() + "px");

        msg = document.createElement("span");
        msg.innerHTML = text || "Yikes! An error occurred!";

        err.appendChild(msg);

        this.el().innerHTML = "";
        this.el().appendChild(err);
      },
      destroy: function(){
        this.el().innerHTML = "";
      }
    };

    Spinner = {
      initialize: function(){},
      render: function(){
        var spinner = document.createElement("div");
        spinner.className = "keen-loading";
        spinner.style.height = String(this.height() + "px");
        spinner.style.position = "relative";
        spinner.style.width = String(this.width() + "px");

        this.el().innerHTML = "";
        this.el().appendChild(spinner);
        this.view._artifacts.spinner = new Keen.Spinner(Keen.Spinner.defaults).spin(spinner);
      },
      destroy: function(){
        this.view._artifacts.spinner.stop();
        this.view._artifacts.spinner = null;
      }
    };

    Keen.Dataviz.register('keen-io', {
      'metric': Metric,
      'error': Error,
      'spinner': Spinner
    }, {
      capabilities: dataTypes
    });

  })(Keen);

Keen.Dataviz.prototype.destroy = function(){
  var actions = _getAdapterActions.call(this);
  if (actions.destroy) actions.destroy.apply(this, arguments);
  // clear rendered artifats, state bin
  if (this.el()) this.el().innerHTML = "";
  this.view._prepared = false;
  this.view._initialized = false;
  this.view._rendered = false;
  this.view._artifacts = {};
  return this;
};

Keen.Dataviz.prototype.error = function(){
  var actions = _getAdapterActions.call(this);
  if (actions['error']) {
    actions['error'].apply(this, arguments);
  } else {
    Keen.Dataviz.libraries['keen-io']['error'].render.apply(this, arguments);
  }
  return this;
};

Keen.Dataviz.prototype.initialize = function(){
  var actions = _getAdapterActions.call(this);
  var loader = Keen.Dataviz.libraries[this.view.loader.library][this.view.loader.chartType];
  if (this.view._prepared) {
    if (loader.destroy) loader.destroy.apply(this, arguments);
  } else {
    if (this.el()) this.el().innerHTML = "";
  }
  if (actions.initialize) actions.initialize.apply(this, arguments);
  this.view._initialized = true;
  return this;
};

Keen.Dataviz.prototype.render = function(){
  var actions = _getAdapterActions.call(this);
  _applyPostProcessing.call(this);
  if (!this.view._initialized) {
    this.initialize();
  }
  if (this.el() && actions.render) {
    actions.render.apply(this, arguments);
    this.view._rendered = true;
  }
  return this;
};

Keen.Dataviz.prototype.update = function(){
  var actions = _getAdapterActions.call(this);
  _applyPostProcessing.call(this);
  if (actions.update) {
    actions.update.apply(this, arguments);
  } else if (actions.render) {
    this.render();
  }
  return this;
};

function _applyPostProcessing(){
  this
    .call(_runLabelMapping)
    .call(_runLabelReplacement)
    .call(_runSortGroups)
    .call(_runSortIntervals)
    .call(_runColorMapping);
}

function _getAdapterActions(){
  var map = _extend({}, Keen.Dataviz.dataTypeMap),
      dataType = this.dataType(),
      library = this.library(),
      chartType = this.chartType() || this.defaultChartType();

  // Use the default library as a backup
  if (!library && map[dataType]) {
    library = map[dataType].library;
  }

  // Use this library's default chartType for this dataType
  if (library && !chartType && dataType) {
    chartType = Keen.Dataviz.libraries[library]._defaults[dataType][0];
  }

  // Still no luck?
  if (library && !chartType && map[dataType]) {
    chartType = map[dataType].chartType;
  }

  // Return if found
  return (library && chartType) ? Keen.Dataviz.libraries[library][chartType] : {};
}

Keen.Dataviz.prototype.adapter = function(obj){
  if (!arguments.length) return this.view.adapter;
  var self = this;
  _each(obj, function(prop, key){
    self.view.adapter[key] = (prop ? prop : null);
  });
  return this;
};

Keen.Dataviz.prototype.attributes = function(obj){
  if (!arguments.length) return this.view.attributes;
  var self = this;
  _each(obj, function(prop, key){
    if (key === "chartOptions") {
      self.chartOptions(prop);
    } else {
      self.view.attributes[key] = (prop ? prop : null);
    }
  });
  return this;
};

Keen.Dataviz.prototype.call = function(fn){
  fn.call(this);
  return this;
};

Keen.Dataviz.prototype.chartOptions = function(obj){
  if (!arguments.length) return this.view.adapter.chartOptions;
  var self = this;
  self.view.adapter.chartOptions = self.view.adapter.chartOptions || {};
  _each(obj, function(prop, key){
    self.view.adapter.chartOptions[key] = (prop ? prop : null);
  });
  return this;
};

Keen.Dataviz.prototype.chartType = function(str){
  if (!arguments.length) return this.view.adapter.chartType;
  this.view.adapter.chartType = (str ? String(str) : null);
  return this;
};

Keen.Dataviz.prototype.colorMapping = function(obj){
  if (!arguments.length) return this.view.attributes.colorMapping;
  this.view.attributes.colorMapping = (obj ? obj : null);
  _runColorMapping.call(this);
  return this;
};

function _runColorMapping(){
  var self = this,
      schema = this.dataset.schema,
      data = this.dataset.output(),
      colorSet = this.view.defaults.colors.slice(),
      colorMap = this.colorMapping(),
      dt = this.dataType() || "";

  if (colorMap) {
    if (dt.indexOf("chronological") > -1 || (schema.unpack && data[0].length > 2)) {
      _each(data[0].slice(1), function(label, i){
        var color = colorMap[label];
        if (color && colorSet[i] !== color) {
          colorSet.splice(i, 0, color);
        }
      });
    }
    else {
      _each(self.dataset.selectColumn(0).slice(1), function(label, i){
        var color = colorMap[label];
        if (color && colorSet[i] !== color) {
          colorSet.splice(i, 0, color);
        }
      });
    }
    self.view.attributes.colors = colorSet;
  }
}

Keen.Dataviz.prototype.colors = function(arr){
  if (!arguments.length) return this.view.attributes.colors;
  this.view.attributes.colors = (arr instanceof Array ? arr : null);
  this.view.defaults.colors = (arr instanceof Array ? arr : null);
  return this;
};

Keen.Dataviz.prototype.data = function(data){
  if (!arguments.length) return this.dataset.output();
  if (data instanceof Keen.Dataset) {
    this.dataset = data;
  } else if (data instanceof Keen.Request) {
    this.parseRequest(data);
  } else {
    this.parseRawData(data);
  }
  return this;
};

Keen.Dataviz.prototype.dataType = function(str){
  if (!arguments.length) return this.view.adapter.dataType;
  this.view.adapter.dataType = (str ? String(str) : null);
  return this;
};

Keen.Dataviz.prototype.defaultChartType = function(str){
  if (!arguments.length) return this.view.adapter.defaultChartType;
  this.view.adapter.defaultChartType = (str ? String(str) : null);
  return this;
};

Keen.Dataviz.prototype.el = function(el){
  if (!arguments.length) return this.view.el;
  this.view.el = el;
  return this;
};

Keen.Dataviz.prototype.height = function(num){
  if (!arguments.length) return this.view.attributes['height'];
  this.view.attributes['height'] = (!isNaN(parseInt(num)) ? parseInt(num) : null);
  return this;
};

Keen.Dataviz.prototype.indexBy = function(str){
  if (!arguments.length) return this.view.attributes.indexBy;
  this.view.attributes.indexBy = (str ? String(str) : Keen.Dataviz.defaults.indexBy);
  _runIndexBy.call(this);
  return this;
};

function _runIndexBy(){
  var self = this,
      root = this.dataset.meta.schema || this.dataset.meta.unpack,
      newOrder = this.indexBy().split(".").join(Keen.Dataset.defaults.delimeter);
  // Replace in schema and re-run dataset.parse()
  each(root, function(def, i){
    // update 'select' configs
    if (i === "select" && def instanceof Array) {
      each(def, function(c, j){
        if (c.path.indexOf("timeframe -> ") > -1) {
          self.dataset.meta.schema[i][j].path = newOrder;
        }
      });
    }
    // update 'unpack' configs
    else if (i === "unpack" && typeof def === "object") {
      self.dataset.meta.schema[i]['index'].path = newOrder;
    }
  });
  this.dataset.parse();
}

Keen.Dataviz.prototype.labelMapping = function(obj){
  if (!arguments.length) return this.view.attributes.labelMapping;
  this.view.attributes.labelMapping = (obj ? obj : null);
  _runLabelMapping.call(this);
  return this;
};

function _runLabelMapping(){
  var self = this,
      labelMap = this.labelMapping(),
      schema = this.dataset.schema() || {},
      dt = this.dataType() || "";

  if (labelMap) {
    if (dt.indexOf("chronological") > -1 || (schema.unpack && self.dataset.output()[0].length > 2)) {
      // loop over header cells
      each(self.dataset.output()[0], function(c, i){
        if (i > 0) {
          self.dataset.data.output[0][i] = labelMap[c] || c;
        }
      });
    }
    else if (schema.select && self.dataset.output()[0].length === 2) {
      // update column 0
      self.dataset.updateColumn(0, function(c, i){
        return labelMap[c[0]] || c[0];
      });
    }
  }
}

Keen.Dataviz.prototype.labels = function(arr){
  if (!arguments.length) return this.view.attributes.labels;
  this.view.attributes.labels = (arr instanceof Array ? arr : null);
  _runLabelReplacement.call(this);
  return this;
};

function _runLabelReplacement(){
  var self = this,
      labelSet = this.labels() || null,
      schema = this.dataset.schema() || {},
      data = this.dataset.output(),
      dt = this.dataType() || "";

  if (labelSet) {
    if (dt.indexOf("chronological") > -1 || (schema.unpack && data[0].length > 2)) {
      _each(data[0], function(cell,i){
        if (i > 0 && labelSet[i-1]) {
          self.dataset.data.output[0][i] = labelSet[i-1];
        }
      });
    } else {
      _each(data, function(row,i){
        if (i > 0 && labelSet[i-1]) {
          self.dataset.data.output[i][0] = labelSet[i-1];
        }
      });
    }
  }
}

Keen.Dataviz.prototype.library = function(str){
  if (!arguments.length) return this.view.adapter.library;
  this.view.adapter.library = (str ? String(str) : null);
  return this;
};

Keen.Dataviz.prototype.parseRawData = function(raw){
  this.dataset = _parseRawData.call(this, raw);
  return this;
};

function _parseRawData(response){
  var self = this,
      schema = {},
      indexBy,
      delimeter,
      indexTarget,
      labelSet,
      labelMap,
      dataType,
      dataset;

  indexBy = self.indexBy() ? self.indexBy() : Keen.Dataviz.defaults.indexBy;
  delimeter = Keen.Dataset.defaults.delimeter;
  indexTarget = indexBy.split(".").join(delimeter);

  labelSet = self.labels() || null;
  labelMap = self.labelMapping() || null;

  // Metric
  // -------------------------------
  if (typeof response.result == "number"){
    //return new Keen.Dataset(response, {
    dataType = "singular";
    schema = {
      records: "",
      select: [{
        path: "result",
        type: "string",
        label: "Metric"
      }]
    }
  }

  // Everything else
  // -------------------------------
  if (response.result instanceof Array && response.result.length > 0){

    // Interval w/ single value
    // -------------------------------
    if (response.result[0].timeframe && (typeof response.result[0].value == "number" || response.result[0].value == null)) {
      dataType = "chronological";
      schema = {
        records: "result",
        select: [
          {
            path: indexTarget,
            type: "date"
          },
          {
            path: "value",
            type: "number"
            // format: "10"
          }
        ]
      }
    }

    // Static GroupBy
    // -------------------------------
    if (typeof response.result[0].result == "number"){
      dataType = "categorical";
      schema = {
        records: "result",
        select: []
      };
      for (var key in response.result[0]){
        if (response.result[0].hasOwnProperty(key) && key !== "result"){
          schema.select.push({
            path: key,
            type: "string"
          });
          break;
        }
      }
      schema.select.push({
        path: "result",
        type: "number"
      });
    }

    // Grouped Interval
    // -------------------------------
    if (response.result[0].value instanceof Array){
      dataType = "cat-chronological";
      schema = {
        records: "result",
        unpack: {
          index: {
            path: indexTarget,
            type: "date"
          },
          value: {
            path: "value -> result",
            type: "number"
          }
        }
      }
      for (var key in response.result[0].value[0]){
        if (response.result[0].value[0].hasOwnProperty(key) && key !== "result"){
          schema.unpack.label = {
            path: "value -> " + key,
            type: "string"
          }
          break;
        }
      }
    }

    // Funnel
    // -------------------------------
    if (typeof response.result[0] == "number"){
      dataType = "cat-ordinal";
      schema = {
        records: "",
        unpack: {
          index: {
            path: "steps -> event_collection",
            type: "string"
          },
          value: {
            path: "result -> ",
            type: "number"
          }
        }
      }
    }

  }

  dataset = new Keen.Dataset(response, schema);

  // Post-process label mapping/replacement
  _runLabelMapping.call(self);
  _runLabelReplacement.call(self);
  self.dataType(dataType);

  return dataset;
}

Keen.Dataviz.prototype.parseRequest = function(req){
  this.dataset = _parseRequest.call(this, req);
  // Update the default title every time
  this.view.defaults.title = _getDefaultTitle.call(this, req);
  // Update the active title if not set
  if (!this.title()) this.title(this.view.defaults.title);
  return this;
};

function _parseRequest(req){
  var dataset;
  /*
    TODO: Handle multiple queries
  */
  // First-pass at dataType detection
  this.dataType(_getQueryDataType.call(this, req.queries[0]));
  if (this.dataType() !== "extraction") {
    // Run data thru raw parser
    dataset = _parseRawData.call(this, (req.data instanceof Array ? req.data[0] : req.data));
  } else {
    // Requires manual parser
    dataset = _parseExtraction.call(this, req);
  }
  return dataset;
}

function _parseExtraction(req){
  var names = req.queries[0].get('property_names'),
      schema = { records: "result", select: true };

  if (names) {
    schema.select = [];
    _each(names, function(p){
      schema.select.push({
        path: p
      })
    });
  }
  return new Keen.Dataset(req.data[0], schema);
}

// function _parse2xGroupBy(req){}

// function _parseQueryData(query){}

function _getDefaultTitle(req){
  var analysis = req.queries[0].analysis.replace("_", " "),
      collection = req.queries[0].get('event_collection'),
      output;
  output = analysis.replace( /\b./g, function(a){
    return a.toUpperCase();
  });
  if (collection) { output += ' - ' + collection; }
  return output;
}

function _getQueryDataType(query){
  var isInterval = typeof query.params.interval === "string",
      isGroupBy = typeof query.params.group_by === "string",
      is2xGroupBy = query.params.group_by instanceof Array,
      dataType;

  // metric
  if (!isGroupBy && !isInterval) {
    dataType = 'singular';
  }

  // group_by, no interval
  if (isGroupBy && !isInterval) {
    dataType = 'categorical';
  }

  // interval, no group_by
  if (isInterval && !isGroupBy) {
    dataType = 'chronological';
  }

  // interval, group_by
  if (isInterval && isGroupBy) {
    dataType = 'cat-chronological';
  }

  // 2x group_by
  // TODO: research possible dataType options
  if (!isInterval && is2xGroupBy) {
    dataType = 'categorical';
  }

  // interval, 2x group_by
  // TODO: research possible dataType options
  if (isInterval && is2xGroupBy) {
    dataType = 'cat-chronological';
  }

  if (query.analysis === "funnel") {
    dataType = 'cat-ordinal';
  }

  if (query.analysis === "extraction") {
    dataType = 'extraction';
  }
  if (query.analysis === "select_unique") {
    dataType = 'nominal';
  }

  return dataType;
}

Keen.Dataviz.prototype.prepare = function(){
  var loader;
  if (this.view._rendered) {
    this.destroy();
  }
  if (this.el()) {
    this.el().innerHTML = "";
    loader = Keen.Dataviz.libraries[this.view.loader.library][this.view.loader.chartType];
    if (loader.initialize) {
      loader.initialize.apply(this, arguments);
    }
    if (loader.render) {
      loader.render.apply(this, arguments);
    }
    this.view._prepared = true;
  }
  return this;
};

Keen.Dataviz.prototype.sortGroups = function(str){
  if (!arguments.length) return this.view.attributes.sortGroups;
  this.view.attributes.sortGroups = (str ? String(str) : null);
  _runSortGroups.call(this);
  return this;
};

function _runSortGroups(){
  var dt = this.dataType();
  if (!this.sortGroups()) return;
  if ((dt && dt.indexOf("chronological") > -1) || this.data()[0].length > 2) {
    // Sort columns by Sum (n values)
    this.dataset.sortColumns(this.sortGroups(), this.dataset.getColumnSum);
  }
  else if (dt && (dt.indexOf("cat-") > -1 || dt.indexOf("categorical") > -1)) {
    // Sort rows by Sum (1 value)
    this.dataset.sortRows(this.sortGroups(), this.dataset.getRowSum);
  }
  return;
}

Keen.Dataviz.prototype.sortIntervals = function(str){
  if (!arguments.length) return this.view.attributes.sortIntervals;
  this.view.attributes.sortIntervals = (str ? String(str) : null);
  _runSortIntervals.call(this);
  return this;
};

function _runSortIntervals(){
  if (!this.sortIntervals()) return;
  // Sort rows by index
  this.dataset.sortRows(this.sortIntervals());
  return;
}

Keen.Dataviz.prototype.title = function(str){
  if (!arguments.length) return this.view.attributes.title;
  this.view.attributes['title'] = (str ? String(str) : null);
  return this;
};

Keen.Dataviz.prototype.width = function(num){
  if (!arguments.length) return this.view.attributes['width'];
  this.view.attributes['width'] = (!isNaN(parseInt(num)) ? parseInt(num) : null);
  return this;
};

function _loadScript(url, cb) {
  var doc = document;
  var handler;
  var head = doc.head || doc.getElementsByTagName("head");

  // loading code borrowed directly from LABjs itself
  setTimeout(function () {
    // check if ref is still a live node list
    if ('item' in head) {
      // append_to node not yet ready
      if (!head[0]) {
        setTimeout(arguments.callee, 25);
        return;
      }
      // reassign from live node list ref to pure node ref -- avoids nasty IE bug where changes to DOM invalidate live node lists
      head = head[0];
    }
    var script = doc.createElement("script"),
    scriptdone = false;
    script.onload = script.onreadystatechange = function () {
      if ((script.readyState && script.readyState !== "complete" && script.readyState !== "loaded") || scriptdone) {
        return false;
      }
      script.onload = script.onreadystatechange = null;
      scriptdone = true;
      cb();
    };
    script.src = url;
    head.insertBefore(script, head.firstChild);
  }, 0);

  // required: shim for FF <= 3.5 not having document.readyState
  if (doc.readyState === null && doc.addEventListener) {
    doc.readyState = "loading";
    doc.addEventListener("DOMContentLoaded", handler = function () {
      doc.removeEventListener("DOMContentLoaded", handler, false);
      doc.readyState = "complete";
    }, false);
  }
}

function _loadStyle(url, cb) {
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.type = 'text/css';
  link.href = url;
  cb();
  document.head.appendChild(link);
}

function _prettyNumber(_input) {
  // If it has 3 or fewer sig figs already, just return the number.
  var input = Number(_input),
      sciNo = input.toPrecision(3),
      prefix = "",
      suffixes = ["", "k", "M", "B", "T"];

  if (Number(sciNo) == input && String(input).length <= 4) {
    return String(input);
  }

  if(input >= 1 || input <= -1) {
    if(input < 0){
      //Pull off the negative side and stash that.
      input = -input;
      prefix = "-";
    }
    return prefix + recurse(input, 0);
  } else {
    return input.toPrecision(3);
  }

  function recurse(input, iteration) {
    var input = String(input);
    var split = input.split(".");
    // If there's a dot
    if(split.length > 1) {
      // Keep the left hand side only
      input = split[0];
      var rhs = split[1];
      // If the left-hand side is too short, pad until it has 3 digits
      if (input.length == 2 && rhs.length > 0) {
        // Pad with right-hand side if possible
        if (rhs.length > 0) {
          input = input + "." + rhs.charAt(0);
        }
        // Pad with zeroes if you must
        else {
          input += "0";
        }
      }
      else if (input.length == 1 && rhs.length > 0) {
        input = input + "." + rhs.charAt(0);
        // Pad with right-hand side if possible
        if(rhs.length > 1) {
          input += rhs.charAt(1);
        }
        // Pad with zeroes if you must
        else {
          input += "0";
        }
      }
    }
    var numNumerals = input.length;
    // if it has a period, then numNumerals is 1 smaller than the string length:
    if (input.split(".").length > 1) {
      numNumerals--;
    }
    if(numNumerals <= 3) {
      return String(input) + suffixes[iteration];
    }
    else {
      return recurse(Number(input) / 1000, iteration + 1);
    }
  }
}

/*!
* ----------------------
* Keen IO Visualization
* ----------------------
*/

// ------------------------------
// <Client>.draw method
// ------------------------------
// Shorthand interface, returns
// a configured Dataviz instance
// ------------------------------

Keen.prototype.draw = function(query, el, cfg) {
  var DEFAULTS = _clone(Keen.Visualization.defaults),
      visual = new Keen.Dataviz(),
      request = new Keen.Request(this, [query]),
      config = cfg ? _clone(cfg) : {};

  if (config.chartType) {
    visual.chartType(config.chartType);
    delete config.chartType;
  }
  if (config.library) {
    visual.library(config.library);
    delete config.library;
  }
  if (config.chartOptions) {
    visual.chartOptions(config.chartOptions);
    delete config.chartOptions;
  }
  visual
    .attributes(_extend(DEFAULTS, config))
    .el(el)
    .prepare();

  request.on("complete", function(){
    visual
      .parseRequest(this)
      .render();
  });
  request.on("error", function(res){
    visual.error(res.message);
  });
  return visual;
};


// ------------------------------
// <Keen.Request>.draw method
// ------------------------------
// DEPRECATED: DO NOT USE :x
// ------------------------------

Keen.Request.prototype.draw = function(el, cfg) {
  //Keen.log("DEPRECATED: \"<Keen.Request>.draw()\" will be removed in a future release.");
  return new Keen.Visualization(this, el, cfg);
};


// ------------------------------
// Visualization constructor
// ------------------------------
// Legacy interface, returns a
// configured Dataviz instance
// ------------------------------

Keen.Visualization = function(dataset, el, cfg){
  var DEFAULTS = _clone(Keen.Visualization.defaults),
      visual = new Keen.Dataviz().data(dataset).el(el),
      config = cfg ? _clone(cfg) : {};

  if (config.chartType) {
    visual.chartType(config.chartType);
    delete config.chartType;
  }
  if (config.library) {
    visual.library(config.library);
    delete config.library;
  }
  if (config.chartOptions) {
    visual.chartOptions(config.chartOptions);
    delete config.chartOptions;
  }
  visual
    .attributes(_extend(DEFAULTS, config))
    .render();

  return visual;
};

Keen.Visualization.defaults = _extend({
  height: 400
  //width: 600
}, _clone(Keen.Dataviz.defaults));
if (Keen.loaded) {setTimeout(function(){Keen.utils.domready(function(){Keen.trigger("ready");});}, 0);}_loadAsync();

return Keen; 

});