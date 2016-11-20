(function (factory) {
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
    root.Imagebox = factory();
  }     
}(function () {
  function map(arr, cb) {
    return Array.prototype.map.call(arr, cb)
  }

  function Imagebox (box, opt) {
    /* ducktype check */
    if (box && typeof box.length === 'number') {
      return map(box, function (box) { return new Imagebox(box) });  
    }

    this.box = box;
    this.handler = {};
    console.log('here');
    var self = this;    
    var input = box.querySelector('.imagebox-upload input[type=file]');
    input.addEventListener('change', function (e) {
      var image = box.querySelector('img')
      console.log(box)
      var file = input.files[0];

      console.log(file.type);

      var reader = new FileReader();
      reader.onload = function () {
        image.src = this.result;
        
        var e = {};
        e.img = image;
        e.data = image.src;

        if (self.handler['change']) {
          self.handler['change'](e);  
        }
      }

      reader.readAsDataURL(file);
    })
  }

  Imagebox.prototype.on = function (name, handler) {
    this.handler[name] = handler;
  }

  return Imagebox;
}));