const gulp = require('gulp');
const mocha = require('gulp-mocha');
const build = require('./build');

function test() {
  return gulp.src(['test/test-*.js'], {read: false})
    .pipe(mocha({
      reporter: 'spec',
      globals: {
        should: require('should')
      }
    }));
}

gulp.task(
  'test',
  gulp.series(build, test)
)

module.exports = test;