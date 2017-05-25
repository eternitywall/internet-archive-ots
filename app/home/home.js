'use strict';


angular.module('myApp.home', ['ngRoute'])

.config(['$routeProvider','$httpProvider', function($routeProvider) {
  $routeProvider.when('/home', {
    templateUrl: 'home/home.html',
    controller: 'HomeCtrl'
  });
}])
    .controller('HomeCtrl', function($scope, $location) {
        $scope.input = '';

        $scope.search = function () {
            $location.path( '/search/' + $scope.input);
        };
    });