import 'dotenv/config';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { execSync } from 'child_process';

// Read package.json for version and other info
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

// Helper function to calculate SHA512 hash of a file
function calculateSha512(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha512');
  hashSum.update(fileBuffer);
  return hashSum.digest('base64');
}

// Helper function to create git tag if it doesn't exist
function ensureGitTag(version: string): void {
  const tagName = `v${version}`;
  try {
    // Check if tag exists
    execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });
    console.log(`[Forge Hook] Tag ${tagName} already exists`);
  } catch {
    // Tag doesn't exist, create it
    try {
      execSync(`git tag ${tagName}`, { stdio: 'inherit' });
      execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
      console.log(`[Forge Hook] Created and pushed tag ${tagName}`);
    } catch (e) {
      console.error(`[Forge Hook] Failed to create tag: ${e}`);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/{better-sqlite3,bindings,file-uri-to-path}/**/*',
    },
    icon: './img/dlogo',
    extraResource: [
      './app-update.yml',
    ],
  },
  rebuildConfig: {},
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'hankarun',
        name: 'dentklarEmailer',
      },
      prerelease: true,
      draft: false,
    }),
  ],
  makers: [
    new MakerSquirrel({
      name: 'DentKlarEmailer',
      setupIcon: './img/dlogo.ico',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // List of modules to copy
      const modulesToCopy = [
        'better-sqlite3',
        'bindings',
        'file-uri-to-path',
        'pdf-parse',
        'node-ensure',
        'keytar',
        'i18next',
      ];

      fs.mkdirSync(path.join(buildPath, 'node_modules'), { recursive: true });

      for (const moduleName of modulesToCopy) {
        const srcModule = path.join(__dirname, 'node_modules', moduleName);
        const destModule = path.join(buildPath, 'node_modules', moduleName);
        
        if (fs.existsSync(srcModule) && !fs.existsSync(destModule)) {
          fs.cpSync(srcModule, destModule, { recursive: true });
        }
      }
    },

    postMake: async (_config, makeResults) => {
      // Create git tag for this version before publishing
      ensureGitTag(packageJson.version);

      // Generate latest.yml for electron-updater after making
      for (const result of makeResults) {
        if (result.platform === 'win32') {
          const outDir = path.dirname(result.artifacts[0]);
          
          // Find the setup exe (Squirrel installer)
          const setupExe = result.artifacts.find(a => a.endsWith('.exe') && a.includes('Setup'));
          
          if (setupExe) {
            // Get filename and fix space issue (use dot instead of space before "Setup")
            let fileName = path.basename(setupExe);
            // Ensure URL-safe filename (replace space with dot if present)
            const urlFileName = fileName.replace(' Setup.exe', '.Setup.exe');
            
            const fileSize = fs.statSync(setupExe).size;
            const sha512 = calculateSha512(setupExe);
            
            const latestYml = {
              version: packageJson.version,
              files: [{
                url: urlFileName,
                sha512: sha512,
                size: fileSize,
              }],
              path: urlFileName,
              sha512: sha512,
              releaseDate: new Date().toISOString(),
            };

            const latestYmlPath = path.join(outDir, 'latest.yml');
            fs.writeFileSync(latestYmlPath, yaml.dump(latestYml), 'utf-8');
            console.log('[Forge Hook] Created latest.yml at:', latestYmlPath);
            console.log('[Forge Hook] Setup exe URL:', urlFileName);
            
            // Rename the setup exe if it has a space in the name
            if (fileName !== urlFileName) {
              const oldPath = setupExe;
              const newPath = path.join(path.dirname(setupExe), urlFileName);
              fs.renameSync(oldPath, newPath);
              // Update the artifact path
              const artifactIndex = result.artifacts.indexOf(setupExe);
              if (artifactIndex !== -1) {
                result.artifacts[artifactIndex] = newPath;
              }
              console.log('[Forge Hook] Renamed setup exe to:', urlFileName);
            }
            
            // Add latest.yml to artifacts so it gets published
            result.artifacts.push(latestYmlPath);
          }
        }
      }
      return makeResults;
    },
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
