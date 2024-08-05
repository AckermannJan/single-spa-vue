import { babel } from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default [
  ...createConfig("umd"),
  ...createConfig("esm"),
  ...createConfig("cjs"),
  ...createConfig("system"),
];

function createConfig(format) {
  return [
    {
      input: "./src/single-spa-vue.ts",
      output: {
        name: format === "umd" ? "singleSpaVue" : undefined,
        sourcemap: true,
        format: format,
        file: `dist/single-spa-vue.${format}.js`,
        globals: {
          vue: "vue",
        },
      },
      plugins: [
        babel({
          exclude: "node_modules/**",
          babelHelpers: "inline",
        }),
        resolve(),
        commonjs(),
        terser(),
        typescript({
          tsconfig: "./tsconfig.build.json",
        }),
      ],
      external: ["vue", "vue2"],
    },
    {
      input: "./src/parcel.ts",
      output: {
        name: format === "umd" ? "singleSpaVue" : undefined,
        sourcemap: true,
        format,
        file: `dist/single-spa-vue.${format}.js`,
        globals: {
          vue: "vue",
        },
      },
      plugins: [
        babel({
          exclude: "node_modules/**",
          babelHelpers: "inline",
        }),
        resolve(),
        commonjs(),
        terser(),
        typescript({
          tsconfig: "./tsconfig.build.json",
        }),
      ],
      external: ["vue", "vue2"],
    },
  ];
}
