var gulp = require('gulp');
var sass = require('gulp-sass');
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

gulp.task("build", function () {
    
})

gulp.task('sass:dev', function (cb) {
    gulp.src('debug/scss/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('tmp/style'));
    cb();
})

gulp.task("default")