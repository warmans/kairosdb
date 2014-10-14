(function() {

    var app = angular.module('kairosdb', ['treeControl']);

    app.directive('metricGroup', function() {

        function link(scope, element, attrs) {
            element.text(element.text()+ 'foobar');
        }

        return {
            templateUrl: '/assets/src/app/view/directive/metric-group.html',
            link: link
        };
    })

    app.controller('QueryBuilderController', ['$scope', '$timeout', 'container', 'state', function( $scope, $timeout, container, state ) {

        $scope.date_range_type = 'relative';

    }]);

    app.controller('MetricOptionsController', ['$scope', '$timeout', 'container', 'state', function( $scope, $timeout, container, state ) {
        $scope.metric = state.metric;

    }]);

    app.controller('MetricSelectionController', ['$scope', '$timeout', 'container', 'state', function( $scope, $timeout, container, state ) {

        $scope.treeOptions = {
            nodeChildren: "children",
            dirSelectable: true,
            injectClasses: {
                ul: "a1",
                li: "a2",
                liSelected: "a7",
                iExpanded: "a3",
                iCollapsed: "a4",
                iLeaf: "a5",
                label: "a6",
                labelSelected: "a8"
            }
        }

        $scope.metricTree = [
            { "label" : "some", metric: "", "hidden": false, "children" : [
                {"label": "metric", "metric" : "some.metric", "children" : []},
                {"label": "other", metric: "", "children" : [
                    {"label": "metric", "metric" : "some.other.metric", "children": []}
                ]}
            ]}
        ];

        $scope.metricTreeFilter = '';

        $scope.addMetric = function(selectedMetric) {

            var newItemConfig = {
                title: selectedMetric["metric"],
                type: 'component',
                componentName: 'angularModule',
                id: selectedMetric["metric"],
                componentState: {
                    module: 'kairosdb',
                    templatePath: '/assets/src/app/view/metric-options.html',
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
                    module: 'kairosdb',
                    templatePath: '/assets/src/app/view/query-result.html'
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
                            module: 'kairosdb',
                            templatePath: '/assets/src/app/view/date-selector.html'
                        }
                    },{
                        title: 'Metrics',
                        type: 'component',
                        isClosable: false,
                        componentName: 'angularModule',
                        componentState: {
                            module: 'kairosdb',
                            templatePath: '/assets/src/app/view/metric-selector.html'
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
                        module: 'kairosdb',
                        templatePath: '/assets/src/app/view/actions.html'
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