var tape = require("tape");

var protobuf = require("..");

var def = {
    fields: {}
};

var def2 = {
    fields: {
        a: {
            type: "uint32",
            id: 1
        }
    },
    oneofs: {
        kind: {
            oneof: ["a"]
        }
    },
    extensions: [[1000, 2000]],
    reserved: [[900, 999], "b"],
    nested: {
        Type: {
            values: { ONE: 1, TWO: 2 }
        },
        Service: {
            methods: {}
        }
    },
    options: {
        custom: true
    }
};

tape.test("reflected types", function(test) {

    var type = protobuf.Type.fromJSON("Test", def);
    test.same(type.toJSON(), def, "should construct from and convert back to JSON");
    type = protobuf.Type.fromJSON("Test", def2);
    test.same(JSON.parse(JSON.stringify(type)), JSON.parse(JSON.stringify(def2)), "should construct from and convert back to JSON (complex parsed)");

    function MyMessageAuto() {}
    type.ctor = MyMessageAuto;
    test.ok(MyMessageAuto.prototype instanceof protobuf.Message, "should properly register a constructor through assignment");
    test.ok(typeof MyMessageAuto.encode === "function", "should populate static methods on assigned constructors");

    function MyMessageManual() {}
    MyMessageManual.prototype = Object.create(protobuf.Message.prototype);
    type.ctor = MyMessageManual;
    test.ok(MyMessageManual.prototype instanceof protobuf.Message, "should properly register a constructor through assignment if already extending message");
    test.ok(typeof MyMessageManual.encode === "function", "should populate static methods on assigned constructors");

    type = protobuf.Type.fromJSON("My", {
        fields: {
            a: {
                type: "string",
                id: 1
            }
        },
        reserved: [[900, 999], "b"],
        nested: {
            Type: { fields: {} },
            Enum: { values: {} },
            Service: { methods: {} },
            extensionField: { type: "string", id: 1000, extend: "Message" },
            Other: { nested: {} }
        }
    });
    test.same(type.toJSON(), {
        fields: {
            a: { id: 1, type: "string" }
        },
        reserved: [[900, 999], "b"],
        nested: {
            Type: { fields: {} },
            Enum: { values: {} },
            Service: { methods: {} },
            extensionField: { extend: "Message", id: 1000, type: "string" },
            Other: { }
        }
    }, "should create from Field, Type, Enum, Service, extension Field and Namespace JSON");

    test.throws(function() {
        type.add(new protobuf.Enum("Enum"));
    }, Error, "should throw when trying to add duplicate names");

    test.throws(function() {
        type.add(new protobuf.Field("c", 1, "uint32"));
    }, Error, "should throw when trying to add duplicate ids");

    test.throws(function() {
        type.add(new protobuf.Field("c", 900, "uint32"));
    }, Error, "should throw when trying to add reserved ids");

    test.throws(function() {
        type.add(new protobuf.Field("b", 2, "uint32"));
    }, Error, "should throw when trying to add reserved names");


    test.end();
});

tape.test("generated message constructors", function(test) {
    var root = protobuf.Root.fromJSON({
        nested: {
            Message: {
                fields: {
                    value: { type: "uint32", id: 1 }
                }
            }
        }
    });
    var Message = root.lookupType("Message");
    var msg = new Message.ctor(JSON.parse("{\"__proto__\":{\"marker\":true},\"value\":1}"));

    test.equal(msg.value, 1, "should copy regular properties");
    test.equal(msg.marker, undefined, "should ignore reserved properties");

    var type = new protobuf.Type("Type");
    type.add(new protobuf.Field("__proto__", 2, "uint32"));
    test.equal(type.get("__proto__"), null, "should ignore reserved field names");
    type.add(new protobuf.OneOf("__proto__"));
    test.equal(type.get("__proto__"), null, "should ignore reserved oneof names");

    test.end();
});

tape.test("decode nesting", function(test) {
    function varint(value) {
        var bytes = [];
        do {
            var b = value & 0x7F;
            value >>>= 7;
            if (value)
                b |= 0x80;
            bytes.push(b);
        } while (value);
        return bytes;
    }

    function nestedPayload(depth) {
        var payload = [ 0x10, 0x2A ];
        for (var i = 0; i < depth; ++i)
            payload = [ 0x0A ].concat(varint(payload.length), payload);
        return protobuf.util.newBuffer(payload);
    }

    var root = protobuf.Root.fromJSON({
        nested: {
            Node: {
                fields: {
                    child: { type: "Node", id: 1 },
                    value: { type: "int32", id: 2 }
                }
            }
        }
    });
    var Node = root.lookupType("Node");
    var recursionLimit = protobuf.Reader.recursionLimit;

    protobuf.Reader.recursionLimit = 3;
    try {
        test.equal(Node.decode(nestedPayload(2)).child.child.value, 42, "should decode below the limit");
        test.throws(function() {
            Node.decode(nestedPayload(4));
        }, /maximum nesting depth exceeded/, "should reject excessive nesting");
    } finally {
        protobuf.Reader.recursionLimit = recursionLimit;
    }

    test.end();
});

tape.test("object conversion nesting", function(test) {
    function nestedObject(depth) {
        var object = { value: 42 };
        for (var i = 0; i < depth; ++i)
            object = { child: object };
        return object;
    }

    var root = protobuf.Root.fromJSON({
        nested: {
            Node: {
                fields: {
                    child: { type: "Node", id: 1 },
                    value: { type: "int32", id: 2 }
                }
            }
        }
    });
    var Node = root.lookupType("Node");
    var recursionLimit = protobuf.util.recursionLimit;

    protobuf.util.recursionLimit = 3;
    try {
        test.equal(Node.verify(nestedObject(2)), null, "should verify below the limit");
        test.match(Node.verify(nestedObject(4)), /maximum nesting depth exceeded/, "should reject excessive nesting while verifying");
        test.equal(Node.fromObject(nestedObject(2)).child.child.value, 42, "should convert below the limit");
        test.throws(function() {
            Node.fromObject(nestedObject(4));
        }, /maximum nesting depth exceeded/, "should reject excessive nesting while converting");
    } finally {
        protobuf.util.recursionLimit = recursionLimit;
    }

    test.end();
});
