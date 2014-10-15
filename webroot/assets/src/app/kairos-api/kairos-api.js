(function() {

    var app = angular.module('kairos-api', []);

    app.factory('kapi', ['$http', function ($http) {

        var kapi = {};

        kapi.getMetricNames = function (successCallback, errorCallback) {

            errorCallback = errorCallback ? errorCallback : console.log;

            $http
                .get("/api/v1/metricnames")
                .success(function (data) {
                    if (data.results) {
                        successCallback(data.results);
                    } else {
                        errorCallback(data);
                    }
                })
                .error(errorCallback);
        };

        return kapi;
    }]);
})();