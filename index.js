"use strict";
module._requireTimer = {start: process.hrtime()};
var path = require('path');
module._requireTimer.name = 'require-timer';
module._requireTimer.path = path.dirname(module.filename);

var out = process.stderr;

module.exports = function (stream) {
    out = stream;
}

function timems(time) {
    return time[0] * 1e3 + time[1] / 1e6; //
}
function timeGt(time1,time2) {
    return timems(time1) > timems(time2);
}
function timeSub(time1,time2) {
    var sec = time1[0] - time2[0];
    var nsec = time1[1] - time2[1];
    if (nsec<0) {
        -- sec;
        nsec = 1e9 + nsec;
    }
    return timems([sec,nsec]);
}

function escapeRegExp(string){
    return string.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
}

function findTop(module) { return module.parent ? findTop(module.parent) : module }
var top = findTop(module);
top._requireTimer = {name: path.basename(top.filename), path: path.dirname(top.filename), start: module._requireTimer.start};

var resafesep = escapeRegExp(path.sep);
var modmatch = new RegExp('^node_modules'+resafesep+'([^'+resafesep+']+)');

var loading = top;

var defaultLoader = require.extensions['.js'];
require.extensions['.js'] = function (module) {
    if (module.loaded) {
        return defaultLoader.apply(null,arguments);
    }
    // module.parent != the module being required that triggered this to be required.
    // Rather, module.parent is the 
    if (loading && loading !== module.parent) {
        module.parent.children = module.parent.children.filter(function(M){ return M !== module });
        loading.children.push(module);
        module.parent = loading;
    }
    var current = module._requireTimer = {
        name: null,
        path: null,
        start: null,
        end: null
    };
    var matched = false;
    var parent = module;
    while (parent = parent.parent) {
        var relpath = path.relative(parent._requireTimer.path,module.filename);
        if (relpath[0] != '.') {
            current.name = relpath;
            matched = true;
            break;
        }
    }

    if (!matched) {
        current.path = module.parent._requireTimer.path;
        current.name = path.relative(current.path,module.filename);
    }
    else {
        var matches;
        if (0 === current.name.indexOf('node_modules'+path.sep)) {
            var namechunk = current.name.substr(12+path.sep.length);
            var namelength = namechunk.indexOf(path.sep);
            current.name = namechunk.substr(0,namelength);
            var moduleprefix = 'node_modules'+path.sep+current.name+path.sep;
            var module_path_length = module.filename.lastIndexOf(moduleprefix) + moduleprefix.length;
            current.path = module.filename.substr(0,module_path_length);
        }
        else {
            current.path = parent._requireTimer.path;
        }
    }
    var previous = loading;
    loading = module;
    current.start = process.hrtime();
    var result = defaultLoader.apply(null,arguments);
    current.end = process.hrtime();
    loading = previous;

    return result;
}

process.nextTick(function () {
    top._requireTimer.end = process.hrtime();
    // we make a fake module here to track any loads that occur after the
    // main function exits but before the program exits.
    loading = {children:[], parent:null, _requireTimer:{path:top._requireTimer.path,name:'async',start:process.hrtime(),end:process.hrtime()}};
});
process.on('exit', function(code) {
    require.extensions['.js'] = defaultLoader;
    var sprintf = require('sprintf');
    var startupreport = timingReport(top).results;
    var asyncreport = timingReport(loading).results;
    startupreport.concat(asyncreport).sort(function(A,B){
        return A.start > B.start ? 1 : A.start < B.start ? -1 : A.stack > B.stack ? 1 : A.stack < B.stack ? -1 : 0
    }).forEach(function(R) {
        out.write(sprintf('%9.3f msec from start, %9.3f msec to load: %s\n', R.time, R.load<0?0:R.load, R.stack));
    });
});

function timingReport(module,stack) {
    var results = [];
    var childAtLoad = 0;
    stack = stack ? stack + ' -> '+module._requireTimer.name : module._requireTimer.name;
    for (var ii=0; ii<module.children.length; ++ii) {
        var child = module.children[ii];
        if (! child._requireTimer) continue;
        var report = timingReport(child,stack);
        childAtLoad += report.loadTime;
        results.push.apply(results, report.results);
    }
    var loadTime = timeSub(module._requireTimer.end, module._requireTimer.start);
    var timeSoFar = timeSub(module._requireTimer.end, top._requireTimer.start);
    // We report the amount of time that this, without the children loaded when it loaded took.
    results.push({start: timems(module._requireTimer.start), end: timems(module._requireTimer.end), time: timeSoFar, load: loadTime - childAtLoad, stack: stack});
    return {results:results, loadTime: loadTime};
}

module._requireTimer.end = process.hrtime();
