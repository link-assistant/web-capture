# Complete registry-resolved dependency inventory

Resolved on 2026-10-08 UTC. Before is the prepared branch, after is the committed resolution.

## npm: runtime, tools, development and all lockfile entries

| Dependency | Before | Registry latest | After | Reason for older/removal |
| --- | --- | --- | --- | --- |
| @babel/code-frame | 7.29.7, 8.0.6 | 8.0.6 | 7.29.7 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7; @babel/template@7.29.7: ^7.29.7; @babel/traverse@7.29.10: ^7.29.7; jest-message-util@30.5.1: ^7.27.1; parse-json@5.2.0: ^7.0.0 |
| @babel/compat-data | 7.29.7, 8.0.5 | 8.0.5 | 7.29.7 | Current upstream parents retain these version slots: @babel/helper-compilation-targets@7.29.7: ^7.29.7 |
| @babel/core | 7.29.7, 8.0.7 | 8.0.7 | 7.29.7 | Current upstream parents retain these version slots: @babel/helper-module-transforms@7.29.7: ^7.0.0; @babel/plugin-syntax-async-generators@7.8.4: ^7.0.0-0; @babel/plugin-syntax-bigint@7.8.3: ^7.0.0-0; @babel/plugin-syntax-class-properties@7.12.13: ^7.0.0-0; @babel/plugin-syntax-class-static-block@7.14.5: ^7.0.0-0; @babel/plugin-syntax-import-attributes@7.29.7: ^7.0.0-0; @babel/plugin-syntax-import-meta@7.10.4: ^7.0.0-0; @babel/plugin-syntax-json-strings@7.8.3: ^7.0.0-0; @babel/plugin-syntax-jsx@7.29.7: ^7.0.0-0; @babel/plugin-syntax-logical-assignment-operators@7.10.4: ^7.0.0-0; @babel/plugin-syntax-nullish-coalescing-operator@7.8.3: ^7.0.0-0; @babel/plugin-syntax-numeric-separator@7.10.4: ^7.0.0-0; @babel/plugin-syntax-object-rest-spread@7.8.3: ^7.0.0-0; @babel/plugin-syntax-optional-catch-binding@7.8.3: ^7.0.0-0; @babel/plugin-syntax-optional-chaining@7.8.3: ^7.0.0-0; @babel/plugin-syntax-private-property-in-object@7.14.5: ^7.0.0-0; @babel/plugin-syntax-top-level-await@7.14.5: ^7.0.0-0; @babel/plugin-syntax-typescript@7.29.7: ^7.0.0-0; @jest/transform@30.5.2: ^7.27.4; babel-jest@30.5.2: ^7.11.0 \|\| ^8.0.0-0; babel-preset-current-node-syntax@1.2.0: ^7.0.0 \|\| ^8.0.0-0; babel-preset-jest@30.5.0: ^7.11.0 \|\| ^8.0.0-beta.1 \|\| ^8.0.0; istanbul-lib-instrument@6.0.3: ^7.23.9; jest-config@30.5.2: ^7.27.4; jest-snapshot@30.5.2: ^7.27.4 |
| @babel/generator | 7.29.8, 8.0.6 | 8.0.6 | 7.29.8 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7; @babel/traverse@7.29.10: ^7.29.8; jest-snapshot@30.5.2: ^7.27.5 |
| @babel/helper-annotate-as-pure | 8.0.0 | 8.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-compilation-targets | 7.29.7, 8.0.7 | 8.0.7 | 7.29.7 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7 |
| @babel/helper-create-class-features-plugin | 8.0.7 | 8.0.7 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-create-regexp-features-plugin | 8.0.7 | 8.0.7 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-define-polyfill-provider | 1.0.0 | 1.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-globals | 7.29.7, 8.0.6 | 8.0.6 | 7.29.7 | Current upstream parents retain these version slots: @babel/traverse@7.29.10: ^7.29.7 |
| @babel/helper-member-expression-to-functions | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-module-imports | 7.29.7, 8.0.0 | 8.0.0 | 7.29.7 | Current upstream parents retain these version slots: @babel/helper-module-transforms@7.29.7: ^7.29.7 |
| @babel/helper-module-transforms | 7.29.7, 8.0.6 | 8.0.6 | 7.29.7 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7 |
| @babel/helper-optimise-call-expression | 8.0.0 | 8.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-plugin-utils | 7.29.7, 8.0.1 | 8.0.1 | 7.29.7 | Current upstream parents retain these version slots: @babel/plugin-syntax-async-generators@7.8.4: ^7.8.0; @babel/plugin-syntax-bigint@7.8.3: ^7.8.0; @babel/plugin-syntax-class-properties@7.12.13: ^7.12.13; @babel/plugin-syntax-class-static-block@7.14.5: ^7.14.5; @babel/plugin-syntax-import-attributes@7.29.7: ^7.29.7; @babel/plugin-syntax-import-meta@7.10.4: ^7.10.4; @babel/plugin-syntax-json-strings@7.8.3: ^7.8.0; @babel/plugin-syntax-jsx@7.29.7: ^7.29.7; @babel/plugin-syntax-logical-assignment-operators@7.10.4: ^7.10.4; @babel/plugin-syntax-nullish-coalescing-operator@7.8.3: ^7.8.0; @babel/plugin-syntax-numeric-separator@7.10.4: ^7.10.4; @babel/plugin-syntax-object-rest-spread@7.8.3: ^7.8.0; @babel/plugin-syntax-optional-catch-binding@7.8.3: ^7.8.0; @babel/plugin-syntax-optional-chaining@7.8.3: ^7.8.0; @babel/plugin-syntax-private-property-in-object@7.14.5: ^7.14.5; @babel/plugin-syntax-top-level-await@7.14.5: ^7.14.5; @babel/plugin-syntax-typescript@7.29.7: ^7.29.7; babel-plugin-istanbul@8.0.0: ^7.0.0 |
| @babel/helper-remap-async-to-generator | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-replace-supers | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-skip-transparent-expression-wrappers | 8.0.0 | 8.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helper-string-parser | 7.29.7, 8.0.6 | 8.0.6 | 7.29.7 | Current upstream parents retain these version slots: @babel/types@7.29.8: ^7.29.7 |
| @babel/helper-validator-identifier | 7.29.7, 8.0.6 | 8.0.6 | 7.29.7 | Current upstream parents retain these version slots: @babel/code-frame@7.29.7: ^7.29.7; @babel/helper-module-transforms@7.29.7: ^7.29.7; @babel/types@7.29.8: ^7.29.7 |
| @babel/helper-validator-option | 7.29.7, 8.0.0 | 8.0.0 | 7.29.7 | Current upstream parents retain these version slots: @babel/helper-compilation-targets@7.29.7: ^7.29.7 |
| @babel/helper-wrap-function | 8.0.0 | 8.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/helpers | 7.29.10, 8.0.7 | 8.0.7 | 7.29.10 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7 |
| @babel/parser | 7.29.9, 8.0.7 | 8.0.7 | 7.29.9 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7; @babel/generator@7.29.8: ^7.29.8; @babel/template@7.29.7: ^7.29.7; @babel/traverse@7.29.10: ^7.29.9; @types/babel__core@7.20.5: ^7.20.7; @types/babel__template@7.4.4: ^7.1.0; istanbul-lib-instrument@6.0.3: ^7.23.9 |
| @babel/plugin-bugfix-firefox-class-in-computed-class-key | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-bugfix-safari-class-field-initializer-scope | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-bugfix-safari-rest-destructuring-rhs-array | 8.0.6 | 8.0.6 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-bugfix-v8-static-class-fields-redefine-readonly | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-syntax-async-generators | 7.8.4 | 7.8.4 | 7.8.4 | Current |
| @babel/plugin-syntax-bigint | 7.8.3 | 7.8.3 | 7.8.3 | Current |
| @babel/plugin-syntax-class-properties | 7.12.13 | 7.12.13 | 7.12.13 | Current |
| @babel/plugin-syntax-class-static-block | 7.14.5 | 7.14.5 | 7.14.5 | Current |
| @babel/plugin-syntax-import-attributes | 7.29.7 | 7.29.7 | 7.29.7 | Current |
| @babel/plugin-syntax-import-meta | 7.10.4 | 7.10.4 | 7.10.4 | Current |
| @babel/plugin-syntax-json-strings | 7.8.3 | 7.8.3 | 7.8.3 | Current |
| @babel/plugin-syntax-jsx | 7.29.7 | 8.0.1 | 7.29.7 | Current upstream parents retain these version slots: jest-snapshot@30.5.2: ^7.27.1 |
| @babel/plugin-syntax-logical-assignment-operators | 7.10.4 | 7.10.4 | 7.10.4 | Current |
| @babel/plugin-syntax-nullish-coalescing-operator | 7.8.3 | 7.8.3 | 7.8.3 | Current |
| @babel/plugin-syntax-numeric-separator | 7.10.4 | 7.10.4 | 7.10.4 | Current |
| @babel/plugin-syntax-object-rest-spread | 7.8.3 | 7.8.3 | 7.8.3 | Current |
| @babel/plugin-syntax-optional-catch-binding | 7.8.3 | 7.8.3 | 7.8.3 | Current |
| @babel/plugin-syntax-optional-chaining | 7.8.3 | 7.8.3 | 7.8.3 | Current |
| @babel/plugin-syntax-private-property-in-object | 7.14.5 | 7.14.5 | 7.14.5 | Current |
| @babel/plugin-syntax-top-level-await | 7.14.5 | 7.14.5 | 7.14.5 | Current |
| @babel/plugin-syntax-typescript | 7.29.7 | 8.0.3 | 7.29.7 | Current upstream parents retain these version slots: jest-snapshot@30.5.2: ^7.27.1 |
| @babel/plugin-transform-arrow-functions | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-async-generator-functions | 8.0.6 | 8.0.6 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-async-to-generator | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-block-scoped-functions | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-block-scoping | 8.0.7 | 8.0.7 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-class-properties | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-class-static-block | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-classes | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-computed-properties | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-destructuring | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-dotall-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-duplicate-keys | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-duplicate-named-capturing-groups-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-dynamic-import | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-explicit-resource-management | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-exponentiation-operator | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-export-namespace-from | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-for-of | 8.0.7 | 8.0.7 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-function-name | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-json-strings | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-literals | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-logical-assignment-operators | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-member-expression-literals | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-modules-amd | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-modules-commonjs | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-modules-systemjs | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-modules-umd | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-named-capturing-groups-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-new-target | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-nullish-coalescing-operator | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-numeric-separator | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-object-rest-spread | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-object-super | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-optional-catch-binding | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-optional-chaining | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-parameters | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-private-methods | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-private-property-in-object | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-property-literals | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-regenerator | 8.0.6 | 8.0.6 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-regexp-modifiers | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-reserved-words | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-shorthand-properties | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-spread | 8.0.5 | 8.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-sticky-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-template-literals | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-typeof-symbol | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-unicode-escapes | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-unicode-property-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-unicode-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/plugin-transform-unicode-sets-regex | 8.0.1 | 8.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/preset-env | 8.0.7 | 8.0.7 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/preset-modules | 0.2.0 | 0.2.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @babel/template | 7.29.7, 8.0.0 | 8.0.0 | 7.29.7 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7; @babel/helpers@7.29.10: ^7.29.7; @babel/traverse@7.29.10: ^7.29.7 |
| @babel/traverse | 7.29.10, 8.0.7 | 8.0.7 | 7.29.10 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7; @babel/helper-module-imports@7.29.7: ^7.29.7; @babel/helper-module-transforms@7.29.7: ^7.29.7 |
| @babel/types | 7.29.8, 8.0.6 | 8.0.6 | 7.29.8 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^7.29.7; @babel/generator@7.29.8: ^7.29.8; @babel/helper-module-imports@7.29.7: ^7.29.7; @babel/helpers@7.29.10: ^7.29.8; @babel/parser@7.29.9: ^7.29.8; @babel/template@7.29.7: ^7.29.7; @babel/traverse@7.29.10: ^7.29.8; @types/babel__core@7.20.5: ^7.20.7; @types/babel__generator@7.27.0: ^7.0.0; @types/babel__template@7.4.4: ^7.0.0; @types/babel__traverse@7.28.0: ^7.28.2; jest-snapshot@30.5.2: ^7.27.3 |
| @bcoe/v8-coverage | 0.2.3 | 1.0.2 | 0.2.3 | Current upstream parents retain these version slots: @jest/reporters@30.5.2: ^0.2.3 |
| @cacheable/memory | 2.2.0 | 2.2.0 | 2.2.0 | Current |
| @cacheable/utils | 2.5.0 | 2.5.0 | 2.5.0 | Current |
| @changesets/apply-release-plan | 8.1.1 | 8.1.1 | 8.1.1 | Current |
| @changesets/assemble-release-plan | 7.0.0 | 7.0.0 | 7.0.0 | Current |
| @changesets/changelog-git | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| @changesets/cli | 3.0.3 | 3.0.3 | 3.0.3 | Current |
| @changesets/config | 4.0.1 | 4.0.1 | 4.0.1 | Current |
| @changesets/errors | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| @changesets/format | 0.1.2 | 0.1.2 | 0.1.2 | Current |
| @changesets/get-dependents-graph | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| @changesets/git | 4.0.1 | 4.0.1 | 4.0.1 | Current |
| @changesets/parse | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| @changesets/pre | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| @changesets/read | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| @changesets/should-skip-package | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| @changesets/types | 7.0.0 | 7.0.0 | 7.0.0 | Current |
| @changesets/write | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| @clack/core | 1.5.1 | 1.5.1 | 1.5.1 | Current |
| @clack/prompts | 1.8.1 | 1.8.1 | 1.8.1 | Current |
| @emnapi/core | 1.10.0 | 1.11.3 | 1.10.0 | Current upstream parents retain these version slots: @napi-rs/wasm-runtime@1.2.5: ^1.7.1 \|\| ^2.0.0-alpha.4; @unrs/resolver-binding-wasm32-wasi@1.12.2: 1.10.0 |
| @emnapi/runtime | 1.10.0 | 1.11.3 | 1.10.0 | Current upstream parents retain these version slots: @napi-rs/wasm-runtime@1.2.5: ^1.7.1 \|\| ^2.0.0-alpha.4; @unrs/resolver-binding-wasm32-wasi@1.12.2: 1.10.0 |
| @emnapi/wasi-threads | 1.2.1 | 2.2.0 | 1.2.1 | Current upstream parents retain these version slots: @emnapi/core@1.10.0: 1.2.1 |
| @eslint-community/eslint-utils | 4.9.0 | 4.10.1 | 4.10.1 | Current |
| @eslint-community/regexpp | 4.12.2 | 4.12.2 | 4.12.2 | Current |
| @eslint/config-array | 0.23.5 | 0.23.5 | 0.23.5 | Current |
| @eslint/config-helpers | 0.7.0 | 0.7.0 | 0.7.0 | Current |
| @eslint/core | 1.2.1 | 1.2.1 | 1.2.1 | Current |
| @eslint/js | 10.0.1 | 10.0.1 | 10.0.1 | Current |
| @eslint/object-schema | 3.0.5 | 3.0.5 | 3.0.5 | Current |
| @eslint/plugin-kit | 0.7.3 | 0.7.3 | 0.7.3 | Current |
| @humanfs/core | 0.19.2 | 0.20.0 | 0.19.2 | Current upstream parents retain these version slots: @humanfs/node@0.16.8: ^0.19.2 |
| @humanfs/node | 0.16.8 | 0.17.0 | 0.16.8 | Current upstream parents retain these version slots: eslint@10.12.0: ^0.16.6 |
| @humanfs/types | 0.15.0 | 0.16.0 | 0.15.0 | Current upstream parents retain these version slots: @humanfs/core@0.19.2: ^0.15.0; @humanfs/node@0.16.8: ^0.15.0 |
| @humanwhocodes/module-importer | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| @humanwhocodes/retry | 0.4.3 | 0.4.3 | 0.4.3 | Current |
| @isaacs/cliui | 8.0.2 | 9.0.0 | 8.0.2 | Current upstream parents retain these version slots: jackspeak@3.4.3: ^8.0.2 |
| @istanbuljs/load-nyc-config | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| @istanbuljs/schema | 0.1.6 | 0.1.6 | 0.1.6 | Current |
| @jest/console | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/core | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/diff-sequences | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| @jest/environment | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/expect | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/expect-utils | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/fake-timers | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/get-type | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| @jest/globals | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/pattern | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| @jest/reporters | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/schemas | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| @jest/snapshot-utils | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| @jest/source-map | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/test-result | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/test-sequencer | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/transform | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| @jest/types | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| @jridgewell/gen-mapping | 0.3.13, 0.4.0-beta.0 | 0.3.13 | 0.3.13 | Current |
| @jridgewell/remapping | 2.3.5 | 2.3.5 | 2.3.5 | Current |
| @jridgewell/resolve-uri | 3.1.2 | 3.1.2 | 3.1.2 | Current |
| @jridgewell/sourcemap-codec | 1.6.0 | 1.6.0 | 1.6.0 | Current |
| @jridgewell/trace-mapping | 0.3.31 | 0.3.31 | 0.3.31 | Current |
| @keyv/bigmap | 1.3.1 | 6.1.0 | 1.3.1 | Current upstream parents retain these version slots: @cacheable/memory@2.2.0: ^1.3.1 |
| @keyv/serialize | 1.1.1 | 1.1.1 | 1.1.1 | Current |
| @kreuzberg/html-to-markdown-node | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @kreuzberg/html-to-markdown-node-darwin-arm64 | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @kreuzberg/html-to-markdown-node-darwin-x64 | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @kreuzberg/html-to-markdown-node-linux-arm64-gnu | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @kreuzberg/html-to-markdown-node-linux-arm64-musl | unlocked/not declared | 3.5.5 | unversioned optional placeholder | Upstream requires an unpublished version: @kreuzberg/html-to-markdown-node@3.7.2: 3.7.2; registry-current release cannot satisfy that exact requirement; npm 12 clean installation needs this optional placeholder (see VALIDATION.md) |
| @kreuzberg/html-to-markdown-node-linux-x64-gnu | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @kreuzberg/html-to-markdown-node-linux-x64-musl | unlocked/not declared | 3.5.5 | unversioned optional placeholder | Upstream requires an unpublished version: @kreuzberg/html-to-markdown-node@3.7.2: 3.7.2; registry-current release cannot satisfy that exact requirement; npm 12 clean installation needs this optional placeholder (see VALIDATION.md) |
| @kreuzberg/html-to-markdown-node-win32-arm64-msvc | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @kreuzberg/html-to-markdown-node-win32-x64-msvc | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| @manypkg/find-root | 3.1.0 | 3.1.0 | 3.1.0 | Current |
| @manypkg/get-packages | 3.1.0 | 3.1.0 | 3.1.0 | Current |
| @manypkg/tools | 2.1.2 | 2.1.2 | 2.1.2 | Current |
| @mixmark-io/domino | 2.2.0 | 2.2.0 | 2.2.0 | Current |
| @mswjs/interceptors | 0.44.0 | 0.45.7 | 0.44.0 | Current upstream parents retain these version slots: nock@15.0.1: ^0.44.0 |
| @napi-rs/wasm-runtime | 1.2.5 | 1.2.5 | 1.2.5 | Current |
| @noble/hashes | 1.8.0 | 2.4.0 | 1.8.0 | Current upstream parents retain these version slots: @paralleldrive/cuid2@2.3.1: ^1.1.5 |
| @open-draft/until | 3.0.1 | 3.0.1 | 3.0.1 | Current |
| @paralleldrive/cuid2 | 2.3.1 | 3.3.0 | 2.3.1 | Current upstream parents retain these version slots: formidable@3.5.4: ^2.2.2 |
| @parcel/watcher | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-android-arm64 | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-darwin-arm64 | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-darwin-x64 | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-freebsd-x64 | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-linux-arm-glibc | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-linux-arm-musl | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-linux-arm64-glibc | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-linux-arm64-musl | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-linux-x64-glibc | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-linux-x64-musl | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-win32-arm64 | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @parcel/watcher-win32-x64 | 2.6.0 | 2.6.0 | 2.6.0 | Current |
| @pkgjs/parseargs | 0.11.0 | 0.11.0 | 0.11.0 | Current |
| @pkgr/core | 0.3.6 | 0.3.6 | 0.3.6 | Current |
| @pnpm/deps.graph-sequencer | 1100.0.1 | 1101.0.0 | 1100.0.1 | Current upstream parents retain these version slots: @changesets/cli@3.0.3: ^1100.0.1 |
| @puppeteer/browsers | 3.2.3 | 3.2.3 | 3.2.3 | Current |
| @sec-ant/readable-stream | unlocked/not declared | 0.7.0 | 0.4.1 | Current upstream parents retain these version slots: get-stream@9.0.1: ^0.4.1 |
| @sinclair/typebox | 0.34.52 | 0.34.52 | 0.34.52 | Current |
| @sindresorhus/merge-streams | unlocked/not declared | 4.0.0 | 4.0.0 | Current |
| @sinonjs/commons | 3.0.1 | 4.0.0-alpha.0 | 3.0.1 | Current upstream parents retain these version slots: @sinonjs/fake-timers@15.4.0: ^3.0.1 |
| @sinonjs/fake-timers | 15.4.0 | 15.4.0 | 15.4.0 | Current |
| @tybys/wasm-util | 0.10.4 | 0.10.4 | 0.10.4 | Current |
| @types/archiver | 8.0.0 | 8.0.0 | 8.0.0 | Current |
| @types/babel__core | 7.20.5 | 7.20.5 | 7.20.5 | Current |
| @types/babel__generator | 7.27.0 | 7.27.0 | 7.27.0 | Current |
| @types/babel__template | 7.4.4 | 7.4.4 | 7.4.4 | Current |
| @types/babel__traverse | 7.28.0 | 7.28.0 | 7.28.0 | Current |
| @types/debug | 4.1.13 | 4.1.13 | 4.1.13 | Current |
| @types/esrecurse | 4.3.1 | 4.3.1 | 4.3.1 | Current |
| @types/estree | 1.0.8 | 1.0.9 | 1.0.9 | Current |
| @types/gensync | 1.0.5 | 1.0.5 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @types/istanbul-lib-coverage | 2.0.6 | 2.0.6 | 2.0.6 | Current |
| @types/istanbul-lib-report | 3.0.3 | 3.0.3 | 3.0.3 | Current |
| @types/istanbul-reports | 3.0.4 | 3.0.4 | 3.0.4 | Current |
| @types/jsesc | 2.5.1 | 3.0.3 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| @types/json-schema | 7.0.15 | 7.0.15 | 7.0.15 | Current |
| @types/ms | 2.1.0 | 2.1.0 | 2.1.0 | Current |
| @types/node | 26.6.4 | 26.6.4 | 26.6.4 | Current |
| @types/readdir-glob | 1.1.5 | 1.1.5 | 1.1.5 | Current |
| @types/stack-utils | 2.0.3 | 2.0.3 | 2.0.3 | Current |
| @types/yargs | 17.0.35 | 17.0.35 | 17.0.35 | Current |
| @types/yargs-parser | 21.0.3 | 21.0.3 | 21.0.3 | Current |
| @ungap/structured-clone | 1.4.0 | 1.4.0 | 1.4.0 | Current |
| @unrs/resolver-binding-android-arm-eabi | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-android-arm64 | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-darwin-arm64 | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-darwin-x64 | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-freebsd-x64 | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-arm-gnueabihf | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-arm-musleabihf | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-arm64-gnu | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-arm64-musl | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-loong64-gnu | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-loong64-musl | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-ppc64-gnu | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-riscv64-gnu | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-riscv64-musl | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-s390x-gnu | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-x64-gnu | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-linux-x64-musl | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-openharmony-arm64 | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-wasm32-wasi | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-win32-arm64-msvc | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-win32-ia32-msvc | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| @unrs/resolver-binding-win32-x64-msvc | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| abort-controller | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| accepts | 2.0.0 | 1.3.8 | 2.0.0 | Current upstream parents retain these version slots: express@5.2.1: ^2.0.0 |
| acorn | 8.19.0 | 8.19.0 | 8.19.0 | Current |
| acorn-jsx | 5.3.2 | 5.3.2 | 5.3.2 | Current |
| ajv | 6.15.0 | 8.20.0 | 6.15.0 | Current upstream parents retain these version slots: eslint@10.12.0: ^6.14.0 |
| ansi-escapes | 4.3.2 | 7.3.0 | 4.3.2 | Current upstream parents retain these version slots: @jest/core@30.5.2: ^4.3.2; jest-watcher@30.5.2: ^4.3.2 |
| ansi-regex | 5.0.1, 6.4.0 | 6.4.0 | 5.0.1, 6.4.0 | Current upstream parents retain these version slots: strip-ansi@6.0.1: ^5.0.1; strip-ansi@7.2.0: ^6.2.2 |
| ansi-styles | 4.3.0, 5.2.0, 6.2.3 | 7.0.0 | 4.3.0, 5.2.0, 6.2.3 | Current upstream parents retain these version slots: chalk@4.1.2: ^4.1.0; pretty-format@30.5.1: ^5.2.0; wrap-ansi@7.0.0: ^4.0.0; wrap-ansi@8.1.0: ^6.1.0; wrap-ansi@9.0.2: ^6.2.1 |
| anymatch | 3.1.3 | 3.1.3 | 3.1.3 | Current |
| archiver | 8.0.0 | 8.0.0 | 8.0.0 | Current |
| argparse | 2.0.1, 3.0.2 | 3.0.2 | 2.0.1, 3.0.2 | Current upstream parents retain these version slots: js-yaml@4.3.2: ^2.0.1; markdown-it@15.0.2: ^3.0.0 |
| asap | 2.0.6 | 2.0.6 | 2.0.6 | Current |
| async | 3.2.6 | 3.2.6 | 3.2.6 | Current |
| asynckit | 0.4.0 | 0.5.0 | 0.4.0 | Current upstream parents retain these version slots: form-data@4.0.6: ^0.4.0 |
| b4a | 1.6.7 | 1.9.0 | 1.9.0 | Current |
| babel-jest | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| babel-plugin-istanbul | 8.0.2 | 8.0.0 | 8.0.0 | Current |
| babel-plugin-jest-hoist | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| babel-plugin-polyfill-corejs3 | 1.0.0 | 1.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| babel-preset-current-node-syntax | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| babel-preset-jest | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| balanced-match | 1.0.2, 4.0.4 | 4.0.4 | 1.0.2, 4.0.4 | Current upstream parents retain these version slots: brace-expansion@2.1.7: ^1.0.0; brace-expansion@5.0.12: ^4.0.2 |
| bare-events | 2.5.4 | 2.9.2 | 2.9.2 | Current |
| bare-fs | unlocked/not declared | 4.8.2 | 4.8.2 | Current |
| bare-path | unlocked/not declared | 3.1.2 | 3.1.2 | Current |
| bare-stream | unlocked/not declared | 2.13.4 | 2.13.4 | Current |
| bare-url | unlocked/not declared | 2.5.4 | 2.5.4 | Current |
| base64-js | 1.5.1 | 1.5.1 | 1.5.1 | Current |
| baseline-browser-mapping | 2.11.27 | 2.11.27 | 2.11.27 | Current |
| bluebird | 3.7.2 | 3.7.2 | 3.7.2 | Current |
| body-parser | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| boolbase | 1.0.0 | 2.0.0 | 1.0.0 | Current upstream parents retain these version slots: cheerio-select@2.1.0: ^1.0.0; css-select@5.2.2: ^1.0.0; nth-check@2.1.1: ^1.0.0 |
| brace-expansion | 2.1.7, 5.0.12 | 5.0.12 | 2.1.7, 5.0.12 | Current upstream parents retain these version slots: minimatch@10.2.6: ^5.0.8; minimatch@9.0.9: ^2.0.2 |
| browser-commander | 0.10.0 | 0.26.3 | 0.10.0 | [Issue 160](https://github.com/link-assistant/web-capture/issues/160): packaged consumers cannot load mandatory native SQLite; see VALIDATION.md |
| browserslist | 4.29.3 | 4.29.3 | 4.29.3 | Current |
| bser | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| buffer | 6.0.3 | 6.0.3 | 6.0.3 | Current |
| buffer-crc32 | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| bytes | 3.1.2 | 3.1.2 | 3.1.2 | Current |
| cac | 7.0.0 | 7.0.0 | 7.0.0 | Current |
| cacheable | 2.5.0 | 2.5.0 | 2.5.0 | Current |
| call-bind-apply-helpers | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| call-bound | 1.0.4 | 1.0.4 | 1.0.4 | Current |
| callsites | 3.1.0 | 4.2.0 | 3.1.0 | Current upstream parents retain these version slots: @jest/source-map@30.5.2: ^3.1.0 |
| camelcase | 5.3.1, 6.3.0 | 9.0.0 | 5.3.1, 6.3.0 | Current upstream parents retain these version slots: @istanbuljs/load-nyc-config@1.1.0: ^5.3.1; jest-validate@30.5.1: ^6.3.0 |
| caniuse-lite | 1.0.30001815 | 1.0.30001815 | 1.0.30001815 | Current |
| capture-website | unlocked/not declared | 5.1.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| chalk | 4.1.2 | 6.0.1 | 4.1.2 | Current upstream parents retain these version slots: @jest/console@30.5.2: ^4.1.2; @jest/core@30.5.2: ^4.1.2; @jest/reporters@30.5.2: ^4.1.2; @jest/snapshot-utils@30.5.1: ^4.1.2; @jest/transform@30.5.2: ^4.1.2; @jest/types@30.5.1: ^4.1.2; babel-jest@30.5.2: ^4.1.2; jest-circus@30.5.2: ^4.1.2; jest-cli@30.5.2: ^4.1.2; jest-config@30.5.2: ^4.1.2; jest-diff@30.5.2: ^4.1.2; jest-each@30.5.2: ^4.1.2; jest-matcher-utils@30.5.2: ^4.1.2; jest-message-util@30.5.1: ^4.1.2; jest-resolve@30.5.1: ^4.1.2; jest-runner@30.5.2: ^4.1.2; jest-runtime@30.5.2: ^4.1.2; jest-snapshot@30.5.2: ^4.1.2; jest-util@30.5.1: ^4.1.2; jest-validate@30.5.1: ^4.1.2; jest-watcher@30.5.2: ^4.1.2 |
| char-regex | 1.0.2 | 2.0.2 | 1.0.2 | Current upstream parents retain these version slots: string-length@4.0.2: ^1.0.2 |
| cheerio | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| cheerio-select | 2.1.0 | 2.1.0 | 2.1.0 | Current |
| chromium-bidi | 17.0.2 | 157.0.8092-0 | 17.0.2 | Current upstream parents retain these version slots: puppeteer-core@25.12.0: 17.0.2; puppeteer@25.12.0: 17.0.2 |
| ci-info | 4.4.0 | 4.4.0 | 4.4.0 | Current |
| cjs-module-lexer | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| cliui | 8.0.1, 9.0.1 | 9.0.1 | 8.0.1, 9.0.1 | Current upstream parents retain these version slots: yargs@17.7.3: ^8.0.1; yargs@18.2.0: ^9.0.1 |
| co | 4.6.0 | 4.6.0 | 4.6.0 | Current |
| collect-v8-coverage | 1.0.3 | 1.0.3 | 1.0.3 | Current |
| color-convert | 2.0.1 | 3.1.3 | 2.0.1 | Current upstream parents retain these version slots: ansi-styles@4.3.0: ^2.0.1 |
| color-name | 1.1.4 | 2.1.1 | 1.1.4 | Current upstream parents retain these version slots: color-convert@2.0.1: ~1.1.4 |
| combined-stream | 1.0.8 | 1.0.8 | 1.0.8 | Current |
| command-stream | unlocked/not declared | 2.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| component-emitter | 1.3.1 | 2.0.0 | 1.3.1 | Current upstream parents retain these version slots: superagent@10.4.1: ^1.3.1 |
| compress-commons | 7.0.1 | 7.0.1 | 7.0.1 | Current |
| content-disposition | 1.1.0 | 3.0.0 | 1.1.0 | Current upstream parents retain these version slots: express@5.2.1: ^1.0.0 |
| content-type | 1.0.5, 2.1.0 | 3.1.1 | 1.0.5, 2.1.0 | Current upstream parents retain these version slots: body-parser@2.3.0: ^2.0.0; express@5.2.1: ^1.0.5; negotiator@1.1.0: ^2.1.0; type-is@2.1.0: ^2.0.0 |
| convert-source-map | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| cookie | 0.7.1 | 2.0.1 | 0.7.2 | Current upstream parents retain these version slots: express@5.2.1: ^0.7.1 |
| cookie-signature | 1.2.2 | 1.2.2 | 1.2.2 | Current |
| cookiejar | 2.1.4 | 2.1.4 | 2.1.4 | Current |
| core-js-compat | 3.50.0 | 3.50.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| core-util-is | 1.0.3 | 1.0.3 | 1.0.3 | Current |
| crc-32 | 1.2.2 | 1.2.2 | 1.2.2 | Current |
| crc32-stream | 7.0.1 | 7.0.1 | 7.0.1 | Current |
| cross-spawn | 7.0.6 | 7.0.6 | 7.0.6 | Current |
| css-select | 5.1.0 | 7.0.0 | 5.2.2 | Current upstream parents retain these version slots: cheerio-select@2.1.0: ^5.1.0 |
| css-what | 6.1.0 | 8.0.0 | 6.2.2 | Current upstream parents retain these version slots: cheerio-select@2.1.0: ^6.1.0; css-select@5.2.2: ^6.1.0 |
| data-uri-to-buffer | 4.0.1 | 8.0.0 | 4.0.1 | Current upstream parents retain these version slots: node-fetch@3.3.2: ^4.0.0 |
| debug | 4.4.3 | 4.4.3 | 4.4.3 | Current |
| dedent | 1.7.2 | 1.7.2 | 1.7.2 | Current |
| deep-is | 0.1.4 | 0.1.4 | 0.1.4 | Current |
| deepmerge | 4.3.1 | 4.3.1 | 4.3.1 | Current |
| delayed-stream | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| depd | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| detect-libc | 2.1.2 | 2.1.2 | 2.1.2 | Current |
| detect-newline | 3.1.0 | 4.0.1 | 3.1.0 | Current upstream parents retain these version slots: jest-docblock@30.5.0: ^3.1.0 |
| devtools-protocol | 0.0.1687809 | 0.0.1714151 | 0.0.1687809 | Current upstream parents retain these version slots: chromium-bidi@17.0.2: *; puppeteer-core@25.12.0: 0.0.1687809; puppeteer@25.12.0: 0.0.1687809 |
| dezalgo | 1.0.4 | 1.0.4 | 1.0.4 | Current |
| docx | 9.9.0 | 9.9.0 | 9.9.0 | Current |
| dom-serializer | 2.0.0 | 3.1.1 | 2.0.0 | Current upstream parents retain these version slots: cheerio@1.2.0: ^2.0.0; domutils@3.2.2: ^2.0.0 |
| domelementtype | 2.3.0 | 3.0.0 | 2.3.0 | Current upstream parents retain these version slots: cheerio-select@2.1.0: ^2.3.0; dom-serializer@2.0.0: ^2.3.0; domhandler@5.0.3: ^2.3.0; domutils@3.2.2: ^2.3.0; htmlparser2@10.1.0: ^2.3.0 |
| domhandler | 5.0.3 | 6.0.1 | 5.0.3 | Current upstream parents retain these version slots: cheerio-select@2.1.0: ^5.0.3; cheerio@1.2.0: ^5.0.3; css-select@5.2.2: ^5.0.2; dom-serializer@2.0.0: ^5.0.2; domutils@3.2.2: ^5.0.3; htmlparser2@10.1.0: ^5.0.3; parse5-htmlparser2-tree-adapter@7.1.0: ^5.0.3 |
| domutils | 3.2.2 | 4.0.2 | 3.2.2 | Current upstream parents retain these version slots: cheerio-select@2.1.0: ^3.0.1; cheerio@1.2.0: ^3.2.2; css-select@5.2.2: ^3.0.1; htmlparser2@10.1.0: ^3.2.2 |
| dunder-proto | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| duplexer2 | 0.1.4 | 0.1.4 | 0.1.4 | Current |
| eastasianwidth | 0.2.0 | 0.3.0 | 0.2.0 | Current upstream parents retain these version slots: string-width@5.1.2: ^0.2.0 |
| ee-first | 1.1.1 | 1.1.1 | 1.1.1 | Current |
| electron-to-chromium | 1.5.449 | 1.5.451 | 1.5.451 | Current |
| emittery | 0.13.1 | 2.1.0 | 0.13.1 | Current upstream parents retain these version slots: jest-runner@30.5.2: ^0.13.1; jest-watcher@30.5.2: ^0.13.1 |
| emoji-regex | 10.6.0, 8.0.0, 9.2.2 | 11.0.0 | 10.6.0, 8.0.0, 9.2.2 | Current upstream parents retain these version slots: string-width@4.2.3: ^8.0.0; string-width@5.1.2: ^9.2.2; string-width@7.2.0: ^10.3.0 |
| empathic | 2.1.0 | 2.1.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| encodeurl | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| encoding-sniffer | 0.2.1 | 1.0.2 | 0.2.1 | Current upstream parents retain these version slots: cheerio@1.2.0: ^0.2.1 |
| entities | 4.5.0, 6.0.0, 7.0.1, 8.1.0 | 8.1.0 | 4.5.0, 6.0.1, 7.0.1, 8.1.0 | Current upstream parents retain these version slots: dom-serializer@2.0.0: ^4.2.0; htmlparser2@10.1.0: ^7.0.1; markdown-it@15.0.2: ^8.0.0; parse5@7.3.0: ^6.0.0 |
| error-ex | 1.3.4 | 1.3.4 | 1.3.4 | Current |
| es-define-property | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| es-errors | 1.3.0 | 1.3.0 | 1.3.0 | Current |
| es-module-lexer | 2.3.2 | 3.0.3 | 2.3.2 | Current upstream parents retain these version slots: jest-runtime@30.5.2: ^2.1.0 |
| es-object-atoms | 1.1.2 | 1.1.2 | 1.1.2 | Current |
| es-set-tostringtag | 2.1.0 | 2.1.0 | 2.1.0 | Current |
| escalade | 3.2.0 | 3.2.0 | 3.2.0 | Current |
| escape-html | 1.0.3 | 1.0.3 | 1.0.3 | Current |
| escape-string-regexp | 2.0.0, 4.0.0 | 5.0.0 | 2.0.0, 4.0.0 | Current upstream parents retain these version slots: eslint@10.12.0: ^4.0.0; stack-utils@2.0.6: ^2.0.0 |
| eslint | 10.12.0 | 10.12.0 | 10.12.0 | Current |
| eslint-config-prettier | 10.1.8 | 10.1.8 | 10.1.8 | Current |
| eslint-plugin-prettier | 5.5.6 | 5.5.6 | 5.5.6 | Current |
| eslint-scope | 9.1.2 | 9.1.2 | 9.1.2 | Current |
| eslint-visitor-keys | 3.4.3, 5.0.1 | 5.0.1 | 3.4.3, 5.0.1 | Current upstream parents retain these version slots: @eslint-community/eslint-utils@4.10.1: ^3.4.3; eslint@10.12.0: ^5.0.1; espree@11.2.0: ^5.0.1 |
| espree | 11.2.0 | 11.2.0 | 11.2.0 | Current |
| esquery | 1.7.0 | 1.7.0 | 1.7.0 | Current |
| esrecurse | 4.3.0 | 4.3.0 | 4.3.0 | Current |
| estraverse | 5.3.0 | 5.3.0 | 5.3.0 | Current |
| esutils | 2.0.3 | 2.0.3 | 2.0.3 | Current |
| etag | 1.8.1 | 1.8.1 | 1.8.1 | Current |
| event-target-shim | 5.0.1 | 6.0.2 | 5.0.1 | Current upstream parents retain these version slots: abort-controller@3.0.0: ^5.0.0 |
| events | 3.3.0 | 3.3.0 | 3.3.0 | Current |
| events-universal | unlocked/not declared | 1.0.1 | 1.0.1 | Current |
| execa | 5.1.1 | 10.1.0 | 10.1.0, 5.1.1 | Current upstream parents retain these version slots: jest-changed-files@30.5.1: ^5.1.1; web-capture-development-tools@?: ^10.1.0 |
| exit-x | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| expect | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| express | 5.2.1 | 5.2.1 | 5.2.1 | Current |
| fast-deep-equal | 3.1.3 | 3.1.3 | 3.1.3 | Current |
| fast-diff | 1.3.0 | 1.3.0 | 1.3.0 | Current |
| fast-fifo | 1.3.2 | 1.3.2 | 1.3.2 | Current |
| fast-json-stable-stringify | 2.1.0 | 2.1.0 | 2.1.0 | Current |
| fast-levenshtein | 2.0.6 | 3.0.0 | 2.0.6 | Current upstream parents retain these version slots: optionator@0.9.4: ^2.0.6 |
| fast-safe-stringify | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| fast-string-truncated-width | 3.0.3 | 3.0.3 | 3.0.3 | Current |
| fast-string-width | 3.0.2 | 3.0.2 | 3.0.2 | Current |
| fast-wrap-ansi | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| fb-watchman | 2.0.2 | 2.0.2 | 2.0.2 | Current |
| fdir | 6.5.0 | 6.5.0 | 6.5.0 | Current |
| fetch-blob | 3.2.0 | 4.0.0 | 3.2.0 | Current upstream parents retain these version slots: formdata-polyfill@4.0.10: ^3.1.2; node-fetch@3.3.2: ^3.1.4 |
| figures | unlocked/not declared | 6.1.0 | 6.1.0 | Current |
| file-entry-cache | 11.1.5 | 11.1.5 | 11.1.5 | Current |
| finalhandler | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| find-up | 4.1.0, 5.0.0 | 8.0.0 | 4.1.0, 5.0.0 | Current upstream parents retain these version slots: @istanbuljs/load-nyc-config@1.1.0: ^4.1.0; eslint@10.12.0: ^5.0.0; pkg-dir@4.2.0: ^4.0.0 |
| flat-cache | 6.1.23 | 6.1.23 | 6.1.23 | Current |
| flatted | 3.4.4 | 3.4.4 | 3.4.4 | Current |
| flru | 1.0.2 | 1.0.2 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| foreground-child | 3.3.1 | 4.0.3 | 3.3.1 | Current upstream parents retain these version slots: glob@10.5.0: ^3.1.0 |
| form-data | 4.0.6 | 4.0.6 | 4.0.6 | Current |
| formdata-polyfill | 4.0.10 | 4.0.10 | 4.0.10 | Current |
| formidable | 3.5.4 | 3.5.4 | 3.5.4 | Current |
| forwarded | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| fresh | 2.0.0 | 0.5.2 | 2.0.0 | Current upstream parents retain these version slots: express@5.2.1: ^2.0.0; send@1.2.1: ^2.0.0 |
| fs-extra | 11.3.1 | 11.4.1 | 11.3.1 | Current upstream parents retain these version slots: unzipper@0.12.5: 11.3.1 |
| function-bind | 1.1.2 | 1.1.2 | 1.1.2 | Current |
| gensync | 1.0.0-beta.2 | 1.0.0-beta.2 | 1.0.0-beta.2 | Current |
| get-caller-file | 2.0.5 | 2.0.5 | 2.0.5 | Current |
| get-east-asian-width | 1.7.0 | 1.7.0 | 1.7.0 | Current |
| get-intrinsic | 1.3.0 | 1.3.0 | 1.3.0 | Current |
| get-package-type | 0.1.0 | 0.1.0 | 0.1.0 | Current |
| get-port | 7.2.0 | 7.2.0 | 7.2.0 | Current |
| get-proto | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| get-stream | 6.0.1 | 9.0.1 | 6.0.1, 9.0.1 | Current upstream parents retain these version slots: execa@10.1.0: ^9.0.1; execa@5.1.1: ^6.0.0 |
| getenv | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| glob | 10.5.0, 13.0.6 | 13.0.6 | 10.5.0, 13.0.6 | Current upstream parents retain these version slots: @jest/reporters@30.5.2: ^13.0.6; jest-config@30.5.2: ^13.0.6; jest-runtime@30.5.2: ^13.0.6; test-exclude@7.0.2: ^10.4.1 |
| glob-parent | 6.0.2 | 6.0.2 | 6.0.2 | Current |
| gopd | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| graceful-fs | 4.2.11 | 4.2.11 | 4.2.11 | Current |
| has-flag | 4.0.0 | 5.0.1 | 4.0.0 | Current upstream parents retain these version slots: supports-color@7.2.0: ^4.0.0; supports-color@8.1.1: ^4.0.0 |
| has-symbols | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| has-tostringtag | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| hash.js | 1.1.7 | 1.1.7 | 1.1.7 | Current |
| hashery | 1.5.1 | 3.0.3 | 1.5.1 | Current upstream parents retain these version slots: @cacheable/utils@2.5.0: ^1.5.1; @keyv/bigmap@1.3.1: ^1.4.0 |
| hasown | 2.0.4 | 2.0.4 | 2.0.4 | Current |
| he | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| hookified | 1.15.1, 2.2.0 | 3.0.4 | 1.15.1, 2.2.0 | Current upstream parents retain these version slots: @cacheable/memory@2.2.0: ^1.15.1; @keyv/bigmap@1.3.1: ^1.15.0; cacheable@2.5.0: ^1.15.0; flat-cache@6.1.23: ^1.15.0; hashery@1.5.1: ^1.15.0; qified@0.10.1: ^2.1.1 |
| html-escaper | 2.0.2 | 3.0.3 | 2.0.2 | Current upstream parents retain these version slots: istanbul-reports@3.2.0: ^2.0.0 |
| htmlparser2 | 10.1.0 | 12.0.0 | 10.1.0 | Current upstream parents retain these version slots: cheerio@1.2.0: ^10.1.0 |
| http-errors | 2.0.1 | 2.0.1 | 2.0.1 | Current |
| human-id | 4.2.2 | 4.2.2 | 4.2.2 | Current |
| human-signals | 2.1.0 | 8.0.1 | 2.1.0, 8.0.1 | Current upstream parents retain these version slots: execa@10.1.0: ^8.0.1; execa@5.1.1: ^2.1.0 |
| husky | 9.1.7 | 9.1.7 | 9.1.7 | Current |
| iconv-lite | 0.6.3, 0.7.3 | 0.7.3 | 0.6.3, 0.7.3 | Current upstream parents retain these version slots: @link-assistant/web-capture@1.12.0: ^0.7.3; body-parser@2.3.0: ^0.7.2; encoding-sniffer@0.2.1: ^0.6.3; raw-body@3.0.2: ~0.7.0; whatwg-encoding@3.1.1: 0.6.3 |
| ieee754 | 1.2.1 | 1.2.1 | 1.2.1 | Current |
| ignore | 5.3.2 | 7.0.12 | 5.3.2 | Current upstream parents retain these version slots: eslint@10.12.0: ^5.2.0 |
| immediate | 3.0.6 | 3.3.0 | 3.0.6 | Current upstream parents retain these version slots: lie@3.3.0: ~3.0.5 |
| import-local | 3.2.0 | 3.2.0 | 3.2.0 | Current |
| import-meta-resolve | 4.2.0 | 4.2.0 | 4.2.0 | Current |
| imurmurhash | 0.1.4 | 0.1.4 | 0.1.4 | Current |
| inherits | 2.0.4 | 2.0.4 | 2.0.4 | Current |
| ipaddr.js | 1.9.1 | 2.5.0 | 1.9.1 | Current upstream parents retain these version slots: proxy-addr@2.0.8: 1.9.1 |
| is-arrayish | 0.2.1 | 0.3.4 | 0.2.1 | Current upstream parents retain these version slots: error-ex@1.3.4: ^0.2.1 |
| is-extglob | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| is-fullwidth-code-point | 3.0.0 | 5.1.0 | 3.0.0 | Current upstream parents retain these version slots: string-width@4.2.3: ^3.0.0 |
| is-generator-fn | 2.1.0 | 3.0.0 | 2.1.0 | Current upstream parents retain these version slots: jest-circus@30.5.2: ^2.1.0 |
| is-glob | 4.0.3 | 4.0.3 | 4.0.3 | Current |
| is-node-process | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| is-plain-obj | unlocked/not declared | 4.1.0 | 4.1.0 | Current |
| is-promise | 4.0.0 | 4.0.0 | 4.0.0 | Current |
| is-stream | 2.0.1, 4.0.1 | 4.0.1 | 2.0.1, 4.0.1 | Current upstream parents retain these version slots: archiver@8.0.0: ^4.0.0; compress-commons@7.0.1: ^4.0.0; execa@10.1.0: ^4.0.1; execa@5.1.1: ^2.0.0; get-stream@9.0.1: ^4.0.1 |
| is-unicode-supported | unlocked/not declared | 2.1.0 | 2.1.0 | Current |
| isarray | 1.0.0 | 2.0.5 | 1.0.0 | Current upstream parents retain these version slots: readable-stream@2.3.8: ~1.0.0 |
| isexe | 2.0.0 | 4.0.0 | 2.0.0 | Current upstream parents retain these version slots: which@2.0.2: ^2.0.0 |
| istanbul-lib-coverage | 3.2.2 | 3.2.2 | 3.2.2 | Current |
| istanbul-lib-instrument | 6.0.3 | 6.0.3 | 6.0.3 | Current |
| istanbul-lib-report | 3.0.1 | 3.0.1 | 3.0.1 | Current |
| istanbul-lib-source-maps | 5.0.6 | 5.0.6 | 5.0.6 | Current |
| istanbul-reports | 3.2.0 | 3.2.0 | 3.2.0 | Current |
| jackspeak | 3.4.3 | 4.2.3 | 3.4.3 | Current upstream parents retain these version slots: glob@10.5.0: ^3.1.2 |
| jest | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-changed-files | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-circus | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-cli | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-config | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-diff | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-docblock | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| jest-each | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-environment-node | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-haste-map | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-leak-detector | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-matcher-utils | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-message-util | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-mock | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-regex-util | 30.5.0 | 30.5.0 | 30.5.0 | Current |
| jest-resolve | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-resolve-dependencies | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-runner | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-runtime | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-snapshot | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-util | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-validate | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jest-watcher | 30.5.2 | 30.5.2 | 30.5.2 | Current |
| jest-worker | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| jju | 1.4.0 | 1.4.0 | 1.4.0 | Current |
| js-tokens | 10.0.0, 4.0.0 | 10.0.0 | 4.0.0 | Current upstream parents retain these version slots: @babel/code-frame@7.29.7: ^4.0.0 |
| js-yaml | 4.3.2 | 5.4.3 | 4.3.2 | Current upstream parents retain these version slots: @istanbuljs/load-nyc-config@1.1.0: ^3.13.1 |
| jscpd | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-darwin-arm64 | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-darwin-x64 | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-linux-arm64-gnu | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-linux-arm64-musl | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-linux-x64-gnu | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-linux-x64-musl | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-windows-arm64-msvc | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jscpd-windows-x64-msvc | 5.4.0 | 5.4.0 | 5.4.0 | Current |
| jsesc | 3.1.0 | 3.1.0 | 3.1.0 | Current |
| json-parse-even-better-errors | 2.3.1 | 6.0.0 | 2.3.1 | Current upstream parents retain these version slots: parse-json@5.2.0: ^2.3.0 |
| json-schema-traverse | 0.4.1 | 1.0.0 | 0.4.1 | Current upstream parents retain these version slots: ajv@6.15.0: ^0.4.1 |
| json-stable-stringify-without-jsonify | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| json5 | 2.2.3 | 2.2.3 | 2.2.3 | Current |
| jsonc-parser | 3.3.1 | 3.3.1 | 3.3.1 | Current |
| jsonfile | 6.2.1 | 6.2.1 | 6.2.1 | Current |
| jszip | 3.10.1 | 3.10.2 | 3.10.2 | Current |
| keyv | 5.6.0 | 6.1.0 | 5.6.0 | Current upstream parents retain these version slots: @cacheable/memory@2.2.0: ^5.6.0; @cacheable/utils@2.5.0: ^5.6.0; @keyv/bigmap@1.3.1: ^5.6.0; cacheable@2.5.0: ^5.6.0 |
| launch-editor | 2.14.2 | 2.14.2 | 2.14.2 | Current |
| lazystream | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| leven | 3.1.0 | 4.1.0 | 3.1.0 | Current upstream parents retain these version slots: jest-validate@30.5.1: ^3.1.0 |
| levn | 0.4.1 | 0.4.1 | 0.4.1 | Current |
| lie | 3.3.0 | 3.3.0 | 3.3.0 | Current |
| lilconfig | 3.1.3 | 3.1.3 | 3.1.3 | Current |
| lines-and-columns | 1.2.4 | 2.0.4 | 1.2.4 | Current upstream parents retain these version slots: parse-json@5.2.0: ^1.1.6 |
| linkify-it | 6.1.0 | 6.1.0 | 6.1.0 | Current |
| links-notation | 0.11.2 | 0.23.0 | 0.11.2 | Current upstream parents retain these version slots: lino-arguments@0.3.0: ^0.11.2; lino-env@0.2.8: ^0.11.2 |
| lino-arguments | 0.3.0 | 0.3.0 | 0.3.0 | Current |
| lino-env | 0.2.8 | 0.2.8 | 0.2.8 | Current |
| lint-staged | 17.6.0 | 17.6.0 | 17.6.0 | Current |
| locate-path | 5.0.0, 6.0.0 | 8.0.0 | 5.0.0, 6.0.0 | Current upstream parents retain these version slots: find-up@4.1.0: ^5.0.0; find-up@5.0.0: ^6.0.0 |
| lodash.debounce | 4.0.8 | 4.0.8 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| log-lazy | 1.0.4 | 1.0.4 | 1.0.4 | Current |
| lru-cache | 10.4.3, 11.5.3, 5.1.1 | 11.5.3 | 10.4.3, 11.5.3, 5.1.1 | Current upstream parents retain these version slots: @babel/helper-compilation-targets@7.29.7: ^5.1.1; path-scurry@1.11.1: ^10.2.0; path-scurry@2.0.2: ^11.0.0 |
| make-dir | 4.0.0 | 5.1.0 | 4.0.0 | Current upstream parents retain these version slots: istanbul-lib-report@3.0.1: ^4.0.0 |
| markdown-it | 15.0.2 | 15.0.2 | 15.0.2 | Current |
| math-intrinsics | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| mdurl | 2.1.0 | 2.1.0 | 2.1.0 | Current |
| media-typer | 1.1.1 | 2.0.0 | 1.1.1 | Current upstream parents retain these version slots: type-is@2.1.0: ^1.1.0 |
| merge-descriptors | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| merge-stream | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| methods | 1.1.2 | 1.1.2 | 1.1.2 | Current |
| mime | 2.6.0 | 4.1.0 | 2.6.0 | Current upstream parents retain these version slots: superagent@10.4.1: 2.6.0 |
| mime-db | 1.52.0, 1.54.0 | 1.54.0 | 1.52.0, 1.54.0 | Current upstream parents retain these version slots: mime-types@2.1.35: 1.52.0; mime-types@3.0.2: ^1.54.0 |
| mime-types | 2.1.35, 3.0.2 | 3.0.2 | 2.1.35, 3.0.2 | Current upstream parents retain these version slots: accepts@2.0.0: ^3.0.0; express@5.2.1: ^3.0.0; form-data@4.0.6: ^2.1.35; send@1.2.1: ^3.0.2; type-is@2.1.0: ^3.0.0 |
| mimic-fn | 2.1.0 | 5.0.0 | 2.1.0 | Current upstream parents retain these version slots: onetime@5.1.2: ^2.1.0 |
| minimalistic-assert | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| minimatch | 10.2.6, 9.0.9 | 10.2.6 | 10.2.6, 9.0.9 | Current upstream parents retain these version slots: @eslint/config-array@0.23.5: ^10.2.4; eslint@10.12.0: ^10.2.5; glob@10.5.0: ^9.0.4; glob@13.0.6: ^10.2.2; readdir-glob@3.0.0: ^10.2.2; test-exclude@7.0.2: ^10.2.2 |
| minipass | 7.1.3 | 7.1.3 | 7.1.3 | Current |
| mitt | 3.0.1 | 3.0.1 | 3.0.1 | Current |
| modern-tar | 0.8.5 | 0.8.5 | 0.8.5 | Current |
| ms | 2.1.3 | 2.1.3 | 2.1.3 | Current |
| nanoid | 6.0.2 | 6.0.2 | 6.0.2 | Current |
| napi-postinstall | 0.3.4 | 0.3.4 | 0.3.4 | Current |
| natural-compare | 1.4.0 | 1.4.0 | 1.4.0 | Current |
| negotiator | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| nock | 15.0.1 | 15.0.1 | 15.0.1 | Current |
| node-addon-api | 7.1.1 | 8.9.2 | 7.1.1 | Current upstream parents retain these version slots: @parcel/watcher@2.6.0: ^7.0.0 |
| node-domexception | 1.0.0 | 2.0.2 | 1.0.0 | Current upstream parents retain these version slots: fetch-blob@3.2.0: ^1.0.0 |
| node-fetch | 3.3.2 | 3.3.2 | 3.3.2 | Current |
| node-int64 | 0.4.0 | 0.4.0 | 0.4.0 | Current |
| node-releases | 2.0.57 | 2.0.57 | 2.0.57 | Current |
| nodemon | unlocked/not declared | 3.1.14 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| normalize-path | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| npm | unlocked/not declared | 12.2.0 | 12.2.0 (packageManager) | Toolchain, not a library; exact version installed by release bootstrap |
| npm-check-updates | unlocked/not declared | 23.1.0 | 23.1.0 (update tool) | Registry-current migration tool; not shipped as a runtime dependency |
| npm-run-path | 4.0.1 | 6.0.0 | 4.0.1, 6.0.0 | Current upstream parents retain these version slots: execa@10.1.0: ^6.0.0; execa@5.1.1: ^4.0.1 |
| nth-check | 2.1.1 | 3.0.1 | 2.1.1 | Current upstream parents retain these version slots: css-select@5.2.2: ^2.0.1 |
| object-inspect | 1.13.4 | 1.13.4 | 1.13.4 | Current |
| obug | 3.0.0 | 3.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| on-finished | 2.4.1 | 2.4.1 | 2.4.1 | Current |
| once | 1.4.0 | 1.4.0 | 1.4.0 | Current |
| onetime | 5.1.2 | 8.0.0 | 5.1.2 | Current upstream parents retain these version slots: execa@5.1.1: ^5.1.2 |
| optionator | 0.9.4 | 0.9.4 | 0.9.4 | Current |
| outvariant | 1.4.3 | 1.4.3 | 1.4.3 | Current |
| p-limit | 2.3.0, 3.1.0 | 7.3.3 | 2.3.0, 3.1.0 | Current upstream parents retain these version slots: jest-changed-files@30.5.1: ^3.1.0; jest-circus@30.5.2: ^3.1.0; jest-runner@30.5.2: ^3.1.0; p-locate@4.1.0: ^2.2.0; p-locate@5.0.0: ^3.0.2 |
| p-locate | 4.1.0, 5.0.0 | 7.0.0 | 4.1.0, 5.0.0 | Current upstream parents retain these version slots: locate-path@5.0.0: ^4.1.0; locate-path@6.0.0: ^5.0.0 |
| p-try | 2.2.0 | 3.0.0 | 2.2.0 | Current upstream parents retain these version slots: p-limit@2.3.0: ^2.0.0 |
| package-json-from-dist | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| package-manager-detector | 1.9.0 | 1.9.0 | 1.9.0 | Current |
| pako | 1.0.11 | 3.0.2 | 1.0.11 | Current upstream parents retain these version slots: jszip@3.10.2: ~1.0.2 |
| parse-json | 5.2.0 | 8.3.0 | 5.2.0 | Current upstream parents retain these version slots: jest-config@30.5.2: ^5.2.0 |
| parse-ms | unlocked/not declared | 4.0.0 | 4.0.0 | Current |
| parse5 | 7.3.0 | 8.0.1 | 7.3.0 | Current upstream parents retain these version slots: cheerio@1.2.0: ^7.3.0; parse5-htmlparser2-tree-adapter@7.1.0: ^7.0.0; parse5-parser-stream@7.1.2: ^7.0.0 |
| parse5-htmlparser2-tree-adapter | 7.1.0 | 8.0.1 | 7.1.0 | Current upstream parents retain these version slots: cheerio@1.2.0: ^7.1.0 |
| parse5-parser-stream | 7.1.2 | 8.0.0 | 7.1.2 | Current upstream parents retain these version slots: cheerio@1.2.0: ^7.1.2 |
| parseurl | 1.3.3 | 1.3.3 | 1.3.3 | Current |
| path-exists | 4.0.0 | 5.0.0 | 4.0.0 | Current upstream parents retain these version slots: find-up@4.1.0: ^4.0.0; find-up@5.0.0: ^4.0.0 |
| path-key | 3.1.1 | 4.0.0 | 3.1.1, 4.0.0 | Current upstream parents retain these version slots: cross-spawn@7.0.6: ^3.1.0; npm-run-path@4.0.1: ^3.0.0; npm-run-path@6.0.0: ^4.0.0 |
| path-scurry | 1.11.1, 2.0.2 | 2.0.2 | 1.11.1, 2.0.2 | Current upstream parents retain these version slots: glob@10.5.0: ^1.11.1; glob@13.0.6: ^2.0.2 |
| path-to-regexp | 8.4.2 | 8.4.2 | 8.4.2 | Current |
| picocolors | 1.1.1 | 1.1.1 | 1.1.1 | Current |
| picomatch | 2.3.2, 4.0.7 | 4.0.7 | 2.3.2, 4.0.7 | Current upstream parents retain these version slots: @changesets/config@4.0.1: ^4.0.7; @changesets/git@4.0.1: ^4.0.4; @parcel/watcher@2.6.0: ^4.0.4; anymatch@3.1.3: ^2.0.4; fdir@6.5.0: ^3 \|\| ^4; jest-haste-map@30.5.1: ^4.0.3; jest-message-util@30.5.1: ^4.0.3; jest-util@30.5.1: ^4.0.3; lint-staged@17.6.0: ^4.0.7; tinyglobby@0.2.17: ^4.0.4 |
| pirates | 4.0.7 | 4.0.7 | 4.0.7 | Current |
| pkg-dir | 4.2.0 | 9.0.0 | 4.2.0 | Current upstream parents retain these version slots: import-local@3.2.0: ^4.2.0 |
| playwright | 1.63.0 | 1.64.0 | 1.64.0 | Current |
| playwright-core | 1.63.0 | 1.64.0 | 1.64.0 | Current |
| prelude-ls | 1.2.1 | 1.2.1 | 1.2.1 | Current |
| prettier | 3.9.9 | 3.9.9 | 3.9.9 | Current |
| prettier-linter-helpers | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| pretty-format | 30.5.1 | 30.5.1 | 30.5.1 | Current |
| pretty-ms | unlocked/not declared | 9.3.1 | 9.3.1 | Current |
| process | 0.11.10 | 0.11.10 | 0.11.10 | Current |
| process-nextick-args | 2.0.1 | 2.0.1 | 2.0.1 | Current |
| proxy-addr | 2.0.8 | 2.0.8 | 2.0.8 | Current |
| punycode | 2.3.1 | 2.3.1 | 2.3.1 | Current |
| punycode.js | 2.3.1 | 2.3.1 | 2.3.1 | Current |
| puppeteer | 25.12.0 | 25.12.0 | 25.12.0 | Current |
| puppeteer-core | 25.12.0 | 25.12.0 | 25.12.0 | Current |
| pure-rand | 7.0.1 | 8.4.2 | 7.0.1 | Current upstream parents retain these version slots: jest-circus@30.5.2: ^7.0.0 |
| qified | 0.10.1 | 0.13.2 | 0.10.1 | Current upstream parents retain these version slots: cacheable@2.5.0: ^0.10.1 |
| qs | 6.16.0 | 6.16.0 | 6.16.0 | Current |
| range-parser | 1.3.0 | 1.3.0 | 1.3.0 | Current |
| raw-body | 3.0.2 | 4.0.0 | 3.0.2 | Current upstream parents retain these version slots: body-parser@2.3.0: ^3.0.2 |
| react-is | 18.3.1, 19.3.0 | 19.3.0 | 18.3.1, 19.3.0 | Current upstream parents retain these version slots:  |
| readable-stream | 2.3.8, 4.7.0 | 4.7.0 | 2.3.8, 4.7.0 | Current upstream parents retain these version slots: archiver@8.0.0: ^4.0.0; compress-commons@7.0.1: ^4.0.0; crc32-stream@7.0.1: ^4.0.0; duplexer2@0.1.4: ^2.0.2; jszip@3.10.2: ~2.3.6; lazystream@1.0.1: ^2.0.5; zip-stream@7.0.5: ^4.0.0 |
| readdir-glob | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| regenerate | 1.5.0 | 1.5.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| regenerate-unicode-properties | 10.3.0 | 10.3.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| regexpu-core | 6.5.3 | 6.5.3 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| regjsgen | 0.8.0 | 0.8.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| regjsparser | 0.13.4 | 0.13.4 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| require-directory | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| resolve-cwd | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| resolve-from | 5.0.0 | 5.0.0 | 5.0.0 | Current |
| rettime | 0.11.12 | 0.11.12 | 0.11.12 | Current |
| router | 2.2.0 | 2.2.0 | 2.2.0 | Current |
| safe-buffer | 5.1.2, 5.2.1 | 5.2.1 | 5.1.2, 5.2.1 | Current upstream parents retain these version slots: readable-stream@2.3.8: ~5.1.1; string_decoder@1.1.1: ~5.1.0; string_decoder@1.3.0: ~5.2.0 |
| safer-buffer | 2.1.2 | 2.1.2 | 2.1.2 | Current |
| sax | 1.6.0 | 1.6.1 | 1.6.1 | Current |
| semver | 6.3.1, 7.8.5 | 7.8.5 | 6.3.1, 7.8.5 | Current upstream parents retain these version slots: @babel/core@7.29.7: ^6.3.1; @babel/helper-compilation-targets@7.29.7: ^6.3.1; @changesets/apply-release-plan@8.1.1: ^7.8.1; @changesets/assemble-release-plan@7.0.0: ^7.8.1; @changesets/cli@3.0.3: ^7.8.1; @changesets/get-dependents-graph@3.0.0: ^7.8.1; istanbul-lib-instrument@6.0.3: ^7.5.4; jest-snapshot@30.5.2: ^7.7.2; make-dir@4.0.0: ^7.5.3 |
| send | 1.2.1 | 1.2.1 | 1.2.1 | Current |
| serve-static | 2.2.1 | 2.2.1 | 2.2.1 | Current |
| setimmediate | 1.0.5 | 1.0.5 | 1.0.5 | Current |
| setprototypeof | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| shebang-command | 2.0.0 | 2.0.0 | 2.0.0 | Current |
| shebang-regex | 3.0.0 | 4.0.0 | 3.0.0 | Current upstream parents retain these version slots: shebang-command@2.0.0: ^3.0.0 |
| shell-quote | 1.12.0 | 1.12.0 | 1.12.0 | Current |
| side-channel | 1.1.1 | 1.1.1 | 1.1.1 | Current |
| side-channel-list | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| side-channel-map | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| side-channel-weakmap | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| signal-exit | 3.0.7, 4.1.0 | 4.1.0 | 3.0.7, 4.1.0 | Current upstream parents retain these version slots: execa@10.1.0: ^4.1.0; execa@5.1.1: ^3.0.3; foreground-child@3.3.1: ^4.0.1; write-file-atomic@5.0.1: ^4.0.1 |
| sisteransi | 1.0.5 | 2.0.0 | 1.0.5 | Current upstream parents retain these version slots: @clack/core@1.5.1: ^1.0.5; @clack/prompts@1.8.1: ^1.0.5 |
| slash | 3.0.0 | 5.1.0 | 3.0.0 | Current upstream parents retain these version slots: @jest/console@30.5.2: ^3.0.0; @jest/core@30.5.2: ^3.0.0; @jest/reporters@30.5.2: ^3.0.0; @jest/test-sequencer@30.5.2: ^3.0.0; @jest/transform@30.5.2: ^3.0.0; babel-jest@30.5.2: ^3.0.0; jest-circus@30.5.2: ^3.0.0; jest-config@30.5.2: ^3.0.0; jest-message-util@30.5.1: ^3.0.0; jest-resolve@30.5.1: ^3.0.0; jest-runtime@30.5.2: ^3.0.0 |
| stack-utils | 2.0.6 | 2.0.6 | 2.0.6 | Current |
| statuses | 2.0.2 | 2.0.2 | 2.0.2 | Current |
| streamx | 2.22.0 | 2.28.1 | 2.28.1 | Current |
| string-argv | 0.3.2 | 0.4.0 | 0.3.2 | Current upstream parents retain these version slots: lint-staged@17.6.0: ^0.3.2 |
| string-length | 4.0.2 | 7.0.1 | 4.0.2 | Current upstream parents retain these version slots: @jest/reporters@30.5.2: ^4.0.2; jest-watcher@30.5.2: ^4.0.2 |
| string-width | 4.2.3, 5.1.2, 7.2.0, 8.3.0 | 8.3.0 | 4.2.3, 5.1.2, 7.2.0, 8.3.0 | Current upstream parents retain these version slots: @isaacs/cliui@8.0.2: ^5.1.2; cliui@8.0.1: ^4.2.0; cliui@9.0.1: ^7.2.0; wrap-ansi@7.0.0: ^4.1.0; wrap-ansi@8.1.0: ^5.0.1; wrap-ansi@9.0.2: ^7.0.0; yargs@17.7.3: ^4.2.3; yargs@18.2.0: ^8.2.1 |
| string_decoder | 1.1.1, 1.3.0 | 1.3.0 | 1.1.1, 1.3.0 | Current upstream parents retain these version slots: readable-stream@2.3.8: ~1.1.1; readable-stream@4.7.0: ^1.3.0 |
| strip-ansi | 6.0.1, 7.2.0 | 7.2.0 | 6.0.1, 7.2.0 | Current upstream parents retain these version slots: @isaacs/cliui@8.0.2: ^7.0.1; cliui@8.0.1: ^6.0.1; cliui@9.0.1: ^7.1.0; string-length@4.0.2: ^6.0.0; string-width@4.2.3: ^6.0.1; string-width@5.1.2: ^7.0.1; string-width@7.2.0: ^7.1.0; string-width@8.3.0: ^7.1.2; wrap-ansi@7.0.0: ^6.0.0; wrap-ansi@8.1.0: ^7.0.1; wrap-ansi@9.0.2: ^7.1.0 |
| strip-bom | 4.0.0 | 5.0.0 | 4.0.0 | Current upstream parents retain these version slots: jest-runtime@30.5.2: ^4.0.0 |
| strip-final-newline | 2.0.0 | 4.0.0 | 2.0.0, 4.0.0 | Current upstream parents retain these version slots: execa@10.1.0: ^4.0.0; execa@5.1.1: ^2.0.0 |
| strip-json-comments | 3.1.1 | 5.0.3 | 3.1.1 | Current upstream parents retain these version slots: jest-config@30.5.2: ^3.1.1 |
| superagent | 10.4.1 | 10.4.1 | 10.4.1 | Current |
| supertest | 7.3.1 | 7.3.1 | 7.3.1 | Current |
| supports-color | 7.2.0, 8.1.1 | 11.0.0 | 7.2.0, 8.1.1 | Current upstream parents retain these version slots: chalk@4.1.2: ^7.1.0; istanbul-lib-report@3.0.1: ^7.1.0; jest-worker@30.5.1: ^8.1.1 |
| synckit | 0.11.13 | 0.12.1 | 0.11.13 | Current upstream parents retain these version slots: eslint-plugin-prettier@5.5.6: ^0.11.13; jest-snapshot@30.5.2: ^0.11.8 |
| tar-stream | 3.1.7 | 3.2.2 | 3.2.2 | Current |
| teex | unlocked/not declared | 1.0.1 | 1.0.1 | Current |
| test-anywhere | 0.9.1 | 0.9.1 | 0.9.1 | Current |
| test-exclude | 7.0.2 | 8.0.0 | 7.0.2 | Current upstream parents retain these version slots: babel-plugin-istanbul@8.0.0: ^7.0.1 |
| text-decoder | 1.2.3 | 1.2.7 | 1.2.7 | Current |
| tinyexec | 1.3.1 | 1.3.1 | 1.3.1 | Current |
| tinyglobby | 0.2.17 | 0.2.17 | 0.2.17 | Current |
| toidentifier | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| tslib | 2.8.1 | 2.8.1 | 2.8.1 | Current |
| turndown | 7.2.4 | 7.2.4 | 7.2.4 | Current |
| turndown-plugin-gfm | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| type-check | 0.4.0 | 0.4.0 | 0.4.0 | Current |
| type-detect | 4.0.8 | 4.1.0 | 4.0.8 | Current upstream parents retain these version slots: @sinonjs/commons@3.0.1: 4.0.8 |
| type-fest | 0.21.3 | 5.10.0 | 0.21.3 | Current upstream parents retain these version slots: ansi-escapes@4.3.2: ^0.21.3 |
| type-is | 2.1.0 | 3.0.0 | 2.1.0 | Current upstream parents retain these version slots: body-parser@2.3.0: ^2.1.0; express@5.2.1: ^2.0.1 |
| typed-query-selector | 2.12.3 | 2.12.3 | 2.12.3 | Current |
| uc.micro | 3.0.0 | 3.0.0 | 3.0.0 | Current |
| undici | 7.30.0 | 8.11.2 | 7.30.0 | Current upstream parents retain these version slots: cheerio@1.2.0: ^7.19.0 |
| undici-types | 8.9.0 | 8.11.2 | 8.9.0 | Current upstream parents retain these version slots: @types/node@26.6.4: ~8.9.0 |
| unicode-canonical-property-names-ecmascript | 2.0.1 | 2.0.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| unicode-match-property-ecmascript | 2.0.0 | 2.0.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| unicode-match-property-value-ecmascript | 2.2.1 | 2.2.1 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| unicode-property-aliases-ecmascript | 2.2.0 | 2.2.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| unicorn-magic | unlocked/not declared | 0.4.1 | 0.3.0 | Current upstream parents retain these version slots: npm-run-path@6.0.0: ^0.3.0 |
| universalify | 2.0.1 | 2.0.1 | 2.0.1 | Current |
| unpipe | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| unrs-resolver | 1.12.2 | 1.12.2 | 1.12.2 | Current |
| unzipper | 0.12.5 | 0.12.5 | 0.12.5 | Current |
| update-browserslist-db | 1.3.3 | 1.3.4 | 1.3.4 | Current |
| uri-js | 4.4.1 | 4.4.1 | 4.4.1 | Current |
| use-m | unlocked/not declared | 8.16.4 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| util-deprecate | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| v8-to-istanbul | 9.3.0 | 9.3.0 | 9.3.0 | Current |
| vary | 1.1.2 | 1.1.2 | 1.1.2 | Current |
| verkit | 0.5.0 | 0.5.0 | removed | Removed/unneeded; native ESM/watch or locked Execa replaces the former path |
| web-streams-polyfill | 3.3.3 | 4.3.0 | 3.3.3 | Current upstream parents retain these version slots: fetch-blob@3.2.0: ^3.0.3 |
| webdriver-bidi-protocol | 0.4.3 | 1.0.1 | 0.4.3 | Current upstream parents retain these version slots: puppeteer-core@25.12.0: 0.4.3 |
| whatwg-encoding | 3.1.1 | 3.1.1 | 3.1.1 | Current |
| whatwg-mimetype | 4.0.0 | 5.0.0 | 4.0.0 | Current upstream parents retain these version slots: cheerio@1.2.0: ^4.0.0 |
| which | 2.0.2 | 7.0.0 | 2.0.2 | Current upstream parents retain these version slots: cross-spawn@7.0.6: ^2.0.1 |
| which-command | unlocked/not declared | 0.1.0 | 0.1.0 | Current |
| word-wrap | 1.2.5 | 1.2.5 | 1.2.5 | Current |
| wrap-ansi | 7.0.0, 8.1.0, 9.0.2 | 10.0.2 | 7.0.0, 8.1.0, 9.0.2 | Current upstream parents retain these version slots: @isaacs/cliui@8.0.2: ^8.1.0; cliui@8.0.1: ^7.0.0; cliui@9.0.1: ^9.0.0 |
| wrappy | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| write-file-atomic | 5.0.1 | 8.0.0 | 5.0.1 | Current upstream parents retain these version slots: @jest/transform@30.5.2: ^5.0.1 |
| ws | 8.22.0 | 8.22.0 | 8.22.0 | Current |
| xml | 1.0.1 | 1.0.1 | 1.0.1 | Current |
| xml-js | 1.6.11 | 1.6.11 | 1.6.11 | Current |
| y18n | 5.0.8 | 5.0.8 | 5.0.8 | Current |
| yallist | 3.1.1 | 5.0.0 | 3.1.1 | Current upstream parents retain these version slots: lru-cache@5.1.1: ^3.0.2 |
| yaml | 2.9.1 | 2.9.1 | 2.9.1 | Current |
| yargs | 17.7.2, 18.2.0 | 18.2.0 | 17.7.3, 18.2.0 | Current upstream parents retain these version slots: @puppeteer/browsers@3.2.3: ^18.0.0; jest-cli@30.5.2: ^17.7.2; lino-arguments@0.3.0: ^17.7.2 |
| yargs-parser | 21.1.1, 22.0.0 | 22.0.0 | 21.1.1, 22.0.0 | Current upstream parents retain these version slots: yargs@17.7.3: ^21.1.1; yargs@18.2.0: ^22.0.0 |
| yocto-queue | 0.1.0 | 1.2.2 | 0.1.0 | Current upstream parents retain these version slots: p-limit@3.1.0: ^0.1.0 |
| yoctocolors | unlocked/not declared | 2.2.0 | 2.2.0 | Current |
| zip-stream | 7.0.5 | 7.0.5 | 7.0.5 | Current |
| zod | 3.25.76 | 4.6.5 | 3.25.76 | Current upstream parents retain these version slots: chromium-bidi@17.0.2: ^3.24.1 |

## Cargo: both projects and every registry lockfile entry

| Dependency | Before | Registry latest | After | Reason for older/removal |
| --- | --- | --- | --- | --- |
| adler2 | 2.0.1 | 2.0.1 | 2.0.1 | Current |
| aead | 0.6.1 | 0.6.1 | 0.6.1 | Current |
| aes | 0.9.3 | 0.9.3 | 0.9.3 | Current |
| aes-gcm | 0.11.1 | 0.11.1 | 0.11.1 | Current |
| ahash | 0.8.12 | 0.8.12 | 0.8.12 | Current |
| aho-corasick | 1.1.5 | 1.1.5 | 1.1.5 | Current |
| android_system_properties | 0.1.6 | 0.1.6 | 0.1.6 | Current |
| anstream | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| anstyle | 1.0.14 | 1.0.14 | 1.0.14 | Current |
| anstyle-parse | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| anstyle-query | 1.1.5 | 1.1.5 | 1.1.5 | Current |
| anstyle-wincon | 3.0.11 | 3.0.11 | 3.0.11 | Current |
| anyhow | 1.0.104 | 1.0.104 | 1.0.104 | Current |
| arrayvec | 0.7.8 | 0.7.8 | 0.7.8 | Current |
| astral-tl | 0.8.0 | 0.8.0 | 0.8.0 | Current |
| async-compression | 0.4.50 | 0.4.50 | 0.4.50 | Current |
| async-trait | 0.1.92 | 0.1.92 | 0.1.92 | Current |
| async-tungstenite | 0.32.1, 0.35.0 | 0.35.0 | 0.32.1, 0.35.0 | Current upstream parents retain these version slots: browser-commander@0.19.0: ^0.35.0; chromiumoxide@0.9.1: ^0.32; web-capture@0.5.0: ^0.35.0 |
| atomic-waker | 1.1.2 | 1.1.2 | 1.1.2 | Current |
| autocfg | 1.5.1 | 1.5.1 | 1.5.1 | Current |
| aws-lc-rs | 1.18.1 | 1.18.1 | 1.18.1 | Current |
| aws-lc-sys | 0.45.0 | 0.45.0 | 0.45.0 | Current |
| axum | 0.8.9 | 0.8.9 | 0.8.9 | Current |
| axum-core | 0.5.6 | 0.5.6 | 0.5.6 | Current |
| base64 | 0.22.1, 0.23.1 | 0.23.1 | 0.22.1, 0.23.1 | Current upstream parents retain these version slots: axum@0.8.9: ^0.22.1; browser-commander@0.19.0: ^0.23.1; chromiumoxide@0.9.1: ^0.22; cookie@0.16.2: ^0.20; cookie@0.18.2: ^0.22; fantoccini@0.22.1: ^0.22; html-to-markdown-rs@3.17.2: ^0.23; hyper-util@0.1.21: ^0.23; plist@1.10.1: ^0.23.1; reqwest@0.13.5: ^0.23; rustls-platform-verifier@0.7.1: ^0.22; rustls-webpki@0.103.15: ^0.23; rustls@0.23.45: ^0.22; tower-http@0.6.11: ^0.22; tower-http@0.7.1: ^0.22; web-capture@0.5.0: ^0.23.1; webdriver@0.53.0: ^0.22 |
| bitflags | 1.3.2, 2.13.2 | 2.13.2 | 1.3.2, 2.13.2 | Current upstream parents retain these version slots: html-to-markdown-rs@3.17.2: ^2; libredox@0.1.25: ^2; nix@0.28.0: ^2.3.1; nix@0.31.3: ^2.3.3; openssl@0.10.81: ^2.2.1; png@0.18.1: ^2.0; portable-pty@0.9.0: ^1.3; redox_syscall@0.5.18: ^2.4; rusqlite@0.40.2: ^2.6.0; rustix@1.1.5: ^2.4.0; security-framework@3.7.0: ^2.11; selectors@0.38.0: ^2; tower-http@0.6.11: ^2.0.2; tower-http@0.7.1: ^2.0.2; vte@0.15.0: ^2.3.3; wit-bindgen@0.57.1: ^2.11.1 |
| block-buffer | 0.10.4, 0.12.1 | 0.12.1 | 0.10.4, 0.12.1 | Current upstream parents retain these version slots: cipher@0.5.2: ^0.12; digest@0.10.7: ^0.10; digest@0.11.3: ^0.12 |
| block-padding | 0.4.2 | 0.4.2 | 0.4.2 | Current |
| browser-commander | 0.19.0 | 0.19.0 | 0.19.0 | Current |
| bumpalo | 3.20.3 | 3.20.3 | 3.20.3 | Current |
| bytemuck | 1.25.2 | 1.25.2 | 1.25.2 | Current |
| byteorder-lite | 0.1.0 | 0.1.0 | 0.1.0 | Current |
| bytes | 1.12.1 | 1.12.1 | 1.12.1 | Current |
| cargo-audit | not previously locked | 0.22.2 | 0.22.2 (tool) | Registry-current development tool |
| cargo-edit | not previously locked | 0.13.13 | 0.13.13 (tool) | Registry-current development tool |
| cbc | 0.2.1 | 0.2.1 | 0.2.1 | Current |
| cc | 1.6.0 | 1.6.0 | 1.6.0 | Current |
| cfg-if | 1.0.5 | 1.0.5 | 1.0.5 | Current |
| cfg_aliases | 0.1.1, 0.2.2 | 0.2.2 | 0.1.1, 0.2.2 | Current upstream parents retain these version slots: nix@0.28.0: ^0.1.1; nix@0.31.3: ^0.2.1; quinn-udp@0.5.16: ^0.2; quinn@0.11.12: ^0.2 |
| chacha20 | 0.10.2 | 0.10.2 | 0.10.2 | Current |
| chromiumoxide | 0.9.1 | 0.9.1 | 0.9.1 | Current |
| chromiumoxide_cdp | 0.9.1 | 0.9.1 | 0.9.1 | Current |
| chromiumoxide_pdl | 0.9.1 | 0.9.1 | 0.9.1 | Current |
| chromiumoxide_types | 0.9.1 | 0.9.1 | 0.9.1 | Current |
| chrono | 0.4.45 | 0.4.45 | 0.4.45 | Current |
| cipher | 0.5.2 | 0.5.2 | 0.5.2 | Current |
| clap | 4.6.7 | 4.6.7 | 4.6.7 | Current |
| clap_builder | 4.6.7 | 4.6.7 | 4.6.7 | Current |
| clap_derive | 4.6.7 | 4.6.7 | 4.6.7 | Current |
| clap_lex | 1.1.1 | 1.1.1 | 1.1.1 | Current |
| cmake | 0.1.58 | 0.1.58 | 0.1.58 | Current |
| cmov | 0.5.4 | 0.5.4 | 0.5.4 | Current |
| color_quant | 1.1.0 | 2.0.0 | 1.1.0 | Current upstream parents retain these version slots: gif@0.14.2: ^1.1; image@0.25.10: ^1.1 |
| colorchoice | 1.0.5 | 1.0.5 | 1.0.5 | Current |
| combine | 4.6.8 | 4.6.8 | 4.6.8 | Current |
| command-stream | 1.5.3 | 1.5.3 | 1.5.3 | Current |
| compression-codecs | 0.4.45 | 0.4.45 | 0.4.45 | Current |
| compression-core | 0.4.33 | 0.4.33 | 0.4.33 | Current |
| const-oid | 0.10.2 | 0.10.2 | 0.10.2 | Current |
| const-random | 0.1.18 | 0.1.18 | 0.1.18 | Current |
| const-random-macro | 0.1.16 | 0.1.16 | 0.1.16 | Current |
| cookie | 0.16.2, 0.18.2 | 0.18.2 | 0.16.2, 0.18.2 | Current upstream parents retain these version slots: browser-commander@0.19.0: ^0.18.2; cookie_store@0.22.1: ^0.18.0; fantoccini@0.22.1: ^0.18.0; reqwest@0.13.5: ^0.18.0; webdriver@0.53.0: ^0.16 |
| cookie_store | 0.22.1 | 0.22.1 | 0.22.1 | Current |
| core-foundation | 0.10.1 | 0.10.1 | 0.10.1 | Current |
| core-foundation-sys | 0.8.7 | 0.8.7 | 0.8.7 | Current |
| core_detect | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| core_maths | 0.1.1 | 0.1.1 | 0.1.1 | Current |
| cpubits | 0.1.1 | 0.1.1 | 0.1.1 | Current |
| cpufeatures | 0.2.17, 0.3.1 | 0.3.1 | 0.2.17, 0.3.1 | Current upstream parents retain these version slots: aes@0.9.3: ^0.3; chacha20@0.10.2: ^0.3; polyval@0.7.3: ^0.3; sha1@0.10.7: ^0.2; sha1@0.11.0: ^0.3; sha2@0.11.0: ^0.3 |
| crc32fast | 1.5.2 | 1.5.2 | 1.5.2 | Current |
| crunchy | 0.2.4 | 0.2.4 | 0.2.4 | Current |
| crypto-common | 0.1.7, 0.2.2 | 0.2.2 | 0.1.7, 0.2.2 | Current upstream parents retain these version slots: aead@0.6.1: ^0.2; cipher@0.5.2: ^0.2.2; digest@0.10.7: ^0.1.3; digest@0.11.3: ^0.2; universal-hash@0.6.1: ^0.2 |
| cssparser | 0.37.0 | 0.38.0 | 0.37.0 | Current upstream parents retain these version slots: scraper@0.27.0: ^0.37.0; selectors@0.38.0: ^0.37 |
| cssparser-macros | 0.7.1 | 0.7.1 | 0.7.1 | Current |
| csv | 1.4.0 | 1.4.0 | 1.4.0 | Current |
| csv-core | 0.1.13 | 0.1.13 | 0.1.13 | Current |
| ctor | 1.0.13 | 1.0.13 | 1.0.13 | Current |
| ctr | 0.10.1 | 0.10.1 | 0.10.1 | Current |
| ctutils | 0.4.3 | 0.4.3 | 0.4.3 | Current |
| data-encoding | 2.11.1 | 2.11.1 | 2.11.1 | Current |
| deranged | 0.5.8 | 0.5.8 | 0.5.8 | Current |
| derive_more | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| derive_more-impl | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| des | 0.9.0 | 0.9.0 | 0.9.0 | Current |
| digest | 0.10.7, 0.11.3 | 0.11.3 | 0.10.7, 0.11.3 | Current upstream parents retain these version slots: hmac@0.13.0: ^0.11.2; pbkdf2@0.13.0: ^0.11; sha1@0.10.7: ^0.10.7; sha1@0.11.0: ^0.11; sha2@0.11.0: ^0.11 |
| dirs | 7.0.0 | 7.0.0 | 7.0.0 | Current |
| dirs-sys | 0.5.0 | 0.5.0 | 0.5.0 | Current |
| displaydoc | 0.2.7 | 0.2.7 | 0.2.7 | Current |
| document-features | 0.2.12 | 0.2.12 | 0.2.12 | Current |
| dotenvy | 0.15.7 | 0.15.7 | 0.15.7 | Current |
| downcast-rs | 1.2.1 | 2.0.2 | 1.2.1 | Current upstream parents retain these version slots: portable-pty@0.9.0: ^1.0 |
| dtoa | 1.0.11 | 1.0.11 | 1.0.11 | Current |
| dtoa-short | 0.3.5 | 0.3.5 | 0.3.5 | Current |
| dunce | 1.0.5 | 1.0.5 | 1.0.5 | Current |
| ego-tree | 0.11.0 | 0.11.0 | 0.11.0 | Current |
| either | 1.19.0 | 1.19.0 | 1.19.0 | Current |
| encoding_rs | 0.8.42 | 0.8.42 | 0.8.42 | Current |
| equivalent | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| errno | 0.3.14 | 0.3.14 | 0.3.14 | Current |
| fallible-iterator | 0.3.0 | 0.3.0 | 0.3.0 | Current |
| fallible-streaming-iterator | 0.1.9 | 0.1.9 | 0.1.9 | Current |
| fantoccini | 0.22.1 | 0.22.1 | 0.22.1 | Current |
| fastrand | 2.5.0 | 2.5.0 | 2.5.0 | Current |
| fdeflate | 0.3.7 | 0.3.7 | 0.3.7 | Current |
| filedescriptor | 0.8.3 | 0.8.3 | 0.8.3 | Current |
| filetime | 0.2.29 | 0.2.29 | 0.2.29 | Current |
| find-msvc-tools | 0.1.14 | 0.1.14 | 0.1.14 | Current |
| flate2 | 1.1.10 | 1.1.10 | 1.1.10 | Current |
| fnv | 1.0.7 | 1.0.7 | 1.0.7 | Current |
| foldhash | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| foreign-types | 0.3.2 | 0.5.0 | 0.3.2 | Current upstream parents retain these version slots: openssl@0.10.81: ^0.3.1 |
| foreign-types-shared | 0.1.1 | 0.3.1 | 0.1.1 | Current upstream parents retain these version slots: foreign-types@0.3.2: ^0.1 |
| form_urlencoded | 1.2.2 | 1.2.2 | 1.2.2 | Current |
| fs_extra | 1.3.0 | 1.3.0 | 1.3.0 | Current |
| futures | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-channel | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-core | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-executor | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-io | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-macro | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-sink | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-task | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| futures-timer | 3.0.4 | 3.0.4 | 3.0.4 | Current |
| futures-util | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| generic-array | 0.14.7 | 1.4.5 | 0.14.7 | Current upstream parents retain these version slots: block-buffer@0.10.4: ^0.14; crypto-common@0.1.7: =0.14.7; tinyvec@1.13.3: ^1.1.1 |
| getopts | 0.2.24 | 0.2.24 | 0.2.24 | Current |
| getrandom | 0.2.17, 0.3.4, 0.4.3 | 0.4.3 | 0.2.17, 0.3.4, 0.4.3 | Current upstream parents retain these version slots: ahash@0.8.12: ^0.3.1; browser-commander@0.19.0: ^0.4.3; const-random-macro@0.1.16: ^0.2.0; crypto-common@0.2.2: ^0.4; fastrand@2.5.0: ^0.4; iana-time-zone@0.1.65: ^0.2.1; jobserver@0.1.35: ^0.4; quinn-proto@0.11.19: ^0.4; rand@0.10.3: ^0.4.0; rand_core@0.9.5: ^0.3.0; redox_users@0.5.3: ^0.4; ring@0.17.14: ^0.2.10; rusqlite@0.40.2: ^0.4; tempfile@3.27.0: >=0.3.0, <0.5; web-time@1.1.0: ^0.2; zerovec@0.10.4: ^0.2; zerovec@0.11.8: ^0.3; zip@8.6.0: ^0.4 |
| ghash | 0.6.0 | 0.6.0 | 0.6.0 | Current |
| gif | 0.14.2 | 0.14.2 | 0.14.2 | Current |
| glob | 0.3.4 | 0.3.4 | 0.3.4 | Current |
| h2 | 0.4.20 | 0.4.20 | 0.4.20 | Current |
| hashbrown | 0.16.1, 0.17.1 | 0.17.1 | 0.16.1, 0.17.1 | Current upstream parents retain these version slots: ahash@0.8.12: ^0.14.3; foldhash@0.2.0: ^0.15; hashlink@0.12.2: ^0.17; indexmap@2.14.2: ^0.17; publicsuffix@2.3.0: ^0.15.1; rsqlite-vfs@0.1.1: ^0.16.1; rustls@0.23.45: ^0.15; tokio-util@0.7.19: ^0.15.0 |
| hashlink | 0.12.2 | 0.12.2 | 0.12.2 | Current |
| heck | 0.5.0 | 0.5.0 | 0.5.0 | Current |
| hmac | 0.13.0 | 0.13.0 | 0.13.0 | Current |
| html-escape | 0.2.15 | 0.2.15 | 0.2.15 | Current |
| html-to-markdown-rs | 3.17.2 | 3.17.2 | 3.17.2 | Current |
| html2md | 0.2.17 | 0.2.17 | 0.2.17 | Current |
| html5ever | 0.39.0, 0.40.1 | 0.40.1 | 0.39.0, 0.40.1 | Current upstream parents retain these version slots: html-to-markdown-rs@3.17.2: ^0.40.1; html2md@0.2.17: ^0.39.0; markup5ever_rcdom@0.39.0+unofficial: ^0.39; scraper@0.27.0: ^0.39.0 |
| http | 0.2.12, 1.5.0 | 1.5.0 | 0.2.12, 1.5.0 | Current upstream parents retain these version slots: axum-core@0.5.6: ^1.0.0; axum@0.8.9: ^1.0.0; fantoccini@0.22.1: ^1.0.0; h2@0.4.20: ^1.1; http-body-util@0.1.5: ^1; http-body@1.1.0: ^1; hyper-rustls@0.27.10: ^1; hyper-util@0.1.21: ^1.0; hyper@1.12.0: ^1; reqwest@0.13.5: ^1.1; tower-http@0.6.11: ^1.0; tower-http@0.7.1: ^1.0; tower-service@0.3.3: ^0.2; tower@0.5.3: ^1; tungstenite@0.28.0: ^1.0; tungstenite@0.30.0: ^1.0; webdriver@0.53.0: ^0.2 |
| http-body | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| http-body-util | 0.1.5 | 0.1.5 | 0.1.5 | Current |
| httparse | 1.10.1 | 1.10.1 | 1.10.1 | Current |
| httpdate | 1.0.3 | 1.0.3 | 1.0.3 | Current |
| hybrid-array | 0.4.15 | 0.4.15 | 0.4.15 | Current |
| hyper | 1.12.0 | 1.12.0 | 1.12.0 | Current |
| hyper-rustls | 0.27.10 | 0.27.10 | 0.27.10 | Current |
| hyper-tls | 0.6.0 | 0.6.0 | 0.6.0 | Current |
| hyper-util | 0.1.21 | 0.1.21 | 0.1.21 | Current |
| iana-time-zone | 0.1.65 | 0.1.65 | 0.1.65 | Current |
| iana-time-zone-haiku | 0.1.2 | 0.1.2 | 0.1.2 | Current |
| icu_collections | 1.5.0, 2.3.0 | 2.3.0 | 1.5.0, 2.3.0 | Current upstream parents retain these version slots: icu_normalizer@2.3.0: ~2.3.0; icu_properties@2.3.0: ~2.3.0; icu_segmenter@1.5.0: ~1.5.0 |
| icu_locale_core | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| icu_locid | 1.5.0 | 2.0.0 | 1.5.0 | Current upstream parents retain these version slots: icu_provider@1.5.0: ~1.5.0; icu_segmenter@1.5.0: ~1.5.0 |
| icu_normalizer | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| icu_normalizer_data | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| icu_properties | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| icu_properties_data | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| icu_provider | 1.5.0, 2.3.1 | 2.3.1 | 1.5.0, 2.3.1 | Current upstream parents retain these version slots: icu_normalizer@2.3.0: ^2.3.0; icu_properties@2.3.0: ^2.3.0; icu_segmenter@1.5.0: ~1.5.0 |
| icu_provider_macros | 1.5.0 | 1.5.0 | 1.5.0 | Current |
| icu_segmenter | 1.5.0 | 2.3.0 | 1.5.0 | Current upstream parents retain these version slots: webdriver@0.53.0: ^1.5 |
| icu_segmenter_data | 1.5.1 | 2.3.0 | 1.5.1 | Current upstream parents retain these version slots: icu_segmenter@1.5.0: ~1.5.0 |
| idna | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| idna_adapter | 1.2.2 | 1.2.2 | 1.2.2 | Current |
| image | 0.25.10 | 0.25.10 | 0.25.10 | Current |
| image-webp | 0.2.4 | 0.2.4 | 0.2.4 | Current |
| indexmap | 2.14.2 | 2.14.2 | 2.14.2 | Current |
| inout | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| ipnet | 2.12.2 | 2.12.2 | 2.12.2 | Current |
| is_terminal_polyfill | 1.70.2 | 1.70.2 | 1.70.2 | Current |
| itoa | 1.0.18 | 1.0.18 | 1.0.18 | Current |
| jni | 0.22.4 | 0.22.4 | 0.22.4 | Current |
| jni-macros | 0.22.4 | 0.22.4 | 0.22.4 | Current |
| jni-sys | 0.4.1 | 0.4.1 | 0.4.1 | Current |
| jni-sys-macros | 0.4.1 | 0.4.1 | 0.4.1 | Current |
| jobserver | 0.1.35 | 0.1.35 | 0.1.35 | Current |
| js-sys | 0.3.106 | 0.3.106 | 0.3.106 | Current |
| lazy_static | 1.5.1 | 1.5.1 | 1.5.1 | Current |
| libc | 0.2.190 | 0.2.190 | 0.2.190 | Current |
| libm | 0.2.16 | 0.2.16 | 0.2.16 | Current |
| libredox | 0.1.25 | 0.1.25 | 0.1.25 | Current |
| libsqlite3-sys | 0.38.2 | 0.38.2 | 0.38.2 | Current |
| link-section | 0.19.3 | 0.19.3 | 0.19.3 | Current |
| linktime-proc-macro | 0.2.3 | 0.2.3 | 0.2.3 | Current |
| lino-arguments | 0.4.0 | 0.4.0 | 0.4.0 | Current |
| lino-env | 0.1.0 | 0.1.0 | 0.1.0 | Current |
| linux-raw-sys | 0.12.1 | 0.12.1 | 0.12.1 | Current |
| litemap | 0.7.5, 0.8.3 | 0.8.3 | 0.7.5, 0.8.3 | Current upstream parents retain these version slots: icu_locale_core@2.3.0: ^0.8.0; icu_locid@1.5.0: ^0.7.3; zerotrie@0.2.5: ^0.8.0 |
| litrs | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| lock_api | 0.4.14 | 0.4.14 | 0.4.14 | Current |
| log | 0.4.34 | 0.4.34 | 0.4.34 | Current |
| lru-slab | 0.1.3 | 0.1.3 | 0.1.3 | Current |
| markup5ever | 0.39.0, 0.40.0 | 0.40.0 | 0.39.0, 0.40.0 | Current upstream parents retain these version slots: html5ever@0.39.0: ^0.39; html5ever@0.40.1: ^0.40; markup5ever_rcdom@0.39.0+unofficial: ^0.39; xml5ever@0.39.0: ^0.39 |
| markup5ever_rcdom | 0.39.0+unofficial | 0.39.0+unofficial | 0.39.0+unofficial | Current |
| matchers | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| matchit | 0.8.4 | 0.9.2 | 0.8.4 | Current upstream parents retain these version slots: axum@0.8.9: =0.8.4 |
| memchr | 2.8.3 | 2.8.3 | 2.8.3 | Current |
| mime | 0.3.17 | 0.3.17 | 0.3.17 | Current |
| miniz_oxide | 0.8.9, 0.9.1 | 0.9.1 | 0.8.9, 0.9.1 | Current upstream parents retain these version slots: fdeflate@0.3.7: ^0.7.1; flate2@1.1.10: ^0.9.0; png@0.18.1: ^0.8; zopfli@0.8.3: ^0.8.9 |
| mio | 1.2.4 | 1.2.4 | 1.2.4 | Current |
| moxcms | 0.8.1 | 0.9.1 | 0.8.1 | Current upstream parents retain these version slots: image@0.25.10: ^0.8.0 |
| multiversion_no_op | 1.0.0 | 1.0.0 | 1.0.0 | Current |
| native-tls | 0.2.18 | 0.2.18 | 0.2.18 | Current |
| new_debug_unreachable | 1.0.6 | 1.0.6 | 1.0.6 | Current |
| nix | 0.28.0, 0.31.3 | 0.31.3 | 0.28.0, 0.31.3 | Current upstream parents retain these version slots: command-stream@1.5.3: ^0.31.3; jobserver@0.1.35: ^0.31.3; portable-pty@0.9.0: ^0.28; tokio@1.53.2: ^0.31.0; vt100@0.16.2: ^0.30.1 |
| nu-ansi-term | 0.50.3 | 0.50.3 | 0.50.3 | Current |
| num-conv | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| num-traits | 0.2.19 | 0.2.19 | 0.2.19 | Current |
| once_cell | 1.21.4 | 1.21.4 | 1.21.4 | Current |
| once_cell_polyfill | 1.70.2 | 1.70.2 | 1.70.2 | Current |
| openssl | 0.10.81 | 0.10.81 | 0.10.81 | Current |
| openssl-macros | 0.1.1 | 0.1.1 | 0.1.1 | Current |
| openssl-probe | 0.2.1 | 0.2.1 | 0.2.1 | Current |
| openssl-sys | 0.9.117 | 0.9.117 | 0.9.117 | Current |
| option-ext | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| parking_lot | 0.12.5 | 0.12.5 | 0.12.5 | Current |
| parking_lot_core | 0.9.12 | 0.9.12 | 0.9.12 | Current |
| pbkdf2 | 0.13.0 | 0.13.0 | 0.13.0 | Current |
| percent-encoding | 2.3.2 | 2.3.2 | 2.3.2 | Current |
| phf | 0.13.1, 0.14.0 | 0.14.0 | 0.13.1, 0.14.0 | Current upstream parents retain these version slots: cssparser@0.37.0: ^0.13.1; html-to-markdown-rs@3.17.2: ^0.14; selectors@0.38.0: ^0.13; web_atoms@0.2.6: ^0.13; web_atoms@0.3.0: ^0.14 |
| phf_codegen | 0.13.1, 0.14.0 | 0.14.0 | 0.13.1, 0.14.0 | Current upstream parents retain these version slots: selectors@0.38.0: ^0.13; web_atoms@0.2.6: ^0.13; web_atoms@0.3.0: ^0.14 |
| phf_generator | 0.13.1, 0.14.0 | 0.14.0 | 0.13.1, 0.14.0 | Current upstream parents retain these version slots: phf_codegen@0.13.1: ^0.13.1; phf_codegen@0.14.0: ^0.14.0; phf_macros@0.13.1: ^0.13.1; phf_macros@0.14.0: ^0.14.0; string_cache_codegen@0.11.2: ^0.14; string_cache_codegen@0.6.1: ^0.13 |
| phf_macros | 0.13.1, 0.14.0 | 0.14.0 | 0.13.1, 0.14.0 | Current upstream parents retain these version slots: phf@0.13.1: ^0.13.1; phf@0.14.0: ^0.14.0 |
| phf_shared | 0.13.1, 0.14.0 | 0.14.0 | 0.13.1, 0.14.0 | Current upstream parents retain these version slots: phf@0.13.1: ^0.13.1; phf@0.14.0: ^0.14.0; phf_codegen@0.13.1: ^0.13.1; phf_codegen@0.14.0: ^0.14.0; phf_generator@0.13.1: ^0.13.1; phf_generator@0.14.0: ^0.14.0; phf_macros@0.13.1: ^0.13.1; phf_macros@0.14.0: ^0.14.0; string_cache@0.11.0: ^0.14; string_cache@0.9.0: ^0.13; string_cache_codegen@0.11.2: ^0.14; string_cache_codegen@0.6.1: ^0.13 |
| pin-project-lite | 0.2.17 | 0.2.17 | 0.2.17 | Current |
| pkg-config | 0.3.34 | 0.3.34 | 0.3.34 | Current |
| plist | 1.10.1 | 1.10.1 | 1.10.1 | Current |
| png | 0.18.1 | 0.18.1 | 0.18.1 | Current |
| polyval | 0.7.3 | 0.7.3 | 0.7.3 | Current |
| portable-pty | 0.9.0 | 0.9.0 | 0.9.0 | Current |
| potential_utf | 0.1.6 | 0.1.6 | 0.1.6 | Current |
| powerfmt | 0.2.1 | 0.2.1 | 0.2.1 | Current |
| ppv-lite86 | 0.2.21 | 0.2.21 | 0.2.21 | Current |
| precomputed-hash | 0.1.1 | 0.1.1 | 0.1.1 | Current |
| proc-macro2 | 1.0.107 | 1.0.107 | 1.0.107 | Current |
| psl-types | 2.0.11 | 2.0.11 | 2.0.11 | Current |
| publicsuffix | 2.3.0 | 2.3.0 | 2.3.0 | Current |
| pxfm | 0.1.30 | 0.1.30 | 0.1.30 | Current |
| quick-error | 2.0.1 | 2.0.1 | 2.0.1 | Current |
| quick-xml | 0.42.0 | 0.42.0 | 0.42.0 | Current |
| quinn | 0.11.12 | 0.11.12 | 0.11.12 | Current |
| quinn-proto | 0.11.19 | 0.11.19 | 0.11.19 | Current |
| quinn-udp | 0.5.16 | 0.6.3 | 0.5.16 | Current upstream parents retain these version slots: quinn@0.11.12: ^0.5 |
| quote | 1.0.47 | 1.0.47 | 1.0.47 | Current |
| r-efi | 5.3.0, 6.0.0 | 7.1.0 | 5.3.0, 6.0.0 | Current upstream parents retain these version slots: getrandom@0.3.4: ^5.1; getrandom@0.4.3: ^6 |
| rand | 0.10.3, 0.9.5 | 0.10.3 | 0.10.3, 0.9.5 | Current upstream parents retain these version slots: ahash@0.8.12: ^0.8.5; async-compression@0.4.50: ^0.10; base64@0.22.1: ^0.8.5; base64@0.23.1: ^0.10.2; bumpalo@3.20.3: ^0.8.5; byteorder-lite@0.1.0: ^0.7; cookie@0.16.2: ^0.8; cookie@0.18.2: ^0.8; crc32fast@1.5.2: ^0.8; deranged@0.5.8: ^0.10.0; deranged@0.5.8: ^0.8.4; deranged@0.5.8: ^0.9.0; fastrand@2.5.0: ^0.10; fdeflate@0.3.7: ^0.8.5; flate2@1.1.10: ^0.9; foldhash@0.2.0: ^0.8; h2@0.4.20: ^0.8.4; hashbrown@0.16.1: ^0.9.0; hashbrown@0.17.1: ^0.9.0; http@0.2.12: ^0.7.0; http@1.5.0: ^0.10; httparse@1.10.1: ^0.8.5; image-webp@0.2.4: ^0.8.5; litemap@0.8.3: ^0.9; mio@1.2.4: ^0.9; moxcms@0.8.1: ^0.10.0; nix@0.28.0: ^0.8; nix@0.31.3: ^0.9; parking_lot@0.12.5: ^0.8.3; png@0.18.1: ^0.9.2; quinn-proto@0.11.19: ^0.10.1; quinn@0.11.12: ^0.10.1; rsqlite-vfs@0.1.1: ^0.9; rustc-hash@2.1.3: ^0.9; ryu@1.0.23: ^0.10; simd-adler32@0.3.10: ^0.8; subtle@2.6.1: ^0.8; tendril@0.5.1: ^0.9; time@0.3.55: ^0.10.1; time@0.3.55: ^0.8.6; time@0.3.55: ^0.9.4; tinystr@0.7.6: ^0.8; tinystr@0.8.4: ^0.9; tokio@1.53.2: ^0.9; tower@0.5.3: ^0.9; tungstenite@0.28.0: ^0.9.0; tungstenite@0.30.0: ^0.10.2; unicode-ident@1.0.26: ^0.10; vt100@0.16.2: ^0.9; web-time@1.1.0: ^0.8; winreg@0.10.1: ^0.3; writeable@0.5.5: ^0.8; writeable@0.6.4: ^0.9; zerocopy@0.8.61: ^0.8.7; zerotrie@0.2.5: ^0.9; zerovec@0.10.4: ^0.8; zerovec@0.11.8: ^0.9; zmij@1.0.23: ^0.10 |
| rand_chacha | 0.9.0 | 0.10.0 | 0.9.0 | Current upstream parents retain these version slots: rand@0.9.5: ^0.9.0 |
| rand_core | 0.10.1, 0.9.5 | 0.10.1 | 0.10.1, 0.9.5 | Current upstream parents retain these version slots: chacha20@0.10.2: ^0.10; crypto-common@0.1.7: ^0.6; crypto-common@0.2.2: ^0.10; getrandom@0.4.3: ^0.10.0; rand@0.10.3: ^0.10.0; rand@0.9.5: ^0.9.0; rand_chacha@0.9.0: ^0.9.0; rand_pcg@0.10.2: ^0.10; ryu@1.0.23: ^0.10 |
| rand_pcg | 0.10.2 | 0.10.2 | 0.10.2 | Current |
| redox_syscall | 0.5.18 | 0.9.4 | 0.5.18 | Current upstream parents retain these version slots: libredox@0.1.25: ^0.9.2; parking_lot_core@0.9.12: ^0.5 |
| redox_users | 0.5.3 | 0.5.3 | 0.5.3 | Current |
| regex | 1.13.1 | 1.13.1 | 1.13.1 | Current |
| regex-automata | 0.4.18 | 0.4.18 | 0.4.18 | Current |
| regex-syntax | 0.8.11 | 0.8.11 | 0.8.11 | Current |
| reqwest | 0.13.5 | 0.13.5 | 0.13.5 | Current |
| ring | 0.17.14 | 0.17.14 | 0.17.14 | Current |
| rsqlite-vfs | 0.1.1 | 0.2.0 | 0.1.1 | Current upstream parents retain these version slots: sqlite-wasm-rs@0.5.5: ^0.1.0 |
| rusqlite | 0.40.2 | 0.40.2 | 0.40.2 | Current |
| rustc-hash | 2.1.3 | 2.1.3 | 2.1.3 | Current |
| rustc_version | 0.4.1 | 0.4.1 | 0.4.1 | Current |
| rustix | 1.1.5 | 1.1.5 | 1.1.5 | Current |
| rustls | 0.23.45 | 0.23.45 | 0.23.45 | Current |
| rustls-native-certs | 0.8.4 | 0.8.4 | 0.8.4 | Current |
| rustls-pki-types | 1.15.1 | 1.15.1 | 1.15.1 | Current |
| rustls-platform-verifier | 0.7.1 | 0.7.1 | 0.7.1 | Current |
| rustls-platform-verifier-android | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| rustls-webpki | 0.103.15 | 0.103.15 | 0.103.15 | Current |
| rustversion | 1.0.23 | 1.0.23 | 1.0.23 | Current |
| ryu | 1.0.23 | 1.0.23 | 1.0.23 | Current |
| same-file | 1.0.6 | 1.0.6 | 1.0.6 | Current |
| schannel | 0.1.29 | 0.1.29 | 0.1.29 | Current |
| scopeguard | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| scraper | 0.27.0 | 0.27.0 | 0.27.0 | Current |
| security-framework | 3.7.0 | 3.7.0 | 3.7.0 | Current |
| security-framework-sys | 2.17.0 | 2.17.0 | 2.17.0 | Current |
| selectors | 0.38.0 | 0.41.0 | 0.38.0 | Current upstream parents retain these version slots: scraper@0.27.0: ^0.38.0 |
| semver | 1.0.28 | 1.0.28 | 1.0.28 | Current |
| serde | 1.0.229 | 1.0.229 | 1.0.229 | Current |
| serde_core | 1.0.229 | 1.0.229 | 1.0.229 | Current |
| serde_derive | 1.0.229 | 1.0.229 | 1.0.229 | Current |
| serde_json | 1.0.151 | 1.0.151 | 1.0.151 | Current |
| serde_path_to_error | 0.1.20 | 0.1.20 | 0.1.20 | Current |
| serde_urlencoded | 0.7.1 | 0.7.1 | 0.7.1 | Current |
| serial2 | 0.2.38 | 0.2.38 | 0.2.38 | Current |
| servo_arc | 0.4.3 | 0.5.0 | 0.4.3 | Current upstream parents retain these version slots: selectors@0.38.0: ^0.4.3 |
| sha1 | 0.10.7, 0.11.0 | 0.11.0 | 0.10.7, 0.11.0 | Current upstream parents retain these version slots: axum@0.8.9: ^0.10; browser-commander@0.19.0: ^0.11.0; hmac@0.13.0: ^0.11; pbkdf2@0.13.0: ^0.11; tungstenite@0.28.0: ^0.10; tungstenite@0.30.0: ^0.11.0; zip@8.6.0: ^0.11 |
| sha2 | 0.11.0 | 0.11.0 | 0.11.0 | Current |
| sharded-slab | 0.1.7 | 0.1.7 | 0.1.7 | Current |
| shared_library | 0.1.9 | 0.1.9 | 0.1.9 | Current |
| shell-words | 1.1.1 | 1.1.1 | 1.1.1 | Current |
| shlex | 2.0.1 | 2.0.1 | 2.0.1 | Current |
| signal-hook-registry | 1.4.8 | 1.4.8 | 1.4.8 | Current |
| simd-adler32 | 0.3.10 | 0.3.10 | 0.3.10 | Current |
| simd_cesu8 | 1.2.0 | 1.2.0 | 1.2.0 | Current |
| simdutf8 | 0.1.5 | 0.1.5 | 0.1.5 | Current |
| siphasher | 1.0.4 | 1.0.4 | 1.0.4 | Current |
| slab | 0.4.12 | 0.4.12 | 0.4.12 | Current |
| smallvec | 1.16.2 | 1.16.2 | 1.16.2 | Current |
| socket2 | 0.6.5 | 0.6.5 | 0.6.5 | Current |
| sqlite-wasm-rs | 0.5.5 | 0.6.1 | 0.5.5 | Current upstream parents retain these version slots: rusqlite@0.40.2: ^0.5.1 |
| stable_deref_trait | 1.2.1 | 1.2.1 | 1.2.1 | Current |
| string_cache | 0.11.0, 0.9.0 | 0.11.0 | 0.11.0, 0.9.0 | Current upstream parents retain these version slots: web_atoms@0.2.6: ^0.9.0; web_atoms@0.3.0: ^0.11.0 |
| string_cache_codegen | 0.11.2, 0.6.1 | 0.11.2 | 0.11.2, 0.6.1 | Current upstream parents retain these version slots: web_atoms@0.2.6: ^0.6.1; web_atoms@0.3.0: ^0.11.0 |
| strsim | 0.11.1 | 0.11.1 | 0.11.1 | Current |
| subtle | 2.6.1 | 2.6.1 | 2.6.1 | Current |
| syn | 2.0.119, 3.0.6 | 3.0.6 | 2.0.119, 3.0.6 | Current upstream parents retain these version slots: anyhow@1.0.104: ^3; async-trait@0.1.92: ^3; clap_derive@4.6.7: ^3.0.2; cssparser-macros@0.7.1: >=2, <4; derive_more-impl@2.1.1: ^2.0.45; displaydoc@0.2.7: ^3.0; futures-macro@0.3.34: ^3.0; icu_provider_macros@1.5.0: ^2.0.21; jni-macros@0.22.4: ^2.0; jni-sys-macros@0.4.1: ^2; libsqlite3-sys@0.38.2: ^2.0.89; openssl-macros@0.1.1: ^2; phf_macros@0.13.1: ^2; phf_macros@0.14.0: ^2; serde_derive@1.0.229: ^3; synstructure@0.13.2: ^2; synstructure@0.14.0: ^3; thiserror-impl@1.0.69: ^2.0.87; thiserror-impl@2.0.21: ^3; tokio-macros@2.7.2: ^3.0; tracing-attributes@0.1.31: ^2.0; wasm-bindgen-macro-support@0.2.129: ^3.0; windows-implement@0.60.2: ^2.0; windows-interface@0.59.3: ^2.0; yoke-derive@0.7.5: ^2.0.21; yoke-derive@0.8.4: ^3.0; zerocopy-derive@0.8.61: ^2.0.46; zerofrom-derive@0.1.8: ^3.0; zerovec-derive@0.10.4: ^2.0.21; zerovec-derive@0.11.6: ^3.0 |
| sync_wrapper | 1.0.2 | 1.0.2 | 1.0.2 | Current |
| synstructure | 0.13.2, 0.14.0 | 0.14.0 | 0.13.2, 0.14.0 | Current upstream parents retain these version slots: yoke-derive@0.7.5: ^0.13.0; yoke-derive@0.8.4: ^0.14.0; zerofrom-derive@0.1.8: ^0.14.0 |
| tempfile | 3.27.0 | 3.27.0 | 3.27.0 | Current |
| tendril | 0.5.1 | 0.5.1 | 0.5.1 | Current |
| thiserror | 1.0.69, 2.0.21 | 2.0.21 | 1.0.69, 2.0.21 | Current upstream parents retain these version slots: anyhow@1.0.104: ^2; browser-commander@0.19.0: ^2.0.21; chromiumoxide@0.9.1: ^2; command-stream@1.5.3: ^2.0.21; displaydoc@0.2.7: ^1.0.24; filedescriptor@0.8.3: ^1.0; html-to-markdown-rs@3.17.2: ^2.0; jni-macros@0.22.4: ^2; jni@0.22.4: ^2; lino-arguments@0.4.0: ^2.0.21; quinn-proto@0.11.19: ^2.0.3; quinn@0.11.12: ^2.0.3; redox_users@0.5.3: ^2.0; rsqlite-vfs@0.1.1: ^2.0.12; tungstenite@0.28.0: ^2.0.7; tungstenite@0.30.0: ^2.0.7; web-capture@0.5.0: ^2.0.21; webdriver@0.53.0: ^1 |
| thiserror-impl | 1.0.69, 2.0.21 | 2.0.21 | 1.0.69, 2.0.21 | Current upstream parents retain these version slots: thiserror@1.0.69: =1.0.69; thiserror@2.0.21: =2.0.21 |
| thread_local | 1.1.10 | 1.1.10 | 1.1.10 | Current |
| time | 0.3.55 | 0.3.55 | 0.3.55 | Current |
| time-core | 0.1.9 | 0.1.9 | 0.1.9 | Current |
| time-macros | 0.2.32 | 0.2.32 | 0.2.32 | Current |
| tiny-keccak | 2.0.2 | 2.0.2 | 2.0.2 | Current |
| tinystr | 0.7.6, 0.8.4 | 0.8.4 | 0.7.6, 0.8.4 | Current upstream parents retain these version slots: icu_locale_core@2.3.0: ^0.8.4; icu_locid@1.5.0: ^0.7.5; icu_provider@1.5.0: ^0.7.5 |
| tinyvec | 1.13.3 | 1.13.3 | 1.13.3 | Current |
| tokio | 1.53.2 | 1.53.2 | 1.53.2 | Current |
| tokio-macros | 2.7.2 | 2.7.2 | 2.7.2 | Current |
| tokio-native-tls | 0.3.1 | 0.3.1 | 0.3.1 | Current |
| tokio-rustls | 0.26.6 | 0.26.6 | 0.26.6 | Current |
| tokio-stream | 0.1.19 | 0.1.19 | 0.1.19 | Current |
| tokio-test | 0.4.6 | 0.4.6 | 0.4.6 | Current |
| tokio-util | 0.7.19 | 0.7.19 | 0.7.19 | Current |
| tower | 0.5.3 | 0.5.3 | 0.5.3 | Current |
| tower-http | 0.6.11, 0.7.1 | 0.7.1 | 0.6.11, 0.7.1 | Current upstream parents retain these version slots: axum-core@0.5.6: ^0.6.0; axum@0.8.9: ^0.6.8; html-to-markdown-rs@3.17.2: ^0.7; reqwest@0.13.5: ^0.6.8; web-capture@0.5.0: ^0.7.1 |
| tower-layer | 0.3.3 | 0.3.3 | 0.3.3 | Current |
| tower-service | 0.3.3 | 0.3.3 | 0.3.3 | Current |
| tracing | 0.1.44 | 0.1.44 | 0.1.44 | Current |
| tracing-attributes | 0.1.31 | 0.1.31 | 0.1.31 | Current |
| tracing-core | 0.1.36 | 0.1.36 | 0.1.36 | Current |
| tracing-log | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| tracing-subscriber | 0.3.23 | 0.3.23 | 0.3.23 | Current |
| try-lock | 0.2.5 | 0.2.5 | 0.2.5 | Current |
| tungstenite | 0.28.0, 0.30.0 | 0.30.0 | 0.28.0, 0.30.0 | Current upstream parents retain these version slots: async-tungstenite@0.32.1: ^0.28; async-tungstenite@0.35.0: ^0.30 |
| typed-path | 0.12.3 | 0.12.3 | 0.12.3 | Current |
| typenum | 1.20.1 | 1.20.1 | 1.20.1 | Current |
| unicode-ident | 1.0.26 | 1.0.26 | 1.0.26 | Current |
| unicode-width | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| universal-hash | 0.6.1 | 0.6.1 | 0.6.1 | Current |
| untrusted | 0.9.0 | 0.9.0 | 0.9.0 | Current |
| url | 2.5.8 | 2.5.8 | 2.5.8 | Current |
| utf-8 | 0.7.6 | 0.7.6 | 0.7.6 | Current |
| utf8_iter | 1.0.4 | 1.0.4 | 1.0.4 | Current |
| utf8parse | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| valuable | 0.1.1 | 0.1.1 | 0.1.1 | Current |
| vcpkg | 0.2.15 | 0.2.15 | 0.2.15 | Current |
| version_check | 0.9.5 | 0.9.5 | 0.9.5 | Current |
| vt100 | 0.16.2 | 0.16.2 | 0.16.2 | Current |
| vte | 0.15.0 | 0.15.0 | 0.15.0 | Current |
| walkdir | 2.5.0 | 2.5.0 | 2.5.0 | Current |
| want | 0.3.2 | 0.3.2 | 0.3.2 | Current |
| wasi | 0.11.1+wasi-snapshot-preview1 | 0.14.7+wasi-0.2.4 | 0.11.1+wasi-snapshot-preview1 | Current upstream parents retain these version slots: getrandom@0.2.17: ^0.11; mio@1.2.4: ^0.11.0 |
| wasip2 | 1.0.4+wasi-0.2.12 | 2.0.1+wasi-0.2.12 | 1.0.4+wasi-0.2.12 | Current upstream parents retain these version slots: getrandom@0.3.4: ^1 |
| wasm-bindgen | 0.2.129 | 0.2.129 | 0.2.129 | Current |
| wasm-bindgen-futures | 0.4.79 | 0.4.79 | 0.4.79 | Current |
| wasm-bindgen-macro | 0.2.129 | 0.2.129 | 0.2.129 | Current |
| wasm-bindgen-macro-support | 0.2.129 | 0.2.129 | 0.2.129 | Current |
| wasm-bindgen-shared | 0.2.129 | 0.2.129 | 0.2.129 | Current |
| web-sys | 0.3.106 | 0.3.106 | 0.3.106 | Current |
| web-time | 1.1.0 | 1.1.0 | 1.1.0 | Current |
| web_atoms | 0.2.6, 0.3.0 | 0.3.0 | 0.2.6, 0.3.0 | Current upstream parents retain these version slots: markup5ever@0.39.0: ^0.2.3; markup5ever@0.40.0: ^0.3.0 |
| webdriver | 0.53.0 | 0.54.0 | 0.53.0 | Current upstream parents retain these version slots: fantoccini@0.22.1: ^0.53 |
| webpki-root-certs | 1.0.9 | 1.0.9 | 1.0.9 | Current |
| weezl | 0.1.12 | 0.2.1 | 0.1.12 | Current upstream parents retain these version slots: gif@0.14.2: ^0.1.10 |
| which | 8.0.6 | 8.0.6 | 8.0.6 | Current |
| winapi | 0.3.9 | 0.3.9 | 0.3.9 | Current |
| winapi-i686-pc-windows-gnu | 0.4.0 | 0.4.0 | 0.4.0 | Current |
| winapi-util | 0.1.11 | 0.1.11 | 0.1.11 | Current |
| winapi-x86_64-pc-windows-gnu | 0.4.0 | 0.4.0 | 0.4.0 | Current |
| windows-core | 0.62.2 | 0.100.0 | 0.62.2 | Current upstream parents retain these version slots: iana-time-zone@0.1.65: >=0.56, <=0.62 |
| windows-implement | 0.60.2 | 0.100.0 | 0.60.2 | Current upstream parents retain these version slots: windows-core@0.62.2: ^0.60.2 |
| windows-interface | 0.59.3 | 0.100.0 | 0.59.3 | Current upstream parents retain these version slots: windows-core@0.62.2: ^0.59.3 |
| windows-link | 0.2.1 | 0.100.0 | 0.2.1 | Current upstream parents retain these version slots: chrono@0.4.45: ^0.2; jni@0.22.4: ^0.2; parking_lot_core@0.9.12: ^0.2.0; windows-core@0.62.2: ^0.2.1; windows-registry@0.6.1: ^0.2.1; windows-result@0.4.1: ^0.2.1; windows-strings@0.5.1: ^0.2.1; windows-sys@0.61.2: ^0.2.1 |
| windows-registry | 0.6.1 | 0.100.0 | 0.6.1 | Current upstream parents retain these version slots: chromiumoxide@0.9.1: ^0.6; hyper-util@0.1.21: >=0.3, <0.7 |
| windows-result | 0.4.1 | 0.100.0 | 0.4.1 | Current upstream parents retain these version slots: windows-core@0.62.2: ^0.4.1; windows-registry@0.6.1: ^0.4.1 |
| windows-strings | 0.5.1 | 0.100.0 | 0.5.1 | Current upstream parents retain these version slots: windows-core@0.62.2: ^0.5.1; windows-registry@0.6.1: ^0.5.1 |
| windows-sys | 0.52.0, 0.61.2 | 0.61.2 | 0.52.0, 0.61.2 | Current upstream parents retain these version slots: anstyle-query@1.1.5: >=0.60.2, <0.62; anstyle-wincon@3.0.11: >=0.60.2, <0.62; browser-commander@0.19.0: ^0.61.2; dirs-sys@0.5.0: >=0.59.0; errno@0.3.14: >=0.52, <0.62; jni@0.22.4: ^0.61; mio@1.2.4: ^0.61; nu-ansi-term@0.50.3: >=0.59, <=0.61; quinn-udp@0.5.16: >=0.52, <=0.61; ring@0.17.14: ^0.52; rustix@1.1.5: >=0.52, <0.62; rustls-platform-verifier@0.7.1: >=0.52.0, <0.62.0; schannel@0.1.29: ^0.61; serial2@0.2.38: ^0.61; socket2@0.6.5: >=0.60, <0.62; tempfile@3.27.0: >=0.52, <0.62; tokio@1.53.2: ^0.61; winapi-util@0.1.11: >=0.48.0, <=0.61 |
| windows-targets | 0.52.6 | 0.53.5 | 0.52.6 | Current upstream parents retain these version slots: windows-sys@0.52.0: ^0.52.0 |
| windows_aarch64_gnullvm | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_aarch64_msvc | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_i686_gnu | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_i686_gnullvm | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_i686_msvc | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_x86_64_gnu | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_x86_64_gnullvm | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| windows_x86_64_msvc | 0.52.6 | 0.53.1 | 0.52.6 | Current upstream parents retain these version slots: windows-targets@0.52.6: ^0.52.6 |
| winreg | 0.10.1 | 0.56.0 | 0.10.1 | Current upstream parents retain these version slots: portable-pty@0.9.0: ^0.10 |
| wit-bindgen | 0.57.1 | 0.62.0 | 0.57.1 | Current upstream parents retain these version slots: wasip2@1.0.4+wasi-0.2.12: ^0.57.1 |
| writeable | 0.5.5, 0.6.4 | 0.6.4 | 0.5.5, 0.6.4 | Current upstream parents retain these version slots: icu_locale_core@2.3.0: ^0.6.4; icu_locid@1.5.0: ^0.5.5; icu_provider@1.5.0: ^0.5.5; icu_provider@2.3.1: ^0.6.4; potential_utf@0.1.6: ^0.6.4 |
| xml5ever | 0.39.0 | 0.40.0 | 0.39.0 | Current upstream parents retain these version slots: markup5ever_rcdom@0.39.0+unofficial: ^0.39 |
| yoke | 0.7.5, 0.8.3 | 0.8.3 | 0.7.5, 0.8.3 | Current upstream parents retain these version slots: icu_collections@1.5.0: ^0.7.4; icu_collections@2.3.0: ^0.8.3; icu_provider@1.5.0: ^0.7.4; icu_provider@2.3.1: ^0.8.3; litemap@0.7.5: ^0.8.0; litemap@0.8.3: ^0.8.3; zerotrie@0.2.5: ^0.8.3; zerovec@0.10.4: >=0.6.0, <0.8.0; zerovec@0.11.8: ^0.8.3 |
| yoke-derive | 0.7.5, 0.8.4 | 0.8.4 | 0.7.5, 0.8.4 | Current upstream parents retain these version slots: yoke@0.7.5: ^0.7.5; yoke@0.8.3: ^0.8.2 |
| zerocopy | 0.8.61 | 0.8.61 | 0.8.61 | Current |
| zerocopy-derive | 0.8.61 | 0.8.61 | 0.8.61 | Current |
| zerofrom | 0.1.8 | 0.1.8 | 0.1.8 | Current |
| zerofrom-derive | 0.1.8 | 0.1.8 | 0.1.8 | Current |
| zeroize | 1.9.1 | 1.9.1 | 1.9.1 | Current |
| zerotrie | 0.2.5 | 0.2.5 | 0.2.5 | Current |
| zerovec | 0.10.4, 0.11.8 | 0.11.8 | 0.10.4, 0.11.8 | Current upstream parents retain these version slots: icu_collections@1.5.0: ^0.10.2; icu_collections@2.3.0: ^0.11.7; icu_locale_core@2.3.0: ^0.11.7; icu_locid@1.5.0: ^0.10.2; icu_normalizer@2.3.0: ^0.11.7; icu_properties@2.3.0: ^0.11.7; icu_provider@1.5.0: ^0.10.2; icu_provider@2.3.1: ^0.11.8; icu_segmenter@1.5.0: ^0.10.2; potential_utf@0.1.6: ^0.11.7; tinystr@0.7.6: ^0.10.2; tinystr@0.8.4: ^0.11.7; zerotrie@0.2.5: ^0.11.7 |
| zerovec-derive | 0.10.4, 0.11.6 | 0.11.6 | 0.10.4, 0.11.6 | Current upstream parents retain these version slots: zerovec@0.10.4: ^0.10.2; zerovec@0.11.8: ^0.11.5 |
| zip | 8.6.0 | 8.6.0 | 8.6.0 | Current |
| zlib-rs | 0.6.8 | 0.6.8 | 0.6.8 | Current |
| zmij | 1.0.23 | 1.0.23 | 1.0.23 | Current |
| zopfli | 0.8.3 | 0.8.3 | 0.8.3 | Current |
| zune-core | 0.5.3 | 0.5.3 | 0.5.3 | Current |
| zune-jpeg | 0.5.15 | 0.5.15 | 0.5.15 | Current |

## Python: runtime examples and all locked tooling

| Dependency | Before | Registry latest | After | Reason for older/removal |
| --- | --- | --- | --- | --- |
| boolean-py | unlocked/not declared | 5.0 | 5.0 | Current |
| cachecontrol | unlocked/not declared | 0.14.4 | 0.14.4 | Current |
| certifi | unlocked/not declared | 2026.7.22 | 2026.7.22 | Current |
| charset-normalizer | unlocked/not declared | 3.5.2 | 3.5.2 | Current |
| cyclonedx-python-lib | unlocked/not declared | 11.12.0 | 11.12.0 | Current |
| defusedxml | unlocked/not declared | 0.7.1 | 0.7.1 | Current |
| filelock | unlocked/not declared | 4.0.12 | 4.0.12 | Current |
| idna | unlocked/not declared | 3.20 | 3.20 | Current |
| license-expression | unlocked/not declared | 30.4.4 | 30.4.4 | Current |
| markdown-it-py | unlocked/not declared | 4.2.0 | 4.2.0 | Current |
| mdurl | unlocked/not declared | 0.1.2 | 0.1.2 | Current |
| msgpack | unlocked/not declared | 1.2.3 | 1.2.3 | Current |
| packageurl-python | unlocked/not declared | 0.17.6 | 0.17.6 | Current |
| packaging | unlocked/not declared | 26.3 | 26.3 | Current |
| pip | unlocked/not declared | 26.2.1 | 26.2.1 | Current |
| pip-api | unlocked/not declared | 0.0.35 | 0.0.35 | Current |
| pip-audit | unlocked/not declared | 2.10.1 | 2.10.1 | Current |
| pip-requirements-parser | unlocked/not declared | 32.0.1 | 32.0.1 | Current |
| platformdirs | unlocked/not declared | 4.12.4 | 4.12.4 | Current |
| py-serializable | unlocked/not declared | 2.1.0 | 2.1.0 | Current |
| pygments | unlocked/not declared | 2.21.0 | 2.21.0 | Current |
| pyparsing | unlocked/not declared | 3.3.3 | 3.3.3 | Current |
| requests | unlocked/not declared | 2.34.2 | 2.34.2 | Current |
| rich | unlocked/not declared | 15.0.0 | 15.0.0 | Current |
| sortedcontainers | unlocked/not declared | 2.4.0 | 2.4.0 | Current |
| tomli | unlocked/not declared | 2.5.0 | 2.5.0 | Current |
| tomli-w | unlocked/not declared | 1.2.0 | 1.2.0 | Current |
| urllib3 | unlocked/not declared | 2.8.0 | 2.8.0 | Current |
| pip | not pinned | 26.2.1 | 26.2.1 | Development/install tool |
| uv | not pinned | 0.12.23 | 0.12.23 | Development/install tool |

## Every GitHub Action

| Dependency | Before | Registry latest | After | Reason for older/removal |
| --- | --- | --- | --- | --- |
| actions/cache | v5 | v6.1.0 | v6.1.0 | Current |
| actions/checkout | v6 | v7.0.1 | v7.0.1 | Current |
| actions/setup-node | v6 | v7.1.0 | v7.1.0 | Current |
| dtolnay/rust-toolchain | stable | 89b12181fb390509a0842a86cc55eeb8eb928c1d | 89b12181fb390509a0842a86cc55eeb8eb928c1d | Current |
| peter-evans/create-pull-request | v8 | v8.1.1 | v8.1.1 | Current |
| astral-sh/setup-uv | not used | v10.2.0 | v10.2.0 | Current |

## Runtimes, images, templates and other pins

| Input | Before | Registry latest | After | Reason |
| --- | --- | --- | --- | --- |
| Node source/CI | 24 / >=22 | 26.11.1 | 26.11.1; engine >=26.10.0 | Latest published official Docker image is 26.10.0; support that current image baseline |
| npm | >=11; unlocked bootstrap | 12.2.0 | 12.2.0 in both manifests, all npm CI jobs, Docker and scaffold | Exact supported release bootstrap |
| Python | undeclared | 3.14.8 | 3.14.8; >=3.14.8 | uv-managed interpreter |
| Rust | stable / 1.96 / edition 2021 | 1.99.0 / edition 2024 | 1.99.0 / rust-version 1.99 / edition 2024 | Both Cargo projects and every workflow |
| Node image | node:24-bookworm | node:26.10.0-trixie | node:26.10.0-trixie | 26.11.1-trixie is not published (registry 404); image publication lag |
| Rust builder image | rust:1.96-bullseye | rust:1.99.0-trixie | rust:1.99.0-trixie | Current |
| Rust bare CI image | rust:1.96-slim-bullseye | rust:1.99.0-slim-trixie | rust:1.99.0-slim-trixie | Current |
| Rust runtime image | debian:bookworm-slim | debian:trixie-20261005-slim | debian:trixie-20261005-slim | Current stable distro dated image |
| Scaffold Express/Capture Website/Turndown | ^4.18.2 / ^4.1.0 / ^7.1.1 | 5.2.1 / 5.1.0 / 7.2.4 | Maintained web-capture package | Delete duplicate implementation and its untracked dependencies; all routes preserved |
| Scaffold image | node:20-slim | node:26.10.0-trixie | Same maintained JS Dockerfile | No independent stale image or apt list |
| Playwright prebuilt browser image | dynamically resolved v1.63.0-noble | v1.63.0-noble (published) | v1.64.0-noble attempted; matching CDN fallback | Registry returns 404 for current library's unpublished image; retain existing CDN fallback instead of using an incompatible older browser bundle |
| Compose | local Dockerfile build | no external image | local Dockerfile build | No separate external dependency |
| Changesets JSON schema | config@3.1.1 URL | config@4.0.1 | Local schema from locked config@4.0.1 | Match the installed current package without a second CDN version pin |

Optional Kreuzberg musl packages publish 3.5.5, but their current parent requests
the unpublished 3.7.2 (both exact-version registry requests return HTTP 404).
npm 12's lock generator drops their placeholders, although its clean installer
requires them. The compatible lock is generated once with npm 11.13.0 and verified
with npm 12.2.0; no old npm runtime/dependency is shipped. See VALIDATION.md.

Old-major transitive versions are explicit upstream constraints, not forgotten
direct updates. Forcing them with overrides can break their current parent API.
Every remaining older slot and its parent requirement is listed above. Historical
case-study dependency pins describe past incidents and are retained as evidence.
