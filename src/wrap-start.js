/**
 * @author zeakd <artydeveloperduck@gmail.com>
 */
// based on https://github.com/facebook/react/docs/js/react-dom.js
(function(factory){
  'use strict'
  // CommonJS
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  // RequireJS
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  // <script>    
  } else {
    var root;
    if (typeof window !== "undefined") {
      root = window;
    } else if (typeof global !== "undefined") {
      root = global;
    } else if (typeof self !== "undefined") {
      root = self;
    } else {
      // works providing we're not in "use strict";
      // needed for Java 8 Nashorn
      // see https://github.com/facebook/react/issues/3037
      root = this;
    }
    root.Rothko = factory();
  }      
}(function(){