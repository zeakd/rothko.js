(function () {
  window.onload = function () {
    init();
  }

  function init() {
    var img = document.getElementsByTagName('img')[0];
    // runRothko(img);

    // init imageboxes 
    var imageboxesElem = document.querySelectorAll('.imagebox');
    var imageboxes = new Imagebox(imageboxesElem);
    imageboxes[0].on('change', function(e) {
      // runRothko(e.img);
    })
  }

  function runRothko(img) {
    var roth = new Rothko(img, { maxPixelSize: 10000 });
    var labs = Array.prototype.slice.call(roth.labs);
    labs = arraySampling(labs, 1000);
    var dots = labs.map(function (lab) {
      return {
        x: lab[1],
        y: lab[2]
      }
    });

    var canvas = document.getElementById('graph');
    canvas.width = 500;
    canvas.height = 500;

    var graph = new Graph2d(canvas, {
      axis: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        style: '#aaa'
      },
      bgStyle: '#fafafa',
      scale: 0.5
    })
  
    graph.set(dots);
    // var clusters = dbscan(dots, 10, 6);
    
    // clusters.forEach(function (cluster) {
    //   var color = rgbToHex(genColor());

    //   cluster.points.forEach(function (point) {
    //     point.style = color;
    //   })
    // })
    // console.log(clusters);
    graph.draw();
  } 



  function genColor() {
    return [
      Math.round(Math.random() * 256), 
      Math.round(Math.random() * 256),
      Math.round(Math.random() * 256)
    ];
  }

  function rgbToHex(r, g, b) {
    if (r.length) {
      g = r[1];
      b = r[2];
      r = r[0];
    }
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function arraySampling(array, num) {
    var result = [];
    var rate = array.length > num ? Math.round(array.length / num) : 1;
    for (var i = 0; i < array.length; i += rate) {
      result.push(array[i]);
    }
    return result;
  }
}())

