var tape = require("tape");

var protobuf = require("..");

var root = protobuf.Root.fromJSON({
    nested: {
        Foo: {
            fields: {
                foo: {
                    id: 1,
                    type: "google.protobuf.Any"
                }
            }
        },
        Bar: {
            fields: {
                bar: {
                    id: 1,
                    type: "string"
                }
            }
        },
        Loop: {
            fields: {
                next: {
                    id: 1,
                    type: "google.protobuf.Any"
                }
            }
        }
    }
}).addJSON(protobuf.common["google/protobuf/any.proto"].nested).resolveAll();

var Any = root.lookupType("protobuf.Any"),
    Foo = root.lookupType(".Foo"),
    Bar = root.lookupType(".Bar"),
    Loop = root.lookupType(".Loop");

tape.test("google.protobuf.Any", function(test) {

    var foo = Foo.fromObject({
        foo: {
            type_url: "Bar",
            value: [1 << 3 | 2, 1, 97] // value = "a"
        }
    });
    test.ok(foo.foo instanceof Any.ctor, "should keep explicit Any in fromObject");
    test.same(foo.foo, { type_url: "Bar", value: [10, 1, 97] }, "should keep explicit Any in fromObject properly");

    var obj = Foo.toObject(foo);
    test.same(obj.foo, { type_url: "Bar", value: [10, 1, 97] }, "should keep explicit Any in toObject properly");

    obj = Foo.toObject(foo, { json: true });
    test.same(obj.foo, { "@type": "type.googleapis.com/Bar", bar: "a" }, "should decode explicitly Any in toObject if requested");

    foo = Foo.fromObject({
        foo: {
            "@type": ".Bar",
            bar: "a"
        }
    });
    test.ok(foo.foo instanceof Any.ctor, "should convert to Any in fromObject");
    test.same(foo.foo, { type_url: "/Bar", value: protobuf.util.newBuffer([10, 1, 97]) }, "should have correct Any object when converted with fromObject");

    var baz = Foo.fromObject({
        foo: {
            type_url: "type.someurl.com/Bar",
            value: [1 << 3 | 2, 1, 97] // value = "a"
        }
    });
    obj = Foo.toObject(baz, { json: true });
    test.same(obj.foo, { "@type": "type.someurl.com/Bar", bar: "a" }, "should keep prefix in type url");

    test.end();
});

tape.test("google.protobuf.Any - toObject recursion limit", function(test) {

    var recursionLimit = protobuf.util.recursionLimit;
    protobuf.util.recursionLimit = 3;
    try {
        var value = Loop.encode(Loop.create()).finish();
        for (var i = 0; i < 5; ++i)
            value = Loop.encode(Loop.create({
                next: Any.create({
                    type_url: "type.googleapis.com/Loop",
                    value: value
                })
            })).finish();

        var message = Loop.decode(value);

        test.throws(function() {
            JSON.stringify(message);
        }, /max depth exceeded/, "should reject excessive Any JSON expansion depth");

        var shallow = Loop.decode(Loop.encode(Loop.create({
            next: Any.create({
                type_url: "type.googleapis.com/Loop",
                value: Loop.encode(Loop.create()).finish()
            })
        })).finish());
        test.same(JSON.parse(JSON.stringify(shallow)), { next: { "@type": "type.googleapis.com/Loop" } }, "should expand Any values within the recursion limit");
    } finally {
        protobuf.util.recursionLimit = recursionLimit;
    }

    test.end();
});

tape.test("google.protobuf.Any - deeply nested Any with default limits", function(test) {

    var depth = 1000;
    var value = Loop.encode(Loop.create()).finish(),
        any;
    for (var i = 0; i < depth; ++i) {
        any = Any.create({
            type_url: "type.googleapis.com/Loop",
            value: value
        });
        value = Loop.encode(Loop.create({ next: any })).finish();
    }

    var message = Loop.decode(value);

    // Expansion is bounded either by the conversion depth guard ("max depth exceeded") or by the
    // decoder's nesting guard ("maximum nesting depth exceeded") the expanded value is decoded with,
    // but never by exhausting the call stack ("Maximum call stack size exceeded").
    test.throws(function() {
        JSON.stringify(message);
    }, /depth exceeded/, "should reject deeply nested Any values via JSON.stringify");
    test.throws(function() {
        message.toJSON();
    }, /depth exceeded/, "should reject deeply nested Any values via Message#toJSON");
    test.throws(function() {
        Loop.toObject(message, { json: true });
    }, /depth exceeded/, "should reject deeply nested Any values via Type#toObject");
    test.throws(function() {
        Any.toObject(Any.decode(Any.encode(any).finish()), { json: true });
    }, /depth exceeded/, "should reject deeply nested Any values when converting an Any directly");

    test.end();
});
