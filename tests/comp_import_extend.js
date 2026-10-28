"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var tape = require("tape");
var protobuf = require("../index");
// to extend Root
var descriptor = require("../ext/descriptor");
tape.test("extensions", function (test) {
    // load document with extended field imported multiple times
    var root = protobuf.loadSync(path.resolve(__dirname, "data/test.proto"));
    root.resolveAll();
    // convert to Descriptor Set
    var decodedDescriptorSet = root.toDescriptor("proto3");
    // load back from descriptor set
    var root2 = protobuf.Root.fromDescriptor(decodedDescriptorSet);
    test.pass("should parse and resolve without errors");
    test.end();
});

tape.test("extensions - descriptor type names", function(test) {
    var field = descriptor.FieldDescriptorProto.create({
        name: "field",
        number: 1,
        label: 1,
        type: 11,
        typeName: ".pkg.Message"
    });

    test.equal(protobuf.Field.fromDescriptor(field).type, ".pkg.Message", "should accept qualified type names");

    field.typeName = ".pkg.Message;bad";
    test.throws(function() {
        protobuf.Field.fromDescriptor(field);
    }, /illegal type name/, "should reject invalid type names");

    field.typeName = ".pkg.Message";
    field.extendee = ".pkg.Message;bad";
    test.throws(function() {
        protobuf.Field.fromDescriptor(field);
    }, /illegal type name/, "should reject invalid extendee names");

    var method = descriptor.MethodDescriptorProto.create({
        name: "Call",
        inputType: ".pkg.Request",
        outputType: ".pkg.Response"
    });
    test.equal(protobuf.Method.fromDescriptor(method).requestType, ".pkg.Request", "should accept method type names");

    method.inputType = ".pkg.Request;bad";
    test.throws(function() {
        protobuf.Method.fromDescriptor(method);
    }, /illegal type name/, "should reject invalid method type names");

    test.end();
});
