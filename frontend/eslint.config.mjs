// Flat config (ESLint 9). eslint-config-next 16 ships native flat-config
// arrays, so we spread them directly. Bridging them through FlatCompat instead
// makes ESLint 9 crash with "Converting circular structure to JSON", which is
// what silently broke linting during `next build`.
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    // eslint-config-next 16 bundles eslint-plugin-react-hooks v6, which turns
    // on the React Compiler-era rules as errors. Several fire on code that is
    // correct as written (a one-shot setState in an effect, a cumulative sum
    // inside a render-time map), so we keep them as warnings — visible for
    // incremental cleanup without turning a green build red.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
];

export default eslintConfig;
