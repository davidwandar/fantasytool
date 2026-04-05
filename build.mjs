import { build, context } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');

const shared = {
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    sourcemap: true,
    logLevel: 'info',
};

const copyManifest = () => {
    mkdirSync('dist', { recursive: true });
    mkdirSync('dist/assets/icons', { recursive: true });
    copyFileSync('manifest.json', 'dist/manifest.json');
    copyFileSync('assets/icons/icon16.png', 'dist/assets/icons/icon16.png');
    copyFileSync('assets/icons/icon32.png', 'dist/assets/icons/icon32.png');
    copyFileSync('assets/icons/icon48.png', 'dist/assets/icons/icon48.png');
    copyFileSync('assets/icons/icon128.png', 'dist/assets/icons/icon128.png');
};

const buildOptions = {
    ...shared,
    entryPoints: {
        background: 'src/background.ts',
        content: 'src/content.ts',
    },
    outdir: 'dist',
};

const buildAll = async () => {
    if (watch) {
        const ctx = await context(buildOptions);
        await ctx.watch();
        copyManifest();
        console.log('Watching for changes...');
        return;
    }

    await build({
        ...shared,
        entryPoints: {
            background: 'src/background.ts',
            content: 'src/content.ts',
        },
        outdir: 'dist',
    });

    copyManifest();
};

buildAll().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
