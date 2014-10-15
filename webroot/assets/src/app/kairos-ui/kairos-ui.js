(function() {

    var app = angular.module('kairos-ui', ['treeControl', 'kairos-api']);

    app.directive('metricGroup', function() {

        function link(scope, element, attrs) {
            element.text(element.text()+ 'foobar');
        }

        return {
            templateUrl: '/assets/src/app/kairos-ui/view/directive/metric-group.html',
            link: link
        };
    })

    app.controller('QueryBuilderController', ['$scope', 'container', 'state', function( $scope, container, state ) {

        $scope.date_range_type = 'relative';

    }]);

    app.controller('MetricOptionsController', ['$scope', 'container', 'state', function( $scope, container, state ) {
        $scope.metric = state.metric;

    }]);

    app.controller('MetricSelectionController', ['$scope', 'container', 'state', 'kapi', function( $scope, container, state, kapi) {

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

        $scope.addMetric = function(selectedMetric) {

            var newItemConfig = {
                title: selectedMetric["metric"],
                type: 'component',
                componentName: 'angularModule',
                id: selectedMetric["metric"],
                componentState: {
                    module: 'kairos-ui',
                    templatePath: '/assets/src/app/kairos-ui/view/metric-options.html',
                    metric: selectedMetric
                }
            };

            container.layoutManager.root.contentItems[0].contentItems[0].contentItems[1].addChild( newItemConfig );
        };
    }]);

    app.controller('QueryResultController', ['$scope', '$timeout', 'container', 'state', function( $scope, $timeout, container, state ) {

    }]);

    app.controller('ActionsController', ['$scope', 'container', 'state', function( $scope, container, state ) {
        $scope.runQuery = function() {

            var newItemConfig = {
                title: 'result...',
                type: 'component',
                componentName: 'angularModule',
                componentState: {
                    module: 'kairos-ui',
                    templatePath: '/assets/src/app/kairos-ui/view/query-result.html'
                }
            };

            container.layoutManager.root.contentItems[0].contentItems[1].addChild( newItemConfig );
        };
    }]);

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

        angular
            .module( state.module )
            .value( 'container', container )
            .value( 'state', state );

        angular.bootstrap( element[ 0 ], [ state.module ] );
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

    myLayout.init();
})();