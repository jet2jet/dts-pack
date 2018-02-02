declare namespace myModule.file1 {
    namespace module {
        const Data1 = "data1";
        class MyClass {
            method1(): void;
        }
    }
    export import Data1 = module.Data1;
    export import MyClass = module.MyClass;
}
declare namespace myModule.file2 {
    namespace module {
        const Data2 = "data2";
        function myFunction(): void;
    }
    export import Data2 = module.Data2;
    export import _default = module.myFunction;
}
declare namespace myModule.index {
    namespace module {
        import file1 = myModule.file1;
        import file2 = myModule.file2;
        function defFunc(): string;
    }
    export import file1 = myModule.file1;
    export import file2 = myModule.file2;
    export import _default = module.defFunc;
}
export = myModule.index._default;
