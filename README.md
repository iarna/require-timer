require-timer
----------

Track and report module load times in Node.js

Synopsis
--------

    require('require-timer'); // output load timing information to stderr

    require('require-timer')(process.stdout); // output load timing information to stdout

Description
-----------

This is a very simple module that instruments module loading to track how
long it takes to require your modules.  Intended to give data to help people
improve the startup times of their command line tools.

Loading this module installs it globally, causing it to track load times
across ALL calls to `require`.  Obviously, if you've written your own module
loader it won't instrument that.

Obviously it only instruments load times *after* its been loaded, so
typically the first thing you do should be to load it.

Output occurs when the program exits. 

Output
------

An example of the first few lines of running this on npm:

````
  295.038 msec from start,     1.542 msec to load: cli.js
    1.322 msec from start,     1.322 msec to load: cli.js -> require-timer
  294.891 msec from start,    35.301 msec to load: cli.js -> bin/npm-cli.js
   35.164 msec from start,     3.728 msec to load: cli.js -> bin/npm-cli.js -> npmlog
   34.485 msec from start,     1.189 msec to load: cli.js -> bin/npm-cli.js -> npmlog -> ansi
   34.131 msec from start,     0.205 msec to load: cli.js -> bin/npm-cli.js -> npmlog -> ansi -> lib/newlines.js
   44.787 msec from start,     1.529 msec to load: cli.js -> bin/npm-cli.js -> graceful-fs
   42.721 msec from start,     3.842 msec to load: cli.js -> bin/npm-cli.js -> graceful-fs -> fs.js
   44.564 msec from start,     1.278 msec to load: cli.js -> bin/npm-cli.js -> graceful-fs -> polyfills.js

````

The output is ordered by when the module began being loaded. That is, the
output is in *source code* order.

The first number, is the amount of time into execution that this module COMPLETED loading.

The second number is how long the module took to load, not including the modules it loaded.

Finally, have the require stack:

* Modules show up as just a module name (Note that they may have been loaded
  from a node_modules anywhere in your search path, this only shows you who
  asked for it, not where it was stored.)

* Regular files show up as relative to the requiring module's root, so for
  example, when you see: `graceful-fs -> fs.js` this means that you'll find:
  `node_modules/graceful-fs/fs.js`.  It's still the *module's root* even
  when it's a file doing the including, so for example, 
  `npmconf -> lib/load-prefix.js -> lib/find-prefix.js`, load-prefix and
  find-prefix are in the same folder.

