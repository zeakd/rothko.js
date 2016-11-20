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

function isImage(elem) {
  return elem.toString() === "[object HTMLImageElement]";
}

function createCanvasByImage(img, opt) {
  var defaultOpt = {

  };
  var opt = assign({}, defaultOpt, opt);

  var imgW = (typeof img.naturalWidth  !== 'undefined') ? img.naturalWidth  : img.width;
  var imgH = (typeof img.naturalHeight !== 'undefined') ? img.naturalHeight : img.height;
  var canvW = imgW;
  var canvH = imgH;

  var pixels = imgW * imgH;
  var maxPixelSize = opt.maxPixelSize;
  if (maxPixelSize && maxPixelSize < pixels) {
    var rate = Math.sqrt(maxPixelSize / pixels);
    canvW = Math.round(canvW * rate);
    canvH = Math.round(canvH * rate);
  }

  var canv = document.createElement("canvas");
  canv.width = canvW;
  canv.height = canvH;
  var ctx = canv.getContext('2d');
  ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, canvW, canvH);

  return canv;
}

function rgbToLab(rgb) {
  function toLinear(c) {
    /* 
      c <= 10.31475 
      but rgb always integer 
    */
    return c <= 10 ? c / 3294.6 : Math.pow((c + 14.025) / 269.025, 2.4);
  }

  function normalize(t) {
    return t > 0.008856 ? Math.pow(t, 1/3) : 7.787 * t + 0.1379;
  }
  
  var lR = toLinear(rgb[0]);
  var lG = toLinear(rgb[1]);
  var lB = toLinear(rgb[2]);
  // var linearRgb = [,,];
  // for (var i = 0; i < 3; i++) {
  //   linearRgb[i] = toLinear(rgb[i]);
  // }

  var nX = normalize((0.4124 * lR + 0.3576 * lG + 0.1805 * lB) / 0.95047);
  var nY = normalize( 0.2126 * lR + 0.7152 * lG + 0.0722 * lB);
  var nZ = normalize((0.0193 * lR + 0.1192 * lG + 0.9505 * lB) / 1.08883);
  
  var lab = [
    116 *  nY - 16,
    500 * (nX - nY),
    200 * (nY - nZ)
  ];

  return lab;
}

function labToRgb(lab) {
  function nonLinear(c) {
    return c < 0.0031308 ? c * 3294.6 : Math.pow(c, 1/2.4) * 269.025 - 14.025;
  }

  function denormalize(t) {
    return t > 0.2069 ? t * t * t : 0.1284 * (t - 0.1379);
  }

  var tmpL = (lab[0] + 16) / 116;
  var x = 0.95047 * denormalize(tmpL + lab[1] / 500);
  var y = denormalize(tmpL);
  var z = 1.08883 * denormalize(tmpL - lab[2] / 200);

  return [
    Math.round(nonLinear( 3.2406 * x - 1.5372 * y - 0.4986 * z)),
    Math.round(nonLinear(-0.9689 * x + 1.8758 * y + 0.0415 * z)),
    Math.round(nonLinear( 0.0557 * x - 0.2040 * y + 1.0570 * z)) 
  ]
}

function Rothko(canvas, opt) {
  if (isImage(canvas)) {
    canvas = createCanvasByImage(canvas, opt);
  }
  this.canvas = canvas;
  var ctx = canvas.getContext('2d');
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // var buffer = new ArrayBuffer(imageData.data.length);
  // var buf8 = new Unit8ClampedArray(buffer);
  // var data32 = new Unit32Array(buffer);
  var labs = [];
  var data = imageData.data;
  for (var i = 0; i < imageData.data.length; i += 4) {
    labs.push(rgbToLab([data[i + 0], data[i + 1], data[i + 2]]));
  }
  this.labs = labs;
  // console.log(labs);
}


Rothko.labToRgb = labToRgb;
Rothko.rgbToLab = rgbToLab;

return Rothko;
}))