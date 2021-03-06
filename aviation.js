/*
URL routing for frontend apps!
+ Inspired by express.


Written by Devang Srivastava ( https://github.com/SociallyDev )

MIT License ( https://opensource.org/licenses/MIT )
*/


if(typeof $ == "undefined") { throw new Error("Aviation requires jQuery for now.") }





/********************************************* PRIMARY FUNCTION **********************************************/


/*
The Aviation class.
*/
function Aviation(options) {
  if(!(this instanceof Aviation)) { return new Aviation(options) }
  if(typeof options !== "object") { options = {strict: false, caseSensitive: false} }
  var callbacks = [], aviation = this, contentWrapper = $(options.contentWrapper || "body"), onError = options.onError || function(e) { console.error(e) }


  /******************************************** ROUTING FUNCTIONS **********************************************/


  /*
  Adds callbacks.
  */
  this.on = function(match, callback) {
    var path = match, fn = callback, keys = []
    if(!callback) { fn = match, path = /^.*$/ }

    //Convert path to regex.
    if(!(path instanceof RegExp)) {
      if(path.constructor == Array || path.constructor == Object) { for(var i in path) { aviation.use(path[i], callback) }; return aviation }
      else { path = String(path) }
      var flags = ""

      path = $("<a href='" + path + "'></a>").get(0).pathname
      if(!options.strict) { path = path.replace(/\/$/, "") }
      if(!options.caseSensitive) { flags = "i" }
      if(options.removeFromPath) { path = path.replace(options.removeFromPath, "") }

      //Handle params.
      if(/\:/.test(path)) {
        path = path.replace(/\*+/g, "").replace(/:([^\/]+)/g, function(a, key) { keys.push(key); return "([^\\/]+?)" })
        path = new RegExp("^" + path.split("([^\\/]+?)").map(function(p) { return p.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&") }).join("([^\\/]+?)") + "$", flags)
      }
      else {
        path = new RegExp("^" + path.split(/\*+/).map(function(p) { return p.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&") }).join(".*") + "$", flags)
      }
    }

    //Add to list of callbacks.
    callbacks.push({
      path: path,
      keys: keys,
      fn: fn
    })

    return aviation
  }
  this.use = this.on



  /*
  Handles requests.
  */
  this.handle = function(url) {
    var exactURL = (typeof url == "string" ? url : (typeof url !== "object" ? "/" : (url.href ? url.href : (this.href ? this.href : (this.action ? this.action : "/")))))
    var el = $("<a href=" + exactURL + "></a>").get(0), path = el.pathname

    if(!options.strict) { path = path.replace(/\/$/, "") }
    if(options.removeFromPath) { path = path.replace(options.removeFromPath, "") }

    //Create a list of viable callbacks.
    var viableCbs = []
    for(var i in callbacks) {
      var cb = callbacks[i]
      if(cb.path && cb.path.test(path)) {
        var params = {}, vals = path.match(cb.path).slice(1)
        if(cb.keys.length) { for(var i in vals) { params[cb.keys[i]] = vals[i] } }
        viableCbs.push({fn: cb.fn, params: params})
      }
    }
    if(!viableCbs.length) { return aviation }

    //Create request, response and next functions.
    if(url.preventDefault) { url.preventDefault() }
    if(!path || path[0] !== "/") { path = "/" + (path || "") }
    var request = {
      url: el.href,
      hostname: el.hostname,
      path: path,
      protocol: (el.protocol ? el.protocol.replace(":", "") : null),
      secure: false,
      query: parseQuery(el.href),
      params: {},
      cookies: parseCookies(),
      aviation: aviation
    }
    if(request.protocol == "https") { request.secure = true }

    var response = {
      cookie: function(key, val, options) {
        if(!options) { options = {} }
        request.cookies[key] = val
        if(typeof options.maxAge == "undefined" && typeof options.expires == "undefined") { options.maxAge = 2.628e+6 }
        document.cookie = encodeURIComponent(key) + "=" + encodeURIComponent(val)
        + (options.maxAge ? ";max-age=" + encodeURIComponent(options.maxAge) : "")
        + (options.expires ? ";expires=" + encodeURIComponent(options.expires) : "")
        + (options.path ? ";path=" + encodeURIComponent(options.path) : ";path")
        + (options.domain ? ";domain=" + encodeURIComponent(options.domain) : "")
        + (options.secure ? ";secure=" + encodeURIComponent(options.secure) : "")
        + (options.sameSite ? ";samesite=" + encodeURIComponent(options.sameSite) : "")
        return this
      },

      clearCookie: function(key, options) {
        options.maxAge = -1
        this.cookie(key, null, options)
        delete request.cookies[key]
        return this
      },

      location: function(url) {
        var redirect = true
        aviation.handle({href: url, preventDefault: function() { redirect = false }})
        if(redirect) { window.location = url }
        return this
      },

      redirect: function(url) { return this.location(url) },

      page: function(title, url) {
        if(typeof history !== "undefined" && history.pushState) { history.pushState({}, title, url || request.url) }
        $("title").text(title)
        return this
      },

      html: function(content) {
        contentWrapper.html(content)
        return this
      }
    }

    var next = function(e) {
      try {
        if(e) { throw e }
        i++
        var cb = viableCbs[i]
        if(!cb) { return }
        request.params = cb.params
        var result = cb.fn(request, response, next)
        if(result && result.catch) { result.catch(function(e) { onError(e, request, response, next) }) }
      }
      catch(e) { onError(e, request, response, next) }
    }, i = -1

    //Start request.
    next()

    return aviation
  }



  //Setup calls.
  if(!options.cancelLoadRouting) { $(document).ready(function() { aviation.handle(window.location) }) }
  $(document).on(options.event || "click", options.source || "a[href]:not([target='_blank'])", aviation.handle)
  window.addEventListener("popstate", function(e) { aviation.handle(window.location.href) }, false)





  /********************************************* HELPER FUNCTIONS **********************************************/


  /*
  Parses query.
  */
  var parseQuery = function(qs) {
    if(!/\?/.test(qs)) { return {} }
    var query = {}, pairs = qs.split("?")[1].split("&")
    for(var i in pairs) { var pair = pairs[i].split("="); query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]) }
    return query
  }



  /*
  Parses cookies.
  */
  var parseCookies = function() {
    var cookies = {}, cookie = document.cookie.split(";")
    for(var i in cookie) { var pair = cookie[i].split("="); if(!pair[0] || !pair[1]) { continue }; cookies[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]) }
    return cookies
  }

}





/********************************************* BUILDER FUNCTIONS **********************************************/


/*
Writing HTML as strings in JS is hard.
So just write pure HTML, JSX helps you with that.
And this function, when set as the pragma for JSX instead of React.createElement,
turns that JSX into safe JS that can be used on any browser.
Returns a jQuery element.
*/
Aviation.element = function() {
  var children = arguments, type = "div", props = false
  if(children[0] && typeof children[0] == "string") { type = children[0]; delete children[0] }
  if(children[1] && typeof children[1] == "object") { props = children[1]; delete children[1] }

  var el = $("<" + type + ">")
  if(props) {
    if(props.className) { props.class = props.className; delete props.className }
    if(props.style && props.style.constructor == Object) { el.css(props.style); delete props.style }
    el.attr(props)
  }
  for(var i in children) {
    if(!children[i] || !children[i].isAviationElement) { children[i] = Aviation.safe(children[i]) }
    el.append(children[i])
  }

  el.isAviationElement = true
  return el
}



/*
Escapes text for safe usage.
*/
Aviation.safe = function(text) {
  if(!text) { return "" }
  text = String(text).replace(/\&/gi, "&amp;").replace(/\</gi, "&lt;").replace(/\>/gi, "&gt;").replace(/\"/gi, "&quot;").replace(/\'/gi, "&#x27;").replace(/\//gi, "&#x2F;")
  return text
}



/*
Creates a function to help with getting the outer HTML.
*/
$.fn.extend({
  outerHTML: function() {
    var html = ""
    this.each(function() { html += this.outerHTML })
    return html
  }
})
