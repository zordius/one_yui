/*
oneYUI 0.0.6
Copyright 2011 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/
/**
 * The oneYUI performance tool can help yui3 developer measure yui3
 * add/use time. When a page include one_yui.js without any config, 
 * this tool will mimic 'only create one Y instance for this page' 
 * behavior in IE6/7 to reduce performance impact.
 *
 * You should include one_yui.js just after the yui-min.js:
 *
 *     <script src="http://yui.yahooapis.com/3.4.1/build/yui/yui-min.js"></script>
 *     <script src="{{somewhere}}/one_yui3.js"></script>
 *
 * Or just after all yui related combo javascript files:
 *
 *     <script src="http://yui.yahooapis.com/combo?3.4.1...."></script>
 *     <script src="{{somewhere}}/one_yui3.js"></script>
 *
 * To configure oneYUI, use oneyui_cfg global variable:
 *
 *     var oneyui_cfg = {
 *         start: (new Date()).getTime(), // enable page loaded time detection. Put oneyui_cfg just after <head> to get most accurate number.
 *         auto: false,                   // default: true, set to false will disable oneYUI unless IE 6/7
 *         enable_sandbox: true,          // default: false, set to true will keep YUI3 sandbox function. When true, you can not get any performance improvement.
 *         enable_report: 1,              // default: false, set to a positive number will enable oneYUI measuring and reporting function. enable_report = 1 generat normal report; enable_report = 2 will generate detailed report, but may cause yui3 operations slow down.
 *         detect_static: false,          // default: false, set to true will detect static files to generate better js/css report
 *         skip_use: false,               // default: false, set to true will skip YUI().use() callback, this can help you to measure basic page download time without your js functions.
 *         skip_add: false,               // default: false, set to true will skip all YUI() functions, this can help you to measure basic page download time without any yui functions. if skip_add is true, YUI().use() will be skipped, too.
 *         auto_test: 0,                  // default: 0, set to N will run automatic test N times. When you run automaic test, please stop all background tasks, and do not touch your computer.
 *         warm_up: 300,                  // default: 300, set to N will drop test result if last test is done before N seconds. Set N = 0 will disable auto refresh, it's good to do IE 6/7 semi-auto testing.
 *         clean_cache: false             // default: false, set to true will clean browser cache when running auto test.
 *     };
 *
 * To see the report, input this on browser url bar or create a bookmarklet:
 *
 *     javascript:YUI.show_report()
 *
 * To know the improvement of oneYUI, you can follow these steps:
 *
 * 1. use enable_sandbox: true , enable_report: true , generate report1 in IE6
 * 2. use enable_sandbox: false , enable_report: true , generate report2 in IE6
 * 3. compare report1 with report2
 * 4. use enable_sandbox: true , enable_report: true , generate report3 in IE7
 * 5. use enable_sandbox: false , enable_report: true , generate report4 in IE7
 * 6. compare report3 with report4
 *
 * oneYUI replaced YUI , wraps YUI() , YUI.add , YUI().use and Y.instanceOf
 * to measuring yui3 operation time. The 'one Y instance' or wrapped operations
 * may break original yui3 function. If you found any bugs happened only with
 * oneYUI, please post a bug to us.
 *
 * @module oneyui
 * @submodule oneyui
 */

