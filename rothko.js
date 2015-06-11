// Rothko.js 
//
// zeakd

(function(factory){
    'use strict'
    var root = (typeof self == 'object' && self.self == self && self) ||
            (typeof global == 'object' && global.global == global && global);
    
    var isNodeModule = typeof module !== 'undefined' && module.exports;
    var isRequirejs = typeof define === 'function' && define.amd;
    /* Export and Constructor Setting */
    
    if(isNodeModule){
        var Canvas = require('canvas');
        var Image = Canvas.Image;
        var tc = require('tinycolor2');
        var cmCvs = require('common-canvas');
        var HA = require('histogram-analyze');
        module.exports = factory(Canvas, Image, tc, cmCvs, HA);
        //Node module dependency
    }else {
        Canvas = function(width, height){
            var canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }   
        if(isRequirejs){
            define(['tinycolor', 'common-canvas', 'histogram-analyze'], function(tc, cmCvs, HA){ 
            //export requirejs Module
                return factory(Canvas, Image, tc, cmCvs, HA); 
            });
        } else {
            cmCvs = window.commonCanvas;
            tc = window.tinycolor;
            HA = window.HistogramAnalyze;
            root.Rothko = factory(Canvas, Image, tc, cmCvs, HA);        
        }
        //export normal browser module.
        
    }    
}(function(Canvas, Image, tc, cmCvs, HA){
    /* setting */
    var h1D = HA.histogram1D;
    var cH1D = HA.circularHistogram1D;
    var h2D = HA.histogram2D;
    
    /* Constant */
    var HUE_RANGE = 360;
    var SATURATION_RANGE = 101;
    var VALUE_RANGE = 101;
    var CHROMA_RULE = {sL: 0.15, vL:0.2};
    var ACHROMA_RULE = {sR: 0.15, vR:0.2};
    var HIGH_SAT_RULE = {sL : 0.7, vL:0.9};

    var YELLOW_HUE = 60;    
    var GREEN_HUE = 120;

    function analyzeImage(){
        var hHist;
        var svHist;
        return {
            hHistogram : hHist,
            svHistogram : svHist,
            
        }
    }

    var Rothko = function Rothko (imageObj){
        var RESIZING_PIXEL = 100000;
        if(!(this instanceof Rothko)){
           return new Rothko(imageObj);
        }
        if (cmCvs.isImage(imageObj) || cmCvs.isCanvas(imageObj)){
            var _image = cmCvs.createCanvasByImage(imageObj, RESIZING_PIXEL);
            
            
//            console.log(imageCanvas.width, imageCanvas.height);          
//            var seen = [];
//            console.log(JSON.stringify(imageCanvas, function(key, val) {
//               if (val != null && typeof val == "object") {
//                    if (seen.indexOf(val) >= 0) {
//                        return;
//                    }
//                    seen.push(val);
//                }
//                return val;
//            }));
        }
    };
    
    
    
    
    
    
    
    
    
    
    
    
    




    return Rothko;
}))