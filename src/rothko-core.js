
var ACHROMA_C = 10;
var ACHROMA_B = 10;
var ACHROMA_W = 90;
var HIGHSAT_C = 70;
var HIGHSAT_L = 85;

var Rothko = function (imgObj, opt) {
    if (!(this instanceof Rothko)) {
        return new Rothko(imgObj);
    }

    this.origin = imgObj;
    console.log("width : " + imgObj.width + " height : " + imgObj.height);

};

Rothko.prototype.getColorsSync = function () {
    this.imageCanvas = kit.createCanvasByImage(this.origin, 100000);

    var colors = this.colors = [];

    var chromaColors = this.chromaColors = [];
    var achromaColors = this.achromaColors = [];
    var highSatColors = this.highSatColors = [];

    var histoChromaH = this.histoChromaH = hA.circularHistogram1D(360);
    var histoHighSatH = this.histoHighSatH = hA.circularHistogram1D(360);
    var histoAchromaL = this.histoAchromaL = hA.histogram1D(101);

    function getHandler(x,y, r, g, b, a) {
        var lch = chroma.rgb(r,g,b).lch();
        lch[2] = isNaN(lch[2]) ? 0 : lch[2];
        var l = lch[0],
            c = lch[1],
            h = lch[2];
        l = Math.round(l);
        c = Math.round(c);
        h = Math.round(h);

        h = h === 360 ? 0 : h;

        if (HIGHSAT_C < c && HIGHSAT_L < l) {
            histoHighSatH[h]++;
            highSatColors.push(lch);
        }

        if (ACHROMA_C > c || ACHROMA_B > l || ACHROMA_W < l) {
            histoAchromaL[l]++;
            achromaColors.push(lch);
        } else {
            histoChromaH[h]++;
            chromaColors.push(lch);
        }
    }

    kit.pixelLooper(this.imageCanvas, getHandler);

    var highSatHuePeaks =  histoHighSatH.gaussianSmoothing(3,3).flatten(0.05).findPeaks();
    var smoothed = histoChromaH.gaussianSmoothing(5, 7)
//    this.lHistogram1 = hD.draw1d(smoothed);
    var flatted = smoothed.flatten(0.01);
//    this.lHistogram2 = hD.draw1d(flatted);
    var chromaHuePeaks = flatted.findPeaks();

    var achromaLumPeaks =  histoAchromaL.gaussianSmoothing(5,7).flatten(0.05).findPeaks();



//    this.lHistogram = hD.draw1d(histoChromaH);

    var pixelNum = this.imageCanvas.width * this.imageCanvas.height;

    function pickColors (colorStorage, peaks, colorDataIdx) {
        var pickedColors = [];
        var size = 0;
        var trashSize = 0;
        for (var i = 0; i < colorStorage.length; ++i) {
            for (var j = 0; j<peaks.length; ++j) {
                var color = colorStorage[i];
                var d = color[colorDataIdx];
                if ((peaks[j].start <= d && peaks[j].end > d) ||
                    ((peaks[j].start > peaks[j].end) &&
                     (d >= peaks[j].start || d < peaks[j].end)
                    )) {
                    var rgb = chroma.lch(color).rgb();
                    if (!pickedColors[j]) {
                        pickedColors[j] = [0, 0, 0];
                        pickedColors[j].size = 0;
                    }

                    pickedColors[j][0] += rgb[0];
                    pickedColors[j][1] += rgb[1];
                    pickedColors[j][2] += rgb[2];
                    pickedColors[j].size++;

                    size++;
                } else {
                    trashSize++;
                }
            }
        }
        for (var i = 0; i < pickedColors.length; ++i) {
            var pickedColor = pickedColors[i];
            pickedColor[0] /= pickedColor.size;
            pickedColor[1] /= pickedColor.size;
            pickedColor[2] /= pickedColor.size;
        }
        console.log("trash size : ", trashSize)
//        console.log("trash rate : ", trashSize / pickedColors)
        return pickedColors;
    }




    // console.log(chromaHuePeaks);

    var pickedLc = [];
    for (var i = 0; i < chromaHuePeaks.length; ++i) {
        pickedLc.push(new hA.histogram2D(101, 134, 0));
    }
    var size = 0;
    var trashSize = 0;
    for (var i = 0; i < chromaColors.length; ++i) {
        for (var j = 0; j<chromaHuePeaks.length; ++j) {
            var color = chromaColors[i];
            var d = color[2];
            if ((chromaHuePeaks[j].start <= d && chromaHuePeaks[j].end > d) ||
                ((chromaHuePeaks[j].start > chromaHuePeaks[j].end) &&
                 (d >= chromaHuePeaks[j].start || d < chromaHuePeaks[j].end)
                )) {

                // var rgb = chroma.lch(color).rgb();
                // if (!pickedLc[j]) {
                //     pickedLc[j] = [0, 0, 0];
                //     pickedLc[j].size = 0;
                // }

                pickedLc[j][Math.round(color[0])][Math.round(color[1])] += 1;
                // pickedLc[j][2] += rgb[2];
                // pickedLc[j].size++;

                // size++;
            } else {
                trashSize++;
            }
        }
    }
    // console.log(pickedLc)
    var beforeChromas = [];

    for (var i = 0; i < pickedLc.length; i++) {
      peaks = pickedLc[i].flatten(0.05).medianSmoothing(7).findPeaks();
      // console.log(peaks);
      for (var j = 0; j < peaks.length; j++) {
        var lch = [
          peaks[j].x,
          peaks[j].y,
          chromaHuePeaks[i].x
        ]
        var lab = chroma.lch(lch).lab();
        lab.size = peaks[j].size;
        beforeChromas.push(lab);
      }
    }

    function colorDifference(lab1, lab2) {
      var l1 = lab1[0];
      var a1 = lab1[1];
      var b1 = lab1[2];
      var l2 = lab2[0];
      var a2 = lab2[1];
      var b2 = lab2[2];

      var dl = l1 - l2;

      var c1 = Math.sqrt(a1 * a1 + b1 * b1);
      var c2 = Math.sqrt(a2 * a2 + b2 * b2);
      var dc = c1 - c2;

      var da = a1 - a2;
      var db = b1 - b2;

      var dhSq = da * da + db * db - dc * dc;

      var cFactor = dc / (1 + 0.045 * c1);
      return Math.sqrt(dl * dl + cFactor * cFactor + dhSq / ((1 + 0.015 * c1) * (1 + 0.015 * c1)));
    }
    console.log(beforeChromas);
    var chromas = []
    for (var i = 0; i < beforeChromas.length;) {
      for (var j = i + 1; j < beforeChromas.length;) {
        if (colorDifference(beforeChromas[i], beforeChromas[j]) < 8) {
          beforeChromas[i][0] = (beforeChromas[i][0] + beforeChromas[j][0]) / 2;
          beforeChromas[i][1] = (beforeChromas[i][1] + beforeChromas[j][1]) / 2;
          beforeChromas[i][2] = (beforeChromas[i][2] + beforeChromas[j][2]) / 2;
          beforeChromas[i].size = (beforeChromas[i].size + beforeChromas[j].size);
          beforeChromas.splice(j, 1);
          console.log("concat!");
        } else {
          j++;
        }
      }

      var color = beforeChromas.splice(i,1)[0];
      console.log(color);
      var rgb = chroma.lab(color).rgb();
      console.log(rgb);
      rgb.size = color.size;
      chromas.push(rgb);
    }
    console.log(chromas);
    // for (var i = 0; i < pickedColors.length; ++i) {
    //     var pickedColor = pickedColors[i];
    //     pickedColor[0] /= pickedColor.size;
    //     pickedColor[1] /= pickedColor.size;
    //     pickedColor[2] /= pickedColor.size;
    // }


    // var chromas = pickColors(chromaColors, chromaHuePeaks, 2);
    var achromas = pickColors(achromaColors, achromaLumPeaks, 0);

    function combine (colors) {
        function rgbDistance(f, b) {
            return Math.sqrt((f[0] - b[0]) * (f[0] - b[0]) +
                (f[1] - b[1]) * (f[1] - b[1]) +
                (f[2] - b[2]) * (f[2] - b[2]));
        }

        for (var i=0; i< colors.length - 1; i++) {
            var distance = rgbDistance(colors[i], colors[i+1]);
            if (distance < 50) {
                colors[i][0] = Math.round((colors[i][0] + colors[i+1][0]) /2)
                colors[i][1] = Math.round((colors[i][1] + colors[i+1][1]) /2)
                colors[i][2] = Math.round((colors[i][2] + colors[i+1][2]) /2)
                colors[i].size += colors[i+1].size;

                var index = colors.indexOf(colors[i+1]);
                if (index > -1) {
                    colors.splice(index, 1);
                }
            }
        }
    }

    var pickedRate = 0;
    function arrange (colors) {
        var result = [];
        for (var i =0; i < colors.length; i++) {
            var imageRate = colors[i].size / pixelNum;
            if (imageRate > 0.0001) {
                colors[i].imageRate = imageRate;
                pickedRate += imageRate;
                result.push(colors[i]);
            }
        }
        return result;
    }
    console.log(chromas)
    chromas = arrange(chromas);
    achromas = arrange(achromas);
    console.log(chromas)
    var dominants = chromas.concat(achromas);


    for (var i=0; i < dominants.length; i++) {
        dominants[i].rate = dominants[i].imageRate / pickedRate;
    }

    dominants.sort(function (f,b) {
        return b.rate - f.rate;
    });
    console.log(dominants);
    var points = pickColors(highSatColors, highSatHuePeaks, 2);
    combine(points);
    points = points.map(function (p) {
      var color = p;
      var imageRate = p.size / pixelNum;
      color.imageRate = imageRate;
      // pickedRate += imageRate;
      return color;
    })
    // points = arrange(points);

    return {
        dominants : dominants,
        points : points,
        chromas : chromas,
        achromas : achromas
    }
};

Rothko.prototype.getColors = function () {

}
