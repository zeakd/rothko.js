// colorchip.js 
//
// zeakd

(function(factory){
    'use strict'
    // commonjs
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.export = factory(
            require('chroma')
        )
    // amd
    } else if (typeof define === 'function' && define.amd) {
        define([
            'chroma'
        ], factory);
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
        root.colorchip = factory(root.chroma);
    }      
}(function(chroma){