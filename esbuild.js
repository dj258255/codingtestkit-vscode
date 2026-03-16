const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  // 1. Extension bundle (Node.js)
  const extCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      {
        name: 'esbuild-problem-matcher',
        setup(build) {
          build.onStart(() => {
            console.log('[watch] build started');
          });
          build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
              console.error(`✘ [ERROR] ${text}`);
              if (location) {
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
              }
            });
            console.log('[watch] build finished');
          });
        },
      },
    ],
  });

  // 2. Webview CodeMirror bundle (Browser)
  const webCtx = await esbuild.context({
    entryPoints: ['src/webview/codemirrorBundle.ts'],
    bundle: true,
    format: 'iife',
    minify: production,
    sourcemap: !production,
    platform: 'browser',
    outfile: 'dist/codemirror.js',
    logLevel: 'silent',
  });

  if (watch) {
    await extCtx.watch();
    await webCtx.watch();
  } else {
    await extCtx.rebuild();
    await webCtx.rebuild();
    await extCtx.dispose();
    await webCtx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
