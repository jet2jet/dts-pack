declare module 'myModule/file1' {
    const Data1 = "data1";
    export { Data1 };
    export class MyClass {
        method1(): void;
    }
}

declare module 'myModule/file2' {
    const Data2 = "data2";
    export { Data2 };
    export default function myFunction(): void;
}

declare module 'myModule/index' {
    import * as file1 from 'myModule/file1';
    import * as file2 from 'myModule/file2';
    export { file1, file2 };
    export default function defFunc(): string;
}
