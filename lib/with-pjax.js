define('mixin/with_pjax', function() {
    'use strict';

    var isScrolling = false,
        ignorePopstate = false,
        pjaxInstalled = false,
        stateCounter = 0,
        targetIgnore = [];

    var animationDelays = {
        fade: 100,
        slide: 400
    };

    var isSupported = ('pushState' in window.history && window.history['pushState'] !== null);

    var container = '';
    var selectors = ['.pjax-scripts'];

    return withPjax;

    function findTarget(target) {
        var i;
        var toggles = document.querySelectorAll('a');

        for (; target && target !== document; target = target.parentNode) {
            for (i = toggles.length; i--;) {
                if (toggles[i] === target) {
                    return target;
                }
            }
        }
    }

    function getTarget(ev) {
        var target = findTarget(ev.target);

        if (!target ||
            skipTarget(target) === true ||
            ev.which > 1 ||
            ev.metaKey ||
            ev.ctrlKey ||
            isScrolling ||
            location.protocol !== target.protocol ||
            location.host         !== target.host ||
            !target.hash && /#/.test(target.href) ||
            target.hash && target.href.replace(target.hash, '') === location.href.replace(location.hash, '') ||
            target.getAttribute('data-ignore') === 'push' ||
            target.getAttribute('target') === '_blank') {

            return;
        }

        return target.pathname + target.search + target.hash;
    }

    function skipTarget(target) {
        if (!target) return true;

        for (var i = 0; i < targetIgnore.length; i++) {
            var parts = targetIgnore[i].split(':');

            if (parts[1] && target.attributes[parts[0]] === parts[1]) {
                return true;
            }
            else if (target.attributes[parts[0]]) {
                return true;
            }
        }

        return false;
    }

    function navigateTo(url, replaceState) {
        if (!isSupported || url === getCurrentURL()) return false;

        if (replaceState === true) {
            window.history.replaceState({
                stateCounter: ++stateCounter,
                data: {}
            }, '', url);
        }
        else {
            window.history.pushState({
                stateCounter: ++stateCounter,
                data: {}
            }, '', url);
        }

        $(document).trigger('pjax:change', {
            url: url,
            data: {}
        });
    }

    function getCurrentURL() {
        return document.location.pathname + document.location.search + document.location.hash;
    }


    // Main XHR handlers
    // =================

    function success(response, options) {
        var key, barElement;
        var data = parseXHR(response);

        // No content
        if (! data.contents) {
            window.history.replaceState(null, '', '#');
            window.location.replace(options.url);
            return;
        }

        // Change URL
        navigateTo(options.url, options.replaceState);

        if (data.title) {
            document.title = data.title;
        }

        // Trigger page unload event
        $(window).trigger('unload');

        if (options.transition) {
            for (key in selectors) {
                barElement = document.querySelector(selectors[key]);

                if (data[selectors[key]]) {
                    swapContent(data[selectors[key]], barElement);
                }
                else if (barElement) {
                    barElement.parentNode.removeChild(barElement);
                }
            }
        }

        swapContent(data.contents, document.querySelector(container), options.transition, function () {
            triggerStateChange();
        });

        // Track page view in Google Analytics
        if (!options.ignorePush && 'undefined' !== typeof ga) {
            ga('send', 'pageview');
        }
    }

    // PUSH helpers
    // ============

    function extendWithDom(obj, fragment, dom) {
        var i, key;
        var result = {};

        for (i in obj) {
            if (obj.hasOwnProperty(i)) {
                result[i] = obj[i];
            }
        }

        for (key in selectors) {
            var el = dom.querySelector(selectors[key]);
            if (el) el.parentNode.removeChild(el);
            result[selectors[key]] = el;
        }

        result.contents = dom.querySelector(fragment);

        return result;
    }

    function swapContent(swap, container, transition, complete) {
        var enter;
        var containerDirection;
        var swapDirection;

        if (!transition) {

            if (container) {
                container.innerHTML = swap.innerHTML;
            }
            else if (swap.classList.contains(container)) {
                document.body.appendChild(swap);
            }
            else {
                document.body.insertBefore(swap, document.querySelector(container));
            }

            complete && complete();
        }
        else {
            enter = /in$/.test(transition);

            container.classList.add('pushing-out');
            swap.classList.add('pushing-in');

            if (transition === 'fade') {
                container.classList.add('in');
                container.classList.add('fade');
                swap.classList.add('fade');
            }

            if (/slide/.test(transition)) {
                swap.classList.add('sliding-in', enter ? 'right' : 'left');
                swap.classList.add('sliding');
                container.classList.add('sliding');
            }

            container.parentNode.insertBefore(swap, container);

            if (transition === 'fade') {
                container.offsetWidth; // force re-flow
                container.classList.remove('in');

                var fadeContainerEnd = function () {
                    swap.classList.add('in');
                    setTimeout(fadeSwapEnd, animationDelays.fade);
                };

                var fadeSwapEnd = function () {
                    container.parentNode.removeChild(container);
                    swap.classList.remove('fade');
                    swap.classList.remove('in');
                    swap.classList.remove('pushing-in');
                    complete && complete();
                };

                setTimeout(fadeContainerEnd, animationDelays.fade);
            }

            if (/slide/.test(transition)) {
                var slideEnd = function () {
                    swap.classList.remove('sliding', 'sliding-in');
                    swap.classList.remove(swapDirection);
                    swap.classList.remove('pushing-in');
                    container.parentNode.removeChild(container);
                    complete && complete();
                };

                container.offsetWidth; // force re-flow
                swapDirection = enter ? 'right' : 'left';
                containerDirection = enter ? 'left' : 'right';
                container.classList.add(containerDirection);
                swap.classList.remove(swapDirection);
                setTimeout(slideEnd, animationDelays.slide);
            }
        }
    }

    function parseXHR(response) {
        var head, body, data = {};

        if (!response) {
            return data;
        }

        if (/<html/i.test(response)) {
            head = document.createElement('div');
            body = document.createElement('div');
            head.innerHTML = response.match(/<head[^>]*>([\s\S.]*)<\/head>/i)[0];
            body.innerHTML = response.match(/<body[^>]*>([\s\S.]*)<\/body>/i)[0];
        } else {
            head = body = document.createElement('div');
            head.innerHTML = response;
        }

        data.title = head.querySelector('title');
        var text = 'innerText' in data.title ? 'innerText' : 'textContent';
        data.title = data.title && data.title[text].trim();

        data = extendWithDom(data, container, body);

        return data;
    }

    function triggerStateChange() {
        var scripts = [],
            anchor = getCurrentURL().match(/#(.+)/i);

        // Move to anchor
        if (anchor && document.getElementById(anchor[1])) {
            document.getElementById(anchor[1]).scrollIntoView();
        }

        // Eval dynamic scripts
        $('.pjax-scripts script').each(function() {
            if (this.src) {
                scripts.push(this.src);
            }
            else {
                $.globalEval(this.innerHTML);
            }
        });

        // Total scripts
        var total = scripts.length;

        // Nothing to process
        if (total === 0) return $(window).trigger('load');

        // Process scripts
        $.each(scripts, function(i, script) {
            $.getScript(script, function () {
                total--;
                if (total === 0) {
                    $(window).trigger('load');
                }
            });
        });
    }


    // With Pjax Mixin
    // ================

    function withPjax() {
        this.attributes({
            ignorePopstate: false,
            defaultAnimation: 'slide-in',
            container: '.content-wrapper',
            ignore: [],
            selectors: []
        });

        this.after('initialize', function() {
            if (!pjaxInstalled && isSupported) {
                var that = this;

                // Set global ignore
                targetIgnore = this.attr.ignore;

                // Prevent duplicate bindings
                pjaxInstalled = true;

                // Set global variables
                container = this.attr.container;
                selectors = $.merge(selectors, this.attr.selectors);

                // Popstate event binding - delayed to fix bug on some browsers
                setTimeout(function () {
                    that.on(window, 'popstate', function (ev) {
                        ev && ev.preventDefault();

                        if (ignorePopstate === false) {
                            var path = getCurrentURL();

                            that.loadPage(path, {
                                forced: true,
                                replaceState: true
                            });
                        }
                    });
                }, 500);

                // Mobile device scrolling
                $(window).on('touchstart', function () {
                    isScrolling = false;
                });
                $(window).on('touchmove', function () {
                    isScrolling = true;
                });
            }
        });

        this.getCurrentURL = function() {
            return getCurrentURL();
        };

        this.nodeClicked = function(ev) {
            var url = getTarget(ev);

            if (!isSupported || !url) return;

            ev && ev.preventDefault();

            this.loadPage(url, {
                transition: ev.target.getAttribute('data-transition') || this.attr.defaultAnimation
            });
        };

        this.loadPage = function(url, options) {
            var that = this,
                currentPath = getCurrentURL();

            options = $.extend({
                url: url,
                forced: false,
                replaceState: false,
                transition: this.attr.defaultAnimation
            }, options);

            // Ignore same page loads
            if (!options.forced && url === currentPath) return false;

            // Popstate is fired with anchors, so ignore them
            if (options.forced && url === currentPath && url.indexOf('#') > -1) return false;

            this.trigger('pjax:loading', {
                url: url
            });

            // Request page
            $.ajax({
                headers: {
                    'X-PJAX': true,
                    'X-PJAX-CONTAINER': container + ',' + selectors.join(',')
                },
                url: url,
                complete: function() {
                    that.trigger('pjax:complete', {
                        url: url
                    });
                },
                success: function(response) {
                    success(response, options);

                    that.trigger('pjax:success', {
                        url: url
                    });
                },
                error: function (url) {
                    that.trigger('pjax:error', {
                        url: url
                    });
                }
            });
        };

        this.navigate = function(url, replaceState) {
            navigateTo(url, replaceState);
        };

        this.enablePopstate = function() {
            ignorePopstate = false;
        };

        this.disablePopstate = function() {
            ignorePopstate = true;
        };

        this.replaceParams = function(params) {
            var url = getCurrentURL();

            $.each(params, function(index, value) {
                var pattern = new RegExp('('+index+'=).*?(&|$)');
                if(url.search(pattern) >= 0 ){
                    url = url.replace(pattern,'$1' + value + '$2');
                }
                else {
                    url = url + (url.indexOf('?')>0 ? '&' : '?') + index + '=' + value
                }
            });

            return this.navigate(url, true);
        };
    }
});