var gulp = require('gulp');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var run = require('gulp-run');
var browserSync = require('browser-sync');


gulp.task("serve:release", ['build'], function () {
    
})

gulp.task("serve:dev", ['sass:dev'], function () {
    browserSync({
        server: {
            baseDir: ['debug', 'src', 'vendor', 'tmp'],
            routes: {
                "assets/scripts": './'
            }
        },
        open: false
    })
    
    gulp.watch("debug/scss/**/*.scss", ['sass:dev']);
    
    gulp.watch([
        "debug/index.html",
        "tmp/**/*.*",
        "src/**/*.js"
    ]).on('change', browserSync.reload);
})

gulp.task("build", ['build:rothko'])

gulp.task('build:all', [
    'build:rothko', 
    'build:ha',
    'build:kit'
])

gulp.task("build:rothko", function () {
    gulp.src([
        'src/wrap-start.js',
        'src/rothko-core.js',
        'src/wrap-end.js'
    ]).pipe(concat('rothko.js'))
      .pipe(gulp.dest('./dist/'))        
})

gulp.task("build:ha", function () {
    gulp.src([
        'vendor/histogram-analyze/src/wrap-start.js',
        'vendor/histogram-analyze/src/ha-core.js',
        'vendor/histogram-analyze/src/wrap-end.js'
    ]).pipe(concat('histogram-analyze.js'))
      .pipe(gulp.dest('vendor/histogram-analyze/dist/'))        
})

gulp.task("build:kit", function () {
    gulp.src([
        'vendor/drawing-kit/src/wrap-start.js',
        'vendor/drawing-kit/src/kit-core.js',
        'vendor/drawing-kit/src/wrap-end.js'
    ]).pipe(concat('drawing-kit.js'))
      .pipe(gulp.dest('vendor/drawing-kit/dist/'))        
})


gulp.task('sass:dev', function (cb) {
    gulp.src('debug/scss/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('tmp/style'));
    cb();
})

gulp.task("default")

gulp.task('install-deps:test', function (cb) {
    run('npm install ./vendor/histogram-analyze');
    run('npm install ./vendor/drawing-kit');
    cb();
})