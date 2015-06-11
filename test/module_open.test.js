(function(test){
    
    var root = (typeof self == 'object' && self.self == self && self) ||
            (typeof global == 'object' && global.global == global && global);
    
    var isNode = typeof module !== 'undefined' && module.exports;
    var isAMD = typeof define === 'function' && define.amd;

    var Rothko;
    var env;
    var should;
    if(isNode){
        var fs = require('fs');
        console.log(__dirname);
        var imgSrc = fs.readFileSync('./image/test.jpg');
        Rothko = require("../rothko");
        var should = require("chai").should();
        env = "Node";
        test(Rothko, should, env, imgSrc);
    }else {
        var imgSrc = '../image/test.jpg'
        if(isAMD) {
            define(['Rothko', 'chai'], function(Rothko, chai){
                should = chai.should();
                env = 'AMD';
                test(Rothko, should, env, imgSrc);
            })
        }else {
            Rothko = root.Rothko;
            env = "Globals"
            test(Rothko, should, env, imgSrc);
        }
    } 
    
}(function(Rothko, should, env, imgSrc){
    describe('Open with '+env, function(){
        describe('#Rothko module', function(){
            it('is ok', function(){
                Rothko.should.be.ok;
            })
        })
        describe(('#image assgin'), function(){
            it('should assign Image', function(done){
                var img = new Image()
                img.onload = function(){
                    Rothko(img);
                    done();
                }; 
                img.src = imgSrc;
            })
        })
    })
    
}))