(function() {

    var app = angular.module('kairos-api', []);

    app.factory('kapi', ['$http', function ($http) {

        var kapi = {};

        //Values used for Aggregator sampling and Relative time
        kapi.units = {
            MILLISECONDS:   "Milliseconds",
            SECONDS:        "Seconds",
            MINUTES:        "Minutes",
            HOURS:          "Hours",
            DAYS:           "Days",
            WEEKS:          "Weeks",
            MONTHS:         "Months",
            YEARS:          "Years"
        };

        kapi.getMetricNames = function (successCallback, errorCallback) {

            var errorCallback = errorCallback ? errorCallback : console.log;

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

        kapi.getTags = function(query, successCallback, errorCallback) {

            var errorCallback = errorCallback ? errorCallback : console.log;

            $http
                .post("/api/v1/datapoints/query/tags", query)
                .success(function (data) {
                    if (data.queries) {
                        successCallback(data.queries);
                    } else {
                        errorCallback(data);
                    }
                })
                .error(errorCallback);
        };

        return kapi;
    }]);
})();