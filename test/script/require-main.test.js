require.config({
    baseUrl: '../',
    paths: {
//        mocha: 'node_modules/gulp-mocha/node_modules/mocha/mocha',
        chai: 'node_modules/chai/chai',
        'histogram-analyze': 'node_modules/histogram-analyze/histogram-analyze',
        'common-canvas': 'node_modules/common-canvas/common-canvas',
        tinycolor: 'node_modules/tinycolor2/tinycolor',
        rothko: 'rothko'
    }   
    
})

define(['module_open.test.js'], function() {
    if (window.mochaPhantomJS) {
        mochaPhantomJS.run();
    } else {
        mocha.run();
    }   
})