
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
