// Rothko.js 
//
// zeakd

(function(factory){
    'use strict'
    // commonjs
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.export = factory(
            require('drawing-kit'),
            require('histogram-analyze'),
            require('chroma')
        )
    // amd
    } else if (typeof define === 'function' && define.amd) {
        define([
            'drawing-kit', 
            'histogram-analyze',
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
        root.Rothko = factory(root.drawingKit, 
                              root.histogramAnalyze, 
                              root.chroma);
    }     
}(function(kit, hA, chroma){

var ACHROMA_C = 10;
var ACHROMA_B = 10;
var ACHROMA_W = 95;
var HIGHSAT_C = 70;
var HIGHSAT_L = 90;

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
    var flatted = smoothed.flatten(0.05);
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


    var chromas = pickColors(chromaColors, chromaHuePeaks, 2);
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
            if (imageRate > 0.00008) {
                colors[i].imageRate = imageRate;
                pickedRate += imageRate;
                result.push(colors[i]);    
            }
        }
        return result;
    }
    
    chromas = arrange(chromas);
    achromas = arrange(achromas);

    var dominants = chromas.concat(achromas);
    dominants.sort(function (f,b) {
        return b.rate - f.rate;
    });
    
    for (var i=0; i < dominants.length; i++) {
        dominants[i].rate = dominants[i].imageRate / pickedRate;    
    }
    
    var points = pickColors(highSatColors, highSatHuePeaks, 2);
    combine(points);
    points = arrange(points);
    
    return {
        dominants : dominants,
        points : points,
        chromas : chromas,
        achromas : achromas
    }
};

Rothko.prototype.getColors = function () {

}


    return Rothko;
}))