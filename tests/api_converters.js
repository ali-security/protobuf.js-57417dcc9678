var tape = require("tape");

var protobuf  = require("..");

tape.test("converters", function(test) {

    protobuf.load("tests/data/convert.proto", function(err, root) {
        if (err)
            return test.fail(err.message);

        var Message = root.lookup("Message");

        test.test(test.name + " - Message#toObject", function(test) {

            test.plan(7);

            test.test(test.name + " - called with defaults = true", function(test) {
                var obj = Message.toObject(Message.create(), { defaults: true });

                test.equal(obj.stringVal, "", "should set stringVal");
                test.same(obj.stringRepeated, [], "should set stringRepeated");

                test.same(obj.uint64Val, { low: 0, high: 0, unsigned: true }, "should set uint64Val");
                test.same(obj.uint64Repeated, [], "should set uint64Repeated");

                test.same(obj.bytesVal, protobuf.util.newBuffer(0), "should set bytesVal");
                test.same(obj.bytesRepeated, [], "should set bytesRepeated");

                test.equal(obj.enumVal, 1, "should set enumVal to the first defined value");
                test.same(obj.enumRepeated, [], "should set enumRepeated");

                test.same(obj.int64Map, {}, "should set int64Map");

                test.end();
            });

            test.test(test.name + " - called with defaults = undefined", function(test) {
                var obj = Message.toObject(Message.create());

                test.equal(obj.stringVal, undefined, "should not set stringVal");
                test.equal(obj.stringRepeated, undefined, "should not set stringRepeated");

                test.equal(obj.uint64Val, undefined, "should not set uint64Val");
                test.equal(obj.uint64Repeated, undefined, "should not set uint64Repeated");

                test.equal(obj.bytesVal, undefined, "should not set bytesVal");
                test.equal(obj.bytesRepeated, undefined, "should not set bytesRepeated");

                test.equal(obj.enumVal, undefined, "should not set enumVal");
                test.equal(obj.enumRepeated, undefined, "should not set enumRepeated");

                test.equal(obj.int64Map, undefined, "should not set int64 map");

                test.end();
            });

            test.test(test.name + " - called with arrays = true", function(test) {
                var obj = Message.toObject(Message.create(), { arrays: true });

                test.equal(obj.stringVal, undefined, "should not set stringVal");
                test.same(obj.stringRepeated, [], "should set stringRepeated");

                test.equal(obj.uint64Val, undefined, "should not set uint64Val");
                test.same(obj.uint64Repeated, [], "should set uint64Repeated");

                test.equal(obj.bytesVal, undefined, "should not set bytesVal");
                test.same(obj.bytesRepeated, [], "should set bytesRepeated");

                test.equal(obj.enumVal, undefined, "should not set enumVal");
                test.same(obj.enumRepeated, [], "should set enumRepeated");

                test.equal(obj.int64Map, undefined, "should not set int64Map");

                test.end();
            });

            test.test(test.name + " - called with objects = true", function(test) {
                var obj = Message.toObject(Message.create(), { objects: true });

                test.equal(obj.stringVal, undefined, "should not set stringVal");
                test.equal(obj.stringRepeated, undefined, "should not set stringRepeated");

                test.equal(obj.uint64Val, undefined, "should not set uint64Val");
                test.same(obj.uint64Repeated, undefined, "should not set uint64Repeated");

                test.equal(obj.bytesVal, undefined, "should not set bytesVal");
                test.same(obj.bytesRepeated, undefined, "should not set bytesRepeated");

                test.equal(obj.enumVal, undefined, "should not set enumVal");
                test.same(obj.enumRepeated, undefined, "should not set enumRepeated");

                test.same(obj.int64Map, {}, "should set int64Map");

                test.end();
            });

            test.test(test.name + " - should convert", function(test) {
                var buf = protobuf.util.newBuffer(3);
                buf[0] = buf[1] = buf[2] = 49; // "111"
                var msg = Message.create({
                    uint64Val: protobuf.util.Long.fromNumber(1),
                    uint64Repeated: [2, 3],
                    bytesVal: buf,
                    bytesRepeated: [buf, buf],
                    enumVal: 2,
                    enumRepeated: [1, 100, 2],
                    int64Map: {
                        a: protobuf.util.Long.fromNumber(2),
                        b: protobuf.util.Long.fromNumber(3)
                    }
                });

                var msgLongsToNumber = Message.toObject(msg, { longs: Number }),
                    msgLongsToString = Message.toObject(msg, { longs: String });

                test.same(Message.ctor.toObject(msg, { longs: Number}), msgLongsToNumber, "should convert the same using the static and the instance method");
                test.same(Message.ctor.toObject(msg, { longs: String}), msgLongsToString, "should convert the same using the static and the instance method");

                test.equal(msgLongsToNumber.uint64Val, 1, "longs to numbers");
                test.equal(msgLongsToString.uint64Val, "1", "longs to strings");
                test.same(msgLongsToNumber.int64Map, { a: 2, b: 3}, "long map values to numbers");
                test.same(msgLongsToString.int64Map, { a: "2", b: "3"}, "long map values to strings");

                test.equal(Object.prototype.toString.call(Message.toObject(msg, { bytes: Array }).bytesVal), "[object Array]", "bytes to arrays");
                test.equal(Message.toObject(msg, { bytes: String }).bytesVal, "MTEx", "bytes to base64 strings");
                if (protobuf.util.isNode)
                    test.ok(Buffer.isBuffer(Message.toObject(msg, { bytes: Buffer }).bytesVal), "bytes to buffers");

                test.equal(Message.toObject(msg, { enums: String }).enumVal, "TWO", "enums to strings");
                test.equal(Message.toObject(msg, { enums: String }).enumRepeated[1], 100, "enums to strings does not change unknown values");

                test.end();
            });

            test.test(test.name + " - Message.toObject with empty buffers", function(test) {
                var msg = Message.create({
                    bytesVal: protobuf.util.newBuffer(0),
                });

                test.equal(Message.toObject(msg, { bytes: String }).bytesVal, "", "bytes to base64 strings");

                if (protobuf.util.isNode) {
                    const bytesVal = Message.toObject(msg, { bytes: Buffer }).bytesVal; 
                    test.ok(Buffer.isBuffer(bytesVal), "bytes to buffers");
                    test.equal(bytesVal.length, 0, "empty buffer");
                }

                test.end();
            });            

            test.test(test.name + " - Message.toObject with bytes array defaults", function(test) {
                var root = protobuf.Root.fromJSON({
                    nested: {
                        Defaults: {
                            fields: {
                                bytes: {
                                    type: "bytes",
                                    id: 1,
                                    options: {
                                        "default": [ "not_a_number" ]
                                    }
                                }
                            }
                        }
                    }
                });
                var Defaults = root.lookupType("Defaults");
                var obj = Defaults.toObject({}, { defaults: true, bytes: Array });

                test.same(obj.bytes, [ "not_a_number" ], "should preserve bytes array defaults");

                test.end();
            });

        });

        test.test(test.name + " - Message.fromObject", function(test) {

            var obj = {
                uint64Val: 1,
                uint64Repeated: [1, "2"],
                bytesVal: "MTEx",
                bytesRepeated: ["MTEx", [49, 49, 49]],
                enumVal: "ONE",
                enumRepeated: [2, "TWO", 100],
                int64Map: {
                    a: 2,
                    b: "3"
                }
            };
            var msg = Message.fromObject(obj);

            test.same(Message.ctor.fromObject(obj), msg, "should convert the same using the static and the instance method");
            test.equal(Message.fromObject(msg), msg, "should just return the object if already a runtime message");

            var buf = protobuf.util.newBuffer(3);
            buf[0] = buf[1] = buf[2] = 49; // "111"

            test.same(msg.uint64Val, { low: 1, high: 0, unsigned: true }, "should set uint64Val from a number");
            test.same(msg.uint64Repeated, [ { low: 1, high: 0, unsigned: true}, { low: 2, high: 0, unsigned: true } ], "should set uint64Repeated from a number and a string");
            test.same(msg.bytesVal, buf, "should set bytesVal from a base64 string");
            test.same(msg.bytesRepeated, [ buf, buf ], "should set bytesRepeated from a base64 string and a plain array");
            test.equal(msg.enumVal, 1, "should set enumVal from a string");
            test.same(msg.enumRepeated, [ 2, 2, 100 ], "should set enumRepeated from a number and a string and preserve unknown value");
            test.same(msg.int64Map, { a: { low: 2, high: 0, unsigned: false }, b: { low: 3, high: 0, unsigned: false } }, "should set int64Map from a number and a string");

            test.end();
        });

        test.test(test.name + " - Type.toObject recursion limit", function(test) {
            var recursionLimit = protobuf.util.recursionLimit;
            protobuf.util.recursionLimit = 3;
            try {
                var nestedRoot = protobuf.Root.fromJSON({
                    nested: {
                        Recursive: {
                            fields: {
                                next: {
                                    type: "Recursive",
                                    id: 1
                                }
                            }
                        }
                    }
                });
                var Recursive = nestedRoot.lookupType("Recursive");
                var msg = Recursive.create();
                var cursor = msg;
                for (var i = 0; i < 5; ++i)
                    cursor = cursor.next = Recursive.create();

                test.throws(function() {
                    Recursive.toObject(msg);
                }, /max depth exceeded/, "should reject excessive object conversion depth");
            } finally {
                protobuf.util.recursionLimit = recursionLimit;
            }

            test.end();
        });

        test.test(test.name + " - Type.toObject recursion limit (singular, repeated and map fields)", function(test) {
            function nestedObject(depth, field) {
                var object = { value: 42 };
                for (var i = 0; i < depth; ++i) {
                    if (field === "child")
                        object = { child: object };
                    else if (field === "children")
                        object = { children: [ object ] };
                    else
                        object = { childMap: { child: object } };
                }
                return object;
            }

            var nodeRoot = protobuf.Root.fromJSON({
                nested: {
                    Node: {
                        fields: {
                            child: { type: "Node", id: 1 },
                            children: { rule: "repeated", type: "Node", id: 2 },
                            childMap: { keyType: "string", type: "Node", id: 3 },
                            value: { type: "int32", id: 4 }
                        }
                    }
                }
            });
            var Node = nodeRoot.lookupType("Node");
            var recursionLimit = protobuf.util.recursionLimit;

            protobuf.util.recursionLimit = 3;
            try {
                [ "child", "children", "childMap" ].forEach(function(field) {
                    var message = Node.fromObject(nestedObject(3, field));
                    test.same(Node.toObject(message), nestedObject(3, field), "should convert " + field + " nesting up to the recursion limit");
                    test.throws(function() {
                        Node.toObject(nestedObject(4, field));
                    }, /max depth exceeded/, "should reject excessive " + field + " conversion depth");
                });
            } finally {
                protobuf.util.recursionLimit = recursionLimit;
            }

            test.end();
        });

        test.test(test.name + " - Type.toObject setup preserves nesting", function(test) {
            var setupRoot = protobuf.Root.fromJSON({
                nested: {
                    Parent: {
                        fields: {
                            child: { type: "Child", id: 1 }
                        }
                    },
                    Child: {
                        fields: {
                            next: { type: "Child", id: 1 },
                            value: { type: "int32", id: 2 }
                        }
                    }
                }
            });
            var Parent = setupRoot.lookupType("Parent");
            var recursionLimit = protobuf.util.recursionLimit;

            protobuf.util.recursionLimit = 1;
            try {
                test.throws(function() {
                    Parent.toObject({ child: { next: { value: 42 } } });
                }, /max depth exceeded/, "should preserve depth through nested type setup");
            } finally {
                protobuf.util.recursionLimit = recursionLimit;
            }

            test.end();
        });

        test.test(test.name + " - deeply nested messages with default limits", function(test) {
            var deepRoot = protobuf.Root.fromJSON({
                nested: {
                    Recursive: {
                        fields: {
                            next: {
                                type: "Recursive",
                                id: 1
                            }
                        }
                    }
                }
            });
            var Recursive = deepRoot.lookupType("Recursive");

            function chain(depth) {
                var object = {};
                for (var i = 0; i < depth; ++i)
                    object = { next: object };
                return object;
            }

            test.doesNotThrow(function() {
                Recursive.toObject(chain(protobuf.util.recursionLimit));
            }, "should convert nesting up to the default recursion limit");
            test.throws(function() {
                Recursive.toObject(chain(protobuf.util.recursionLimit + 1));
            }, /max depth exceeded/, "should reject nesting just beyond the default recursion limit");
            test.throws(function() {
                Recursive.toObject(chain(100000));
            }, /max depth exceeded/, "should reject deeply nested messages instead of exhausting the call stack");

            var msg = Recursive.create(),
                cursor = msg;
            for (var i = 0; i < 100000; ++i)
                cursor = cursor.next = Recursive.create();
            test.throws(function() {
                JSON.stringify(msg);
            }, /max depth exceeded/, "should reject deeply nested messages during JSON conversion");

            test.end();
        });

        test.test(test.name + " - Message#toJSON", function(test) {
            var msg = Message.create();
            msg.$type = {
                toObject: function(obj, opt) {
                    test.same(opt, protobuf.util.toJSONOptions, "should use toJSONOptions with toJSON");
                    test.end();
                }
            };
            msg.toJSON();
        });

        test.end();
    });

});
