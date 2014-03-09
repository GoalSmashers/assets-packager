var vows = require('vows');
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var exec = require('child_process').exec;

var isWindows = process.platform == 'win32';
var deleteDir = function(pathToDir) {
  if (isWindows)
    exec('rd /s /q ' + pathToDir);
  else
    exec('rm -rf ' + pathToDir);
};
var deleteFiles = function(filesWildcard) {
  if (isWindows)
    exec('del /q /f ' + filesWildcard);
  else
    exec('rm -rf ' + filesWildcard);
};

var withOptions = function(options) {
  var command = isWindows ?
    'cd test & node ..\\bin\\assetspkg ' :
    'cd test; ../bin/assetspkg ';

  return function() {
    exec(command + (options || ''), this.callback);
  };
};

var fullPath = function(suffix) {
  return path.join(process.cwd(), suffix);
};

var cleanBundles = function(set) {
  deleteDir(fullPath('test/data/' + set + '/public/javascripts/bundled'));
  deleteDir(fullPath('test/data/' + set + '/public/stylesheets/bundled'));
  deleteFiles(fullPath('test/data/' + set + '/public/stylesheets/*.css'));
  deleteFiles(fullPath('test/data/' + set + '/.assets.yml.json'));
};

var cacheData = function(set) {
  var data = fs.readFileSync(fullPath('test/data/' + set + '/.assets.yml.json'));
  return JSON.parse(data);
};

assert.hasFile = function(set, type, name) {
  assert.isTrue(fs.existsSync(fullPath(path.join('test/data', set, 'public', type, name))));
};
assert.notHasFile = function(set, type, name) {
  assert.isFalse(fs.existsSync(fullPath(path.join('test/data', set, 'public', type, name))));
};
assert.hasBundledFile = function(set, type, name) {
  var filePath = fullPath(path.join('test/data', set, 'public', type, 'bundled', name));
  assert.isTrue(fs.existsSync(filePath));

  if (!isWindows)
    assert.equal(16877, fs.statSync(path.dirname(filePath)).mode);
};
assert.notHasBundledFile = function(set, type, name) {
  assert.isFalse(fs.existsSync(fullPath(path.join('test/data', set, 'public', type, 'bundled', name))));
};
assert.hasBundledFileIn = function(set, type, name, bundledPath) {
  var filePath = fullPath(path.join('test/data', set, 'public', bundledPath, name));
  assert.isTrue(fs.existsSync(filePath));

  if (!isWindows)
    assert.equal(16877, fs.statSync(path.dirname(filePath)).mode);
};

exports.commandsSuite = vows.describe('binary commands').addBatch({
  'no options': {
    topic: withOptions(),
    'should not produce output': function(error, stdout) {
      assert.isEmpty(stdout);
    },
    'should not give empty error': function(error, stdout, stderr) {
      assert.isNotNull(stderr);
    },
    'should give meaningful error': function(error, stdout, stderr) {
      assert.include(stderr, 'is missing');
    }
  },
  'help option': {
    topic: withOptions('-h'),
    'should give help': function(error, stdout) {
      assert.include(stdout, 'Usage:');
      assert.include(stdout, 'Options:');
    }
  },
  'help option via --help': {
    topic: withOptions('--help'),
    'should give help': function(error, stdout) {
      assert.include(stdout, 'Usage:');
      assert.include(stdout, 'Options:');
    }
  },
  'non existing root path': {
    topic: withOptions('-r test/fake -c data/empty.yml'),
    'should not give output': function(error, stdout) {
      assert.isEmpty(stdout);
    },
    'should print not found error': function(error, stdout, stderr) {
      assert.include(stderr, path.join('test', 'fake') + '" could not be found');
    }
  },
  'non existing config file': {
    topic: withOptions('-r test/fake -c data/fake.yml'),
    'should not give output': function(error, stdout) {
      assert.isEmpty(stdout);
    },
    'should print not found error': function(error, stdout, stderr) {
      assert.include(stderr, path.join('data', 'fake.yml') + '" is missing');
    }
  },
  'version': {
    topic: withOptions('-v'),
    'should give proper version': function(error, stdout) {
      var version = JSON.parse(fs.readFileSync('./package.json')).version;
      assert.include(stdout, version);
    }
  }
});

