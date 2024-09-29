const core = require('@actions/core');
const github = require('@actions/github');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

const readBlockeraFiles = require('./helpers');

async function run() {
    try {
        // Set up Git configuration
        const git = simpleGit();
        await git.addConfig('user.name', 'blockerabot');
        await git.addConfig('user.email', 'blockeraai+githubbot@gmail.com');

        // Read blockera-pm.json files
        const { packagePaths, packageRepos } = readBlockeraFiles();
        core.info(`Package paths: ${packagePaths}`);
        core.info(`Dependent repos: ${packageRepos}`);

        // Check for changes in packages
        const diff = await git.diff(['--name-only', 'HEAD^', 'HEAD']);
        packagePaths.forEach(path => {
            if (diff.includes(path)) {
                core.info(`Changes detected in package at ${path}`);
            } else {
                core.info(`No changes detected in ${path}`);
            }
        });

        // Clone dependent repos and sync changes
        for (const repo of packageRepos) {
            const repoDir = path.join('./', repo);
            await git.clone(`https://github.com/blockeraai/${repo}.git`, repoDir);

            // Set remote with access token for pushing
            await git.cwd(repoDir);
            await git.remote(['set-url', 'origin', `https://x-access-token:${process.env.BLOCKERABOT_PAT}@github.com/blockeraai/${repo}.git`]);

            // Sync package directories
            for (const packagePath of packagePaths) {
                if (repo !== github.context.repo.repo) {
                    const srcDir = path.join('./', packagePath);
                    const destDir = path.join(repoDir, packagePath);

                    await git.raw(['rsync', '-av', '--progress', srcDir, destDir, '--delete']);
                    core.info(`Synced package from ${srcDir} to ${destDir}`);
                }
            }

            // Create branch and commit changes
            await git.checkout(['-b', 'sync-packages-from-primary']);
            await git.add('./*');
            await git.commit('Sync shared packages from primary repo');

            // Push changes and create PR
            await git.push('origin', 'sync-packages-from-primary');
            core.info(`Changes pushed to ${repo}`);

            // Use octokit to create a pull request
            const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
            await octokit.pulls.create({
                owner: github.context.repo.owner,
                repo: repo,
                title: 'Sync package from Primary Repo',
                head: 'sync-packages-from-primary',
                base: 'master',
                body: 'This PR syncs the package from the ' + process.env.REPOSITORY_NAME + ' repo.'
            });
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();