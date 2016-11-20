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

