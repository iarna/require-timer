"use strict";
module._requireTimer = {start: time()};
var path = require('path');
module._requireTimer.name = 'require-timer';
module._requireTimer.path = path.dirname(module.filename);
var fs = require('fs');
var out = process.stderr;
var sync = false;
module.exports = function (stream) {
    if (typeof stream === 'string') {
      out = {
        data: '',
        write: function (str) {
          this.data += str;
        }
      };
      sync = stream;
    } else {
      out = stream;
    }
}

function time() {
    var hrtime = process.hrtime();
    return hrtime[0] * 1e3 + hrtime[1] / 1e6; //
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
    current.start = time();
    var result = defaultLoader.apply(null,arguments);
    current.end = time();
    loading = previous;

    return result;
}

process.nextTick(function () {
    top._requireTimer.end = time();
    // we make a fake module here to track any loads that occur after the
    // main function exits but before the program exits.
    loading = {children:[], parent:null, _requireTimer:{path:top._requireTimer.path,name:'async',start:time(),end:time()}};
});
process.on('exit', function(code) {
    if (!top._requireTimer.end) {
        top._requireTimer.end = time();
        loading = null;
    }
    require.extensions['.js'] = defaultLoader;
    var sprintf = require('sprintf');
    var startupreport = timingReport(top).results;
    var report;
    if (loading) {
        var asyncreport = timingReport(loading).results;
        report = startupreport.concat(asyncreport);
    }
    else {
        report = startupreport;
    }
    report.sort(function(A,B){
        return A.start > B.start ? 1 : A.start < B.start ? -1 : A.stack > B.stack ? 1 : A.stack < B.stack ? -1 : 0
    }).forEach(function(R) {
        out.write(sprintf('%9.3f msec from start, %9.3f msec to load: %s\n', R.time, R.load<0?0:R.load, R.stack));
    });
    if (sync) {
      fs.writeFileSync(sync, out.data);
    }
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
    if (!module._requireTimer.end) module._requireTimer.end = top._requireTimer.end;
    var loadTime = module._requireTimer.end - module._requireTimer.start;
    var timeSoFar = module._requireTimer.end - top._requireTimer.start;
    // We report the amount of time that this, without the children loaded when it loaded took.
    results.push({start: module._requireTimer.start, end: module._requireTimer.end, time: timeSoFar, load: loadTime - childAtLoad, stack: stack});
    return {results:results, loadTime: loadTime};
}

module._requireTimer.end = time();
