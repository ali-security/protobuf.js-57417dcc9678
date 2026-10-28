// A minimal test for pbjs tool targets.

var tape = require("tape");
var path = require("path");
var Module = require("module");
var protobuf = require("..");
var fs = require("fs");
var EventEmitter = require("events").EventEmitter;
var child_process = require("child_process");

function cliTest(test, testFunc) {
    // pbjs does not seem to work with Node v4, so skip this test if we're running on it
    if (process.versions.node.match(/^4\./)) {
        test.end();
        return;
    }

    // Alter the require cache to make the cli/targets/static work since it requires "protobufjs"
    // and we don't want to mess with "npm link"
    var savedResolveFilename = Module._resolveFilename;
    Module._resolveFilename = function(request, parent) { 
      if (request.startsWith("protobufjs")) {
        return request;
      }
      return savedResolveFilename(request, parent);
    };
    require.cache.protobufjs = require.cache[path.resolve("index.js")];

    try {
        testFunc();
    } finally {
        // Rollback all the require() related mess we made
        delete require.cache.protobufjs;
        Module._resolveFilename = savedResolveFilename;
    }
}

tape.test("pbjs generates static code", function(test) {
    cliTest(test, function() {
        var root = protobuf.loadSync("tests/data/cli/test.proto");
        root.resolveAll();

        var staticTarget = require("../cli/targets/static");

        staticTarget(root, {
            create: true,
            decode: true,
            encode: true,
            convert: true,
            typeurl: true,
        }, function(err, jsCode) {
            test.error(err, 'static code generation worked');

            // jsCode is the generated code; we'll eval it
            // (since this is what we normally do with the code, right?)
            // This is a test code. Do not use this in production.
            var $protobuf = protobuf;
            eval(jsCode);

            var OneofContainer = protobuf.roots.default.OneofContainer;
            var Message = protobuf.roots.default.Message;
            test.ok(OneofContainer, "type is loaded");
            test.ok(Message, "type is loaded");

            // Check that fromObject and toObject work for plain object
            var obj = {
                messageInOneof: {
                    value: 42,
                },
                regularField: "abc",
                enumField: 0,
            };
            var obj1 = OneofContainer.toObject(OneofContainer.fromObject(obj));
            test.deepEqual(obj, obj1, "fromObject and toObject work for plain object");

            // Check that dynamic fromObject and toObject work for static instance
            var root = protobuf.loadSync("tests/data/cli/test.proto");
            var OneofContainerDynamic = root.lookup("OneofContainer");
            var instance = new OneofContainer();
            instance.messageInOneof = new Message();
            instance.messageInOneof.value = 42;
            instance.regularField = "abc";
            instance.enumField = 0;
            var instance1 = OneofContainerDynamic.toObject(OneofContainerDynamic.fromObject(instance));
            test.deepEqual(instance, instance1, "fromObject and toObject work for instance of the static type");

            // Check that getTypeUrl works
            var defaultTypeUrl = Message.getTypeUrl();
            var customTypeUrl = Message.getTypeUrl("example.com");
            test.equal(defaultTypeUrl, "type.googleapis.com/Message", "getTypeUrl returns expected url");
            test.equal(customTypeUrl, "example.com/Message", "getTypeUrl returns custom url");

            test.end();
        });
    });
});

// cli/ dependencies (e.g. tmp) are not installed by the root npm install; stub the
// unresolvable ones while loading pbts (they are not used by the spawn path under test)
function loadPbts() {
    var originalResolve = Module._resolveFilename;
    Module._resolveFilename = function(request) {
        try {
            return originalResolve.apply(this, arguments);
        } catch (e) {
            return "path";
        }
    };
    try {
        return require("../cli/pbts");
    } finally {
        Module._resolveFilename = originalResolve;
    }
}

tape.test("pbts passes jsdoc arguments without a shell", function(test) {
    var pbts = loadPbts();
    var originalSpawn = child_process.spawn;
    var file = "file with \"quotes\" `backticks` 'apostrophes' and ;.js";

    test.plan(5);

    child_process.spawn = function(cmd, args, options) {
        var child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = { pipe: function() {} };

        test.equal(cmd, process.execPath, "should execute node directly");
        test.ok(/jsdoc[\\/]jsdoc\.js$/.test(args[0]), "should execute jsdoc directly");
        test.equal(args[args.length - 1], file, "should pass file path as a single argument");
        test.equal(options.stdio, "pipe", "should pipe jsdoc output");

        process.nextTick(function() {
            child.stdout.emit("data", "declare namespace test {}\n");
            child.stdout.emit("end");
            child.emit("close", 0);
        });

        return child;
    };

    pbts.main([file], function(err) {
        child_process.spawn = originalSpawn;
        test.error(err, "should generate definitions");
    });
});

tape.test("pbjs escapes static target names", function(test) {
    cliTest(test, function() {
        var root = protobuf.Root.fromJSON({
            nested: {
                "1-ns": {
                    nested: {}
                }
            }
        });
        var staticTarget = require("../cli/targets/static");

        staticTarget(root, {}, function(err, jsCode) {
            test.error(err, "static code generation worked");
            test.doesNotThrow(function() {
                new Function("$protobuf", jsCode); // eslint-disable-line no-new-func
            }, "should generate parseable output");
            test.end();
        });
    });
});

