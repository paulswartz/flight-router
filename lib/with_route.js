define(function(require) {
    'use strict';
    var routeHash = {},
        routeInstalled = false,
        currentStateFallback = {},
        routeRegExps = {},
        stateCounter = 0;

    var settings = require('./settings')();

    return withRoute;

    function convertRoute(route) {
        var index = 0,
            readyToRegExp = route,
            hashKeys = [],
            firstIndex = route.indexOf(':');

        if (firstIndex !== -1) {
            if (firstIndex !== 0) {
                readyToRegExp = route.slice(0, firstIndex);
            } else {
                readyToRegExp = '';
            }
            while((index = route.indexOf(':', index)) !== -1 ) {
                var routeFragment = route.slice(++index),
                    i = routeFragment.search(/\W/),
                    routeFragmentBegining = '',
                    routeFragmentLast = '';
                if (i === -1) {
                    i = routeFragment.length;
                }
                routeFragmentBegining = routeFragment.slice(0, i);
                if (routeFragment[i] !== ':') {
                    var slicer = routeFragment.indexOf(':');
                    routeFragmentLast = routeFragment.slice(routeFragmentBegining.length, slicer);
                }
                hashKeys.push(routeFragmentBegining);
                readyToRegExp += '([\\w\\sа-яА-Я\\-%@!$;]+)' + routeFragmentLast;
            }
        }
        return [new RegExp('^' + readyToRegExp.replace('?', '\\?') + '/?$'), hashKeys, route];
    }

    function listenRoutes(routes, context) {
        for (var n in routes) {
            if (routes.hasOwnProperty(n)) {
                singleRoute(n, routes[n], context);
            }
        }
    }

    function singleRoute(route, callback, context) {
        route = route.slice(1);
        if (!$.isFunction(callback)) {
            callback = context[callback];
            if (!callback) {
                throw new Error('no callback for route: ' + route);
            }
        }
        if (!routeRegExps[route]) {
            routeRegExps[route] = convertRoute(route);
        }
        if (!routeHash[route]) {
            routeHash[route] = [];
        }
        routeHash[route].push([callback, context]);
    }

    function checkRoutes(route, data) {
        var notFound = true;
        for (var n in routeHash) {
            if (routeHash.hasOwnProperty(n) && routeRegExps.hasOwnProperty(n)) {
                var regAndKeys = routeRegExps[n],
                    initialRouter = regAndKeys[2],
                    reg = regAndKeys[0],
                    keys = regAndKeys[1],
                    args = {};
                var ready = false;
                if (initialRouter === route) {
                    ready = true;
                } else if (initialRouter.length === 0) {
                    ready = false;
                } else {
                    var res = reg.exec(route);
                    if (res) {
                        ready = true;
                        res.shift();
                        for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
                            args[keys[keyIndex]] = res.shift();
                        }
                    }
                }
                if (ready) {
                    notFound = false;
                    for (var i = 0; i < routeHash[n].length; i++) {
                        var routeCallback = routeHash[n][i];
                        routeCallback[0].call(routeCallback[1], args, data);
                    }
                }
            }
        }
        if (notFound) {
            if (routeHash.hasOwnProperty('404')) {
                for (var j = 0; j < routeHash['404'].length; j++) {
                    var notFoundRouteCallback = routeHash['404'][j];
                    notFoundRouteCallback[0].call(notFoundRouteCallback[1]);
                }
            }
        }
    }

    function navigateTo(route, data, replaceState) {
        if (!settings.pushState) {
            return false;
        } else if (!replaceState) {
            window.history.pushState({
                stateCounter: ++stateCounter,
                data: data
            }, '', route);
        } else {
            window.history.replaceState({
                stateCounter: ++stateCounter,
                data: data
            }, '', route);
        }
        return true;
    }

    function getCurrentURL() {
        return document.location.pathname + document.location.search + document.location.hash;
    }

    function withRoute() {
        this.defineRoute = function(routes, callback) {
            if (arguments.length === 1) {
                listenRoutes(routes, this);
            } else {
                singleRoute(routes, callback, this);
            }
        };

        this.navigate = function(route, args) {
            var currentPath = getCurrentURL();
            if (!args) {
                args = {};
            }
            if (!args.data) {
                args.data = {};
            }
            if (!args.forced && route === currentPath) {
                return false;
            }
            if (navigateTo(route, args.data, args.replaceState)) {
                route = route.slice(1);
                checkRoutes(route, args.data);
                this.trigger(document, 'route:change', {
                    route: route,
                    data: args.data
                });
                return true;
            } else {
                document.location = route;
                return false;
            }
        };

        this.after('initialize', function() {
            if (!routeInstalled) {
                routeInstalled = true;
                if (settings.pushState) {
                    this.on(window, 'popstate', function(event) {
                        if (!stateCounter) {
                            return;
                        }
                        if (!event.originalEvent.state || event.originalEvent.state.stateCounter !== stateCounter) {
                            var path = getCurrentURL();
                            this.navigate(path, {
                                data: event.data || {},
                                forced: true,
                                replaceState: true
                            });
                        }
                    });
                }
            }
        });
    }
});