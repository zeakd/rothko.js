(function (factory) {
  'use strict'
  window.dbscan = factory();
}(function () {
  function dbscan(dots, eps, minPts) {
    var clusters = [];
    for (var i = 0; i < dots.length; i++) {
      var point = dots[i];

      if (!point.visit) {
        point.visit = true;

        var neighbors = regionQuery(dots, point, eps);
        if (neighbors.length < minPts) {
          point.cluster = null;
        } else {
          var cluster = {
            points : []
          }
          clusters.push(cluster);
          expandCluster(dots, point, neighbors, cluster, eps, minPts);
        }        
      }
    }
    return clusters;
  }

  function expandCluster(dots, point, neighbors, cluster, eps, minPts) {
    cluster.points.push(point);
    point.cluster = cluster;
    // console.log(neighbors);
    for (var i = 0; i < neighbors.length; i++) {
      var innerPoint = neighbors[i];

      if (!innerPoint.visit) {
        innerPoint.visit = true;
        var innerNeighbors = regionQuery(dots, innerPoint, eps);

        if (innerNeighbors.length >= minPts) {
          neighbors = neighbors.concat(innerNeighbors);
        }
      }
      // console.log(innerPoint.cluster)
      if (innerPoint.cluster === undefined) {
        innerPoint.cluster = cluster;
        cluster.points.push(innerPoint);
      }
    }
    // console.log('expand end', cluster);
  }

  function regionQuery(dots, point, eps) {
    var result = [];

    for (var i = 0; i < dots.length; i++) {
      if (distance(point, dots[i]) < eps) {
        result.push(dots[i]);
      }
    }
    
    return result;
  }

  function distance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + 
                     (p1.y - p2.y) * (p1.y - p2.y));
  }
  return dbscan;
}))