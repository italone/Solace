# External Adoption Evidence

Date: 2026-08-17

Target package: `@italone/solace@0.1.0-beta.5`

Both applications below are outside the Solace repository and were validated in disposable
copies. The original application source, manifests, and lockfiles were not modified.

## h5-design

- Application: `h5-note-app` at `/Users/alone/Desktop/TEST/h5-design`
- Temporary copy: `/private/tmp/solace-h5-adoption.vbbPww`
- Install: `npm install --no-audit --no-fund @italone/solace@0.1.0-beta.5`
- Resolution: `npm ls @italone/solace --depth=0` reported `@italone/solace@0.1.0-beta.5`.
- Package runtime import: `node --input-type=module -e "import { h } from '@italone/solace'; ..."` printed `h export ok function`.
- Typecheck and production build: `npm run build` (`tsc -b && vite build`) passed; Vite emitted `dist/index.html` and application chunks.
- Solace integration bundle: a temporary Vite entry importing `h` and `render` built with `npm exec vite -- build --config adoption-vite.config.ts --outDir adoption-dist`; the output contained `Solace beta.5`.
- Runtime: `npm run preview -- --host 127.0.0.1 --port 6187` served the built app; HTTP fetch of `/` passed.
- Result: verified.

## css-world

- Application: `css-world` at `/Users/alone/Desktop/TEST/css-world`
- Temporary copy: `/private/tmp/solace-css-adoption.eQBUVd`
- Install: `pnpm add --save-exact @italone/solace@0.1.0-beta.5`
- Resolution: `pnpm list @italone/solace --depth=0` reported `@italone/solace@0.1.0-beta.5`.
- Package runtime import: `node --input-type=module -e "import { h } from '@italone/solace'; ..."` printed `h export ok function`.
- Typecheck: `pnpm typecheck` passed.
- Production build: `pnpm build` (`tsc -b && vite build`) passed and emitted `dist/index.html` plus the application bundle. Vite reported only its existing large-chunk warning.
- Solace integration bundle: a temporary Vite entry importing `h` and `render` built with `pnpm exec vite build --config adoption-vite.config.ts --outDir adoption-dist`; the output contained `Solace beta.5`.
- Runtime: `pnpm preview --host 127.0.0.1 --port 6188` served the built app; HTTP fetch of `/` passed.
- Result: verified.

## Environment Notes

The first non-escalated npm request was blocked by the sandbox with `ENOTFOUND registry.npmjs.org`.
The same exact installs succeeded with approved network access; this is retained as an environment
fact, not a consumer failure. No credentials, tokens, or private registry settings were used.
