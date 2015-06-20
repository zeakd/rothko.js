// Rothko Project
//
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
        var kit = require('./dep/drawing-kit');
        var HA = require('./dep/histogram-analyze');
        module.exports = factory(Canvas, Image, tc, kit, HA);
        //Node module dependency
    }else {
        Canvas = function(width, height){
            var canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }   
        if(isRequirejs){
            define(['tinycolor', 'drawing-kit', 'histogram-analyze'], function(tc, kit, HA){ 
            //export requirejs Module
                return factory(Canvas, Image, tc, kit, HA); 
            });
        } else {
            kit = window.drawingKit;
            tc = window.tinycolor;
            HA = window.HistogramAnalyze;
            root.Rothko = factory(Canvas, Image, tc, kit, HA);        
        }
        //export normal browser module.
        
    }    
}(function(Canvas, Image, tc, kit, HA){
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
    var Rothko = function Rothko (imageObj){
        var RESIZING_PIXEL = 100000;
        if(!(this instanceof Rothko)){
           return new Rothko(imageObj);
        }
        if (kit.isImage(imageObj) || kit.isCanvas(imageObj)){
            var _image = kit.createCanvasByImage(imageObj, RESIZING_PIXEL);
            
        }
    };
    return Rothko;
}))