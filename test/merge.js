var libPath = require('../lib/_libPath.js');
var merge = require('../' + libPath + '/merge');

describe('merge', function() {
    describe('+merge()', function() {
        it('should merge the passed objects together', function() { 
            var original = { a: "a", b: "b" };
            var secondary = { c: "c" };
            var expected = { a: "a", b: "b",c: "c" };
                     
            merge.merge(original, expected).should.eql(expected);  
        });
        
        it('should replace values in the original', function() {
            var original = { a: "a", b: "b" };
            var secondary = { a: "c" };
            var expected = { a: "c", b: "b" };
            
            merge.merge(original, expected).should.eql(expected);  
        });
        
        it('should should not merge non-recursively if not speficied', function() {
            var original = { a: "a", b: ["1", "2", "3"], c: { a: "a", b: "b", c: "c" } };
            var secondary = { b: ["1"], c: { a: "a" } };
            var expected = { a: "a", b: ["1"], c: { a: "a" } };
            
            merge.merge(original, expected).should.eql(expected);  
        });
        
        it('should should merge recursively if speficied', function() {
            var original = { a: "a", b: ["1", "2", "3"], c: { a: "a", b: "b", c: "c" } };
            var secondary = { b: ["1"], c: { d: "d" } };
            var expected = { a: "a", b: ["1", "2", "3", "1"], c: { a: "a", b: "b", c: "c", d: "d" } };
            
            merge.merge(original, expected, true).should.eql(expected);  
        });
    });
    
    describe('+clone()', function() {
        it('should copy the passed object', function() {
            var original = { a: "a", b: "b" };
            merge.clone(original).should.eql(original);
            
            original = { a: "a", b: { c: "c", d: "d" } };
            merge.clone(original).should.eql(original);
            
            original = { a: "a", b: ["c", "d", "e"] };
            merge.clone(original).should.eql(original);
            
            original = null; 
            (merge.clone(original) == null).should.be.true;
        });
        

        it('should prevent changes to the original object affecting the copy', function() {
            var original = { a: "a", b: "b" };
            var output = merge.clone(original);
            original = { b: "c" }
            output.should.not.equal(original);
            
            original = { a: "a", b: { c: "c" } }
            output = merge.clone(original);
            original.c = "d";
            output.should.not.equal(original);
        });
                    

        it('should copy the passed array', function() {
            var original = [ "a", "b", "c" ];
            merge.clone(original).should.eql(original);
            
            original = [ [ "a", "b", "c" ], "d", "e" ];
            merge.clone(original).should.eql(original);
        });
        
        
        it('use an objects clone method if defined', function() {
            function CloneableObject() {
                if(!(this instanceof CloneableObject)) { return new CloneableObject(); }

                this.cloned = false;
                this.clone = function() {
                    this.cloned = true;
                    return this;
                }
            }
            
            var object = new CloneableObject();
            
            merge.clone(object).cloned.should.be.true;
        });
        
        
    });
});