(function() {

    //----------------------------------------------------------------------------------------------------------------
    // Layout Manager
    //----------------------------------------------------------------------------------------------------------------
    var myLayout = new GoldenLayout({
        settings: {

        },
        content:[{
            type: 'row',
            content: [{
                type: 'column',
                isClosable: false,
                width: 20,
                content: [{
                    type: 'stack',
                    isClosable: false,
                    id: 'query-builder',
                    content: [{
                        title: 'Range',
                        type: 'component',
                        isClosable: false,
                        componentName: 'angularModule',
                        componentState: {
                            module: 'kairos-ui',
                            templatePath: '/assets/src/app/kairos-ui/view/date-selector.html'
                        }
                    },{
                        title: 'Metrics',
                        type: 'component',
                        isClosable: false,
                        componentName: 'angularModule',
                        componentState: {
                            module: 'kairos-ui',
                            templatePath: '/assets/src/app/kairos-ui/view/metric-selector.html'
                        }
                    }]
                },{
                    type: 'stack',
                    isClosable: false,
                    content: []
                },{
                    title: 'Actions',
                    type: 'component',
                    isClosable: false,
                    componentName: 'angularModule',
                    height: 15,
                    id: 'actions-panel',
                    componentState: {
                        module: 'kairos-ui',
                        templatePath: '/assets/src/app/kairos-ui/view/actions.html'
                    }
                }]
            },{
                type: 'stack',
                isClosable: false,
                content: [{
                    title: 'Help',
                    type: 'component',
                    isClosable: false,
                    componentName: 'placeholderModule',
                    componentState: {
                        text: 'help text'
                    }
                }]
            }]
        }]
    });

    myLayout.registerComponent('angularModule', function(container, state) {

        var element = container.getElement();
        element.html('<div ng-include="\'' + state.templatePath + '\'"></div>');

        /**
         * The method used in the golden layout docs is problematic because it seems to bootstrap a new instance of the
         * module for each panel making sharing data between panels difficult. This method is a bit hacky but allows
         * angular to work as expected.
         */
        if (state.compiler && state.scope) {

            /**
             * a new scope is created for the panel using the controller that created the panel as the parent scope.
             * Also the state and container is added to the new scope.
             */
            var panelScope = state.scope.$new(false, state.scope);
            panelScope.state = state;
            panelScope.container = container;

            state.compiler(element.contents())(panelScope);
        }
    });

    myLayout.registerComponent('placeholderModule', function(container, state) {
        container.getElement().html('<div class="component-inner">'+state.text+'</div>');
    });

    myLayout.on( 'componentCreated', function(component){
        //remove header from actions panel
        if (component.config.id === 'actions-panel') {
            component.parent.header.element.hide();
        }
    });

    // ---------------------------------------------------------------------------------------------------------------
    // Angular Appliction
    // ---------------------------------------------------------------------------------------------------------------

    var app = angular.module('kairos-ui', ['treeControl', 'kairos-api', 'ui.bootstrap']);

    app.directive('metricGroup', function() {

        function link(scope, element, attrs) {
            element.text(element.text()+ 'foobar');
        }

        return {
            templateUrl: '/assets/src/app/kairos-ui/view/directive/metric-group.html',
            link: link
        };
    })

    app.service('query', function() {

        var query = {
            metrics: []
        };

        query.setDateAbsolute = function (start_val, end_val) {
            this.start_absolute = start_val;
            this.end_absolute = end_val;
        };

        query.setDateRelative = function (start_relative, end_relative) {
            this.start_relative = start_relative;
            this.end_relative = end_relative;
        };

        query.addMetric = function (metricName) {
            this.metrics.push(
                {tags: {}, name: metricName}
            );
        };

        query.copy = function () {
            return angular.copy(query);
        }

        return query;
    });

    app.controller('DateSelectController', ['$scope', 'kapi', 'query', function($scope, kapi, query) {

        $scope.range = {
            type: 'relative',
            start_absolute: null,
            end_absolute: null,
            start_relative: {unit: 'HOURS', value: 2},
            end_relative: {unit: 'HOURS', value: 1}
        };

        $scope.units = kapi.units;

        var updateDateSelection = function () {
            if ($scope.range.type === 'absolute') {
                query.setDateAbsolute($scope.range.start_absolute, $scope.range.end_absolute);
            } else {
                query.setDateRelative($scope.range.start_relative, $scope.range.end_relative);
            }
        };

        $scope.$watch('range', updateDateSelection, true);
    }]);

    app.controller('MetricOptionsController', ['$scope', 'kapi', 'query', function($scope, kapi, query) {

        $scope.tags = {};
        $scope.filters = [];
        $scope.groupings = [];
        $scope.aggregations = [];

        //get the tags
        var panelQuery = query.copy();
        panelQuery.addMetric($scope.state.metric);

        kapi.getTags(panelQuery, function (queries) {
            angular.forEach(queries, function (query) {
                angular.forEach(query['results'], function (result){
                    angular.forEach(result['tags'], function (values, name){
                        $scope.tags[name]  = $scope.tags[name] ? $scope.tags[name].concat(values) : values;
                    });
                });
            });
        });

        $scope.addFilter = function () {
            $scope.filters.push({"tag": null, "value": null});
        };
        $scope.removeFilter = function( key) {
            $scope.filters.splice(key, 1);
        };

        $scope.tagValues = function(filter, query) {

            if (!$scope.tags[filter.tag]) {
                return [];
            }

            if (query === '*') {
                return $scope.tags[filter.tag];
            }

            var filtered = [];
            var queryLower = query.toLowerCase();
            angular.forEach($scope.tags[filter.tag], function(item) {
                if( item.toLowerCase().indexOf(queryLower) >= 0 ) filtered.push(item);
            });

            return filtered;
        };
    }]);

    app.controller('MetricSelectionController', ['$scope', '$compile', 'kapi', 'query', function($scope, $compile,  kapi, query) {

        $scope.metricTree = [];

        kapi.getMetricNames(function(data) {

            /**
             * This will convert dot separated metric names into a tree structure suitable for ng-tree
             */

            var root = {label: 'root', metric: '', children: []};

            angular.forEach(data, function(metric) {

                var parent = root;
                var levelText = metric.split('.').reverse();

                while (levelText.length > 0) {

                    var child = {label: levelText.pop(), metric: (levelText.length !== 1) ? metric : '', children: []};

                    var append = true;
                    angular.forEach(parent.children, function (existingChild, key) {
                        if (existingChild.label === child.label) {
                            //replace active child with existing if duplicate found
                            child = parent.children[key];
                            append = false;
                        }
                    });

                    //no existing child was found so append a new one
                    if (append) {
                        parent.children.push(child);
                    }

                    parent = child;
                }
            });

            //don't include the root node
            $scope.metricTree = root.children;
        });

        $scope.treeOptions = {
            nodeChildren: "children",
            dirSelectable: false
        }

        $scope.metricTreeFilter = '';

        $scope.addMetric = function (selectedMetric) {

            var newItemConfig = {
                title: selectedMetric["metric"],
                type: 'component',
                componentName: 'angularModule',
                componentState: {
                    compiler: $compile,
                    scope: $scope,
                    templatePath: '/assets/src/app/kairos-ui/view/metric-options.html',
                    metric: selectedMetric["metric"]
                }
            };

            myLayout.root.contentItems[0].contentItems[0].contentItems[1].addChild(newItemConfig);
        };
    }]);

    app.controller('QueryResultController', ['$scope', function( $scope) {

    }]);

    app.controller('ActionsController', ['$scope', 'query', function( $scope, query ) {
        $scope.runQuery = function() {

            var newItemConfig = {
                title: 'result...',
                type: 'component',
                componentName: 'angularModule',
                componentState: {
                    module: 'kairos-ui',
                    templatePath: '/assets/src/app/kairos-ui/view/query-result.html',
                    query: query.exportQuery()
                }
            };

            myLayout.root.contentItems[0].contentItems[1].addChild(newItemConfig);
        };
    }]);

    myLayout.on( 'initialised', function(){
        angular.bootstrap( document.body, [ 'kairos-ui' ]);
    });

    myLayout.init();
})();