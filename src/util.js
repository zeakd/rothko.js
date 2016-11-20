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