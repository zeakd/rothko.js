var gulp = require('gulp');
var build = require('./build');

function watch () {
  return gulp.watch(`src/**/*.js`, build)
}

gulp.task('watch', watch);
module.exports = watch;