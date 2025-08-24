# Repository Setup for Automated Publishing

This document describes the required GitHub repository configuration for automated package publishing.

## Required GitHub Repository Secrets

The automated release workflow requires the following secrets to be configured in the repository:

### NPM_TOKEN

**Purpose**: Allows GitHub Actions to publish packages to the NPM registry  
**Type**: NPM Automation Token  
**Scope**: @orchestr8 organization

**Setup Steps**:

1. Log in to [npmjs.com](https://npmjs.com) with @orchestr8 organization access
2. Navigate to Account Settings → Access Tokens
3. Click "Generate New Token" → "Automation Token"
4. Set token name: `@orchestr8-github-actions`
5. Select scope: `@orchestr8` (organization-scoped)
6. Copy the generated token
7. In this GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: [paste the token]
   - Click "Add secret"

**Security Notes**:

- Automation tokens bypass 2FA requirements
- Tokens are scoped to the @orchestr8 organization only
- Tokens can be revoked at any time from npmjs.com
- Never commit or log NPM tokens

### GITHUB_TOKEN

**Purpose**: Allows changesets to create and manage release PRs  
**Type**: Automatic GitHub token  
**Setup**: No manual configuration required

This token is automatically provided by GitHub Actions and has the necessary permissions to:

- Create and update pull requests
- Read repository contents
- Write to repository (for commits)

## Permissions Configuration

The release workflow requires the following repository permissions:

```yaml
permissions:
  contents: write # Create commits and tags
  pull-requests: write # Create and manage release PRs
```

These are already configured in the `.github/workflows/release.yml` file.

## Verification

To verify the setup is working correctly:

1. **Check Secret Configuration**:
   - Repository Settings → Secrets and variables → Actions
   - Verify `NPM_TOKEN` is listed

2. **Test Workflow**:
   - Create a test changeset: `pnpm changeset`
   - Commit and push to a feature branch
   - Open PR to main branch
   - CI workflow should run successfully
   - Merge PR to main branch
   - Release workflow should create a version PR

3. **Monitor Workflow Execution**:
   - GitHub Repository → Actions tab
   - Check CI and Release workflow runs
   - Review any error messages

## Troubleshooting

### Common Issues

**NPM_TOKEN expired or invalid**:

- Error: `401 Unauthorized` during publish
- Solution: Generate new automation token and update secret

**GITHUB_TOKEN permissions**:

- Error: `403 Forbidden` when creating PRs
- Solution: Verify repository permissions in workflow file

**Changeset not found**:

- Error: No changesets found
- Solution: Ensure changesets exist before running release workflow

**Package publishing fails**:

- Error: Package already exists
- Solution: Version conflicts, check NPM registry

### Getting Help

If you encounter issues with the automated publishing:

1. Check workflow run logs in GitHub Actions
2. Verify all secrets are properly configured
3. Test changeset commands locally
4. Review NPM organization permissions
5. Contact repository maintainers

## Security Considerations

- NPM tokens are scoped to @orchestr8 organization only
- Automation tokens have limited permissions (publish only)
- Tokens can be rotated regularly for security
- All workflow runs are logged and auditable
- Secrets are encrypted and not exposed in logs
