# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Create a Public Issue

Please do not create a public GitHub issue for security vulnerabilities. This helps protect users before a fix is available.

### 2. Report Privately

Send an email to [security@nathanvale.com](mailto:security@nathanvale.com) with the following information:

- **Subject**: Security Vulnerability Report
- **Description**: A clear description of the vulnerability
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Impact**: What the vulnerability could allow an attacker to do
- **Affected Versions**: Which versions are affected
- **Suggested Fix**: If you have ideas for how to fix it (optional)

### 3. Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your report within 2 business days
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Progress Updates**: We will keep you informed of our progress
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### 4. Coordinated Disclosure

- We will work with you to understand the vulnerability
- We will develop and test a fix
- We will release the fix and publish a security advisory
- We will credit you for the discovery (unless you prefer to remain anonymous)

## Security Measures

### Automated Security Scanning

This project includes several automated security measures:

- **Dependency Scanning**: Automated npm audit checks for known vulnerabilities
- **SAST Analysis**: Static Application Security Testing using CodeQL
- **Secret Detection**: Scanning for hardcoded secrets and credentials
- **License Compliance**: Checking for problematic open source licenses

### Security Workflows

Our CI/CD pipeline includes:

- Weekly security scans on schedule
- Security checks on every pull request
- Automated Dependabot updates for vulnerable dependencies
- CodeQL analysis for common security vulnerabilities

### Best Practices

We follow these security best practices:

- **Principle of Least Privilege**: Minimal permissions for CI/CD workflows
- **Dependency Management**: Regular updates and vulnerability monitoring
- **Secure Defaults**: Secure configuration out of the box
- **Input Validation**: Proper validation of all inputs
- **Error Handling**: No sensitive information in error messages

## Security Configuration

### GitHub Security Features

We have enabled:

- [x] Dependency vulnerability alerts
- [x] Dependabot security updates
- [x] CodeQL security analysis
- [x] Secret scanning
- [x] Private vulnerability reporting

### Dependencies

We regularly:

- Monitor dependencies for security vulnerabilities
- Update dependencies to patch security issues
- Remove unused dependencies to reduce attack surface
- Use specific version pinning for critical dependencies

## Vulnerability Disclosure Timeline

When we receive a security report:

1. **Day 0**: Vulnerability reported
2. **Day 1-2**: Acknowledgment sent
3. **Day 3-5**: Initial assessment completed
4. **Day 6-30**: Fix development and testing
5. **Day 30**: Public disclosure (or sooner if appropriate)

## Security Contact

For security-related questions or concerns:

- **Email**: [security@nathanvale.com](mailto:security@nathanvale.com)
- **PGP Key**: Available upon request
- **Response Time**: 2 business days

## Hall of Fame

We appreciate security researchers who help keep our project secure:

<!-- Security researchers who report vulnerabilities will be listed here -->

_No vulnerabilities have been reported yet._

## Legal

This security policy is subject to our [Code of Conduct](./CODE_OF_CONDUCT.md) and [License](./LICENSE).

---

**Note**: This security policy applies to the monorepo template itself. Individual packages within the monorepo may have their own security considerations.