exports.packagingSuite = vows.describe('packaging all').addBatch({
  'packaging without gzipped version': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should not bundle css into compressed packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.notHasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should not bundle css into compressed packages without embedded content': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.notHasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging with gzipped version': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should not bundle css into compressed packages without embedded content': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.notHasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should bundle js into compressed packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    'should correctly compress js content': {
      topic: function() {
        var compressedBuffer = fs.readFileSync(fullPath(path.join('test', 'data', 'test1', 'public', 'javascripts', 'bundled', 'all.js.gz')));
        zlib.gunzip(compressedBuffer, this.callback);
      },
      'after deflation': function(error, data) {
        assert.equal(data.toString('utf8'), 'var x=0,y=0;');
      }
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging with gzipped and "no embed" versions': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle css into compressed packages without embedded content': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should bundle js into compressed packages': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging with hard cache boosters enabled': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -b'),
    'should create .assets.yml.json': function() {
      assert.isTrue(fs.existsSync(fullPath(path.join('test/data/test1/.assets.yml.json'))));
    },
    'should bundle css into packages': function() {
      var cacheInfo = cacheData('test1');
      assert.hasBundledFile('test1', 'stylesheets', 'subset-' + cacheInfo['stylesheets/subset'] + '.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all-' + cacheInfo['stylesheets/subset'] + '.css');
    },
    'should bundle css into compressed packages': function() {
      var cacheInfo = cacheData('test1');
      assert.hasBundledFile('test1', 'stylesheets', 'subset-' + cacheInfo['stylesheets/subset'] + '.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-' + cacheInfo['stylesheets/subset'] + '.css.gz');
    },
    'should bundle css into compressed packages without embedded content': function() {
      var cacheInfo = cacheData('test1');
      assert.hasBundledFile('test1', 'stylesheets', 'subset-' + cacheInfo['stylesheets/subset'] + '-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-' + cacheInfo['stylesheets/subset'] + '-noembed.css.gz');
    },
    'should bundle js into packages': function() {
      var cacheInfo = cacheData('test1');
      assert.hasBundledFile('test1', 'javascripts', 'subset-' + cacheInfo['javascripts/subset'] + '.js');
      assert.hasBundledFile('test1', 'javascripts', 'all-' + cacheInfo['javascripts/all'] + '.js');
    },
    'should bundle js into compressed packages': function() {
      var cacheInfo = cacheData('test1');
      assert.hasBundledFile('test1', 'javascripts', 'subset-' + cacheInfo['javascripts/subset'] + '.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all-' + cacheInfo['javascripts/all'] + '.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging only one file should update cached stamps': {
    topic: function() {
      fs.writeFile(fullPath('/test/data/test1/.assets.yml.json'), '{"test":123}', 'utf8', this.callback);
    },
    'process with fake cache stamps file': {
      topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -b -o all.css'),
      'should add single file entry': function() {
        var cacheInfo = cacheData('test1');
        assert.notEqual(undefined, cacheInfo['stylesheets/all']);
      }
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'should rename files when adding cache stamps': {
    topic: withOptions('-b -r data/test2/public -c data/test2/assets.yml'),
    'should create stamped files': function() {
      assert.isTrue(fs.existsSync(fullPath('test/data/test2/public/images/one-77f77b6eaf58028e095681c21bad95a8.png')));
      assert.isTrue(fs.existsSync(fullPath('test/data/test2/public/images/two-77f77b6eaf58028e095681c21bad95a8.png')));
    },
    'should put stamped files into CSS file': {
      topic: function() {
        var cacheInfo = cacheData('test2');
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all-' + cacheInfo['stylesheets/all'] + '.css'), 'utf-8', this.callback);
      },
      'one.png': function(error, data) {
        assert.include(data, '/images/one-77f77b6eaf58028e095681c21bad95a8.png');
      },
      'two.png': function(error, data) {
        assert.include(data, '/images/two-77f77b6eaf58028e095681c21bad95a8.png');
      }
    },
    teardown: function() {
      cleanBundles('test2');
      deleteFiles(fullPath('test/data/test2/public/images/one-*'));
      deleteFiles(fullPath('test/data/test2/public/images/two-*'));
    }
  }
}).addBatch({
  'should create deep directory structure': {
    topic: withOptions('-r data/test4/public -c data/test4/assets.yml -g'),
    'should create bundled files': function() {
      assert.hasBundledFile('test4', 'stylesheets', 'desktop/all.css');
      assert.hasBundledFile('test4', 'stylesheets', 'desktop/all.css.gz');
    },
    teardown: function() {
      cleanBundles('test4');
      deleteFiles(fullPath('test/data/test4/public/stylesheets/desktop/*.css'));
    }
  }
});

exports.subsetSuite = vows.describe('packaging selected packages').addBatch({
  'packaging only one selected package': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle selected css into compressed packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle selected css into compressed packages without embedded content': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should not bundle js into packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging only two selected packages': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css,subset.css'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle selected css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle selected css into compressed packages without embedded content': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should not bundle js into packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'packaging only three selected packages': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css,subset.css,all.js'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should bundle selected css into compressed packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css.gz');
    },
    'should bundle selected css into compressed packages without embedded content': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset-noembed.css.gz');
      assert.hasBundledFile('test1', 'stylesheets', 'all-noembed.css.gz');
    },
    'should not bundle js into packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    'should not bundle js into compressed packages': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js.gz');
      assert.hasBundledFile('test1', 'javascripts', 'all.js.gz');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'not compiling less when packaging js packages only': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.js'),
    'should not compile css to less': function() {
      assert.notHasFile('test1', 'stylesheets', 'one.css');
      assert.notHasFile('test1', 'stylesheets', 'two.css');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'compiling all javascripts': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -o ' + (isWindows ? '' : '\\') + '*.js'),
    'should not compile css to less': function() {
      assert.notHasFile('test1', 'stylesheets', 'one.css');
      assert.notHasFile('test1', 'stylesheets', 'two.css');
    },
    'should not bundle selected css into packages': function() {
      assert.notHasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.notHasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should package all js files': function() {
      assert.hasBundledFile('test1', 'javascripts', 'subset.js');
      assert.hasBundledFile('test1', 'javascripts', 'all.js');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'compiling all stylesheets': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -o *.css'),
    'should compile css to less': function() {
      assert.hasFile('test1', 'stylesheets', 'one.css');
      assert.hasFile('test1', 'stylesheets', 'two.css');
    },
    'should bundle selected css into packages': function() {
      assert.hasBundledFile('test1', 'stylesheets', 'subset.css');
      assert.hasBundledFile('test1', 'stylesheets', 'all.css');
    },
    'should package all js files': function() {
      assert.notHasBundledFile('test1', 'javascripts', 'subset.js');
      assert.notHasBundledFile('test1', 'javascripts', 'all.js');
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'not showing processing JS when packaging CSS only': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.css'),
    'should not output processing JS': function(error, stdout) {
      assert.equal(-1, stdout.indexOf('Processing type "javascripts"'));
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
}).addBatch({
  'not showing processing CSS when packaging JS only': {
    topic: withOptions('-r data/test1/public -c data/test1/assets.yml -g -n -o all.js'),
    'should not output processing CSS': function(error, stdout) {
      assert.equal(-1, stdout.indexOf('Processing type "stylesheets"'));
    },
    teardown: function() {
      cleanBundles('test1');
    }
  }
});

exports.customPaths = vows.describe('custom paths').addBatch({
  'one simple path': {
    topic: withOptions('-r data/test-paths1/public -c data/test-paths1/assets.yml --ps ./css'),
    'should bundle css': function() {
      assert.hasBundledFile('test-paths1', 'css', 'all.css');
    },
    'should bundle css content': {
      topic: function() {
        fs.readFile(fullPath('test/data/test-paths1/public/css/bundled/all.css'), 'utf-8', this.callback);
      },
      'properly': function(error, data) {
        assert.equal('a{color:red}', data);
      }
    },
    'should bundle scripts': function() {
      assert.hasBundledFile('test-paths1', 'javascripts', 'all.js');
    },
    teardown: function() {
      deleteDir(fullPath('test/data/test-paths1/public/javascripts/bundled'));
      deleteDir(fullPath('test/data/test-paths1/public/css/bundled'));
      deleteFiles(fullPath('test/data/test-paths1/.assets.yml.json'));
    }
  },
  'complex paths': {
    topic: withOptions('-r data/test-paths2/public -c data/test-paths2/assets.yml --styles-path ./assets/css --js-path ./js -g'),
    'should bundle css': function() {
      assert.hasBundledFile('test-paths2', 'assets/css', 'mobile/all.css');
      assert.hasBundledFile('test-paths2', 'assets/css', 'mobile/all.css.gz');
    },
    'should bundle css content': {
      topic: function() {
        fs.readFile(fullPath('test/data/test-paths2/public/assets/css/bundled/mobile/all.css'), 'utf-8', this.callback);
      },
      'properly': function(error, data) {
        assert.equal('a{color:red}', data);
      }
    },
    'should bundle scripts': function() {
      assert.hasBundledFile('test-paths2', 'js', 'mobile/all.js');
      assert.hasBundledFile('test-paths2', 'js', 'mobile/all.js.gz');
    },
    'should bundle js content': {
      topic: function() {
        fs.readFile(fullPath('test/data/test-paths2/public/js/bundled/mobile/all.js'), 'utf-8', this.callback);
      },
      'properly': function(error, data) {
        assert.equal('var x=0;', data);
      }
    },
    teardown: function() {
      deleteDir(fullPath('test/data/test-paths2/public/js/bundled'));
      deleteDir(fullPath('test/data/test-paths2/public/assets/css/bundled'));
      deleteFiles(fullPath('test/data/test-paths2/.assets.yml.json'));
    }
  }
});

exports.javascriptOptimizing = vows.describe('javascript optimizing').addBatch({
  'correct optimization': {
    topic: withOptions('-r data/test3/public -c data/test3/assets.yml'),
    'for optimizations.js': {
      topic: function() {
        fs.readFile(fullPath('test/data/test3/public/javascripts/bundled/optimizations.js'), 'utf-8', this.callback);
      },
      'data': function(error, data) {
        if (error)
          throw error;

        assert.equal('function factorial(i){return 0==i?1:i*factorial(i-1)}for(var i=0,j=factorial(10).toString(),k=j.length;k>i;i++)console.log(j[i]);',
          data);
      }
    },
    'for cufon.js': {
      topic: function() {
        fs.readFile(fullPath('test/data/test3/public/javascripts/bundled/fonts.js'), 'utf-8', this.callback);
      },
      'data': function(error, data) {
        if (error)
          throw error;

        assert.equal(
          'Cufon.registerFont((function(f){var b=_cufon_bridge_={p:[{"d":"88,-231v18,-2,31,19,8,26v-86,25,-72,188,-18,233v7,4,17,4,17,13v-1,14,-12,18,-26,10v-19,-10,-48,-49,-56,-77"}]};}));',
          data
        );
      }
    },
    teardown: function() {
      cleanBundles('test3');
    }
  }
}).addBatch({
  'no line breaking by default': {
    topic: withOptions('-r data/test-js/public -c data/test-js/assets.yml'),
    'should not break file at': {
      topic: function() {
        fs.readFile(fullPath('test/data/test-js/public/javascripts/bundled/all.js'), 'utf-8', this.callback);
      },
      'any character': function(error, data) {
        assert.equal('function test(){var c={b:0,c:function(){}};c.b++,c.c(),c.c()}', data);
      }
    },
    teardown: function() {
      cleanBundles('test-js');
    }
  }
}).addBatch({
  'correct line breaking': {
    topic: withOptions('-r data/test-js/public -c data/test-js/assets.yml -l 10'),
    'should break file at': {
      topic: function() {
        fs.readFile(fullPath('test/data/test-js/public/javascripts/bundled/all.js'), 'utf-8', this.callback);
      },
      '10 characters if possible': function(error, data) {
        assert.equal('function test(){var c={b:0,c:function(){}};\nc.b++,c.c(),c.c()\n}', data);
      }
    },
    teardown: function() {
      cleanBundles('test-js');
    }
  }
}).addBatch({
  'no JS minification': {
    topic: withOptions('-r data/test3/public --nm -i 2 -c data/test3/assets.yml'),
    'for optimizations.js': {
      topic: function() {
        fs.readFile(fullPath('test/data/test3/public/javascripts/bundled/optimizations.js'), 'utf-8', this.callback);
      },
      'data': function(error, data) {
        if (error)
          throw error;

        assert.equal(data, 'function factorial(n) {\n  if (n == 0) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n};\n\nfor (var i = 0, j = factorial(10).toString(), k = j.length; i < k; i++) {\n  console.log(j[i]);\n}');
      }
    },
    teardown: function() {
      cleanBundles('test3');
    }
  }
});

exports.assetsHosts = vows.describe('assets hosts').addBatch({
  'no asset hosts': {
    topic: withOptions('-r data/test2/public -c data/test2/assets.yml'),
    'in plain file': {
      topic: function() {
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all.css'), 'utf-8', this.callback);
      },
      'first file png': function(error, data) {
        assert.include(data, 'one.png');
      },
      'second file png': function(error, data) {
        assert.include(data, 'two.png');
      },
      'should not add assets hosts': function(error, data) {
        assert.include(data, 'url(/images/one.png');
        assert.include(data, 'url(/images/two.png');
      }
    },
    teardown: function() {
      cleanBundles('test2');
    }
  }
}).addBatch({
  'asset hosts': {
    topic: withOptions('-r data/test2/public -c data/test2/assets.yml -n -a assets[0,1].example.com'),
    'in plain file': {
      topic: function() {
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all.css'), 'utf-8', this.callback);
      },
      'first file png': function(error, data) {
        assert.include(data, 'one.png');
      },
      'second file png': function(error, data) {
        assert.include(data, 'two.png');
      },
      'should add assets hosts': function(error, data) {
        assert.include(data, 'url(//assets0.example.com/images/one.png');
        assert.include(data, 'url(//assets1.example.com/images/two.png');
      }
    },
    'in noembed file': {
      topic: function() {
        fs.readFile(fullPath('test/data/test2/public/stylesheets/bundled/all-noembed.css'), 'utf-8', this.callback);
      },
      'first file png': function(error, data) {
        assert.include(data, 'one.png');
      },
      'second file png': function(error, data) {
        assert.include(data, 'two.png');
      },
      'should add assets hosts': function(error, data) {
        assert.include(data, 'url(//assets0.example.com/images/one.png');
        assert.include(data, 'url(//assets1.example.com/images/two.png');
      }
    },
    teardown: function() {
      cleanBundles('test2');
    }
  }
});

exports.bundledPaths = vows.describe('bundled paths').addBatch({
  'simple packaging': {
    topic: withOptions('-r data/test-paths3/public -c data/test-paths3/assets.yml --ps ./css --js-bundled ./compressed --styles-bundled ./compressed'),
    'should bundle css': function() {
      assert.hasBundledFileIn('test-paths3', 'css', 'all.css', 'compressed');
    },
    'should bundle scripts': function() {
      assert.hasBundledFileIn('test-paths3', 'javascripts', 'all.js', 'compressed');
    },
    teardown: function() {
      deleteDir(fullPath('test/data/test-paths3/public/compressed'));
      deleteFiles(fullPath('test/data/test-paths3/.assets.yml.json'));
    }
  },
  'packaging with compression enabled': {
    topic: withOptions('-r data/test-paths3/public -c data/test-paths3/assets.yml --ps ./css --js-bundled ./compressed --styles-bundled ./compressed -g'),
    'should bundle css': function() {
      assert.hasBundledFileIn('test-paths3', 'css', 'all.css', 'compressed');
      assert.hasBundledFileIn('test-paths3', 'css', 'all.css.gz', 'compressed');
    },
    'should bundle scripts': function() {
      assert.hasBundledFileIn('test-paths3', 'javascripts', 'all.js', 'compressed');
      assert.hasBundledFileIn('test-paths3', 'javascripts', 'all.js.gz', 'compressed');
    },
    teardown: function() {
      deleteDir(fullPath('test/data/test-paths3/public/compressed'));
      deleteFiles(fullPath('test/data/test-paths3/.assets.yml.json'));
    }
  },
  'packaging with hard cache boosters enabled': {
    topic: withOptions('-r data/test-paths3/public -c data/test-paths3/assets.yml --ps ./css --js-bundled ./compressed --styles-bundled ./compressed -b'),
    'should bundle css': function() {
      var cacheInfo = cacheData('test-paths3');
      assert.hasBundledFileIn('test-paths3', 'stylesheets', 'all-' + cacheInfo['stylesheets/all'] + '.css', 'compressed');
    },
    'should bundle scripts': function() {
      var cacheInfo = cacheData('test-paths3');
      assert.hasBundledFileIn('test-paths3', 'javascripts', 'all-' + cacheInfo['javascripts/all'] + '.js', 'compressed');
    },
    teardown: function() {
      deleteDir(fullPath('test/data/test-paths3/public/compressed'));
      deleteFiles(fullPath('test/data/test-paths3/.assets.yml.json'));
    }
  },
  'packaging with hard cache boosters and compression enabled': {
    topic: withOptions('-r data/test-paths3/public -c data/test-paths3/assets.yml --ps ./css --js-bundled ./compressed --styles-bundled ./compressed -g -b'),
    'should bundle css': function() {
      var cacheInfo = cacheData('test-paths3');
      assert.hasBundledFileIn('test-paths3', 'stylesheets', 'all-' + cacheInfo['stylesheets/all'] + '.css.gz', 'compressed');
    },
    'should bundle scripts': function() {
      var cacheInfo = cacheData('test-paths3');
      assert.hasBundledFileIn('test-paths3', 'javascripts', 'all-' + cacheInfo['javascripts/all'] + '.js.gz', 'compressed');
    },
    teardown: function() {
      deleteDir(fullPath('test/data/test-paths3/public/compressed'));
      deleteFiles(fullPath('test/data/test-paths3/.assets.yml.json'));
    }
  }
});
