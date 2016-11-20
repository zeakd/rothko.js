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
    root.Graph2d = factory();
  }     
}(function () {
  function isArray(arr) {
    return Object.prototype.toString.call(arr) === "[object Array]";
  }

  function assign(target) {
    var output = Object(target);  
    for (var idx = 1; idx < arguments.length; idx++) {
      var source = arguments[idx];
      if (source !== undefined && source !== null) {
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            output[key] = source[key];
          }
        }      
      }
    }
    return output;
  }

  function Graph2d(canvas, opt) {
    var defaultOpt = {
      dotColor: '#000',
      axis: {
        x: 0,
        y: canvas.height,
        style: '#aaa'
      },
      label: {
        style: '#bbb'
      }
    }
    this.opt = assign({}, defaultOpt, opt);


    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dots = [];
  }

  Graph2d.prototype.set = function(dot) {
    if (isArray(dot)) {
      this.dots = this.dots.concat(dot)
    } else {
      this.dots.push(dot);
    }
  };

  Graph2d.prototype.draw = function() {
    var axisX = this.opt.axis.x;
    var axisY = this.opt.axis.y;
    var scale = this.opt.scale;
    var dotColor = this.opt.dotColor;

    function drawDot(ctx, dot) {
      var bStyle = ctx.fillStyle;
      ctx.fillStyle = dot.style || dotColor;
      ctx.fillRect(axisX + Math.round(dot.x / scale), 
                   axisY - Math.round(dot.y / scale), 
                   2, 2)

      ctx.fillStyle = bStyle;
    }

    var ctx = this.ctx;

    this._drawBg();

    var beforeStyle = ctx.fillStyle;
    this.dots.forEach(function (dot) {
      drawDot(ctx, dot);
    })
    ctx.fillStyle = beforeStyle;
  };

  Graph2d.prototype._drawBg = function () {
    var canvas = this.canvas;
    var ctx = this.ctx;
    var opt = this.opt;

    /** 
     * @todo bg color.
     */
    ctx.fillStyle = opt.bgStyle;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /**
     * @todo origin line
     */ 
    ctx.fillStyle = opt.axis.style;
    ctx.beginPath();
    ctx.moveTo(opt.axis.x, 0);
    ctx.lineTo(opt.axis.x, canvas.height);
    ctx.moveTo(           0, opt.axis.y);
    ctx.lineTo(canvas.width, opt.axis.y);
    ctx.stroke();

    /** 
     * @todo label
     */
    
  }

  return Graph2d;
}));