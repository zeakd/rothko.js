(function(dK, hA, hD, cC, chroma) {    
    var ACHROMA_C = 10;
    var ACHROMA_L = 10;
    var HIGHSAT_C = 70;
    var HIGHSAT_L = 90;
    
    var Rothko = function (imgObj, opt) {
        if (!this instanceof Rothko) {
            return new Rothko(imgObj);    
        }
        
        this.origin = imgObj;
        console.log("width : " + imgObj.width + " height : " + imgObj.height);
        
    };
        
    Rothko.prototype.getColorsSync = function () {
        this.imageCanvas = dK.createCanvasByImage(this.origin, 50000);
        
        var colors = this.colors = [];
        
        var chromaColors = this.chromaColors = [];
        var achromaColors = this.achromaColors = [];
        var highSatColors = this.highSatColors = [];
        
        var histoChromaH = this.histoChromaH = hA.circularHistogram1D(360);
        var histoHighSatH = this.histoHighSatH = hA.circularHistogram1D(360);
        var histoAchromaL = this.histoAchromaL = hA.histogram1D(101);
        
        function getHandler(x, y, r, g, b, a) {
            var lch = chroma.rgb(r,g,b).lch();
            lch[2] = isNaN(lch[2]) ? 0 : lch[2];
            var l = lch[0],
                c = lch[1],
                h = lch[2];
            l = Math.round(l);
            c = Math.round(c);
            h = Math.round(h);
            
            h = h === 360 ? 0 : h;
            
            if (ACHROMA_C > c || ACHROMA_L > l) {
                histoAchromaL[l]++;
                achromaColors.push(lch);    
            } else if (HIGHSAT_C < c || HIGHSAT_L < l) {
                histoHighSatH[h]++;
                highSatColors.push(lch);
            } else {       
                histoChromaH[h]++;
                chromaColors.push(lch);
            }
        }
        
        dK.pixelLooper(this.imageCanvas, getHandler);
        
        this.lHistogram = hD.draw1d(histoChromaH);
        
        //get h

        
        function pickColors (colorStorage, data, dataIdx) {
            var pickedColors = [];

            for (var i = 0; i < colorStorage.length; ++i) {
                for (var j = 0; j<data.length; ++j) {
                    var d = colorStorage[i][dataIdx];

                    if ((data[j].start <= d && data[j].end > d) ||
                        ((data[j].start > data[j].end) &&
                         (d >= data[j].start || d < data[j].end)
                        )) {
                        if (pickedColors[j]) {
                            var rgb = chroma.lch(colorStorage[i]).rgb();
                            pickedColors[j][0] += rgb[0];

                            pickedColors[j][1] += rgb[1];

                            pickedColors[j][2] += rgb[2];
                            pickedColors[j].size++;
                        } else {
                            pickedColors[j] = chroma.lch(colorStorage[i]).rgb();    
                            pickedColors[j].size = 1;
                        }
                    }
                }
            }
            for (var i = 0; i<pickedColors.length; ++i) {
                pickedColors[i][0] /= pickedColors[i].size;
                pickedColors[i][1] /= pickedColors[i].size;
                pickedColors[i][2] /= pickedColors[i].size;
            }
            
            return pickedColors;
        }
        
        var highSatHuePeaks = histoHighSatH.gaussianSmoothing(3,3).flatten(0.05).findPeaks();
        
        var smoothed = histoChromaH.gaussianSmoothing(5, 7)
        this.lHistogram1 = hD.draw1d(smoothed);
        
        var flatted = smoothed.flatten(0.05);
        this.lHistogram2 = hD.draw1d(flatted);
        
        var chromaHuePeaks = flatted.findPeaks();
        
        
        var achromaLumPeaks =  histoAchromaL.gaussianSmoothing(5,7).flatten(0.05).findPeaks();
        
        var highSaturates = pickColors(highSatColors, highSatHuePeaks, 2);
        var chromas = pickColors(chromaColors, chromaHuePeaks, 2);
        var achromas = pickColors(achromaColors, achromaLumPeaks, 0);
        
        
        var size = this.imageCanvas.width * this.imageCanvas.height;
        
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
        function arrange (colors) {
            for (var i =0; i < colors.length; ) {
                var rate = colors[i].size / size;    
                if (rate < 0.00008) {
                    var index = colors.indexOf(colors[i]);
                    if (index > -1) {
                        colors.splice(index, 1);
                    }  
                } else {
                    colors[i].rate = rate;
                    i++;
                }
            }
        }
        combine(highSaturates);
        arrange(highSaturates);
        arrange(chromas);
        arrange(achromas);
       
        
        var dominants = chromas.concat(achromas);
        dominants.sort(function (f,b) {
            return b.rate - f.rate;
        })
//        dominants = highSaturates.concat(dominants);
        
        return {
            dominants : dominants,
            highSaturates : highSaturates,
            chromas : chromas,
            achromas : achromas
        }
    };
    
    Rothko.prototype.getColors = function () {
        
    }
    
    window.Rothko = Rothko;
}(drawingKit, histogramAnalyze, histogramDraw, colorchip, chroma))