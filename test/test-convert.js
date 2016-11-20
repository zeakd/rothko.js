const Rothko = require('../dist/rothko.js');

describe('rgb lab', function () {
  describe('# rgb -> lab -> rgb', function () {
    this.timeout(50000);
    it('should be equal to origin rgb (approx. 40000ms.)', () => {
      for (var r = 0; r < 256; r += 5) {
        for (var g = 0; g < 256; g += 5) {
          for (var b = 0; b < 256; b += 5) {
            [r,g,b].should.be.deepEqual(Rothko.labToRgb(Rothko.rgbToLab([r,g,b])));
          }
        }
      }
      // done();
    })
  })
})