# Security Policy

## 🔒 Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability, please
follow these steps:

### Do NOT

- ❌ Open a public GitHub issue
- ❌ Post details in public forums or social media
- ❌ Exploit the vulnerability beyond verification

### DO

- ✅ Email security concerns to: security@[your-domain].com
- ✅ Include detailed steps to reproduce
- ✅ Allow reasonable time for a fix before public disclosure

## 📝 What to Include in Your Report

1. **Description** - Clear explanation of the vulnerability
2. **Impact** - Who is affected and how
3. **Steps to Reproduce** - Detailed reproduction steps
4. **Proof of Concept** - Code or screenshots if applicable
5. **Suggested Fix** - If you have recommendations

## ⏱️ Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Resolution Target**: Based on severity:
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 90 days

## 🛡️ Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## 🔍 Security Measures

This template includes several security features:

### Automated Security

- **Dependency Scanning**: `bun audit` in CI/CD pipeline
- **Trivy Scanning**: Container and filesystem vulnerability detection
- **SBOM Generation**: Supply chain transparency via CycloneDX
- **npm Provenance**: Package publishing with attestation

### Development Security

- **Strict TypeScript**: Type safety to prevent runtime errors
- **ESLint Security Plugin**: Static analysis for common vulnerabilities
- **SonarJS**: Code quality and security rules
- **Commit Signing**: Optional GPG signing for commits

### Supply Chain Security

- **Lock File**: `bun.lockb` ensures reproducible installs
- **Dependency Review**: GitHub's dependency review in PRs
- **Automated Updates**: Dependabot for security patches

## 📋 Security Checklist

Before deploying to production:

- [ ] Run `bun run security:audit`
- [ ] Review `bun run security:sbom` output
- [ ] Check `bun run bundle:size` for unexpected increases
- [ ] Validate environment variables don't contain secrets
- [ ] Ensure no sensitive data in logs
- [ ] Verify HTTPS/TLS configuration
- [ ] Review CORS settings if applicable
- [ ] Check authentication/authorization implementation

## 🎯 Security Best Practices

1. **Keep Dependencies Updated**

   ```bash
   bun update
   bun run security:audit
   ```

2. **Regular Security Checks**

   ```bash
   bun run validate
   bun run security:check
   ```

3. **Pre-commit Validation**
   - Husky hooks prevent committing secrets
   - Lint-staged runs security checks

4. **Environment Variables**
   - Never commit `.env` files
   - Use `.env.example` for documentation
   - Rotate secrets regularly

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Bun Security](https://bun.sh/docs/runtime/security)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)

## 🏆 Acknowledgments

We appreciate responsible disclosure and may acknowledge security researchers
who:

- Follow this security policy
- Provide clear, helpful reports
- Allow time for fixes before disclosure
- Contribute to making our project more secure

## 📮 Contact

- Security Email: security@[your-domain].com
- GitHub Security Advisories: [Enable in repository settings]
- General Questions:
  [Create a discussion](https://github.com/nathanvale/bun-changesets-template/discussions)

---

Thank you for helping keep this project and its users safe! 🙏
