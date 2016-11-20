const gulp = require('gulp');
const sass = require('gulp-sass');
const browserSync = require('browser-sync').create();
const build = require('./build');
const watch = require('./watch');

const pgConfig = {
  paths: {
    root: "./playground",
    sass: "./playground/sass",
    css: "./playground/css",
    js: "./playground/js",
  }
}

function servePlayground() {
  browserSync.init({
    server: {
      baseDir: "./playground"
    },
    browser: 'google chrome'
  })
}

function jsPlayground() {
  return gulp.src('dist/rothko.js')
    .pipe(gulp.dest(`${pgConfig.paths.js}/vendor`));
}

function sassPlayground() {
  return gulp.src(`${pgConfig.paths.sass}/**/*.scss`)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(pgConfig.paths.css))
    .pipe(browserSync.stream());
}


function watchPlayground() {
  gulp.watch(`dist/rothko.js`, jsPlayground);
  gulp.watch(`${pgConfig.paths.sass}/**/*.scss`,
    sassPlayground);
  gulp.watch(`${pgConfig.paths.root}/**/*.html`)
    .on('change', browserSync.reload);
  gulp.watch(`${pgConfig.paths.js}/**/*.js`)
    .on('change', browserSync.reload);

}

/*
 * task
 */
gulp.task(
  'playground', 
  gulp.series(
    build,
    jsPlayground,
    sassPlayground,
    gulp.parallel(
      servePlayground,
      watchPlayground,
      watch
    )
  )
)