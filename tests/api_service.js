var tape = require("tape");

var protobuf = require("..");

var def = {
    methods: {},
    nested: {
        SomeEnum: {
            values: {}
        }
    }
};

var methodDef = {
    requestType: "MyRequest",
    requestStream: true,
    responseType: "MyResponse",
    responseStream: true,
    options: {}
};

tape.test("reflected services", function(test) {

    var MyService = protobuf.Service.fromJSON("MyService", def);
    test.same(MyService.toJSON(), def, "should construct without methods from and convert back to JSON");

    var MyMethod = protobuf.Method.fromJSON("MyMethod", methodDef);
    test.same(MyMethod.toJSON(), methodDef, "should constructos methods from and convert back to JSON");

    MyService.add(MyMethod);
    test.ok(MyService.get("MyMethod"), "should allow adding methods");
    var other = new protobuf.Enum("Other", {});
    MyService.add(other);
    test.ok(MyService.get("Other"), "should allow adding other nested objects");
    MyService.remove(other);
    test.notOk(MyService.get("Other"), "should allow removing other nested objects");
    MyService.add(new protobuf.Method("__proto__", undefined, "MyRequest", "MyResponse"));
    test.equal(MyService.get("__proto__"), null, "should ignore reserved method names");
    MyService.remove(MyMethod);
    test.notOk(MyService.get("Other"), "should allow removing methods");
    test.same(MyService.toJSON(), def, "should convert to initial JSON afterwards");

    def.methods.MyMethod = methodDef;
    MyService = protobuf.Service.fromJSON("MyService", def);
    test.same(MyService.toJSON(), def, "should construct with methods from and convert back to JSON");
    MyMethod = MyService.get("MyMethod");

    test.end();
});

tape.test("reflected services can call runtime-significant method names", function(test) {
    var root = protobuf.parse("syntax = \"proto3\"; message Req {} message Res {} service S { rpc rpcCall(Req) returns (Res); }").root;
    root.resolveAll();

    var Res = root.lookupType("Res"),
        service = root.lookupService("S").create(function(method, request, callback) {
            callback(null, Res.encode({}).finish());
        });

    service.rpcCall({}, function(err, response) {
        test.error(err, "should call method named rpcCall");
        test.ok(response instanceof Res.ctor, "should decode the response");
        test.end();
    });
});
