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

        if (state.compiler) {
            state.compiler(element.contents())(state.scope);
        }
    });


    myLayout.registerComponent('placeholderModule', function(container, state) {
        container.getElement().html('<div class="component-inner">'+state.text+'</div>');
    });


    myLayout.on( 'componentCreated', function(component){

        //hacky way to remove header from panel
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

        var query = {};

        query.setDateAbsolute = function (start_val, end_val) {
            query.start_absolute = start_val;
            query.end_absolute = end_val;
        };

        query.setDateRelative = function (start_unit, start_val, end_unit, end_val) {
            query.start_relative = {unit: start_unit, value: start_val};
            query.end_relative = {unit: end_unit, value: end_val};
        };

        return query;
    });

    app.controller('QueryBuilderController', ['$scope', 'query', function($scope, query) {

        $scope.range = {type: 'relative', start_absolute: '', end_absolute: '', start_relative_unit: ''};

        var updateDateSelection = function () {
            console.log($scope.range.type);
            if ($scope.range.type === 'absolute') {
                query.setDateAbsolute($scope.range.start_absolute, $scope.range.end_absolute);
            } else {
                query.setDateRelative($scope.range.start_relative_unit, $scope.range.start_relative_val, $scope.range.end_relative_unit, $scope.range.end_relative_value);
            }
            console.log(query);
        };

        $scope.$watch('range.start_absolute', updateDateSelection);
        $scope.$watch('range.end_absolute', updateDateSelection);

    }]);

    app.controller('MetricOptionsController', ['$scope', 'kapi', function($scope, kapi) {

        $scope.filters = [];
        $scope.tags = [];

        kapi.getTags({}, function(){

        });

        $scope.addFilter = function() {
            $scope.filters.push({"tag": "", "value": ""});
        };

        $scope.removeFilter = function(key) {
            $scope.filters.splice(key, 1);
        };

        $scope.tagValues = function(query) {
            return ['tag1']
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
                    templatePath: '/assets/src/app/kairos-ui/view/metric-options.html'
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