var gulp = require('gulp');
var concat = require('gulp-concat');

function build() {
  return gulp.src([
    'wrap-start.js',
    'util.js',
    'color.js',
    'constructor.js',
    'wrap-end.js'
  ].map((value)=> {
    return `./src/${value}`;
  }))
    .pipe(concat('rothko.js'))
    .pipe(gulp.dest('./dist/'))
}

gulp.task('build', build);
module.exports = build;