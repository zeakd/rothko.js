(function () {
    if(typeof Canvas === 'undefined') {
        var Canvas = function(width, height){
            var canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }
    }

    function isCanvas(elem) {
        return elem.toString() === "[object HTMLCanvasElement]" ||
            elem instanceof Canvas;       
    }

    function isImage(imageObj){
        return imageObj.toString() === "[object HTMLImageElement]" ||
            imageObj instanceof Image;               
    }

    function setPixel(target, x, y, r, g, b, a){
        if (typeof r === 'object') {
            a = r.a;
            b = r.b;
            g = r.g;
            r = r.r;
        }        

        if(r > 255 || r < 0 ||
           g > 255 || g < 0 ||
           b > 255 || b < 0) return;

        r = Math.floor(r);
        g = Math.floor(g);
        b = Math.floor(b);
        a = typeof a === 'undefined' ? 1 : a; 

        if(target.constructor.name === "ImageData"){
            a = a <= 1 ? a * 255 : a;
            a = Math.floor(a);

            var index = (y * target.width + x) * 4;
            target.data[index + 0] = r;
            target.data[index + 1] = g;
            target.data[index + 2] = b;
            target.data[index + 3] = a;
        } else {
            if (isCanvas(target)) {
                target = target.getContext('2d');
            } 
            if(target.constructor.name === "CanvasRenderingContext2D") {
                a = a > 1 ? a / 255 : a;
                target.fillStyle =         
                    'rgba('+r+','+g+','+b+','+a+')';
                target.fillRect(x,y,1,1);
            } else {
                throw target;
            }
        }
    }

    function pixelLooper(target, getHandler, setHandler){
        imageData = isCanvas(target) ? 
            target
            .getContext('2d')
            .getImageData(0,0,target.width, target.height) : imageData;
        
        getHandler = getHandler || function () {};
        setHandler = setHandler || function () {};
        
        width = imageData.width;
        height = imageData.height;
        for(var x = 0; x < width; ++x){
            for(var y = 0; y < height; ++y){
                var index = (x + y * imageData.width) * 4;
                var r = imageData.data[index + 0];
                var g = imageData.data[index + 1];
                var b = imageData.data[index + 2];
                var a = imageData.data[index + 3];
                getHandler(x,y,r,g,b,a);
                setHandler(imageData.data, x, y, index+0, index+1, index+2, index+3);
            }
        }
        if (isCanvas(target)) {
            target.getContext("2d").putImageData(imageData, 0, 0);    
        }
        
    }

    function createCanvasByImage(img, pixelSaturate){
        var imgWidth = typeof img.naturalWidth !== "undefined" ? img.naturalWidth : img.width;
        var imgHeight = typeof img.naturalHeight !== "undefined" ? img.naturalHeight : img.height;
        var pixelNum = imgWidth * imgHeight;
        pixelSaturate = pixelSaturate || pixelNum;    
        
        var pixelNumRate = pixelNum / pixelSaturate;

        var canvasWidth = imgWidth;
        var canvasHeight = imgHeight;
        
        if(pixelNumRate > 1){
            var lengthRate =  Math.sqrt(pixelNumRate);
            canvasWidth = Math.round(canvasWidth / lengthRate);
            canvasHeight = Math.round(canvasHeight / lengthRate);
        }

        var rCanvas = new Canvas(canvasWidth, canvasHeight);
        var rCanvasCtx = rCanvas.getContext("2d");
        rCanvasCtx.drawImage(img, 0,0, imgWidth, imgHeight, 0,0, canvasWidth, canvasHeight);
        return rCanvas;
    }

    var drawingKit = {
        Canvas : Canvas,
        isCanvas : isCanvas,
        isImage : isImage,
        setPixel : setPixel,
        pixelLooper: pixelLooper,
        createCanvasByImage : createCanvasByImage,
    }
    
    window.drawingKit = drawingKit;
}())
