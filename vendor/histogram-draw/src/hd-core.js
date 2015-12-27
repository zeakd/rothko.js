(function (dk) {
    function max (l) {
        return Math.max.apply(null, l);
    }
    
    function draw1d (data, opt) {
        opt = opt || {};
        var canvasW = opt.width || 1600;
        var canvasH = opt.height || 900;
        var color = opt.color || "#AA5198";
        
        var targetCanvas;
        if (opt.canvas) {
            targetCanvas = opt.canvas;
        } else {
            targetCanvas = dk.Canvas(canvasW, canvasH);
        }
        var targetCtx = targetCanvas.getContext("2d");
        
        var histoW = canvasW - 50;
        var histoH = canvasH - 50;
        var len = data.length;
        var blockSpace = 1;
        
        var blockSize = Math.round((histoW + blockSpace) / len - blockSpace);
        
        var dataMax = max(data);
        var originW = 20;
        var originH = canvasH - 20;

        targetCtx.fillStyle = color;

        for (var i = 0; i < len; ++i) {
            var datumH = data[i] / dataMax * histoH;
            var datumWStart = originW + i * (blockSize + blockSpace);
            targetCtx.fillRect(datumWStart, 
                               originH - datumH,
                               blockSize,
                               datumH);
        }
  
        return targetCanvas;
    }
    
    var histogramDraw = {
        draw1d : draw1d
    }
    
    window.histogramDraw = histogramDraw;
}(drawingKit))