tape.test("without null-defaults, absent optional fields have zero values", function(test) {
    cliTest(test, function() {
        var root = protobuf.loadSync("tests/data/cli/null-defaults.proto");
        root.resolveAll();

        var staticTarget = require("../cli/targets/static");

        staticTarget(root, {
            create: true,
            decode: true,
            encode: true,
            convert: true,
        }, function(err, jsCode) {
            test.error(err, 'static code generation worked');

            // jsCode is the generated code; we'll eval it
            // (since this is what we normally does with the code, right?)
            // This is a test code. Do not use this in production.
            var $protobuf = protobuf;
            eval(jsCode);

            var OptionalFields = protobuf.roots.default.OptionalFields;
            test.ok(OptionalFields, "type is loaded");

            // Check default values
            var msg = OptionalFields.fromObject({});
            test.equal(msg.a, null, "default submessage is null");
            test.equal(msg.b, "", "default string is empty");
            test.equal(msg.c, 0, "default integer is 0");

            test.end();
        });
    });
});

tape.test("with null-defaults, absent optional fields have null values", function(test) {
    cliTest(test, function() {
        var root = protobuf.loadSync("tests/data/cli/null-defaults.proto");
        root.resolveAll();

        var staticTarget = require("../cli/targets/static");

        staticTarget(root, {
            create: true,
            decode: true,
            encode: true,
            convert: true,
            "null-defaults": true,
        }, function(err, jsCode) {
            test.error(err, 'static code generation worked');

            // jsCode is the generated code; we'll eval it
            // (since this is what we normally does with the code, right?)
            // This is a test code. Do not use this in production.
            var $protobuf = protobuf;
            eval(jsCode);

            var OptionalFields = protobuf.roots.default.OptionalFields;
            test.ok(OptionalFields, "type is loaded");

            // Check default values
            var msg = OptionalFields.fromObject({});
            test.equal(msg.a, null, "default submessage is null");
            test.equal(msg.b, null, "default string is null");
            test.equal(msg.c, null, "default integer is null");

            test.end();
        });
    });
});


tape.test("pbjs generates static code with message filter", function (test) {
    cliTest(test, function () {
        var root = protobuf.loadSync("tests/data/cli/test-filter.proto");
        root.resolveAll();

        var staticTarget = require("../cli/targets/static");
        var util = require("../cli/util");

        const needMessageConfig = JSON.parse(fs.readFileSync("tests/data/cli/filter.json"));

        util.filterMessage(root, needMessageConfig);

        staticTarget(root, {
            create: true,
            decode: true,
            encode: true,
            convert: true,
            "null-defaults": true,
        }, function (err, jsCode) {
            test.error(err, 'static code generation worked');

            // jsCode is the generated code; we'll eval it
            // (since this is what we normally does with the code, right?)
            // This is a test code. Do not use this in production.
            var $protobuf = protobuf;
            eval(jsCode);

            var NeedMessage1 = protobuf.roots.default.filtertest.NeedMessage1;
            var NeedMessage2 = protobuf.roots.default.filtertest.NeedMessage2;
            var DependentMessage1 = protobuf.roots.default.filtertest.DependentMessage1;
            var DependentMessageFromImport = protobuf.roots.default.DependentMessageFromImport;

            var NotNeedMessageInRootFile = protobuf.roots.default.filtertest.NotNeedMessageInRootFile;
            var NotNeedMessageInImportFile = protobuf.roots.default.NotNeedMessageInImportFile;

            test.ok(NeedMessage1, "NeedMessage1 is loaded");
            test.ok(NeedMessage2, "NeedMessage2 is loaded");
            test.ok(DependentMessage1, "DependentMessage1 is loaded");
            test.ok(DependentMessageFromImport, "DependentMessageFromImport is loaded");

            test.notOk(NotNeedMessageInImportFile, "NotNeedMessageInImportFile is not loaded");
            test.notOk(NotNeedMessageInRootFile, "NotNeedMessageInRootFile is not loaded");

            test.end();
        });
    });
});

tape.test("pbjs static services can call runtime-significant method names", function(test) {
    cliTest(test, function() {
        var root = protobuf.parse("syntax = \"proto3\"; message Req {} message Res {} service S { rpc rpcCall(Req) returns (Res); }").root;
        root.resolveAll();

        var staticTarget = require("../cli/targets/static");
        staticTarget(root, {
            decode: true,
            encode: true,
            convert: true,
            service: true,
            root: "staticServiceShadow"
        }, function(err, jsCode) {
            test.error(err, "static code generation worked");

            delete protobuf.roots.staticServiceShadow;
            var $protobuf = protobuf;
            eval(jsCode);

            var S = protobuf.roots.staticServiceShadow.S,
                Res = protobuf.roots.staticServiceShadow.Res,
                service = new S(function(method, request, callback) {
                    callback(null, Res.encode({}).finish());
                });

            service.rpcCall({}, function(callErr, response) {
                test.error(callErr, "should call method named rpcCall");
                test.ok(response instanceof Res, "should decode the response");
                delete protobuf.roots.staticServiceShadow;
                test.end();
            });
        });
    });
});
