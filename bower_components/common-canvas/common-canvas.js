(function(){
var isNodeModule = typeof module !== 'undefined' && module.exports;
var isRequirejs = typeof define === 'function' && define.amd;
    
var Canvas;
    
/* Constructor Setting */
if(isNodeModule){
    var Canvas = require("canvas");   
    Image = Canvas.Image;
}else {
    var Canvas = function(width, height){
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
}

var commonCanvas = {
    Canvas : Canvas,
    isCanvas : isNodeModule ? function(imageObj){
        return imageObj instanceof Canvas;} 
        : function(imageObj){
        return imageObj.toString() === "[object HTMLCanvasElement]";
    },
    isImage : function(imageObj){
        return imageObj instanceof Image || 
            imageObj.toString() === "[object HTMLImageElement]";   
    },
    
    setPixel : function(target, x, y, r, g, b, a){
        color = typeof r === 'object' ? r : {r: r, g: g, b: b, a: a};
        if(target.constructor.name === "CanvasRenderingContext2D"){
            target.fillStyle = 'rgba('+color.r+','+color.g+','+color.b+','+color.a+')';
            target.fillRect(x,y,1,1);
        } else if(target.constructor.name === "ImageData"){
            if(a < 1) parseInt( a * 255 );
            var index = (y * target.width + x) * 4;
            target.data[index + 0] = color.r;
            target.data[index + 1] = color.g;
            target.data[index + 2] = color.b;
            target.data[index + 3] = color.a;
        } else {
            throw target;
        }
    },
    
    createCanvasByImage : function(img, pixelSaturate){
    //    console.log(__basename + " - function() createCanvasByImage start ...");
    //    console.log(img);
        var imgWidth = typeof img.naturalWidth !== "undefined" ? img.naturalWidth : img.width;
        var imgHeight = typeof img.naturalHeight !== "undefined" ? img.naturalHeight : img.height;
        var pixelNum = imgWidth * imgHeight;
        pixelSaturate = typeof pixelSaturate !== "undefined" ? pixelSaturate : pixelNum;    
        var pixelNumRate = pixelNum / pixelSaturate;

        var canvasWidth = imgWidth;
        var canvasHeight = imgHeight;

        if(pixelNumRate > 1){
//            console.log("resizing... pixcoelNumRate : " + pixelNumRate);
            var lengthRate =  Math.sqrt(pixelNumRate);
            canvasWidth = parseInt(canvasWidth/lengthRate);
            canvasHeight = parseInt(canvasHeight / lengthRate);
//            console.log("resizing result - canvasWidth : " + canvasWidth + ", canvasHeight : " + canvasHeight);
        }

        var rCanvas = new Canvas(canvasWidth, canvasHeight);
        var rCanvasCtx = rCanvas.getContext("2d");
        rCanvasCtx.drawImage(img, 0,0, imgWidth, imgHeight, 0,0, canvasWidth, canvasHeight);
    //    console.log(__basename + " - function() createCanvasByImage end");
        return rCanvas;
    },
    hex2Rgb : function(hex){    //#ff1234
        var r = parseInt(hex.slice(1,3),16);
        var g = parseInt(hex.slice(3,5),16);
        var b = parseInt(hex.slice(5,7),16);
        return {r: r, g: g, b: b, a: 255};
    },
    rgb2Hex : function(r,g,b){
        if(typeof r === 'object'){
            g = r.g;
            b = r.b;
            r = r.r;
        }
        function dec2HexStr(d){   
            var hStr = d.toString(16);
            return hStr.length === 1? "0" + hStr : hStr;
        }
        return "#"+dec2HexStr(r)+dec2HexStr(g)+dec2HexStr(b);
    }
};
    
    
if(isNodeModule){
    module.exports = commonCanvas ;
}else if(isRequirejs){
    define(function(){ return commonCanvas });
}else {
    window.commonCanvas = commonCanvas;
}
})();