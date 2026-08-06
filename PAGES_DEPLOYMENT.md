# GitHub Pages deployment notes

This repository is a plain static HTML site: there is no package manager, no build script,
and no generated output directory. GitHub Pages should publish the repository files as-is.

If GitHub still shows checks named `pages build and deployment / build (dynamic)` or
`pages build and deployment / report-build-status (dynamic)`, the repository is still using
GitHub's generated branch-based Pages workflow. In that mode, custom workflow files in
`.github/workflows/` do not control the deployment.

To publish this site reliably, use one of these GitHub Pages settings:

1. **Deploy from a branch**
   - Source: `Deploy from a branch`
   - Branch: the repository's production branch, usually `main` or `master`
   - Folder: `/ (root)`
   - Keep `.nojekyll` in the root so Pages serves the static HTML files directly.

2. **GitHub Actions**
   - Source: `GitHub Actions`
   - Then add a Pages deployment workflow.

For this repository, branch deployment from the root is enough because the site already
contains `index.html`, chapter HTML files, `favicon.png`, and `CNAME` at the repository root.
