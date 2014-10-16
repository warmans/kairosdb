module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
          options: {
            separator: '\n\n'
          },
          dist: {
              files: {
                  'dist/vendor.js': [
                      'bower_components/jquery/dist/jquery.min.js',
                      'bower_components/angular/angular.min.js',
                      'bower_components/angular-tree-control/angular-tree-control.js',
                      'bower_components/angular-ui-bootstrap/ui-bootstrap-0.11.2.min.js',
                      'bower_components/angular-ui-bootstrap/ui-bootstrap-tpls-0.11.2.min.js',
                      'bower_components/golden-layout/dist/goldenlayout.min.js'
                  ],
                  'dist/vendor.css': [
                      'bower_components/angular-tree-control/css/tree-control.css'
                  ]
              }
          }
        },
        less: {
            production: {
                options: {
                    paths: ['bower_components/bootstrap/less']
                },
                files: {
                    "dist/style.css": "src/less/style.less"
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-less');

    grunt.registerTask('default', ['concat', 'less']);
}