(function () {
    if (! window) {
        throw new Error('We only support YUI3 in browser mode');
    }

    if (! window.YUI) {
        window.alert('YUI 3 should loaded before onyui3.js !');
        return;
    }

    if (! window.oneyui_cfg) {
        window.oneyui_cfg = {};
    }

    if (! navigator.userAgent.match(/MSIE [1-8]/) && window.oneyui_cfg.auto) {
        return;
    }

    var start0 = (new Date()).getTime(),
        start = window.oneyui_cfg.start ? window.oneyui_cfg.start : (new Date(document.lastModified)).getTime(),

        cfg = {
            enable_sandbox: window.oneyui_cfg.enable_sandbox ? true : false,
            enable_report: window.oneyui_cfg.enable_report ? window.oneyui_cfg.enable_report : false,
            detect_static: window.oneyui_cfg.detect_static ? true : false,
            skip_use: window.oneyui_cfg.skip_use ? true : false,
            skip_add: window.oneyui_cfg.skip_add ? true : false,
            auto_test: window.oneyui_cfg.auto_test ? window.oneyui_cfg.auto_test * 1 : 0,
            warm_up: window.oneyui_cfg.warm_up ? window.oneyui_cfg.warm_up * 1 : 300,
            clean_cache: window.oneyui_cfg.clean_cache ? true : false
        },

        oldYUI = YUI,
        old_add = YUI.add,

        Y = oldYUI(),
        old_instanceOf = Y.instanceOf,
        old_functionString = Function.prototype.toString,

        reports = {
            use: ['node', 'event'],
            time: [],
            brief: [],
            storage: 0,
            modules: {
                'begin page': {length: 0},
                'page oyui': {length: 0},
                page: {length: 0},
                begin_instance: {length: 0},
                end_instance: {length: 0},
                begin_add: {length: 0},
                end_add: {length: 0},
                begin_use: {length: 0},
                end_use: {length: 0},
                begin_run: {length: 0},
                end_run: {length: 0}
            },
            statics: {
                url: {},
                js: 0,
                css: 0,
                inline: 0
            },
            combo: {
                js: [],
                css: []
            },
            follow: {
                end_instance: 'begin_instance',
                begin_use: 'end_instance',
                end_use: 'begin_use',
                begin_run: 'end_use',
                end_run: 'begin_run',
                end_add: 'begin_add'
            },
            follow_again: {
                begin_run: 'begin_use'
            },

            detect_statics: function () {
                if (! cfg.detect_static) {
                    return;
                }

                var S = document.getElementsByTagName('script'), I,
                    D = this.statics.js ? true : false;

                for (I = 0;I < S.length;I++) {
                    if (S[I].src) {
                        if (! D) {
                            this.statics.url[S[I].src] = 1;
                            this.statics.js ++;
                        }
                    } else {
                        this.statics.inline ++;
                    }
                }

                S = document.getElementsByTagName('link');
                for (I = 0;I < S.length;I++) {
                    if (S[I].href) {
                        this.statics.url[S[I].href] = 1;
                        this.statics.css ++;
                    }
                }
            },
            trace: function () {
                var stack;
                try {
                    window.never.exists.error();
                } catch (E) {
                    if (E.stack) {
                        stack = E.stack.replace(/\n$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('\n').pop();
                    }
                }

                return (stack && ! stack.match(/yahooapi/)) ? ('<p>' + stack + '</p>').replace(/(>[^<>]{25})[^<>]{5,}([^<>]{25}<)/gm, '$1 ... $2') : '';
            },
            add: function (T, N, id) {
                if (! cfg.enable_report) {
                    return;
                }

                if ((cfg.enable_report === 2) && T.match(/end_instance|begin_use|end_add/)) {
                    N += this.trace();
                }

                var now = (new Date()).getTime() - start,
                    I = T.match(/instance/) ? id : this.modules[T].length,
                    F = reports.follow[T],
                    F2 = reports.follow_again[T],
                    P = F ? reports.modules[F][(T === 'begin_use') ? id : I] : null;

                P = P ? P : (F2 ? reports.modules[F2][I] : null);

                this.modules[T].length++;
                this.modules[T][I] = [
                    P ? now - P[1] : now,
                    now,
                    T,
                    N,
                    id ? id : 'global',
                    []
                ];

                if (T.match(/begin_instance|begin_add|page/)) {
                    this.time.push(this.modules[T][I]);
                    if (T.match(/page/)) {
                        this.brief.push([now, N]);
                    }
                }

                if (P) {
                    P[5].push(this.modules[T][I]);
                }
            },
            print: function (D, A) {
                var I, O = [];
                if (A) {
                    for (I = 0;I < D.length;I++) {
                        O.push(reports.print(D[I]));
                    }
                    return O.join('');
                }
                return '<div class="' + D[2] + '"><span class="t" style="width:' + (D[0] / 10) + 'px"></span><span>' + D[1] + (D[0] ? '(+' + D[0] + ')' : '') + 'ms: [' + D[2] + '-' + D[4] + '] ' + D[3] + reports.print(D[5], 1) + '</span></div>';
            },
            print_jscss: function (S, J) {
                var U;

                if ((J && ! S.src) || (! J && ! S.href)) {
                    return '<i class="i">(inline)</i>';
                }
                U = S.src ? S.src : S.href;
                if (U.match(/\/combo\?/)) {
                    if (! this.statics.url[U]) {
                        this.combo[J ? 'js' : 'css'].push(J ? '<script src="' + U + '"></script>' : '<link rel="stylesheet" type="text/css" href="' + U + '">');
                    }
                    return '<i class="c' + (this.statics.url[U] ? ' s' : '') + '">(combo ' + U.match(/\?|&/g).length + ')' + U + '</i>';
                }
                return '<i' + (this.statics.url[U] ? ' class="s"' : '') + '>' + U + '</i>';
            },
            print_config: function () {
                var out = [], I;
                for (I in cfg) {
                    out.push(I + ': ' + cfg[I]);
                }
                return out.join(', ');
            },
            clear_all: function () {
                var C = Y.one('.oyreport');

                C.append('<a href="#" class="clear_all">Clear all results (click here to start another tests)</a>');
                C.one('a.clear_all').on('click', Y.StorageLite.clear);
            },
            show_tests: function () {
                var I = 0, J,
                    N = Y.StorageLite.getItem('testNum'),
                    D,
                    C = Y.one('.oyreport'),
                    avg = {},
                    avgkeys = [],
                    out = [];

                out.push('<table><thead><tr><th>-</th>');
                for (;I < N;I++) {
                    D = Y.StorageLite.getItem('testData' + I, true);
                    for (J in D) {
                        if (! avg[D[J][1]]) {
                            avg[D[J][1]] = [];
                            avgkeys.push(D[J][1]);
                            out.push('<th>' + D[J][1] + '</th>');
                        }
                        avg[D[J][1]].push(D[J][0]);
                    }
                }

                out.push('</tr></thead><tbody>');
                for (I in avg[avgkeys[0]]) {
                    out.push('<tr><th>Round ' + (1 + I * 1) + '</th>');
                    for (J in avgkeys) {
                        out.push('<td>' + avg[avgkeys[J]][I] + '</td>');
                    }
                    out.push('</tr>');
                }
               
                out.push('</tbody><tfoot><tr><th>average</th>');
                for (J in avgkeys) {
                    D = 0;
                    for (I in avg[avgkeys[0]]) {
                        D += avg[avgkeys[J]][I];
                    }
                    out.push('<td>' + Math.floor(100 * D / avg[avgkeys[0]].length) / 100 + '</td>');
                }
                for (I in avg) {
                    D = 0;
                    avg[I].sort();

                    while (avg[I].length > 0.6 * cfg.auto_test) {
                        avg[I].pop();
                        avg[I].shift();
                    }
                }
                out.push('</tr><tr><th>top 20% last 20%<br>dropped average</th>');
                for (J in avgkeys) {
                    D = 0;
                    for (I in avg[avgkeys[0]]) {
                        D += avg[avgkeys[J]][I];
                    }
                    out.push('<td>' + Math.floor(100 * D / avg[avgkeys[0]].length) / 100 + '</td>');
                }
                out.push('</tr></tfoot></table>');

                C.append('<h3>Statistics</h3>' + out.join(''));
                C.append('<h3>CSV for copy/paste</h3><textarea>' + out.join('').replace(/<.?table>|<.?tbody>|<.?thead>|<.?tfoot>|<tr>/g, '').replace(/<th>(.+?)<\/th>/g, '"$1",').replace(/<td>(.+?)<\/td>/g, '$1, ').replace(/, <\/tr>/g, '\n').replace('<br>', ' ') + '</textarea>');
                reports.clear_all();
            },
            _do_next_test: function () {
                if (cfg.clean_cache) {
                    location.refresh(true);
                } else {
                    location.href = location.href.replace(/#.*/, '');
                }
            },
            next_test: function () {
                if (! cfg.warm_up) {
                    Y.one('.oyreport').append('<h3>Semi auto test mode: restart your browser, load this page again.</h3>');
                    reports.clear_all();
                    return;
                }
                Y.one('.oyreport').append('<p>Now wait 5 seconds to start next test...(will ' + (cfg.clean_cache ? 'clean cache' : 'keep cache') + ')</p>');
                reports.clear_all();

                window.setTimeout(reports._do_next_test, 5000);
            },
            show_brief: function () {
                var I,
                    out = [];

                for (I in this.brief) {
                    out.push(this.brief[I][1] + ':' + this.brief[I][0] +'ms');
                }
                return out.join('; ');
            },
            store_test_data: function () {
                var N = Y.StorageLite.getItem('testNum') || 0,
                    I = 'testData' + N,
                    P = Y.StorageLite.getItem('testTime') || 0,
                    now = (new Date()).getTime(),
                    diffTime = (now - P) / 1000,
                    C = Y.one('.oyreport');

                reports.storage = 1;

                if (N >= cfg.auto_test) {
                    reports.show_tests();
                    return;
                }

                C.append('<p>(' + N + '/' + cfg.auto_test + ' tests done)</p>');
                C.append('<p>' + reports.show_brief() + '</p>');
                if ((cfg.warm_up == 0) || (diffTime < cfg.warm_up)) {
                    if (N < cfg.auto_test) {
                        Y.StorageLite.setItem(I, reports.brief, true);
                        N++;
                        Y.StorageLite.setItem('testNum', N);
                        C.append('<p>' + N + 'th round result stored.</p>');
                    }
                } else {
                    C.append('<p>Drop this test result because this test should be a warm up test (time diff = ' + Math.floor(diffTime) + ' seconds)</p>');
                }

                Y.StorageLite.setItem('testTime', now);
                reports.next_test();
            },
            advance_features: function (Y) {
                Y.StorageLite.on('storage-lite:ready', reports.store_test_data);
            },
            show: function () {
                var I = 0,
                    M = reports.modules,
                    C = document.createElement('div'),
                    S = document.createElement('style'),
                    out = [],
                    css = 'select,input,iframe{*visibility:hidden!important}.oyreport{position:absolute;top:0;left:0;padding:40px;background:#eee;text-align:left;z-index:999999}.oyreport div{border-left:1px solid #ddd;white-space:nowrap;font-size:13px}.oyreport div.begin_instance{border-color:#444;margin:10px 0}.oyreport div.end_instance{border-color:#edd}.oyreport span,.oyreport li{display:inline-block;zoom:1;*display:inline}.oyreport span.t{height:20px;overflow:hidden;padding:0 0 0 1px;vertical-align:top}.oyreport .page{font-size:16px;color:#800;font-weight:900;white-space:normal}.oyreport .page span.t{background:#c00;height:10px;vertical-top:middle;margin:3px 10px 0 0}.oyreport .oyui{border-color:#00f}.oyreport .begin{color:#f00;border:0}.oyreport .begin span{vertical-align:bottom;position:relative;border-left:1px solid #00f;width:300px;padding:10px}.oyreport .begin span.t{border:0;margin:0;border-bottom:1px solid #00f;background:#eee;border-top:20px solid #f00;padding:15px 0}.oyreport .end_instance span.t{background:#b88}.oyreport .begin_use span.t,.oyreport .begin_add span.t{background:#bab;height:10px;margin-top:10px}.oyreport .end_use span.t{background:#bb8;height:20px;margin:0}.oyreport .begin_run span.t{background:#eee}.oyreport .end_run span.t{background:#8b8}.oyreport ol{margin:10px 0 0;padding:10px 0 0;border-top:1px dotted #666}.oyreport li{margin:0 4px 1px;border-left:5px solid #666;padding:0 2px;cursor:pointer}.oyreport li:hover{background:#ffd}.oyreport li.hi{background:#fcc}.oyreport i.i{color:#448}.oyreport i.s{opacity:0.5;font-style:normal;zoom:1;filter:alpha(opacity=50,style=0)}.oyreport i.c{color:#282}.oyreport h3{font-size:20px;font-weight:900;margin:10px 0}.oyreport p{padding:5px;background:#eed}.oyreport span p{width:360px;text-align:right}.oyreport textarea{width:800px;height:100px;overflow-y:scroll}.oyreport th{font-weight:900;text-align:center;background:#ddf}.oyreport td{text-align:right;background:#fff}.oyreport th,.oyreport td{border:1px solid #eee;padding:2px 5px}.oyreport tfoot td{background:#ffe}.oyreport a.clear_all{display:block;margin:60px 0 0;font-size:16px;font-weight:900;color:#f00;text-align:right}';

                YUI.show_report = function () {};

                S.setAttribute('type', 'text/css');
                document.getElementsByTagName('head')[0].appendChild(S);
                if (S.styleSheet) {
                    S.styleSheet.cssText = css;
                } else {
                    S.innerHTML = css;
                }

                out.push('<p>oneYUI 0.0.6 - report generated @ ' + (new Date()) + ' , browser:' + navigator.userAgent + '</p>');
                if (! window.oneyui_cfg.start) {
                    out.push('<h3>Put oneyui_cfg = {start: (new Date()).getTime()} after <head> can help you get accurate page loaded time.</h3>');
                }

                out.push('<h3>oneYUI configs</h3>' + reports.print_config());
                out.push('<h3>Timeline chart</h3>');

                out.push(reports.print(reports.time, 1));
                out.push('<b>instance:' + M.begin_instance.length + ', add:' + M.begin_add.length + ', use:' + M.begin_use.length + ', run:' + M.begin_run.length + '</b><ol>');

                S = 0;
                for (I in YUI.Env.mods) {
                    S++;
                    out.push('<li' + ((YUI.Env.mods[I].version === YUI.version) ? '' : ' class="hi"') + '><b>MODULE ' + S + '.</b>' + I + '-' + YUI.Env.mods[I].version + '</li>');
                }

                out.push('</ol><ol>');

                S = document.getElementsByTagName('script');
                M = 0;
                for (I = S.length - 1;I > 0;I--) {
                    if (! S[I].src) {
                        M = I;
                    } else {
                        if (M) {
                            if (reports.statics.url[S[I].src]) {
                                break;
                            } else {
                                reports.statics.url[S[I].src] = 2;
                            }
                        }
                    }
                }
                for (I = 0;I < S.length;I++) {
                    out.push('<li><b>JS ' + (I + 1) + '.</b>' + reports.print_jscss(S[I], 1) + '</li>');
                }

                out.push('</ol><ol>');

                S = document.getElementsByTagName('link');
                for (I = 0;I < S.length;I++) {
                    if (S[I].type.match(/css/)) {
                        out.push('<li><b>CSS ' + (I + 1) + '.</b>' + reports.print_jscss(S[I]) + '</li>');
                    }
                }

                out.push('</ol>');
                if (reports.combo.js.length) {
                    out.push('<h3>Here is extra html you should add to page to test preload combo js * ' + reports.combo.js.length + '(' + reports.combo.js.join('').match(/\?|&/g).length + '):</h3><p>' + reports.combo.js.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') + '</p>');
                } else {
                    out.push('<h3>You already preload all required combo js files</h3>');
                }
                if (reports.combo.css.length) {
                    out.push('<h3>Here is extra html you should add to page to test preload combo css * ' + reports.combo.css.length + '(' + reports.combo.css.join('').match(/\?|&/g).length + '):</h3><p>' + reports.combo.css.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') + '</p>');
                } else {
                    out.push('<h3>You already preload all required combo css files</h3>');
                }
                if ((! window.YUI_config) || window.YUI_config.fetchCSS) {
                    out.push('You may need var YUI_config = {fetchCSS: false} to prevent yui3 load css');
                }
                if (reports.combo.js.length + reports.combo.css.length) {
                    out.push('<h3>You may need to remove duplicated html codes</h3><h3>Config: oneyui_cfg.detect_static may help you to remove duplicated combo files on your page, but not guaranteed');
                }

                C.className = 'oyreport';
                if (cfg.auto_test) {
                    Y.applyConfig({
                        gallery: 'gallery-2010.12.01-21-32'
                    });
                    reports.use.push('gallery-storage-lite');
                    C.innerHTML = '<h3>oneYUI is running under automatic testing mode...</h3>';
                } else {
                    C.innerHTML = out.join('') + '<h3>Copy report html codes here</h3><textarea><style>' + css + '</style><div class="oyreport">' + out.join('') + '</div></textarea>';
                }
                document.body.appendChild(C);

                if (cfg.auto_test) {
                    if (cfg.skip_add || cfg.skip_use) {
                        C.innerHTML += '<p>I can not do test automation when oneyui_cfg.skip_add or oneyui_cfg.skip_use is true, please change configuration.</p>';
                    } else {
                        Y.use(reports.use, reports.advance_features);
                    }
                }
            }
        },

        one_add = function (N) {
            reports.add('begin_add', N);
            if (cfg.skip_add) {
                reports.add('end_add', '(SKIPED by one_yui)');
            } else {
                old_add.apply(this, arguments);
                reports.add('end_add', N);
            }
        },
        one_use = function () {
            var args = Array.prototype.slice.call(arguments, 0),
                callback = args.pop(),
                alist = args.join(),
                id = this.iid;

            if (cfg.skip_add) {
                reports.add('begin_use', '(SKIPED by one_yui) ' + alist, id);
                return;
            }
            reports.add('begin_use', alist, id);

            if (cfg.skip_use) {
                args.push(function (Y) {
                    reports.add('begin_run', alist, id);
                    reports.add('end_run', '(SKIPED by one_yui) ' + ((cfg.enable_report === 2) ? callback : ''), id);
                });
            } else {
                args.push(function (Y) {
                    reports.add('begin_run', alist, id);
                    callback(Y);
                    reports.add('end_run', (cfg.enable_report === 2) ? callback : '', id);
                });
            }
            this.old_use.apply(this, args);
            reports.add('end_use', alist, id);
        },
        one_instanceOf = function (O, C) {
            return old_instanceOf(O, (C === YUI) ? oldYUI : C);
        },

        oneYUI = function () {
            var R,
                iid = reports.modules.begin_instance.length;

            if (cfg.enable_sandbox) {
                reports.add('begin_instance', arguments.length ? 'with cfg' : 'no cfg', iid);
                YUI = oldYUI;
                R = YUI.apply(this, arguments);
                YUI = oneYUI;
                R.instanceOf = one_instanceOf;
                reports.add('end_instance', arguments.length ? 'with cfg' : 'no cfg', R.iid = iid);
                return R;
            }

            if (reports.modules.end_instance.length === 0) {
                reports.add('end_instance', arguments.length ? 'with cfg' : 'no cfg', Y.iid);
            }

            if (arguments.length && window.console) {
                window.console.log('oneYUI do not support instance config! Please use page level config variable: YUI_config');
            }

            return Y;
        };

    if (cfg.enable_report === 2) {
        if (navigator.userAgent.match(/MSIE/)) {
            cfg.enable_report = 0;
        } else {
            Function.prototype.toString = function () {
                return old_functionString.call(this).replace(/[\n\t ]+/g, ' ').replace(/.{8}(.{25}).+(.{25})$/, 'F$1 ... $2');
            };
        }
    }

    reports.add('begin page', window.oneyui_cfg.start ? 'page downloaded' : '(+-500ms) page start (sync server/client time setting before you trust this number)');
    start = start0;
    reports.add('page oyui', 'oneYUI init');
    reports.detect_statics();

    Y.mix(oneYUI, oldYUI);
    oneYUI.add = one_add;

    if (cfg.enable_sandbox) {
        oldYUI.prototype.old_use = oldYUI.prototype.use;
        oldYUI.prototype.use = one_use;
    } else {
        reports.add('begin_instance', '-oneYUI-', Y.iid = 0);
        Y.old_use = oldYUI.prototype.use;
        Y.use = one_use;
        Y.instanceOf = one_instanceOf;
    }

    if (cfg.enable_report) {
        window.onload = function () {
            reports.add('page', 'page_loaded', 0);
            if (cfg.auto_test) {
                window.setTimeout(reports.show, 2000);
            }
        };
        document.onreadystatechange = function () {
            reports.add('page', 'document state ' + document.readyState, 0);
        };
        oneYUI.show_report = reports.show;
        if (window.console) {
            window.console.log('oneYUI 0.0.6 started, current config = {' + reports.print_config() + '}');
        }
    }

    YUI = oneYUI;

    reports.add('page', 'oneYUI ready');
})();
