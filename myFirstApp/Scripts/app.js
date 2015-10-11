
var TodoApp = angular.module("TodoApp", ['ngRoute', 'ngResource'])
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider.
            when('/', { controller: ListCtrl, templateUrl: 'list.html' }).
             when('/new', { controller: CreateCtrl, templateUrl: 'details.html' }).
            otherwise({ redirectTo: '/' });
       
    }])
.directive('greet', function() {
    return{
        template: '<h2> {{from}} Todo List</h2>',
        controller: function($scope, $element, $attrs) {
            $scope.from = $attrs.from;
            $scope.to = $attrs.greet;
        }
    }
});

TodoApp.factory('Todo', function($resource) {
    return $resource('/api/todo/:id', { id: '@id' }, { update: { method: 'PUT' } });
});
var CreateCtrl = function ($scope, $location, Todo) {
    $scope.save = function () {
        Todo.save($scope.todo, function () {
            $location.path('/');
        });
    };
}

var ListCtrl = function ($scope, $location, Todo) {
    $scope.search = function() {
        Todo.query({
            q: $scope.query,
            sort: $scope.sort_order,
            desc: $scope.is_desc,
            offset: $scope.offset,
            limit: $scope.limit
            },
           function (data) {
               $scope.more = data.length === 20;
            $scope.todos = $scope.todos.concat(data);
        });
    };
    $scope.sort = function (col) {
    
        if ($scope.sort_order === col) {
            $scope.is_desc = !$scope.is_desc;
        } else {
            $scope.sort_order = col;
            $scope.is_desc = false;
        }
       
        $scope.reset();

    };
    $scope.show_more = function() {
        $scope.offset += $scope.limit;

        $scope.search();
    }
    $scope.has_more= function() {
        return $scope.more;
    }

    $scope.reset = function () {
        
        $scope.limit = 20;
        $scope.offset = 0;
        $scope.todos = [];
        $scope.more = true;
        $scope.search();
    }
    $scope.delete = function() {
        var id = this.todo.Id;
        Todo.delete({ id: id }, function() {
            $('#todo_' + id).fadeOut();
        });
    }
     $scope.sort_order = "Priority";
     $scope.is_asce = false; 
     $scope.reset();
};
