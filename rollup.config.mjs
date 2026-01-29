import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import pkg from "./package.json" with { type: "json" };

export default [
    {
        input: 'src/index.ts',
        output: {
            file: pkg.module,
            format: 'module'
        },
        plugins: [typescript()]
    },
    {
        input: 'src/browser.ts',
        output: {
            name: 'denden',
            file: pkg.browser,
            format: 'iife'
        },
        plugins: [typescript(), terser()]
    }
];