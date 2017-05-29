'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass');
const sassGlob = require('gulp-sass-glob');
const autoprefixer = require('gulp-autoprefixer');
const uglifycss = require('gulp-uglifycss');
const include = require('gulp-include');
const addsrc = require('gulp-add-src');
const order = require('gulp-order');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const babili = require('gulp-babili');
var exec = require('gulp-exec');

gulp.task('sass', function() {
  return gulp.src(['app/stylesheets/application.scss',
                   'app/stylesheets/certificate.scss',
                   'app/stylesheets/timestamp-of.scss',
                   'app/stylesheets/search.scss'])
    .pipe(sassGlob())
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(uglifycss())
    .pipe(gulp.dest('app/stylesheets/'));
});

gulp.task('javascript', function() {
  return gulp.src('app/assets/javascripts/application/*.js')
    .pipe(addsrc('app/assets/javascripts/vendor/index.js'))
    .pipe(order([
      "app/assets/javascripts/vendor/index.js",
      "app/assets/javascripts/application/*.js"
    ], {base: '.'}))
    .pipe(include())
    .pipe(concat('app/app.js'))
    // .pipe(uglify())
    .pipe(gulp.dest('app/assets/javascripts'));
});

gulp.task('watch', function() {
  gulp.watch('app/assets/stylesheets/**/*.scss', ['sass']);
  gulp.watch('app/assets/javascripts/application/*.js', ['javascript']);
});
